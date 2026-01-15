/**
 * Ultra HFT Server - Maximum TPS with Orderless Transactions
 *
 * PHASE 10-14 OPTIMIZATIONS:
 * 1. ORDERLESS TRANSACTIONS - No sequence number bottleneck! True parallelism
 * 2. 20 accounts for massive parallel submission
 * 3. Large batch sizes (100 txns per account)
 * 4. 95% fire-and-forget mode (orderless doesn't need sequence sync)
 * 5. 3-stage pipeline: Build → Sign → Submit in parallel
 * 6. Exponential backoff/recovery for mempool congestion
 * 7. Non-blocking RPC calls
 *
 * Target: 5,000-10,000+ TPS
 *
 * Usage:
 *   ULTRA_PRIVATE_KEYS="key1,key2,...,key20" APTOS_API_KEY=... npx tsx server/hft-ultra-server.ts
 *
 * Or single account mode:
 *   APTOS_PRIVATE_KEY=0x... APTOS_API_KEY=... npx tsx server/hft-ultra-server.ts
 */

import express from 'express';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import cors from 'cors';
import fs from 'fs';
import {
  Aptos,
  AptosConfig,
  Network,
  Account,
  Ed25519PrivateKey,
  InputGenerateTransactionPayloadData,
  generateSignedTransaction,
} from '@aptos-labs/ts-sdk';

// USD1 Contract with admin drainers (deployed Jan 11, 2026)
const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS || '0xbdea15f5b0f5449ae8f3a6ae95a5e090bdeeec91be1fcac8375b2f5f37f1c134';
const MODULE = `${CONTRACT_ADDRESS}::market`;
const MULTI_MODULE = `${CONTRACT_ADDRESS}::multi_outcome_market`;
const USD1_MODULE = `${CONTRACT_ADDRESS}::usd1`;

// USD1 collateral support - eliminates APT global state contention for 10K+ TPS
// Set USE_USD1=true and USD1_METADATA to enable
const USE_USD1 = process.env.USE_USD1 === 'true';
let USD1_METADATA: string | null = process.env.USD1_METADATA || null;

// Available run modes with escalating TPS targets
type RunMode = 'dryrun' | 'light' | 'normal' | 'turbo' | 'ultra' | 'quantum' | 'beast' | 'dec28' | 'dec28_real' | 'verify';

function resolveMode(): RunMode {
  const argMode = process.argv[2];
  if (argMode === 'verify') return 'verify';
  if (argMode === 'dryrun' || process.env.HFT_DRYRUN === 'true') return 'dryrun';
  if (argMode === 'light') return 'light';
  if (argMode === 'normal') return 'normal';
  if (argMode === 'turbo') return 'turbo';
  if (argMode === 'ultra') return 'ultra';
  if (argMode === 'quantum') return 'quantum';
  if (argMode === 'beast') return 'beast';
  if (argMode === 'dec28') return 'dec28';
  if (argMode === 'dec28_real') return 'dec28_real';
  // Default to normal for backwards compatibility with 'prod'
  if (argMode === 'prod') return 'quantum';
  return 'dryrun';
}

const RUN_MODE = resolveMode();
const IS_DRYRUN = RUN_MODE === 'dryrun';

// Mode configurations - TPS scales with accounts × batch_size × (1000 / delay_ms)
// With 25 accounts: quantum = 25 × 150 × (1000/20) = 187,500 theoretical, ~30K+ real
const MODE_CONFIGS: Record<RunMode, {
  BATCH_SIZE: number;
  BATCH_DELAY_MS: number;
  USE_MULTI_RPC: boolean;
  FIRE_AND_FORGET_RATIO: number;
  TRADE_SAMPLE_RATE: number;
  TARGET_TPS: number;
  MAX_PENDING: number;
}> = {
  // ~10 TPS - Quick UI test, minimal APT usage
  dryrun: {
    BATCH_SIZE: 1,
    BATCH_DELAY_MS: 100,
    USE_MULTI_RPC: false,
    FIRE_AND_FORGET_RATIO: 0.5,
    TRADE_SAMPLE_RATE: 0.8,      // High visibility for testing UI
    TARGET_TPS: 10,
    MAX_PENDING: 20,
  },
  // ~100 TPS - Light stress test
  light: {
    BATCH_SIZE: 3,
    BATCH_DELAY_MS: 80,
    USE_MULTI_RPC: false,
    FIRE_AND_FORGET_RATIO: 0.6,
    TRADE_SAMPLE_RATE: 0.5,
    TARGET_TPS: 100,
    MAX_PENDING: 30,
  },
  // ~1,000 TPS - Medium demo, good for testing
  normal: {
    BATCH_SIZE: 10,
    BATCH_DELAY_MS: 50,
    USE_MULTI_RPC: true,
    FIRE_AND_FORGET_RATIO: 0.7,
    TRADE_SAMPLE_RATE: 0.25,    // 25% = ~250 trades/sec shown - visible activity
    TARGET_TPS: 1000,
    MAX_PENDING: 50,
  },
  // ~3,000 TPS - Medium intensity demo
  turbo: {
    BATCH_SIZE: 30,
    BATCH_DELAY_MS: 40,
    USE_MULTI_RPC: true,
    FIRE_AND_FORGET_RATIO: 0.85,
    TRADE_SAMPLE_RATE: 0.15,    // 15% = ~450 trades/sec shown - good visibility
    TARGET_TPS: 3000,
    MAX_PENDING: 100,
  },
  // ~10,000 TPS - High intensity stress test
  ultra: {
    BATCH_SIZE: 80,
    BATCH_DELAY_MS: 30,
    USE_MULTI_RPC: true,
    FIRE_AND_FORGET_RATIO: 0.9,
    TRADE_SAMPLE_RATE: 0.08,    // 8% = ~800 trades/sec shown
    TARGET_TPS: 10000,
    MAX_PENDING: 200,
  },
  // ~30,000+ TPS - MAXIMUM POWER for demo day! 🚀
  quantum: {
    BATCH_SIZE: 150,
    BATCH_DELAY_MS: 20,
    USE_MULTI_RPC: true,
    FIRE_AND_FORGET_RATIO: 0.95,
    TRADE_SAMPLE_RATE: 0.05,    // 5% = ~1500 trades/sec shown - busy but manageable
    TARGET_TPS: 30000,
    MAX_PENDING: 300,
  },
  // 🦾 BEAST MODE - Optimized for M1 Max / High-end local machines
  // Faster than turbo but avoids macOS port exhaustion (EADDRNOTAVAIL)
  beast: {
    BATCH_SIZE: 50,             // Moderate batches - M1 CPU isn't the bottleneck
    BATCH_DELAY_MS: 25,         // Enough delay for TCP port recycling
    USE_MULTI_RPC: true,
    FIRE_AND_FORGET_RATIO: 0.88,// High but sustainable
    TRADE_SAMPLE_RATE: 0.06,
    TARGET_TPS: 5000,           // Realistic target for single machine
    MAX_PENDING: 200,           // Same as ultra
  },
  // EXACT Dec 28 config that achieved 4,441 TPS
  dec28: {
    BATCH_SIZE: 100,
    BATCH_DELAY_MS: 0,          // NO delay - max speed
    USE_MULTI_RPC: true,
    FIRE_AND_FORGET_RATIO: 0.95,
    TRADE_SAMPLE_RATE: 0.03,
    TARGET_TPS: 10000,
    MAX_PENDING: 1000,          // High pending limit
  },
  // ACTUAL Dec 28 config from commit e4083b2 (the real 4K+ TPS achievement)
  // Key differences: smaller batch, lower pending, NO fire-and-forget, single client
  dec28_real: {
    BATCH_SIZE: 30,             // Actual Dec 28 value (not 100!)
    BATCH_DELAY_MS: 0,          // No delay - max speed
    USE_MULTI_RPC: false,       // Single client (Dec 28 didn't have multi-RPC)
    FIRE_AND_FORGET_RATIO: 0.0, // Dec 28 didn't have fire-and-forget! Wait for responses.
    TRADE_SAMPLE_RATE: 0.03,
    TARGET_TPS: 5000,
    MAX_PENDING: 120,           // Actual Dec 28 value (not 1000!)
  },
  // ~1 TPS - Full on-chain verification mode (verify each tx lands on-chain)
  verify: {
    BATCH_SIZE: 1,              // One transaction at a time
    BATCH_DELAY_MS: 1000,       // 1 second between submissions
    USE_MULTI_RPC: false,       // Single RPC for consistency
    FIRE_AND_FORGET_RATIO: 0.0, // 0% fire-and-forget = 100% verified
    TRADE_SAMPLE_RATE: 1.0,     // 100% - show every trade
    TARGET_TPS: 1,
    MAX_PENDING: 1,
  },
};

function getConfig(mode: RunMode) {
  const modeConfig = MODE_CONFIGS[mode];
  return {
    PORT: parseInt(process.env.HFT_PORT || '3001'),
    BATCH_SIZE: modeConfig.BATCH_SIZE,
    BATCH_DELAY_MS: modeConfig.BATCH_DELAY_MS,
    SEQUENCE_PIPELINE: 10,
    MAX_PENDING: modeConfig.MAX_PENDING,
    MEMPOOL_BACKOFF_MS: 50,
    MAX_DELAY_MS: 500,
    TRADE_SAMPLE_RATE: modeConfig.TRADE_SAMPLE_RATE,
    STATS_CACHE_TTL_MS: 200,
    FIRE_AND_FORGET_RATIO: modeConfig.FIRE_AND_FORGET_RATIO,
    // USE_ORDERLESS: Set USE_ORDERLESS=false to use sequence numbers instead of random nonces
    // Aptos devs suggest trying without orderless for potential TPS improvement
    USE_ORDERLESS: process.env.USE_ORDERLESS !== 'false',
    USE_MULTI_RPC: modeConfig.USE_MULTI_RPC,
    USE_BATCH_SUBMIT: process.env.USE_BATCH_SUBMIT !== 'false',  // Set USE_BATCH_SUBMIT=false to disable
    IS_DRYRUN: mode === 'dryrun',
    TARGET_TPS: modeConfig.TARGET_TPS,
    MODE_LABEL: mode,
  };
}

// Configuration derived from run mode
const CONFIG = getConfig(RUN_MODE);

// Adaptive state
let currentDelay = 0;       // Starts at 0, increases on mempool_full
let consecutiveSuccess = 0; // Track successful batches

// Stats caching to reduce computation at high TPS
let cachedStats: object | null = null;
let cachedStatsTime = 0;

// Use API key (required for high TPS)
const API_KEY = process.env.APTOS_API_KEY || '';
if (!API_KEY) {
  console.warn('WARNING: No APTOS_API_KEY set. You will hit rate limits!');
}

// PHASE 17: Multi-RPC load balancing - spread load across multiple endpoints
// Aptos internal stress testing fullnode (recommended by Aptos team for TPS testing)
const APTOS_INTERNAL_FULLNODE = 'http://vfn0.usce1-0.testnet.aptoslabs.com:80';
// Custom fullnode - no rate limits
const CUSTOM_FULLNODE = process.env.FULLNODE_URL || 'https://aptos.cash.trading/v1';

