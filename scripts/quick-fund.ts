import { Aptos, AptosConfig, Network, Ed25519PrivateKey, Account } from '@aptos-labs/ts-sdk';

const aptos = new Aptos(new AptosConfig({
  network: Network.TESTNET,
  clientConfig: { HEADERS: { 'x-api-key': 'AG-3JMDT54EN4DCLULDWAUXCYGQ56JJQCYHH' } },
}));

const sender = Account.fromPrivateKey({
  privateKey: new Ed25519PrivateKey("0x48ee96658dd826f6541f5ee501c5784e6b341f04c52c641823f4b097b61eb79b")
});

// Generate addresses from the actual private keys used by the server
// 20 accounts for ~10k TPS with orderless transactions
const targetKeys = [
  // Original 6 accounts (Phase 1)
  "0x6e2fca34586261b6f22a973c20024b78ddb370d87f7c974315fb97ba56716a7f",
  "0xe61d22b3dc37c537a20d5b301c4d2b409b2f93cd7b2915f3518d49517c2ab6c4",
  "0x4542c2e4a39beee8202eee0cddeceea886687b21b54b8f50c17e729251fdd7f5",
  "0xcf5154af9664bbc2634fddfcce2317ed788b35de7f004ac0e24aefd68a0b10c5",
  "ed25519-priv-0xb7d1f406e48c2eddffe987f98445dd4a353e8e9d1630d878621ded084bdd77c7",
  "ed25519-priv-0xa8088ee787b847f6304807a8b09d1afc15409082ee9c8b7eda6919b0ecb86ea8",
  // Phase 1 expansion: 4 more accounts (total: 10)
  "ed25519-priv-0xb5305eb83498dcba61242ccc91fac35263d9b44bddaf5e7417adbaceb1cfcb36",
  "ed25519-priv-0xc27a6a8b6ed3013da99dc924b2f6af17f1448dedce91691f97d9e778c0761655",
  "ed25519-priv-0xd6402b3493af005ed02b07f6cd7ffdfd37fae6d4d9c88fec6ff38e90f01b21c1",
  "ed25519-priv-0xd375af1a686835905e15bf82f24fcaeed4b1b5b5fabe22c80e998acb804aa295",
  // Phase 11: 10 NEW accounts for 10k TPS (total: 20)
  "ed25519-priv-0xf867c21b74502fa0104d421c294df0df23fd9ae3fc6882a33bb6c71a4fec90d3",
  "ed25519-priv-0x58045d9ecc12e6fbe3d6e9df215bb4e7f4c81231a09da5ba49afb674b2b58b05",
  "ed25519-priv-0xb63580da8bd96b068b4c1b1908aa2b9b93464afae0e56fec642c7bccd743c73f",
  "ed25519-priv-0x875277477fe8ea624ef1d05f5f62b247bfba5eaf02fac1fb256c4fc2c0981765",
  "ed25519-priv-0x27c178ae51e80be6be562267032c28c12ec6dcd075367361716e110c21183472",
  "ed25519-priv-0x0daa5cbc98056deab6d77577afcdc99f01a9a60a3b1ad72731049b3e0163bdb3",
  "ed25519-priv-0xa5cf70d36ca2579d99bd5ac0dbc94ca6eab7553d04db4f804141c441a19c9b1c",
  "ed25519-priv-0x314c74ce712385f6eb7f7c3eceb3edac35e7a882d20f3f221a12028d905679da",
  "ed25519-priv-0xca837a1738f1d9874f7988d3ff7f4a1e634bc8747d70f49fa053d0b126f8f5d9",
  "ed25519-priv-0xa7e23d7901bed3bcaff4061248edb56ce4209010e8fc9024f6d3cb3beed66db5",
];

// Helper to parse keys with optional ed25519-priv- prefix
function parsePrivateKey(key: string): Ed25519PrivateKey {
  const cleanKey = key.startsWith('ed25519-priv-') ? key.slice(13) : key;
  return new Ed25519PrivateKey(cleanKey);
}

async function fund() {
  console.log(`Funding ${targetKeys.length} accounts with 2000 APT each...`);
  for (const key of targetKeys) {
    try {
      const target = Account.fromPrivateKey({ privateKey: parsePrivateKey(key) });
      const addr = target.accountAddress.toString();
      console.log("Target: " + addr.slice(0,12) + "...");

      const txn = await aptos.transaction.build.simple({
        sender: sender.accountAddress,
        data: {
          function: "0x1::aptos_account::transfer",
          functionArguments: [addr, 2000_00000000], // 2000 APT for longer runtime at 1k TPS
        },
      });
      const pending = await aptos.signAndSubmitTransaction({ signer: sender, transaction: txn });
      console.log("  Funded: " + pending.hash.slice(0,16));
      await aptos.waitForTransaction({ transactionHash: pending.hash });
      console.log("  Confirmed!");
    } catch (e: any) {
      console.log("  Error: " + e.message?.slice(0,60));
    }
  }
  console.log("Done!");
}
fund();
