#!/usr/bin/env npx tsx
/**
 * Deep TPS Analysis - Comprehensive Post-Run Performance Analysis
 *
 * This script provides in-depth analysis of HFT trading runs:
 * 1. Per-second TPS curve (not just averages)
 * 2. Latency histogram (submission → confirmation time)
 * 3. Per-account performance breakdown
 * 4. Per-market distribution and contention analysis
 * 5. Failure categorization by vm_status
 * 6. Block utilization (our txns vs total block capacity)
 * 7. Historical comparison (run-to-run tracking)
 * 8. Automated bottleneck identification
 *
 * Usage:
 *   npx tsx scripts/deep-tps-analysis.ts                    # Analyze last run
 *   npx tsx scripts/deep-tps-analysis.ts /path/to/file.json # Analyze specific file
 *   FULLNODE_URL=http://localhost:8080 npx tsx scripts/deep-tps-analysis.ts # Use custom fullnode
 */

import fs from 'fs';
import path from 'path';

const FULLNODE_URL = process.env.FULLNODE_URL || 'https://aptos.cash.trading/v1';
const HISTORY_DIR = path.join(process.env.HOME || '/tmp', '.aptos-tps-history');

interface SubmittedTxn {
  hash: string;
  timestamp: number; // submission time (ms)
  market: string;
  outcome: number;
  isBuy: boolean;
  sender?: string; // account address (may be missing in older data)
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
  submissionTime: number; // when we submitted (ms)
  confirmationTime: number; // when confirmed on-chain (ms, converted from microseconds)
  latencyMs: number; // confirmation - submission
  version: number;
  blockHeight: number;
  success: boolean;
  gasUsed: number;
  vmStatus: string;
  market: string;
  outcome: number;
  isBuy: boolean;
  sender: string;
}

interface BlockInfo {
  height: number;
  totalTxns: number;
  ourTxns: number;
  utilization: number; // ourTxns / totalTxns
  timestamp: number;
}

interface PerSecondStats {
  second: number; // seconds from start
  submitted: number;
  confirmed: number;
  tps: number;
  avgLatencyMs: number;
}

interface PerAccountStats {
  address: string;
  shortAddress: string;
  submitted: number;
  confirmed: number;
  failed: number;
  successRate: number;
  avgLatencyMs: number;
  minLatencyMs: number;
  maxLatencyMs: number;
}

interface PerMarketStats {
  address: string;
  shortAddress: string;
  volume: number;
  buys: number;
  sells: number;
  successRate: number;
  avgLatencyMs: number;
}

interface FailureCategory {
  vmStatus: string;
  count: number;
  percentage: number;
  examples: string[]; // sample tx hashes
}

interface AnalysisResult {
  runId: string;
  timestamp: string;
  contractAddress: string;
  duration: number;

  // Summary metrics
  totalSubmitted: number;
  totalConfirmed: number;
  totalFailed: number;
  confirmationRate: number;

  // TPS metrics
  averageTps: number;
  peakTps: number;
  stableTps: number; // excluding warmup/cooldown
  minTps: number;

  // Latency metrics
  avgLatencyMs: number;
  p50LatencyMs: number;
  p95LatencyMs: number;
  p99LatencyMs: number;
  minLatencyMs: number;
  maxLatencyMs: number;

  // Per-second breakdown
  perSecond: PerSecondStats[];

  // Per-account breakdown
  perAccount: PerAccountStats[];

  // Per-market breakdown
  perMarket: PerMarketStats[];

  // Block analysis
  blocks: BlockInfo[];
  avgTxnsPerBlock: number;
  maxTxnsPerBlock: number;
  avgBlockUtilization: number;

  // Failure analysis
  failures: FailureCategory[];

  // Bottleneck identification
  bottlenecks: string[];
  recommendations: string[];
}

// ============================================
// Utility Functions
// ============================================

function formatNumber(n: number): string {
  return n.toLocaleString();
}

function shortAddr(addr: string): string {
  return addr.slice(0, 8) + '...' + addr.slice(-4);
}

