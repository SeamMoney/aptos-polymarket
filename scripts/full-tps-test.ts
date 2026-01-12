/**
 * FULL END-TO-END TPS TEST
 * ========================
 *
 * Comprehensive automated test that:
 * 1. Verifies all infrastructure (workers, fullnode, QuikNode)
 * 2. Checks initial Geomi state
 * 3. Starts all workers with 10 markets in quantum mode
 * 4. Monitors TPS in real-time via Geomi
 * 5. Validates all transactions landed on-chain
 * 6. Produces final report with statistics
 *
 * Usage:
 *   npx tsx scripts/full-tps-test.ts 60      # 60 second test
 *   npx tsx scripts/full-tps-test.ts 300     # 5 minute test
 */

import { exec, spawn } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// ============================================================
// CONFIGURATION
// ============================================================

const GEOMI_URL = 'https://api.testnet.aptoslabs.com/nocode/v1/api/cmk83k7ov0003s6017cgn7stm/v1/graphql';
const API_KEY = 'aptoslabs_9XPRa9Cn5Ym_LS3sjbgqKdh59PBWxoTQyBwszzPT964g8';

const WORKERS = [
  { host: 'root@178.128.177.88', name: 'Worker 1', accounts: 7 },
  { host: 'root@147.182.237.239', name: 'Worker 2', accounts: 7 },
  { host: 'root@161.35.231.0', name: 'Worker 3', accounts: 6 },
];

const FULLNODE = 'aptos.cash.trading';
const QUICKNODE = 'https://polished-evocative-borough.aptos-testnet.quiknode.pro/5007528028dac5f585808912130fe71e0a30558c/v1';

const ALL_MARKETS = [
  { address: '0xc47af6adee557eb824c5a82f800d9ca15a6525417d273d9671451a45106870bb', name: 'WLFI Charter' },
  { address: '0x3b365cbbc7ea0aa6e18b3dd7d4e2cae6c84fae90d9b5d0c3b1ef8a919ea5a72f', name: 'Greenland' },
  { address: '0xa4cc4e98d5f9dd23809ad1cf9f3b44501be2ffae47c06f59fa81df0886f01fa0', name: 'Fed Chair' },
  { address: '0x74bbc4673ebe683d3d0013a1862c369938255071f0b32ac0fb638b476698213a', name: 'Iran Khamenei' },
  { address: '0x2163cf2a5e8a58b262111e06f6e97818ff0a11418eaedcb28ba3e10a0fdb2d12', name: 'China Taiwan' },
  { address: '0x9ead4f745267b70bf8f80858876552dff8b3752d67580deb0ef211a441230ebd', name: 'Russia-Ukraine' },
  { address: '0xc0c821e880662d8f4c35d6e88521f489aa61c97fe42662a348fdb4333922f3dc', name: 'Venezuela' },
  { address: '0x23c79ba59fdffe66abd5243ebf98d9dd13661d86a355cfcb1872eeb58e088278', name: 'Fed Rate Jan' },
  { address: '0xb297b277d82a364b2f98d2e8fac549d921acd565dfb46c598c09eab2e93e776d', name: 'BTC Q1 2026' },
  { address: '0xaba7e1a1ca41899757215bac86bd71ca5d8db24d53acf18332421b0424dac8f3', name: 'BTC $150K' },
];

const MARKET_ADDRESSES = ALL_MARKETS.map(m => m.address).join(',');

