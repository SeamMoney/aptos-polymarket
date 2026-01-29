#!/usr/bin/env npx tsx
/**
 * TPS Optimizer - Empirically Calibrated Model
 *
 * Based on actual testing data from Jan 29 2026:
 * - 3 VMs × 4 threads × 60 concurrency = ~1,200 TPS actual
 * - Per-worker (healthy): ~520 TPS
 * - Per-worker (slow): ~130 TPS (Worker 1 issue)
 * - With gas simulation skip: estimated +90% improvement
 *
 * Usage:
 *   npx tsx scripts/tps-optimizer.ts
 *   npx tsx scripts/tps-optimizer.ts --target 10000
 */

// =============================================================================
// EMPIRICAL CONSTANTS (from actual testing)
// =============================================================================

const EMPIRICAL = {
  // Observed TPS per healthy VM (standard 2vCPU, 4 threads, 60 concurrency)
  TPS_PER_VM_WITH_SIM: 520,        // Workers 2 & 3 average
  TPS_PER_VM_NO_SIM: 1000,         // Estimated 2x without simulation

  // Worker 1 slow start penalty (accounts 0-1666)
  WORKER_1_PENALTY: 0.25,          // Only 25% of expected TPS

  // VM costs (DigitalOcean)
  COST_SMALL: 6,                   // 1 vCPU, 1GB
  COST_STANDARD: 24,               // 2 vCPU, 4GB
  COST_LARGE: 48,                  // 4 vCPU, 8GB

  // Scaling factors
  SMALL_VM_TPS_FACTOR: 0.5,        // 1 vCPU = ~50% of standard
  LARGE_VM_TPS_FACTOR: 1.8,        // 4 vCPU = ~180% of standard (not 2x due to other limits)

  // Thread efficiency
  THREADS_OPTIMAL: 4,              // Best performance at 4 threads on 2 vCPU
  THREADS_PENALTY_PER_EXTRA: 0.1,  // 10% penalty per thread above optimal

  // Concurrency limits
  CONCURRENCY_OPTIMAL: 60,
  CONCURRENCY_MAX: 80,             // Above this = failures

  // Batch size effects
  BATCH_SIZE_OPTIMAL: 30,
  BATCH_SIZE_FACTOR_PER_10: 0.05,  // 5% improvement per 10 above baseline

  // Current funded accounts
  FUNDED_ACCOUNTS: 5000,
  ACCOUNTS_PER_VM_OPTIMAL: 1667,   // For 3 VMs

  // Success rate
  SUCCESS_RATE_OPTIMAL: 1.0,
  SUCCESS_RATE_HIGH_CONCURRENCY: 0.37, // Observed at concurrency 80
};

// =============================================================================
// MODEL
// =============================================================================

interface Config {
  numVMs: number;
  vmType: 'small' | 'standard' | 'large';
  threads: number;
  concurrency: number;
  batchSize: number;
  skipSimulation: boolean;
}

interface Result {
  config: Config;
  tpsPerVM: number;
  totalTPS: number;
  successRate: number;
  effectiveTPS: number;
  costPerMonth: number;
  tpsPerDollar: number;
  accountsPerVM: number;
  bottleneck: string;
  notes: string[];
}

