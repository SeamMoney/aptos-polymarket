#!/usr/bin/env npx tsx
/**
 * TPS & Performance Analysis Script
 *
 * Analyzes on-chain transaction data including:
 * - TPS (transactions per second)
 * - Gas usage (total, per txn, per second)
 * - Compute units
 * - Output bytes (state changes)
 * - Events emitted
 *
 * Usage:
 *   npx tsx scripts/analyze-tps.ts                    # Last 5 minutes
 *   npx tsx scripts/analyze-tps.ts --minutes 30      # Last 30 minutes
 *   npx tsx scripts/analyze-tps.ts --date "2026-01-06 05:19"  # Specific time (PST)
 *   npx tsx scripts/analyze-tps.ts --block 611854262  # Specific block
 *   npx tsx scripts/analyze-tps.ts --range 611854000 611856000  # Block range
 */

// TPS Optimized Contract (Table + snapshot pattern) - Jan 13, 2026
// Override with CONTRACT_ADDRESS env var if needed
const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS || '0xda51d5f87be27cac0a1d72fe500da145c61b2356547ac811e0cd822c80f99a3b';
const FULLNODE_URL = process.env.FULLNODE_URL || 'https://aptos.cash.trading/v1';

interface Transaction {
  type: string;
  version: string;
  gas_used: string;
  success: boolean;
  payload?: {
    function?: string;
  };
  changes?: Array<{
    type: string;
    data?: unknown;
  }>;
  events?: Array<unknown>;
}

interface BlockInfo {
  block_height: string;
  first_version: string;
  last_version: string;
  block_timestamp: string;
  transactions?: Transaction[];
}

interface BlockAnalysis {
  height: number;
  totalTxns: number;
  ourTxns: number;
  buyOutcome: number;
  sellOutcome: number;
  mintCompleteSet: number;
  timestamp: Date;
  // New metrics
  gasUsed: number;
  avgGasPerTxn: number;
  stateChanges: number;
  outputBytes: number;
  eventsEmitted: number;
  successfulTxns: number;
  failedTxns: number;
}

interface AggregateStats {
  totalBlocks: number;
  totalOurTxns: number;
  totalGasUsed: number;
  totalStateChanges: number;
  totalOutputBytes: number;
  totalEvents: number;
  totalSuccessful: number;
  totalFailed: number;
  durationSeconds: number;
  peakTxnsPerBlock: number;
  peakGasPerBlock: number;
  // Computed rates
  tps: number;
  gasPerSecond: number;
  avgGasPerTxn: number;
  avgTxnsPerBlock: number;
  avgStateChangesPerTxn: number;
  avgOutputBytesPerTxn: number;
  successRate: number;
}