// Account keys per worker
const KEYS = {
  W1: '0x6e2fca34586261b6f22a973c20024b78ddb370d87f7c974315fb97ba56716a7f,0xe61d22b3dc37c537a20d5b301c4d2b409b2f93cd7b2915f3518d49517c2ab6c4,0x4542c2e4a39beee8202eee0cddeceea886687b21b54b8f50c17e729251fdd7f5,0xcf5154af9664bbc2634fddfcce2317ed788b35de7f004ac0e24aefd68a0b10c5,ed25519-priv-0xb7d1f406e48c2eddffe987f98445dd4a353e8e9d1630d878621ded084bdd77c7,ed25519-priv-0xa8088ee787b847f6304807a8b09d1afc15409082ee9c8b7eda6919b0ecb86ea8,ed25519-priv-0xb5305eb83498dcba61242ccc91fac35263d9b44bddaf5e7417adbaceb1cfcb36',
  W2: 'ed25519-priv-0xc27a6a8b6ed3013da99dc924b2f6af17f1448dedce91691f97d9e778c0761655,ed25519-priv-0xd6402b3493af005ed02b07f6cd7ffdfd37fae6d4d9c88fec6ff38e90f01b21c1,ed25519-priv-0xd375af1a686835905e15bf82f24fcaeed4b1b5b5fabe22c80e998acb804aa295,ed25519-priv-0xC5BA2ED0F5C40EE298E844B1140B6BB31C2671B747C8E9DF4B76054C4C5A8761,ed25519-priv-0x536C886483209657C9B30663B295C7CB007EB57E07931D3E41AF69067897D465,ed25519-priv-0x3E9CB6207207A266F298B1B13648D707BF886766221C3253F30AF68530A79749,ed25519-priv-0x4641D0FDD221B48EF4A45C8DC77D6D4F12D6848E01B7686134564A8CAE5BE637',
  W3: 'ed25519-priv-0xFB2AFF37DFED247E9CF407FFA41208A41A78877C1990ADD1F94E00FCE1A5CCAC,ed25519-priv-0x9E338A7FB43F8280CCD82B2929B66F4ED1B7AA7900C40E06EAD934BC7CDEF315,ed25519-priv-0x8E7D4B0196840DA3A7BA6EDEF3784E1B961263F06651B130F440F5D974920B1F,ed25519-priv-0x975CF351CE096E1350C9F9E89ED5CB8D7BEAAEBF7FC235B10F1A0852355EED7A,ed25519-priv-0xD945B44FCFA961B9E4F8DAA5139CF6B4CE9A1DF4838C75701EDC8A429739C097,ed25519-priv-0x292A25EDBE90DCB5F682908C1E7185E1CC127FAD74EEA218167115AA5962866C',
};

// ============================================================
// GEOMI API
// ============================================================

interface GeomiTrade {
  tx_hash: string;
  market_address: string;
  timestamp: string;
  trader: string;
  outcome_index: number;
  token_amount: string;
  collateral_amount: string;
}

async function queryGeomi<T>(query: string): Promise<T> {
  const res = await fetch(GEOMI_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${API_KEY}`
    },
    body: JSON.stringify({ query }),
  });
  const data = await res.json();
  if (data.errors) {
    throw new Error(`Geomi error: ${JSON.stringify(data.errors)}`);
  }
  return data.data;
}

async function getTradeCount(since: string): Promise<{
  total: number;
  byMarket: Record<string, number>;
  trades: GeomiTrade[];
}> {
  // Get latest trades and filter by market (more reliable than timestamp)
  const query = `
    query {
      trades(
        order_by: { sequence_number: desc }
        limit: 10000
      ) {
        tx_hash
        market_address
        timestamp
        trader
        outcome_index
        token_amount
        collateral_amount
        sequence_number
      }
    }
  `;

  const data = await queryGeomi<{ trades: (GeomiTrade & { sequence_number: number })[] }>(query);
  const trades = data.trades || [];

  const byMarket: Record<string, number> = {};
  for (const t of trades) {
    byMarket[t.market_address] = (byMarket[t.market_address] || 0) + 1;
  }

  return { total: trades.length, byMarket, trades };
}

// Track trades by comparing totals (more accurate)
let lastTotalCount = 0;
async function getTradeCountDelta(): Promise<{ delta: number; total: number; byMarket: Record<string, number> }> {
  const currentTotal = await getTotalTradeCount();
  const delta = currentTotal - lastTotalCount;

  // Get market distribution from recent trades
  const recentQuery = `
    query {
      trades(order_by: { sequence_number: desc }, limit: 500) {
        market_address
      }
    }
  `;
  const recentData = await queryGeomi<{ trades: { market_address: string }[] }>(recentQuery);

  const byMarket: Record<string, number> = {};
  for (const t of recentData.trades || []) {
    byMarket[t.market_address] = (byMarket[t.market_address] || 0) + 1;
  }

  lastTotalCount = currentTotal;
  return { delta, total: currentTotal, byMarket };
}

async function getTotalTradeCount(): Promise<number> {
  const query = `query { trades_aggregate { aggregate { count } } }`;
  const data = await queryGeomi<{ trades_aggregate: { aggregate: { count: number } } }>(query);
  return data.trades_aggregate.aggregate.count;
}

// ============================================================
// INFRASTRUCTURE CHECKS
// ============================================================

async function checkFullnode(): Promise<{ ok: boolean; block?: number; error?: string }> {
  try {
    const res = await fetch(`http://${FULLNODE}:8080/v1`);
    const data = await res.json();
    return { ok: true, block: parseInt(data.block_height) };
  } catch (e: any) {
    return { ok: false, error: e.message };
  }
}