function calculateTPS(config: Config): Result {
  const notes: string[] = [];

  // Base TPS per VM
  let baseTPS = config.skipSimulation
    ? EMPIRICAL.TPS_PER_VM_NO_SIM
    : EMPIRICAL.TPS_PER_VM_WITH_SIM;

  // VM type factor
  const vmTypeFactor = {
    small: EMPIRICAL.SMALL_VM_TPS_FACTOR,
    standard: 1.0,
    large: EMPIRICAL.LARGE_VM_TPS_FACTOR,
  }[config.vmType];

  baseTPS *= vmTypeFactor;

  // Thread efficiency (optimal = 4 for standard VM)
  const optimalThreads = config.vmType === 'small' ? 2 :
                         config.vmType === 'large' ? 8 : 4;

  let threadFactor = 1.0;
  if (config.threads < optimalThreads) {
    threadFactor = config.threads / optimalThreads;
    notes.push(`Underutilized: only ${config.threads}/${optimalThreads} threads`);
  } else if (config.threads > optimalThreads) {
    const extra = config.threads - optimalThreads;
    threadFactor = 1.0 - (extra * EMPIRICAL.THREADS_PENALTY_PER_EXTRA);
    notes.push(`Thread contention: ${config.threads} threads on ${optimalThreads} vCPUs`);
  }
  threadFactor = Math.max(threadFactor, 0.3);

  // Concurrency factor
  let concurrencyFactor = 1.0;
  let successRate = EMPIRICAL.SUCCESS_RATE_OPTIMAL;

  if (config.concurrency < EMPIRICAL.CONCURRENCY_OPTIMAL) {
    concurrencyFactor = config.concurrency / EMPIRICAL.CONCURRENCY_OPTIMAL;
    notes.push(`Low concurrency: ${config.concurrency}`);
  } else if (config.concurrency > EMPIRICAL.CONCURRENCY_MAX) {
    concurrencyFactor = 0.5;
    successRate = EMPIRICAL.SUCCESS_RATE_HIGH_CONCURRENCY;
    notes.push(`⚠️ Concurrency too high: failures expected`);
  } else if (config.concurrency > EMPIRICAL.CONCURRENCY_OPTIMAL) {
    // Slight improvement but diminishing returns
    const improvement = (config.concurrency - EMPIRICAL.CONCURRENCY_OPTIMAL) * 0.005;
    concurrencyFactor = 1.0 + Math.min(improvement, 0.1);
    // Some success rate penalty
    successRate = 1.0 - (config.concurrency - EMPIRICAL.CONCURRENCY_OPTIMAL) * 0.005;
  }

  // Batch size factor
  let batchFactor = 1.0;
  if (config.batchSize !== EMPIRICAL.BATCH_SIZE_OPTIMAL) {
    const diff = (config.batchSize - EMPIRICAL.BATCH_SIZE_OPTIMAL) / 10;
    batchFactor = 1.0 + (diff * EMPIRICAL.BATCH_SIZE_FACTOR_PER_10);
    batchFactor = Math.max(batchFactor, 0.5);
  }

  // Calculate accounts per VM
  const accountsPerVM = Math.floor(EMPIRICAL.FUNDED_ACCOUNTS / config.numVMs);

  // Account availability factor (need enough accounts)
  let accountFactor = 1.0;
  if (accountsPerVM < config.concurrency * config.threads) {
    accountFactor = accountsPerVM / (config.concurrency * config.threads);
    notes.push(`Account limited: only ${accountsPerVM} per VM`);
  }

  // Worker 1 penalty (first VM with accounts 0-1666 is slow)
  let worker1Factor = 1.0;
  if (config.numVMs >= 1) {
    // Average in the slow first worker
    worker1Factor = ((config.numVMs - 1) + EMPIRICAL.WORKER_1_PENALTY) / config.numVMs;
    if (config.numVMs <= 3) {
      notes.push(`Worker 1 slow start affects average`);
    }
  }

  // Final TPS per VM
  const tpsPerVM = baseTPS * threadFactor * concurrencyFactor * batchFactor * accountFactor;

  // Total TPS
  const totalTPS = tpsPerVM * config.numVMs * worker1Factor;

  // Effective TPS (after success rate)
  const effectiveTPS = totalTPS * successRate;

  // Cost
  const vmCost = {
    small: EMPIRICAL.COST_SMALL,
    standard: EMPIRICAL.COST_STANDARD,
    large: EMPIRICAL.COST_LARGE,
  }[config.vmType];

  const costPerMonth = config.numVMs * vmCost;
  const tpsPerDollar = effectiveTPS / costPerMonth;

  // Determine bottleneck
  let bottleneck = 'None';
  if (accountFactor < 1) bottleneck = 'Funded accounts';
  else if (threadFactor < 0.8) bottleneck = 'CPU (thread contention)';
  else if (successRate < 0.9) bottleneck = 'Mempool (high concurrency)';
  else if (concurrencyFactor < 0.8) bottleneck = 'Low concurrency';
  else if (!config.skipSimulation) bottleneck = 'Gas simulation';
  else bottleneck = 'Network latency';

  return {
    config,
    tpsPerVM: Math.round(tpsPerVM),
    totalTPS: Math.round(totalTPS),
    successRate: Math.round(successRate * 100) / 100,
    effectiveTPS: Math.round(effectiveTPS),
    costPerMonth,
    tpsPerDollar: Math.round(tpsPerDollar * 10) / 10,
    accountsPerVM,
    bottleneck,
    notes,
  };
}

