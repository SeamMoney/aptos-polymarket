/**
 * Balanced Trading Worker - Fixed buy/sell logic
 *
 * This worker ensures sells ≤ buys per outcome per account.
 * Key fix: Only sell tokens that were previously bought.
 *
 * Started by: hft-piscina-server.ts using worker_threads
 */

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

// Configure HTTP agents
const httpAgent = new http.Agent({
  keepAlive: true,
  maxSockets: 100,
  maxFreeSockets: 50,
  timeout: 30_000,
});

const httpsAgent = new https.Agent({
  keepAlive: true,
  maxSockets: 100,
  maxFreeSockets: 50,
  timeout: 30_000,
});

http.globalAgent = httpAgent;
https.globalAgent = httpsAgent;

// Worker configuration
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
  // New: buy/sell ratio config
  buyRatio?: number; // 0.7 = 70% buys, 30% sells (when possible)
}

interface WorkerStats {
  workerId: number;
  totalTrades: number;
  successfulTrades: number;
  failedTrades: number;
  currentTps: number;
  accountCount: number;
  activeAccounts: number;
  buyCount: number;
  sellCount: number;
  skippedSells: number; // Sells skipped due to no holdings
}

interface TxRecord {
  hash: string;
  timestamp: number;
  market: string;
  outcome: number;
  isBuy: boolean;
  sender: string;
}

// Account state with holdings tracking
interface AccountState {
  account: Account;
  sequenceNumber: bigint;
  successCount: number;
  failCount: number;
  isActive: boolean;
  // Track holdings per market+outcome
  holdings: Map<string, bigint>; // "marketAddr:outcomeIdx" -> token amount
}

// Circular buffer for transactions
const TX_BUFFER_SIZE = 100000;
const txBuffer: TxRecord[] = [];
let txBufferIndex = 0;

const config: WorkerConfig = workerData;
const MULTI_MODULE = `${config.contractAddress}::multi_outcome_market`;
const BUY_RATIO = config.buyRatio ?? 0.7; // Default 70% buys

// Stats
let stats: WorkerStats = {
  workerId: config.workerId,
  totalTrades: 0,
  successfulTrades: 0,
  failedTrades: 0,
  currentTps: 0,
  accountCount: config.accountCount,
  activeAccounts: 0,
  buyCount: 0,
  sellCount: 0,
  skippedSells: 0,
};

let lastTpsCalcTime = Date.now();
let lastTpsCalcTrades = 0;
let marketIndex = 0;
let isRunning = false;

// Adaptive delay
let currentDelay = 0;
let consecutiveSuccess = 0;
const MEMPOOL_BACKOFF_MS = 50;
const MAX_DELAY_MS = 500;

// Initialize Aptos client
let aptos: Aptos;
let accountStates: AccountState[] = [];

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

function getTxRecords(): TxRecord[] {
  if (txBuffer.length < TX_BUFFER_SIZE) {
    return [...txBuffer];
  }
  return [...txBuffer.slice(txBufferIndex), ...txBuffer.slice(0, txBufferIndex)];
}

function getNextMarket(): string {
  const market = config.markets[marketIndex % config.markets.length];
  marketIndex++;
  return market;
}

/**
 * Build a BALANCED payload that respects holdings
 */
function buildBalancedPayload(
  accState: AccountState,
  marketAddress: string
): {
  payload: InputGenerateTransactionPayloadData;
  isBuy: boolean;
  outcomeIndex: number;
  estimatedTokens: bigint;
} {
  // Random amount between 0.01 and 0.1 USD1
  const amount = BigInt(Math.floor((Math.random() * 0.09 + 0.01) * 100_000_000));

  // Random outcome (assuming 4 outcomes)
  const outcomeCount = 4;
  const outcomeIndex = Math.floor(Math.random() * outcomeCount);
  const holdingsKey = `${marketAddress}:${outcomeIndex}`;

  // Check holdings for this outcome
  const currentHoldings = accState.holdings.get(holdingsKey) || 0n;

  // Decide buy vs sell
  // If we want to sell (30% chance) AND have sufficient holdings, sell
  // Otherwise, buy
  const wantSell = Math.random() >= BUY_RATIO;
  const canSell = currentHoldings >= amount;

  if (wantSell && canSell) {
    stats.sellCount++;
    return {
      payload: {
        function: `${MULTI_MODULE}::sell_outcome`,
        functionArguments: [marketAddress, outcomeIndex, amount, 0n],
      },
      isBuy: false,
      outcomeIndex,
      estimatedTokens: amount,
    };
  } else {
    if (wantSell && !canSell) {
      stats.skippedSells++;
    }
    stats.buyCount++;

    // Estimate tokens received (rough approximation)
    // In reality this depends on pool state, but we'll use amount as estimate
    const estimatedTokens = amount;

    return {
      payload: {
        function: `${MULTI_MODULE}::buy_outcome`,
        functionArguments: [marketAddress, outcomeIndex, amount, 0n],
      },
      isBuy: true,
      outcomeIndex,
      estimatedTokens,
    };
  }
}

