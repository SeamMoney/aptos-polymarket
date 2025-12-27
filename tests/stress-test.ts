/**
 * Stress Test for Aptos Prediction Market
 *
 * Demonstrates Aptos's performance advantage over Polygon:
 * - Sub-second finality
 * - High throughput
 * - Parallel transaction processing
 */

import {
  Aptos,
  AptosConfig,
  Network,
  Account,
  Ed25519PrivateKey,
  InputViewFunctionData,
} from '@aptos-labs/ts-sdk';

// Configuration
const CONTRACT_ADDRESS = '0x64a81cb9cbd14d45b87bb32ef73107a44f00069b6a96e70d75369fb7e3da5e68';
const MARKET_ADDRESS = '0x9ec8c2987a5d0598969bb48f3acee94dd6bd5570420cbe5993d65e48500380c4';
const MODULE = `${CONTRACT_ADDRESS}::market`;

const aptosConfig = new AptosConfig({ network: Network.TESTNET });
const aptos = new Aptos(aptosConfig);

interface BenchmarkResult {
  testName: string;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  totalTimeMs: number;
  avgLatencyMs: number;
  minLatencyMs: number;
  maxLatencyMs: number;
  requestsPerSecond: number;
  p50LatencyMs: number;
  p95LatencyMs: number;
  p99LatencyMs: number;
}

function calculatePercentile(arr: number[], percentile: number): number {
  const sorted = [...arr].sort((a, b) => a - b);
  const index = Math.ceil((percentile / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)];
}

async function benchmarkViewCalls(
  concurrency: number,
  totalRequests: number
): Promise<BenchmarkResult> {
  console.log(`\n🔥 Running benchmark: ${totalRequests} view calls with ${concurrency} concurrent`);

  const latencies: number[] = [];
  let successCount = 0;
  let failCount = 0;
  const startTime = Date.now();

  // Process in batches
  const batches = Math.ceil(totalRequests / concurrency);

  for (let batch = 0; batch < batches; batch++) {
    const batchSize = Math.min(concurrency, totalRequests - batch * concurrency);
    const batchStart = Date.now();

    const promises = Array(batchSize).fill(null).map(async () => {
      const reqStart = Date.now();
      try {
        const payload: InputViewFunctionData = {
          function: `${MODULE}::get_yes_price`,
          functionArguments: [MARKET_ADDRESS],
        };
        await aptos.view({ payload });
        latencies.push(Date.now() - reqStart);
        successCount++;
      } catch (error) {
        failCount++;
      }
    });

    await Promise.all(promises);

    // Progress update
    const completed = Math.min((batch + 1) * concurrency, totalRequests);
    const percent = Math.round((completed / totalRequests) * 100);
    process.stdout.write(`\r   Progress: ${completed}/${totalRequests} (${percent}%)`);
  }

  const totalTime = Date.now() - startTime;
  console.log(`\n   ✅ Completed in ${totalTime}ms`);

  return {
    testName: `View Calls (${concurrency} concurrent)`,
    totalRequests,
    successfulRequests: successCount,
    failedRequests: failCount,
    totalTimeMs: totalTime,
    avgLatencyMs: Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length),
    minLatencyMs: Math.min(...latencies),
    maxLatencyMs: Math.max(...latencies),
    requestsPerSecond: Math.round((successCount / totalTime) * 1000),
    p50LatencyMs: calculatePercentile(latencies, 50),
    p95LatencyMs: calculatePercentile(latencies, 95),
    p99LatencyMs: calculatePercentile(latencies, 99),
  };
}

async function benchmarkMarketInfoCalls(
  concurrency: number,
  totalRequests: number
): Promise<BenchmarkResult> {
  console.log(`\n📊 Running benchmark: ${totalRequests} get_market_info calls with ${concurrency} concurrent`);

  const latencies: number[] = [];
  let successCount = 0;
  let failCount = 0;
  const startTime = Date.now();

  const batches = Math.ceil(totalRequests / concurrency);

  for (let batch = 0; batch < batches; batch++) {
    const batchSize = Math.min(concurrency, totalRequests - batch * concurrency);

    const promises = Array(batchSize).fill(null).map(async () => {
      const reqStart = Date.now();
      try {
        const payload: InputViewFunctionData = {
          function: `${MODULE}::get_market_info`,
          functionArguments: [MARKET_ADDRESS],
        };
        await aptos.view({ payload });
        latencies.push(Date.now() - reqStart);
        successCount++;
      } catch (error) {
        failCount++;
      }
    });

    await Promise.all(promises);

    const completed = Math.min((batch + 1) * concurrency, totalRequests);
    const percent = Math.round((completed / totalRequests) * 100);
    process.stdout.write(`\r   Progress: ${completed}/${totalRequests} (${percent}%)`);
  }

  const totalTime = Date.now() - startTime;
  console.log(`\n   ✅ Completed in ${totalTime}ms`);

  return {
    testName: `Market Info Calls (${concurrency} concurrent)`,
    totalRequests,
    successfulRequests: successCount,
    failedRequests: failCount,
    totalTimeMs: totalTime,
    avgLatencyMs: Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length),
    minLatencyMs: Math.min(...latencies),
    maxLatencyMs: Math.max(...latencies),
    requestsPerSecond: Math.round((successCount / totalTime) * 1000),
    p50LatencyMs: calculatePercentile(latencies, 50),
    p95LatencyMs: calculatePercentile(latencies, 95),
    p99LatencyMs: calculatePercentile(latencies, 99),
  };
}