// =============================================================================
// OPTIMIZATION
// =============================================================================

function findOptimalForTarget(targetTPS: number, maxBudget?: number): Result[] {
  const results: Result[] = [];

  const vmTypes: Array<'small' | 'standard' | 'large'> = ['small', 'standard', 'large'];

  for (const vmType of vmTypes) {
    for (let numVMs = 1; numVMs <= 30; numVMs++) {
      for (const skipSim of [true, false]) {
        for (let threads = 2; threads <= 8; threads += 2) {
          for (let concurrency = 40; concurrency <= 80; concurrency += 20) {
            for (let batchSize = 20; batchSize <= 50; batchSize += 10) {
              const result = calculateTPS({
                numVMs,
                vmType,
                threads,
                concurrency,
                batchSize,
                skipSimulation: skipSim,
              });

              // Filter by constraints
              if (maxBudget && result.costPerMonth > maxBudget) continue;
              if (result.effectiveTPS < targetTPS * 0.9) continue;
              if (result.successRate < 0.9) continue;

              results.push(result);
            }
          }
        }
      }
    }
  }

  // Sort by TPS/$ (efficiency)
  results.sort((a, b) => b.tpsPerDollar - a.tpsPerDollar);

  return results.slice(0, 10);
}

// =============================================================================
// OUTPUT
// =============================================================================

function printResult(r: Result, index?: number): void {
  const prefix = index !== undefined ? `[${index}] ` : '';
  console.log(`${prefix}${r.config.numVMs}× ${r.config.vmType} VM | ${r.config.threads}T/${r.config.concurrency}C/${r.config.batchSize}B | sim=${!r.config.skipSimulation}`);
  console.log(`    TPS: ${r.effectiveTPS.toLocaleString()} (${r.tpsPerVM}/VM × ${r.config.numVMs} × ${r.successRate} success)`);
  console.log(`    Cost: $${r.costPerMonth}/mo | ${r.tpsPerDollar} TPS/$`);
  console.log(`    Bottleneck: ${r.bottleneck}`);
  if (r.notes.length) {
    console.log(`    Notes: ${r.notes.join(', ')}`);
  }
}

