#!/usr/bin/env npx tsx
/**
 * HFT Piscina Server - Multi-threaded coordinator for 500+ accounts
 *
 * Uses worker_threads for true CPU parallelism.
 * Each worker handles a subset of accounts independently.
 *
 * Architecture:
 * - Main thread: Express/WebSocket server, stats aggregation
 * - Worker threads: Independent trading loops (trading-worker.ts)
 *
 * Usage:
 *   SEED_MNEMONIC="..." npx tsx server/hft-piscina-server.ts [mode]
 *
 * Modes: dryrun, light, normal, turbo, quantum (default: quantum)
 *
 * Environment:
 *   SEED_MNEMONIC     - BIP-39 seed phrase (required)
 *   ACCOUNT_COUNT     - Total accounts (default: 500)
 *   WORKER_COUNT      - Worker threads (default: 4)
 *   RPC_MODE          - internal|custom (default: internal, uses Aptos Labs VFN)
 *   USE_ORDERLESS     - true|false (default: true)
 */

import express from 'express';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { Worker } from 'worker_threads';

// ESM-compatible __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import { Aptos, AptosConfig, Network } from '@aptos-labs/ts-sdk';
import { validateMnemonic } from '../config/seed-accounts';

// Configuration
const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS || '0xca4d40eae9f07fb28a121862d649203fb4335ece9536ee51790e19f812ff7aea';

// RPC endpoints - multiple internal VFNs for failover
const INTERNAL_VFNS = [
  'http://vfn0.usce1-1.testnet.aptoslabs.com:80/v1',
  'http://vfn0.usce1-0.testnet.aptoslabs.com:80/v1',
];
const CUSTOM_FULLNODE = process.env.FULLNODE_URL || 'https://aptos.cash.trading/v1';

// Find first working VFN endpoint
async function findWorkingVfn(): Promise<string> {
  for (const vfn of INTERNAL_VFNS) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3000);
      const response = await fetch(vfn, { signal: controller.signal });
      clearTimeout(timeout);
      if (response.ok) {
        console.log(`Found working VFN: ${vfn}`);
        return vfn;
      }
    } catch {
      console.log(`VFN unavailable: ${vfn}`);
    }
  }
  // Fallback to first one even if not responding
  console.log(`No VFN responding, using default: ${INTERNAL_VFNS[0]}`);
  return INTERNAL_VFNS[0];
}

const RPC_MODE = process.env.RPC_MODE || 'internal';
let selectedVfn: string | null = null;

const getRpcEndpoints = (): string[] => {
  switch (RPC_MODE) {
    case 'internal':
      return [selectedVfn || INTERNAL_VFNS[0]];
    case 'custom':
      return [process.env.FULLNODE_URL || CUSTOM_FULLNODE];
    default:
      return [selectedVfn || INTERNAL_VFNS[0]];
  }
};

// Run modes
type RunMode = 'dryrun' | 'light' | 'normal' | 'turbo' | 'quantum' | 'max2k';

const MODE_CONFIGS: Record<RunMode, {
  batchSize: number;
  batchDelayMs: number;
  fireAndForgetRatio: number;
  targetTps: number;
}> = {
  dryrun: {
    batchSize: 1,
    batchDelayMs: 100,
    fireAndForgetRatio: 0.5,
    targetTps: 10,
  },
  light: {
    batchSize: 3,
    batchDelayMs: 80,
    fireAndForgetRatio: 0,  // Disable fire-and-forget for reliable error recovery
    targetTps: 100,
  },
  normal: {
    batchSize: 10,
    batchDelayMs: 50,
    fireAndForgetRatio: 0,  // Disable fire-and-forget for reliable error recovery
    targetTps: 1000,
  },
  turbo: {
    batchSize: 30,
    batchDelayMs: 40,
    fireAndForgetRatio: 0,  // Disable fire-and-forget for reliable error recovery
    targetTps: 3000,
  },
  quantum: {
    batchSize: 50,  // Per-worker batch size
    batchDelayMs: 20,
    fireAndForgetRatio: 0,  // Disable fire-and-forget for reliable error recovery
    targetTps: 5000,
  },
  max2k: {
    batchSize: 25,            // Smaller batches for 2000 accounts
    batchDelayMs: 30,         // Slightly more delay for stability
    fireAndForgetRatio: 0,    // Disable fire-and-forget for reliable error recovery
    targetTps: 8000,          // Target 8K TPS with 2000 accounts
  },
};