// RPC_MODE: 'internal' (Aptos stress test node), 'custom' (your fullnode), 'balanced' (both)
const RPC_MODE = process.env.RPC_MODE || 'custom'; // Default to custom for backward compatibility
const RPC_ENDPOINTS = (() => {
  const extraEndpoints = process.env.EXTRA_RPC_ENDPOINTS ? process.env.EXTRA_RPC_ENDPOINTS.split(',') : [];
  switch (RPC_MODE) {
    case 'internal':
      return [APTOS_INTERNAL_FULLNODE, ...extraEndpoints];
    case 'balanced':
      return [APTOS_INTERNAL_FULLNODE, CUSTOM_FULLNODE, ...extraEndpoints];
    case 'custom':
    default:
      return [CUSTOM_FULLNODE, ...extraEndpoints];
  }
})();
console.log(`RPC Mode: ${RPC_MODE}, Endpoints: ${RPC_ENDPOINTS.join(', ')}`);

// Create multiple Aptos clients for load balancing
// Always use CUSTOM_FULLNODE as primary - no rate limits!
const aptosClients: Aptos[] = CONFIG.USE_MULTI_RPC
  ? RPC_ENDPOINTS.map(fullnode => new Aptos(new AptosConfig({
      network: Network.TESTNET,
      fullnode,
      clientConfig: API_KEY ? { API_KEY } : undefined,
    })))
  : [new Aptos(new AptosConfig({
      network: Network.TESTNET,
      fullnode: CUSTOM_FULLNODE,  // Use YOUR fullnode even in single-client mode
      clientConfig: API_KEY ? { API_KEY } : undefined,
    }))];

let rpcIndex = 0;
function getNextAptos(): Aptos {
  const client = aptosClients[rpcIndex % aptosClients.length];
  rpcIndex++;
  return client;
}

// Default client for non-trading operations
const aptos = aptosClients[0];

// Primary endpoint for batch submissions (first in RPC_ENDPOINTS array)
const PRIMARY_ENDPOINT = RPC_ENDPOINTS[0];

// TRUE BATCH SUBMIT - Single HTTP call with up to 10k transactions
// Uses POST /v1/transactions/batch endpoint
async function submitBatchTransactions(
  signedTxns: Uint8Array[]
): Promise<{ success: boolean; hash?: string; error?: string }[]> {
  if (signedTxns.length === 0) return [];

  try {
    const response = await fetch(`${PRIMARY_ENDPOINT}/transactions/batch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x.aptos.signed_transaction+bcs',
        ...(API_KEY ? { 'Authorization': `Bearer ${API_KEY}` } : {}),
      },
      body: Buffer.from(encodeBatchBCS(signedTxns)),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[BATCH] HTTP ${response.status}: ${errorText.slice(0, 100)}`);
      return signedTxns.map(() => ({ success: false, error: `HTTP ${response.status}` }));
    }

    const results = await response.json();
    // Response is array of { transaction_failures: [...] } or { hash: "0x..." }
    return results.map((r: any) => {
      if (r.hash) {
        return { success: true, hash: r.hash };
      } else {
        return { success: false, error: r.error_code || r.message || 'Unknown error' };
      }
    });
  } catch (e: any) {
    console.error(`[BATCH] Error: ${e.message}`);
    return signedTxns.map(() => ({ success: false, error: e.message }));
  }
}

// Encode multiple BCS transactions into batch format
function encodeBatchBCS(signedTxns: Uint8Array[]): Uint8Array {
  // Batch format: [length as u32le][txn1][txn2]...
  // Each txn is already BCS encoded, we just concatenate with length prefix
  let totalLength = 4; // 4 bytes for count
  for (const txn of signedTxns) {
    totalLength += 4 + txn.length; // 4 bytes length + txn bytes
  }

  const buffer = new Uint8Array(totalLength);
  const view = new DataView(buffer.buffer);

  // Write count
  view.setUint32(0, signedTxns.length, true);
  let offset = 4;

  // Write each transaction with length prefix
  for (const txn of signedTxns) {
    view.setUint32(offset, txn.length, true);
    offset += 4;
    buffer.set(txn, offset);
    offset += txn.length;
  }

  return buffer;
}

// Account state
interface AccountState {
  account: Account;
  sequenceNumber: bigint;
  pendingTxns: number;
  successCount: number;
  failCount: number;
  isActive: boolean;
}

// Global state
interface GlobalState {
  isRunning: boolean;
  accounts: AccountState[];
  marketAddress: string | null;
  marketAddresses: string[]; // Multi-market round-robin support
  marketIndex: number; // Current index for round-robin
  isMultiOutcome: boolean;
  outcomeCount: number;
  totalTrades: number;
  successfulTrades: number;
  failedTrades: number;
  startTime: number;
  peakTps: number;
  recentTps: number[];
  // New UI fields
  recentLatencies: number[];
  combinedBalance: number;
  yesPrice: number;
  noPrice: number;
  yesReserve: number;
  noReserve: number;
  totalInvested: number;
  marketQuestion: string;
  // Position tracking
  outcomePositions: number[]; // Token balance for each outcome
  // Multi-outcome market data
  outcomePrices: number[]; // Actual prices for each outcome (0-100)
  outcomeLabels: string[]; // Labels for each outcome
  // Verification mode stats
  verifiedOnChain: number;
  verificationFailures: number;
  // Transaction hash tracking for post-run analysis
  submittedTxHashes: Array<{ hash: string; timestamp: number; market: string; outcome: number; isBuy: boolean; sender: string }>;
}

const state: GlobalState = {
  isRunning: false,
  accounts: [],
  marketAddress: null,
  marketAddresses: [],
  marketIndex: 0,
  isMultiOutcome: false,
  outcomeCount: 2,
  totalTrades: 0,
  successfulTrades: 0,
  failedTrades: 0,
  startTime: 0,
  peakTps: 0,
  recentTps: [],
  // New UI fields
  recentLatencies: [],
  combinedBalance: 0,
  yesPrice: 50,
  noPrice: 50,
  yesReserve: 0,
  noReserve: 0,
  totalInvested: 0,
  marketQuestion: 'Loading market...',
  outcomePositions: [],
  outcomePrices: [],
  outcomeLabels: [],
  // Verification mode stats
  verifiedOnChain: 0,
  verificationFailures: 0,
  // Transaction hash tracking
  submittedTxHashes: [],
};

const clients = new Set<WebSocket>();

// ============================================
// WORKER COORDINATION - Aggregate TPS from multiple workers
// ============================================
// Worker 1 = Primary (frontend connects here)
// Workers 2 & 3 = Secondary (report stats to Worker 1)

interface SecondaryWorkerStats {
  workerId: string;
  totalTrades: number;
  successfulTrades: number;
  failedTrades: number;
  currentTps: number;
  accountCount: number;
  lastUpdate: number;
}

// Map of secondary worker stats (keyed by worker ID)
const secondaryWorkerStats = new Map<string, SecondaryWorkerStats>();

// Coordinator URL (for secondary workers to connect to)
const COORDINATOR_URL = process.env.COORDINATOR_URL; // e.g., 'ws://178.128.177.88:3001'
const WORKER_ID = process.env.WORKER_ID || `worker-${Date.now()}`;
const IS_COORDINATOR = !COORDINATOR_URL; // If no coordinator URL, we ARE the coordinator

// Get aggregated stats (this worker + all secondary workers)
function getAggregatedStats() {
  // Start with this worker's stats
  let totalTrades = state.totalTrades;
  let successfulTrades = state.successfulTrades;
  let failedTrades = state.failedTrades;
  let totalCurrentTps = state.recentTps.length > 0 ? state.recentTps[state.recentTps.length - 1] : 0;
  let totalAccounts = state.accounts.length;

  // Add secondary worker stats (only if we're coordinator)
  if (IS_COORDINATOR) {
    const now = Date.now();
    secondaryWorkerStats.forEach((worker, id) => {
      // Only include workers that reported in last 10 seconds
      if (now - worker.lastUpdate < 10000) {
        totalTrades += worker.totalTrades;
        successfulTrades += worker.successfulTrades;
        failedTrades += worker.failedTrades;
        totalCurrentTps += worker.currentTps;
        totalAccounts += worker.accountCount;
      }
    });
  }

  return {
    totalTrades,
    successfulTrades,
    failedTrades,
    currentTps: totalCurrentTps,
    totalAccounts,
    workerCount: IS_COORDINATOR ? 1 + secondaryWorkerStats.size : 1,
  };
}

// Bot names for visualization
const BOT_NAMES = ['Ultra-A', 'Ultra-B', 'Ultra-C', 'Ultra-D', 'Ultra-E', 'Hyper-1', 'Hyper-2', 'Mega-X'];
const ACTIONS = ['buy_yes', 'buy_no', 'buy_outcome'] as const;

let tradeIdCounter = 0;
let ffDebugCounter = 0; // Debug: track fire-and-forget resolutions
let lastTpsCalcTime = Date.now();
let lastTpsCalcTrades = 0;

// Broadcast to clients
function broadcast(data: object) {
  const message = JSON.stringify(data);
  clients.forEach(ws => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(message);
    }
  });
}

// ============================================
// USD1 COLLATERAL SUPPORT
// ============================================

// Initialize USD1 metadata if enabled
async function initializeUSD1() {
  if (!USE_USD1) return;

  if (!USD1_METADATA) {
    try {
      const result = await aptos.view({
        payload: {
          function: `${USD1_MODULE}::get_metadata_address`,
          functionArguments: [],
        },
      });
      USD1_METADATA = result[0] as string;
      console.log(`✓ USD1 detected: ${USD1_METADATA.slice(0, 30)}...`);
    } catch (e) {
      console.warn('⚠ USD1 not initialized on chain. Using APT for balances.');
    }
  } else {
    console.log(`✓ USD1 configured: ${USD1_METADATA.slice(0, 30)}...`);
  }
}

// Get USD1 balance for an address
async function getUSD1Balance(address: string): Promise<number> {
  if (!USD1_METADATA) return 0;

  try {
    const result = await aptos.view({
      payload: {
        function: `${USD1_MODULE}::balance`,
        functionArguments: [address],
      },
    });
    return Number(result[0]);
  } catch {
    return 0;
  }
}

// Get account balance (USD1 if enabled, otherwise APT)
async function getAccountBalance(address: string): Promise<{ balance: number; symbol: string }> {
  if (USE_USD1 && USD1_METADATA) {
    const balance = await getUSD1Balance(address);
    return { balance, symbol: 'USD1' };
  } else {
    const balance = await aptos.getAccountAPTAmount({ accountAddress: address });
    return { balance, symbol: 'APT' };
  }
}

// Mint USD1 to an account (for auto-funding)
async function mintUSD1(signer: Account, recipient: string, amount: number): Promise<boolean> {
  if (!USD1_METADATA) return false;

  try {
    const tx = await aptos.transaction.build.simple({
      sender: signer.accountAddress,
      data: {
        function: `${USD1_MODULE}::mint`,
        functionArguments: [recipient, amount],
      },
    });

    const pendingTx = await aptos.signAndSubmitTransaction({
      signer,
      transaction: tx,
    });

    await aptos.waitForTransaction({ transactionHash: pendingTx.hash });
    return true;
  } catch (e) {
    console.error(`USD1 mint failed: ${(e as Error).message}`);
    return false;
  }
}

