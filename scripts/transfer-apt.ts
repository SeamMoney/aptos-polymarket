import { Aptos, AptosConfig, Network, Ed25519PrivateKey, Account, PrivateKey, PrivateKeyVariants } from '@aptos-labs/ts-sdk';

const API_KEY = process.env.APTOS_API_KEY || 'AG-3JMDT54EN4DCLULDWAUXCYGQ56JJQCYHH';
const aptos = new Aptos(new AptosConfig({
  network: Network.TESTNET,
  clientConfig: {
    HEADERS: { 'x-api-key': API_KEY },
  },
}));

// Source: demo account with lots of APT
const DEMO_KEY = "0x48ee96658dd826f6541f5ee501c5784e6b341f04c52c641823f4b097b61eb79b";

// Target accounts (first 4 standard keys + 6 ed25519 keys)
const TARGET_KEYS = [
  "0x6e2fca34586261b6f22a973c20024b78ddb370d87f7c974315fb97ba56716a7f",
  "0xe61d22b3dc37c537a20d5b301c4d2b409b2f93cd7b2915f3518d49517c2ab6c4",
  "0x4542c2e4a39beee8202eee0cddeceea886687b21b54b8f50c17e729251fdd7f5",
  "0xcf5154af9664bbc2634fddfcce2317ed788b35de7f004ac0e24aefd68a0b10c5",
  "ed25519-priv-0xb7d1f406e48c2eddffe987f98445dd4a353e8e9d1630d878621ded084bdd77c7",
  "ed25519-priv-0xa8088ee787b847f6304807a8b09d1afc15409082ee9c8b7eda6919b0ecb86ea8",
  "ed25519-priv-0xb5305eb83498dcba61242ccc91fac35263d9b44bddaf5e7417adbaceb1cfcb36",
  "ed25519-priv-0xc27a6a8b6ed3013da99dc924b2f6af17f1448dedce91691f97d9e778c0761655",
  "ed25519-priv-0xd6402b3493af005ed02b07f6cd7ffdfd37fae6d4d9c88fec6ff38e90f01b21c1",
  "ed25519-priv-0xd375af1a686835905e15bf82f24fcaeed4b1b5b5fabe22c80e998acb804aa295",
];

const AMOUNT_TO_SEND = 500_00000000; // 500 APT each

function getAccount(keyStr: string): Account {
  if (keyStr.startsWith('ed25519-priv-')) {
    const formatted = PrivateKey.formatPrivateKey(keyStr, PrivateKeyVariants.Ed25519);
    return Account.fromPrivateKey({ privateKey: new Ed25519PrivateKey(formatted) });
  }
  return Account.fromPrivateKey({ privateKey: new Ed25519PrivateKey(keyStr) });
}

async function transfer() {
  const sender = Account.fromPrivateKey({ privateKey: new Ed25519PrivateKey(DEMO_KEY) });
  console.log("Sender: " + sender.accountAddress.toString().slice(0, 12) + "...");

  const senderBal = await aptos.getAccountAPTAmount({ accountAddress: sender.accountAddress });
  console.log("Sender balance: " + (senderBal / 1e8).toFixed(2) + " APT\n");

  for (const keyStr of TARGET_KEYS) {
    const target = getAccount(keyStr);
    const addr = target.accountAddress.toString();

    try {
      const currentBal = await aptos.getAccountAPTAmount({ accountAddress: addr });
      console.log(addr.slice(0, 12) + "... has " + (currentBal / 1e8).toFixed(2) + " APT");

      if (currentBal < 10_00000000) { // Less than 10 APT
        console.log("  Sending 50 APT...");

        const txn = await aptos.transaction.build.simple({
          sender: sender.accountAddress,
          data: {
            function: "0x1::aptos_account::transfer",
            functionArguments: [addr, AMOUNT_TO_SEND],
          },
        });

        const pending = await aptos.signAndSubmitTransaction({
          signer: sender,
          transaction: txn,
        });

        await aptos.waitForTransaction({ transactionHash: pending.hash });

        const newBal = await aptos.getAccountAPTAmount({ accountAddress: addr });
        console.log("  New balance: " + (newBal / 1e8).toFixed(2) + " APT");
      }
    } catch (e: any) {
      console.log("  Error: " + e.message?.slice(0, 50));
    }
  }

  const finalBal = await aptos.getAccountAPTAmount({ accountAddress: sender.accountAddress });
  console.log("\nSender final balance: " + (finalBal / 1e8).toFixed(2) + " APT");
}

transfer().then(() => console.log("\nDone!"));