function percentile(arr: number[], p: number): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

// ============================================
// API Functions
// ============================================

async function fetchTxnDetails(hash: string): Promise<{
  version: number;
  blockHeight: number;
  timestamp: number; // microseconds
  success: boolean;
  gasUsed: number;
  vmStatus: string;
  sender: string;
} | null> {
  try {
    const res = await fetch(`${FULLNODE_URL}/transactions/by_hash/${hash}`);
    if (!res.ok) return null;
    const data = await res.json();

    return {
      version: parseInt(data.version),
      blockHeight: parseInt(data.block_height || '0'),
      timestamp: parseInt(data.timestamp), // microseconds
      success: data.success === true,
      gasUsed: parseInt(data.gas_used),
      vmStatus: data.vm_status || 'unknown',
      sender: data.sender || 'unknown',
    };
  } catch {
    return null;
  }
}

async function fetchBlockInfo(height: number): Promise<{
  totalTxns: number;
  timestamp: number;
} | null> {
  try {
    const res = await fetch(`${FULLNODE_URL}/blocks/by_height/${height}?with_transactions=false`);
    if (!res.ok) return null;
    const data = await res.json();

    const firstVersion = parseInt(data.first_version);
    const lastVersion = parseInt(data.last_version);
    const totalTxns = lastVersion - firstVersion + 1;

    return {
      totalTxns,
      timestamp: parseInt(data.block_timestamp),
    };
  } catch {
    return null;
  }
}

// ============================================
// Analysis Functions
// ============================================

async function analyzeTransactions(txns: SubmittedTxn[]): Promise<OnChainTxn[]> {
  const results: OnChainTxn[] = [];
  const BATCH_SIZE = 100; // Increase batch size for speed

  console.log(`\n  Fetching on-chain data for ${formatNumber(txns.length)} transactions...`);

  const startTime = Date.now();
  let fetchedCount = 0;

  for (let i = 0; i < txns.length; i += BATCH_SIZE) {
    const batch = txns.slice(i, i + BATCH_SIZE);
    const promises = batch.map(async (txn) => {
      const details = await fetchTxnDetails(txn.hash);
      if (details) {
        const confirmationTimeMs = details.timestamp / 1000; // Convert microseconds to ms
        return {
          hash: txn.hash,
          submissionTime: txn.timestamp,
          confirmationTime: confirmationTimeMs,
          latencyMs: confirmationTimeMs - txn.timestamp,
          version: details.version,
          blockHeight: details.blockHeight,
          success: details.success,
          gasUsed: details.gasUsed,
          vmStatus: details.vmStatus,
          market: txn.market,
          outcome: txn.outcome,
          isBuy: txn.isBuy,
          sender: txn.sender || details.sender,
        };
      }
      return null;
    });

    const batchResults = await Promise.all(promises);
    for (const r of batchResults) {
      if (r) results.push(r);
    }

    fetchedCount += batch.length;
    const elapsed = (Date.now() - startTime) / 1000;
    const rate = fetchedCount / elapsed;
    const remaining = (txns.length - fetchedCount) / rate;

    process.stdout.write(`\r  Progress: ${Math.round((fetchedCount / txns.length) * 100)}% ` +
      `(${formatNumber(results.length)} confirmed, ${rate.toFixed(0)} txn/s, ~${remaining.toFixed(0)}s remaining)   `);
  }

  console.log('');
  return results.sort((a, b) => a.submissionTime - b.submissionTime);
}

