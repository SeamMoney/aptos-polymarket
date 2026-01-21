#!/usr/bin/env npx tsx
/**
 * Transfer TPS Server - High-performance token transfer demonstration
 *
 * Multi-threaded server for demonstrating Aptos throughput with simple
 * token transfers. Supports both APT and USD1 Fungible Asset transfers.
 *
 * Features:
 * - Beautiful CLI output with box-drawn headers and live stats
 * - Worker thread pool for true CPU parallelism
 * - Orderless transactions (AIP-123) for conflict-free submission
 * - Adaptive throttling based on mempool feedback
 *
 * Usage:
 *   SEED_MNEMONIC="..." npx tsx server/transfer-tps-server.ts [mode]
 *
 * Modes: light, turbo, quantum, hyper
 */

import { Worker } from 'worker_threads';
import path from 'path';
import { fileURLToPath } from 'url';
import { Aptos, AptosConfig, Network } from '@aptos-labs/ts-sdk';
import { validateMnemonic } from '../config/seed-accounts';

// ESM-compatible __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ANSI color codes
const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
  gray: '\x1b[90m',
  bgGreen: '\x1b[42m',
  bgBlue: '\x1b[44m',
  bgCyan: '\x1b[46m',
};

// Mode configurations
// Based on Aptos official transaction-emitter:
// - MaxLoad mode uses wait_millis: 0 (continuous submission)
// - transactions_per_account: 20 (in-flight txns per account)
// - jitter_millis: 5000 (worker start stagger)
// - mempool_backlog: 3000 (target mempool depth)
interface ModeConfig {
  accounts: number;
  workers: number;
  batchSize: number;           // Transactions per batch per account
  batchDelayMs: number;        // Delay between batches (0 = MaxLoad mode)
  fireAndForgetRatio: number;  // % of txns that don't wait for confirmation
  workerJitterMs: number;      // Worker start stagger to avoid thundering herd
  targetTps: number;
}

const MODES: Record<string, ModeConfig> = {
  // Dryrun mode: Ultra-light for testing (~10 TPS)
  dryrun: {
    accounts: 10,
    workers: 1,
    batchSize: 1,
    batchDelayMs: 500,
    fireAndForgetRatio: 0,      // Wait for ALL confirmations
    workerJitterMs: 0,
    targetTps: 10,
  },
  // Reliable mode: 100% success rate, waits for confirmations
  reliable: {
    accounts: 100,
    workers: 4,
    batchSize: 1,               // One txn at a time per account
    batchDelayMs: 100,          // Wait between batches
    fireAndForgetRatio: 0,      // Wait for ALL confirmations
    workerJitterMs: 500,
    targetTps: 500,             // Conservative target
  },
  // Light mode: Safe for testing, low resource usage
  light: {
    accounts: 200,
    workers: 4,
    batchSize: 5,
    batchDelayMs: 50,
    fireAndForgetRatio: 0.8,
    workerJitterMs: 1000,
    targetTps: 2000,
  },
  // Proven mode: Exact config that achieved 3,180 TPS with AMM contract
  // Uses AMM turbo settings - reliable and battle-tested
  proven: {
    accounts: 500,
    workers: 4,
    batchSize: 30,              // AMM turbo batchSize
    batchDelayMs: 40,           // AMM turbo delay (not MaxLoad)
    fireAndForgetRatio: 0.85,   // AMM turbo FAF ratio
    workerJitterMs: 2000,       // AMM worker stagger
    targetTps: 5000,            // Conservative target (achieved 3K+ with AMM)
  },
  // Turbo mode: Balanced performance, reliable for demos
  turbo: {
    accounts: 500,
    workers: 4,
    batchSize: 20,              // Match official transactions_per_account
    batchDelayMs: 20,
    fireAndForgetRatio: 0.9,
    workerJitterMs: 3000,
    targetTps: 5000,
  },
  // Quantum mode: High throughput, some delay for stability
  quantum: {
    accounts: 1000,
    workers: 8,
    batchSize: 20,
    batchDelayMs: 10,
    fireAndForgetRatio: 0.95,
    workerJitterMs: 5000,       // Match official jitter_millis
    targetTps: 10000,
  },
  // Hyper mode: Maximum throughput (MaxLoad style)
  // Based on official emitter: wait_millis: 0, mempool_backlog: 3000
  hyper: {
    accounts: 2000,
    workers: 16,
    batchSize: 20,              // Match official transactions_per_account
    batchDelayMs: 0,            // MaxLoad mode: NO DELAY (continuous submission)
    fireAndForgetRatio: 0.99,   // Almost all fire-and-forget
    workerJitterMs: 5000,       // 5 second worker start spread
    targetTps: 16000,
  },
};

