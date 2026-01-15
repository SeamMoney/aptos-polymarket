/**
 * Trading Worker - Worker thread for multi-threaded HFT
 *
 * Each worker handles a subset of accounts and runs independent trading loops.
 * Communicates with main thread via parentPort for stats aggregation.
 *
 * Started by: hft-piscina-server.ts using worker_threads
 */

import { parentPort, workerData } from 'worker_threads';
import {
  Aptos,
  AptosConfig,
  Network,
  Account,
  InputGenerateTransactionPayloadData,
} from '@aptos-labs/ts-sdk';
import {
  deriveAccounts,
  validateMnemonic,
} from '../config/seed-accounts';

// Worker configuration passed via workerData
interface WorkerConfig {
  workerId: number;
  rpcEndpoint: string;
  mnemonic: string;
  accountStartIndex: number;
  accountCount: number;
  contractAddress: string;
  markets: string[];
  batchSize: number;
  batchDelayMs: number;
  fireAndForgetRatio: number;
  useOrderless: boolean;
  useUsd1: boolean;
  usd1Metadata: string | null;
}

// Worker stats for reporting to main thread
interface WorkerStats {
  workerId: number;
  totalTrades: number;
  successfulTrades: number;
  failedTrades: number;
  currentTps: number;
  accountCount: number;
  activeAccounts: number;
}

// Transaction record for tracking
interface TxRecord {
  hash: string;
  timestamp: number;
  market: string;
  outcome: number;
  isBuy: boolean;
  sender: string;
}

// Circular buffer for transaction hashes (keep last N for memory efficiency)
const TX_BUFFER_SIZE = 10000;
const txBuffer: TxRecord[] = [];
let txBufferIndex = 0;

// Account state within worker
interface AccountState {
  account: Account;
  sequenceNumber: bigint;
  successCount: number;
  failCount: number;
  isActive: boolean;
}

// Extract config from workerData
const config: WorkerConfig = workerData;

// Contract addresses
const MULTI_MODULE = `${config.contractAddress}::multi_outcome_market`;

// Adaptive delay state
let currentDelay = 0;
let consecutiveSuccess = 0;
const MEMPOOL_BACKOFF_MS = 50;
const MAX_DELAY_MS = 500;

// Stats tracking
let stats: WorkerStats = {
  workerId: config.workerId,
  totalTrades: 0,
  successfulTrades: 0,
  failedTrades: 0,
  currentTps: 0,
  accountCount: config.accountCount,
  activeAccounts: 0,
};

let lastTpsCalcTime = Date.now();
let lastTpsCalcTrades = 0;

// Market round-robin
let marketIndex = 0;

// Control flags
let isRunning = false;

// Record a successful transaction
function recordTx(hash: string, market: string, outcome: number, isBuy: boolean, sender: string): void {
  const record: TxRecord = {
    hash,
    timestamp: Date.now(),
    market,
    outcome,
    isBuy,
    sender,
  };

  if (txBuffer.length < TX_BUFFER_SIZE) {
    txBuffer.push(record);
  } else {
    txBuffer[txBufferIndex] = record;
    txBufferIndex = (txBufferIndex + 1) % TX_BUFFER_SIZE;
  }
}

// Get all recorded transactions (in order)
function getRecordedTxs(): TxRecord[] {
  if (txBuffer.length < TX_BUFFER_SIZE) {
    return [...txBuffer];
  }
  // Reconstruct order from circular buffer
  return [
    ...txBuffer.slice(txBufferIndex),
    ...txBuffer.slice(0, txBufferIndex),
  ];
}

// Aptos client
let aptos: Aptos;
let accounts: AccountState[] = [];

/**
 * Initialize worker: create Aptos client, derive accounts
 */