function resolveMode(): RunMode {
  const argMode = process.argv[2];
  if (['dryrun', 'light', 'normal', 'turbo', 'quantum', 'max2k'].includes(argMode)) {
    return argMode as RunMode;
  }
  return 'quantum';
}

const RUN_MODE = resolveMode();
const MODE_CONFIG = MODE_CONFIGS[RUN_MODE];

// Allow env var overrides for fine-tuning without changing mode
const BATCH_SIZE_OVERRIDE = process.env.BATCH_SIZE ? parseInt(process.env.BATCH_SIZE) : null;
const BATCH_DELAY_OVERRIDE = process.env.BATCH_DELAY_MS ? parseInt(process.env.BATCH_DELAY_MS) : null;

// Apply overrides
if (BATCH_SIZE_OVERRIDE !== null) {
  MODE_CONFIG.batchSize = BATCH_SIZE_OVERRIDE;
}
if (BATCH_DELAY_OVERRIDE !== null) {
  MODE_CONFIG.batchDelayMs = BATCH_DELAY_OVERRIDE;
}

// Account configuration
const ACCOUNT_COUNT = parseInt(process.env.ACCOUNT_COUNT || '500');
const ACCOUNT_START_INDEX = parseInt(process.env.ACCOUNT_START_INDEX || '0'); // Offset for parallel demos

// Worker count with smart defaults based on account count
function getRecommendedWorkerCount(accountCount: number): number {
  if (accountCount <= 500) return 4;
  if (accountCount <= 1000) return 6;
  if (accountCount <= 2000) return 8;
  return 16; // Max 16 workers
}

const DEFAULT_WORKER_COUNT = getRecommendedWorkerCount(ACCOUNT_COUNT);
const WORKER_COUNT = Math.min(
  parseInt(process.env.WORKER_COUNT || String(DEFAULT_WORKER_COUNT)),
  16 // Cap at 16 workers
);
const USE_ORDERLESS = process.env.USE_ORDERLESS !== 'false'; // Default true
const USE_USD1 = process.env.USE_USD1 === 'true';
const USD1_METADATA = process.env.USD1_METADATA || null;

// Account concurrency per worker thread (controls how many accounts execute batches simultaneously)
// Higher = more throughput but more HTTP connections. Default 20, can tune based on testing.
const ACCOUNT_CONCURRENCY = parseInt(process.env.ACCOUNT_CONCURRENCY || '20');

// Markets (comma-separated)
const MARKETS = (process.env.MULTI_MARKETS || '').split(',').map(m => m.trim()).filter(m => m);

// Worker stats aggregation
interface WorkerStats {
  workerId: number;
  totalTrades: number;
  successfulTrades: number;
  failedTrades: number;
  currentTps: number;
  accountCount: number;
  activeAccounts: number;
}

interface AggregatedStats {
  totalTrades: number;
  successfulTrades: number;
  failedTrades: number;
  currentTps: number;
  totalAccounts: number;
  activeAccounts: number;
  workerCount: number;
  workers: WorkerStats[];
  elapsedSeconds: number;
  successRate: string;
}

// Transaction record (same as worker)
interface TxRecord {
  hash: string;
  timestamp: number;
  market: string;
  outcome: number;
  isBuy: boolean;
  sender: string;
}