async function analyzeBlocks(txns: OnChainTxn[]): Promise<BlockInfo[]> {
  const blockHeights = [...new Set(txns.map(t => t.blockHeight))].sort((a, b) => a - b);

  if (blockHeights.length === 0) return [];

  console.log(`  Analyzing ${formatNumber(blockHeights.length)} blocks...`);

  // Count our txns per block
  const ourTxnsPerBlock: Record<number, number> = {};
  for (const txn of txns) {
    ourTxnsPerBlock[txn.blockHeight] = (ourTxnsPerBlock[txn.blockHeight] || 0) + 1;
  }

  // Fetch block info (sample if too many blocks)
  const blocksToFetch = blockHeights.length > 100
    ? blockHeights.filter((_, i) => i % Math.ceil(blockHeights.length / 100) === 0)
    : blockHeights;

  const results: BlockInfo[] = [];
  const BATCH_SIZE = 20;

  for (let i = 0; i < blocksToFetch.length; i += BATCH_SIZE) {
    const batch = blocksToFetch.slice(i, i + BATCH_SIZE);
    const promises = batch.map(async (height) => {
      const info = await fetchBlockInfo(height);
      if (info) {
        return {
          height,
          totalTxns: info.totalTxns,
          ourTxns: ourTxnsPerBlock[height] || 0,
          utilization: (ourTxnsPerBlock[height] || 0) / info.totalTxns,
          timestamp: info.timestamp,
        };
      }
      return null;
    });

    const batchResults = await Promise.all(promises);
    for (const r of batchResults) {
      if (r) results.push(r);
    }

    process.stdout.write(`\r  Block progress: ${Math.round(((i + batch.length) / blocksToFetch.length) * 100)}%   `);
  }

  console.log('');
  return results.sort((a, b) => a.height - b.height);
}

function calculatePerSecondStats(txns: OnChainTxn[]): PerSecondStats[] {
  if (txns.length === 0) return [];

  const minTime = Math.min(...txns.map(t => t.submissionTime));
  const maxTime = Math.max(...txns.map(t => t.submissionTime));
  const durationSeconds = Math.ceil((maxTime - minTime) / 1000);

  const stats: PerSecondStats[] = [];

  for (let s = 0; s <= durationSeconds; s++) {
    const startMs = minTime + s * 1000;
    const endMs = startMs + 1000;

    const submitted = txns.filter(t => t.submissionTime >= startMs && t.submissionTime < endMs);
    const confirmed = submitted.filter(t => t.success);
    const latencies = confirmed.map(t => t.latencyMs).filter(l => l > 0 && l < 30000); // Filter outliers

    stats.push({
      second: s,
      submitted: submitted.length,
      confirmed: confirmed.length,
      tps: confirmed.length, // per second = TPS
      avgLatencyMs: latencies.length > 0 ? latencies.reduce((a, b) => a + b, 0) / latencies.length : 0,
    });
  }

  return stats;
}

function calculatePerAccountStats(txns: OnChainTxn[]): PerAccountStats[] {
  const byAccount: Record<string, OnChainTxn[]> = {};

  for (const txn of txns) {
    const addr = txn.sender || 'unknown';
    if (!byAccount[addr]) byAccount[addr] = [];
    byAccount[addr].push(txn);
  }

  return Object.entries(byAccount).map(([address, accountTxns]) => {
    const confirmed = accountTxns.filter(t => t.success);
    const failed = accountTxns.filter(t => !t.success);
    const latencies = confirmed.map(t => t.latencyMs).filter(l => l > 0 && l < 30000);

    return {
      address,
      shortAddress: shortAddr(address),
      submitted: accountTxns.length,
      confirmed: confirmed.length,
      failed: failed.length,
      successRate: accountTxns.length > 0 ? (confirmed.length / accountTxns.length) * 100 : 0,
      avgLatencyMs: latencies.length > 0 ? latencies.reduce((a, b) => a + b, 0) / latencies.length : 0,
      minLatencyMs: latencies.length > 0 ? Math.min(...latencies) : 0,
      maxLatencyMs: latencies.length > 0 ? Math.max(...latencies) : 0,
    };
  }).sort((a, b) => b.confirmed - a.confirmed);
}