/**
 * Update holdings after successful trade
 */
function updateHoldings(
  accState: AccountState,
  market: string,
  outcomeIndex: number,
  isBuy: boolean,
  amount: bigint
): void {
  const key = `${market}:${outcomeIndex}`;
  const current = accState.holdings.get(key) || 0n;

  if (isBuy) {
    // Bought tokens - add to holdings
    accState.holdings.set(key, current + amount);
  } else {
    // Sold tokens - subtract from holdings
    const newAmount = current - amount;
    if (newAmount > 0n) {
      accState.holdings.set(key, newAmount);
    } else {
      accState.holdings.delete(key);
    }
  }
}

async function refreshSequenceNumber(accState: AccountState): Promise<void> {
  try {
    const info = await aptos.account.getAccountInfo({
      accountAddress: accState.account.accountAddress,
    });
    accState.sequenceNumber = BigInt(info.sequence_number);
  } catch {
    // Ignore
  }
}

async function executeBatchForAccount(accState: AccountState): Promise<void> {
  if (!accState.isActive) return;

  const batchSize = config.batchSize;
  const baseSeq = accState.sequenceNumber;

  // Build BALANCED payloads
  const payloads: {
    payload: InputGenerateTransactionPayloadData;
    isBuy: boolean;
    outcomeIndex: number;
    market: string;
    estimatedTokens: bigint;
  }[] = [];

  for (let i = 0; i < batchSize; i++) {
    const market = getNextMarket();
    const info = buildBalancedPayload(accState, market);
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

  // Update sequence number optimistically
  const validCount = signedTxs.filter(Boolean).length;
  if (!config.useOrderless) {
    accState.sequenceNumber += BigInt(validCount);
  }

  // Submit transactions
  const submitPromises = signedTxs.map(async (signedTx, i) => {
    if (!signedTx) return null;

    const payloadInfo = payloads[i];
    const isFireAndForget = Math.random() < config.fireAndForgetRatio;

    try {
      const result = await aptos.transaction.submit.simple({ transaction: builtTxs[i]!, senderAuthenticator: signedTx });

      stats.totalTrades++;

      if (isFireAndForget) {
        stats.successfulTrades++;
        consecutiveSuccess++;

        // Optimistically update holdings
        updateHoldings(
          accState,
          payloadInfo.market,
          payloadInfo.outcomeIndex,
          payloadInfo.isBuy,
          payloadInfo.estimatedTokens
        );

        recordTx(
          result.hash,
          payloadInfo.market,
          payloadInfo.outcomeIndex,
          payloadInfo.isBuy,
          accState.account.accountAddress.toString()
        );

        // Broadcast to main thread
        parentPort?.postMessage({
          type: 'trade',
          trade: {
            hash: result.hash,
            market: payloadInfo.market,
            outcome: payloadInfo.outcomeIndex,
            isBuy: payloadInfo.isBuy,
            sender: accState.account.accountAddress.toString(),
            timestamp: Date.now(),
          },
        });

        return result;
      }

      // Wait for confirmation
      const receipt = await aptos.waitForTransaction({
        transactionHash: result.hash,
        options: { timeoutSecs: 10 },
      });

      if ((receipt as any).success) {
        stats.successfulTrades++;
        consecutiveSuccess++;

        updateHoldings(
          accState,
          payloadInfo.market,
          payloadInfo.outcomeIndex,
          payloadInfo.isBuy,
          payloadInfo.estimatedTokens
        );

        recordTx(
          result.hash,
          payloadInfo.market,
          payloadInfo.outcomeIndex,
          payloadInfo.isBuy,
          accState.account.accountAddress.toString()
        );

        parentPort?.postMessage({
          type: 'trade',
          trade: {
            hash: result.hash,
            market: payloadInfo.market,
            outcome: payloadInfo.outcomeIndex,
            isBuy: payloadInfo.isBuy,
            sender: accState.account.accountAddress.toString(),
            timestamp: Date.now(),
          },
        });
      } else {
        stats.failedTrades++;
        consecutiveSuccess = 0;
        accState.failCount++;
      }

      return result;
    } catch (error: any) {
      stats.totalTrades++;
      stats.failedTrades++;
      consecutiveSuccess = 0;
      accState.failCount++;

      // Check for mempool errors
      const errMsg = error.message || '';
      if (errMsg.includes('MEMPOOL_IS_FULL') || errMsg.includes('SEQUENCE_NUMBER')) {
        currentDelay = Math.min(currentDelay + MEMPOOL_BACKOFF_MS, MAX_DELAY_MS);
      }

      return null;
    }
  });

  await Promise.all(submitPromises);

  // Reduce delay on success
  if (consecutiveSuccess > 10 && currentDelay > 0) {
    currentDelay = Math.max(0, currentDelay - 10);
  }
}

async function runTradingLoop(): Promise<void> {
  while (isRunning) {
    const batchPromises = accountStates
      .filter((acc) => acc.isActive)
      .map((acc) => executeBatchForAccount(acc));

    await Promise.all(batchPromises);

    // Wait between batches
    const totalDelay = config.batchDelayMs + currentDelay;
    if (totalDelay > 0) {
      await new Promise((resolve) => setTimeout(resolve, totalDelay));
    }

    // Calculate TPS
    const now = Date.now();
    const elapsed = (now - lastTpsCalcTime) / 1000;
    if (elapsed >= 1) {
      stats.currentTps = Math.round((stats.successfulTrades - lastTpsCalcTrades) / elapsed);
      lastTpsCalcTrades = stats.successfulTrades;
      lastTpsCalcTime = now;

      // Send stats to main thread
      parentPort?.postMessage({
        type: 'stats',
        stats: { ...stats },
      });
    }
  }
}

async function initialize(): Promise<void> {
  if (!validateMnemonic(config.mnemonic)) {
    throw new Error('Invalid mnemonic');
  }

  aptos = new Aptos(
    new AptosConfig({
      network: Network.TESTNET,
      fullnode: config.rpcEndpoint,
    })
  );

  // Derive accounts
  for (let i = 0; i < config.accountCount; i++) {
    const accountIndex = config.accountStartIndex + i;
    const account = deriveAccount(config.mnemonic, accountIndex);

    accountStates.push({
      account,
      sequenceNumber: 0n,
      successCount: 0,
      failCount: 0,
      isActive: true,
      holdings: new Map(), // Start with empty holdings
    });
  }

  // Refresh sequence numbers
  await Promise.all(accountStates.map(refreshSequenceNumber));

  stats.activeAccounts = accountStates.filter((a) => a.isActive).length;

  console.log(`[Worker ${config.workerId}] Initialized with ${stats.activeAccounts} accounts (balanced mode)`);
}

// Handle messages from main thread
parentPort?.on('message', async (message: any) => {
  if (message.type === 'start') {
    isRunning = true;
    runTradingLoop();
  } else if (message.type === 'stop') {
    isRunning = false;
  } else if (message.type === 'getStats') {
    parentPort?.postMessage({
      type: 'stats',
      stats: { ...stats },
    });
  } else if (message.type === 'getTxRecords') {
    parentPort?.postMessage({
      type: 'txRecords',
      records: getTxRecords(),
    });
  }
});

// Initialize on load
initialize().catch((err) => {
  console.error(`[Worker ${config.workerId}] Init failed:`, err.message);
  process.exit(1);
});