// Get random amount - DEMO MODE: Small trades for live demo
function getRandomAmount(): number {
  // DRYRUN MODE: Tiny trades to minimize APT spent
  if (CONFIG.IS_DRYRUN) {
    return Math.random() * 0.004 + 0.001; // 0.001-0.005 APT only
  }

  // DEMO MODE: Small trades to show activity without burning APT
  // Target: ~0.05 APT average per trade
  // At 10 TPS = ~30 APT/minute, ~1800 APT/hour
  // At 10 TPS for 30 min = ~900 APT total

  const rand = Math.random();

  // 1% chance: Whale trade (0.5-1 APT) - occasional spike
  if (rand < 0.01) {
    return Math.random() * 0.5 + 0.5; // 0.5-1 APT
  }

  // 5% chance: Large trade (0.2-0.5 APT)
  if (rand < 0.06) {
    return Math.random() * 0.3 + 0.2; // 0.2-0.5 APT
  }

  // 15% chance: Medium trade (0.05-0.2 APT)
  if (rand < 0.21) {
    return Math.random() * 0.15 + 0.05; // 0.05-0.2 APT
  }

  // 35% chance: Small trade (0.02-0.05 APT)
  if (rand < 0.56) {
    return Math.random() * 0.03 + 0.02; // 0.02-0.05 APT
  }

  // 44% chance: Micro trade (0.01-0.02 APT)
  return Math.random() * 0.01 + 0.01; // 0.01-0.02 APT
}

// Calculate current TPS
function calculateTps(): number {
  const now = Date.now();
  const elapsed = (now - lastTpsCalcTime) / 1000;
  if (elapsed < 0.5) return state.recentTps[state.recentTps.length - 1] || 0;

  const trades = state.totalTrades - lastTpsCalcTrades;
  const tps = trades / elapsed;

  lastTpsCalcTime = now;
  lastTpsCalcTrades = state.totalTrades;

  state.recentTps.push(tps);
  if (state.recentTps.length > 10) state.recentTps.shift();

  if (tps > state.peakTps) state.peakTps = tps;

  return tps;
}

// Save submitted transaction hashes to file for post-run analysis
function saveSubmittedTxHashes(): void {
  if (state.submittedTxHashes.length === 0) {
    console.log('📝 No transactions to save.');
    return;
  }

  const outputFile = '/tmp/hft-submitted-txns.json';
  const data = {
    contractAddress: CONTRACT_ADDRESS,
    startTime: state.startTime,
    endTime: Date.now(),
    totalSubmitted: state.submittedTxHashes.length,
    successfulTrades: state.successfulTrades,
    failedTrades: state.failedTrades,
    peakTps: state.peakTps,
    transactions: state.submittedTxHashes,
  };

  try {
    fs.writeFileSync(outputFile, JSON.stringify(data, null, 2));
    console.log(`📝 Saved ${state.submittedTxHashes.length} transaction hashes to ${outputFile}`);
    console.log(`   Run: npx tsx scripts/analyze-submitted-txns.ts`);
  } catch (e) {
    console.error(`Failed to save transaction hashes: ${(e as Error).message}`);
  }
}

// ANSI color codes for beautiful logging
const COLORS = {
  RESET: '\x1b[0m',
  BOLD: '\x1b[1m',
  DIM: '\x1b[2m',
  RED: '\x1b[31m',
  GREEN: '\x1b[32m',
  YELLOW: '\x1b[33m',
  BLUE: '\x1b[34m',
  MAGENTA: '\x1b[35m',
  CYAN: '\x1b[36m',
  WHITE: '\x1b[37m',
  BG_BLUE: '\x1b[44m',
  BG_GREEN: '\x1b[42m',
};

// Outcome labels for trade logging
const OUTCOME_LABELS = ['Vance', 'Rubio', 'Trump', 'DeSantis', 'Carlson', 'Other'];

// Print beautiful stats banner
function printStatsBanner() {
  const { RESET, BOLD, DIM, GREEN, YELLOW, CYAN, MAGENTA, BG_BLUE } = COLORS;
  const elapsed = Math.round((Date.now() - state.startTime) / 1000);
  const tps = calculateTps();
  const avgTps = state.recentTps.length > 0
    ? Math.round(state.recentTps.reduce((a, b) => a + b, 0) / state.recentTps.length)
    : 0;
  const successRate = state.totalTrades > 0
    ? ((state.successfulTrades / state.totalTrades) * 100).toFixed(1)
    : '100.0';
  const avgLatency = state.recentLatencies.length > 0
    ? Math.round(state.recentLatencies.reduce((a, b) => a + b, 0) / state.recentLatencies.length)
    : 0;

  console.log('');
  console.log(`${BG_BLUE}${BOLD}                    ⚡ HFT STATS ⚡                    ${RESET}`);
  console.log(`${DIM}────────────────────────────────────────────────────────${RESET}`);
  console.log(
    `  ${CYAN}TPS:${RESET} ${BOLD}${Math.round(tps).toLocaleString()}${RESET}  ` +
    `${CYAN}Peak:${RESET} ${GREEN}${Math.round(state.peakTps).toLocaleString()}${RESET}  ` +
    `${CYAN}Avg:${RESET} ${avgTps.toLocaleString()}`
  );
  console.log(
    `  ${CYAN}Trades:${RESET} ${BOLD}${state.totalTrades.toLocaleString()}${RESET}  ` +
    `${CYAN}Success:${RESET} ${GREEN}${successRate}%${RESET}  ` +
    `${CYAN}Latency:${RESET} ${YELLOW}${avgLatency}ms${RESET}`
  );
  console.log(
    `  ${CYAN}Elapsed:${RESET} ${elapsed}s  ` +
    `${CYAN}Accounts:${RESET} ${state.accounts.filter(a => a.isActive).length}/${state.accounts.length}  ` +
    `${CYAN}Clients:${RESET} ${clients.size}`
  );
  if (state.outcomePrices.length > 0) {
    const priceStr = state.outcomePrices.map((p, i) =>
      `${OUTCOME_LABELS[i] || i}: ${MAGENTA}${p.toFixed(0)}%${RESET}`
    ).join('  ');
    console.log(`  ${CYAN}Prices:${RESET} ${priceStr}`);
  }
  // Show verification stats when in verify mode
  if (RUN_MODE === 'verify') {
    const RED = '\x1b[31m';
    console.log(
      `  ${CYAN}Verified:${RESET} ${GREEN}${state.verifiedOnChain}${RESET}  ` +
      `${CYAN}Failed:${RESET} ${state.verificationFailures > 0 ? RED : ''}${state.verificationFailures}${RESET}`
    );
  }
  console.log(`${DIM}────────────────────────────────────────────────────────${RESET}`);
  console.log('');
}

// Get stats - includes all fields UI expects (with caching for performance)
// Uses aggregated stats from all workers when in coordinator mode
function getStats() {
  const now = Date.now();

  // Return cached stats if still valid (shorter TTL when coordinating)
  const cacheTtl = IS_COORDINATOR && secondaryWorkerStats.size > 0 ? 100 : CONFIG.STATS_CACHE_TTL_MS;
  if (cachedStats && now - cachedStatsTime < cacheTtl) {
    return cachedStats;
  }

  const tps = calculateTps();

  // Get aggregated stats from all workers (if coordinator)
  const aggregated = getAggregatedStats();

  const avgTps = state.recentTps.length > 0
    ? state.recentTps.reduce((a, b) => a + b, 0) / state.recentTps.length
    : 0;
  const avgLatency = state.recentLatencies.length > 0
    ? Math.round(state.recentLatencies.reduce((a, b) => a + b, 0) / state.recentLatencies.length)
    : 150;

  // Use aggregated values for trades/TPS, local values for latency/delay
  const stats = {
    totalTrades: aggregated.totalTrades,
    successfulTrades: aggregated.successfulTrades,
    failedTrades: aggregated.failedTrades,
    successRate: aggregated.totalTrades > 0
      ? Math.round((aggregated.successfulTrades / aggregated.totalTrades) * 100)
      : 100,
    currentTps: Math.round(aggregated.currentTps),
    avgTps: Math.round(avgTps), // Local avg (aggregated TPS varies too much)
    peakTps: Math.round(Math.max(state.peakTps, aggregated.currentTps)),
    avgLatency,
    currentDelay: currentDelay,
    activeAccounts: state.accounts.filter(a => a.isActive).length,
    totalAccounts: aggregated.totalAccounts,
    // New: worker coordination info
    workerCount: aggregated.workerCount,
    isCoordinator: IS_COORDINATOR,
    // Verification mode stats
    verifiedOnChain: state.verifiedOnChain,
    verificationFailures: state.verificationFailures,
  };

  // Update peak TPS if current aggregated is higher
  if (aggregated.currentTps > state.peakTps) {
    state.peakTps = aggregated.currentTps;
  }

  // Cache the result
  cachedStats = stats;
  cachedStatsTime = now;

  return stats;
}

// Get full UI data payload
function getFullUIData() {
  // For multi-outcome, sum all positions; for binary, use first two
  let yesTokens = 0;
  let noTokens = 0;

  if (state.isMultiOutcome && state.outcomePositions.length > 0) {
    // For multi-outcome: show total of all outcome tokens
    // Use first outcome as "YES" equivalent, sum of others as "NO"
    yesTokens = state.outcomePositions[0] || 0;
    noTokens = state.outcomePositions.slice(1).reduce((a, b) => a + b, 0);
  }

  return {
    stats: getStats(),
    market: {
      address: state.marketAddress || '',
      question: state.marketQuestion,
      yesPrice: state.yesPrice,
      noPrice: state.noPrice,
      // Multi-outcome data
      isMultiOutcome: state.isMultiOutcome,
      outcomeCount: state.outcomeCount,
      outcomePrices: state.outcomePrices,
      outcomeLabels: state.outcomeLabels,
    },
    position: {
      yesTokens,  // Actual token balance
      noTokens,   // Actual token balance
      totalInvested: state.totalInvested,
      realizedPnl: 0,
      // Also send individual outcome positions
      outcomePositions: state.outcomePositions,
    },
    botBalance: state.combinedBalance,
    marketReserves: {
      yesReserve: state.yesReserve,
      noReserve: state.noReserve,
      tvl: state.yesReserve + state.noReserve,
    },
  };
}

