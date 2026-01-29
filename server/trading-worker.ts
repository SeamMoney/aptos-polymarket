/**
 * Trading Worker - Worker thread for multi-threaded HFT
 *
 * Each worker handles a subset of accounts and runs independent trading loops.
 * Communicates with main thread via parentPort for stats aggregation.
 *
 * Started by: hft-piscina-server.ts using worker_threads
 */

// Version marker - updated by deploy-workers.sh
const WORKER_VERSION = '2026-01-29-v4-skip-sim';
console.log(`[WORKER_VERSION] ${WORKER_VERSION}`);

import { parentPort, workerData } from 'worker_threads';
import http from 'http';
import https from 'https';
import {
  Aptos,
  AptosConfig,
  Network,
  Account,
  InputGenerateTransactionPayloadData,
} from '@aptos-labs/ts-sdk';
import {
  deriveAccount,
  validateMnemonic,
} from '../config/seed-accounts';

// Configure HTTP agents for high-throughput connections
// Increased from 100 to 1000 to handle 5000+ accounts
const httpAgent = new http.Agent({
  keepAlive: true,
  maxSockets: 1000,          // Max 1000 connections per origin (was 100)
  maxFreeSockets: 200,       // Keep more free sockets (was 50)
  timeout: 60_000,           // Longer timeout for high load (was 30s)
  scheduling: 'fifo',        // First-in-first-out for fairness
});

const httpsAgent = new https.Agent({
  keepAlive: true,
  maxSockets: 1000,
  maxFreeSockets: 200,
  timeout: 60_000,
  scheduling: 'fifo',
});

// Apply to global http/https module
http.globalAgent = httpAgent;
https.globalAgent = httpsAgent;

// Concurrency control: max accounts processing simultaneously per worker thread
// With batchSize=30, 20 accounts = 600 concurrent HTTP requests (safe for 1000 sockets)
// Can be tuned via workerData.accountConcurrency
const ACCOUNT_CONCURRENCY = (workerData as any)?.accountConcurrency || 20;

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

// Circular buffer for transaction hashes
// At 5000 TPS for 60s = 300K txns. With 4 workers, need 75K each minimum.
// Setting to 100K per worker (400K total) for safety.
const TX_BUFFER_SIZE = 100000;
const txBuffer: TxRecord[] = [];
let txBufferIndex = 0;

// Error logging flag (log first error only)
let firstErrorLogged = false;

// Track holdings per market per outcome (for balanced trading)
// Key: marketAddress, Value: Map of outcomeIndex -> tokens held
type HoldingsMap = Map<string, Map<number, number>>;

// Account state within worker
interface AccountState {
  account: Account;
  sequenceNumber: bigint;
  successCount: number;
  failCount: number;
  isActive: boolean;
  holdings: HoldingsMap;  // Track what we've bought so we can sell it
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

/**
 * Simple Semaphore for concurrency control
 * Limits how many accounts can execute batches simultaneously
 */
class Semaphore {
  private permits: number;
  private waiting: Array<() => void> = [];

  constructor(permits: number) {
    this.permits = permits;
  }

  async acquire(): Promise<void> {
    if (this.permits > 0) {
      this.permits--;
      return;
    }
    return new Promise((resolve) => {
      this.waiting.push(resolve);
    });
  }

  release(): void {
    if (this.waiting.length > 0) {
      const next = this.waiting.shift()!;
      next();
    } else {
      this.permits++;
    }
  }

  get available(): number {
    return this.permits;
  }
}

// Global semaphore for this worker thread
let accountSemaphore: Semaphore;

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

