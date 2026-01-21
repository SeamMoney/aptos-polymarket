/**
 * Ralphy Analytics - Comprehensive analytics from verified transaction data
 *
 * Generates detailed analytics reports including:
 * - TPS percentiles (p50, p95, p99)
 * - Latency distribution (submit → confirm)
 * - Per-account and per-worker breakdowns
 * - Error timeline and categorization
 * - Server vs on-chain reconciliation
 */

import fs from 'fs';
import path from 'path';
import { VerifiedRecord, ANALYTICS_DIR, STATE_DIR } from './ralphy-collector';
import { VerificationState, loadVerificationState } from './ralphy-verifier';

/**
 * Per-second timeline entry
 */
export interface TimelineEntry {
  second: number;                 // Unix second
  submitted: number;              // Hashes submitted in this second
  confirmed: number;              // On-chain confirms in this second
  failed: number;
  dropped: number;
}

/**
 * Latency distribution bucket
 */
export interface LatencyBucket {
  bucketMs: number;               // Lower bound (0, 100, 200, ...)
  count: number;
}

/**
 * Per-account statistics
 */
export interface AccountStats {
  address: string;
  accountIndex: number;
  submitted: number;
  confirmed: number;
  failed: number;
  dropped: number;
  avgLatencyMs: number;
}

/**
 * Per-worker statistics
 */
export interface WorkerStats {
  workerId: number;
  submitted: number;
  confirmed: number;
  failed: number;
  dropped: number;
  avgTps: number;
  peakTps: number;
}

/**
 * Error sample
 */
export interface ErrorSample {
  hash: string;
  error: string;
  timestamp: number;
}

/**
 * Comprehensive analytics report
 */
export interface AnalyticsReport {
  demoId: string;
  generatedAt: string;

  summary: {
    totalSubmitted: number;
    confirmed: number;
    failed: number;
    dropped: number;
    successRate: number;          // confirmed / totalSubmitted * 100

    peakTps: number;              // Max per-second confirmed
    avgTps: number;               // Total / duration
    medianTps: number;            // p50 per-second TPS
    p95Tps: number;               // 95th percentile per-second
    p99Tps: number;               // 99th percentile per-second

    durationSec: number;          // From first submit to last confirm
    verificationPasses: number;
    qualityGatePassed: boolean;
  };

  timeline: {
    seconds: TimelineEntry[];
    movingAvg5s: number[];
    movingAvg10s: number[];
  };

  latency: {
    p50Ms: number;
    p95Ms: number;
    p99Ms: number;
    maxMs: number;
    avgMs: number;
    distribution: LatencyBucket[];
  };

  perAccount: AccountStats[];
  perWorker: WorkerStats[];

  errors: {
    categories: Record<string, number>;
    timeline: Array<{ second: number; category: string; count: number }>;
    samples: ErrorSample[];
  };

  reconciliation: {
    serverClaimed: number;        // Sum of submitSuccess=true
    onChainConfirmed: number;
    discrepancy: number;          // % difference
    overcounted: number;          // Server said success but failed/dropped
    undercounted: number;         // Server said failed but actually confirmed
  };
}

/**
 * Generate comprehensive analytics report
 */
