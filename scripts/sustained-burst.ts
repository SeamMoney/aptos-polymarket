/**
 * SUSTAINED BURST MODE - Continuous high TPS with tight block clustering
 *
 * Fires bursts of 600 txns every ~1 second for sustained 600+ TPS
 * with tight block clustering (similar to 500-700 txns/block)
 */

import {
  Aptos,
  AptosConfig,
  Network,
  Account,
  Ed25519PrivateKey,
  InputGenerateTransactionPayloadData,
} from '@aptos-labs/ts-sdk';

const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS || '0xa2e5e47aab07fed78a3bcf95135ee2dad20c547499c94cb16a3e047859ffa7e1';
const MULTI_MODULE = `${CONTRACT_ADDRESS}::multi_outcome_market`;
const MARKET_ADDRESS = process.env.MULTI_MARKET || '0xfefd1b67818ee4ef12a7953852c83f0efb411a9b92c518a52ba92555e4abdd96';

// All private keys from all workers
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

// Configuration
const BURST_SIZE = 600;        // Txns per burst (sweet spot for block clustering)
const BURST_INTERVAL_MS = 800; // Fire every 800ms for ~750 TPS sustained
const DURATION_SEC = parseInt(process.argv[2]) || 60; // Default 60 seconds

const FULLNODE_URL = process.env.FULLNODE_URL || 'https://aptos.cash.trading/v1';

const config = new AptosConfig({
  network: Network.TESTNET,
  fullnode: FULLNODE_URL,
});
const aptos = new Aptos(config);

function parsePrivateKey(keyStr: string): Ed25519PrivateKey {
  const cleanKey = keyStr.replace('ed25519-priv-', '');
  return new Ed25519PrivateKey(cleanKey);
}

function buildPayload(): InputGenerateTransactionPayloadData {
  const outcomeIndex = Math.floor(Math.random() * 6);
  const isBuy = Math.random() > 0.5;
  const amount = Math.floor(1_000_000 + Math.random() * 50_000_000);

  if (isBuy) {
    return {
      function: `${MULTI_MODULE}::buy_outcome`,
      functionArguments: [MARKET_ADDRESS, outcomeIndex, amount, 0],
    };
  } else {
    return {
      function: `${MULTI_MODULE}::sell_outcome`,
      functionArguments: [MARKET_ADDRESS, outcomeIndex, amount, 0],
    };
  }
}

// Stats
let totalSubmitted = 0;
let totalSuccess = 0;
let totalFailed = 0;
let burstCount = 0;
let peakTps = 0;
const tpsHistory: number[] = [];

async function fireBurst(accounts: Account[]): Promise<{ success: number; failed: number; timeMs: number }> {
  const txnsPerAccount = Math.ceil(BURST_SIZE / accounts.length);
  const startTime = Date.now();

  // Build and submit all in parallel
  const promises: Promise<boolean>[] = [];

  for (const account of accounts) {
    for (let i = 0; i < txnsPerAccount; i++) {
      const promise = (async () => {
        try {
          const payload = buildPayload();
          const transaction = await aptos.transaction.build.simple({
            sender: account.accountAddress,
            data: payload,
            options: {
              replayProtectionNonce: BigInt(Math.floor(Math.random() * Number.MAX_SAFE_INTEGER)),
              expireTimestamp: Math.floor(Date.now() / 1000) + 60,
            },
          });
          const authenticator = aptos.transaction.sign({ signer: account, transaction });
          await aptos.transaction.submit.simple({ transaction, senderAuthenticator: authenticator });
          return true;
        } catch {
          return false;
        }
      })();
      promises.push(promise);
    }
  }

  const results = await Promise.all(promises);
  const success = results.filter(r => r).length;
  const failed = results.filter(r => !r).length;
  const timeMs = Date.now() - startTime;

  return { success, failed, timeMs };
}

function printStats() {
  const avgTps = tpsHistory.length > 0 ? Math.round(tpsHistory.reduce((a, b) => a + b, 0) / tpsHistory.length) : 0;
  const successRate = totalSubmitted > 0 ? ((totalSuccess / totalSubmitted) * 100).toFixed(1) : '100.0';

  console.log('');
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log(`║  📊 TPS: ${avgTps.toString().padStart(4)} | Peak: ${peakTps.toString().padStart(4)} | Success: ${successRate}%`.padEnd(59) + '║');
  console.log(`║  📈 Bursts: ${burstCount} | Txns: ${totalSubmitted.toLocaleString().padStart(8)}`.padEnd(59) + '║');
  console.log('╚══════════════════════════════════════════════════════════╝');
}

async function main() {
  console.log('');
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║      🔥 SUSTAINED BURST MODE - HIGH TPS 🔥               ║');
  console.log(`║  Burst: ${BURST_SIZE} txns | Interval: ${BURST_INTERVAL_MS}ms | Duration: ${DURATION_SEC}s`.padEnd(59) + '║');
  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log('');

  // Load accounts
  console.log('Loading accounts...');
  const accounts: Account[] = [];
  for (const keyStr of ALL_PRIVATE_KEYS) {
    try {
      const privateKey = parsePrivateKey(keyStr);
      const account = Account.fromPrivateKey({ privateKey });
      accounts.push(account);
    } catch {
      // Skip invalid
    }
  }
  console.log(`✓ Loaded ${accounts.length} accounts`);
  console.log('');
  console.log('Starting sustained burst...');
  console.log('');

  const startTime = Date.now();
  const endTime = startTime + (DURATION_SEC * 1000);

  while (Date.now() < endTime) {
    const burstStart = Date.now();
    const { success, failed, timeMs } = await fireBurst(accounts);

    totalSubmitted += success + failed;
    totalSuccess += success;
    totalFailed += failed;
    burstCount++;

    // Calculate TPS for this burst
    const instantTps = Math.round((success / timeMs) * 1000);
    tpsHistory.push(instantTps);
    if (tpsHistory.length > 30) tpsHistory.shift(); // Keep last 30
    if (instantTps > peakTps) peakTps = instantTps;

    // Progress output
    const elapsed = Math.round((Date.now() - startTime) / 1000);
    const remaining = DURATION_SEC - elapsed;
    process.stdout.write(`\r⚡ Burst #${burstCount} | ${success}/${success + failed} txns | ${instantTps} TPS | ${remaining}s remaining   `);

    // Wait for next burst interval
    const burstDuration = Date.now() - burstStart;
    const waitTime = Math.max(0, BURST_INTERVAL_MS - burstDuration);
    if (waitTime > 0) {
      await new Promise(r => setTimeout(r, waitTime));
    }
  }

  console.log('');
  printStats();
  console.log('');
  console.log('Check Block River to see sustained high-density blocks!');
}

main().catch(console.error);
