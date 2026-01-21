/**
 * FLOOD TEST - Maximum aggressive burst like Dec 28
 *
 * Strategy: Blast as many transactions as possible, no throttling.
 * This mimics the Dec 28 behavior that caused validator backpressure.
 */

import {
  Aptos,
  AptosConfig,
  Network,
  Account,
  Ed25519PrivateKey,
} from '@aptos-labs/ts-sdk';

const CONTRACT_ADDRESS = '0xa2e5e47aab07fed78a3bcf95135ee2dad20c547499c94cb16a3e047859ffa7e1';
const MULTI_MODULE = `${CONTRACT_ADDRESS}::multi_outcome_market`;
const MARKET_ADDRESS = '0xfefd1b67818ee4ef12a7953852c83f0efb411a9b92c518a52ba92555e4abdd96';

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

// FLOOD CONFIG - no limits
const TOTAL_TXNS = parseInt(process.argv[2]) || 5000;  // Target 5000 txns
const CONCURRENT_PER_ACCOUNT = 50;  // 50 concurrent per account = 1000 total

const FULLNODE_URL = process.env.FULLNODE_URL || 'https://aptos.cash.trading/v1';

const aptos = new Aptos(new AptosConfig({
  network: Network.TESTNET,
  fullnode: FULLNODE_URL,
}));

function parsePrivateKey(keyStr: string): Ed25519PrivateKey {
  return new Ed25519PrivateKey(keyStr.replace('ed25519-priv-', ''));
}

let submitted = 0;
let success = 0;
let failed = 0;
const startTime = Date.now();

async function submitOne(account: Account): Promise<void> {
  try {
    const outcomeIndex = Math.floor(Math.random() * 6);
    const isBuy = Math.random() > 0.5;
    const amount = Math.floor(1_000_000 + Math.random() * 10_000_000);

    const tx = await aptos.transaction.build.simple({
      sender: account.accountAddress,
      data: {
        function: `${MULTI_MODULE}::${isBuy ? 'buy_outcome' : 'sell_outcome'}`,
        functionArguments: [MARKET_ADDRESS, outcomeIndex, amount, 0],
      },
      options: {
        replayProtectionNonce: BigInt(Math.floor(Math.random() * Number.MAX_SAFE_INTEGER)),
        expireTimestamp: Math.floor(Date.now() / 1000) + 30,
      },
    });

    const auth = aptos.transaction.sign({ signer: account, transaction: tx });
    await aptos.transaction.submit.simple({ transaction: tx, senderAuthenticator: auth });
    success++;
  } catch {
    failed++;
  }
  submitted++;

  // Progress every 100
  if (submitted % 100 === 0) {
    const elapsed = (Date.now() - startTime) / 1000;
    const tps = Math.round(success / elapsed);
    process.stdout.write(`\r⚡ ${submitted}/${TOTAL_TXNS} | Success: ${success} | ${tps} TPS    `);
  }
}

async function main() {
  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║         💥 FLOOD TEST - MAXIMUM AGGRESSION 💥            ║');
  console.log(`║   Target: ${TOTAL_TXNS} txns | Concurrent: ${CONCURRENT_PER_ACCOUNT * 20}`.padEnd(59) + '║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');

  // Load accounts
  console.log('Loading accounts...');
  const accounts: Account[] = [];
  for (const keyStr of ALL_PRIVATE_KEYS) {
    try {
      accounts.push(Account.fromPrivateKey({ privateKey: parsePrivateKey(keyStr) }));
    } catch {}
  }
  console.log(`✓ Loaded ${accounts.length} accounts\n`);

  console.log('🔥 FLOODING NETWORK...\n');

  // Create all promises upfront
  const promises: Promise<void>[] = [];
  const txnsPerAccount = Math.ceil(TOTAL_TXNS / accounts.length);

  for (const account of accounts) {
    for (let i = 0; i < txnsPerAccount && promises.length < TOTAL_TXNS; i++) {
      promises.push(submitOne(account));
    }
  }

  // Wait for all
  await Promise.all(promises);

  const totalTime = (Date.now() - startTime) / 1000;
  const avgTps = Math.round(success / totalTime);

  console.log('\n\n╔══════════════════════════════════════════════════════════╗');
  console.log('║                    📊 RESULTS                            ║');
  console.log('╠══════════════════════════════════════════════════════════╣');
  console.log(`║  Submitted:       ${submitted.toLocaleString().padStart(8)}`.padEnd(59) + '║');
  console.log(`║  Success:         ${success.toLocaleString().padStart(8)}`.padEnd(59) + '║');
  console.log(`║  Failed:          ${failed.toLocaleString().padStart(8)}`.padEnd(59) + '║');
  console.log('╠══════════════════════════════════════════════════════════╣');
  console.log(`║  Duration:        ${totalTime.toFixed(1).padStart(8)}s`.padEnd(59) + '║');
  console.log(`║  Submission TPS:  ${avgTps.toString().padStart(8)}`.padEnd(59) + '║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');
}

main().catch(console.error);