// Fetch combined balance and market data periodically
async function refreshUIData(): Promise<void> {
  try {
    // Get combined balance of all accounts (USD1 if enabled, otherwise APT)
    let totalBalance = 0;
    for (const accState of state.accounts) {
      try {
        const { balance } = await getAccountBalance(accState.account.accountAddress.toString());
        totalBalance += balance / 100_000_000;
      } catch (e) {
        // Skip failed balance checks
      }
    }
    state.combinedBalance = totalBalance;

    // Fetch market reserves if we have a market
    if (state.marketAddress) {
      try {
        if (state.isMultiOutcome) {
          const info = await aptos.view({
            payload: {
              function: `${MULTI_MODULE}::get_multi_market_info`,
              functionArguments: [state.marketAddress],
            },
          });
          state.marketQuestion = String(info[0]);
          // info[7] = total_collateral (the TVL / pool reserve)
          const totalCollateral = Number(info[7]) / 100_000_000;
          console.log(`[UI Refresh] Total collateral (TVL): ${totalCollateral.toFixed(2)} APT`);

          state.yesReserve = totalCollateral * 0.5; // Split 50/50 for visualization
          state.noReserve = totalCollateral * 0.5;

          // Fetch REAL prices from contract
          try {
            const pricesResult = await aptos.view({
              payload: {
                function: `${MULTI_MODULE}::get_all_prices`,
                functionArguments: [state.marketAddress],
              },
            });
            const rawPrices = (pricesResult[0] as string[]).map(p => Number(p));
            // Normalize to sum to 100%
            const priceSum = rawPrices.reduce((a, b) => a + b, 0);
            state.outcomePrices = rawPrices.map(p => priceSum > 0 ? (p / priceSum) * 100 : 100 / rawPrices.length);
            console.log(`[UI Refresh] Real prices: ${state.outcomePrices.map(p => p.toFixed(1)).join('%, ')}%`);

            // Also fetch labels if we don't have them
            if (state.outcomeLabels.length === 0) {
              const labelsResult = await aptos.view({
                payload: {
                  function: `${MULTI_MODULE}::get_outcome_labels`,
                  functionArguments: [state.marketAddress],
                },
              });
              state.outcomeLabels = labelsResult[0] as string[];
            }
          } catch (e) {
            console.error('Error fetching prices:', e);
          }

          // Use first outcome price as yesPrice for backwards compatibility
          if (state.outcomePrices.length > 0) {
            state.yesPrice = Math.round(state.outcomePrices[0]);
            state.noPrice = 100 - state.yesPrice;
          }

          // Aggregate positions across ALL trading accounts
          if (state.accounts.length > 0 && state.outcomeCount > 0) {
            try {
              const aggregatedPositions = new Array(state.outcomeCount).fill(0);

              for (const accState of state.accounts.slice(0, 3)) { // Check first 3 accounts
                try {
                  const posResult = await aptos.view({
                    payload: {
                      function: `${MULTI_MODULE}::get_user_multi_positions`,
                      functionArguments: [state.marketAddress, accState.account.accountAddress.toString()],
                    },
                  });
                  const positions = posResult[0] as string[];
                  positions.forEach((p, i) => {
                    aggregatedPositions[i] += Number(p) / 100_000_000;
                  });
                } catch (e) {
                  // Skip account on error
                }
              }

              state.outcomePositions = aggregatedPositions;
              const totalTokens = aggregatedPositions.reduce((a, b) => a + b, 0);
              console.log(`[UI Refresh] Total Positions: ${totalTokens.toFixed(2)} tokens (${aggregatedPositions.map(p => p.toFixed(2)).join(', ')})`);
            } catch (e) {
              // Keep existing positions on error
            }
          }
        } else {
          const info = await aptos.view({
            payload: {
              function: `${MODULE}::get_market_info`,
              functionArguments: [state.marketAddress],
            },
          });
          state.marketQuestion = String(info[0]);
          state.yesReserve = Number(info[2]) / 100_000_000;
          state.noReserve = Number(info[3]) / 100_000_000;
          // Calculate prices from reserves
          const total = state.yesReserve + state.noReserve;
          if (total > 0) {
            state.yesPrice = Math.round((state.noReserve / total) * 100);
            state.noPrice = 100 - state.yesPrice;
          }
        }
      } catch (e) {
        // Keep existing values on error
      }
    }
  } catch (e) {
    console.error('Error refreshing UI data:', e);
  }
}

// Refresh sequence number for an account
async function refreshSequenceNumber(accState: AccountState): Promise<void> {
  try {
    const accountInfo = await aptos.getAccountInfo({
      accountAddress: accState.account.accountAddress,
    });
    accState.sequenceNumber = BigInt(accountInfo.sequence_number);
  } catch (e: any) {
    console.error(`Failed to refresh seq for ${accState.account.accountAddress.toString().slice(0, 10)}: ${e.message?.slice(0, 30)}`);
  }
}

// ==================== MOMENTUM TRADING SYSTEM ====================
// Creates dramatic price swings by concentrating trades on trending outcomes

// Momentum state - tracks which outcome is "hot"
let momentumState = {
  hotOutcome: 0,           // Current focus outcome index
  hotDirection: 'buy' as 'buy' | 'sell',  // Buy or sell the hot outcome
  waveStartTime: Date.now(),
  waveDurationMs: 15000,   // Each wave lasts 15 seconds
  waveCount: 0,
  intensityMultiplier: 1.0, // Increases trade concentration
};

// Outcome names for logging
const OUTCOME_NAMES = ['J.D. Vance', 'Marco Rubio', 'Donald Trump', 'Ron DeSantis', 'Tucker Carlson', 'Other'];

// Update momentum - called periodically to create waves
function updateMomentum(): void {
  const now = Date.now();
  const elapsed = now - momentumState.waveStartTime;

  // Time for a new wave?
  if (elapsed > momentumState.waveDurationMs) {
    momentumState.waveStartTime = now;
    momentumState.waveCount++;

    // Every wave, pick new focus with some patterns
    const waveType = momentumState.waveCount % 6;

    switch (waveType) {
      case 0: // J.D. Vance surge
        momentumState.hotOutcome = 0;
        momentumState.hotDirection = 'buy';
        momentumState.intensityMultiplier = 1.5;
        break;
      case 1: // Vance correction, Rubio rises
        momentumState.hotOutcome = 1;
        momentumState.hotDirection = 'buy';
        momentumState.intensityMultiplier = 1.3;
        break;
      case 2: // Trump surprise rally
        momentumState.hotOutcome = 2;
        momentumState.hotDirection = 'buy';
        momentumState.intensityMultiplier = 1.8; // Big spike!
        break;
      case 3: // Profit taking - sell leaders
        momentumState.hotOutcome = 0; // Sell Vance
        momentumState.hotDirection = 'sell';
        momentumState.intensityMultiplier = 1.2;
        break;
      case 4: // DeSantis momentum
        momentumState.hotOutcome = 3;
        momentumState.hotDirection = 'buy';
        momentumState.intensityMultiplier = 1.4;
        break;
      case 5: // Random chaos - fast switching
        momentumState.hotOutcome = Math.floor(Math.random() * 6);
        momentumState.hotDirection = Math.random() < 0.6 ? 'buy' : 'sell';
        momentumState.intensityMultiplier = 2.0; // Maximum volatility
        momentumState.waveDurationMs = 8000; // Shorter wave
        break;
    }

    // Reset wave duration for next cycle (except during chaos)
    if (waveType !== 5) {
      momentumState.waveDurationMs = 12000 + Math.random() * 8000; // 12-20 seconds
    }

    console.log(`🌊 WAVE ${momentumState.waveCount}: ${momentumState.hotDirection.toUpperCase()} ${OUTCOME_NAMES[momentumState.hotOutcome]} (${momentumState.intensityMultiplier.toFixed(1)}x intensity)`);
  }
}

// Build transaction payload - MOMENTUM-BASED trading for price swings
function buildPayload(marketAddress: string): { payload: InputGenerateTransactionPayloadData; isBuy: boolean; outcomeIndex: number } {
  if (state.isMultiOutcome) {
    // Update momentum state
    updateMomentum();

    const baseAmount = getRandomAmount();
    // Apply intensity multiplier for hot trades
    const amount = BigInt(Math.floor(baseAmount * momentumState.intensityMultiplier * 100_000_000));
    const rand = Math.random();

    // 10% chance: Mint complete set (needed to have tokens to sell)
    if (rand < 0.10) {
      return {
        payload: {
          function: `${MULTI_MODULE}::mint_complete_set`,
          functionArguments: [marketAddress, amount],
        },
        isBuy: true,
        outcomeIndex: momentumState.hotOutcome, // Use hot outcome for display
      };
    }

    // 70% chance: Trade the HOT outcome (creates concentrated price movement)
    if (rand < 0.80) {
      if (momentumState.hotDirection === 'buy') {
        return {
          payload: {
            function: `${MULTI_MODULE}::buy_outcome`,
            functionArguments: [marketAddress, momentumState.hotOutcome, amount, 0n],
          },
          isBuy: true,
          outcomeIndex: momentumState.hotOutcome,
        };
      } else {
        return {
          payload: {
            function: `${MULTI_MODULE}::sell_outcome`,
            functionArguments: [marketAddress, momentumState.hotOutcome, amount, 0n],
          },
          isBuy: false,
          outcomeIndex: momentumState.hotOutcome,
        };
      }
    }

    // 20% chance: Counter-trade other outcomes (creates relative movement)
    const otherOutcome = (momentumState.hotOutcome + 1 + Math.floor(Math.random() * 5)) % 6;
    const counterDirection = momentumState.hotDirection === 'buy' ? 'sell' : 'buy';

    if (counterDirection === 'buy') {
      return {
        payload: {
          function: `${MULTI_MODULE}::buy_outcome`,
          functionArguments: [marketAddress, otherOutcome, amount, 0n],
        },
        isBuy: true,
        outcomeIndex: otherOutcome,
      };
    } else {
      return {
        payload: {
          function: `${MULTI_MODULE}::sell_outcome`,
          functionArguments: [marketAddress, otherOutcome, amount, 0n],
        },
        isBuy: false,
        outcomeIndex: otherOutcome,
      };
    }
  } else {
    // Binary market: buy_yes, buy_no, sell_yes, sell_no
    const amount = BigInt(Math.floor(getRandomAmount() * 100_000_000));
    const isBuy = Math.random() < 0.7; // 70% buys, 30% sells
    const isYes = Math.random() < 0.5; // 50% yes, 50% no
    const outcomeIdx = isYes ? 0 : 1; // 0 = yes, 1 = no

    if (isBuy) {
      const action = isYes ? 'buy_yes' : 'buy_no';
      return {
        payload: {
          function: `${MODULE}::${action}`,
          functionArguments: [marketAddress, amount, 0n],
        },
        isBuy: true,
        outcomeIndex: outcomeIdx,
      };
    } else {
      const action = isYes ? 'sell_yes' : 'sell_no';
      return {
        payload: {
          function: `${MODULE}::${action}`,
          functionArguments: [marketAddress, amount, 0n],
        },
        isBuy: false,
        outcomeIndex: outcomeIdx,
      };
    }
  }
}

