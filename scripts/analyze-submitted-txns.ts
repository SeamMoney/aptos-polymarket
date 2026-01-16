#!/usr/bin/env npx tsx
/**
 * Analyze Submitted Transactions - Post-Run TPS Analysis
 *
 * This script analyzes the actual transaction hashes submitted by the HFT bots,
 * NOT just block scanning. This gives accurate TPS measurement by:
 * 1. Reading the saved transaction hashes from /tmp/hft-submitted-txns.json
 * 2. Querying each transaction to get its on-chain status
 * 3. Calculating TPS based on when transactions actually landed on-chain
 *
 * Usage:
 *   npx tsx scripts/analyze-submitted-txns.ts                    # Analyze last run
 *   npx tsx scripts/analyze-submitted-txns.ts /path/to/file.json # Analyze specific file
 */

import fs from 'fs';

// Use official testnet API (has indexer for transaction lookups)
const DEFAULT_FULLNODE = 'https://api.testnet.aptoslabs.com/v1';
const FULLNODE_URL = process.env.FULLNODE_URL || DEFAULT_FULLNODE;

interface SubmittedTxn {
  hash: string;
  timestamp: number;
  market: string;
  outcome: number;
  isBuy: boolean;
}

interface SavedData {
  contractAddress: string;
  startTime: number;
  endTime: number;
  totalSubmitted: number;
  successfulTrades: number;
  failedTrades: number;
  peakTps: number;
  transactions: SubmittedTxn[];
}

interface OnChainTxn {
  hash: string;
  version: number;
  blockHeight: number;
  timestamp: number; // microseconds
  success: boolean;
  gasUsed: number;
  vmStatus: string;
  market: string;
  outcome: number;
  isBuy: boolean;
}

async function fetchTxnDetails(hash: string): Promise<{
  version: number;
  blockHeight: number;
  timestamp: number;
  success: boolean;
  gasUsed: number;
  vmStatus: string;
} | null> {
  try {
    const res = await fetch(`${FULLNODE_URL}/transactions/by_hash/${hash}`);
    if (!res.ok) return null;
    const data = await res.json();

    return {
      version: parseInt(data.version),
      blockHeight: parseInt(data.block_height || '0'),
      timestamp: parseInt(data.timestamp),
      success: data.success === true,
      gasUsed: parseInt(data.gas_used),
      vmStatus: data.vm_status || 'unknown',
    };
  } catch {
    return null;
  }
}

async function analyzeTransactions(txns: SubmittedTxn[]): Promise<OnChainTxn[]> {
  const results: OnChainTxn[] = [];
  const BATCH_SIZE = 50;

  console.log(`\n  Fetching on-chain data for ${txns.length} transactions...`);

  for (let i = 0; i < txns.length; i += BATCH_SIZE) {
    const batch = txns.slice(i, i + BATCH_SIZE);
    const promises = batch.map(async (txn) => {
      const details = await fetchTxnDetails(txn.hash);
      if (details) {
        return {
          hash: txn.hash,
          ...details,
          market: txn.market,
          outcome: txn.outcome,
          isBuy: txn.isBuy,
        };
      }
      return null;
    });

    const batchResults = await Promise.all(promises);
    for (const r of batchResults) {
      if (r) results.push(r);
    }

    const pct = Math.round(((i + batch.length) / txns.length) * 100);
    process.stdout.write(`\r  Progress: ${pct}% (${results.length} confirmed)   `);
  }

  console.log('');
  return results.sort((a, b) => a.timestamp - b.timestamp);
}

function calculateStats(txns: OnChainTxn[]) {
  if (txns.length === 0) return null;

  const successful = txns.filter(t => t.success);
  const failed = txns.filter(t => !t.success);

  // Time range (timestamps are in microseconds)
  const firstTs = txns[0].timestamp;
  const lastTs = txns[txns.length - 1].timestamp;
  const durationSeconds = (lastTs - firstTs) / 1_000_000;

  // TPS calculation
  const tps = durationSeconds > 0 ? successful.length / durationSeconds : 0;

  // Gas stats
  const totalGas = successful.reduce((sum, t) => sum + t.gasUsed, 0);
  const avgGas = successful.length > 0 ? totalGas / successful.length : 0;

  // Block distribution
  const blockCounts: Record<number, number> = {};
  for (const t of successful) {
    blockCounts[t.blockHeight] = (blockCounts[t.blockHeight] || 0) + 1;
  }
  const blockHeights = Object.keys(blockCounts).map(Number).sort((a, b) => a - b);
  const txnsPerBlock = Object.values(blockCounts);
  const avgTxnsPerBlock = txnsPerBlock.length > 0
    ? txnsPerBlock.reduce((a, b) => a + b, 0) / txnsPerBlock.length
    : 0;
  const maxTxnsPerBlock = txnsPerBlock.length > 0 ? Math.max(...txnsPerBlock) : 0;

  // Market distribution
  const marketCounts: Record<string, number> = {};
  for (const t of successful) {
    const shortMarket = t.market.slice(0, 10) + '...';
    marketCounts[shortMarket] = (marketCounts[shortMarket] || 0) + 1;
  }

  // Buy/Sell distribution
  const buys = successful.filter(t => t.isBuy).length;
  const sells = successful.length - buys;

  return {
    totalSubmitted: txns.length,
    confirmed: successful.length,
    failed: failed.length,
    confirmRate: (successful.length / txns.length) * 100,
    durationSeconds,
    tps,
    totalGas,
    avgGas,
    blockCount: blockHeights.length,
    firstBlock: blockHeights[0],
    lastBlock: blockHeights[blockHeights.length - 1],
    avgTxnsPerBlock,
    maxTxnsPerBlock,
    marketCounts,
    buys,
    sells,
    // Calculate TPS excluding first and last 5 seconds (warmup/cooldown)
    stableTps: calculateStableTps(txns),
  };
}

