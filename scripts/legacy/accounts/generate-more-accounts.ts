/**
 * Generate additional accounts and fund them for scaling to 1000+ TPS
 *
 * Aptos limit: 100 pending transactions per account
 * To hit 1000 TPS, we need ~10 accounts running in parallel
 */

import { Aptos, AptosConfig, Network, Account, Ed25519PrivateKey } from '@aptos-labs/ts-sdk';

const API_KEY = process.env.APTOS_API_KEY || 'AG-3JMDT54EN4DCLULDWAUXCYGQ56JJQCYHH';

// Current 4 accounts (using account 1 as funder - it has 1000+ APT)
const FUNDER_KEY = '0x6e2fca34586261b6f22a973c20024b78ddb370d87f7c974315fb97ba56716a7f';
const FUND_AMOUNT = 100; // APT per new account

async function main() {
  const aptos = new Aptos(new AptosConfig({
    network: Network.TESTNET,
    clientConfig: { API_KEY }
  }));

  const funderAccount = Account.fromPrivateKey({
    privateKey: new Ed25519PrivateKey(FUNDER_KEY)
  });

  console.log('='.repeat(60));
  console.log('GENERATE MORE ACCOUNTS FOR 1000+ TPS');
  console.log('='.repeat(60));

  const funderBalance = await aptos.getAccountAPTAmount({ accountAddress: funderAccount.accountAddress });
  console.log(`\nFunder: ${funderAccount.accountAddress.toString().slice(0,12)}...`);
  console.log(`Balance: ${(funderBalance / 1e8).toFixed(2)} APT`);

  // Generate 6 new accounts
  console.log('\n--- Generating 6 new accounts ---\n');
  const newAccounts: Account[] = [];
  const newPrivateKeys: string[] = [];

  for (let i = 0; i < 6; i++) {
    const account = Account.generate();
    newAccounts.push(account);
    const privateKey = account.privateKey.toString();
    newPrivateKeys.push(privateKey);
    console.log(`Account ${i + 5}: ${account.accountAddress.toString().slice(0, 16)}...`);
  }

  // Fund each new account
  console.log('\n--- Funding new accounts ---\n');
  for (let i = 0; i < newAccounts.length; i++) {
    const account = newAccounts[i];
    console.log(`[${i + 1}/${newAccounts.length}] Funding ${account.accountAddress.toString().slice(0, 12)}...`);

    try {
      const tx = await aptos.transaction.build.simple({
        sender: funderAccount.accountAddress,
        data: {
          function: '0x1::aptos_account::transfer',
          functionArguments: [account.accountAddress.toString(), BigInt(FUND_AMOUNT * 1e8)],
        },
      });

      const signed = aptos.transaction.sign({ signer: funderAccount, transaction: tx });
      const pending = await aptos.transaction.submit.simple({ transaction: tx, senderAuthenticator: signed });
      await aptos.waitForTransaction({ transactionHash: pending.hash });
      console.log(`    Done: ${pending.hash.slice(0, 20)}... | ${FUND_AMOUNT} APT`);
    } catch (e: any) {
      console.log(`    ERROR: ${e.message?.slice(0, 60)}`);
    }

    await new Promise(r => setTimeout(r, 500));
  }

  // Print all 10 account private keys for ULTRA_PRIVATE_KEYS
  console.log('\n' + '='.repeat(60));
  console.log('ALL 10 ACCOUNT PRIVATE KEYS');
  console.log('='.repeat(60));

  const existingKeys = [
    '0x6e2fca34586261b6f22a973c20024b78ddb370d87f7c974315fb97ba56716a7f',
    '0xe61d22b3dc37c537a20d5b301c4d2b409b2f93cd7b2915f3518d49517c2ab6c4',
    '0x4542c2e4a39beee8202eee0cddeceea886687b21b54b8f50c17e729251fdd7f5',
    '0xcf5154af9664bbc2634fddfcce2317ed788b35de7f004ac0e24aefd68a0b10c5',
  ];

  const allKeys = [...existingKeys, ...newPrivateKeys];

  console.log('\nFor ULTRA_PRIVATE_KEYS environment variable:\n');
  console.log('ULTRA_PRIVATE_KEYS="' + allKeys.join(',') + '"');

  console.log('\n--- Save these new private keys! ---\n');
  for (let i = 0; i < newPrivateKeys.length; i++) {
    console.log(`Account ${i + 5}: ${newPrivateKeys[i]}`);
  }

  console.log('\n' + '='.repeat(60));
  console.log(`Total accounts: 10 | Capacity: 1000 pending transactions`);
  console.log(`Target TPS: 1000+`);
  console.log('='.repeat(60));
}

main().catch(console.error);
