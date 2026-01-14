/**
 * BURST MODE - Target 500+ transactions in a single block
 *
 * Strategy:
 * 1. Load ALL accounts from all workers
 * 2. Build ALL transactions in parallel (not submitted yet)
 * 3. Submit ALL at exact same millisecond
 * 4. Fire-and-forget style
 *
 * Target: 500+ txns landing in same block (400ms window)
 */

import {
  Aptos,
  AptosConfig,
  Network,
  Account,
  Ed25519PrivateKey,
  InputGenerateTransactionPayloadData,
  SimpleTransaction,
  AccountAuthenticator,
} from '@aptos-labs/ts-sdk';

const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS || '0xda51d5f87be27cac0a1d72fe500da145c61b2356547ac811e0cd822c80f99a3b';
const MULTI_MODULE = `${CONTRACT_ADDRESS}::multi_outcome_market`;
// Support both MULTI_MARKET (singular) and MULTI_MARKETS (plural, comma-separated)
const MARKET_ADDRESS = process.env.MULTI_MARKET || (process.env.MULTI_MARKETS?.split(',')[0]) || '0xdda603f5809b7e3c873f50ca06137e895883498836d3581894baa69d9e1e79e1';

// All private keys from all workers
const ALL_PRIVATE_KEYS = [
  // Worker 1 (7 accounts)
  '0x6e2fca34586261b6f22a973c20024b78ddb370d87f7c974315fb97ba56716a7f',
  '0xe61d22b3dc37c537a20d5b301c4d2b409b2f93cd7b2915f3518d49517c2ab6c4',
  '0x4542c2e4a39beee8202eee0cddeceea886687b21b54b8f50c17e729251fdd7f5',
  '0xcf5154af9664bbc2634fddfcce2317ed788b35de7f004ac0e24aefd68a0b10c5',
  'ed25519-priv-0xb7d1f406e48c2eddffe987f98445dd4a353e8e9d1630d878621ded084bdd77c7',
  'ed25519-priv-0xa8088ee787b847f6304807a8b09d1afc15409082ee9c8b7eda6919b0ecb86ea8',
  'ed25519-priv-0xb5305eb83498dcba61242ccc91fac35263d9b44bddaf5e7417adbaceb1cfcb36',
  // Worker 2 (7 accounts)
  'ed25519-priv-0xc27a6a8b6ed3013da99dc924b2f6af17f1448dedce91691f97d9e778c0761655',
  'ed25519-priv-0xd6402b3493af005ed02b07f6cd7ffdfd37fae6d4d9c88fec6ff38e90f01b21c1',
  'ed25519-priv-0xd375af1a686835905e15bf82f24fcaeed4b1b5b5fabe22c80e998acb804aa295',
  'ed25519-priv-0xC5BA2ED0F5C40EE298E844B1140B6BB31C2671B747C8E9DF4B76054C4C5A8761',
  'ed25519-priv-0x536C886483209657C9B30663B295C7CB007EB57E07931D3E41AF69067897D465',
  'ed25519-priv-0x3E9CB6207207A266F298B1B13648D707BF886766221C3253F30AF68530A79749',
  'ed25519-priv-0x4641D0FDD221B48EF4A45C8DC77D6D4F12D6848E01B7686134564A8CAE5BE637',
  // Worker 3 (6 accounts)
  'ed25519-priv-0xFB2AFF37DFED247E9CF407FFA41208A41A78877C1990ADD1F94E00FCE1A5CCAC',
  'ed25519-priv-0x9E338A7FB43F8280CCD82B2929B66F4ED1B7AA7900C40E06EAD934BC7CDEF315',
  'ed25519-priv-0x8E7D4B0196840DA3A7BA6EDEF3784E1B961263F06651B130F440F5D974920B1F',
  'ed25519-priv-0x975CF351CE096E1350C9F9E89ED5CB8D7BEAAEBF7FC235B10F1A0852355EED7A',
  'ed25519-priv-0xD945B44FCFA961B9E4F8DAA5139CF6B4CE9A1DF4838C75701EDC8A429739C097',
  'ed25519-priv-0x292A25EDBE90DCB5F682908C1E7185E1CC127FAD74EEA218167115AA5962866C',
];

// Configuration - GO HAM!
const TXNS_PER_ACCOUNT = 35;  // Each account fires 35 txns
const TARGET_TOTAL = 700;     // Target 700 txns in one burst

// RPC - use your fullnode for no rate limits
const FULLNODE_URL = process.env.FULLNODE_URL || 'https://aptos.cash.trading/v1';

const config = new AptosConfig({
  network: Network.TESTNET,
  fullnode: FULLNODE_URL,
});
const aptos = new Aptos(config);

// Parse private key
function parsePrivateKey(keyStr: string): Ed25519PrivateKey {
  const cleanKey = keyStr.replace('ed25519-priv-', '');
  return new Ed25519PrivateKey(cleanKey);
}