function calculateStableTps(txns: OnChainTxn[]): number {
  if (txns.length < 100) return 0;

  const successful = txns.filter(t => t.success);
  if (successful.length < 100) return 0;

  const firstTs = successful[0].timestamp;
  const lastTs = successful[successful.length - 1].timestamp;
  const totalDuration = (lastTs - firstTs) / 1_000_000;

  if (totalDuration < 15) return 0; // Need at least 15 seconds

  // Exclude first and last 5 seconds
  const stableStart = firstTs + 5_000_000;
  const stableEnd = lastTs - 5_000_000;

  const stableTxns = successful.filter(t => t.timestamp >= stableStart && t.timestamp <= stableEnd);
  const stableDuration = (stableEnd - stableStart) / 1_000_000;

  return stableDuration > 0 ? stableTxns.length / stableDuration : 0;
}

function formatNumber(n: number): string {
  return n.toLocaleString();
}

function printResults(data: SavedData, stats: ReturnType<typeof calculateStats>) {
  console.log(`\n${'═'.repeat(80)}`);
  console.log(`  SUBMITTED TRANSACTION ANALYSIS`);
  console.log(`${'═'.repeat(80)}\n`);

  // Source info
  console.log(`  Contract: ${data.contractAddress.slice(0, 12)}...${data.contractAddress.slice(-8)}`);
  console.log(`  Run time: ${new Date(data.startTime).toLocaleString()} - ${new Date(data.endTime).toLocaleString()}`);
  console.log(`  Submitted by HFT: ${formatNumber(data.totalSubmitted)} transactions`);
  console.log(`  Reported success: ${formatNumber(data.successfulTrades)} (${((data.successfulTrades / data.totalSubmitted) * 100).toFixed(1)}%)`);
  console.log(`  Reported peak TPS: ${formatNumber(Math.round(data.peakTps))}`);

  if (!stats) {
    console.log(`\n  ⚠️  No confirmed transactions found on-chain.`);
    return;
  }

  console.log(`\n  ${'─'.repeat(76)}`);
  console.log(`  ON-CHAIN VERIFICATION`);
  console.log(`  ${'─'.repeat(76)}\n`);

  console.log(`  Confirmed on-chain:     ${formatNumber(stats.confirmed).padStart(12)} transactions`);
  console.log(`  Failed on-chain:        ${formatNumber(stats.failed).padStart(12)} transactions`);
  console.log(`  Confirmation rate:      ${stats.confirmRate.toFixed(1).padStart(12)}%`);
  console.log(`  Duration:               ${stats.durationSeconds.toFixed(2).padStart(12)} seconds`);

  console.log(`\n  ${'─'.repeat(76)}`);
  console.log(`  TPS METRICS (Based on Confirmed Transactions)`);
  console.log(`  ${'─'.repeat(76)}\n`);

  console.log(`  Average TPS:            ${formatNumber(Math.round(stats.tps)).padStart(12)} txns/sec`);
  console.log(`  Stable TPS (mid-run):   ${formatNumber(Math.round(stats.stableTps)).padStart(12)} txns/sec`);
  console.log(`  Peak TPS (per block):   ${formatNumber(Math.round(stats.maxTxnsPerBlock * 10.6)).padStart(12)} txns/sec (est.)`);

  console.log(`\n  ${'─'.repeat(76)}`);
  console.log(`  BLOCK DISTRIBUTION`);
  console.log(`  ${'─'.repeat(76)}\n`);

  console.log(`  Block range:            ${formatNumber(stats.firstBlock)} - ${formatNumber(stats.lastBlock)}`);
  console.log(`  Total blocks:           ${formatNumber(stats.blockCount).padStart(12)}`);
  console.log(`  Avg txns/block:         ${stats.avgTxnsPerBlock.toFixed(1).padStart(12)}`);
  console.log(`  Max txns/block:         ${formatNumber(stats.maxTxnsPerBlock).padStart(12)}`);

  console.log(`\n  ${'─'.repeat(76)}`);
  console.log(`  GAS USAGE`);
  console.log(`  ${'─'.repeat(76)}\n`);

  console.log(`  Total gas used:         ${formatNumber(stats.totalGas).padStart(12)} gas units`);
  console.log(`  Avg gas/transaction:    ${formatNumber(Math.round(stats.avgGas)).padStart(12)} gas units`);
  console.log(`  Gas/second:             ${formatNumber(Math.round(stats.totalGas / stats.durationSeconds)).padStart(12)} gas/sec`);

  console.log(`\n  ${'─'.repeat(76)}`);
  console.log(`  TRADE DISTRIBUTION`);
  console.log(`  ${'─'.repeat(76)}\n`);

  console.log(`  Buy orders:             ${formatNumber(stats.buys).padStart(12)} (${((stats.buys / stats.confirmed) * 100).toFixed(1)}%)`);
  console.log(`  Sell orders:            ${formatNumber(stats.sells).padStart(12)} (${((stats.sells / stats.confirmed) * 100).toFixed(1)}%)`);

  console.log(`\n  Markets traded:`);
  const sortedMarkets = Object.entries(stats.marketCounts).sort((a, b) => b[1] - a[1]);
  for (const [market, count] of sortedMarkets.slice(0, 12)) {
    const pct = ((count / stats.confirmed) * 100).toFixed(1);
    const bar = '█'.repeat(Math.round(count / stats.confirmed * 30));
    console.log(`    ${market}  ${formatNumber(count).padStart(8)} (${pct.padStart(5)}%) ${bar}`);
  }

  console.log(`\n${'═'.repeat(80)}\n`);

  // Summary
  if (stats.stableTps >= 1000) {
    console.log(`  🚀 EXCELLENT! Achieved ${formatNumber(Math.round(stats.stableTps))} stable TPS!`);
  } else if (stats.stableTps >= 500) {
    console.log(`  ✅ GOOD! Achieved ${formatNumber(Math.round(stats.stableTps))} stable TPS`);
  } else if (stats.stableTps >= 100) {
    console.log(`  ⚡ DECENT! Achieved ${formatNumber(Math.round(stats.stableTps))} stable TPS`);
  } else {
    console.log(`  ⚠️  Low TPS: ${formatNumber(Math.round(stats.stableTps))} - check for bottlenecks`);
  }

  console.log(`\n  Analyze specific blocks: npx tsx scripts/analyze-tps.ts --range ${stats.firstBlock} ${stats.lastBlock}`);
  console.log('');
}