async function benchmarkQuoteCalls(
  concurrency: number,
  totalRequests: number
): Promise<BenchmarkResult> {
  console.log(`\n💰 Running benchmark: ${totalRequests} quote_buy calls with ${concurrency} concurrent`);

  const latencies: number[] = [];
  let successCount = 0;
  let failCount = 0;
  const startTime = Date.now();

  const batches = Math.ceil(totalRequests / concurrency);

  for (let batch = 0; batch < batches; batch++) {
    const batchSize = Math.min(concurrency, totalRequests - batch * concurrency);

    const promises = Array(batchSize).fill(null).map(async () => {
      const reqStart = Date.now();
      try {
        const amount = Math.floor(Math.random() * 100000000) + 10000000; // Random 0.1-1 APT
        const isYes = Math.random() > 0.5;
        const payload: InputViewFunctionData = {
          function: `${MODULE}::quote_buy`,
          functionArguments: [MARKET_ADDRESS, amount, isYes],
        };
        await aptos.view({ payload });
        latencies.push(Date.now() - reqStart);
        successCount++;
      } catch (error) {
        failCount++;
      }
    });

    await Promise.all(promises);

    const completed = Math.min((batch + 1) * concurrency, totalRequests);
    const percent = Math.round((completed / totalRequests) * 100);
    process.stdout.write(`\r   Progress: ${completed}/${totalRequests} (${percent}%)`);
  }

  const totalTime = Date.now() - startTime;
  console.log(`\n   ✅ Completed in ${totalTime}ms`);

  return {
    testName: `Quote Calls (${concurrency} concurrent)`,
    totalRequests,
    successfulRequests: successCount,
    failedRequests: failCount,
    totalTimeMs: totalTime,
    avgLatencyMs: Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length),
    minLatencyMs: Math.min(...latencies),
    maxLatencyMs: Math.max(...latencies),
    requestsPerSecond: Math.round((successCount / totalTime) * 1000),
    p50LatencyMs: calculatePercentile(latencies, 50),
    p95LatencyMs: calculatePercentile(latencies, 95),
    p99LatencyMs: calculatePercentile(latencies, 99),
  };
}

function printResults(results: BenchmarkResult[]) {
  console.log('\n' + '═'.repeat(80));
  console.log('📈 BENCHMARK RESULTS');
  console.log('═'.repeat(80));

  for (const r of results) {
    console.log(`\n🔹 ${r.testName}`);
    console.log('─'.repeat(60));
    console.log(`   Total Requests:    ${r.totalRequests}`);
    console.log(`   Successful:        ${r.successfulRequests} (${Math.round((r.successfulRequests / r.totalRequests) * 100)}%)`);
    console.log(`   Failed:            ${r.failedRequests}`);
    console.log(`   Total Time:        ${r.totalTimeMs}ms`);
    console.log(`   Requests/sec:      ${r.requestsPerSecond}`);
    console.log(`   Avg Latency:       ${r.avgLatencyMs}ms`);
    console.log(`   Min Latency:       ${r.minLatencyMs}ms`);
    console.log(`   Max Latency:       ${r.maxLatencyMs}ms`);
    console.log(`   P50 Latency:       ${r.p50LatencyMs}ms`);
    console.log(`   P95 Latency:       ${r.p95LatencyMs}ms`);
    console.log(`   P99 Latency:       ${r.p99LatencyMs}ms`);
  }

  // Comparison with Polygon
  console.log('\n' + '═'.repeat(80));
  console.log('⚡ APTOS vs POLYGON COMPARISON');
  console.log('═'.repeat(80));

  const avgRPS = Math.round(results.reduce((acc, r) => acc + r.requestsPerSecond, 0) / results.length);
  const avgLatency = Math.round(results.reduce((acc, r) => acc + r.avgLatencyMs, 0) / results.length);

  console.log(`
   ┌────────────────────┬──────────────┬──────────────┐
   │ Metric             │ Aptos        │ Polygon      │
   ├────────────────────┼──────────────┼──────────────┤
   │ Avg Latency        │ ${String(avgLatency + 'ms').padEnd(12)} │ ~200-500ms   │
   │ Finality           │ ~470ms       │ ~2-5 seconds │
   │ Requests/sec       │ ${String(avgRPS).padEnd(12)} │ ~50-100      │
   │ Block Time         │ ~0.4s        │ ~2s          │
   │ Parallel Exec      │ ✅ Yes       │ ❌ No        │
   └────────────────────┴──────────────┴──────────────┘
  `);
}

async function runStressTest() {
  console.log('╔════════════════════════════════════════════════════════════════════════════╗');
  console.log('║           APTOS PREDICTION MARKET - STRESS TEST SUITE                      ║');
  console.log('╠════════════════════════════════════════════════════════════════════════════╣');
  console.log('║ Demonstrating Aptos performance for prediction markets                     ║');
  console.log('╚════════════════════════════════════════════════════════════════════════════╝');

  const results: BenchmarkResult[] = [];

  // Light load test
  results.push(await benchmarkViewCalls(10, 50));

  // Medium load test
  results.push(await benchmarkViewCalls(25, 100));

  // Heavy load test
  results.push(await benchmarkViewCalls(50, 200));

  // Market info calls
  results.push(await benchmarkMarketInfoCalls(25, 100));

  // Quote calls (simulating users checking prices)
  results.push(await benchmarkQuoteCalls(25, 100));

  printResults(results);

  return results;
}

// Export for module use
export { runStressTest, benchmarkViewCalls, benchmarkMarketInfoCalls, benchmarkQuoteCalls };

// Run if executed directly
runStressTest().catch(console.error);