async function getBlockInfo(height: number, withTxns = false): Promise<BlockInfo | null> {
  try {
    const url = `${FULLNODE_URL}/blocks/by_height/${height}?with_transactions=${withTxns}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

async function getCurrentBlockHeight(): Promise<number> {
  const res = await fetch(FULLNODE_URL);
  const data = await res.json();
  return parseInt(data.block_height);
}

async function getBlockHeightAtTime(targetTime: Date): Promise<number> {
  const currentHeight = await getCurrentBlockHeight();
  let low = Math.max(608000000, currentHeight - 10000000);
  let high = currentHeight;

  while (high - low > 100) {
    const mid = Math.floor((low + high) / 2);
    const block = await getBlockInfo(mid);
    if (!block) {
      low = mid + 1;
      continue;
    }
    const blockTime = new Date(parseInt(block.block_timestamp) / 1000);
    if (blockTime < targetTime) {
      low = mid;
    } else {
      high = mid;
    }
  }
  return low;
}

function estimateOutputBytes(changes: Array<{ type: string; data?: unknown }> | undefined): number {
  if (!changes) return 0;
  let bytes = 0;
  for (const change of changes) {
    if (change.data) {
      bytes += JSON.stringify(change.data).length;
    }
  }
  return bytes;
}

async function analyzeBlock(height: number): Promise<BlockAnalysis | null> {
  const block = await getBlockInfo(height, true);
  if (!block || !block.transactions) return null;

  const totalTxns = parseInt(block.last_version) - parseInt(block.first_version) + 1;
  const timestamp = new Date(parseInt(block.block_timestamp) / 1000);

  let buyOutcome = 0, sellOutcome = 0, mintCompleteSet = 0;
  let gasUsed = 0, stateChanges = 0, outputBytes = 0, eventsEmitted = 0;
  let successfulTxns = 0, failedTxns = 0;
  let ourGasUsed = 0;

  for (const tx of block.transactions) {
    if (tx.type !== 'user_transaction') continue;

    const fn = tx.payload?.function || '';
    const isOurs = fn.includes('multi_outcome_market::');

    if (isOurs) {
      const gas = parseInt(tx.gas_used) || 0;
      ourGasUsed += gas;
      stateChanges += tx.changes?.length || 0;
      outputBytes += estimateOutputBytes(tx.changes);
      eventsEmitted += tx.events?.length || 0;

      if (tx.success) successfulTxns++;
      else failedTxns++;

      if (fn.includes('buy_outcome')) buyOutcome++;
      else if (fn.includes('sell_outcome')) sellOutcome++;
      else if (fn.includes('mint_complete_set')) mintCompleteSet++;
    }
  }

  const ourTxns = buyOutcome + sellOutcome + mintCompleteSet;
  if (ourTxns === 0) return null;

  return {
    height,
    totalTxns,
    ourTxns,
    buyOutcome,
    sellOutcome,
    mintCompleteSet,
    timestamp,
    gasUsed: ourGasUsed,
    avgGasPerTxn: ourTxns > 0 ? Math.round(ourGasUsed / ourTxns) : 0,
    stateChanges,
    outputBytes,
    eventsEmitted,
    successfulTxns,
    failedTxns,
  };
}

async function scanBlockRange(
  start: number,
  end: number,
  onProgress?: (pct: number) => void
): Promise<BlockAnalysis[]> {
  const results: BlockAnalysis[] = [];
  const heights: number[] = [];

  for (let h = start; h <= end; h++) heights.push(h);

  const BATCH = 30; // Reduced batch size for more detailed analysis
  for (let i = 0; i < heights.length; i += BATCH) {
    const batch = heights.slice(i, i + BATCH);
    const promises = batch.map(h => analyzeBlock(h));
    const batchResults = await Promise.all(promises);

    for (const r of batchResults) {
      if (r) results.push(r);
    }

    if (onProgress) onProgress(Math.round((i / heights.length) * 100));
  }

  return results.sort((a, b) => a.height - b.height);
}

function computeAggregateStats(results: BlockAnalysis[]): AggregateStats | null {
  if (results.length === 0) return null;

  const totalOurTxns = results.reduce((sum, r) => sum + r.ourTxns, 0);
  const totalGasUsed = results.reduce((sum, r) => sum + r.gasUsed, 0);
  const totalStateChanges = results.reduce((sum, r) => sum + r.stateChanges, 0);
  const totalOutputBytes = results.reduce((sum, r) => sum + r.outputBytes, 0);
  const totalEvents = results.reduce((sum, r) => sum + r.eventsEmitted, 0);
  const totalSuccessful = results.reduce((sum, r) => sum + r.successfulTxns, 0);
  const totalFailed = results.reduce((sum, r) => sum + r.failedTxns, 0);

  const firstTs = results[0].timestamp.getTime();
  const lastTs = results[results.length - 1].timestamp.getTime();
  const durationSeconds = Math.max(1, (lastTs - firstTs) / 1000);

  const peakTxnsPerBlock = Math.max(...results.map(r => r.ourTxns));
  const peakGasPerBlock = Math.max(...results.map(r => r.gasUsed));

  return {
    totalBlocks: results.length,
    totalOurTxns,
    totalGasUsed,
    totalStateChanges,
    totalOutputBytes,
    totalEvents,
    totalSuccessful,
    totalFailed,
    durationSeconds,
    peakTxnsPerBlock,
    peakGasPerBlock,
    // Computed rates
    tps: Math.round(totalOurTxns / durationSeconds),
    gasPerSecond: Math.round(totalGasUsed / durationSeconds),
    avgGasPerTxn: totalOurTxns > 0 ? Math.round(totalGasUsed / totalOurTxns) : 0,
    avgTxnsPerBlock: Math.round(totalOurTxns / results.length),
    avgStateChangesPerTxn: totalOurTxns > 0 ? Math.round((totalStateChanges / totalOurTxns) * 10) / 10 : 0,
    avgOutputBytesPerTxn: totalOurTxns > 0 ? Math.round(totalOutputBytes / totalOurTxns) : 0,
    successRate: totalOurTxns > 0 ? Math.round((totalSuccessful / totalOurTxns) * 1000) / 10 : 0,
  };
}

function formatNumber(n: number): string {
  return n.toLocaleString();
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function printResults(results: BlockAnalysis[], title: string) {
  console.log(`\n${'═'.repeat(90)}`);
  console.log(`  ${title}`);
  console.log(`${'═'.repeat(90)}\n`);

  if (results.length === 0) {
    console.log('  No transactions found from our contract in this range.\n');
    return;
  }

  // Sort by ourTxns descending for top blocks
  const sortedByTxns = [...results].sort((a, b) => b.ourTxns - a.ourTxns);

  // Top 10 blocks by transaction count
  console.log('  TOP 10 BLOCKS BY TRANSACTION COUNT:\n');
  console.log('  Block        | Txns | Gas Used  | Gas/Txn | Changes | Output    | Events | Success%');
  console.log('  ' + '-'.repeat(88));

  for (const r of sortedByTxns.slice(0, 10)) {
    const successPct = r.ourTxns > 0 ? Math.round((r.successfulTxns / r.ourTxns) * 100) : 0;
    console.log(
      `  ${r.height.toString().padStart(12)} | ` +
      `${r.ourTxns.toString().padStart(4)} | ` +
      `${formatNumber(r.gasUsed).padStart(9)} | ` +
      `${r.avgGasPerTxn.toString().padStart(7)} | ` +
      `${r.stateChanges.toString().padStart(7)} | ` +
      `${formatBytes(r.outputBytes).padStart(9)} | ` +
      `${r.eventsEmitted.toString().padStart(6)} | ` +
      `${successPct}%`
    );
  }

  // Aggregate stats
  const stats = computeAggregateStats(results);
  if (!stats) return;

  console.log(`\n  ${'═'.repeat(88)}`);
  console.log('  AGGREGATE PERFORMANCE METRICS');
  console.log(`  ${'═'.repeat(88)}\n`);

  // Transaction metrics
  console.log('  TRANSACTIONS:');
  console.log(`    Total Transactions:      ${formatNumber(stats.totalOurTxns).padStart(15)}`);
  console.log(`    Successful:              ${formatNumber(stats.totalSuccessful).padStart(15)} (${stats.successRate}%)`);
  console.log(`    Failed:                  ${formatNumber(stats.totalFailed).padStart(15)}`);
  console.log(`    Duration:                ${stats.durationSeconds.toFixed(1).padStart(15)} seconds`);
  console.log(`    Blocks with our txns:    ${formatNumber(stats.totalBlocks).padStart(15)}`);

  console.log('\n  THROUGHPUT:');
  console.log(`    TPS (avg):               ${formatNumber(stats.tps).padStart(15)} txns/sec`);
  console.log(`    Peak TPS (single block): ${formatNumber(Math.round(stats.peakTxnsPerBlock * 10.6)).padStart(15)} txns/sec`);
  console.log(`    Avg Txns/Block:          ${formatNumber(stats.avgTxnsPerBlock).padStart(15)} txns/block`);
  console.log(`    Peak Txns/Block:         ${formatNumber(stats.peakTxnsPerBlock).padStart(15)} txns/block`);

  console.log('\n  GAS METRICS:');
  console.log(`    Total Gas Used:          ${formatNumber(stats.totalGasUsed).padStart(15)} gas units`);
  console.log(`    Gas/Second:              ${formatNumber(stats.gasPerSecond).padStart(15)} gas/sec`);
  console.log(`    Avg Gas/Transaction:     ${formatNumber(stats.avgGasPerTxn).padStart(15)} gas/txn`);
  console.log(`    Peak Gas/Block:          ${formatNumber(stats.peakGasPerBlock).padStart(15)} gas/block`);

  console.log('\n  STATE & OUTPUT:');
  console.log(`    Total State Changes:     ${formatNumber(stats.totalStateChanges).padStart(15)}`);
  console.log(`    Avg Changes/Transaction: ${stats.avgStateChangesPerTxn.toFixed(1).padStart(15)}`);
  console.log(`    Total Output Bytes:      ${formatBytes(stats.totalOutputBytes).padStart(15)}`);
  console.log(`    Avg Output/Transaction:  ${formatBytes(stats.avgOutputBytesPerTxn).padStart(15)}`);
  console.log(`    Total Events Emitted:    ${formatNumber(stats.totalEvents).padStart(15)}`);

  // Time range
  const firstTime = results[0].timestamp.toLocaleString('en-US', {
    month: 'numeric', day: 'numeric', hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true
  });
  const lastTime = results[results.length - 1].timestamp.toLocaleString('en-US', {
    month: 'numeric', day: 'numeric', hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true
  });

  console.log(`\n  TIME RANGE: ${firstTime} → ${lastTime}`);
  console.log(`${'═'.repeat(90)}\n`);

  // JSON output for programmatic use
  if (process.argv.includes('--json')) {
    console.log('\n--- JSON OUTPUT ---');
    console.log(JSON.stringify({
      title,
      timestamp: new Date().toISOString(),
      metrics: stats,
      topBlocks: sortedByTxns.slice(0, 10).map(r => ({
        block: r.height,
        txns: r.ourTxns,
        gasUsed: r.gasUsed,
        avgGasPerTxn: r.avgGasPerTxn,
        stateChanges: r.stateChanges,
        outputBytes: r.outputBytes,
        events: r.eventsEmitted,
        successRate: r.ourTxns > 0 ? (r.successfulTxns / r.ourTxns) : 0,
        timestamp: r.timestamp.toISOString(),
      })),
    }, null, 2));
  }
}

async function main() {
  const args = process.argv.slice(2);

  let startBlock: number, endBlock: number, title: string;

  if (args.includes('--block')) {
    const blockIdx = args.indexOf('--block');
    const block = parseInt(args[blockIdx + 1]);
    startBlock = block - 50;
    endBlock = block + 50;
    title = `ANALYSIS: Block ${block} ± 50`;
  } else if (args.includes('--range')) {
    const rangeIdx = args.indexOf('--range');
    startBlock = parseInt(args[rangeIdx + 1]);
    endBlock = parseInt(args[rangeIdx + 2]);
    title = `ANALYSIS: Blocks ${startBlock.toLocaleString()} - ${endBlock.toLocaleString()}`;
  } else if (args.includes('--date')) {
    const dateIdx = args.indexOf('--date');
    const dateStr = args[dateIdx + 1];
    const targetTime = new Date(dateStr);
    console.log(`\nFinding block at ${targetTime.toLocaleString()}...`);
    const midBlock = await getBlockHeightAtTime(targetTime);
    startBlock = midBlock - 500;
    endBlock = midBlock + 500;
    title = `ANALYSIS: Around ${targetTime.toLocaleString()}`;
  } else {
    const minutes = args.includes('--minutes')
      ? parseInt(args[args.indexOf('--minutes') + 1])
      : 5;

    const currentHeight = await getCurrentBlockHeight();
    const blocksBack = Math.round(minutes * 60 * 10.6);
    startBlock = currentHeight - blocksBack;
    endBlock = currentHeight;
    title = `ANALYSIS: Last ${minutes} minutes`;
  }

  console.log(`\nScanning blocks ${startBlock.toLocaleString()} to ${endBlock.toLocaleString()}...`);

  const results = await scanBlockRange(startBlock, endBlock, (pct) => {
    process.stdout.write(`\r  Progress: ${pct}%   `);
  });

  process.stdout.write('\r                    \r');
  printResults(results, title);
}

main().catch(console.error);
