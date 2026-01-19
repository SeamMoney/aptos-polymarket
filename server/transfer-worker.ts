/**
 * Transfer Worker - Worker thread for high-TPS token transfers
 *
 * Each worker handles a subset of sender accounts and submits transfers to
 * corresponding recipient accounts. Supports both APT and USD1 FA transfers.
 *
 * Started by: transfer-tps-server.ts using worker_threads
 */

import { parentPort, workerData } from 'worker_threads';
import {
  Aptos,
  AptosConfig,
  Network,
  Account,
} from '@aptos-labs/ts-sdk';
import {
  deriveAccount,
  validateMnemonic,
} from '../config/seed-accounts';

// ANSI color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  dim: '\x1b[2m',
  bold: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
  gray: '\x1b[90m',
};

// Worker configuration passed via workerData
interface TransferWorkerConfig {
  workerId: number;
  rpcEndpoint: string;
  network: 'mainnet' | 'testnet';
  mnemonic: string;
  accountStartIndex: number;
  accountCount: number;
  recipientStartIndex: number;
  batchSize: number;
  batchDelayMs: number;           // 0 = MaxLoad mode (continuous submission)
  fireAndForgetRatio: number;
  workerJitterMs: number;          // Worker start stagger (5000ms recommended)
  useOrderless: boolean;
  tokenType: 'apt' | 'usd1';
  usd1Metadata: string | null;
  transferAmount: number; // in octas
  verbose: boolean;
}

// Account state within worker
interface AccountState {
  account: Account;
  recipientAddress: string;
  sequenceNumber: bigint;
  successCount: number;
  failCount: number;
  isActive: boolean;
  lastTxHash: string;
}

// Worker stats for reporting to main thread
interface WorkerStats {
  workerId: number;
  totalTransfers: number;
  successfulTransfers: number;
  failedTransfers: number;
  currentTps: number;
  accountCount: number;
  activeAccounts: number;
}

// Transfer record for tracking
interface TransferRecord {
  hash: string;
  timestamp: number;
  sender: string;
  recipient: string;
  amount: number;
  success: boolean;
  latencyMs: number;
}

// Circular buffer for transfer records
const BUFFER_SIZE = 50000;
const transferBuffer: TransferRecord[] = [];
let bufferIndex = 0;

// Extract config from workerData
const config: TransferWorkerConfig = workerData;

// Stats tracking
let stats: WorkerStats = {
  workerId: config.workerId,
  totalTransfers: 0,
  successfulTransfers: 0,
  failedTransfers: 0,
  currentTps: 0,
  accountCount: config.accountCount,
  activeAccounts: 0,
};

let lastTpsCalcTime = Date.now();
let lastTpsCalcTransfers = 0;

// Adaptive delay state
let currentDelay = 0;
let consecutiveSuccess = 0;
const MEMPOOL_BACKOFF_MS = 50;
const MAX_DELAY_MS = 500;

// Control flags
let isRunning = false;

// Aptos client and accounts
let aptos: Aptos;
let accounts: AccountState[] = [];

// Format address for display
function shortAddr(addr: string): string {
  return `${addr.slice(0, 6)}..${addr.slice(-4)}`;
}

// Format amount for display
function formatAmount(octas: number): string {
  const apt = octas / 100_000_000;
  if (apt >= 1) return `${apt.toFixed(2)} APT`;
  if (apt >= 0.01) return `${apt.toFixed(4)} APT`;
  return `${octas} octas`;
}

// Log a transfer with colors
function logTransfer(
  sender: string,
  recipient: string,
  amount: number,
  success: boolean,
  latencyMs: number,
  hash?: string
): void {
  if (!config.verbose) return;

  const timestamp = new Date().toISOString().slice(11, 23);
  const w = `W${config.workerId}`;
  const arrow = '→';
  const status = success
    ? `${colors.green}✓${colors.reset}`
    : `${colors.red}✗${colors.reset}`;
  const amtStr = config.tokenType === 'apt' ? formatAmount(amount) : `${amount / 100_000_000} USD1`;
  const latency = success ? `${colors.dim}${latencyMs}ms${colors.reset}` : '';

  console.log(
    `${colors.gray}[${timestamp}]${colors.reset} ` +
    `${colors.cyan}${w}${colors.reset}  ` +
    `${colors.blue}${shortAddr(sender)}${colors.reset} ${arrow} ` +
    `${colors.magenta}${shortAddr(recipient)}${colors.reset}  ` +
    `${amtStr}  ${status} ${latency}`
  );
}