// RPC endpoints
interface RpcEndpoint {
  url: string;
  name: string;
  network: 'mainnet' | 'testnet';
}

const TESTNET_ENDPOINTS: RpcEndpoint[] = [
  { url: 'https://polished-evocative-borough.aptos-testnet.quiknode.pro/a0b08bae2dc34e4a8774d91414948d02a5ce2975/v1', name: 'QuikNode', network: 'testnet' },
  { url: 'https://aptos.cash.trading/v1', name: 'Custom Fullnode', network: 'testnet' },
  { url: 'http://vfn0.usce1-0.testnet.aptoslabs.com:80/v1', name: 'Internal VFN', network: 'testnet' },
  { url: 'https://fullnode.testnet.aptoslabs.com/v1', name: 'Aptos Labs', network: 'testnet' },
];

const MAINNET_ENDPOINTS: RpcEndpoint[] = [
  { url: 'https://fullnode.mainnet.aptoslabs.com/v1', name: 'Aptos Labs', network: 'mainnet' },
];

// Configuration
const config = {
  network: (process.env.NETWORK?.toLowerCase() || 'testnet') as 'mainnet' | 'testnet',
  mode: (process.argv[2] || process.env.MODE || 'turbo').toLowerCase(),
  mnemonic: process.env.SEED_MNEMONIC || '',
  tokenType: (process.env.TOKEN_TYPE || 'apt') as 'apt' | 'usd1',
  usd1Metadata: process.env.USD1_METADATA || null,
  transferAmount: parseInt(process.env.TRANSFER_AMOUNT || '1', 10), // 1 octa default
  duration: parseInt(process.env.DURATION || '60', 10),
  verbose: process.env.VERBOSE === 'true',
  customRpc: process.env.RPC_URL || null,
  vfnUrl: process.env.VFN_URL || null,
};

// Get mode config
function getModeConfig(): ModeConfig {
  const modeConfig = MODES[config.mode];
  if (!modeConfig) {
    console.error(`Unknown mode: ${config.mode}. Available: ${Object.keys(MODES).join(', ')}`);
    process.exit(1);
  }

  // Allow overrides via env vars
  return {
    accounts: parseInt(process.env.ACCOUNTS || String(modeConfig.accounts), 10),
    workers: parseInt(process.env.WORKERS || String(modeConfig.workers), 10),
    batchSize: parseInt(process.env.BATCH_SIZE || String(modeConfig.batchSize), 10),
    batchDelayMs: parseInt(process.env.BATCH_DELAY_MS || String(modeConfig.batchDelayMs), 10),
    fireAndForgetRatio: parseFloat(process.env.FAF_RATIO || String(modeConfig.fireAndForgetRatio)),
    workerJitterMs: parseInt(process.env.WORKER_JITTER_MS || String(modeConfig.workerJitterMs), 10),
    targetTps: modeConfig.targetTps,
  };
}

// Worker stats
interface WorkerStats {
  workerId: number;
  totalTransfers: number;
  successfulTransfers: number;
  failedTransfers: number;
  currentTps: number;
  accountCount: number;
  activeAccounts: number;
}

// Global state
const workerStats = new Map<number, WorkerStats>();
const workers = new Map<number, Worker>();
let workersReady = 0;
let workersDone = 0;
let startTime = 0;
let peakTps = 0;
let isRunning = false;