function main(): void {
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║         TPS OPTIMIZER (Empirically Calibrated)                 ║');
  console.log('╚════════════════════════════════════════════════════════════════╝');

  // Current setup
  console.log('\n═══ CURRENT SETUP ═══\n');
  const current = calculateTPS({
    numVMs: 3,
    vmType: 'standard',
    threads: 4,
    concurrency: 60,
    batchSize: 30,
    skipSimulation: false,
  });
  printResult(current);

  console.log('\n═══ WITH GAS SIMULATION SKIP ═══\n');
  const withSkip = calculateTPS({
    numVMs: 3,
    vmType: 'standard',
    threads: 4,
    concurrency: 60,
    batchSize: 30,
    skipSimulation: true,
  });
  printResult(withSkip);
  console.log(`\n    Improvement: +${Math.round((withSkip.effectiveTPS / current.effectiveTPS - 1) * 100)}% TPS`);

  // Sensitivity analysis
  console.log('\n═══ SENSITIVITY ANALYSIS ═══\n');

  console.log('Threads (2 vCPU VM):');
  for (let t = 2; t <= 8; t += 2) {
    const r = calculateTPS({ numVMs: 3, vmType: 'standard', threads: t, concurrency: 60, batchSize: 30, skipSimulation: true });
    const bar = '█'.repeat(Math.round(r.effectiveTPS / 100));
    console.log(`  ${t}T: ${r.effectiveTPS.toLocaleString().padStart(5)} TPS ${bar}`);
  }

  console.log('\nConcurrency:');
  for (let c = 40; c <= 100; c += 20) {
    const r = calculateTPS({ numVMs: 3, vmType: 'standard', threads: 4, concurrency: c, batchSize: 30, skipSimulation: true });
    const bar = '█'.repeat(Math.round(r.effectiveTPS / 100));
    console.log(`  ${c.toString().padStart(3)}C: ${r.effectiveTPS.toLocaleString().padStart(5)} TPS (${Math.round(r.successRate * 100)}% success) ${bar}`);
  }

  console.log('\nNumber of VMs:');
  for (let v = 1; v <= 10; v++) {
    const r = calculateTPS({ numVMs: v, vmType: 'standard', threads: 4, concurrency: 60, batchSize: 30, skipSimulation: true });
    const bar = '█'.repeat(Math.round(r.effectiveTPS / 200));
    console.log(`  ${v.toString().padStart(2)} VMs: ${r.effectiveTPS.toLocaleString().padStart(5)} TPS ($${r.costPerMonth}/mo) ${bar}`);
  }

  // Scaling projection
  console.log('\n═══ SCALING PROJECTION ═══\n');
  console.log('Target TPS → Optimal Config\n');

  const targets = [1000, 2000, 5000, 10000, 20000, 30000];

  for (const target of targets) {
    const results = findOptimalForTarget(target);
    if (results.length > 0) {
      const best = results[0];
      console.log(`${target.toLocaleString().padStart(6)} TPS:`);
      console.log(`  → ${best.config.numVMs}× ${best.config.vmType} | ${best.config.threads}T/${best.config.concurrency}C | sim=${!best.config.skipSimulation ? 'on' : 'off'}`);
      console.log(`  → $${best.costPerMonth}/mo | ${best.tpsPerDollar} TPS/$`);
      if (best.config.numVMs > Math.ceil(EMPIRICAL.FUNDED_ACCOUNTS / 500)) {
        console.log(`  ⚠️  Need ${best.config.numVMs * 500} funded accounts (currently ${EMPIRICAL.FUNDED_ACCOUNTS})`);
      }
    } else {
      console.log(`${target.toLocaleString().padStart(6)} TPS: Need more funded accounts or higher budget`);
    }
    console.log('');
  }

  // Key insights
  console.log('═══ KEY INSIGHTS ═══\n');
  console.log('1. SKIP GAS SIMULATION: +90% TPS (biggest single improvement)');
  console.log('   Add maxGasAmount & gasUnitPrice to transaction options\n');
  console.log('2. OPTIMAL THREADS: Match vCPU count (4T for 2vCPU VM)');
  console.log('   More threads = CPU contention = lower TPS\n');
  console.log('3. CONCURRENCY: 60 is optimal, 80+ causes failures\n');
  console.log('4. SCALING: Linear with VMs (~500-1000 TPS per standard VM)\n');
  console.log('5. ACCOUNTS: Need ~500 funded accounts per VM\n');
  console.log('6. WORKER 1 BUG: Accounts 0-1666 are slow (investigate separately)\n');

  // Cost summary
  console.log('═══ COST SUMMARY ═══\n');
  console.log('Target TPS | VMs | Cost/mo | TPS/$');
  console.log('-----------|-----|---------|------');
  for (const target of [1000, 5000, 10000]) {
    const results = findOptimalForTarget(target);
    if (results.length > 0) {
      const best = results[0];
      console.log(`${target.toLocaleString().padStart(10)} | ${best.config.numVMs.toString().padStart(3)} | $${best.costPerMonth.toString().padStart(6)} | ${best.tpsPerDollar}`);
    }
  }
}

main();