// Run metadata for analytics
interface RunMetadata {
  runId: string;
  contractAddress: string;
  startTime: number;
  endTime: number;
  startBlock: number | null;
  endBlock: number | null;
  mode: string;
  rpcMode: string;
  accountCount: number;
  workerCount: number;
  useOrderless: boolean;
  markets: string[];
  totalSubmitted: number;
  successfulTrades: number;
  failedTrades: number;
  peakTps: number;
  transactions: TxRecord[];
}

// Global state
const workerStats = new Map<number, WorkerStats>();
const workers = new Map<number, Worker>();
const workerTxs = new Map<number, TxRecord[]>();
let isRunning = false;
let startTime = 0;
let endTime = 0;
let workersReady = 0;
let peakTps = 0;
let runId = '';

// Results file path
const RESULTS_FILE = '/tmp/hft-submitted-txns.json';

// WebSocket clients
const clients = new Set<WebSocket>();

// Broadcast to all clients
function broadcast(data: object): void {
  const message = JSON.stringify(data);
  for (const client of clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  }
}

// Get aggregated stats
function getAggregatedStats(): AggregatedStats {
  let totalTrades = 0;
  let successfulTrades = 0;
  let failedTrades = 0;
  let currentTps = 0;
  let totalAccounts = 0;
  let activeAccounts = 0;

  const workerList: WorkerStats[] = [];

  workerStats.forEach((stats) => {
    totalTrades += stats.totalTrades;
    successfulTrades += stats.successfulTrades;
    failedTrades += stats.failedTrades;
    currentTps += stats.currentTps;
    totalAccounts += stats.accountCount;
    activeAccounts += stats.activeAccounts;
    workerList.push(stats);
  });

  const elapsedSeconds = startTime > 0 ? Math.round((Date.now() - startTime) / 1000) : 0;
  const successRate = totalTrades > 0
    ? ((successfulTrades / totalTrades) * 100).toFixed(1)
    : '0.0';

  return {
    totalTrades,
    successfulTrades,
    failedTrades,
    currentTps,
    totalAccounts,
    activeAccounts,
    workerCount: workerStats.size,
    workers: workerList,
    elapsedSeconds,
    successRate,
  };
}

// Calculate per-worker account allocation
function getWorkerAccountRanges(): Array<{ workerId: number; startIndex: number; count: number; rpcEndpoint: string }> {
  const accountsPerWorker = Math.floor(ACCOUNT_COUNT / WORKER_COUNT);
  const remainder = ACCOUNT_COUNT % WORKER_COUNT;
  const rpcEndpoints = getRpcEndpoints();

  const ranges: Array<{ workerId: number; startIndex: number; count: number; rpcEndpoint: string }> = [];
  let currentIndex = ACCOUNT_START_INDEX; // Start from offset for parallel demos

  for (let i = 0; i < WORKER_COUNT; i++) {
    // Distribute remainder across first few workers
    const count = accountsPerWorker + (i < remainder ? 1 : 0);
    ranges.push({
      workerId: i,
      startIndex: currentIndex,
      count,
      // Round-robin RPC endpoints across workers
      rpcEndpoint: rpcEndpoints[i % rpcEndpoints.length],
    });
    currentIndex += count;
  }

  return ranges;
}