// Print box-drawn header
function printHeader(modeConfig: ModeConfig): void {
  const networkStr = config.network.toUpperCase();
  const tokenStr = config.tokenType.toUpperCase();
  const modeStr = config.mode.toUpperCase();

  console.log();
  console.log(`${c.cyan}╔══════════════════════════════════════════════════════════════════════╗${c.reset}`);
  console.log(`${c.cyan}║${c.reset}           ${c.bold}APTOS TOKEN TRANSFER TPS DEMO${c.reset}                             ${c.cyan}║${c.reset}`);
  console.log(`${c.cyan}╠══════════════════════════════════════════════════════════════════════╣${c.reset}`);
  console.log(`${c.cyan}║${c.reset}  Network: ${c.yellow}${networkStr.padEnd(8)}${c.reset} │  Token: ${c.green}${tokenStr.padEnd(6)}${c.reset} │  Mode: ${c.magenta}${modeStr.padEnd(8)}${c.reset}       ${c.cyan}║${c.reset}`);
  console.log(`${c.cyan}║${c.reset}  Accounts: ${String(modeConfig.accounts).padEnd(6)} │  Workers: ${String(modeConfig.workers).padEnd(4)} │  Target: ${String(modeConfig.targetTps).padEnd(6)} TPS    ${c.cyan}║${c.reset}`);
  console.log(`${c.cyan}╚══════════════════════════════════════════════════════════════════════╝${c.reset}`);
  console.log();
}

// Print progress bar
function progressBar(current: number, target: number, width: number = 30): string {
  const ratio = Math.min(current / target, 1);
  const filled = Math.round(ratio * width);
  const empty = width - filled;
  const bar = '█'.repeat(filled) + '░'.repeat(empty);

  if (ratio >= 0.9) return `${c.green}${bar}${c.reset}`;
  if (ratio >= 0.5) return `${c.yellow}${bar}${c.reset}`;
  return `${c.red}${bar}${c.reset}`;
}

// Get aggregated stats
function getAggregatedStats(): {
  totalTransfers: number;
  successfulTransfers: number;
  failedTransfers: number;
  currentTps: number;
  elapsedSeconds: number;
  successRate: number;
} {
  let totalTransfers = 0;
  let successfulTransfers = 0;
  let failedTransfers = 0;
  let currentTps = 0;

  workerStats.forEach((stats) => {
    totalTransfers += stats.totalTransfers;
    successfulTransfers += stats.successfulTransfers;
    failedTransfers += stats.failedTransfers;
    currentTps += stats.currentTps;
  });

  const elapsedSeconds = startTime > 0 ? (Date.now() - startTime) / 1000 : 0;
  const successRate = totalTransfers > 0 ? (successfulTransfers / totalTransfers) * 100 : 0;

  // Track peak TPS
  if (currentTps > peakTps) {
    peakTps = currentTps;
  }

  return { totalTransfers, successfulTransfers, failedTransfers, currentTps, elapsedSeconds, successRate };
}

// Print stats bar (overwrites previous line)
function printStatsBar(modeConfig: ModeConfig): void {
  const stats = getAggregatedStats();
  const bar = progressBar(stats.currentTps, modeConfig.targetTps, 20);

  const line1 = `│ TPS: ${bar} ${String(stats.currentTps).padStart(6)} │ Peak: ${String(peakTps).padStart(6)} │ ${stats.successRate.toFixed(1).padStart(5)}% ok │`;
  const line2 = `│ Submitted: ${String(stats.totalTransfers).padStart(8)} │ Success: ${String(stats.successfulTransfers).padStart(8)} │ Failed: ${String(stats.failedTransfers).padStart(6)} │ ${stats.elapsedSeconds.toFixed(1).padStart(5)}s │`;

  // Move cursor up and clear lines
  process.stdout.write('\x1b[2A\x1b[2K');
  console.log(`${c.dim}┌─────────────────────────────────────────────────────────────────────┐${c.reset}`);
  process.stdout.write('\x1b[2K');
  console.log(`${c.dim}${line1}${c.reset}`);
  process.stdout.write('\x1b[2K');
  console.log(`${c.dim}${line2}${c.reset}`);
  process.stdout.write('\x1b[2K');
  console.log(`${c.dim}└─────────────────────────────────────────────────────────────────────┘${c.reset}`);
}

