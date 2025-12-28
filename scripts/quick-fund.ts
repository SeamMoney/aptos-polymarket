import { Aptos, AptosConfig, Network, Ed25519PrivateKey, Account } from '@aptos-labs/ts-sdk';

const aptos = new Aptos(new AptosConfig({
  network: Network.TESTNET,
  clientConfig: { HEADERS: { 'x-api-key': 'AG-3JMDT54EN4DCLULDWAUXCYGQ56JJQCYHH' } },
}));

const sender = Account.fromPrivateKey({
  privateKey: new Ed25519PrivateKey("0x48ee96658dd826f6541f5ee501c5784e6b341f04c52c641823f4b097b61eb79b")
});

// Generate addresses from the actual private keys used by the server
const targetKeys = [
  "0x6e2fca34586261b6f22a973c20024b78ddb370d87f7c974315fb97ba56716a7f",
  "0xe61d22b3dc37c537a20d5b301c4d2b409b2f93cd7b2915f3518d49517c2ab6c4",
  "0x4542c2e4a39beee8202eee0cddeceea886687b21b54b8f50c17e729251fdd7f5",
];

async function fund() {
  console.log("Funding 3 accounts with 100 APT each...");
  for (const key of targetKeys) {
    try {
      const target = Account.fromPrivateKey({ privateKey: new Ed25519PrivateKey(key) });
      const addr = target.accountAddress.toString();
      console.log("Target: " + addr.slice(0,12) + "...");
      
      const txn = await aptos.transaction.build.simple({
        sender: sender.accountAddress,
        data: {
          function: "0x1::aptos_account::transfer",
          functionArguments: [addr, 1000_00000000], // 1000 APT
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