  // Derive only the accounts this worker needs (using deriveAccount directly for efficiency)
  for (let i = 0; i < config.accountCount; i++) {
    const globalIndex = config.accountStartIndex + i;
    // Use deriveAccount directly instead of deriveAccounts to avoid O(n²) derivation
    const account = deriveAccount(config.mnemonic, globalIndex);

    const accState: AccountState = {
      account,
      sequenceNumber: 0n,
      successCount: 0,
      failCount: 0,
      isActive: true,
      holdings: new Map(),  // Initialize empty holdings tracker
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
 * Build random trade payload with balanced trading
 *
 * CRITICAL FIX: Only sell outcomes that have been previously bought.
 * This prevents INSUFFICIENT_BALANCE errors from trying to sell tokens we don't own.
 */
function buildPayload(marketAddress: string, holdings: HoldingsMap): {
  payload: InputGenerateTransactionPayloadData;
  isBuy: boolean;
  outcomeIndex: number;
} {
  // Random amount between 0.01 and 0.1 USD1
  const amount = BigInt(Math.floor((Math.random() * 0.09 + 0.01) * 100_000_000));

  // Random outcome (assuming 4 outcomes for multi-outcome markets)
  const outcomeCount = 4;
  const outcomeIndex = Math.floor(Math.random() * outcomeCount);

  // Get holdings for this market
  let marketHoldings = holdings.get(marketAddress);
  if (!marketHoldings) {
    marketHoldings = new Map();
    holdings.set(marketAddress, marketHoldings);
  }

  // Find outcomes we can sell (have holdings > 0)
  const sellableOutcomes: number[] = [];
  for (let i = 0; i < outcomeCount; i++) {
    const held = marketHoldings.get(i) || 0;
    if (held > 0) {
      sellableOutcomes.push(i);
    }
  }

  // Decide buy vs sell: 70% buy, 30% sell (but only if we have something to sell)
  const wantToSell = Math.random() >= 0.7;
  const canSell = sellableOutcomes.length > 0;
  const isBuy = !wantToSell || !canSell;

  if (isBuy) {
    // Track that we're buying this outcome
    const currentHeld = marketHoldings.get(outcomeIndex) || 0;
    marketHoldings.set(outcomeIndex, currentHeld + 1);

    return {
      payload: {
        function: `${MULTI_MODULE}::buy_outcome`,
        functionArguments: [marketAddress, outcomeIndex, amount, 0n],
      },
      isBuy: true,
      outcomeIndex,
    };
  } else {
    // Sell one of the outcomes we actually hold
    const sellOutcome = sellableOutcomes[Math.floor(Math.random() * sellableOutcomes.length)];

    // Decrement holdings (we're selling)
    const currentHeld = marketHoldings.get(sellOutcome) || 0;
    marketHoldings.set(sellOutcome, Math.max(0, currentHeld - 1));

    return {
      payload: {
        function: `${MULTI_MODULE}::sell_outcome`,
        functionArguments: [marketAddress, sellOutcome, amount, 0n],
      },
      isBuy: false,
      outcomeIndex: sellOutcome,
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
 * Returns true if batch was clean (no errors), false if refresh needed
 */
async function executeBatchForAccount(accState: AccountState): Promise<boolean> {
  if (!accState.isActive) return true;

  // DEBUG: Log entry
  if (stats.totalTrades === 0 && accState.sequenceNumber < 3n) {
    console.log(`[Worker ${config.workerId}] BATCH_START seq=${accState.sequenceNumber}`);
  }

  const batchSize = config.batchSize;
  const startTime = Date.now();
  const baseSeq = accState.sequenceNumber;

  // Build payloads (using account's holdings for balanced trading)
  const payloads: { payload: InputGenerateTransactionPayloadData; isBuy: boolean; outcomeIndex: number; market: string }[] = [];
  for (let i = 0; i < batchSize; i++) {
    const market = getNextMarket();
    const info = buildPayload(market, accState.holdings);
    payloads.push({ ...info, market });
  }

  // Build transactions
  const buildPromises = payloads.map(({ payload }, i) => {
    // OPTIMIZATION: Specify gas to skip simulation (saves ~50% network round-trips)
    // 50000 gas units is conservative (actual usage ~10-20K)
    // 100 gas unit price is standard for testnet
    const options: any = config.useOrderless
      ? {
          replayProtectionNonce: BigInt(Math.floor(Math.random() * Number.MAX_SAFE_INTEGER)),
          expireTimestamp: Math.floor(Date.now() / 1000) + 120,
          maxGasAmount: 50000,
          gasUnitPrice: 100,
        }
      : {
          accountSequenceNumber: baseSeq + BigInt(i),
          expireTimestamp: Math.floor(Date.now() / 1000) + 300, // 5 minutes instead of 60 seconds
          maxGasAmount: 50000,
          gasUnitPrice: 100,
        };

    return aptos.transaction.build.simple({
      sender: accState.account.accountAddress,
      data: payload,
      options,
    }).catch((e) => {
      if (!firstErrorLogged) {
        firstErrorLogged = true;
        console.log(`[Worker ${config.workerId}] TX_BUILD_ERROR: ${e.message || 'Unknown'}`);
      }
      return null;
    });
  });

  // DEBUG: Before await
  if (stats.totalTrades === 0) {
    console.log(`[Worker ${config.workerId}] AWAITING_BUILDS`);
  }

  const builtTxs = await Promise.all(buildPromises);

  // DEBUG: After await
  if (stats.totalTrades === 0) {
    console.log(`[Worker ${config.workerId}] BUILDS_DONE count=${builtTxs.filter(t => t !== null).length}`);
  }

  // Check for build failures - these create sequence gaps
  const hasBuildFailure = builtTxs.some(tx => tx === null);

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
      // Log build/sign failures
      if (!firstErrorLogged) {
        firstErrorLogged = true;
        console.log(`[Worker ${config.workerId}] BUILD_FAILED: tx=${!!tx}, signed=${!!signedTxs[i]}`);
      }
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
      // Log first error from each worker (using console.log since console.error might not show)
      if (!firstErrorLogged) {
        firstErrorLogged = true;
        console.log(`[Worker ${config.workerId}] FIRST_ERROR: ${errMsg.slice(0, 400)}`);
        // Also send to parent thread
        parentPort?.postMessage({
          type: 'error_log',
          data: { workerId: config.workerId, error: errMsg.slice(0, 400) },
        });
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
  // CRITICAL: Must increment by batchSize, not successCount!
  // Even failed txns consume sequence numbers once submitted to mempool.
  // If we only add successes, we desync and ALL future txns fail.
  if (!config.useOrderless) {
    accState.sequenceNumber += BigInt(batchSize);
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

  // Return whether batch had errors that require sequence refresh
  // Build failures create sequence gaps, sequence errors mean we're desynced
  const needsRefresh = (hasBuildFailure || hasSequenceError) && !config.useOrderless;
  return !needsRefresh;
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

  // Build and submit without waiting (using account's holdings for balanced trading)
  for (let i = 0; i < batchSize; i++) {
    const market = getNextMarket();
    const { payload, isBuy, outcomeIndex } = buildPayload(market, accState.holdings);

    // OPTIMIZATION: Specify gas to skip simulation (saves ~50% network round-trips)
    const options: any = config.useOrderless
      ? {
          replayProtectionNonce: BigInt(Math.floor(Math.random() * Number.MAX_SAFE_INTEGER)),
          expireTimestamp: Math.floor(Date.now() / 1000) + 120,
          maxGasAmount: 50000,
          gasUnitPrice: 100,
        }
      : {
          accountSequenceNumber: baseSeq + BigInt(i),
          expireTimestamp: Math.floor(Date.now() / 1000) + 300, // 5 minutes instead of 60 seconds
          maxGasAmount: 50000,
          gasUnitPrice: 100,
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
 * Uses semaphore to limit concurrent batch executions across all accounts
 */
async function accountTradingLoop(accState: AccountState, accountIndex: number): Promise<void> {
  // DEBUG: Log loop start (only first account)
  if (accountIndex === 0) {
    console.log(`[Worker ${config.workerId}] LOOP_START account=${accountIndex} isRunning=${isRunning} isActive=${accState.isActive} concurrency=${ACCOUNT_CONCURRENCY}`);
  }

  // Small stagger to spread out initial semaphore acquisition
  const staggerDelay = (accountIndex % ACCOUNT_CONCURRENCY) * 5;
  if (staggerDelay > 0) {
    await new Promise(r => setTimeout(r, staggerDelay));
  }

  while (isRunning && accState.isActive) {
    try {
      // Acquire semaphore permit before executing batch
      // This limits concurrent batch executions to ACCOUNT_CONCURRENCY
      await accountSemaphore.acquire();

      // DEBUG: Log when first account acquires semaphore
      if (accountIndex === 0 && stats.totalTrades === 0) {
        console.log(`[Worker ${config.workerId}] SEMAPHORE_ACQUIRED account=${accountIndex} available=${accountSemaphore.available}`);
      }

      try {
        // Execute batch for this account
        let batchClean = true;
        if (Math.random() < config.fireAndForgetRatio) {
          await fireAndForgetBatch(accState);
        } else {
          batchClean = await executeBatchForAccount(accState);
        }

        // Refresh sequence if batch had errors
        if (!batchClean && !config.useOrderless) {
          await refreshSequenceNumber(accState);
        }
      } finally {
        // Always release semaphore, even on error
        accountSemaphore.release();
      }

      // Apply adaptive delay (outside semaphore to not block others)
      if (currentDelay > 0) {
        await new Promise(r => setTimeout(r, currentDelay));
      }

      // Apply configured delay
      if (config.batchDelayMs > 0) {
        await new Promise(r => setTimeout(r, config.batchDelayMs));
      }
    } catch (e: any) {
      // Release semaphore on unexpected errors
      try { accountSemaphore.release(); } catch {}

      if (!config.useOrderless) {
        await refreshSequenceNumber(accState);
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
  console.log(`[Worker ${config.workerId}] Account concurrency: ${ACCOUNT_CONCURRENCY} (${accounts.length} accounts will cycle through ${ACCOUNT_CONCURRENCY} slots)`);
  isRunning = true;

  // Initialize semaphore for this trading session
  // This limits how many accounts can execute batches simultaneously
  accountSemaphore = new Semaphore(ACCOUNT_CONCURRENCY);

  // Reset stats
  stats.totalTrades = 0;
  stats.successfulTrades = 0;
  stats.failedTrades = 0;
  stats.currentTps = 0;
  lastTpsCalcTime = Date.now();
  lastTpsCalcTrades = 0;
  firstErrorLogged = false; // Reset error logging for new run

  // Start stats reporting interval
  const statsInterval = setInterval(() => {
    if (!isRunning) {
      clearInterval(statsInterval);
      return;
    }
    reportStats();
  }, 1000);

  // Start trading loops for all accounts
  // The semaphore ensures only ACCOUNT_CONCURRENCY accounts execute batches at once
  // This prevents socket exhaustion while maintaining high throughput
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