async function initialize(): Promise<void> {
  console.log(`[Worker ${config.workerId}] Initializing...`);
  console.log(`[Worker ${config.workerId}] RPC: ${config.rpcEndpoint}`);
  console.log(`[Worker ${config.workerId}] Accounts: ${config.accountStartIndex} - ${config.accountStartIndex + config.accountCount - 1}`);

  // Validate mnemonic
  if (!validateMnemonic(config.mnemonic)) {
    throw new Error('Invalid mnemonic');
  }

  // Create Aptos client
  aptos = new Aptos(new AptosConfig({
    network: Network.TESTNET,
    fullnode: config.rpcEndpoint,
  }));

  // Derive accounts for this worker's range
  console.log(`[Worker ${config.workerId}] Deriving ${config.accountCount} accounts starting at index ${config.accountStartIndex}...`);
  const startDerive = Date.now();

  // Derive only the accounts this worker needs
  for (let i = 0; i < config.accountCount; i++) {
    const globalIndex = config.accountStartIndex + i;
    const derivedAccounts = deriveAccounts(config.mnemonic, globalIndex + 1);
    const account = derivedAccounts[globalIndex];

    const accState: AccountState = {
      account,
      sequenceNumber: 0n,
      successCount: 0,
      failCount: 0,
      isActive: true,
    };

    accounts.push(accState);

    // Progress log every 50 accounts
    if ((i + 1) % 50 === 0) {
      console.log(`[Worker ${config.workerId}] Derived ${i + 1}/${config.accountCount} accounts`);
    }
  }

  console.log(`[Worker ${config.workerId}] Derived ${accounts.length} accounts in ${Date.now() - startDerive}ms`);

  // Initialize sequence numbers (in batches to avoid rate limits)
  console.log(`[Worker ${config.workerId}] Fetching sequence numbers...`);
  const batchSize = 10;
  for (let i = 0; i < accounts.length; i += batchSize) {
    const batch = accounts.slice(i, i + batchSize);
    await Promise.all(batch.map(async (accState) => {
      try {
        const info = await aptos.account.getAccountInfo({
          accountAddress: accState.account.accountAddress,
        });
        accState.sequenceNumber = BigInt(info.sequence_number);
      } catch {
        // Account may not exist yet, sequence is 0
        accState.sequenceNumber = 0n;
      }
    }));
  }

  stats.accountCount = accounts.length;
  stats.activeAccounts = accounts.filter(a => a.isActive).length;

  console.log(`[Worker ${config.workerId}] Initialized ${accounts.length} accounts`);
}

/**
 * Get next market address (round-robin)
 */
function getNextMarket(): string {
  if (config.markets.length === 0) return '';
  const market = config.markets[marketIndex];
  marketIndex = (marketIndex + 1) % config.markets.length;
  return market;
}

/**
 * Build random trade payload
 */
function buildPayload(marketAddress: string): {
  payload: InputGenerateTransactionPayloadData;
  isBuy: boolean;
  outcomeIndex: number;
} {
  // Random amount between 0.01 and 0.1 USD1
  const amount = BigInt(Math.floor((Math.random() * 0.09 + 0.01) * 100_000_000));

  // Random outcome (assuming 4 outcomes for multi-outcome markets)
  const outcomeCount = 4;
  const outcomeIndex = Math.floor(Math.random() * outcomeCount);

  // 70% buys, 30% sells
  const isBuy = Math.random() < 0.7;

  if (isBuy) {
    return {
      payload: {
        function: `${MULTI_MODULE}::buy_outcome`,
        functionArguments: [marketAddress, outcomeIndex, amount, 0n],
      },
      isBuy: true,
      outcomeIndex,
    };
  } else {
    // Sell a different outcome (arbitrage simulation)
    const otherOutcome = (outcomeIndex + 1) % outcomeCount;
    return {
      payload: {
        function: `${MULTI_MODULE}::sell_outcome`,
        functionArguments: [marketAddress, otherOutcome, amount, 0n],
      },
      isBuy: false,
      outcomeIndex: otherOutcome,
    };
  }
}

/**
 * Refresh sequence number from chain
 */
async function refreshSequenceNumber(accState: AccountState): Promise<void> {
  try {
    const info = await aptos.account.getAccountInfo({
      accountAddress: accState.account.accountAddress,
    });
    accState.sequenceNumber = BigInt(info.sequence_number);
  } catch {
    // Ignore refresh errors
  }
}

/**
 * Execute batch for a single account
 */