// Record a transfer
function recordTransfer(record: TransferRecord): void {
  if (transferBuffer.length < BUFFER_SIZE) {
    transferBuffer.push(record);
  } else {
    transferBuffer[bufferIndex] = record;
    bufferIndex = (bufferIndex + 1) % BUFFER_SIZE;
  }
}

// Get recorded transfers
function getRecordedTransfers(): TransferRecord[] {
  if (transferBuffer.length < BUFFER_SIZE) {
    return [...transferBuffer];
  }
  return [
    ...transferBuffer.slice(bufferIndex),
    ...transferBuffer.slice(0, bufferIndex),
  ];
}

/**
 * Initialize worker: create Aptos client, derive accounts
 */
async function initialize(): Promise<void> {
  console.log(
    `${colors.cyan}[Worker ${config.workerId}]${colors.reset} Initializing...`
  );
  console.log(
    `${colors.dim}  RPC: ${config.rpcEndpoint}${colors.reset}`
  );
  console.log(
    `${colors.dim}  Accounts: ${config.accountStartIndex} - ${config.accountStartIndex + config.accountCount - 1}${colors.reset}`
  );
  console.log(
    `${colors.dim}  Recipients: ${config.recipientStartIndex} - ${config.recipientStartIndex + config.accountCount - 1}${colors.reset}`
  );

  // Validate mnemonic
  if (!validateMnemonic(config.mnemonic)) {
    throw new Error('Invalid mnemonic');
  }

  // Create Aptos client
  const networkEnum = config.network === 'mainnet' ? Network.MAINNET : Network.TESTNET;
  aptos = new Aptos(new AptosConfig({
    network: networkEnum,
    fullnode: config.rpcEndpoint,
  }));

  // Derive sender and recipient accounts
  console.log(
    `${colors.cyan}[Worker ${config.workerId}]${colors.reset} Deriving ${config.accountCount} account pairs...`
  );
  const startDerive = Date.now();

  for (let i = 0; i < config.accountCount; i++) {
    const senderIndex = config.accountStartIndex + i;
    const recipientIndex = config.recipientStartIndex + i;

    const senderAccount = deriveAccount(config.mnemonic, senderIndex);
    const recipientAccount = deriveAccount(config.mnemonic, recipientIndex);

    accounts.push({
      account: senderAccount,
      recipientAddress: recipientAccount.accountAddress.toString(),
      sequenceNumber: 0n,
      successCount: 0,
      failCount: 0,
      isActive: true,
      lastTxHash: '',
    });

    // Progress log every 100 accounts
    if ((i + 1) % 100 === 0) {
      console.log(
        `${colors.dim}  Derived ${i + 1}/${config.accountCount} pairs${colors.reset}`
      );
    }
  }

  console.log(
    `${colors.green}[Worker ${config.workerId}]${colors.reset} Derived ${accounts.length} pairs in ${Date.now() - startDerive}ms`
  );

  // Fetch initial sequence numbers (for non-orderless mode)
  if (!config.useOrderless) {
    console.log(
      `${colors.cyan}[Worker ${config.workerId}]${colors.reset} Fetching sequence numbers...`
    );
    const batchSize = 20;
    for (let i = 0; i < accounts.length; i += batchSize) {
      const batch = accounts.slice(i, i + batchSize);
      await Promise.all(batch.map(async (accState) => {
        try {
          const info = await aptos.account.getAccountInfo({
            accountAddress: accState.account.accountAddress,
          });
          accState.sequenceNumber = BigInt(info.sequence_number);
        } catch {
          accState.sequenceNumber = 0n;
        }
      }));
    }
  }

  stats.accountCount = accounts.length;
  stats.activeAccounts = accounts.filter(a => a.isActive).length;

  const modeStr = config.batchDelayMs === 0 ? `${colors.green}MaxLoad${colors.reset}` : `${config.batchDelayMs}ms delay`;
  console.log(
    `${colors.green}[Worker ${config.workerId}]${colors.reset} Ready with ${accounts.length} accounts (${modeStr}, ${config.workerJitterMs || 5000}ms jitter)`
  );
}

/**
 * Build transfer payload
 */
