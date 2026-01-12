/**
 * Multi-Market TPS Benchmark using Geomi
 *
 * Measures actual on-chain TPS by counting trades in Geomi indexer.
 * More accurate than parsing worker logs.
 *
 * Usage:
 *   npx tsx scripts/benchmark-geomi.ts single 30   # 30s single market test
 *   npx tsx scripts/benchmark-geomi.ts multi 30    # 30s multi-market test
 *   npx tsx scripts/benchmark-geomi.ts compare 30  # Run both and compare
 */

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const GEOMI_URL = 'https://api.testnet.aptoslabs.com/nocode/v1/api/cmk83k7ov0003s6017cgn7stm/v1/graphql';
const API_KEY = 'aptoslabs_9XPRa9Cn5Ym_LS3sjbgqKdh59PBWxoTQyBwszzPT964g8';

const WORKER1 = 'root@178.128.177.88';
const WORKER2 = 'root@147.182.237.239';
const WORKER3 = 'root@161.35.231.0';
const FULLNODE = 'aptos.cash.trading';

const SINGLE_MARKET = '0xfefd1b67818ee4ef12a7953852c83f0efb411a9b92c518a52ba92555e4abdd96';
const MULTI_MARKETS = [
  '0xc47af6adee557eb824c5a82f800d9ca15a6525417d273d9671451a45106870bb',
  '0x3b365cbbc7ea0aa6e18b3dd7d4e2cae6c84fae90d9b5d0c3b1ef8a919ea5a72f',
  '0xa4cc4e98d5f9dd23809ad1cf9f3b44501be2ffae47c06f59fa81df0886f01fa0',
  '0x74bbc4673ebe683d3d0013a1862c369938255071f0b32ac0fb638b476698213a',
  '0x2163cf2a5e8a58b262111e06f6e97818ff0a11418eaedcb28ba3e10a0fdb2d12',
].join(',');

// Account keys
const KEYS_W1 = '0x6e2fca34586261b6f22a973c20024b78ddb370d87f7c974315fb97ba56716a7f,0xe61d22b3dc37c537a20d5b301c4d2b409b2f93cd7b2915f3518d49517c2ab6c4,0x4542c2e4a39beee8202eee0cddeceea886687b21b54b8f50c17e729251fdd7f5,0xcf5154af9664bbc2634fddfcce2317ed788b35de7f004ac0e24aefd68a0b10c5,ed25519-priv-0xb7d1f406e48c2eddffe987f98445dd4a353e8e9d1630d878621ded084bdd77c7,ed25519-priv-0xa8088ee787b847f6304807a8b09d1afc15409082ee9c8b7eda6919b0ecb86ea8,ed25519-priv-0xb5305eb83498dcba61242ccc91fac35263d9b44bddaf5e7417adbaceb1cfcb36';
const KEYS_W2 = 'ed25519-priv-0xc27a6a8b6ed3013da99dc924b2f6af17f1448dedce91691f97d9e778c0761655,ed25519-priv-0xd6402b3493af005ed02b07f6cd7ffdfd37fae6d4d9c88fec6ff38e90f01b21c1,ed25519-priv-0xd375af1a686835905e15bf82f24fcaeed4b1b5b5fabe22c80e998acb804aa295,ed25519-priv-0xC5BA2ED0F5C40EE298E844B1140B6BB31C2671B747C8E9DF4B76054C4C5A8761,ed25519-priv-0x536C886483209657C9B30663B295C7CB007EB57E07931D3E41AF69067897D465,ed25519-priv-0x3E9CB6207207A266F298B1B13648D707BF886766221C3253F30AF68530A79749,ed25519-priv-0x4641D0FDD221B48EF4A45C8DC77D6D4F12D6848E01B7686134564A8CAE5BE637';
const KEYS_W3 = 'ed25519-priv-0xFB2AFF37DFED247E9CF407FFA41208A41A78877C1990ADD1F94E00FCE1A5CCAC,ed25519-priv-0x9E338A7FB43F8280CCD82B2929B66F4ED1B7AA7900C40E06EAD934BC7CDEF315,ed25519-priv-0x8E7D4B0196840DA3A7BA6EDEF3784E1B961263F06651B130F440F5D974920B1F,ed25519-priv-0x975CF351CE096E1350C9F9E89ED5CB8D7BEAAEBF7FC235B10F1A0852355EED7A,ed25519-priv-0xD945B44FCFA961B9E4F8DAA5139CF6B4CE9A1DF4838C75701EDC8A429739C097,ed25519-priv-0x292A25EDBE90DCB5F682908C1E7185E1CC127FAD74EEA218167115AA5962866C';