async function executeBatchForAccount(accState: AccountState): Promise<void> {
  if (!accState.isActive) return;

  const batchSize = config.batchSize;
  const startTime = Date.now();
  const baseSeq = accState.sequenceNumber;

  // Build payloads
  const payloads: { payload: InputGenerateTransactionPayloadData; isBuy: boolean; outcomeIndex: number; market: string }[] = [];
  for (let i = 0; i < batchSize; i++) {
    const market = getNextMarket();
    const info = buildPayload(market);
    payloads.push({ ...info, market });
  }

  // Build transactions
  const buildPromises = payloads.map(({ payload }, i) => {
    const options: any = config.useOrderless
      ? {
          replayProtectionNonce: BigInt(Math.floor(Math.random() * Number.MAX_SAFE_INTEGER)),
          expireTimestamp: Math.floor(Date.now() / 1000) + 55,
        }
      : {
          accountSequenceNumber: baseSeq + BigInt(i),
          expireTimestamp: Math.floor(Date.now() / 1000) + 30,
        };

    return aptos.transaction.build.simple({
      sender: accState.account.accountAddress,
      data: payload,
      options,
    }).catch(() => null);
  });

  const builtTxs = await Promise.all(buildPromises);

  // Sign transactions
  const signedTxs = builtTxs.map((tx) => {
    if (!tx) return null;
    try {
      return aptos.transaction.sign({ signer: accState.account, transaction: tx });
    } catch {
      return null;
    }
  });

  // Submit transactions in parallel
  let successCount = 0;
  let failCount = 0;
  let mempoolFull = false;
  let hasSequenceError = false;

  const submitPromises = builtTxs.map((tx, i) => {
    if (!tx || !signedTxs[i]) {
      return Promise.resolve({ success: false, error: 'Build/sign failed', hash: '' });
    }

    return aptos.transaction.submit.simple({
      transaction: tx,
      senderAuthenticator: signedTxs[i]!,
    })
    .then((result) => ({ success: true, hash: result.hash }))
    .catch((e: any) => {
      const errMsg = e.message || 'Unknown error';
      if (errMsg.includes('mempool_is_full')) {
        mempoolFull = true;
      } else if (errMsg.includes('sequence') || errMsg.includes('invalid_transaction_update')) {
        hasSequenceError = true;
      }
      return { success: false, error: errMsg, hash: '' };
    });
  });

  const results = await Promise.all(submitPromises);

  // Count results and record successful transactions
  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    stats.totalTrades++;
    if (result.success && result.hash) {
      successCount++;
      stats.successfulTrades++;
      accState.successCount++;
      // Record transaction hash
      const payload = payloads[i];
      recordTx(
        result.hash,
        payload.market,
        payload.outcomeIndex,
        payload.isBuy,
        accState.account.accountAddress.toString()
      );
    } else {
      failCount++;
      stats.failedTrades++;
      accState.failCount++;
    }
  }

  // Update sequence number (non-orderless mode)
  if (!config.useOrderless) {
    accState.sequenceNumber += BigInt(successCount);
  }

  // Adaptive delay
  if (mempoolFull) {
    currentDelay = Math.min(
      currentDelay === 0 ? MEMPOOL_BACKOFF_MS : Math.floor(currentDelay * 1.5),
      MAX_DELAY_MS
    );
    consecutiveSuccess = 0;
  } else if (successCount > 0) {
    consecutiveSuccess++;
    if (consecutiveSuccess > 1) {
      currentDelay = Math.floor(currentDelay * 0.5);
    }
  }

  // Sequence refresh on error
  if (hasSequenceError && !config.useOrderless) {
    refreshSequenceNumber(accState).catch(() => {});
  }

  const batchTime = Date.now() - startTime;

  // Log progress occasionally
  if (stats.totalTrades % 500 === 0) {
    const tps = Math.round(batchSize / (batchTime / 1000));
    console.log(
      `[Worker ${config.workerId}] ${accState.account.accountAddress.toString().slice(0, 8)} ` +
      `${successCount}/${batchSize} ${tps} TPS ` +
      `total: ${stats.totalTrades}`
    );
  }
}

/**
 * Fire-and-forget batch (faster, less accurate counting)
 */
async function fireAndForgetBatch(accState: AccountState): Promise<void> {
  if (!accState.isActive) return;

  const batchSize = config.batchSize;
  const baseSeq = accState.sequenceNumber;
  const senderAddr = accState.account.accountAddress.toString();

  // Pre-increment sequence (non-orderless mode)
  if (!config.useOrderless) {
    accState.sequenceNumber += BigInt(batchSize);
  }

  // Build and submit without waiting
  for (let i = 0; i < batchSize; i++) {
    const market = getNextMarket();
    const { payload, isBuy, outcomeIndex } = buildPayload(market);

    const options: any = config.useOrderless
      ? {
          replayProtectionNonce: BigInt(Math.floor(Math.random() * Number.MAX_SAFE_INTEGER)),
          expireTimestamp: Math.floor(Date.now() / 1000) + 55,
        }
      : {
          accountSequenceNumber: baseSeq + BigInt(i),
          expireTimestamp: Math.floor(Date.now() / 1000) + 30,
        };

    aptos.transaction.build.simple({
      sender: accState.account.accountAddress,
      data: payload,
      options,
    }).then(tx => {
      const signedTx = aptos.transaction.sign({ signer: accState.account, transaction: tx });
      return aptos.transaction.submit.simple({ transaction: tx, senderAuthenticator: signedTx });
    }).then((result) => {
      stats.totalTrades++;
      stats.successfulTrades++;
      accState.successCount++;
      // Record transaction hash
      recordTx(result.hash, market, outcomeIndex, isBuy, senderAddr);
    }).catch(() => {
      stats.totalTrades++;
      stats.failedTrades++;
      accState.failCount++;
    });
  }
}