// Execute batch for single account (fire-and-forget style)
async function executeBatchForAccount(accState: AccountState): Promise<void> {
  if (!state.marketAddress || !accState.isActive) return;

  const batchSize = Math.min(CONFIG.BATCH_SIZE, CONFIG.MAX_PENDING - accState.pendingTxns);
  if (batchSize <= 0) return;

  const startTime = Date.now();
  const baseSeq = accState.sequenceNumber;

  // Build all payloads with buy/sell info, outcome index, and market address
  // MULTI-MARKET: Use round-robin market selection to reduce aggregator contention
  const payloadsWithInfo: { payload: InputGenerateTransactionPayloadData; isBuy: boolean; outcomeIndex: number; market: string }[] = [];
  for (let i = 0; i < batchSize; i++) {
    const targetMarket = state.marketAddresses.length > 0 ? getNextMarket() : state.marketAddress!;
    const info = buildPayload(targetMarket);
    payloadsWithInfo.push({ ...info, market: targetMarket });
  }

  // 3-STAGE PIPELINE: Build → Sign → Submit (reduces latency variance)

  // Stage 1: Build all transactions in parallel
  // PHASE 10: Use orderless transactions with random nonces (no sequence number bottleneck!)
  // PHASE 17: Round-robin across RPC endpoints for load distribution
  const buildPromises = payloadsWithInfo.map(({ payload }, i) => {
    const client = getNextAptos(); // Round-robin RPC selection
    const options: any = CONFIG.USE_ORDERLESS
      ? {
          // Orderless: random nonce instead of sequence number
          replayProtectionNonce: BigInt(Math.floor(Math.random() * Number.MAX_SAFE_INTEGER)),
          expireTimestamp: Math.floor(Date.now() / 1000) + 55, // Max 60s for orderless
        }
      : {
          // Legacy: sequence number ordering
          accountSequenceNumber: baseSeq + BigInt(i),
          expireTimestamp: Math.floor(Date.now() / 1000) + 30,
        };

    return client.transaction.build.simple({
      sender: accState.account.accountAddress,
      data: payload,
      options,
    }).catch(() => null); // Return null on build failure
  });
  const builtTxs = await Promise.all(buildPromises);

  // Stage 2: Sign all successfully built transactions (sync, very fast - no RPC needed)
  const signedTxs = builtTxs.map((tx, i) => {
    if (!tx) return null;
    try {
      return aptos.transaction.sign({ signer: accState.account, transaction: tx });
    } catch {
      return null;
    }
  });

  // Stage 3: Submit transactions
  // PHASE 18: Use batch endpoint for single-request submission (150 txns in 1 HTTP call)
  let results: { success: boolean; hash?: string; error?: string; isBuy: boolean; outcomeIndex: number; market: string }[];

  if (CONFIG.USE_BATCH_SUBMIT) {
    // TRUE BATCH SUBMIT: Single HTTP call to /v1/transactions/batch with up to 10k txns
    try {
      // Convert signed transactions to BCS bytes
      const signedTxnBytes: Uint8Array[] = [];
      const validIndices: number[] = [];

      for (let i = 0; i < builtTxs.length; i++) {
        const tx = builtTxs[i];
        const signed = signedTxs[i];
        if (tx && signed) {
          try {
            const bcsBytes = generateSignedTransaction({
              transaction: tx,
              senderAuthenticator: signed,
            });
            signedTxnBytes.push(bcsBytes);
            validIndices.push(i);
          } catch {
            // Skip failed serialization
          }
        }
      }

      if (signedTxnBytes.length > 0) {
        // Single HTTP call with all transactions!
        const batchResults = await submitBatchTransactions(signedTxnBytes);

        // Map results back to original indices
        const resultMap = new Map<number, { success: boolean; hash?: string; error?: string }>();
        validIndices.forEach((origIndex, batchIndex) => {
          resultMap.set(origIndex, batchResults[batchIndex] || { success: false, error: 'No result' });
        });

        results = builtTxs.map((tx, i) => {
          if (!tx || !signedTxs[i]) {
            return { success: false, error: 'Build/sign failed', isBuy: payloadsWithInfo[i].isBuy, outcomeIndex: payloadsWithInfo[i].outcomeIndex, market: payloadsWithInfo[i].market };
          }
          const r = resultMap.get(i);
          if (r?.success) {
            return { success: true, hash: r.hash, isBuy: payloadsWithInfo[i].isBuy, outcomeIndex: payloadsWithInfo[i].outcomeIndex, market: payloadsWithInfo[i].market };
          } else {
            return { success: false, error: r?.error || 'Unknown', isBuy: payloadsWithInfo[i].isBuy, outcomeIndex: payloadsWithInfo[i].outcomeIndex, market: payloadsWithInfo[i].market };
          }
        });
      } else {
        results = builtTxs.map((_, i) => ({
          success: false,
          error: 'Build/sign failed',
          isBuy: payloadsWithInfo[i].isBuy,
          outcomeIndex: payloadsWithInfo[i].outcomeIndex,
          market: payloadsWithInfo[i].market,
        }));
      }
    } catch (e: any) {
      console.error(`[BATCH ERROR] ${e.message?.slice(0, 60)}`);
      results = builtTxs.map((_, i) => ({
        success: false,
        error: e.message || 'Batch submit failed',
        isBuy: payloadsWithInfo[i].isBuy,
        outcomeIndex: payloadsWithInfo[i].outcomeIndex,
        market: payloadsWithInfo[i].market,
      }));
    }
  } else {
    // Legacy: Submit each transaction individually in parallel
    const submitPromises = builtTxs.map((tx, i) => {
      if (!tx || !signedTxs[i]) {
        return Promise.resolve({ success: false, error: 'Build/sign failed', isBuy: payloadsWithInfo[i].isBuy, outcomeIndex: payloadsWithInfo[i].outcomeIndex, market: payloadsWithInfo[i].market });
      }
      const client = getNextAptos(); // Round-robin RPC selection
      return client.transaction.submit.simple({
        transaction: tx,
        senderAuthenticator: signedTxs[i]!,
      })
      .then(pending => ({ success: true, hash: pending.hash, isBuy: payloadsWithInfo[i].isBuy, outcomeIndex: payloadsWithInfo[i].outcomeIndex, market: payloadsWithInfo[i].market }))
      .catch((e: any) => {
        const errMsg = e.message || 'Unknown error';
        if (i === 0 && !errMsg.includes('INSUFFICIENT_BALANCE')) {
          console.error(`  [ERROR] ${errMsg.slice(0, 60)}`);
        }
        return { success: false, error: errMsg, isBuy: payloadsWithInfo[i].isBuy, outcomeIndex: payloadsWithInfo[i].outcomeIndex, market: payloadsWithInfo[i].market };
      });
    });

    results = await Promise.all(submitPromises);
  }
  const batchTime = Date.now() - startTime;

  // Process results
  let successCount = 0;
  let failCount = 0;
  let sequenceError = false;

  for (const result of results) {
    state.totalTrades++;

    if (result.success) {
      successCount++;
      state.successfulTrades++;
      accState.successCount++;

      // Track transaction hash for post-run analysis
      if (result.hash) {
        state.submittedTxHashes.push({
          hash: result.hash,
          timestamp: Date.now(),
          market: result.market,
          outcome: result.outcomeIndex,
          isBuy: result.isBuy,
          sender: accState.account.accountAddress.toString(),
        });
      }

      // Track latency - use actual batch time (not divided by batch size)
      // This is submission latency, not finality latency (which is ~470ms on Aptos)
      const submissionLatency = batchTime;
      // Estimate finality latency: submission + ~400ms block time
      const estimatedFinality = submissionLatency + 400;
      state.recentLatencies.push(estimatedFinality);
      if (state.recentLatencies.length > 100) state.recentLatencies.shift();

      // Broadcast trade (sampled to reduce overhead)
      if (Math.random() < CONFIG.TRADE_SAMPLE_RATE) { // Sample trades to prevent UI freeze at high TPS
        tradeIdCounter++;
        const tradeAmount = getRandomAmount();
        if (result.isBuy) {
          state.totalInvested += tradeAmount;
        } else {
          state.totalInvested -= tradeAmount * 0.95; // Account for slippage on sells
        }

        // Determine action display based on buy/sell
        let action: string;
        let actionDisplay: string;
        if (state.isMultiOutcome) {
          action = result.isBuy ? 'buy_outcome' : 'sell_outcome';
          actionDisplay = result.isBuy ? 'BUY OUTCOME' : 'SELL OUTCOME';
        } else {
          action = result.isBuy ? 'buy_yes' : 'sell_yes';
          actionDisplay = result.isBuy ? 'BUY YES' : 'SELL YES';
        }

        const uiData = getFullUIData();
        broadcast({
          type: 'trade',
          data: {
            id: `ultra-${tradeIdCounter}`,
            bot: BOT_NAMES[Math.floor(Math.random() * BOT_NAMES.length)],
            action,
            actionDisplay,
            amount: tradeAmount,
            latency: estimatedFinality, // Use realistic finality estimate
            success: true,
            txHash: result.hash,
            explorerUrl: `https://explorer.aptoslabs.com/txn/${result.hash}?network=testnet`,
            timestamp: Date.now(),
            outcome: result.outcomeIndex, // Include outcome index for UI display
          },
          ...uiData,
        });
      }
    } else {
      failCount++;
      state.failedTrades++;
      accState.failCount++;

      if (result.error?.toLowerCase().includes('sequence')) {
        sequenceError = true;
      }
    }
  }

  // Update sequence number based on successes (skip for orderless - not needed)
  if (!CONFIG.USE_ORDERLESS) {
    accState.sequenceNumber += BigInt(successCount);
  }

  // Categorize errors properly to avoid wasteful sequence refreshes
  let mempoolFull = false;
  let hasSequenceError = false;
  let hasVmError = false;

  for (const result of results) {
    if (!result.success && result.error) {
      const err = result.error.toLowerCase();
      if (err.includes('mempool_is_full')) {
        mempoolFull = true;
      } else if (err.includes('sequence') || err.includes('invalid_transaction_update')) {
        hasSequenceError = true;
      } else if (err.includes('vm_error') || err.includes('insufficient')) {
        hasVmError = true;
      }
    }
  }

  // Adaptive delay: EXPONENTIAL backoff, EXPONENTIAL recovery
  if (mempoolFull) {
    // Exponential backoff: multiply by 1.5 instead of adding fixed amount
    currentDelay = Math.min(
      currentDelay === 0 ? CONFIG.MEMPOOL_BACKOFF_MS : Math.floor(currentDelay * 1.5),
      CONFIG.MAX_DELAY_MS
    );
    consecutiveSuccess = 0;
  } else if (successCount > 0) {
    consecutiveSuccess++;
    if (consecutiveSuccess > 1) {  // Recover after just 2 successes (was 3)
      // Exponential recovery: halve the delay (much faster than -30)
      currentDelay = Math.floor(currentDelay * 0.5);
    }
  }

  // Non-blocking error handling - don't block trading loop on RPC calls
  // PHASE 10: Skip sequence refresh for orderless transactions (not needed)
  if (hasSequenceError && !CONFIG.USE_ORDERLESS) {
    // Fire and forget - queue refresh without blocking
    refreshSequenceNumber(accState).catch(() => {});
  } else if (hasVmError && failCount > batchSize / 2) {
    // Only check balance occasionally (10% chance) to reduce RPC overhead
    if (Math.random() < 0.1) {
      checkAndPauseIfLowBalance(accState).catch(() => {});
    }
  }

  // Beautiful detailed logging
  const tps = (batchSize / (batchTime / 1000)).toFixed(0);
  const accAddr = accState.account.accountAddress.toString().slice(0, 8);
  const successRate = ((successCount / batchSize) * 100).toFixed(0);
  const avgLatency = Math.round(batchTime / batchSize);

  // Color codes
  const GREEN = '\x1b[32m';
  const YELLOW = '\x1b[33m';
  const CYAN = '\x1b[36m';
  const DIM = '\x1b[2m';
  const RESET = '\x1b[0m';
  const BOLD = '\x1b[1m';

  // Compact but detailed log line
  console.log(
    `${DIM}${new Date().toISOString().slice(11, 23)}${RESET} ` +
    `${CYAN}${accAddr}${RESET} ` +
    `${GREEN}✓${successCount}${RESET}/${batchSize} ` +
    `${BOLD}${tps} TPS${RESET} ` +
    `${YELLOW}${avgLatency}ms${RESET} ` +
    `${successRate}%` +
    (currentDelay > 0 ? ` ${DIM}delay:${currentDelay}${RESET}` : '')
  );
}

// Check balance and pause if too low
async function checkAndPauseIfLowBalance(accState: AccountState): Promise<boolean> {
  try {
    const { balance, symbol } = await getAccountBalance(accState.account.accountAddress.toString());
    const balanceDecimal = balance / 100_000_000;
    if (balanceDecimal < 0.5) {
      console.warn(`[${accState.account.accountAddress.toString().slice(0, 8)}] LOW BALANCE: ${balanceDecimal.toFixed(2)} ${symbol} - pausing`);
      accState.isActive = false;
      return true;
    }
  } catch (e) {
    // Ignore balance check errors
  }
  return false;
}