// Create a worker thread
function createWorker(config: {
  workerId: number;
  rpcEndpoint: string;
  mnemonic: string;
  accountStartIndex: number;
  accountCount: number;
}): Worker {
  // Use pre-compiled JS worker (run: npx esbuild server/trading-worker.ts --bundle --platform=node --outfile=server/trading-worker.js --format=esm --external:@aptos-labs/ts-sdk --external:bip39 --external:@scure/bip32)
  const workerPath = path.resolve(__dirname, 'trading-worker.js');

  const workerConfig = {
    workerId: config.workerId,
    rpcEndpoint: config.rpcEndpoint,
    mnemonic: config.mnemonic,
    accountStartIndex: config.accountStartIndex,
    accountCount: config.accountCount,
    contractAddress: CONTRACT_ADDRESS,
    markets: MARKETS,
    batchSize: MODE_CONFIG.batchSize,
    batchDelayMs: MODE_CONFIG.batchDelayMs,
    fireAndForgetRatio: MODE_CONFIG.fireAndForgetRatio,
    useOrderless: USE_ORDERLESS,
    useUsd1: USE_USD1,
    usd1Metadata: USD1_METADATA,
    accountConcurrency: ACCOUNT_CONCURRENCY,
  };

  // Create worker with compiled JS file (no special execArgv needed)
  const worker = new Worker(workerPath, {
    workerData: workerConfig,
  });

  // Handle worker messages
  worker.on('message', (message: { type: string; data: any }) => {
    switch (message.type) {
      case 'ready':
        workersReady++;
        console.log(`[Main] Worker ${message.data.workerId} ready with ${message.data.accountCount} accounts (${workersReady}/${WORKER_COUNT})`);
        break;
      case 'stats':
        workerStats.set(message.data.workerId, message.data);
        // Track peak TPS
        const currentTotalTps = Array.from(workerStats.values()).reduce((sum, s) => sum + s.currentTps, 0);
        if (currentTotalTps > peakTps) {
          peakTps = currentTotalTps;
        }
        break;
      case 'txs':
        // Store transactions from worker
        workerTxs.set(message.data.workerId, message.data.transactions);
        console.log(`[Main] Received ${message.data.transactions.length} txs from worker ${message.data.workerId}`);
        break;
      case 'error':
        console.error(`[Main] Worker ${message.data.workerId} error: ${message.data.error}`);
        break;
    }
  });

  worker.on('error', (err) => {
    console.error(`[Main] Worker ${config.workerId} error:`, err);
  });

  worker.on('exit', (code) => {
    console.log(`[Main] Worker ${config.workerId} exited with code ${code}`);
    workers.delete(config.workerId);
  });

  return worker;
}