export async function generateAnalyticsReport(
  demoId: string,
  verifiedRecords: VerifiedRecord[],
  serverClaimedSuccess?: number
): Promise<AnalyticsReport> {
  if (verifiedRecords.length === 0) {
    throw new Error('No verified records to analyze');
  }

  // Load verification state for metadata
  const state = loadVerificationState(demoId);

  // Categorize records
  const confirmed = verifiedRecords.filter(r => r.verification?.status === 'confirmed');
  const failed = verifiedRecords.filter(r => r.verification?.status === 'failed');
  const dropped = verifiedRecords.filter(r => r.verification?.status === 'dropped');

  // Calculate timeline
  const timeline = calculateTimeline(verifiedRecords);

  // Calculate TPS percentiles
  const tpsValues = timeline.seconds.map(t => t.confirmed).filter(t => t > 0);
  tpsValues.sort((a, b) => a - b);

  // Calculate latency distribution (submit → confirm)
  const latencies = calculateLatencies(confirmed);

  // Per-account stats
  const perAccount = calculatePerAccountStats(verifiedRecords);

  // Per-worker stats
  const perWorker = calculatePerWorkerStats(verifiedRecords, timeline);

  // Error analysis
  const errors = analyzeErrors(verifiedRecords);

  // Duration calculation
  const submitTimes = verifiedRecords.map(r => r.submitTime).filter(t => t > 0);
  const confirmTimes = confirmed
    .map(r => r.verification?.onChainTimestamp)
    .filter((t): t is number => t !== undefined && t > 0);

  const firstSubmit = Math.min(...submitTimes);
  const lastConfirm = confirmTimes.length > 0
    ? Math.max(...confirmTimes) / 1_000_000 * 1000  // Convert microseconds to ms
    : Math.max(...submitTimes);

  const durationSec = (lastConfirm - firstSubmit) / 1000;

  // Reconciliation
  const serverClaimed = serverClaimedSuccess ?? verifiedRecords.filter(r => r.submitSuccess).length;
  const overcounted = verifiedRecords.filter(
    r => r.submitSuccess && (r.verification?.status === 'failed' || r.verification?.status === 'dropped')
  ).length;
  const undercounted = verifiedRecords.filter(
    r => !r.submitSuccess && r.verification?.status === 'confirmed'
  ).length;

  const report: AnalyticsReport = {
    demoId,
    generatedAt: new Date().toISOString(),

    summary: {
      totalSubmitted: verifiedRecords.length,
      confirmed: confirmed.length,
      failed: failed.length,
      dropped: dropped.length,
      successRate: (confirmed.length / verifiedRecords.length) * 100,

      peakTps: tpsValues.length > 0 ? Math.max(...tpsValues) : 0,
      avgTps: durationSec > 0 ? confirmed.length / durationSec : 0,
      medianTps: percentile(tpsValues, 50),
      p95Tps: percentile(tpsValues, 95),
      p99Tps: percentile(tpsValues, 99),

      durationSec,
      verificationPasses: state?.currentAttempt || 1,
      qualityGatePassed: state?.qualityGatePassed || false,
    },

    timeline,

    latency: {
      p50Ms: percentile(latencies, 50),
      p95Ms: percentile(latencies, 95),
      p99Ms: percentile(latencies, 99),
      maxMs: latencies.length > 0 ? Math.max(...latencies) : 0,
      avgMs: latencies.length > 0 ? latencies.reduce((a, b) => a + b, 0) / latencies.length : 0,
      distribution: calculateLatencyDistribution(latencies),
    },

    perAccount,
    perWorker,
    errors,

    reconciliation: {
      serverClaimed,
      onChainConfirmed: confirmed.length,
      discrepancy: serverClaimed > 0
        ? ((serverClaimed - confirmed.length) / serverClaimed) * 100
        : 0,
      overcounted,
      undercounted,
    },
  };

  return report;
}

/**
 * Calculate per-second timeline
 */
function calculateTimeline(records: VerifiedRecord[]): {
  seconds: TimelineEntry[];
  movingAvg5s: number[];
  movingAvg10s: number[];
} {
  // Group by second
  const secondMap = new Map<number, TimelineEntry>();

  for (const record of records) {
    // Submission time (client-side, ms → second)
    if (record.submitTime > 0) {
      const submitSecond = Math.floor(record.submitTime / 1000);
      if (!secondMap.has(submitSecond)) {
        secondMap.set(submitSecond, { second: submitSecond, submitted: 0, confirmed: 0, failed: 0, dropped: 0 });
      }
      secondMap.get(submitSecond)!.submitted++;
    }

    // On-chain timestamp (microseconds → second)
    if (record.verification?.status === 'confirmed' && record.verification.onChainTimestamp) {
      const confirmSecond = Math.floor(record.verification.onChainTimestamp / 1_000_000);
      if (!secondMap.has(confirmSecond)) {
        secondMap.set(confirmSecond, { second: confirmSecond, submitted: 0, confirmed: 0, failed: 0, dropped: 0 });
      }
      secondMap.get(confirmSecond)!.confirmed++;
    }

    if (record.verification?.status === 'failed' && record.verification.onChainTimestamp) {
      const failSecond = Math.floor(record.verification.onChainTimestamp / 1_000_000);
      if (!secondMap.has(failSecond)) {
        secondMap.set(failSecond, { second: failSecond, submitted: 0, confirmed: 0, failed: 0, dropped: 0 });
      }
      secondMap.get(failSecond)!.failed++;
    }
  }

  // Sort by second
  const seconds = Array.from(secondMap.values()).sort((a, b) => a.second - b.second);

  // Calculate moving averages
  const movingAvg5s = calculateMovingAverage(seconds.map(s => s.confirmed), 5);
  const movingAvg10s = calculateMovingAverage(seconds.map(s => s.confirmed), 10);

  return { seconds, movingAvg5s, movingAvg10s };
}

