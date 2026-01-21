#!/usr/bin/env npx tsx
/**
 * Ralphy Resume - Resume interrupted TPS verification
 *
 * Resumes verification from a previous demo's persisted state, allowing
 * recovery from crashes or network interruptions.
 *
 * Usage:
 *   npx tsx scripts/ralphy-resume.ts --demo-id <demo-id>
 *   npx tsx scripts/ralphy-resume.ts --list
 *   npx tsx scripts/ralphy-resume.ts --latest
 *
 * Options:
 *   --demo-id <id>  Resume verification for specific demo ID
 *   --list          List all available demo IDs
 *   --latest        Resume the most recent demo
 *   --analytics     Generate analytics report only (skip verification)
 */

import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import {
  listDemoIds,
  loadHashesFromFile,
  getHashCount,
  ANALYTICS_DIR,
} from '../lib/ralphy-collector';
import {
  RalphyVerifier,
  loadVerificationState,
  isVerificationComplete,
} from '../lib/ralphy-verifier';
import { generateAnalyticsReport } from '../lib/ralphy-analytics';

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
};

// Parse command line arguments
const args = process.argv.slice(2);
const listOnly = args.includes('--list');
const useLatest = args.includes('--latest');
const analyticsOnly = args.includes('--analytics');
const demoIdIndex = args.indexOf('--demo-id');
const demoId = demoIdIndex >= 0 ? args[demoIdIndex + 1] : null;

function printHeader(title: string): void {
  console.log('');
  console.log(`${c.blue}${'═'.repeat(70)}${c.reset}`);
  console.log(`${c.blue}  ${title}${c.reset}`);
  console.log(`${c.blue}${'═'.repeat(70)}${c.reset}`);
}

function printSuccess(msg: string): void {
  console.log(`  ${c.green}✓${c.reset} ${msg}`);
}

function printError(msg: string): void {
  console.log(`  ${c.red}✗${c.reset} ${msg}`);
}

function printWarning(msg: string): void {
  console.log(`  ${c.yellow}⚠${c.reset} ${msg}`);
}

function printInfo(msg: string): void {
  console.log(`  ${c.cyan}ℹ${c.reset} ${msg}`);
}

async function listDemos(): Promise<void> {
  printHeader('AVAILABLE DEMOS');

  const demos = listDemoIds();

  if (demos.length === 0) {
    printWarning('No demo hash files found');
    printInfo('Run a TPS demo first to generate hash files');
    return;
  }

  console.log('');
  console.log(`  ${c.bold}Demo ID${' '.repeat(35)}Hashes    Status${c.reset}`);
  console.log(`  ${'─'.repeat(65)}`);

  for (const id of demos) {
    try {
      const count = await getHashCount(id);
      const isComplete = isVerificationComplete(id);
      const state = loadVerificationState(id);

      let statusStr = '';
      if (isComplete) {
        statusStr = `${c.green}Complete${c.reset}`;
        if (state) {
          statusStr += ` (${state.confirmed} confirmed)`;
        }
      } else if (state) {
        const progress = Math.round(((state.confirmed + state.failed + state.dropped) / state.totalHashes) * 100);
        statusStr = `${c.yellow}${progress}% verified${c.reset}`;
      } else {
        statusStr = `${c.cyan}Pending${c.reset}`;
      }

      console.log(`  ${id.padEnd(42)} ${count.toString().padStart(8)}    ${statusStr}`);
    } catch (err) {
      console.log(`  ${id.padEnd(42)} ${c.red}Error${c.reset}`);
    }
  }

  console.log('');
  printInfo(`Use --demo-id <id> to resume verification`);
  printInfo(`Use --latest to resume the most recent demo`);
}

