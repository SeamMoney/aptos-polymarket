import { Aptos, AptosConfig, Network, Ed25519PrivateKey, Account } from '@aptos-labs/ts-sdk';

const aptos = new Aptos(new AptosConfig({ network: Network.TESTNET }));

const PRIVATE_KEYS = [
  "0x6e2fca34586261b6f22a973c20024b78ddb370d87f7c974315fb97ba56716a7f",
  "0xe61d22b3dc37c537a20d5b301c4d2b409b2f93cd7b2915f3518d49517c2ab6c4",
  "0x4542c2e4a39beee8202eee0cddeceea886687b21b54b8f50c17e729251fdd7f5",
  "0xcf5154af9664bbc2634fddfcce2317ed788b35de7f004ac0e24aefd68a0b10c5",
];

async function fundAccounts() {
  for (const keyHex of PRIVATE_KEYS) {
    try {
      const privateKey = new Ed25519PrivateKey(keyHex);
      const account = Account.fromPrivateKey({ privateKey });
      const addr = account.accountAddress.toString();

      // Get current balance
      const balance = await aptos.getAccountAPTAmount({ accountAddress: addr });
      console.log(addr.slice(0, 10) + "... has " + (balance / 1e8).toFixed(2) + " APT");

      if (balance < 10_00000000) {
        console.log("  Funding...");
        await aptos.fundAccount({ accountAddress: addr, amount: 100_00000000 });
        const newBalance = await aptos.getAccountAPTAmount({ accountAddress: addr });
        console.log("  New balance: " + (newBalance / 1e8).toFixed(2) + " APT");
      }
    } catch (e: any) {
      console.error("Error: " + e.message);
    }
  }
}

fundAccounts().then(() => console.log('Done'));