// Initialize all workers
async function initializeWorkers(): Promise<void> {
  console.log('='.repeat(70));
  console.log('   MULTI-THREADED HFT SERVER');
  console.log('   Using worker_threads for true CPU parallelism');
  console.log('='.repeat(70));
  console.log();

  // Validate mnemonic
  const mnemonic = process.env.SEED_MNEMONIC;
  if (!mnemonic) {
    console.error('ERROR: SEED_MNEMONIC environment variable not set');
    console.error('Run: SEED_MNEMONIC="..." npx tsx server/hft-piscina-server.ts');
    process.exit(1);
  }

  if (!validateMnemonic(mnemonic)) {
    console.error('ERROR: Invalid mnemonic phrase');
    process.exit(1);
  }

  console.log(`Mode: ${RUN_MODE}`);
  console.log(`RPC Mode: ${RPC_MODE}`);
  console.log(`RPC Endpoints: ${getRpcEndpoints().join(', ')}`);
  console.log(`Total Accounts: ${ACCOUNT_COUNT}${ACCOUNT_START_INDEX > 0 ? ` (starting at index ${ACCOUNT_START_INDEX})` : ''}`);
  console.log(`Account Range: ${ACCOUNT_START_INDEX} - ${ACCOUNT_START_INDEX + ACCOUNT_COUNT - 1}`);
  console.log(`Worker Threads: ${WORKER_COUNT}`);
  console.log(`Accounts per Worker: ~${Math.floor(ACCOUNT_COUNT / WORKER_COUNT)}`);
  console.log(`Account Concurrency: ${ACCOUNT_CONCURRENCY} per thread (${ACCOUNT_CONCURRENCY * WORKER_COUNT} total concurrent batches)`);
  console.log(`Use Orderless: ${USE_ORDERLESS}`);
  console.log(`Markets: ${MARKETS.length}`);
  console.log(`Batch Size: ${MODE_CONFIG.batchSize}`);
  console.log(`Max Concurrent HTTP Requests: ~${ACCOUNT_CONCURRENCY * MODE_CONFIG.batchSize} per thread`);
  console.log(`Target TPS: ${MODE_CONFIG.targetTps}`);
  console.log();

  if (MARKETS.length === 0) {
    console.error('ERROR: No markets configured. Set MULTI_MARKETS env var');
    process.exit(1);
  }

  // Create workers
  const workerRanges = getWorkerAccountRanges();

  console.log('Worker Allocation:');
  console.log('-'.repeat(70));
  for (const range of workerRanges) {
    console.log(`  Worker ${range.workerId}: accounts ${range.startIndex}-${range.startIndex + range.count - 1} (${range.count}) @ ${range.rpcEndpoint.slice(0, 40)}...`);
  }
  console.log('-'.repeat(70));
  console.log();

  console.log('Starting workers...');

  for (const range of workerRanges) {
    // Initialize stats for worker
    workerStats.set(range.workerId, {
      workerId: range.workerId,
      totalTrades: 0,
      successfulTrades: 0,
      failedTrades: 0,
      currentTps: 0,
      accountCount: range.count,
      activeAccounts: range.count,
    });

    // Create worker
    const worker = createWorker({
      workerId: range.workerId,
      rpcEndpoint: range.rpcEndpoint,
      mnemonic: mnemonic,
      accountStartIndex: range.startIndex,
      accountCount: range.count,
    });

    workers.set(range.workerId, worker);
  }

  // Wait for all workers to be ready
  console.log('Waiting for workers to initialize...');
  const waitStart = Date.now();
  const timeout = 120000; // 2 minutes timeout for account derivation

  while (workersReady < WORKER_COUNT) {
    if (Date.now() - waitStart > timeout) {
      console.error(`ERROR: Timeout waiting for workers (only ${workersReady}/${WORKER_COUNT} ready)`);
      process.exit(1);
    }
    await new Promise(r => setTimeout(r, 100));
  }

  console.log(`All ${WORKER_COUNT} workers initialized!`);
  console.log();
}

// Send command to all workers
function broadcastToWorkers(message: { type: string }): void {
  workers.forEach((worker) => {
    worker.postMessage(message);
  });
}

// Get current block height
async function getCurrentBlockHeight(): Promise<number | null> {
  try {
    const rpcEndpoints = getRpcEndpoints();
    const aptos = new Aptos(new AptosConfig({
      network: Network.TESTNET,
      fullnode: rpcEndpoints[0],
    }));
    const ledgerInfo = await aptos.getLedgerInfo();
    return parseInt(ledgerInfo.block_height);
  } catch (e) {
    console.error('[Main] Failed to get block height:', e);
    return null;
  }
}

// Collect transactions from all workers
async function collectTransactionsFromWorkers(): Promise<TxRecord[]> {
  console.log('[Main] Collecting transactions from workers...');
  workerTxs.clear();

  // Request transactions from all workers
  broadcastToWorkers({ type: 'getTxs' });

  // Wait for responses (max 10 seconds)
  const startWait = Date.now();
  const timeout = 10000;

  while (workerTxs.size < workers.size && Date.now() - startWait < timeout) {
    await new Promise(r => setTimeout(r, 100));
  }

  // Merge all transactions
  const allTxs: TxRecord[] = [];
  workerTxs.forEach((txs) => {
    allTxs.push(...txs);
  });

  // Sort by timestamp
  allTxs.sort((a, b) => a.timestamp - b.timestamp);

  console.log(`[Main] Collected ${allTxs.length} transactions from ${workerTxs.size} workers`);
  return allTxs;
}