/**
 * Calculate latencies (submit time → confirm time) in milliseconds
 */
function calculateLatencies(confirmedRecords: VerifiedRecord[]): number[] {
  const latencies: number[] = [];

  for (const record of confirmedRecords) {
    if (record.submitTime > 0 && record.verification?.onChainTimestamp) {
      // submitTime is in ms, onChainTimestamp is in microseconds
      const confirmMs = record.verification.onChainTimestamp / 1000;
      const latencyMs = confirmMs - record.submitTime;

      // Only include positive latencies (negative would indicate clock skew)
      if (latencyMs > 0 && latencyMs < 60000) {  // Cap at 60s
        latencies.push(latencyMs);
      }
    }
  }

  latencies.sort((a, b) => a - b);
  return latencies;
}

/**
 * Calculate latency distribution in 100ms buckets
 */
function calculateLatencyDistribution(latencies: number[]): LatencyBucket[] {
  const buckets = new Map<number, number>();

  for (const latency of latencies) {
    const bucket = Math.floor(latency / 100) * 100;
    buckets.set(bucket, (buckets.get(bucket) || 0) + 1);
  }

  return Array.from(buckets.entries())
    .map(([bucketMs, count]) => ({ bucketMs, count }))
    .sort((a, b) => a.bucketMs - b.bucketMs);
}

/**
 * Calculate per-account statistics
 */
function calculatePerAccountStats(records: VerifiedRecord[]): AccountStats[] {
  const accountMap = new Map<string, {
    address: string;
    accountIndex: number;
    submitted: number;
    confirmed: number;
    failed: number;
    dropped: number;
    latencies: number[];
  }>();

  for (const record of records) {
    const key = record.sender;
    if (!accountMap.has(key)) {
      accountMap.set(key, {
        address: record.sender,
        accountIndex: record.accountIndex,
        submitted: 0,
        confirmed: 0,
        failed: 0,
        dropped: 0,
        latencies: [],
      });
    }

    const stats = accountMap.get(key)!;
    stats.submitted++;

    switch (record.verification?.status) {
      case 'confirmed':
        stats.confirmed++;
        // Calculate latency
        if (record.submitTime > 0 && record.verification.onChainTimestamp) {
          const confirmMs = record.verification.onChainTimestamp / 1000;
          const latencyMs = confirmMs - record.submitTime;
          if (latencyMs > 0 && latencyMs < 60000) {
            stats.latencies.push(latencyMs);
          }
        }
        break;
      case 'failed':
        stats.failed++;
        break;
      case 'dropped':
        stats.dropped++;
        break;
    }
  }

  return Array.from(accountMap.values())
    .map(stats => ({
      address: stats.address,
      accountIndex: stats.accountIndex,
      submitted: stats.submitted,
      confirmed: stats.confirmed,
      failed: stats.failed,
      dropped: stats.dropped,
      avgLatencyMs: stats.latencies.length > 0
        ? stats.latencies.reduce((a, b) => a + b, 0) / stats.latencies.length
        : 0,
    }))
    .sort((a, b) => a.accountIndex - b.accountIndex);
}

/**
 * Calculate per-worker statistics
 */
