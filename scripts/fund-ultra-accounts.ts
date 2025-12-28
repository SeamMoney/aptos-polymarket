/**
 * Fund Ultra HFT Accounts
 * Transfers APT from master account to all trading accounts
 */

import { Aptos, AptosConfig, Network, Account, Ed25519PrivateKey } from '@aptos-labs/ts-sdk';

const MASTER_KEY = process.env.APTOS_PRIVATE_KEY || '0x48ee96658dd826f6541f5ee501c5784e6b341f04c52c641823f4b097b61eb79b';
const API_KEY = process.env.APTOS_API_KEY || 'AG-3JMDT54EN4DCLULDWAUXCYGQ56JJQCYHH';
const FUND_AMOUNT = 50; // APT per account

// Private keys for the 4 ultra trading accounts (used with ULTRA_PRIVATE_KEYS)
const TRADING_PRIVATE_KEYS = [
  '0x6e2fca34586261b6f22a973c20024b78ddb370d87f7c974315fb97ba56716a7f',
  '0xe61d22b3dc37c537a20d5b301c4d2b409b2f93cd7b2915f3518d49517c2ab6c4',
  '0x4542c2e4a39beee8202eee0cddeceea886687b21b54b8f50c17e729251fdd7f5',
  '0xcf5154af9664bbc2634fddfcce2317ed788b35de7f004ac0e24aefd68a0b10c5',
];

async function main() {
  const aptos = new Aptos(new AptosConfig({
    network: Network.TESTNET,
    clientConfig: { API_KEY }
  }));

  const masterAccount = Account.fromPrivateKey({
    privateKey: new Ed25519PrivateKey(MASTER_KEY)
  });

  // Derive addresses from private keys
  const tradingAccounts = TRADING_PRIVATE_KEYS.map(key =>
    Account.fromPrivateKey({ privateKey: new Ed25519PrivateKey(key) })
  );

  console.log('='.repeat(50));
  console.log('FUNDING ULTRA HFT ACCOUNTS');
  console.log('='.repeat(50));

  const masterBalance = await aptos.getAccountAPTAmount({ accountAddress: masterAccount.accountAddress });
  console.log(`\nMaster: ${masterAccount.accountAddress.toString().slice(0,12)}...`);
  console.log(`Balance: ${(masterBalance / 1e8).toFixed(2)} APT`);
  console.log(`\nFunding ${tradingAccounts.length} accounts with ${FUND_AMOUNT} APT each...\n`);

  for (let i = 0; i < tradingAccounts.length; i++) {
    const tradingAccount = tradingAccounts[i];
    const addr = tradingAccount.accountAddress.toString();
    console.log(`[${i+1}/${tradingAccounts.length}] Funding ${addr.slice(0,12)}...`);

    // Check current balance first
    try {
      const currentBalance = await aptos.getAccountAPTAmount({ accountAddress: tradingAccount.accountAddress });
      console.log(`    Current: ${(currentBalance / 1e8).toFixed(2)} APT`);
    } catch {
      console.log(`    Current: 0 APT (new account)`);
    }

    try {
      const tx = await aptos.transaction.build.simple({
        sender: masterAccount.accountAddress,
        data: {
          function: '0x1::aptos_account::transfer',
          functionArguments: [addr, BigInt(FUND_AMOUNT * 1e8)],
        },
      });

      const signed = aptos.transaction.sign({ signer: masterAccount, transaction: tx });
      const pending = await aptos.transaction.submit.simple({ transaction: tx, senderAuthenticator: signed });
      await aptos.waitForTransaction({ transactionHash: pending.hash });

      console.log(`    Done: ${pending.hash.slice(0,20)}...`);
    } catch (e: any) {
      console.log(`    ERROR: ${e.message?.slice(0, 50)}`);
    }

    await new Promise(r => setTimeout(r, 300));
  }

  console.log('\n' + '='.repeat(50));
  console.log('FUNDING COMPLETE');
  console.log(`Total distributed: ${tradingAccounts.length * FUND_AMOUNT} APT`);
  console.log('='.repeat(50));
  console.log('\nRun the Ultra HFT server:');
  console.log('  ULTRA_PRIVATE_KEYS="' + TRADING_PRIVATE_KEYS.join(',') + '" APTOS_API_KEY=' + API_KEY + ' npx tsx server/hft-ultra-server.ts');
}

main().catch(console.error);