function calculatePerMarketStats(txns: OnChainTxn[]): PerMarketStats[] {
  const byMarket: Record<string, OnChainTxn[]> = {};

  for (const txn of txns) {
    if (!byMarket[txn.market]) byMarket[txn.market] = [];
    byMarket[txn.market].push(txn);
  }

  return Object.entries(byMarket).map(([address, marketTxns]) => {
    const confirmed = marketTxns.filter(t => t.success);
    const buys = confirmed.filter(t => t.isBuy);
    const sells = confirmed.filter(t => !t.isBuy);
    const latencies = confirmed.map(t => t.latencyMs).filter(l => l > 0 && l < 30000);

    return {
      address,
      shortAddress: shortAddr(address),
      volume: confirmed.length,
      buys: buys.length,
      sells: sells.length,
      successRate: marketTxns.length > 0 ? (confirmed.length / marketTxns.length) * 100 : 0,
      avgLatencyMs: latencies.length > 0 ? latencies.reduce((a, b) => a + b, 0) / latencies.length : 0,
    };
  }).sort((a, b) => b.volume - a.volume);
}

function categorizeFailures(txns: OnChainTxn[]): FailureCategory[] {
  const failed = txns.filter(t => !t.success);
  const byStatus: Record<string, OnChainTxn[]> = {};

  for (const txn of failed) {
    const status = txn.vmStatus || 'unknown';
    if (!byStatus[status]) byStatus[status] = [];
    byStatus[status].push(txn);
  }

  return Object.entries(byStatus).map(([vmStatus, statusTxns]) => ({
    vmStatus,
    count: statusTxns.length,
    percentage: failed.length > 0 ? (statusTxns.length / failed.length) * 100 : 0,
    examples: statusTxns.slice(0, 3).map(t => t.hash),
  })).sort((a, b) => b.count - a.count);
}

function identifyBottlenecks(result: Partial<AnalysisResult>): { bottlenecks: string[]; recommendations: string[] } {
  const bottlenecks: string[] = [];
  const recommendations: string[] = [];

  // Check confirmation rate
  if (result.confirmationRate && result.confirmationRate < 90) {
    bottlenecks.push(`Low confirmation rate: ${result.confirmationRate.toFixed(1)}%`);

    // Check failure reasons
    if (result.failures) {
      const seqErrors = result.failures.find(f => f.vmStatus.includes('SEQUENCE'));
      if (seqErrors && seqErrors.percentage > 10) {
        recommendations.push('High sequence number errors - consider using orderless transactions or reducing parallelism');
      }

      const gasErrors = result.failures.find(f => f.vmStatus.includes('GAS'));
      if (gasErrors) {
        recommendations.push('Gas errors detected - increase max_gas_amount');
      }
    }
  }

  // Check latency
  if (result.p95LatencyMs && result.p95LatencyMs > 5000) {
    bottlenecks.push(`High p95 latency: ${result.p95LatencyMs.toFixed(0)}ms`);
    recommendations.push('Transactions taking too long - check RPC endpoint performance or network congestion');
  }

  // Check TPS variance
  if (result.perSecond) {
    const tpsValues = result.perSecond.map(s => s.tps).filter(t => t > 0);
    if (tpsValues.length > 5) {
      const avg = tpsValues.reduce((a, b) => a + b, 0) / tpsValues.length;
      const variance = tpsValues.reduce((sum, t) => sum + Math.pow(t - avg, 2), 0) / tpsValues.length;
      const stdDev = Math.sqrt(variance);
      const cv = (stdDev / avg) * 100; // coefficient of variation

      if (cv > 50) {
        bottlenecks.push(`High TPS variance: CV=${cv.toFixed(0)}% (unstable throughput)`);
        recommendations.push('TPS is unstable - check for periodic bottlenecks (balance checks, sequence refreshes)');
      }
    }
  }

  // Check per-account balance
  if (result.perAccount) {
    const lowPerformers = result.perAccount.filter(a => a.successRate < 80);
    if (lowPerformers.length > 0) {
      bottlenecks.push(`${lowPerformers.length} accounts with <80% success rate`);
      recommendations.push('Some accounts underperforming - check balances or sequence number issues');
    }
  }

  // Check block utilization
  if (result.avgBlockUtilization && result.avgBlockUtilization < 0.1) {
    bottlenecks.push(`Low block utilization: ${(result.avgBlockUtilization * 100).toFixed(1)}%`);
    recommendations.push('Not filling blocks - increase batch size or parallelism');
  }

  // Check if any market has significantly lower success rate
  if (result.perMarket) {
    const lowMarkets = result.perMarket.filter(m => m.successRate < 90 && m.volume > 100);
    if (lowMarkets.length > 0) {
      bottlenecks.push(`${lowMarkets.length} markets with contention issues`);
      recommendations.push('Some markets have lower success rates - possible state contention');
    }
  }

  if (bottlenecks.length === 0) {
    bottlenecks.push('No major bottlenecks detected');
  }

  if (recommendations.length === 0) {
    recommendations.push('System performing well - consider increasing load to find limits');
  }

  return { bottlenecks, recommendations };
}