function calculatePerWorkerStats(
  records: VerifiedRecord[],
  timeline: { seconds: TimelineEntry[] }
): WorkerStats[] {
  const workerMap = new Map<number, {
    submitted: number;
    confirmed: number;
    failed: number;
    dropped: number;
    confirmTimes: number[];  // Seconds when confirms happened
  }>();

  for (const record of records) {
    const workerId = record.workerIndex;
    if (!workerMap.has(workerId)) {
      workerMap.set(workerId, {
        submitted: 0,
        confirmed: 0,
        failed: 0,
        dropped: 0,
        confirmTimes: [],
      });
    }

    const stats = workerMap.get(workerId)!;
    stats.submitted++;

    switch (record.verification?.status) {
      case 'confirmed':
        stats.confirmed++;
        if (record.verification.onChainTimestamp) {
          stats.confirmTimes.push(Math.floor(record.verification.onChainTimestamp / 1_000_000));
        }
        break;
      case 'failed':
        stats.failed++;
        break;
      case 'dropped':
        stats.dropped++;
        break;
    }
  }

  // Calculate per-worker TPS
  return Array.from(workerMap.entries())
    .map(([workerId, stats]) => {
      // Calculate per-second TPS for this worker
      const secondCounts = new Map<number, number>();
      for (const second of stats.confirmTimes) {
        secondCounts.set(second, (secondCounts.get(second) || 0) + 1);
      }

      const tpsValues = Array.from(secondCounts.values());
      const durationSec = stats.confirmTimes.length > 0
        ? Math.max(...stats.confirmTimes) - Math.min(...stats.confirmTimes) + 1
        : 1;

      return {
        workerId,
        submitted: stats.submitted,
        confirmed: stats.confirmed,
        failed: stats.failed,
        dropped: stats.dropped,
        avgTps: durationSec > 0 ? stats.confirmed / durationSec : 0,
        peakTps: tpsValues.length > 0 ? Math.max(...tpsValues) : 0,
      };
    })
    .sort((a, b) => a.workerId - b.workerId);
}

/**
 * Analyze errors
 */
function analyzeErrors(records: VerifiedRecord[]): {
  categories: Record<string, number>;
  timeline: Array<{ second: number; category: string; count: number }>;
  samples: ErrorSample[];
} {
  const categories = new Map<string, number>();
  const timelineMap = new Map<string, number>();  // "second:category" → count
  const samples: ErrorSample[] = [];

  const failedOrDropped = records.filter(
    r => r.verification?.status === 'failed' || r.verification?.status === 'dropped'
  );

  for (const record of failedOrDropped) {
    // Categorize error
    let category = 'unknown';
    const error = record.error || record.verification?.vmStatus || '';

    if (error.includes('sequence') || error.includes('SEQUENCE_NUMBER')) {
      category = 'sequence_number';
    } else if (error.includes('timeout') || error.includes('TIMEOUT')) {
      category = 'timeout';
    } else if (error.includes('mempool') || error.includes('MEMPOOL')) {
      category = 'mempool_full';
    } else if (error.includes('gas') || error.includes('GAS')) {
      category = 'out_of_gas';
    } else if (record.verification?.status === 'dropped') {
      category = 'dropped';
    }

    categories.set(category, (categories.get(category) || 0) + 1);

    // Timeline
    const second = Math.floor(record.submitTime / 1000);
    const key = `${second}:${category}`;
    timelineMap.set(key, (timelineMap.get(key) || 0) + 1);

    // Samples (first 10 of each category)
    if (samples.filter(s => s.error === category).length < 10) {
      samples.push({
        hash: record.hash,
        error: category,
        timestamp: record.submitTime,
      });
    }
  }

  // Convert timeline
  const timeline: Array<{ second: number; category: string; count: number }> = [];
  for (const [key, count] of timelineMap.entries()) {
    const [secondStr, category] = key.split(':');
    timeline.push({ second: parseInt(secondStr, 10), category, count });
  }
  timeline.sort((a, b) => a.second - b.second);

  return {
    categories: Object.fromEntries(categories),
    timeline,
    samples,
  };
}

/**
 * Calculate percentile from sorted array
 */
function percentile(sortedArr: number[], p: number): number {
  if (sortedArr.length === 0) return 0;

  const index = Math.ceil((p / 100) * sortedArr.length) - 1;
  return sortedArr[Math.max(0, Math.min(index, sortedArr.length - 1))];
}

/**
 * Calculate moving average
 */
function calculateMovingAverage(values: number[], window: number): number[] {
  const result: number[] = [];

  for (let i = 0; i < values.length; i++) {
    const start = Math.max(0, i - window + 1);
    const windowValues = values.slice(start, i + 1);
    const avg = windowValues.reduce((a, b) => a + b, 0) / windowValues.length;
    result.push(avg);
  }

  return result;
}