// Build random trade payload
function buildPayload(): InputGenerateTransactionPayloadData {
  const outcomeIndex = Math.floor(Math.random() * 4); // Markets have 2-4 outcomes, index 0-3
  // 100% buys for max success rate - sells often fail with no shares
  const amount = Math.floor(1_000_000 + Math.random() * 10_000_000); // 0.01-0.1 USD1 (8 decimals)

  return {
    function: `${MULTI_MODULE}::buy_outcome`,
    functionArguments: [MARKET_ADDRESS, outcomeIndex, amount, 0],
  };
}

interface PreparedTx {
  account: Account;
  transaction: SimpleTransaction;
  authenticator: AccountAuthenticator;
}

async function main() {
  console.log('');
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║          💥 BURST MODE - 500+ TXNS/BLOCK 💥              ║');
  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log('');

  // Step 1: Load all accounts
  console.log('[1/4] Loading accounts...');
  const accounts: Account[] = [];
  for (const keyStr of ALL_PRIVATE_KEYS) {
    try {
      const privateKey = parsePrivateKey(keyStr);
      const account = Account.fromPrivateKey({ privateKey });
      accounts.push(account);
    } catch (e) {
      console.log(`  Skip invalid key: ${keyStr.slice(0, 20)}...`);
    }
  }
  console.log(`  ✓ Loaded ${accounts.length} accounts`);
  console.log('');

  const txnsPerAccount = Math.ceil(TARGET_TOTAL / accounts.length);
  const totalTxns = accounts.length * txnsPerAccount;

  console.log(`[2/4] Building ${totalTxns} transactions (${txnsPerAccount} per account)...`);
  const startBuild = Date.now();

  // Build ALL transactions in parallel
  const preparedTxs: PreparedTx[] = [];
  const buildPromises: Promise<void>[] = [];

  for (const account of accounts) {
    for (let i = 0; i < txnsPerAccount; i++) {
      const promise = (async () => {
        const payload = buildPayload();
        const transaction = await aptos.transaction.build.simple({
          sender: account.accountAddress,
          data: payload,
          options: {
            // Orderless transaction - no sequence number needed
            replayProtectionNonce: BigInt(Math.floor(Math.random() * Number.MAX_SAFE_INTEGER)),
            expireTimestamp: Math.floor(Date.now() / 1000) + 60,
          },
        });
        const authenticator = aptos.transaction.sign({ signer: account, transaction });
        preparedTxs.push({ account, transaction, authenticator });
      })();
      buildPromises.push(promise);
    }
  }

  await Promise.all(buildPromises);
  const buildTime = Date.now() - startBuild;
  console.log(`  ✓ Built ${preparedTxs.length} transactions in ${buildTime}ms`);
  console.log('');

  // Step 3: Submit ALL at once
  console.log(`[3/4] 🚀 SUBMITTING ${preparedTxs.length} TRANSACTIONS SIMULTANEOUSLY...`);
  const startSubmit = Date.now();

  // Fire ALL without waiting
  const submitPromises = preparedTxs.map(({ transaction, authenticator }) =>
    aptos.transaction.submit.simple({ transaction, senderAuthenticator: authenticator })
      .then(pending => ({ success: true, hash: pending.hash }))
      .catch(err => ({ success: false, error: err.message }))
  );

  // Wait for all submissions (not confirmations)
  const results = await Promise.all(submitPromises);
  const submitTime = Date.now() - startSubmit;

  const successful = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;

  console.log(`  ✓ Submitted in ${submitTime}ms`);
  console.log(`  ✓ Success: ${successful} | Failed: ${failed}`);
  console.log('');

  // Step 4: Check how many landed in same block
  console.log('[4/4] Checking block placement...');
  await new Promise(r => setTimeout(r, 2000)); // Wait for confirmations

  // Sample a few txns to check their blocks
  const successfulTxs = results.filter(r => r.success && 'hash' in r);
  const sampleSize = Math.min(20, successfulTxs.length);
  const versions: number[] = [];

  for (let i = 0; i < sampleSize; i++) {
    const tx = successfulTxs[i];
    if ('hash' in tx) {
      try {
        const txData = await aptos.getTransactionByHash({ transactionHash: tx.hash });
        if ('version' in txData) {
          versions.push(Number(txData.version));
        }
      } catch {
        // Skip failed lookups
      }
    }
  }

  if (versions.length > 0) {
    const minVersion = Math.min(...versions);
    const maxVersion = Math.max(...versions);
    const spread = maxVersion - minVersion;
    console.log(`  Sample ${versions.length} txns:`);
    console.log(`  Version range: ${minVersion} - ${maxVersion}`);
    console.log(`  Spread: ${spread} versions`);
    console.log('');

    if (spread < 100) {
      console.log('  ✅ EXCELLENT! Transactions are tightly clustered');
    } else if (spread < 500) {
      console.log('  ✓ Good - transactions span a few blocks');
    } else {
      console.log('  ⚠️  Transactions are spread across many blocks');
    }
  }

  console.log('');
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log(`║  BURST COMPLETE: ${successful}/${preparedTxs.length} submitted in ${submitTime}ms`);
  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log('');
  console.log('Check Block River visualization to see the burst!');
}

main().catch(console.error);