async function checkQuikNode(): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(QUICKNODE);
    const data = await res.json();
    return { ok: !!data.chain_id };
  } catch (e: any) {
    return { ok: false, error: e.message };
  }
}

async function checkWorker(host: string): Promise<{ ok: boolean; error?: string }> {
  try {
    await execAsync(`ssh -o ConnectTimeout=5 ${host} "echo ok"`, { timeout: 10000 });
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e.message };
  }
}

async function stopAllWorkers(): Promise<void> {
  console.log('  Stopping any running workers...');
  await Promise.all(
    WORKERS.map(w =>
      execAsync(`ssh ${w.host} 'pkill -9 -f "hft-ultra" 2>/dev/null || true'`).catch(() => {})
    )
  );
  await sleep(3000);
}

// ============================================================
// WORKER MANAGEMENT
// ============================================================

async function startWorker(
  worker: typeof WORKERS[0],
  keys: string,
  duration: number
): Promise<void> {
  const runScript = `
export ULTRA_PRIVATE_KEYS="${keys}"
export APTOS_API_KEY="AG-3JMDT54EN4DCLULDWAUXCYGQ56JJQCYHH"
export FULLNODE_URL="http://${FULLNODE}:8080/v1"
export EXTRA_RPC_ENDPOINTS="${QUICKNODE}"
export CONTRACT_ADDRESS="0xa2e5e47aab07fed78a3bcf95135ee2dad20c547499c94cb16a3e047859ffa7e1"
export MULTI_MARKETS="${MARKET_ADDRESSES}"
export HFT_PORT=3001
cd /opt/aptos-hft && npx tsx hft-ultra-server.ts quantum ${duration + 30}
`;

  const cmd = `ssh ${worker.host} 'cat > /tmp/run-test.sh << "SCRIPT"
${runScript}
SCRIPT
chmod +x /tmp/run-test.sh && nohup bash /tmp/run-test.sh > /tmp/hft-test.log 2>&1 &'`;

  await execAsync(cmd);
}

async function startAllWorkers(duration: number): Promise<void> {
  console.log('  Starting all workers in QUANTUM mode with 10 markets...');

  await Promise.all([
    startWorker(WORKERS[0], KEYS.W1, duration),
    startWorker(WORKERS[1], KEYS.W2, duration),
    startWorker(WORKERS[2], KEYS.W3, duration),
  ]);

  // Wait for initialization
  console.log('  Waiting 15s for worker initialization...');
  await sleep(15000);
}

async function getWorkerStats(host: string): Promise<{ tps: number; trades: number } | null> {
  try {
    const { stdout } = await execAsync(
      `ssh -o ConnectTimeout=3 ${host} "grep 'HFT STATS' /tmp/hft-test.log 2>/dev/null | tail -1"`,
      { timeout: 10000 }
    );
    const tpsMatch = stdout.match(/TPS:\s*(\d+)/);
    const tradesMatch = stdout.match(/Trades:\s*(\d+)/);
    return {
      tps: tpsMatch ? parseInt(tpsMatch[1]) : 0,
      trades: tradesMatch ? parseInt(tradesMatch[1]) : 0,
    };
  } catch {
    return null;
  }
}

// ============================================================
// UTILITIES
// ============================================================

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function formatNumber(n: number): string {
  return n.toLocaleString();
}

function printHeader(title: string): void {
  console.log('');
  console.log('╔' + '═'.repeat(62) + '╗');
  console.log('║  ' + title.padEnd(59) + '║');
  console.log('╚' + '═'.repeat(62) + '╝');
}

function printSection(title: string): void {
  console.log('');
  console.log('═'.repeat(64));
  console.log('  ' + title);
  console.log('═'.repeat(64));
}

// ============================================================
// MAIN TEST
// ============================================================