async function resumeVerification(targetDemoId: string): Promise<void> {
  printHeader('RALPHY RESUME VERIFICATION');

  // Check if demo exists
  const demos = listDemoIds();
  if (!demos.includes(targetDemoId)) {
    printError(`Demo ID not found: ${targetDemoId}`);
    printInfo('Use --list to see available demos');
    process.exit(1);
  }

  // Get hash count
  const hashCount = await getHashCount(targetDemoId);
  printInfo(`Demo ID: ${c.bold}${targetDemoId}${c.reset}`);
  printInfo(`Hashes: ${c.cyan}${hashCount.toLocaleString()}${c.reset}`);

  // Check current state
  const existingState = loadVerificationState(targetDemoId);
  if (existingState) {
    console.log('');
    console.log(`  ${c.bold}Existing Progress${c.reset}`);
    console.log(`  ${'─'.repeat(50)}`);
    console.log(`  Confirmed:  ${c.green}${existingState.confirmed.toLocaleString()}${c.reset}`);
    console.log(`  Failed:     ${c.red}${existingState.failed.toLocaleString()}${c.reset}`);
    console.log(`  Dropped:    ${c.yellow}${existingState.dropped.toLocaleString()}${c.reset}`);
    console.log(`  Pending:    ${existingState.pending.toLocaleString()}`);
    console.log(`  Unknown:    ${existingState.unknown.toLocaleString()}`);
    console.log(`  Passes:     ${existingState.currentAttempt}`);

    if (existingState.qualityGatePassed) {
      printSuccess('Verification already complete!');

      if (analyticsOnly) {
        await generateAnalyticsForDemo(targetDemoId);
      }
      return;
    }

    console.log('');
    printInfo('Resuming from existing state...');
  }

  // Initialize verifier
  const verifier = new RalphyVerifier({
    maxAttempts: 5,
    initialBackoffMs: 3000,
    backoffMultiplier: 2,
    maxBackoffMs: 30000,
    batchSize: 50,
    concurrency: 10,
    network: 'testnet',
    rpcEndpoint: 'https://api.testnet.aptoslabs.com/v1',
  });

  // Resume or init
  if (existingState) {
    await verifier.resume(targetDemoId);
  } else {
    await verifier.init(targetDemoId);
  }

  // Set up progress callback
  verifier.setProgressCallback((pass, maxPasses, processed, total, passStats) => {
    const progress = Math.round((processed / total) * 100);
    process.stdout.write(
      `\r  Pass ${pass}/${maxPasses}: ${progress}% | ` +
      `${c.green}${passStats.confirmed}${c.reset} confirmed, ` +
      `${c.red}${passStats.failed}${c.reset} failed, ` +
      `${c.yellow}${passStats.pending + passStats.unknown}${c.reset} pending`
    );
  });

  // Run verification loop
  console.log('');
  console.log(`  ${c.bold}Running verification loop...${c.reset}`);
  console.log('');

  const summary = await verifier.runLoop();

  console.log(''); // New line after progress

  // Display results
  console.log('');
  console.log(`  ${c.bold}Verification Complete${c.reset}`);
  console.log(`  ${'─'.repeat(50)}`);
  console.log(`  Total hashes:   ${c.cyan}${summary.totalHashes.toLocaleString()}${c.reset}`);
  console.log(`  Confirmed:      ${c.green}${summary.confirmed.toLocaleString()}${c.reset} (${((summary.confirmed / summary.totalHashes) * 100).toFixed(1)}%)`);
  console.log(`  Failed:         ${c.red}${summary.failed.toLocaleString()}${c.reset} (${((summary.failed / summary.totalHashes) * 100).toFixed(1)}%)`);
  console.log(`  Dropped:        ${c.yellow}${summary.dropped.toLocaleString()}${c.reset} (${((summary.dropped / summary.totalHashes) * 100).toFixed(1)}%)`);
  console.log(`  Passes:         ${summary.passes}`);
  console.log(`  Quality gate:   ${summary.qualityGatePassed ? `${c.green}PASSED${c.reset}` : `${c.red}FAILED${c.reset}`}`);
  console.log(`  Duration:       ${(summary.durationMs / 1000).toFixed(1)}s`);
  console.log('');

  if (summary.qualityGatePassed) {
    printSuccess('All hashes resolved - verification complete!');
    await generateAnalyticsForDemo(targetDemoId);
  } else {
    printWarning('Quality gate not passed - some hashes may be unresolved');
    printInfo('Run again to retry unresolved hashes');
  }
}

