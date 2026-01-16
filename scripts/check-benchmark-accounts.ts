/**
 * Check benchmark test accounts funding status
 */
import { Aptos, AptosConfig, Network, Account, Ed25519PrivateKey } from '@aptos-labs/ts-sdk';

const TEST_KEYS = [
  '0x6e2fca34586261b6f22a973c20024b78ddb370d87f7c974315fb97ba56716a7f',
  '0xe61d22b3dc37c537a20d5b301c4d2b409b2f93cd7b2915f3518d49517c2ab6c4',
  '0x4542c2e4a39beee8202eee0cddeceea886687b21b54b8f50c17e729251fdd7f5',
  '0xcf5154af9664bbc2634fddfcce2317ed788b35de7f004ac0e24aefd68a0b10c5',
  '0xb7d1f406e48c2eddffe987f98445dd4a353e8e9d1630d878621ded084bdd77c7',
];

async function main() {
  const aptos = new Aptos(new AptosConfig({ network: Network.TESTNET }));

  console.log('Checking benchmark test accounts...\n');

  for (const keyStr of TEST_KEYS) {
    const privateKey = new Ed25519PrivateKey(keyStr);
    const account = Account.fromPrivateKey({ privateKey });
    const addr = account.accountAddress.toString();

    try {
      const balance = await aptos.getAccountAPTAmount({ accountAddress: account.accountAddress });
      const info = await aptos.account.getAccountInfo({ accountAddress: account.accountAddress });
      console.log(`${addr.slice(0, 12)}...:`);
      console.log(`  Balance: ${(balance / 100_000_000).toFixed(4)} APT`);
      console.log(`  Sequence: ${info.sequence_number}`);
    } catch (e: any) {
      console.log(`${addr.slice(0, 12)}...: NOT FUNDED (account doesn't exist)`);
    }
  }
}

main().catch(console.error);
