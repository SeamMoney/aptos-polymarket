/**
 * MAX TPS LOCAL - Maximum throughput from local machine
 *
 * Targets 5K+ TPS using:
 * - All 20 accounts
 * - Orderless transactions (replay protection nonce)
 * - Large parallel batches
 * - Direct fullnode connection
 * - Keep-alive connections
 */

import {
  Aptos,
  AptosConfig,
  Network,
  Account,
  Ed25519PrivateKey,
} from '@aptos-labs/ts-sdk';
import http from 'http';
import https from 'https';

// USD1 v2 Contract with admin drainers (Jan 11, 2026)
const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS || '0xbdea15f5b0f5449ae8f3a6ae95a5e090bdeeec91be1fcac8375b2f5f37f1c134';
const MULTI_MODULE = `${CONTRACT_ADDRESS}::multi_outcome_market`;

// 12 USD1-backed markets
const USD1_MARKETS = [
  '0x3e690f317df664c413e12b15eaa6e5565606fbd46628464f84f93e0674a3c052',
  '0xf3256638cad294e47c8cc6bb1a6a0fdd85b29ef427b3118028c34b9f061aa50d',
  '0x192f7cfc0c8151deec37c6280c17b55f7557a04b580b486d6076cc11955ddde3',
  '0x9e4583c0af174a119b5316ae84988f4fd988259de35ef95447b371744a355762',
  '0xd82731a9a2259ccfef2fd13db13720c7cc927c5b7879aa160aecc618c4d4654f',
  '0x77a65b92664f992ccbd8a17d73a5f2fc933523ce64a1c475d1db1c0fc2acf42a',
  '0xa84ba7b7364a40031e29d355d7a5f48fd54f922c8eed0ed0009c5d660a6da339',
  '0x8187c1b3b7ca06dbcbac36fe280e0b5343b744c5a299a43263f9162738d4d792',
  '0x551f153ff61f94311a22592550b0ede4b3b57338af161bd9472f21e15da23b4b',
  '0x742e3c66cb6570351ceb7cf1b2df87e726c708b786109a8cdae93b0c3c7b5a04',
  '0x35df09c98f8668c06f6777e98e3a0405fe894c271f06ba2fed0b322e2a5c2f16',
  '0xd3227afa81dce5fa0e8f86f61dc7f3215ee799a0d2e6a112a988e5ac732bf719',
];
const MARKET_ADDRESS = process.env.MULTI_MARKET || USD1_MARKETS[0];
let marketIndex = 0;

const ALL_PRIVATE_KEYS = [
  '0x6e2fca34586261b6f22a973c20024b78ddb370d87f7c974315fb97ba56716a7f',
  '0xe61d22b3dc37c537a20d5b301c4d2b409b2f93cd7b2915f3518d49517c2ab6c4',
  '0x4542c2e4a39beee8202eee0cddeceea886687b21b54b8f50c17e729251fdd7f5',
  '0xcf5154af9664bbc2634fddfcce2317ed788b35de7f004ac0e24aefd68a0b10c5',
  'ed25519-priv-0xb7d1f406e48c2eddffe987f98445dd4a353e8e9d1630d878621ded084bdd77c7',
  'ed25519-priv-0xa8088ee787b847f6304807a8b09d1afc15409082ee9c8b7eda6919b0ecb86ea8',
  'ed25519-priv-0xb5305eb83498dcba61242ccc91fac35263d9b44bddaf5e7417adbaceb1cfcb36',
  'ed25519-priv-0xc27a6a8b6ed3013da99dc924b2f6af17f1448dedce91691f97d9e778c0761655',
  'ed25519-priv-0xd6402b3493af005ed02b07f6cd7ffdfd37fae6d4d9c88fec6ff38e90f01b21c1',
  'ed25519-priv-0xd375af1a686835905e15bf82f24fcaeed4b1b5b5fabe22c80e998acb804aa295',
  'ed25519-priv-0xC5BA2ED0F5C40EE298E844B1140B6BB31C2671B747C8E9DF4B76054C4C5A8761',
  'ed25519-priv-0x536C886483209657C9B30663B295C7CB007EB57E07931D3E41AF69067897D465',
  'ed25519-priv-0x3E9CB6207207A266F298B1B13648D707BF886766221C3253F30AF68530A79749',
  'ed25519-priv-0x4641D0FDD221B48EF4A45C8DC77D6D4F12D6848E01B7686134564A8CAE5BE637',
  'ed25519-priv-0xFB2AFF37DFED247E9CF407FFA41208A41A78877C1990ADD1F94E00FCE1A5CCAC',
  'ed25519-priv-0x9E338A7FB43F8280CCD82B2929B66F4ED1B7AA7900C40E06EAD934BC7CDEF315',
  'ed25519-priv-0x8E7D4B0196840DA3A7BA6EDEF3784E1B961263F06651B130F440F5D974920B1F',
  'ed25519-priv-0x975CF351CE096E1350C9F9E89ED5CB8D7BEAAEBF7FC235B10F1A0852355EED7A',
  'ed25519-priv-0xD945B44FCFA961B9E4F8DAA5139CF6B4CE9A1DF4838C75701EDC8A429739C097',
  'ed25519-priv-0x292A25EDBE90DCB5F682908C1E7185E1CC127FAD74EEA218167115AA5962866C',
];