// Verify RPC endpoints
async function verifyEndpoints(): Promise<RpcEndpoint[]> {
  const baseEndpoints = config.network === 'mainnet' ? MAINNET_ENDPOINTS : TESTNET_ENDPOINTS;
  const endpoints: RpcEndpoint[] = [];

  // Add custom/VFN endpoints first
  if (config.customRpc) {
    endpoints.push({ url: config.customRpc, name: 'Custom RPC', network: config.network });
  }
  if (config.vfnUrl) {
    endpoints.push({ url: config.vfnUrl, name: 'Internal VFN', network: config.network });
  }
  endpoints.push(...baseEndpoints);

  console.log(`${c.cyan}[VERIFY]${c.reset} Checking RPC endpoints...`);

  const verified: RpcEndpoint[] = [];
  const expectedChainId = config.network === 'mainnet' ? 1 : 2;

  for (const endpoint of endpoints) {
    try {
      const aptos = new Aptos(new AptosConfig({
        network: config.network === 'mainnet' ? Network.MAINNET : Network.TESTNET,
        fullnode: endpoint.url,
      }));

      const ledgerInfo = await aptos.getLedgerInfo();
      const chainId = parseInt(ledgerInfo.chain_id.toString());

      if (chainId === expectedChainId) {
        console.log(`  ${c.green}[OK]${c.reset} ${endpoint.name}: ${c.dim}chain_id=${chainId}${c.reset}`);
        verified.push(endpoint);
      } else {
        console.log(`  ${c.yellow}[SKIP]${c.reset} ${endpoint.name}: wrong chain_id (got ${chainId})`);
      }
    } catch (e: any) {
      console.log(`  ${c.red}[FAIL]${c.reset} ${endpoint.name}: ${e.message?.slice(0, 50)}`);
    }
  }

  if (verified.length === 0) {
    throw new Error('No valid RPC endpoints available');
  }

  return verified;
}

// Calculate worker ranges
function getWorkerRanges(modeConfig: ModeConfig, endpoints: RpcEndpoint[]): Array<{
  workerId: number;
  startIndex: number;
  recipientStartIndex: number;
  count: number;
  rpcEndpoint: string;
}> {
  const accountsPerWorker = Math.floor(modeConfig.accounts / modeConfig.workers);
  const remainder = modeConfig.accounts % modeConfig.workers;
  const ranges: Array<{
    workerId: number;
    startIndex: number;
    recipientStartIndex: number;
    count: number;
    rpcEndpoint: string;
  }> = [];

  let currentIndex = 0;

  for (let i = 0; i < modeConfig.workers; i++) {
    const count = accountsPerWorker + (i < remainder ? 1 : 0);
    ranges.push({
      workerId: i,
      startIndex: currentIndex,
      recipientStartIndex: modeConfig.accounts + currentIndex,
      count,
      rpcEndpoint: endpoints[i % endpoints.length].url,
    });
    currentIndex += count;
  }

  return ranges;
}

// Create worker
function createWorker(workerConfig: {
  workerId: number;
  rpcEndpoint: string;
  startIndex: number;
  recipientStartIndex: number;
  count: number;
}, modeConfig: ModeConfig): Worker {
  const workerPath = path.resolve(__dirname, 'transfer-worker.cjs');

  const worker = new Worker(workerPath, {
    workerData: {
      workerId: workerConfig.workerId,
      rpcEndpoint: workerConfig.rpcEndpoint,
      network: config.network,
      mnemonic: config.mnemonic,
      accountStartIndex: workerConfig.startIndex,
      accountCount: workerConfig.count,
      recipientStartIndex: workerConfig.recipientStartIndex,
      batchSize: modeConfig.batchSize,
      batchDelayMs: modeConfig.batchDelayMs,
      fireAndForgetRatio: modeConfig.fireAndForgetRatio,
      workerJitterMs: modeConfig.workerJitterMs,  // Pass jitter config to worker
      useOrderless: modeConfig.fireAndForgetRatio > 0,  // Disable orderless for reliable mode (FAF=0)
      tokenType: config.tokenType,
      usd1Metadata: config.usd1Metadata,
      transferAmount: config.transferAmount,
      verbose: config.verbose,
    },
  });

  worker.on('message', (message: { type: string; data: any }) => {
    switch (message.type) {
      case 'ready':
        workersReady++;
        console.log(
          `${c.green}[READY]${c.reset} Worker ${message.data.workerId} initialized with ${message.data.accountCount} accounts`
        );
        break;
      case 'stats':
        workerStats.set(message.data.workerId, message.data);
        break;
      case 'error':
        console.error(`${c.red}[ERROR]${c.reset} Worker ${message.data.workerId}: ${message.data.error}`);
        break;
    }
  });

  worker.on('error', (err) => {
    console.error(`${c.red}[ERROR]${c.reset} Worker ${workerConfig.workerId}:`, err.message);
  });

  worker.on('exit', (code) => {
    if (code !== 0 && isRunning) {
      console.log(`${c.yellow}[EXIT]${c.reset} Worker ${workerConfig.workerId} exited with code ${code}`);
    }
    workers.delete(workerConfig.workerId);
    workersDone++;
  });

  return worker;
}