/**
 * Trading loop for a single account
 */
async function accountTradingLoop(accState: AccountState, accountIndex: number): Promise<void> {
  // Stagger start
  const staggerDelay = accountIndex * Math.ceil(100 / Math.max(accounts.length, 1));
  if (staggerDelay > 0) {
    await new Promise(r => setTimeout(r, staggerDelay));
  }

  while (isRunning && accState.isActive) {
    try {
      // Hybrid mode: fire-and-forget vs safe mode
      if (Math.random() < config.fireAndForgetRatio) {
        await fireAndForgetBatch(accState);
      } else {
        await executeBatchForAccount(accState);
      }

      // Apply adaptive delay
      if (currentDelay > 0) {
        await new Promise(r => setTimeout(r, currentDelay));
      }

      // Apply configured delay
      if (config.batchDelayMs > 0) {
        await new Promise(r => setTimeout(r, config.batchDelayMs));
      }
    } catch (e: any) {
      if (!config.useOrderless) {
        refreshSequenceNumber(accState).catch(() => {});
      }
      await new Promise(r => setTimeout(r, 30));
    }
  }
}

/**
 * Calculate TPS
 */
function calculateTps(): void {
  const now = Date.now();
  const elapsed = (now - lastTpsCalcTime) / 1000;
  if (elapsed > 0) {
    stats.currentTps = Math.round((stats.totalTrades - lastTpsCalcTrades) / elapsed);
  }
  lastTpsCalcTime = now;
  lastTpsCalcTrades = stats.totalTrades;
}

/**
 * Report stats to main thread
 */
function reportStats(): void {
  calculateTps();
  stats.activeAccounts = accounts.filter(a => a.isActive).length;

  if (parentPort) {
    parentPort.postMessage({
      type: 'stats',
      data: stats,
    });
  }
}

/**
 * Start trading
 */
async function startTrading(): Promise<void> {
  if (isRunning) return;

  console.log(`[Worker ${config.workerId}] Starting trading with ${accounts.length} accounts...`);
  isRunning = true;

  // Reset stats
  stats.totalTrades = 0;
  stats.successfulTrades = 0;
  stats.failedTrades = 0;
  stats.currentTps = 0;
  lastTpsCalcTime = Date.now();
  lastTpsCalcTrades = 0;

  // Start stats reporting interval
  const statsInterval = setInterval(() => {
    if (!isRunning) {
      clearInterval(statsInterval);
      return;
    }
    reportStats();
  }, 1000);

  // Start trading loops for all accounts in parallel
  const loopPromises = accounts.map((acc, i) => accountTradingLoop(acc, i));

  // Wait for all loops (they run until stopped)
  await Promise.all(loopPromises);

  clearInterval(statsInterval);
  console.log(`[Worker ${config.workerId}] Trading stopped`);
}

/**
 * Stop trading
 */
function stopTrading(): void {
  console.log(`[Worker ${config.workerId}] Stopping...`);
  isRunning = false;
  accounts.forEach(a => a.isActive = false);
}

/**
 * Main worker entry point
 */
async function main() {
  try {
    // Initialize on worker start
    await initialize();

    // Report ready to main thread
    if (parentPort) {
      parentPort.postMessage({
        type: 'ready',
        data: {
          workerId: config.workerId,
          accountCount: accounts.length,
        },
      });

      // Listen for commands from main thread
      parentPort.on('message', async (message: { type: string }) => {
        switch (message.type) {
          case 'start':
            startTrading().catch((e) => {
              console.error(`[Worker ${config.workerId}] Trading error:`, e);
            });
            break;
          case 'stop':
            stopTrading();
            break;
          case 'stats':
            reportStats();
            break;
          case 'getTxs':
            // Send recorded transactions to main thread
            parentPort?.postMessage({
              type: 'txs',
              data: {
                workerId: config.workerId,
                transactions: getRecordedTxs(),
              },
            });
            break;
        }
      });
    }
  } catch (e: any) {
    console.error(`[Worker ${config.workerId}] Fatal error during initialization:`, e);
    if (parentPort) {
      parentPort.postMessage({
        type: 'error',
        data: {
          workerId: config.workerId,
          error: e.message,
        },
      });
    }
    process.exit(1);
  }
}

// Run main
main();