/**
 * Save analytics report to file
 */
export function saveAnalyticsReport(report: AnalyticsReport): string {
  // Ensure directory exists
  if (!fs.existsSync(ANALYTICS_DIR)) {
    fs.mkdirSync(ANALYTICS_DIR, { recursive: true });
  }

  const filename = `${report.demoId}-report.json`;
  const filepath = path.join(ANALYTICS_DIR, filename);

  fs.writeFileSync(filepath, JSON.stringify(report, null, 2));

  return filepath;
}

/**
 * Load analytics report from file
 */
export function loadAnalyticsReport(demoId: string): AnalyticsReport | null {
  const filepath = path.join(ANALYTICS_DIR, `${demoId}-report.json`);

  if (!fs.existsSync(filepath)) {
    return null;
  }

  return JSON.parse(fs.readFileSync(filepath, 'utf8'));
}

/**
 * Format analytics report for CLI output
 */
export function formatAnalyticsForCLI(report: AnalyticsReport): string {
  const lines: string[] = [];

  // Summary
  lines.push('');
  lines.push('  THROUGHPUT (Ground Truth)');
  lines.push('  ' + '─'.repeat(45));
  lines.push(`  Peak TPS:         ${report.summary.peakTps.toLocaleString()}`);
  lines.push(`  Average TPS:      ${report.summary.avgTps.toFixed(1)}`);
  lines.push(`  Median TPS:       ${report.summary.medianTps.toLocaleString()}`);
  lines.push(`  P95 TPS:          ${report.summary.p95Tps.toLocaleString()}`);
  lines.push(`  P99 TPS:          ${report.summary.p99Tps.toLocaleString()}`);
  lines.push('');

  // Latency
  lines.push('  LATENCY (Submit → Confirm)');
  lines.push('  ' + '─'.repeat(45));
  lines.push(`  P50:              ${Math.round(report.latency.p50Ms)}ms`);
  lines.push(`  P95:              ${Math.round(report.latency.p95Ms)}ms`);
  lines.push(`  P99:              ${Math.round(report.latency.p99Ms)}ms`);
  lines.push(`  Max:              ${Math.round(report.latency.maxMs)}ms`);
  lines.push('');

  // Per-worker (top 4)
  if (report.perWorker.length > 0) {
    lines.push('  PER-WORKER BREAKDOWN');
    lines.push('  ' + '─'.repeat(45));
    for (const worker of report.perWorker.slice(0, 4)) {
      const successRate = worker.submitted > 0
        ? ((worker.confirmed / worker.submitted) * 100).toFixed(1)
        : '0.0';
      lines.push(`  Worker ${worker.workerId}:   ${worker.confirmed.toLocaleString()} confirmed (${successRate}%), avg ${worker.avgTps.toFixed(0)} TPS`);
    }
    lines.push('');
  }

  // Errors
  if (Object.keys(report.errors.categories).length > 0) {
    lines.push('  ERROR ANALYSIS');
    lines.push('  ' + '─'.repeat(45));
    const totalErrors = Object.values(report.errors.categories).reduce((a, b) => a + b, 0);
    for (const [category, count] of Object.entries(report.errors.categories).sort((a, b) => b[1] - a[1])) {
      const pct = ((count / totalErrors) * 100).toFixed(0);
      lines.push(`  ${category}:`.padEnd(22) + `${count.toLocaleString()} (${pct}%)`);
    }
    lines.push('');
  }

  // Reconciliation
  lines.push('  RECONCILIATION');
  lines.push('  ' + '─'.repeat(45));
  lines.push(`  Server claimed:     ${report.reconciliation.serverClaimed.toLocaleString()} successful`);
  lines.push(`  On-chain confirmed: ${report.reconciliation.onChainConfirmed.toLocaleString()}`);

  const discrepancyStr = report.reconciliation.discrepancy >= 0
    ? `${report.reconciliation.discrepancy.toFixed(1)}% (server over-reported)`
    : `${Math.abs(report.reconciliation.discrepancy).toFixed(1)}% (server under-reported)`;
  lines.push(`  Discrepancy:        ${discrepancyStr}`);
  lines.push('');

  return lines.join('\n');
}
