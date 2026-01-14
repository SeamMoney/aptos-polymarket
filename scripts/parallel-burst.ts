/**
 * PARALLEL BURST - Split accounts across parallel workers for max throughput
 *
 * Usage: WORKER_ID=0 TOTAL_WORKERS=4 npx tsx scripts/parallel-burst.ts
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
const MARKETS = (process.env.MULTI_MARKETS || '0xdda603f5809b7e3c873f50ca06137e895883498836d3581894baa69d9e1e79e1').split(',');

const FALLBACK_KEYS = [
  '0x6e2fca34586261b6f22a973c20024b78ddb370d87f7c974315fb97ba56716a7f',
  '0xe61d22b3dc37c537a20d5b301c4d2b409b2f93cd7b2915f3518d49517c2ab6c4',
  '0x4542c2e4a39beee8202eee0cddeceea886687b21b54b8f50c17e729251fdd7f5',
  '0xcf5154af9664bbc2634fddfcce2317ed788b35de7f004ac0e24aefd68a0b10c5',
  '0xb7d1f406e48c2eddffe987f98445dd4a353e8e9d1630d878621ded084bdd77c7',
  '0xa8088ee787b847f6304807a8b09d1afc15409082ee9c8b7eda6919b0ecb86ea8',
  '0xb5305eb83498dcba61242ccc91fac35263d9b44bddaf5e7417adbaceb1cfcb36',
  '0xc27a6a8b6ed3013da99dc924b2f6af17f1448dedce91691f97d9e778c0761655',
  '0xd6402b3493af005ed02b07f6cd7ffdfd37fae6d4d9c88fec6ff38e90f01b21c1',
  '0xd375af1a686835905e15bf82f24fcaeed4b1b5b5fabe22c80e998acb804aa295',
  '0xC5BA2ED0F5C40EE298E844B1140B6BB31C2671B747C8E9DF4B76054C4C5A8761',
  '0x536C886483209657C9B30663B295C7CB007EB57E07931D3E41AF69067897D465',
  '0x3E9CB6207207A266F298B1B13648D707BF886766221C3253F30AF68530A79749',
  '0x4641D0FDD221B48EF4A45C8DC77D6D4F12D6848E01B7686134564A8CAE5BE637',
  '0xFB2AFF37DFED247E9CF407FFA41208A41A78877C1990ADD1F94E00FCE1A5CCAC',
  '0x9E338A7FB43F8280CCD82B2929B66F4ED1B7AA7900C40E06EAD934BC7CDEF315',
  '0x8E7D4B0196840DA3A7BA6EDEF3784E1B961263F06651B130F440F5D974920B1F',
  '0x975CF351CE096E1350C9F9E89ED5CB8D7BEAAEBF7FC235B10F1A0852355EED7A',
  '0xD945B44FCFA961B9E4F8DAA5139CF6B4CE9A1DF4838C75701EDC8A429739C097',
  '0x292A25EDBE90DCB5F682908C1E7185E1CC127FAD74EEA218167115AA5962866C',
];

const ALL_KEYS = (process.env.ULTRA_PRIVATE_KEYS || '').split(',').filter(k => k.length > 0);
const PRIVATE_KEYS = ALL_KEYS.length > 0 ? ALL_KEYS : FALLBACK_KEYS;

const WORKER_ID = parseInt(process.env.WORKER_ID || '0');
const TOTAL_WORKERS = parseInt(process.env.TOTAL_WORKERS || '4');
const TXNS_PER_ACCOUNT = parseInt(process.env.TXNS_PER_ACCOUNT || '300');

const FULLNODE_URL = process.env.FULLNODE_URL || 'http://aptos.cash.trading:8080/v1';

const config = new AptosConfig({
  network: Network.TESTNET,
  fullnode: FULLNODE_URL,
});
const aptos = new Aptos(config);

function parsePrivateKey(keyStr: string): Ed25519PrivateKey {
  const cleanKey = keyStr.replace('ed25519-priv-', '').replace(/^0x/i, '');
  return new Ed25519PrivateKey('0x' + cleanKey.toLowerCase());
}

function buildPayload(): InputGenerateTransactionPayloadData {
  const market = MARKETS[Math.floor(Math.random() * MARKETS.length)];
  const outcomeIndex = Math.floor(Math.random() * 4);
  const amount = Math.floor(500_000 + Math.random() * 2_000_000);
  return {
    function: `${MULTI_MODULE}::buy_outcome`,
    functionArguments: [market, outcomeIndex, amount, 0],
  };
}

interface PreparedTx {
  transaction: SimpleTransaction;
  authenticator: AccountAuthenticator;
}

async function main() {
  // Split accounts across workers
  const myKeys = PRIVATE_KEYS.filter((_, i) => i % TOTAL_WORKERS === WORKER_ID);

  console.log(`[Worker ${WORKER_ID}/${TOTAL_WORKERS}] Loading ${myKeys.length} accounts...`);

  const accounts: Account[] = [];
  for (const keyStr of myKeys) {
    try {
      const privateKey = parsePrivateKey(keyStr);
      const account = Account.fromPrivateKey({ privateKey });
      accounts.push(account);
    } catch {}
  }

  if (accounts.length === 0) {
    console.log(`[Worker ${WORKER_ID}] No accounts!`);
    return;
  }

  const totalTxns = accounts.length * TXNS_PER_ACCOUNT;
  console.log(`[Worker ${WORKER_ID}] ${accounts.length} accounts, ${totalTxns} txns`);

  // Get sequence numbers
  const sequenceNumbers: Map<string, bigint> = new Map();
  for (const account of accounts) {
    const info = await aptos.account.getAccountInfo({ accountAddress: account.accountAddress });
    sequenceNumbers.set(account.accountAddress.toString(), BigInt(info.sequence_number));
  }

  // Pre-build transactions
  console.log(`[Worker ${WORKER_ID}] Building ${totalTxns} transactions...`);
  const allPrepared: PreparedTx[] = [];

  for (const account of accounts) {
    const addr = account.accountAddress.toString();
    let seqNum = sequenceNumbers.get(addr)!;

    for (let i = 0; i < TXNS_PER_ACCOUNT; i++) {
      const payload = buildPayload();
      const transaction = await aptos.transaction.build.simple({
        sender: account.accountAddress,
        data: payload,
        options: {
          accountSequenceNumber: seqNum,
          expireTimestamp: Math.floor(Date.now() / 1000) + 60,
        },
      });
      const authenticator = aptos.transaction.sign({ signer: account, transaction });
      allPrepared.push({ transaction, authenticator });
      seqNum++;
    }
  }

  // Interleave
  const accountTxns: Map<string, PreparedTx[]> = new Map();
  for (let i = 0; i < accounts.length; i++) {
    const addr = accounts[i].accountAddress.toString();
    const start = i * TXNS_PER_ACCOUNT;
    accountTxns.set(addr, allPrepared.slice(start, start + TXNS_PER_ACCOUNT));
  }
  const interleaved: PreparedTx[] = [];
  for (let txIndex = 0; txIndex < TXNS_PER_ACCOUNT; txIndex++) {
    for (const [_, txns] of accountTxns) {
      if (txIndex < txns.length) interleaved.push(txns[txIndex]);
    }
  }

  // Wait for sync signal (simple file-based)
  const syncFile = '/tmp/parallel-burst-go';
  const fs = await import('fs');

  console.log(`[Worker ${WORKER_ID}] Ready! Waiting for go signal...`);
  while (!fs.existsSync(syncFile)) {
    await new Promise(r => setTimeout(r, 50));
  }

  // Fire!
  console.log(`[Worker ${WORKER_ID}] 🚀 FIRING ${interleaved.length} transactions!`);
  const fireStart = Date.now();
  let success = 0;
  let failed = 0;

  const CHUNK_SIZE = 200;
  for (let i = 0; i < interleaved.length; i += CHUNK_SIZE) {
    const chunk = interleaved.slice(i, i + CHUNK_SIZE);
    const results = await Promise.all(chunk.map(async ({ transaction, authenticator }) => {
      try {
        await aptos.transaction.submit.simple({ transaction, senderAuthenticator: authenticator });
        return true;
      } catch { return false; }
    }));
    success += results.filter(r => r).length;
    failed += results.filter(r => !r).length;
  }

  const fireTime = (Date.now() - fireStart) / 1000;
  console.log(`[Worker ${WORKER_ID}] Done: ${success}/${interleaved.length} in ${fireTime.toFixed(1)}s (${Math.floor(success/fireTime)} TPS)`);
}

main().catch(console.error);