// Save run results to file
async function saveRunResults(transactions: TxRecord[]): Promise<void> {
  const stats = getAggregatedStats();

  const metadata: RunMetadata = {
    runId,
    contractAddress: CONTRACT_ADDRESS,
    startTime,
    endTime,
    startBlock: null, // Will be filled by analytics if needed
    endBlock: null,
    mode: RUN_MODE,
    rpcMode: RPC_MODE,
    accountCount: ACCOUNT_COUNT,
    workerCount: WORKER_COUNT,
    useOrderless: USE_ORDERLESS,
    markets: MARKETS,
    totalSubmitted: stats.totalTrades,
    successfulTrades: stats.successfulTrades,
    failedTrades: stats.failedTrades,
    peakTps,
    transactions,
  };

  // Save to file
  fs.writeFileSync(RESULTS_FILE, JSON.stringify(metadata, null, 2));
  console.log(`[Main] Results saved to ${RESULTS_FILE}`);

  // Also save to timestamped file for history
  const historyDir = path.join(process.env.HOME || '/tmp', '.aptos-tps-history');
  if (!fs.existsSync(historyDir)) {
    fs.mkdirSync(historyDir, { recursive: true });
  }
  const historyFile = path.join(historyDir, `${runId}.json`);
  fs.writeFileSync(historyFile, JSON.stringify(metadata, null, 2));
  console.log(`[Main] History saved to ${historyFile}`);
}

// Express server setup
const app = express();
app.use(cors());
app.use(express.json());

const server = createServer(app);
const wss = new WebSocketServer({ server });

// WebSocket connections
wss.on('connection', (ws) => {
  console.log('Client connected');
  clients.add(ws);

  // Send current state
  ws.send(JSON.stringify({
    type: 'state',
    data: {
      isRunning,
      stats: getAggregatedStats(),
    },
  }));

  ws.on('close', () => {
    console.log('Client disconnected');
    clients.delete(ws);
  });
});

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    isRunning,
    workersReady,
    stats: getAggregatedStats(),
  });
});

// Status
app.get('/status', (req, res) => {
  const stats = getAggregatedStats();
  res.json({
    status: 'ok',
    isRunning,
    mode: RUN_MODE,
    rpcMode: RPC_MODE,
    accounts: {
      total: stats.totalAccounts,
      active: stats.activeAccounts,
    },
    workers: {
      count: stats.workerCount,
      ready: workersReady,
    },
    stats: {
      totalTrades: stats.totalTrades,
      successfulTrades: stats.successfulTrades,
      failedTrades: stats.failedTrades,
      currentTps: stats.currentTps,
      successRate: stats.successRate,
      elapsedSeconds: stats.elapsedSeconds,
    },
    workerDetails: stats.workers,
  });
});

// Start trading
app.post('/start', async (req, res) => {
  if (isRunning) {
    return res.json({ success: true, message: 'Already running' });
  }

  if (workersReady < WORKER_COUNT) {
    return res.status(400).json({
      success: false,
      error: `Only ${workersReady}/${WORKER_COUNT} workers ready`,
    });
  }

  isRunning = true;
  startTime = Date.now();
  endTime = 0;
  peakTps = 0;
  runId = `run-${startTime}`;
  workerTxs.clear();

  // Reset stats
  workerStats.forEach((stats) => {
    stats.totalTrades = 0;
    stats.successfulTrades = 0;
    stats.failedTrades = 0;
    stats.currentTps = 0;
  });

  console.log('='.repeat(70));
  console.log('   STARTING TRADING');
  console.log(`   Run ID: ${runId}`);
  console.log(`   Start Time: ${new Date(startTime).toISOString()}`);
  console.log('='.repeat(70));

  // Signal all workers to start
  broadcastToWorkers({ type: 'start' });

  broadcast({ type: 'started', stats: getAggregatedStats() });
  res.json({
    success: true,
    message: 'Trading started',
    runId,
    startTime,
  });
});