async function generateAnalyticsForDemo(targetDemoId: string): Promise<void> {
  printHeader('GENERATING ANALYTICS REPORT');

  try {
    // Load verified records
    const verifier = new RalphyVerifier({ network: 'testnet' });
    await verifier.resume(targetDemoId);
    const verifiedRecords = verifier.getVerifiedRecords();

    printInfo(`Processing ${verifiedRecords.length} verified records...`);

    // Generate analytics
    const analytics = await generateAnalyticsReport(targetDemoId, verifiedRecords);

    // Display summary
    console.log('');
    console.log(`  ${c.bold}Throughput Summary${c.reset}`);
    console.log(`  ${'─'.repeat(50)}`);
    console.log(`  Peak TPS:     ${c.green}${analytics.summary.peakTps.toLocaleString()}${c.reset}`);
    console.log(`  Average TPS:  ${analytics.summary.avgTps.toLocaleString()}`);
    console.log(`  Median TPS:   ${analytics.summary.medianTps.toLocaleString()}`);
    console.log(`  P95 TPS:      ${analytics.summary.p95Tps.toLocaleString()}`);
    console.log(`  P99 TPS:      ${analytics.summary.p99Tps.toLocaleString()}`);
    console.log('');

    console.log(`  ${c.bold}Latency Summary${c.reset}`);
    console.log(`  ${'─'.repeat(50)}`);
    console.log(`  P50:          ${analytics.latency.p50Ms}ms`);
    console.log(`  P95:          ${analytics.latency.p95Ms}ms`);
    console.log(`  P99:          ${analytics.latency.p99Ms}ms`);
    console.log(`  Max:          ${analytics.latency.maxMs}ms`);
    console.log('');

    // Save analytics report
    if (!fs.existsSync(ANALYTICS_DIR)) {
      fs.mkdirSync(ANALYTICS_DIR, { recursive: true });
    }

    const reportFile = path.join(ANALYTICS_DIR, `${targetDemoId}-report.json`);
    fs.writeFileSync(reportFile, JSON.stringify(analytics, null, 2));
    printSuccess(`Analytics report saved: ${reportFile}`);

  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    printError(`Failed to generate analytics: ${errMsg}`);
  }
}

async function main(): Promise<void> {
  console.log('');
  console.log(`${c.blue}${c.bold}╔${'═'.repeat(68)}╗${c.reset}`);
  console.log(`${c.blue}${c.bold}║${c.reset}${' '.repeat(20)}${c.cyan}${c.bold}RALPHY RESUME${c.reset}${' '.repeat(35)}${c.blue}${c.bold}║${c.reset}`);
  console.log(`${c.blue}${c.bold}║${c.reset}${' '.repeat(15)}${c.dim}TPS Verification Resume Tool${c.reset}${' '.repeat(25)}${c.blue}${c.bold}║${c.reset}`);
  console.log(`${c.blue}${c.bold}╚${'═'.repeat(68)}╝${c.reset}`);

  if (listOnly) {
    await listDemos();
    process.exit(0);
  }

  let targetDemoId = demoId;

  if (useLatest) {
    const demos = listDemoIds();
    if (demos.length === 0) {
      printError('No demos found');
      process.exit(1);
    }
    targetDemoId = demos[0]; // Most recent
    printInfo(`Using latest demo: ${targetDemoId}`);
  }

  if (!targetDemoId) {
    printError('No demo ID specified');
    console.log('');
    console.log(`  ${c.bold}Usage:${c.reset}`);
    console.log(`    npx tsx scripts/ralphy-resume.ts --demo-id <id>`);
    console.log(`    npx tsx scripts/ralphy-resume.ts --list`);
    console.log(`    npx tsx scripts/ralphy-resume.ts --latest`);
    console.log(`    npx tsx scripts/ralphy-resume.ts --latest --analytics`);
    console.log('');
    process.exit(1);
  }

  if (analyticsOnly) {
    const isComplete = isVerificationComplete(targetDemoId);
    if (!isComplete) {
      printWarning('Verification not complete - running verification first');
      await resumeVerification(targetDemoId);
    } else {
      await generateAnalyticsForDemo(targetDemoId);
    }
  } else {
    await resumeVerification(targetDemoId);
  }

  console.log('');
  process.exit(0);
}

// Run
main().catch((err) => {
  console.error(`${c.red}[FATAL]${c.reset}`, err);
  process.exit(1);
});