function buildTransferPayload(recipientAddress: string, amount: number): {
  function: string;
  typeArguments?: string[];
  functionArguments: any[];
} {
  if (config.tokenType === 'usd1' && config.usd1Metadata) {
    // USD1 Fungible Asset transfer
    return {
      function: '0x1::primary_fungible_store::transfer',
      typeArguments: ['0x1::fungible_asset::Metadata'],
      functionArguments: [config.usd1Metadata, recipientAddress, amount],
    };
  }

  // APT transfer
  return {
    function: '0x1::aptos_account::transfer',
    functionArguments: [recipientAddress, amount],
  };
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
  const senderAddr = accState.account.accountAddress.toString();

  // Build transactions
  const buildPromises: Promise<any>[] = [];
  for (let i = 0; i < batchSize; i++) {
    const payload = buildTransferPayload(accState.recipientAddress, config.transferAmount);

    const options: any = config.useOrderless
      ? {
          replayProtectionNonce: BigInt(Math.floor(Math.random() * Number.MAX_SAFE_INTEGER)),
          expireTimestamp: Math.floor(Date.now() / 1000) + 55,
        }
      : {
          accountSequenceNumber: baseSeq + BigInt(i),
          expireTimestamp: Math.floor(Date.now() / 1000) + 30,
        };

    buildPromises.push(
      aptos.transaction.build.simple({
        sender: accState.account.accountAddress,
        data: payload,
        options: {
          ...options,
          maxGasAmount: 2000,
          gasUnitPrice: 100,
        },
      }).catch(() => null)
    );
  }

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

  // Submit transactions
  let successCount = 0;
  let failCount = 0;
  let mempoolFull = false;
  let hasSequenceError = false;

  const submitPromises = builtTxs.map((tx, i) => {
    if (!tx || !signedTxs[i]) {
      return Promise.resolve({ success: false, error: 'Build/sign failed', hash: '' });
    }

    const submitStart = Date.now();
    return aptos.transaction.submit.simple({
      transaction: tx,
      senderAuthenticator: signedTxs[i]!,
    })
    .then((result) => ({
      success: true,
      hash: result.hash,
      latencyMs: Date.now() - submitStart,
    }))
    .catch((e: any) => {
      const errMsg = e.message || 'Unknown error';
      if (errMsg.includes('mempool_is_full')) {
        mempoolFull = true;
      } else if (errMsg.includes('sequence') || errMsg.includes('invalid_transaction_update')) {
        hasSequenceError = true;
      }
      return { success: false, error: errMsg, hash: '', latencyMs: Date.now() - submitStart };
    });
  });

  const results = await Promise.all(submitPromises);

  // Count results and log transfers
  for (const result of results) {
    stats.totalTransfers++;
    if (result.success && result.hash) {
      successCount++;
      stats.successfulTransfers++;
      accState.successCount++;
      accState.lastTxHash = result.hash;

      // Record and log
      const record: TransferRecord = {
        hash: result.hash,
        timestamp: Date.now(),
        sender: senderAddr,
        recipient: accState.recipientAddress,
        amount: config.transferAmount,
        success: true,
        latencyMs: result.latencyMs || 0,
      };
      recordTransfer(record);
      logTransfer(
        senderAddr,
        accState.recipientAddress,
        config.transferAmount,
        true,
        result.latencyMs || 0,
        result.hash
      );
    } else {
      failCount++;
      stats.failedTransfers++;
      accState.failCount++;
      logTransfer(
        senderAddr,
        accState.recipientAddress,
        config.transferAmount,
        false,
        result.latencyMs || 0
      );
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
}

/**
 * Fire-and-forget batch (faster, optimistic counting)
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
    const payload = buildTransferPayload(accState.recipientAddress, config.transferAmount);
    const submitStart = Date.now();

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
      options: {
        ...options,
        maxGasAmount: 2000,
        gasUnitPrice: 100,
      },
    }).then(tx => {
      const signedTx = aptos.transaction.sign({ signer: accState.account, transaction: tx });
      return aptos.transaction.submit.simple({ transaction: tx, senderAuthenticator: signedTx });
    }).then((result) => {
      stats.totalTransfers++;
      stats.successfulTransfers++;
      accState.successCount++;
      accState.lastTxHash = result.hash;

      const latencyMs = Date.now() - submitStart;
      recordTransfer({
        hash: result.hash,
        timestamp: Date.now(),
        sender: senderAddr,
        recipient: accState.recipientAddress,
        amount: config.transferAmount,
        success: true,
        latencyMs,
      });
      logTransfer(senderAddr, accState.recipientAddress, config.transferAmount, true, latencyMs, result.hash);
    }).catch(() => {
      stats.totalTransfers++;
      stats.failedTransfers++;
      accState.failCount++;
      logTransfer(senderAddr, accState.recipientAddress, config.transferAmount, false, Date.now() - submitStart);
    });
  }
}

/**
 * Transfer loop for a single account
 *
 * Based on official Aptos transaction-emitter:
 * - WorkerOffsetMode::Jitter { jitter_millis: 5000 } for MaxLoad mode
 * - Stagger worker starts to avoid thundering herd
 * - wait_millis: 0 means continuous submission (MaxLoad mode)
 */
async function accountTransferLoop(accState: AccountState, accountIndex: number): Promise<void> {
  // Jitter-based stagger: spread account starts across workerJitterMs
  // Based on official emitter's WorkerOffsetMode::Jitter
  const jitterMs = config.workerJitterMs || 5000;
  const staggerDelay = Math.floor(Math.random() * jitterMs) + (accountIndex * 10);

  if (staggerDelay > 0) {
    await new Promise(r => setTimeout(r, staggerDelay));
  }

  // MaxLoad mode detection: batchDelayMs === 0 means continuous submission
  const isMaxLoadMode = config.batchDelayMs === 0;

  while (isRunning && accState.isActive) {
    try {
      // Hybrid mode: fire-and-forget vs safe mode
      if (Math.random() < config.fireAndForgetRatio) {
        await fireAndForgetBatch(accState);
      } else {
        await executeBatchForAccount(accState);
      }

      // Apply adaptive delay (only when mempool signals backpressure)
      if (currentDelay > 0) {
        await new Promise(r => setTimeout(r, currentDelay));
      }

      // Apply configured delay (skip in MaxLoad mode for continuous submission)
      if (!isMaxLoadMode && config.batchDelayMs > 0) {
        await new Promise(r => setTimeout(r, config.batchDelayMs));
      }

      // In MaxLoad mode, yield to event loop but don't wait
      // This prevents blocking but maintains continuous submission
      if (isMaxLoadMode) {
        await new Promise(r => setImmediate(r));
      }
    } catch {
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
    stats.currentTps = Math.round((stats.totalTransfers - lastTpsCalcTransfers) / elapsed);
  }
  lastTpsCalcTime = now;
  lastTpsCalcTransfers = stats.totalTransfers;
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
 * Start transfers
 */
async function startTransfers(): Promise<void> {
  if (isRunning) return;

  console.log(
    `${colors.green}[Worker ${config.workerId}]${colors.reset} Starting transfers with ${accounts.length} accounts...`
  );
  isRunning = true;

  // Reset stats
  stats.totalTransfers = 0;
  stats.successfulTransfers = 0;
  stats.failedTransfers = 0;
  stats.currentTps = 0;
  lastTpsCalcTime = Date.now();
  lastTpsCalcTransfers = 0;

  // Start stats reporting interval
  const statsInterval = setInterval(() => {
    if (!isRunning) {
      clearInterval(statsInterval);
      return;
    }
    reportStats();
  }, 1000);

  // Start transfer loops for all accounts in parallel
  const loopPromises = accounts.map((acc, i) => accountTransferLoop(acc, i));

  // Wait for all loops
  await Promise.all(loopPromises);

  clearInterval(statsInterval);
  console.log(
    `${colors.yellow}[Worker ${config.workerId}]${colors.reset} Transfers stopped`
  );
}

/**
 * Stop transfers
 */
function stopTransfers(): void {
  console.log(
    `${colors.yellow}[Worker ${config.workerId}]${colors.reset} Stopping...`
  );
  isRunning = false;
  accounts.forEach(a => a.isActive = false);
}

/**
 * Main worker entry point
 */
async function main() {
  try {
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
            startTransfers().catch((e) => {
              console.error(`[Worker ${config.workerId}] Transfer error:`, e);
            });
            break;
          case 'stop':
            stopTransfers();
            break;
          case 'stats':
            reportStats();
            break;
          case 'getTransfers':
            parentPort?.postMessage({
              type: 'transfers',
              data: {
                workerId: config.workerId,
                transfers: getRecordedTransfers(),
              },
            });
            break;
        }
      });
    }
  } catch (e: any) {
    console.error(
      `${colors.red}[Worker ${config.workerId}]${colors.reset} Fatal error:`,
      e.message
    );
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