// ============================================
// Output Functions
// ============================================

function printResults(result: AnalysisResult) {
  console.log(`\n${'═'.repeat(100)}`);
  console.log(`  DEEP TPS ANALYSIS - ${result.timestamp}`);
  console.log(`${'═'.repeat(100)}\n`);

  // Summary
  console.log(`  Contract: ${shortAddr(result.contractAddress)}`);
  console.log(`  Duration: ${result.duration.toFixed(1)} seconds`);
  console.log(`  Run ID:   ${result.runId}`);

  console.log(`\n  ${'─'.repeat(96)}`);
  console.log(`  SUMMARY`);
  console.log(`  ${'─'.repeat(96)}\n`);

  console.log(`  Total Submitted:        ${formatNumber(result.totalSubmitted).padStart(12)}`);
  console.log(`  Total Confirmed:        ${formatNumber(result.totalConfirmed).padStart(12)} (${result.confirmationRate.toFixed(1)}%)`);
  console.log(`  Total Failed:           ${formatNumber(result.totalFailed).padStart(12)}`);

  console.log(`\n  ${'─'.repeat(96)}`);
  console.log(`  TPS METRICS`);
  console.log(`  ${'─'.repeat(96)}\n`);

  console.log(`  Average TPS:            ${formatNumber(Math.round(result.averageTps)).padStart(12)} txn/sec`);
  console.log(`  Peak TPS:               ${formatNumber(Math.round(result.peakTps)).padStart(12)} txn/sec`);
  console.log(`  Stable TPS (mid-run):   ${formatNumber(Math.round(result.stableTps)).padStart(12)} txn/sec`);
  console.log(`  Minimum TPS:            ${formatNumber(Math.round(result.minTps)).padStart(12)} txn/sec`);

  console.log(`\n  ${'─'.repeat(96)}`);
  console.log(`  LATENCY (submission → confirmation)`);
  console.log(`  ${'─'.repeat(96)}\n`);

  console.log(`  Average:                ${result.avgLatencyMs.toFixed(0).padStart(12)} ms`);
  console.log(`  P50 (median):           ${result.p50LatencyMs.toFixed(0).padStart(12)} ms`);
  console.log(`  P95:                    ${result.p95LatencyMs.toFixed(0).padStart(12)} ms`);
  console.log(`  P99:                    ${result.p99LatencyMs.toFixed(0).padStart(12)} ms`);
  console.log(`  Min:                    ${result.minLatencyMs.toFixed(0).padStart(12)} ms`);
  console.log(`  Max:                    ${result.maxLatencyMs.toFixed(0).padStart(12)} ms`);

  // TPS Curve (mini chart)
  if (result.perSecond.length > 0) {
    console.log(`\n  ${'─'.repeat(96)}`);
    console.log(`  TPS CURVE (per second)`);
    console.log(`  ${'─'.repeat(96)}\n`);

    const maxTps = Math.max(...result.perSecond.map(s => s.tps));
    const chartWidth = 60;

    // Show every Nth second to fit in terminal
    const step = Math.max(1, Math.floor(result.perSecond.length / 20));

    for (let i = 0; i < result.perSecond.length; i += step) {
      const s = result.perSecond[i];
      const barLen = maxTps > 0 ? Math.round((s.tps / maxTps) * chartWidth) : 0;
      const bar = '█'.repeat(barLen);
      console.log(`  ${String(s.second).padStart(4)}s │ ${bar} ${s.tps}`);
    }
  }

  // Per-Account Stats
  if (result.perAccount.length > 0) {
    console.log(`\n  ${'─'.repeat(96)}`);
    console.log(`  PER-ACCOUNT PERFORMANCE`);
    console.log(`  ${'─'.repeat(96)}\n`);

    console.log(`  ${'Account'.padEnd(16)} ${'Submitted'.padStart(10)} ${'Confirmed'.padStart(10)} ${'Success%'.padStart(10)} ${'Avg Lat'.padStart(10)} ${'Max Lat'.padStart(10)}`);
    console.log(`  ${'-'.repeat(16)} ${'-'.repeat(10)} ${'-'.repeat(10)} ${'-'.repeat(10)} ${'-'.repeat(10)} ${'-'.repeat(10)}`);

    for (const acc of result.perAccount.slice(0, 10)) {
      console.log(`  ${acc.shortAddress.padEnd(16)} ${formatNumber(acc.submitted).padStart(10)} ${formatNumber(acc.confirmed).padStart(10)} ${acc.successRate.toFixed(1).padStart(9)}% ${acc.avgLatencyMs.toFixed(0).padStart(9)}ms ${acc.maxLatencyMs.toFixed(0).padStart(9)}ms`);
    }
  }

  // Per-Market Stats
  if (result.perMarket.length > 0) {
    console.log(`\n  ${'─'.repeat(96)}`);
    console.log(`  PER-MARKET DISTRIBUTION`);
    console.log(`  ${'─'.repeat(96)}\n`);

    console.log(`  ${'Market'.padEnd(16)} ${'Volume'.padStart(10)} ${'Buys'.padStart(8)} ${'Sells'.padStart(8)} ${'Success%'.padStart(10)} ${'Avg Lat'.padStart(10)}`);
    console.log(`  ${'-'.repeat(16)} ${'-'.repeat(10)} ${'-'.repeat(8)} ${'-'.repeat(8)} ${'-'.repeat(10)} ${'-'.repeat(10)}`);

    for (const mkt of result.perMarket.slice(0, 12)) {
      console.log(`  ${mkt.shortAddress.padEnd(16)} ${formatNumber(mkt.volume).padStart(10)} ${formatNumber(mkt.buys).padStart(8)} ${formatNumber(mkt.sells).padStart(8)} ${mkt.successRate.toFixed(1).padStart(9)}% ${mkt.avgLatencyMs.toFixed(0).padStart(9)}ms`);
    }
  }

  // Block Analysis
  if (result.blocks.length > 0) {
    console.log(`\n  ${'─'.repeat(96)}`);
    console.log(`  BLOCK UTILIZATION`);
    console.log(`  ${'─'.repeat(96)}\n`);

    console.log(`  Total Blocks:           ${formatNumber(result.blocks.length).padStart(12)}`);
    console.log(`  Avg Txns/Block (ours):  ${result.avgTxnsPerBlock.toFixed(1).padStart(12)}`);
    console.log(`  Max Txns/Block (ours):  ${formatNumber(result.maxTxnsPerBlock).padStart(12)}`);
    console.log(`  Avg Block Utilization:  ${(result.avgBlockUtilization * 100).toFixed(1).padStart(11)}%`);
  }

  // Failure Analysis
  if (result.failures.length > 0 && result.totalFailed > 0) {
    console.log(`\n  ${'─'.repeat(96)}`);
    console.log(`  FAILURE ANALYSIS`);
    console.log(`  ${'─'.repeat(96)}\n`);

    for (const f of result.failures.slice(0, 5)) {
      console.log(`  ${f.vmStatus.slice(0, 50).padEnd(50)} ${formatNumber(f.count).padStart(8)} (${f.percentage.toFixed(1)}%)`);
      if (f.examples.length > 0) {
        console.log(`      Example: ${f.examples[0].slice(0, 20)}...`);
      }
    }
  }

  // Bottlenecks & Recommendations
  console.log(`\n  ${'─'.repeat(96)}`);
  console.log(`  BOTTLENECK ANALYSIS`);
  console.log(`  ${'─'.repeat(96)}\n`);

  console.log(`  Issues Found:`);
  for (const b of result.bottlenecks) {
    console.log(`    ⚠️  ${b}`);
  }

  console.log(`\n  Recommendations:`);
  for (const r of result.recommendations) {
    console.log(`    💡 ${r}`);
  }

  console.log(`\n${'═'.repeat(100)}\n`);

  // Final verdict
  if (result.stableTps >= 5000) {
    console.log(`  🚀 EXCELLENT! Achieved ${formatNumber(Math.round(result.stableTps))} stable TPS!`);
  } else if (result.stableTps >= 1000) {
    console.log(`  ✅ GREAT! Achieved ${formatNumber(Math.round(result.stableTps))} stable TPS`);
  } else if (result.stableTps >= 500) {
    console.log(`  ⚡ GOOD! Achieved ${formatNumber(Math.round(result.stableTps))} stable TPS`);
  } else {
    console.log(`  ⚠️  Moderate TPS: ${formatNumber(Math.round(result.stableTps))} - review bottlenecks above`);
  }

  console.log(`\n  Results saved to: ${HISTORY_DIR}/${result.runId}.json`);
  console.log('');
}