// Stop trading
app.post('/stop', async (req, res) => {
  if (!isRunning) {
    return res.json({ success: true, message: 'Already stopped' });
  }

  console.log('Stopping all workers...');
  isRunning = false;
  endTime = Date.now();

  // Signal all workers to stop
  broadcastToWorkers({ type: 'stop' });

  const stats = getAggregatedStats();
  broadcast({ type: 'stopped', stats });

  // Collect transactions and save results
  console.log('='.repeat(70));
  console.log('   RUN COMPLETE');
  console.log(`   Run ID: ${runId}`);
  console.log(`   Duration: ${Math.round((endTime - startTime) / 1000)}s`);
  console.log(`   Total Trades: ${stats.totalTrades}`);
  console.log(`   Success Rate: ${stats.successRate}%`);
  console.log(`   Peak TPS: ${peakTps}`);
  console.log('='.repeat(70));

  // Collect and save in background (don't block response)
  collectTransactionsFromWorkers().then(async (transactions) => {
    await saveRunResults(transactions);
    console.log('');
    console.log('='.repeat(70));
    console.log('   RESULTS SAVED');
    console.log(`   File: ${RESULTS_FILE}`);
    console.log(`   Transactions recorded: ${transactions.length}`);
    console.log('');
    console.log('   Run analysis:');
    console.log(`   npx tsx scripts/analyze-submitted-txns.ts`);
    console.log(`   npx tsx scripts/deep-tps-analysis.ts`);
    console.log('='.repeat(70));
  }).catch((e) => {
    console.error('[Main] Failed to save results:', e);
  });

  res.json({
    success: true,
    message: 'Trading stopped',
    runId,
    startTime,
    endTime,
    duration: Math.round((endTime - startTime) / 1000),
    stats: {
      totalTrades: stats.totalTrades,
      successfulTrades: stats.successfulTrades,
      failedTrades: stats.failedTrades,
      successRate: stats.successRate,
      peakTps,
    },
  });
});

// Get stats
app.get('/stats', (req, res) => {
  res.json(getAggregatedStats());
});

// Stats display interval
function startStatsDisplay(): void {
  setInterval(() => {
    if (!isRunning) return;

    const stats = getAggregatedStats();

    // Color codes
    const GREEN = '\x1b[32m';
    const CYAN = '\x1b[36m';
    const YELLOW = '\x1b[33m';
    const RESET = '\x1b[0m';
    const BOLD = '\x1b[1m';
    const DIM = '\x1b[2m';

    console.log(
      `${DIM}${new Date().toISOString().slice(11, 23)}${RESET} ` +
      `${CYAN}[${stats.workerCount}W/${stats.activeAccounts}A]${RESET} ` +
      `${GREEN}${stats.successfulTrades}${RESET}/${stats.totalTrades} ` +
      `${BOLD}${stats.currentTps} TPS${RESET} ` +
      `${YELLOW}${stats.successRate}%${RESET} ` +
      `${DIM}${stats.elapsedSeconds}s${RESET}`
    );

    // Broadcast to clients
    broadcast({
      type: 'stats',
      data: stats,
    });
  }, 2000);
}

// Main
async function main() {
  const PORT = parseInt(process.env.PORT || '3001');

  // Find working VFN endpoint (if using internal mode)
  if (RPC_MODE === 'internal') {
    selectedVfn = await findWorkingVfn();
  }

  // Initialize workers
  await initializeWorkers();

  // Start HTTP server
  server.listen(PORT, () => {
    console.log(`HTTP/WS server running on port ${PORT}`);
    console.log();
    console.log('Endpoints:');
    console.log(`  GET  /health   - Health check`);
    console.log(`  GET  /status   - Full status`);
    console.log(`  GET  /stats    - Aggregated stats`);
    console.log(`  POST /start    - Start trading`);
    console.log(`  POST /stop     - Stop trading`);
    console.log();
  });

  // Start stats display
  startStatsDisplay();

  console.log('='.repeat(70));
  console.log('   Ready! POST /start to begin trading');
  console.log('='.repeat(70));
}

main().catch((e) => {
  console.error('Fatal error:', e);
  process.exit(1);
});