// Print final results
function printResults(modeConfig: ModeConfig): void {
  const stats = getAggregatedStats();
  const avgTps = stats.elapsedSeconds > 0 ? stats.totalTransfers / stats.elapsedSeconds : 0;

  console.log();
  console.log(`${c.cyan}═══════════════════════════════════════════════════════════════════════${c.reset}`);
  console.log(`${c.bold}                              RESULTS${c.reset}`);
  console.log(`${c.cyan}═══════════════════════════════════════════════════════════════════════${c.reset}`);
  console.log();
  console.log(`  ${c.dim}Network:${c.reset}          ${config.network.toUpperCase()}`);
  console.log(`  ${c.dim}Token:${c.reset}            ${config.tokenType.toUpperCase()}`);
  console.log(`  ${c.dim}Mode:${c.reset}             ${config.mode.toUpperCase()}`);
  console.log(`  ${c.dim}Duration:${c.reset}         ${stats.elapsedSeconds.toFixed(2)}s`);
  console.log();
  console.log(`  ${c.dim}Total Submitted:${c.reset}  ${stats.totalTransfers.toLocaleString()}`);
  console.log(`  ${c.dim}Successful:${c.reset}       ${c.green}${stats.successfulTransfers.toLocaleString()}${c.reset}`);
  console.log(`  ${c.dim}Failed:${c.reset}           ${c.red}${stats.failedTransfers.toLocaleString()}${c.reset}`);
  console.log(`  ${c.dim}Success Rate:${c.reset}     ${stats.successRate.toFixed(2)}%`);
  console.log();
  console.log(`  ${c.dim}Average TPS:${c.reset}      ${c.bold}${avgTps.toFixed(2)}${c.reset}`);
  console.log(`  ${c.dim}Peak TPS:${c.reset}         ${c.bold}${c.green}${peakTps}${c.reset}`);
  console.log(`  ${c.dim}Target TPS:${c.reset}       ${modeConfig.targetTps}`);
  console.log();

  // Cost estimation
  const gasPerTxn = 0.00002; // Approximate APT per transfer
  const estimatedCost = stats.successfulTransfers * gasPerTxn;
  console.log(`  ${c.dim}Estimated Gas:${c.reset}    ~${estimatedCost.toFixed(4)} APT`);
  console.log();

  const explorerUrl = config.network === 'mainnet'
    ? 'https://explorer.aptoslabs.com/?network=mainnet'
    : 'https://explorer.aptoslabs.com/?network=testnet';
  console.log(`  ${c.dim}Explorer:${c.reset}         ${c.blue}${explorerUrl}${c.reset}`);
  console.log();
  console.log(`${c.cyan}═══════════════════════════════════════════════════════════════════════${c.reset}`);
  console.log();
}