// Fire-and-forget batch - don't wait for all results
async function fireAndForgetBatch(accState: AccountState): Promise<void> {
  if (!state.marketAddress || !accState.isActive) return;

  const batchSize = CONFIG.BATCH_SIZE;
  const startTime = Date.now();
  const baseSeq = accState.sequenceNumber;

  // Pre-increment sequence number (only matters for non-orderless mode)
  if (!CONFIG.USE_ORDERLESS) {
    accState.sequenceNumber += BigInt(batchSize);
  }

  // Build and submit without waiting
  // MULTI-MARKET: Use round-robin market selection
  for (let i = 0; i < batchSize; i++) {
    const targetMarket = state.marketAddresses.length > 0 ? getNextMarket() : state.marketAddress;
    const { payload, isBuy, outcomeIndex } = buildPayload(targetMarket);

    // PHASE 10: Orderless uses random nonces, legacy uses sequence numbers
    const options: any = CONFIG.USE_ORDERLESS
      ? {
          replayProtectionNonce: BigInt(Math.floor(Math.random() * Number.MAX_SAFE_INTEGER)),
          expireTimestamp: Math.floor(Date.now() / 1000) + 55,
        }
      : {
          accountSequenceNumber: baseSeq + BigInt(i),
          expireTimestamp: Math.floor(Date.now() / 1000) + 30,
        };

    // Fire off without waiting
    aptos.transaction.build.simple({
      sender: accState.account.accountAddress,
      data: payload,
      options,
    }).then(tx => {
      const signedTx = aptos.transaction.sign({ signer: accState.account, transaction: tx });
      return aptos.transaction.submit.simple({ transaction: tx, senderAuthenticator: signedTx });
    }).then(pending => {
      state.totalTrades++;
      state.successfulTrades++;
      accState.successCount++;
      ffDebugCounter++;

      // Debug: log sample hashes
      if (ffDebugCounter <= 3 || ffDebugCounter % 100 === 0) {
        console.log(`🔥 FF-SUCCESS #${ffDebugCounter}: ${pending.hash}`);
      }

      // Broadcast sample
      if (Math.random() < 0.05) {
        tradeIdCounter++;
        const tradeAmount = getRandomAmount();
        broadcast({
          type: 'trade',
          data: {
            id: `ultra-${tradeIdCounter}`,
            bot: BOT_NAMES[Math.floor(Math.random() * BOT_NAMES.length)],
            action: isBuy ? 'buy_outcome' : 'sell_outcome',
            actionDisplay: isBuy ? 'BUY OUTCOME' : 'SELL OUTCOME',
            amount: tradeAmount,
            latency: Date.now() - startTime + 400,
            success: true,
            txHash: pending.hash,
            explorerUrl: `https://explorer.aptoslabs.com/txn/${pending.hash}?network=testnet`,
            timestamp: Date.now(),
            outcome: outcomeIndex, // Include outcome index for UI display
          },
          ...getFullUIData(),
        });
      }
    }).catch((err) => {
      state.totalTrades++;
      state.failedTrades++;
      accState.failCount++;
      // Debug: log failures
      if (state.failedTrades <= 3 || state.failedTrades % 100 === 0) {
        console.log(`❌ FF-FAIL #${state.failedTrades}: ${err?.message || err}`);
      }
    });
  }

  const elapsed = Date.now() - startTime;
  const accAddr = accState.account.accountAddress.toString().slice(0, 8);
  const estTps = Math.round(batchSize / (elapsed / 1000));

  // Color codes
  const MAGENTA = '\x1b[35m';
  const CYAN = '\x1b[36m';
  const DIM = '\x1b[2m';
  const RESET = '\x1b[0m';
  const BOLD = '\x1b[1m';

  console.log(
    `${DIM}${new Date().toISOString().slice(11, 23)}${RESET} ` +
    `${CYAN}${accAddr}${RESET} ` +
    `${MAGENTA}🚀${batchSize}${RESET} ` +
    `${BOLD}~${estTps} TPS${RESET} ` +
    `${DIM}${elapsed}ms${RESET}`
  );
}

/**
 * Execute a single transaction with full on-chain verification.
 * Used in "verify" mode for guaranteed confirmation before proceeding.
 */
async function executeVerifiedTransaction(accState: AccountState): Promise<void> {
  if (!state.marketAddress || !accState.isActive) return;

  const startTime = Date.now();
  // MULTI-MARKET: Use round-robin market selection
  const targetMarket = state.marketAddresses.length > 0 ? getNextMarket() : state.marketAddress;
  const { payload, isBuy, outcomeIndex } = buildPayload(targetMarket);
  const tradeAmount = getRandomAmount();

  try {
    // Build transaction with orderless (random nonce)
    const tx = await aptos.transaction.build.simple({
      sender: accState.account.accountAddress,
      data: payload,
      options: {
        replayProtectionNonce: BigInt(Math.floor(Math.random() * Number.MAX_SAFE_INTEGER)),
        expireTimestamp: Math.floor(Date.now() / 1000) + 55,
      },
    });

    // Sign transaction
    const signedTx = aptos.transaction.sign({
      signer: accState.account,
      transaction: tx,
    });

    // Submit transaction
    const submitTime = Date.now();
    const pending = await aptos.transaction.submit.simple({
      transaction: tx,
      senderAuthenticator: signedTx,
    });

    console.log(`🔍 [VERIFY] Submitted: ${pending.hash}`);

    // Wait for on-chain confirmation
    const confirmed = await aptos.waitForTransaction({
      transactionHash: pending.hash,
      options: { checkSuccess: true },
    });

    const verificationLatency = Date.now() - submitTime;
    const totalLatency = Date.now() - startTime;

    // Update stats
    state.totalTrades++;
    state.verifiedOnChain++;

    if (confirmed.success) {
      state.successfulTrades++;
      accState.successCount++;

      // Color codes for logging
      const GREEN = '\x1b[32m';
      const CYAN = '\x1b[36m';
      const DIM = '\x1b[2m';
      const RESET = '\x1b[0m';
      const BOLD = '\x1b[1m';

      console.log(
        `${GREEN}✅ [VERIFY] CONFIRMED:${RESET} ${CYAN}${pending.hash.slice(0, 18)}...${RESET} ` +
        `${DIM}|${RESET} ${BOLD}${verificationLatency}ms${RESET} verify ` +
        `${DIM}|${RESET} ${totalLatency}ms total ` +
        `${DIM}| gas: ${(confirmed as any).gas_used}${RESET}`
      );

      // Broadcast to UI with full verification info
      tradeIdCounter++;
      const actionDisplay = isBuy ? 'BUY (VERIFIED)' : 'SELL (VERIFIED)';

      broadcast({
        type: 'trade',
        data: {
          id: `verify-${tradeIdCounter}`,
          bot: 'Verify-Bot',
          action: isBuy ? 'buy_outcome' : 'sell_outcome',
          actionDisplay,
          amount: tradeAmount,
          latency: verificationLatency,
          success: true,
          verified: true,
          txHash: pending.hash,
          explorerUrl: `https://explorer.aptoslabs.com/txn/${pending.hash}?network=testnet`,
          timestamp: Date.now(),
          gasUsed: (confirmed as any).gas_used,
          vmStatus: (confirmed as any).vm_status,
          outcome: outcomeIndex, // Include outcome index for UI display
        },
        ...getFullUIData(),
      });

    } else {
      // Transaction landed but failed on-chain
      state.failedTrades++;
      accState.failCount++;
      state.verificationFailures++;

      const RED = '\x1b[31m';
      const RESET = '\x1b[0m';

      console.log(
        `${RED}❌ [VERIFY] TX FAILED ON-CHAIN:${RESET} ${pending.hash.slice(0, 18)}... ` +
        `| vm_status: ${(confirmed as any).vm_status}`
      );

      broadcast({
        type: 'trade',
        data: {
          id: `verify-${++tradeIdCounter}`,
          bot: 'Verify-Bot',
          action: isBuy ? 'buy_outcome' : 'sell_outcome',
          actionDisplay: isBuy ? 'BUY (FAILED)' : 'SELL (FAILED)',
          amount: tradeAmount,
          latency: verificationLatency,
          success: false,
          verified: true,
          txHash: pending.hash,
          explorerUrl: `https://explorer.aptoslabs.com/txn/${pending.hash}?network=testnet`,
          timestamp: Date.now(),
          error: (confirmed as any).vm_status,
          outcome: outcomeIndex, // Include outcome index for UI display
        },
        ...getFullUIData(),
      });
    }

  } catch (err: any) {
    // Submission or verification failed
    state.totalTrades++;
    state.failedTrades++;
    state.verificationFailures++;
    accState.failCount++;

    const RED = '\x1b[31m';
    const RESET = '\x1b[0m';

    console.error(
      `${RED}⏰ [VERIFY] ERROR:${RESET} ${err.message?.slice(0, 80) || err}`
    );

    broadcast({
      type: 'trade',
      data: {
        id: `verify-${++tradeIdCounter}`,
        bot: 'Verify-Bot',
        action: 'unknown',
        actionDisplay: 'ERROR',
        amount: tradeAmount,
        latency: Date.now() - startTime,
        success: false,
        verified: false,
        timestamp: Date.now(),
        error: `Verification failed: ${err.message?.slice(0, 50) || err}`,
        outcome: outcomeIndex, // Include outcome index for UI display
      },
      ...getFullUIData(),
    });
  }
}

// Main trading loop for single account
async function accountTradingLoop(accState: AccountState, accountIndex: number): Promise<void> {
  console.log(`[Account ${accountIndex + 1}] Trading loop started`);

  // Stagger submissions - reduced to 50ms for orderless + multi-RPC (minimal contention)
  const staggerWindow = CONFIG.USE_ORDERLESS && CONFIG.USE_MULTI_RPC ? 50 : (CONFIG.USE_ORDERLESS ? 100 : 300);
  const staggerDelay = accountIndex * Math.ceil(staggerWindow / Math.max(state.accounts.length, 1));
  if (staggerDelay > 0) {
    await new Promise(r => setTimeout(r, staggerDelay));
  }

  let batchCount = 0;

  while (state.isRunning && accState.isActive) {
    try {
      // VERIFY MODE: One verified transaction at a time with on-chain confirmation
      if (RUN_MODE === 'verify') {
        await executeVerifiedTransaction(accState);
        // Fixed delay between verified transactions
        await new Promise(r => setTimeout(r, CONFIG.BATCH_DELAY_MS));
        batchCount++;
        continue; // Skip the rest of the loop logic
      }

      // HYBRID MODE: 70% fire-and-forget for speed, 30% safe mode for sequence sync
      if (Math.random() < CONFIG.FIRE_AND_FORGET_RATIO) {
        // Fire-and-forget: maximum speed, speculative sequence increment
        await fireAndForgetBatch(accState);
      } else {
        // Safe mode: wait for results, verify sequence
        await executeBatchForAccount(accState);
      }
      batchCount++;

      // Apply adaptive delay (only when mempool is congested)
      if (currentDelay > 0) {
        await new Promise(r => setTimeout(r, currentDelay));
      }

      // Check balance less frequently for speed
      if (batchCount % 100 === 0) {
        checkAndPauseIfLowBalance(accState).catch(() => {}); // Non-blocking
      }

      // Periodic sequence refresh to stay in sync (only for legacy mode, not orderless)
      if (!CONFIG.USE_ORDERLESS && batchCount % 200 === 0) {
        refreshSequenceNumber(accState).catch(() => {}); // Non-blocking
      }
    } catch (e: any) {
      console.error(`[Account ${accountIndex + 1}] Error: ${e.message?.slice(0, 50)}`);
      if (!CONFIG.USE_ORDERLESS) {
        refreshSequenceNumber(accState).catch(() => {}); // Non-blocking
      }
      await new Promise(r => setTimeout(r, 30)); // Brief pause
    }
  }

  console.log(`[Account ${accountIndex + 1}] Trading loop stopped`);
}

