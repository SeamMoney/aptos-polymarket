/**
 * Generate and Fund Multiple Accounts for Ultra HFT
 *
 * Creates 5 new accounts and funds them from the master account.
 * Run with: APTOS_PRIVATE_KEY=0x... npx tsx scripts/generate-accounts.ts
 */

import {
  Aptos,
  AptosConfig,
  Network,
  Account,
  Ed25519PrivateKey,
} from '@aptos-labs/ts-sdk';

const CONTRACT_ADDRESS = '0x64a81cb9cbd14d45b87bb32ef73107a44f00069b6a96e70d75369fb7e3da5e68';

const API_KEY = process.env.APTOS_API_KEY || '';
const aptos = new Aptos(new AptosConfig({
  network: Network.TESTNET,
  clientConfig: API_KEY ? { API_KEY } : undefined,
}));

const NUM_ACCOUNTS = 5;
const FUND_AMOUNT = 100; // APT per account

async function main() {
  const masterKey = process.env.APTOS_PRIVATE_KEY;
  if (!masterKey) {
    console.error('Set APTOS_PRIVATE_KEY environment variable');
    process.exit(1);
  }

  const masterAccount = Account.fromPrivateKey({
    privateKey: new Ed25519PrivateKey(masterKey),
  });

  console.log('='.repeat(60));
  console.log('MULTI-ACCOUNT GENERATOR FOR ULTRA HFT');
  console.log('='.repeat(60));
  console.log(`\nMaster Account: ${masterAccount.accountAddress.toString()}`);

  // Check master balance
  const masterBalance = await aptos.getAccountAPTAmount({
    accountAddress: masterAccount.accountAddress,
  });
  const masterBalanceAPT = masterBalance / 100_000_000;
  console.log(`Master Balance: ${masterBalanceAPT.toFixed(2)} APT`);

  const requiredBalance = NUM_ACCOUNTS * FUND_AMOUNT + 10; // Extra for gas
  if (masterBalanceAPT < requiredBalance) {
    console.error(`\nInsufficient balance! Need ${requiredBalance} APT, have ${masterBalanceAPT.toFixed(2)} APT`);
    process.exit(1);
  }

  console.log(`\nGenerating ${NUM_ACCOUNTS} new accounts...`);
  console.log(`Funding each with ${FUND_AMOUNT} APT\n`);

  const generatedAccounts: { address: string; privateKey: string }[] = [];

  for (let i = 0; i < NUM_ACCOUNTS; i++) {
    // Generate new account
    const newAccount = Account.generate();
    const privateKeyHex = `0x${Buffer.from(newAccount.privateKey.toUint8Array()).toString('hex')}`;

    console.log(`\nAccount ${i + 1}:`);
    console.log(`  Address: ${newAccount.accountAddress.toString()}`);
    console.log(`  Private Key: ${privateKeyHex.slice(0, 20)}...`);

    // Fund the account
    const fundAmount = BigInt(FUND_AMOUNT * 100_000_000);

    try {
      const txn = await aptos.transaction.build.simple({
        sender: masterAccount.accountAddress,
        data: {
          function: '0x1::aptos_account::transfer',
          functionArguments: [newAccount.accountAddress.toString(), fundAmount],
        },
      });

      const signedTxn = aptos.transaction.sign({
        signer: masterAccount,
        transaction: txn,
      });

      const pendingTxn = await aptos.transaction.submit.simple({
        transaction: txn,
        senderAuthenticator: signedTxn,
      });

      await aptos.waitForTransaction({ transactionHash: pendingTxn.hash });
      console.log(`  Funded: ${FUND_AMOUNT} APT`);
      console.log(`  Tx: ${pendingTxn.hash.slice(0, 20)}...`);

      generatedAccounts.push({
        address: newAccount.accountAddress.toString(),
        privateKey: privateKeyHex,
      });
    } catch (e: any) {
      console.error(`  ERROR funding account: ${e.message}`);
    }

    // Small delay between transfers
    await new Promise(r => setTimeout(r, 500));
  }

  console.log('\n' + '='.repeat(60));
  console.log('GENERATED ACCOUNTS');
  console.log('='.repeat(60));

  // Output environment variable format
  console.log('\nAdd these to your .env file or export them:\n');

  const privateKeys = generatedAccounts.map(a => a.privateKey);
  console.log(`ULTRA_PRIVATE_KEYS="${privateKeys.join(',')}"`);

  console.log('\nOr use individually:\n');
  generatedAccounts.forEach((acc, i) => {
    console.log(`ACCOUNT_${i + 1}_KEY=${acc.privateKey}`);
  });

  console.log('\n' + '='.repeat(60));
  console.log('SUMMARY');
  console.log('='.repeat(60));
  console.log(`Accounts created: ${generatedAccounts.length}`);
  console.log(`APT distributed: ${generatedAccounts.length * FUND_AMOUNT}`);
  console.log(`\nTo run Ultra HFT server:`);
  console.log(`ULTRA_PRIVATE_KEYS="..." APTOS_API_KEY=... npx tsx server/hft-ultra-server.ts`);
}

main().catch(console.error);