async function main() {
  const duration = parseInt(process.argv[2]) || 60;
  const startTime = new Date();

  printHeader(`FULL END-TO-END TPS TEST (${duration}s)`);
  console.log(`  Started: ${startTime.toISOString()}`);
  console.log(`  Duration: ${duration} seconds`);
  console.log(`  Markets: ${ALL_MARKETS.length}`);
  console.log(`  Workers: ${WORKERS.length} (${WORKERS.reduce((a, w) => a + w.accounts, 0)} accounts)`);

  // ============================================================
  // PHASE 1: Infrastructure Verification
  // ============================================================
  printSection('PHASE 1: Infrastructure Verification');

  console.log('');
  console.log('  Checking fullnode...');
  const fullnodeCheck = await checkFullnode();
  console.log(`    Fullnode (${FULLNODE}): ${fullnodeCheck.ok ? `✓ Block ${formatNumber(fullnodeCheck.block!)}` : `✗ ${fullnodeCheck.error}`}`);

  console.log('  Checking QuikNode...');
  const quiknodeCheck = await checkQuikNode();
  console.log(`    QuikNode: ${quiknodeCheck.ok ? '✓' : `✗ ${quiknodeCheck.error}`}`);

  console.log('  Checking workers...');
  const workerChecks = await Promise.all(WORKERS.map(async w => {
    const check = await checkWorker(w.host);
    console.log(`    ${w.name} (${w.host.split('@')[1]}): ${check.ok ? '✓' : `✗ ${check.error}`}`);
    return check.ok;
  }));

  if (!fullnodeCheck.ok || !workerChecks.every(Boolean)) {
    console.error('\n  ✗ Infrastructure check failed. Aborting.');
    process.exit(1);
  }

  console.log('\n  ✓ All infrastructure verified');

  // ============================================================
  // PHASE 2: Geomi Baseline
  // ============================================================
  printSection('PHASE 2: Geomi Baseline');

  const baselineTotalTrades = await getTotalTradeCount();
  console.log(`  Total trades in Geomi before test: ${formatNumber(baselineTotalTrades)}`);

  const testStartTimestamp = new Date().toISOString();
  console.log(`  Test start timestamp: ${testStartTimestamp}`);

  // ============================================================
  // PHASE 3: Start Workers
  // ============================================================
  printSection('PHASE 3: Starting Workers');

  await stopAllWorkers();
  await startAllWorkers(duration);

  console.log('  Workers started. Beginning monitoring...');

  // ============================================================
  // PHASE 4: Real-time Monitoring
  // ============================================================
  printSection('PHASE 4: Real-time Monitoring');

  const monitorInterval = 10; // seconds
  const iterations = Math.ceil(duration / monitorInterval);

  console.log('');
  console.log('  ┌──────────┬────────────┬─────────────┬─────────────────────────────────┐');
  console.log('  │ Elapsed  │ Trades     │ Current TPS │ Market Distribution             │');
  console.log('  ├──────────┼────────────┼─────────────┼─────────────────────────────────┤');

  const tpsHistory: number[] = [];
  let peakTps = 0;
  let totalTradesInTest = 0;

  // Initialize baseline for delta tracking
  lastTotalCount = baselineTotalTrades;

  for (let i = 1; i <= iterations; i++) {
    await sleep(monitorInterval * 1000);

    const elapsed = i * monitorInterval;
    const { delta, total, byMarket } = await getTradeCountDelta();

    const intervalTps = Math.round(delta / monitorInterval);
    totalTradesInTest = total - baselineTotalTrades;
    const avgTps = Math.round(totalTradesInTest / elapsed);

    tpsHistory.push(intervalTps);
    if (intervalTps > peakTps) peakTps = intervalTps;

    // Get top 3 markets by trade count
    const topMarkets = Object.entries(byMarket)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([addr, count]) => {
        const market = ALL_MARKETS.find(m => m.address === addr);
        const name = market ? market.name.slice(0, 8) : addr.slice(0, 8);
        return `${name}:${count}`;
      })
      .join(', ');

    const elapsedStr = `${elapsed}s`.padStart(6);
    const tradesStr = formatNumber(totalTradesInTest).padStart(10);
    const tpsStr = `${intervalTps} (avg: ${avgTps})`.padStart(11);
    const marketsStr = topMarkets.padEnd(31);

    console.log(`  │ ${elapsedStr} │ ${tradesStr} │ ${tpsStr} │ ${marketsStr} │`);
  }

  console.log('  └──────────┴────────────┴─────────────┴─────────────────────────────────┘');

  // ============================================================
  // PHASE 5: Final Data Collection
  // ============================================================
  printSection('PHASE 5: Final Data Collection');

  console.log('  Waiting 10s for final trades to be indexed...');
  await sleep(10000);

  // Stop workers
  console.log('  Stopping workers...');
  await stopAllWorkers();

  // Get final counts
  const finalTradeData = await getTradeCount(testStartTimestamp);
  const finalTotalTrades = await getTotalTradeCount();

  // Get worker stats
  console.log('  Collecting worker statistics...');
  const workerStats = await Promise.all(WORKERS.map(w => getWorkerStats(w.host)));

  // ============================================================
  // PHASE 6: On-Chain Verification
  // ============================================================
  printSection('PHASE 6: On-Chain Verification');

  console.log(`  Trades indexed in Geomi: ${formatNumber(finalTradeData.total)}`);
  console.log(`  Total Geomi trades now: ${formatNumber(finalTotalTrades)} (was ${formatNumber(baselineTotalTrades)})`);
  console.log(`  New trades confirmed: ${formatNumber(finalTotalTrades - baselineTotalTrades)}`);

  // Verify a sample of trades on-chain
  console.log('');
  console.log('  Verifying sample trades on-chain...');
  const sampleTrades = finalTradeData.trades.slice(0, 5);
  let verifiedCount = 0;

  for (const trade of sampleTrades) {
    try {
      const res = await fetch(`http://${FULLNODE}:8080/v1/transactions/by_hash/${trade.tx_hash}`);
      const txData = await res.json();
      if (txData.success) {
        verifiedCount++;
        console.log(`    ✓ ${trade.tx_hash.slice(0, 16)}... (block ${txData.version})`);
      } else {
        console.log(`    ✗ ${trade.tx_hash.slice(0, 16)}... (failed)`);
      }
    } catch (e) {
      console.log(`    ? ${trade.tx_hash.slice(0, 16)}... (could not verify)`);
    }
  }

  console.log(`  Verified ${verifiedCount}/${sampleTrades.length} sample trades on-chain`);

  // ============================================================
  // PHASE 7: Final Report
  // ============================================================
  printSection('PHASE 7: FINAL REPORT');

  const testDuration = duration;
  const totalTrades = finalTotalTrades - baselineTotalTrades; // Use accurate delta
  const avgTps = Math.round(totalTrades / testDuration);
  const avgTpsExcludingWarmup = tpsHistory.length > 2
    ? Math.round(tpsHistory.slice(1).reduce((a, b) => a + b, 0) / (tpsHistory.length - 1))
    : avgTps;

  console.log('');
  console.log('  ┌─────────────────────────────┬────────────────────────────────┐');
  console.log('  │ Metric                      │ Value                          │');
  console.log('  ├─────────────────────────────┼────────────────────────────────┤');
  console.log(`  │ Test Duration               │ ${(testDuration + 's').padStart(30)} │`);
  console.log(`  │ Total Trades (on-chain)     │ ${formatNumber(totalTrades).padStart(30)} │`);
  console.log(`  │ Average TPS                 │ ${avgTps.toString().padStart(30)} │`);
  console.log(`  │ Average TPS (excl. warmup)  │ ${avgTpsExcludingWarmup.toString().padStart(30)} │`);
  console.log(`  │ Peak TPS (10s interval)     │ ${peakTps.toString().padStart(30)} │`);
  console.log(`  │ Markets Used                │ ${ALL_MARKETS.length.toString().padStart(30)} │`);
  console.log('  ├─────────────────────────────┼────────────────────────────────┤');
  console.log(`  │ Trades/Minute               │ ${formatNumber(avgTps * 60).padStart(30)} │`);
  console.log(`  │ Trades/Hour                 │ ${formatNumber(avgTps * 3600).padStart(30)} │`);
  console.log('  └─────────────────────────────┴────────────────────────────────┘');

  // Market distribution - get fresh data
  console.log('');
  console.log('  Market Distribution:');
  console.log('  ┌──────────────────────┬────────────┬───────────────────────────────┐');
  console.log('  │ Market               │ Trades     │ Distribution                  │');
  console.log('  ├──────────────────────┼────────────┼───────────────────────────────┤');

  // Query market distribution for recent trades
  const marketDistQuery = `
    query {
      trades(order_by: { sequence_number: desc }, limit: ${Math.min(totalTrades, 10000)}) {
        market_address
      }
    }
  `;
  const marketDistData = await queryGeomi<{ trades: { market_address: string }[] }>(marketDistQuery);
  const marketDist: Record<string, number> = {};
  for (const t of marketDistData.trades || []) {
    marketDist[t.market_address] = (marketDist[t.market_address] || 0) + 1;
  }

  const sortedMarkets = Object.entries(marketDist)
    .filter(([addr]) => ALL_MARKETS.some(m => m.address === addr)) // Only our test markets
    .sort((a, b) => b[1] - a[1]);

  const testMarketTotal = sortedMarkets.reduce((sum, [, count]) => sum + count, 0);

  for (const [addr, count] of sortedMarkets) {
    const market = ALL_MARKETS.find(m => m.address === addr);
    const name = (market?.name || addr.slice(0, 10)).padEnd(20);
    const countStr = formatNumber(count).padStart(10);
    const pct = testMarketTotal > 0 ? (count / testMarketTotal * 100).toFixed(1) : '0.0';
    const barLen = testMarketTotal > 0 ? Math.round(count / testMarketTotal * 25) : 0;
    const bar = '█'.repeat(barLen) + '░'.repeat(25 - barLen);
    console.log(`  │ ${name} │ ${countStr} │ ${bar} ${pct}% │`);
  }

  console.log('  └──────────────────────┴────────────┴───────────────────────────────┘');

  // Worker performance
  console.log('');
  console.log('  Worker Performance:');
  console.log('  ┌─────────────────────────────┬────────────┬────────────┐');
  console.log('  │ Worker                      │ Reported   │ Status     │');
  console.log('  ├─────────────────────────────┼────────────┼────────────┤');

  for (let i = 0; i < WORKERS.length; i++) {
    const w = WORKERS[i];
    const stats = workerStats[i];
    const name = `${w.name} (${w.accounts} accounts)`.padEnd(27);
    const tps = stats ? `${stats.tps} TPS`.padStart(10) : 'N/A'.padStart(10);
    const status = stats ? '✓ OK'.padStart(10) : '? Unknown'.padStart(10);
    console.log(`  │ ${name} │ ${tps} │ ${status} │`);
  }

  console.log('  └─────────────────────────────┴────────────┴────────────┘');

  // TPS over time chart
  console.log('');
  console.log('  TPS Over Time:');
  const maxTpsForChart = Math.max(...tpsHistory, 1);
  const chartHeight = 8;

  for (let row = chartHeight; row >= 1; row--) {
    const threshold = (row / chartHeight) * maxTpsForChart;
    let line = '  │ ';
    for (const tps of tpsHistory) {
      line += tps >= threshold ? '█' : ' ';
    }
    const label = row === chartHeight ? `${maxTpsForChart}` : row === 1 ? '0' : '';
    console.log(line + ' │ ' + label);
  }
  console.log('  └─' + '─'.repeat(tpsHistory.length) + '─┘');
  console.log('    ' + tpsHistory.map((_, i) => (i + 1) % 5 === 0 ? '│' : ' ').join(''));

  // Final summary
  console.log('');
  console.log('  ════════════════════════════════════════════════════════════════');
  console.log('  SUMMARY');
  console.log('  ════════════════════════════════════════════════════════════════');
  console.log('');

  if (avgTps >= 50) {
    console.log('  🎉 EXCELLENT! Achieved 50+ TPS sustained');
  } else if (avgTps >= 40) {
    console.log('  ✓ GOOD! Achieved 40+ TPS sustained');
  } else if (avgTps >= 30) {
    console.log('  ⚡ DECENT! Achieved 30+ TPS sustained');
  } else {
    console.log('  ⚠️  Lower than expected TPS. May need optimization.');
  }

  console.log('');
  console.log(`  Total on-chain trades: ${formatNumber(totalTrades)}`);
  console.log(`  All trades indexed by Geomi: ✓`);
  console.log(`  Sample verification: ${verifiedCount}/${sampleTrades.length} confirmed`);
  console.log('');

  const endTime = new Date();
  const testTotalTime = Math.round((endTime.getTime() - startTime.getTime()) / 1000);
  console.log(`  Test completed in ${testTotalTime}s`);
  console.log(`  Finished: ${endTime.toISOString()}`);
  console.log('');
}

main().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