// Get next market address for round-robin trading (reduces aggregator contention)
function getNextMarket(): string {
  if (state.marketAddresses.length === 0) {
    return state.marketAddress || '';
  }
  const market = state.marketAddresses[state.marketIndex];
  state.marketIndex = (state.marketIndex + 1) % state.marketAddresses.length;
  return market;
}

// Get market info
async function getMarketInfo(): Promise<{ address: string; isMultiOutcome: boolean; outcomeCount: number }> {
  // Check for multi-market mode (comma-separated list for round-robin)
  const envMarkets = process.env.MULTI_MARKETS;
  if (envMarkets) {
    const markets = envMarkets.split(',').map(m => m.trim()).filter(m => m);
    if (markets.length > 0) {
      console.log(`[MULTI-MARKET] Round-robin mode with ${markets.length} markets`);
      state.marketAddresses = markets;
      // Return first market's info (all should be multi-outcome)
      const infoResult = await aptos.view({
        payload: {
          function: `${MULTI_MODULE}::get_multi_market_info`,
          functionArguments: [markets[0]],
        },
      });
      return {
        address: markets[0], // Primary market for display
        isMultiOutcome: true,
        outcomeCount: Number(infoResult[3]),
      };
    }
  }

  // Check for single explicit market address via env var
  const envMarket = process.env.MULTI_MARKET;

  // Try multi-outcome first
  try {
    const result = await aptos.view({
      payload: {
        function: `${MULTI_MODULE}::get_all_multi_markets`,
        functionArguments: [],
      },
    });
    const markets = result[0] as string[];
    if (markets.length > 0) {
      // Use env var market if specified, otherwise use last (newest) market
      const marketAddress = envMarket || markets[markets.length - 1];
      const infoResult = await aptos.view({
        payload: {
          function: `${MULTI_MODULE}::get_multi_market_info`,
          functionArguments: [marketAddress],
        },
      });
      return {
        address: marketAddress,
        isMultiOutcome: true,
        outcomeCount: Number(infoResult[3]),
      };
    }
  } catch (e) {
    // Continue to binary markets
  }

  // Fall back to binary markets
  const result = await aptos.view({
    payload: {
      function: `${MODULE}::get_all_markets`,
      functionArguments: [],
    },
  });
  const markets = result[0] as string[];
  if (markets.length === 0) throw new Error('No markets found');

  return { address: markets[0], isMultiOutcome: false, outcomeCount: 2 };
}

// Helper to parse keys with optional ed25519-priv- prefix
function parsePrivateKey(key: string): Ed25519PrivateKey {
  const cleanKey = key.startsWith('ed25519-priv-') ? key.slice(13) : key;
  return new Ed25519PrivateKey(cleanKey);
}

// Initialize accounts
function initializeAccounts(): Account[] {
  const accounts: Account[] = [];

  // Check for multi-account mode - ALWAYS load all accounts
  // (trading speed is controlled by mode config, not account count)
  const ultraKeys = process.env.ULTRA_PRIVATE_KEYS;
  if (ultraKeys) {
    const keys = ultraKeys.split(',').map(k => k.trim());
    for (const key of keys) {
      try {
        accounts.push(Account.fromPrivateKey({ privateKey: parsePrivateKey(key) }));
      } catch (e) {
        console.error(`Invalid key: ${key.slice(0, 10)}...`);
      }
    }
  }

  // Fall back to single account
  if (accounts.length === 0) {
    const singleKey = process.env.APTOS_PRIVATE_KEY;
    if (singleKey) {
      accounts.push(Account.fromPrivateKey({ privateKey: parsePrivateKey(singleKey) }));
    }
  }

  return accounts;
}

// Start trading
async function startTrading(): Promise<void> {
  if (state.isRunning) return;

  const accounts = initializeAccounts();
  if (accounts.length === 0) {
    console.error('No accounts configured. Set ULTRA_PRIVATE_KEYS or APTOS_PRIVATE_KEY');
    return;
  }

  console.log(`\nInitializing ${accounts.length} account(s)...`);

  // Get market info
  const marketInfo = await getMarketInfo();
  state.marketAddress = marketInfo.address;
  state.isMultiOutcome = marketInfo.isMultiOutcome;
  state.outcomeCount = marketInfo.outcomeCount;

  console.log(`Market: ${state.marketAddress.slice(0, 20)}...`);
  console.log(`Type: ${state.isMultiOutcome ? `Multi-Outcome (${state.outcomeCount})` : 'Binary'}`);

  // Initialize account states
  state.accounts = [];
  for (const account of accounts) {
    const accState: AccountState = {
      account,
      sequenceNumber: 0n,
      pendingTxns: 0,
      successCount: 0,
      failCount: 0,
      isActive: true,
    };

    await refreshSequenceNumber(accState);

    // Check balance (USD1 if enabled, otherwise APT)
    try {
      const { balance, symbol } = await getAccountBalance(account.accountAddress.toString());
      const balanceDecimal = balance / 100_000_000;
      console.log(`  ${account.accountAddress.toString().slice(0, 12)}... | ${balanceDecimal.toFixed(2)} ${symbol} | Seq: ${accState.sequenceNumber}`);

      if (balanceDecimal < 1) {
        console.warn(`    WARNING: Low balance, skipping this account`);
        accState.isActive = false;
      }
    } catch (e) {
      console.error(`  Failed to check balance`);
      accState.isActive = false;
    }

    state.accounts.push(accState);
  }

  const activeAccounts = state.accounts.filter(a => a.isActive);
  if (activeAccounts.length === 0) {
    console.error('No active accounts with sufficient balance');
    return;
  }

  // Reset stats
  state.totalTrades = 0;
  state.successfulTrades = 0;
  state.failedTrades = 0;
  state.startTime = Date.now();
  state.submittedTxHashes = []; // Reset transaction tracking for new run
  state.peakTps = 0;
  state.recentTps = [];
  state.recentLatencies = [];
  state.totalInvested = 0;
  // Reset verification stats
  state.verifiedOnChain = 0;
  state.verificationFailures = 0;
  lastTpsCalcTime = Date.now();
  lastTpsCalcTrades = 0;

  // Initial UI data fetch
  await refreshUIData();

  state.isRunning = true;

  console.log(`\nStarting ${activeAccounts.length} parallel trading loops...`);
  console.log(`Batch: ${CONFIG.BATCH_SIZE} | Delay: ${CONFIG.BATCH_DELAY_MS}ms`);
  console.log(`Orderless: ${CONFIG.USE_ORDERLESS ? 'YES (random nonces)' : 'NO (sequence numbers)'}`);
  console.log(`Target: ~${(CONFIG.BATCH_SIZE * activeAccounts.length / (CONFIG.BATCH_DELAY_MS / 1000)).toFixed(0)} TPS\n`);

  // Start periodic UI data refresh (every 15 seconds, non-blocking)
  const uiRefreshInterval = setInterval(() => {
    if (!state.isRunning) {
      clearInterval(uiRefreshInterval);
      return;
    }
    // Fire off without awaiting - don't block event loop
    refreshUIData().catch(() => {});
    // Broadcast updated state to all clients
    broadcast({ type: 'state', data: { isRunning: state.isRunning, ...getFullUIData() } });
  }, 15000);

  // Beautiful stats banner every 5 seconds
  const statsBannerInterval = setInterval(() => {
    if (!state.isRunning) {
      clearInterval(statsBannerInterval);
      return;
    }
    printStatsBanner();
  }, 5000);

  // Start all trading loops in parallel
  for (let i = 0; i < state.accounts.length; i++) {
    if (state.accounts[i].isActive) {
      accountTradingLoop(state.accounts[i], i);
    }
  }

  broadcast({ type: 'started', ...getFullUIData() });
}

// Express + WebSocket setup
const app = express();
app.use(cors());
app.use(express.json());

const server = createServer(app);
const wss = new WebSocketServer({ server });

wss.on('connection', (ws) => {
  console.log('Client connected');
  clients.add(ws);

  // DON'T auto-start - let the frontend's LAUNCH button control when to start
  // The user wants: ARM → pre-flight checks → LAUNCH → countdown → start

  // Send full UI data on connection
  ws.send(JSON.stringify({
    type: 'state',
    data: { isRunning: state.isRunning, ...getFullUIData() },
  }));

  // Handle incoming messages (relay trade broadcasts from external scripts)
  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data.toString());
      // If it's a trade message, relay to all other clients
      if (msg.type === 'trade' && msg.data) {
        // Update our stats
        state.totalTrades++;
        state.successfulTrades++;
        // Broadcast to all clients (including sender, for confirmation)
        broadcast(msg);
      }
    } catch {
      // Ignore invalid messages
    }
  });

  ws.on('close', () => {
    console.log('Client disconnected');
    clients.delete(ws);
  });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', isRunning: state.isRunning, stats: getStats() });
});

app.get('/status', async (req, res) => {
  let activeAccounts = state.accounts.filter(a => a.isActive).length;
  let totalAccounts = state.accounts.length;
  let combinedBalance = state.combinedBalance;
  let marketAddress = state.marketAddress;

  if (!marketAddress) {
    try {
      const marketInfo = await getMarketInfo();
      marketAddress = marketInfo.address;
    } catch {
      marketAddress = null;
    }
  }

  if (totalAccounts === 0) {
    const accounts = initializeAccounts();
    totalAccounts = accounts.length;
    combinedBalance = 0;
    activeAccounts = 0;
    for (const account of accounts) {
      try {
        const { balance } = await getAccountBalance(account.accountAddress.toString());
        const balanceDecimal = balance / 100_000_000;
        combinedBalance += balanceDecimal;
        if (balanceDecimal >= 0.5) activeAccounts++;
      } catch {
        // Ignore individual balance errors
      }
    }
  }

  const uiData = getFullUIData();
  const market = {
    ...uiData.market,
    address: marketAddress || uiData.market.address,
  };

  res.json({
    status: 'ok',
    isRunning: state.isRunning,
    mode: CONFIG.MODE_LABEL,
    accounts: { active: activeAccounts, total: totalAccounts },
    marketAddress,
    stats: uiData.stats,
    market,
    position: uiData.position,
    botBalance: combinedBalance,
    marketReserves: uiData.marketReserves,
  });
});

app.post('/stop', (req, res) => {
  state.isRunning = false;
  state.accounts.forEach(a => a.isActive = false);
  saveSubmittedTxHashes(); // Save transaction hashes for post-run analysis
  broadcast({ type: 'stopped' });
  res.json({ success: true });
});

// Endpoint for secondary workers to report their stats to coordinator
app.post('/worker-stats', (req, res) => {
  if (!IS_COORDINATOR) {
    return res.status(400).json({ error: 'Not a coordinator' });
  }

  const { workerId, totalTrades, successfulTrades, failedTrades, currentTps, accountCount } = req.body;

  if (!workerId) {
    return res.status(400).json({ error: 'Missing workerId' });
  }

  // Update secondary worker stats
  secondaryWorkerStats.set(workerId, {
    workerId,
    totalTrades: totalTrades || 0,
    successfulTrades: successfulTrades || 0,
    failedTrades: failedTrades || 0,
    currentTps: currentTps || 0,
    accountCount: accountCount || 0,
    lastUpdate: Date.now(),
  });

  console.log(`[Coordinator] Worker ${workerId}: ${currentTps?.toFixed(0) || 0} TPS, ${totalTrades || 0} trades`);

  res.json({ success: true });
});