interface TradeCount {
  total: number;
  byMarket: Record<string, number>;
  startTime: string;
  endTime: string;
}

async function queryGeomi<T>(query: string): Promise<T> {
  const res = await fetch(GEOMI_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${API_KEY}` },
    body: JSON.stringify({ query }),
  });
  const data = await res.json();
  return data.data;
}

async function getTradeCount(since: string): Promise<TradeCount> {
  const query = `
    query {
      trades(
        where: { timestamp: { _gte: "${since}" } }
        order_by: { timestamp: desc }
        limit: 10000
      ) {
        market_address
        timestamp
      }
    }
  `;

  const data = await queryGeomi<{ trades: { market_address: string; timestamp: string }[] }>(query);
  const trades = data.trades || [];

  const byMarket: Record<string, number> = {};
  for (const t of trades) {
    const prefix = t.market_address.slice(0, 10);
    byMarket[prefix] = (byMarket[prefix] || 0) + 1;
  }

  return {
    total: trades.length,
    byMarket,
    startTime: trades.length > 0 ? trades[trades.length - 1].timestamp : '',
    endTime: trades.length > 0 ? trades[0].timestamp : '',
  };
}

async function stopWorkers(): Promise<void> {
  console.log('  Stopping workers...');
  await Promise.all([
    execAsync(`ssh ${WORKER1} 'pkill -9 -f "hft-ultra" 2>/dev/null || true'`).catch(() => {}),
    execAsync(`ssh ${WORKER2} 'pkill -9 -f "hft-ultra" 2>/dev/null || true'`).catch(() => {}),
    execAsync(`ssh ${WORKER3} 'pkill -9 -f "hft-ultra" 2>/dev/null || true'`).catch(() => {}),
  ]);
  await new Promise((r) => setTimeout(r, 3000));
}

async function startWorkers(mode: 'single' | 'multi', duration: number): Promise<void> {
  const marketEnv = mode === 'single'
    ? `export MULTI_MARKET="${SINGLE_MARKET}"`
    : `export MULTI_MARKETS="${MULTI_MARKETS}"`;

  const commonEnv = `
export ULTRA_PRIVATE_KEYS="KEYS_PLACEHOLDER"
export APTOS_API_KEY="AG-3JMDT54EN4DCLULDWAUXCYGQ56JJQCYHH"
export FULLNODE_URL="http://${FULLNODE}:8080/v1"
export CONTRACT_ADDRESS="0xa2e5e47aab07fed78a3bcf95135ee2dad20c547499c94cb16a3e047859ffa7e1"
${marketEnv}
export HFT_PORT=3001
cd /opt/aptos-hft && npx tsx hft-ultra-server.ts quantum ${duration}
`;

  console.log(`  Starting workers in ${mode.toUpperCase()} market mode...`);

  // Start all workers
  await Promise.all([
    execAsync(`ssh ${WORKER1} 'cat > /tmp/run.sh << "EOF"\n${commonEnv.replace('KEYS_PLACEHOLDER', KEYS_W1)}\nEOF\nchmod +x /tmp/run.sh && nohup bash /tmp/run.sh > /tmp/hft.log 2>&1 &'`),
    execAsync(`ssh ${WORKER2} 'cat > /tmp/run.sh << "EOF"\n${commonEnv.replace('KEYS_PLACEHOLDER', KEYS_W2)}\nEOF\nchmod +x /tmp/run.sh && nohup bash /tmp/run.sh > /tmp/hft.log 2>&1 &'`),
    execAsync(`ssh ${WORKER3} 'cat > /tmp/run.sh << "EOF"\n${commonEnv.replace('KEYS_PLACEHOLDER', KEYS_W3)}\nEOF\nchmod +x /tmp/run.sh && nohup bash /tmp/run.sh > /tmp/hft.log 2>&1 &'`),
  ]);

  // Wait for initialization
  console.log('  Waiting 10s for initialization...');
  await new Promise((r) => setTimeout(r, 10000));
}

async function runTest(mode: 'single' | 'multi', duration: number): Promise<{ tps: number; total: number; byMarket: Record<string, number> }> {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`  TEST: ${mode.toUpperCase()} MARKET (${duration}s)`);
  console.log(`${'='.repeat(60)}`);

  await stopWorkers();

  // Get timestamp before starting
  const startTimestamp = new Date().toISOString().slice(0, 19);
  console.log(`  Start timestamp: ${startTimestamp}`);

  await startWorkers(mode, duration);

  // Monitor progress every 10s
  console.log('\n  Progress:');
  for (let elapsed = 10; elapsed <= duration; elapsed += 10) {
    await new Promise((r) => setTimeout(r, 10000));
    const count = await getTradeCount(startTimestamp);
    const currentTps = Math.round(count.total / elapsed);
    console.log(`    [${elapsed}s] ${count.total} trades (${currentTps} TPS)`);
  }

  // Wait for final trades to land
  console.log('  Waiting 5s for final trades to index...');
  await new Promise((r) => setTimeout(r, 5000));

  // Get final count
  const finalCount = await getTradeCount(startTimestamp);
  const tps = Math.round(finalCount.total / duration);

  console.log(`\n  Results:`);
  console.log(`    Total trades: ${finalCount.total}`);
  console.log(`    Average TPS: ${tps}`);
  console.log(`    Markets:`);
  for (const [market, count] of Object.entries(finalCount.byMarket).sort((a, b) => b[1] - a[1])) {
    console.log(`      ${market}...: ${count}`);
  }

  await stopWorkers();

  return { tps, total: finalCount.total, byMarket: finalCount.byMarket };
}

async function main() {
  const mode = process.argv[2] as 'single' | 'multi' | 'compare' || 'compare';
  const duration = parseInt(process.argv[3]) || 30;

  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║  🔬 MULTI-MARKET TPS BENCHMARK (Geomi-based)                 ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log(`  Mode: ${mode}`);
  console.log(`  Duration: ${duration}s per test`);
  console.log(`  Workers: 3 (20 accounts)`);

  let singleResult: { tps: number; total: number; byMarket: Record<string, number> } | null = null;
  let multiResult: { tps: number; total: number; byMarket: Record<string, number> } | null = null;

  if (mode === 'single' || mode === 'compare') {
    singleResult = await runTest('single', duration);
  }

  if (mode === 'multi' || mode === 'compare') {
    multiResult = await runTest('multi', duration);
  }

  if (mode === 'compare' && singleResult && multiResult) {
    const improvement = ((multiResult.tps - singleResult.tps) / singleResult.tps * 100).toFixed(1);

    console.log('\n' + '═'.repeat(60));
    console.log('  📊 COMPARISON RESULTS');
    console.log('═'.repeat(60));
    console.log('');
    console.log('  ┌─────────────────────┬────────────────┬────────────────┐');
    console.log('  │ Metric              │ Single Market  │ Multi-Market   │');
    console.log('  ├─────────────────────┼────────────────┼────────────────┤');
    console.log(`  │ Average TPS         │ ${String(singleResult.tps).padStart(14)} │ ${String(multiResult.tps).padStart(14)} │`);
    console.log(`  │ Total Trades        │ ${String(singleResult.total).padStart(14)} │ ${String(multiResult.total).padStart(14)} │`);
    console.log(`  │ Markets Used        │ ${String(Object.keys(singleResult.byMarket).length).padStart(14)} │ ${String(Object.keys(multiResult.byMarket).length).padStart(14)} │`);
    console.log('  ├─────────────────────┼────────────────┼────────────────┤');
    console.log(`  │ TPS Improvement     │     baseline   │ ${('+' + improvement + '%').padStart(13)} │`);
    console.log('  └─────────────────────┴────────────────┴────────────────┘');
    console.log('');

    if (multiResult.tps > singleResult.tps) {
      console.log('  ✅ Multi-market configuration is FASTER!');
      console.log('     Spreading trades across markets reduced aggregator contention.');
    } else {
      console.log('  ⚠️  Results may need longer test duration for accuracy.');
    }
  }

  console.log('\n  Done.');
}

main().catch(console.error);