// Configuration - tuned for max throughput
const TXNS_PER_ACCOUNT = 20;   // 20 txns per account per wave = 400 total
const WAVE_INTERVAL_MS = 100;  // 100ms between waves = 10 waves/sec
const DURATION_SEC = parseInt(process.argv[2]) || 15;

const FULLNODE_URL = process.env.FULLNODE_URL || 'https://aptos.cash.trading/v1';

// Create Aptos client with keep-alive agents
const httpAgent = new http.Agent({
  keepAlive: true,
  maxSockets: 100,
  keepAliveMsecs: 30000,
});
const httpsAgent = new https.Agent({
  keepAlive: true,
  maxSockets: 100,
  keepAliveMsecs: 30000,
});

const config = new AptosConfig({
  network: Network.TESTNET,
  fullnode: FULLNODE_URL,
  clientConfig: {
    HEADERS: { 'Connection': 'keep-alive' },
  },
});
const aptos = new Aptos(config);

function parsePrivateKey(keyStr: string): Ed25519PrivateKey {
  const cleanKey = keyStr.replace('ed25519-priv-', '');
  return new Ed25519PrivateKey(cleanKey);
}

// Stats
let totalSubmitted = 0;
let totalSuccess = 0;
let totalFailed = 0;
let waveCount = 0;
let peakTps = 0;
const tpsHistory: number[] = [];

async function submitTxn(account: Account): Promise<boolean> {
  try {
    // Round-robin across 12 markets for parallel execution
    const currentMarket = USD1_MARKETS[marketIndex % USD1_MARKETS.length];
    marketIndex++;

    const outcomeIndex = Math.floor(Math.random() * 6);
    const isBuy = Math.random() > 0.5;
    const amount = Math.floor(1_000_000 + Math.random() * 50_000_000);

    const payload = isBuy
      ? { function: `${MULTI_MODULE}::buy_outcome` as const, functionArguments: [currentMarket, outcomeIndex, amount, 0] }
      : { function: `${MULTI_MODULE}::sell_outcome` as const, functionArguments: [currentMarket, outcomeIndex, amount, 0] };

    const transaction = await aptos.transaction.build.simple({
      sender: account.accountAddress,
      data: payload,
      options: {
        replayProtectionNonce: BigInt(Math.floor(Math.random() * Number.MAX_SAFE_INTEGER)),
        expireTimestamp: Math.floor(Date.now() / 1000) + 30,
      },
    });

    const authenticator = aptos.transaction.sign({ signer: account, transaction });
    await aptos.transaction.submit.simple({ transaction, senderAuthenticator: authenticator });
    return true;
  } catch {
    return false;
  }
}