// Get aggregated stats from all workers
app.get('/aggregated-stats', (req, res) => {
  const agg = getAggregatedStats();
  res.json({
    ...agg,
    isCoordinator: IS_COORDINATOR,
    secondaryWorkers: Array.from(secondaryWorkerStats.keys()),
  });
});

app.post('/start', async (req, res) => {
  if (state.isRunning) {
    return res.json({ success: true, message: 'Already running' });
  }

  // If accounts not initialized yet, initialize them now
  if (state.accounts.length === 0) {
    console.log('📋 No accounts initialized, running initialization...');
    await initializeServerState();
  }

  if (!state.marketAddress) {
    return res.status(400).json({ success: false, error: 'No market address set' });
  }

  const activeAccounts = state.accounts.filter(a => a.isActive);
  if (activeAccounts.length === 0) {
    return res.status(400).json({ success: false, error: 'No active accounts with sufficient balance' });
  }

  // Reset adaptive delay and stats
  currentDelay = 0;
  consecutiveSuccess = 0;
  state.totalTrades = 0;
  state.successfulTrades = 0;
  state.failedTrades = 0;
  state.startTime = Date.now();
  state.submittedTxHashes = []; // Reset transaction tracking for new run
  state.peakTps = 0;
  state.recentTps = [];
  state.recentLatencies = [];
  state.totalInvested = 0;
  // Reset verification stats
  state.verifiedOnChain = 0;
  state.verificationFailures = 0;
  lastTpsCalcTime = Date.now();
  lastTpsCalcTrades = 0;

  // Refresh UI data
  await refreshUIData();

  // Start trading
  state.isRunning = true;

  console.log(`\n🚀 LAUNCH! Starting ${activeAccounts.length} parallel trading loops...`);
  console.log(`Mode: ${CONFIG.MODE_LABEL} | Batch: ${CONFIG.BATCH_SIZE} | Target: ${CONFIG.TARGET_TPS} TPS\n`);

  // Start periodic UI data refresh (every 15 seconds, non-blocking)
  const uiRefreshInterval = setInterval(() => {
    if (!state.isRunning) {
      clearInterval(uiRefreshInterval);
      return;
    }
    refreshUIData().catch(() => {});
    broadcast({ type: 'state', data: { isRunning: state.isRunning, ...getFullUIData() } });
  }, 15000);

  // Stats banner every 5 seconds
  const statsBannerInterval = setInterval(() => {
    if (!state.isRunning) {
      clearInterval(statsBannerInterval);
      return;
    }
    printStatsBanner();
  }, 5000);

  // Start all trading loops in parallel
  for (let i = 0; i < state.accounts.length; i++) {
    if (state.accounts[i].isActive) {
      accountTradingLoop(state.accounts[i], i);
    }
  }

  broadcast({ type: 'started', ...getFullUIData() });
  res.json({ success: true, message: `Trading started with ${activeAccounts.length} accounts` });
});

app.get('/stats', (req, res) => {
  res.json(getStats());
});

// Mode emoji and description mapping
const MODE_INFO: Record<RunMode, { emoji: string; desc: string }> = {
  dryrun:  { emoji: '🧪', desc: 'UI test mode (~10 TPS)' },
  light:   { emoji: '💡', desc: 'Light stress test (~100 TPS)' },
  normal:  { emoji: '🔄', desc: 'Medium demo (~1K TPS)' },
  turbo:   { emoji: '⚡', desc: 'Medium-high intensity (~3K TPS)' },
  ultra:   { emoji: '🔥', desc: 'High intensity (~10K TPS)' },
  quantum: { emoji: '🚀', desc: 'MAXIMUM POWER (~30K+ TPS)' },
  beast:   { emoji: '🦾', desc: 'M1 Max optimized (~5K TPS)' },
  dec28:   { emoji: '🎯', desc: 'Dec 28 config (4K+ TPS achieved)' },
  dec28_real: { emoji: '✅', desc: 'ACTUAL Dec 28 config from e4083b2 (no port exhaustion)' },
  verify:  { emoji: '🔍', desc: 'Full on-chain verification (~1 TPS)' },
};

// Initialize server state (accounts + market) without starting trading
async function initializeServerState(): Promise<void> {
  console.log('\n📋 Initializing server state...');

  const accounts = initializeAccounts();
  if (accounts.length === 0) {
    console.warn('⚠️  No accounts configured. Set ULTRA_PRIVATE_KEYS or APTOS_PRIVATE_KEY');
    return;
  }

  console.log(`Found ${accounts.length} account(s)`);

  // Get market info
  try {
    const marketInfo = await getMarketInfo();
    state.marketAddress = marketInfo.address;
    state.isMultiOutcome = marketInfo.isMultiOutcome;
    state.outcomeCount = marketInfo.outcomeCount;
    console.log(`✓ Market: ${state.marketAddress.slice(0, 20)}...`);
    console.log(`✓ Type: ${state.isMultiOutcome ? `Multi-Outcome (${state.outcomeCount})` : 'Binary'}`);
  } catch (e: any) {
    console.error(`✗ Failed to fetch market: ${e.message}`);
  }

  // Initialize account states
  state.accounts = [];
  let totalBalance = 0;
  for (const account of accounts) {
    const accState: AccountState = {
      account,
      sequenceNumber: 0n,
      pendingTxns: 0,
      successCount: 0,
      failCount: 0,
      isActive: false, // Start inactive, will be activated on /start
    };

    try {
      await refreshSequenceNumber(accState);
      const { balance, symbol } = await getAccountBalance(account.accountAddress.toString());
      const balanceDecimal = balance / 100_000_000;
      totalBalance += balanceDecimal;
      console.log(`  ${account.accountAddress.toString().slice(0, 12)}... | ${balanceDecimal.toFixed(2)} ${symbol}`);

      if (balanceDecimal >= 0.5) {
        accState.isActive = true; // Mark as ready (but not trading yet)
      }
    } catch (e) {
      console.error(`  Failed to check ${account.accountAddress.toString().slice(0, 12)}...`);
    }

    state.accounts.push(accState);
  }

  state.combinedBalance = totalBalance;
  const balanceSymbol = USE_USD1 && USD1_METADATA ? 'USD1' : 'APT';
  console.log(`\n✓ Total balance: ${totalBalance.toFixed(2)} ${balanceSymbol} across ${accounts.length} accounts`);
  console.log('✓ Server ready. Use UI to ARM and LAUNCH, or auto-start with mode arg.\n');
}

// Start server - bind to 0.0.0.0 to accept external connections
server.listen(CONFIG.PORT, '0.0.0.0', async () => {
  const modeInfo = MODE_INFO[RUN_MODE];
  console.log('='.repeat(70));
  console.log(`${modeInfo.emoji} ULTRA HFT SERVER - ${RUN_MODE.toUpperCase()} MODE ${modeInfo.emoji}`);
  console.log('='.repeat(70));
  console.log(`\nMode: ${RUN_MODE} - ${modeInfo.desc}`);
  console.log(`\nHTTP:      http://localhost:${CONFIG.PORT}`);
  console.log(`WebSocket: ws://localhost:${CONFIG.PORT}`);
  console.log('\nFeatures:');
  console.log('  - ORDERLESS TRANSACTIONS (no sequence bottleneck!)');
  console.log('  - Multi-account parallel submission (25 accounts)');
  console.log(`  - Batch size: ${CONFIG.BATCH_SIZE} txns/batch`);
  console.log(`  - Fire-and-forget: ${(CONFIG.FIRE_AND_FORGET_RATIO * 100).toFixed(0)}%`);
  console.log('  - 3-stage pipeline: Build → Sign → Submit');
  console.log('  - Multi-RPC load balancing');
  console.log('\nConfiguration:');
  console.log(`  BATCH_SIZE:     ${CONFIG.BATCH_SIZE}`);
  console.log(`  BATCH_DELAY_MS: ${CONFIG.BATCH_DELAY_MS}`);
  console.log(`  USE_MULTI_RPC:  ${CONFIG.USE_MULTI_RPC}`);
  console.log(`  MAX_PENDING:    ${CONFIG.MAX_PENDING}`);
  console.log(`  USE_USD1:       ${USE_USD1}`);
  console.log(`\n${modeInfo.emoji} Target: ${CONFIG.TARGET_TPS.toLocaleString()} TPS`);
  console.log('\n' + '='.repeat(70));

  // Initialize USD1 if enabled
  await initializeUSD1();

  // ALWAYS initialize accounts and market on startup (for pre-flight checks)
  await initializeServerState();

  // Auto-start trading ONLY if mode is passed as command line arg
  const mode = process.argv[2];
  const duration = parseInt(process.argv[3]) || 60;
  if (mode === 'dryrun' || mode === 'light' || mode === 'normal' || mode === 'turbo' || mode === 'ultra' || mode === 'quantum' || mode === 'beast' || mode === 'dec28' || mode === 'dec28_real' || mode === 'verify' || mode === 'prod') {
    console.log(`\n${modeInfo.emoji} AUTO-START: ${RUN_MODE} mode for ${duration}s...`);
    await startTrading();
    if (duration > 0) {
      setTimeout(async () => {
        console.log(`\n${duration}s completed. Stopping...`);
        state.isRunning = false;

        // Save transaction hashes for post-run analysis
        saveSubmittedTxHashes();

        // Grace period: wait for pending fire-and-forget transactions to complete
        // Fire-and-forget batches send HTTP requests without awaiting them.
        // We need to give these in-flight requests time to complete before exiting.
        const gracePeriodMs = 15000;
        console.log(`⏳ Waiting ${gracePeriodMs/1000}s for pending transactions to complete...`);
        await new Promise(resolve => setTimeout(resolve, gracePeriodMs));

        console.log(`✅ Grace period complete. FF resolved: ${ffDebugCounter}`);
        console.log(`   Total trades: ${state.totalTrades}, Success: ${state.successfulTrades}, Failed: ${state.failedTrades}`);
        process.exit(0);
      }, duration * 1000);
    }
  } else {
    console.log('\n⏸️  STANDBY MODE: Waiting for UI to ARM and LAUNCH');
    console.log('   Or restart with a mode: npx tsx server/hft-ultra-server.ts turbo 60\n');
  }

  // If this is a secondary worker, connect to coordinator and report stats
  if (COORDINATOR_URL) {
    console.log(`\n📡 SECONDARY WORKER MODE - Reporting stats to coordinator: ${COORDINATOR_URL}`);

    // Convert ws:// to http:// for REST API
    const coordinatorHttpUrl = COORDINATOR_URL.replace('ws://', 'http://').replace('wss://', 'https://');

    // Report stats every 500ms
    setInterval(async () => {
      if (!state.isRunning) return;

      try {
        const currentTps = state.recentTps.length > 0 ? state.recentTps[state.recentTps.length - 1] : 0;

        await fetch(`${coordinatorHttpUrl}/worker-stats`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            workerId: WORKER_ID,
            totalTrades: state.totalTrades,
            successfulTrades: state.successfulTrades,
            failedTrades: state.failedTrades,
            currentTps,
            accountCount: state.accounts.length,
          }),
        });
      } catch (e) {
        // Silently ignore - coordinator might be down
      }
    }, 500);
  } else {
    console.log('\n👑 COORDINATOR MODE - Aggregating stats from all workers');
  }
});