function saveHistory(result: AnalysisResult) {
  // Create history directory if it doesn't exist
  if (!fs.existsSync(HISTORY_DIR)) {
    fs.mkdirSync(HISTORY_DIR, { recursive: true });
  }

  // Save this run
  const outputPath = path.join(HISTORY_DIR, `${result.runId}.json`);
  fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));

  // Update index
  const indexPath = path.join(HISTORY_DIR, 'index.json');
  let index: { runs: Array<{ id: string; timestamp: string; stableTps: number; confirmationRate: number }> } = { runs: [] };

  if (fs.existsSync(indexPath)) {
    try {
      index = JSON.parse(fs.readFileSync(indexPath, 'utf-8'));
    } catch {
      // Ignore parse errors
    }
  }

  index.runs.push({
    id: result.runId,
    timestamp: result.timestamp,
    stableTps: result.stableTps,
    confirmationRate: result.confirmationRate,
  });

  // Keep last 100 runs
  if (index.runs.length > 100) {
    index.runs = index.runs.slice(-100);
  }

  fs.writeFileSync(indexPath, JSON.stringify(index, null, 2));
}

// ============================================
// Main
// ============================================

async function main() {
  const inputFile = process.argv[2] || '/tmp/hft-submitted-txns.json';

  console.log(`\n${'═'.repeat(100)}`);
  console.log(`  DEEP TPS ANALYSIS`);
  console.log(`${'═'.repeat(100)}`);
  console.log(`  Using fullnode: ${FULLNODE_URL}`);

  // Check if file exists
  if (!fs.existsSync(inputFile)) {
    console.error(`\n  ❌ File not found: ${inputFile}`);
    console.error(`\n  Run an HFT demo first to generate transaction data.`);
    console.error(`  The HFT server saves transactions to /tmp/hft-submitted-txns.json when trading stops.\n`);
    process.exit(1);
  }

  // Load data
  console.log(`\n  Loading: ${inputFile}`);
  const rawData = fs.readFileSync(inputFile, 'utf-8');
  const data: SavedData = JSON.parse(rawData);

  console.log(`  Found ${formatNumber(data.transactions.length)} submitted transactions`);
  console.log(`  Time range: ${new Date(data.startTime).toLocaleString()} - ${new Date(data.endTime).toLocaleString()}`);

  if (data.transactions.length === 0) {
    console.error(`\n  ❌ No transactions found in file.\n`);
    process.exit(1);
  }

  // Analyze ALL transactions (no sampling for accuracy)
  let txnsToAnalyze = data.transactions;

  // Only sample if > 20k transactions
  if (data.transactions.length > 20000) {
    console.log(`  Sampling 20,000 transactions for analysis (full set: ${formatNumber(data.transactions.length)})`);
    const step = Math.floor(data.transactions.length / 20000);
    txnsToAnalyze = data.transactions.filter((_, i) => i % step === 0).slice(0, 20000);
  }

  // Fetch on-chain data
  const onChainTxns = await analyzeTransactions(txnsToAnalyze);

  if (onChainTxns.length === 0) {
    console.error(`\n  ❌ Could not verify any transactions on-chain.`);
    console.error(`  Check your fullnode connection: ${FULLNODE_URL}\n`);
    process.exit(1);
  }

  // Analyze blocks
  const blocks = await analyzeBlocks(onChainTxns);

  // Calculate all stats
  console.log(`\n  Calculating statistics...`);

  const successful = onChainTxns.filter(t => t.success);
  const latencies = successful.map(t => t.latencyMs).filter(l => l > 0 && l < 30000);

  const perSecond = calculatePerSecondStats(onChainTxns);
  const perAccount = calculatePerAccountStats(onChainTxns);
  const perMarket = calculatePerMarketStats(onChainTxns);
  const failures = categorizeFailures(onChainTxns);

  // Calculate TPS metrics
  const tpsValues = perSecond.map(s => s.tps).filter(t => t > 0);
  const avgTps = tpsValues.length > 0 ? tpsValues.reduce((a, b) => a + b, 0) / tpsValues.length : 0;
  const peakTps = tpsValues.length > 0 ? Math.max(...tpsValues) : 0;
  const minTps = tpsValues.length > 0 ? Math.min(...tpsValues) : 0;

  // Stable TPS (exclude first and last 20% of the run)
  const warmupEnd = Math.floor(perSecond.length * 0.2);
  const cooldownStart = Math.ceil(perSecond.length * 0.8);
  const stablePeriod = perSecond.slice(warmupEnd, cooldownStart);
  const stableTps = stablePeriod.length > 0
    ? stablePeriod.map(s => s.tps).reduce((a, b) => a + b, 0) / stablePeriod.length
    : avgTps;

  // Duration
  const duration = perSecond.length > 0 ? perSecond.length : (data.endTime - data.startTime) / 1000;

  // Block stats
  const avgTxnsPerBlock = blocks.length > 0
    ? blocks.map(b => b.ourTxns).reduce((a, b) => a + b, 0) / blocks.length
    : 0;
  const maxTxnsPerBlock = blocks.length > 0 ? Math.max(...blocks.map(b => b.ourTxns)) : 0;
  const avgBlockUtilization = blocks.length > 0
    ? blocks.map(b => b.utilization).reduce((a, b) => a + b, 0) / blocks.length
    : 0;

  // Build result
  const runId = `run-${Date.now()}`;

  const result: Partial<AnalysisResult> = {
    runId,
    timestamp: new Date().toISOString(),
    contractAddress: data.contractAddress,
    duration,

    totalSubmitted: onChainTxns.length,
    totalConfirmed: successful.length,
    totalFailed: onChainTxns.length - successful.length,
    confirmationRate: (successful.length / onChainTxns.length) * 100,

    averageTps: avgTps,
    peakTps,
    stableTps,
    minTps,

    avgLatencyMs: latencies.length > 0 ? latencies.reduce((a, b) => a + b, 0) / latencies.length : 0,
    p50LatencyMs: percentile(latencies, 50),
    p95LatencyMs: percentile(latencies, 95),
    p99LatencyMs: percentile(latencies, 99),
    minLatencyMs: latencies.length > 0 ? Math.min(...latencies) : 0,
    maxLatencyMs: latencies.length > 0 ? Math.max(...latencies) : 0,

    perSecond,
    perAccount,
    perMarket,

    blocks,
    avgTxnsPerBlock,
    maxTxnsPerBlock,
    avgBlockUtilization,

    failures,
  };

  // Identify bottlenecks
  const { bottlenecks, recommendations } = identifyBottlenecks(result);
  result.bottlenecks = bottlenecks;
  result.recommendations = recommendations;

  // Print and save
  printResults(result as AnalysisResult);
  saveHistory(result as AnalysisResult);
}

main().catch(console.error);