// Main function
async function main(): Promise<void> {
  const modeConfig = getModeConfig();

  printHeader(modeConfig);

  // Validate mnemonic
  if (!config.mnemonic) {
    console.error(`${c.red}ERROR:${c.reset} SEED_MNEMONIC environment variable required`);
    console.error(`Usage: SEED_MNEMONIC="word1 word2 ..." npx tsx server/transfer-tps-server.ts [mode]`);
    process.exit(1);
  }

  if (!validateMnemonic(config.mnemonic)) {
    console.error(`${c.red}ERROR:${c.reset} Invalid mnemonic phrase`);
    process.exit(1);
  }

  // USD1 validation
  if (config.tokenType === 'usd1' && !config.usd1Metadata) {
    console.error(`${c.red}ERROR:${c.reset} USD1_METADATA required when TOKEN_TYPE=usd1`);
    process.exit(1);
  }

  console.log(`${c.cyan}[CONFIG]${c.reset} Settings:`);
  console.log(`  ${c.dim}Accounts:${c.reset}     ${modeConfig.accounts}`);
  console.log(`  ${c.dim}Workers:${c.reset}      ${modeConfig.workers}`);
  console.log(`  ${c.dim}Batch Size:${c.reset}   ${modeConfig.batchSize} txns/account`);
  console.log(`  ${c.dim}Batch Delay:${c.reset}  ${modeConfig.batchDelayMs === 0 ? `${c.green}0ms (MaxLoad)${c.reset}` : `${modeConfig.batchDelayMs}ms`}`);
  console.log(`  ${c.dim}Worker Jitter:${c.reset} ${modeConfig.workerJitterMs}ms (stagger start)`);
  console.log(`  ${c.dim}F&F Ratio:${c.reset}    ${(modeConfig.fireAndForgetRatio * 100).toFixed(0)}%`);
  console.log(`  ${c.dim}Duration:${c.reset}     ${config.duration}s`);
  console.log();

  // Verify RPC endpoints
  const endpoints = await verifyEndpoints();
  console.log();

  // Calculate worker ranges
  const workerRanges = getWorkerRanges(modeConfig, endpoints);

  console.log(`${c.cyan}[WORKERS]${c.reset} Allocating ${modeConfig.workers} workers:`);
  for (const range of workerRanges) {
    console.log(
      `  ${c.dim}Worker ${range.workerId}:${c.reset} accounts ${range.startIndex}-${range.startIndex + range.count - 1} → ` +
      `recipients ${range.recipientStartIndex}-${range.recipientStartIndex + range.count - 1}`
    );
  }
  console.log();

  // Create workers
  console.log(`${c.cyan}[INIT]${c.reset} Starting workers...`);
  for (const range of workerRanges) {
    workerStats.set(range.workerId, {
      workerId: range.workerId,
      totalTransfers: 0,
      successfulTransfers: 0,
      failedTransfers: 0,
      currentTps: 0,
      accountCount: range.count,
      activeAccounts: 0,
    });

    const worker = createWorker(range, modeConfig);
    workers.set(range.workerId, worker);
  }

  // Wait for workers to initialize
  console.log(`${c.cyan}[INIT]${c.reset} Waiting for workers to initialize...`);
  const initTimeout = 120000;
  const initStart = Date.now();

  while (workersReady < modeConfig.workers) {
    if (Date.now() - initStart > initTimeout) {
      console.error(`${c.red}ERROR:${c.reset} Timeout waiting for workers (${workersReady}/${modeConfig.workers} ready)`);
      process.exit(1);
    }
    await new Promise(r => setTimeout(r, 100));
  }

  console.log();
  console.log(`${c.green}[READY]${c.reset} All ${modeConfig.workers} workers initialized!`);
  console.log();

  // Start transfers
  console.log(`${c.cyan}═══════════════════════════════════════════════════════════════════════${c.reset}`);
  console.log(`${c.bold}                     STARTING TRANSFER DEMO${c.reset}`);
  console.log(`${c.cyan}═══════════════════════════════════════════════════════════════════════${c.reset}`);
  console.log();

  isRunning = true;
  startTime = Date.now();
  workers.forEach(worker => worker.postMessage({ type: 'start' }));

  // Print initial stats bar placeholder
  console.log();
  console.log();
  console.log();
  console.log();

  // Stats display loop
  const statsInterval = setInterval(() => {
    printStatsBar(modeConfig);
  }, 500);

  // Duration timer
  await new Promise<void>((resolve) => {
    setTimeout(() => {
      isRunning = false;
      workers.forEach(worker => worker.postMessage({ type: 'stop' }));
      resolve();
    }, config.duration * 1000);
  });

  // Wait for workers to finish
  await new Promise(r => setTimeout(r, 2000));

  clearInterval(statsInterval);

  // Print final results
  printResults(modeConfig);

  // Terminate workers
  workers.forEach(worker => worker.terminate());

  process.exit(0);
}

// Run
main().catch(e => {
  console.error(`${c.red}Fatal error:${c.reset}`, e);
  process.exit(1);
});