async function main() {
  const inputFile = process.argv[2] || '/tmp/hft-submitted-txns.json';

  console.log(`\n${'═'.repeat(80)}`);
  console.log(`  ANALYZING SUBMITTED TRANSACTIONS`);
  console.log(`${'═'.repeat(80)}`);

  // Check if file exists
  if (!fs.existsSync(inputFile)) {
    console.error(`\n  ❌ File not found: ${inputFile}`);
    console.error(`\n  Run an HFT demo first to generate transaction data.`);
    console.error(`  The HFT server automatically saves transactions to /tmp/hft-submitted-txns.json`);
    console.error(`  when trading stops.\n`);
    process.exit(1);
  }

  // Load data
  console.log(`\n  Loading: ${inputFile}`);
  const rawData = fs.readFileSync(inputFile, 'utf-8');
  const data: SavedData = JSON.parse(rawData);

  console.log(`  Found ${formatNumber(data.transactions.length)} submitted transactions`);

  if (data.transactions.length === 0) {
    console.error(`\n  ❌ No transactions found in file.\n`);
    process.exit(1);
  }

  // Sample if too many transactions (for speed)
  // 10K samples gives good accuracy while keeping analysis fast
  const MAX_SAMPLES = 10000;
  let txnsToAnalyze = data.transactions;
  if (data.transactions.length > MAX_SAMPLES) {
    console.log(`  Sampling ${MAX_SAMPLES} transactions for analysis (full set: ${formatNumber(data.transactions.length)})`);
    // Take evenly distributed samples
    const step = Math.floor(data.transactions.length / MAX_SAMPLES);
    txnsToAnalyze = data.transactions.filter((_, i) => i % step === 0).slice(0, MAX_SAMPLES);
  }

  // Fetch on-chain data
  const onChainTxns = await analyzeTransactions(txnsToAnalyze);

  if (onChainTxns.length === 0) {
    console.error(`\n  ❌ Could not verify any transactions on-chain.`);
    console.error(`  Check your fullnode connection: ${FULLNODE_URL}\n`);
    process.exit(1);
  }

  // Calculate stats
  const stats = calculateStats(onChainTxns);

  // Print results
  printResults(data, stats);
}

main().catch(console.error);