async function fireWave(accounts: Account[]): Promise<{ success: number; failed: number; timeMs: number }> {
  const startTime = Date.now();
  const promises: Promise<boolean>[] = [];

  // Each account fires TXNS_PER_ACCOUNT transactions in parallel
  for (const account of accounts) {
    for (let i = 0; i < TXNS_PER_ACCOUNT; i++) {
      promises.push(submitTxn(account));
    }
  }

  const results = await Promise.all(promises);
  const success = results.filter(r => r).length;
  const failed = results.filter(r => !r).length;
  const timeMs = Date.now() - startTime;

  return { success, failed, timeMs };
}

async function main() {
  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║      🚀 MAX TPS LOCAL - TARGET: 5000+ TPS 🚀             ║');
  console.log(`║  Accounts: 20 | Txns/Account/Wave: ${TXNS_PER_ACCOUNT} | Duration: ${DURATION_SEC}s`.padEnd(59) + '║');
  console.log(`║  Wave Interval: ${WAVE_INTERVAL_MS}ms | Target: ${(20 * TXNS_PER_ACCOUNT * 1000 / WAVE_INTERVAL_MS).toFixed(0)} TPS`.padEnd(59) + '║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');

  // Load accounts
  console.log('Loading accounts...');
  const accounts: Account[] = [];
  for (const keyStr of ALL_PRIVATE_KEYS) {
    try {
      const privateKey = parsePrivateKey(keyStr);
      accounts.push(Account.fromPrivateKey({ privateKey }));
    } catch { /* skip invalid */ }
  }
  console.log(`✓ Loaded ${accounts.length} accounts\n`);

  const startTime = Date.now();
  const endTime = startTime + (DURATION_SEC * 1000);

  console.log('🔥 Starting max throughput burst...\n');

  while (Date.now() < endTime) {
    const waveStart = Date.now();
    const { success, failed, timeMs } = await fireWave(accounts);

    totalSubmitted += success + failed;
    totalSuccess += success;
    totalFailed += failed;
    waveCount++;

    const instantTps = Math.round((success / timeMs) * 1000);
    tpsHistory.push(instantTps);
    if (tpsHistory.length > 30) tpsHistory.shift();
    if (instantTps > peakTps) peakTps = instantTps;

    const elapsed = Math.round((Date.now() - startTime) / 1000);
    const remaining = DURATION_SEC - elapsed;
    const avgTps = Math.round(totalSuccess / ((Date.now() - startTime) / 1000));

    process.stdout.write(`\r⚡ Wave #${waveCount} | ${success}/${success + failed} | ${instantTps} TPS | Avg: ${avgTps} TPS | ${remaining}s    `);

    // Wait for next wave
    const waitTime = Math.max(0, WAVE_INTERVAL_MS - (Date.now() - waveStart));
    if (waitTime > 0) await new Promise(r => setTimeout(r, waitTime));
  }

  const totalTime = (Date.now() - startTime) / 1000;
  const avgTps = Math.round(totalSuccess / totalTime);
  const successRate = totalSubmitted > 0 ? ((totalSuccess / totalSubmitted) * 100).toFixed(1) : '0';

  console.log('\n\n╔══════════════════════════════════════════════════════════╗');
  console.log('║                    📊 RESULTS                            ║');
  console.log('╠══════════════════════════════════════════════════════════╣');
  console.log(`║  Total Submitted: ${totalSubmitted.toLocaleString().padStart(8)}`.padEnd(59) + '║');
  console.log(`║  Success Rate:    ${successRate}%`.padEnd(59) + '║');
  console.log(`║  Waves:           ${waveCount}`.padEnd(59) + '║');
  console.log('╠══════════════════════════════════════════════════════════╣');
  console.log(`║  Average TPS:     ${avgTps.toString().padStart(5)} txns/sec`.padEnd(59) + '║');
  console.log(`║  Peak TPS:        ${peakTps.toString().padStart(5)} txns/sec`.padEnd(59) + '║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');

  console.log('💡 Check Geomi to verify on-chain trades.');
  console.log('   curl -s "https://api.testnet.aptoslabs.com/nocode/v1/api/.../v1/graphql" ...');
}

main().catch(console.error);
