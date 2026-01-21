#!/usr/bin/env npx tsx
/**
 * Fund the 5 new accounts from main wallet
 */

import {
  Aptos,
  AptosConfig,
  Network,
  Account,
  Ed25519PrivateKey,
} from '@aptos-labs/ts-sdk';

// Use a well-funded bot account (wallet 1 has 8913 APT)
const MAIN_KEY = '0x6e2fca34586261b6f22a973c20024b78ddb370d87f7c974315fb97ba56716a7f';
const API_KEY = process.env.APTOS_API_KEY || 'AG-3JMDT54EN4DCLULDWAUXCYGQ56JJQCYHH';

const NEW_ACCOUNTS = [
  'ed25519-priv-0x232111DA47CA5B2734AD971B7DE318CAC066B7FC18C53A6C2C36C23398E1F7D0',
  'ed25519-priv-0x30CFF4BCB9F626C23737CA9F4452D6145716C5B3CBEE4B09CFD5E95D67D3D57A',
  'ed25519-priv-0x2B92EC3BFFF77589B282D48015F1EABF321A7304E9FC63B6E1C9F6D5E8CFCCD2',
  'ed25519-priv-0x6B2136B0FD86D25C98994C4B4177550547E0D5002C934347FE23397C8A9F7102',
  'ed25519-priv-0x71E01D192B4988CE655BBA295CF86062706EABE5AF85B506E33055682CD02E8C',
];

const FUND_AMOUNT = 1500; // APT per account (7500 total)

const aptos = new Aptos(new AptosConfig({
  network: Network.TESTNET,
  clientConfig: API_KEY ? { API_KEY } : undefined,
}));

function parseKey(key: string): Ed25519PrivateKey {
  const clean = key.startsWith('ed25519-priv-') ? key.slice(13) : key;
  return new Ed25519PrivateKey(clean);
}

async function main() {
  console.log('='.repeat(60));
  console.log('FUNDING 5 NEW ACCOUNTS');
  console.log('='.repeat(60));

  const mainAccount = Account.fromPrivateKey({ privateKey: new Ed25519PrivateKey(MAIN_KEY) });
  const mainBalance = await aptos.getAccountAPTAmount({ accountAddress: mainAccount.accountAddress });
  console.log(`\nMain wallet: ${mainAccount.accountAddress.toString().slice(0, 16)}...`);
  console.log(`Balance: ${(mainBalance / 100_000_000).toFixed(2)} APT`);
  console.log(`Will send: ${FUND_AMOUNT} APT × 5 = ${FUND_AMOUNT * 5} APT\n`);

  for (let i = 0; i < NEW_ACCOUNTS.length; i++) {
    const newAccount = Account.fromPrivateKey({ privateKey: parseKey(NEW_ACCOUNTS[i]) });
    const address = newAccount.accountAddress.toString();

    console.log(`[${i + 1}/5] Funding ${address.slice(0, 16)}...`);

    try {
      const tx = await aptos.transaction.build.simple({
        sender: mainAccount.accountAddress,
        data: {
          function: '0x1::aptos_account::transfer',
          functionArguments: [address, BigInt(FUND_AMOUNT * 100_000_000)],
        },
      });

      const pending = await aptos.signAndSubmitTransaction({ signer: mainAccount, transaction: tx });
      await aptos.waitForTransaction({ transactionHash: pending.hash });

      const newBalance = await aptos.getAccountAPTAmount({ accountAddress: newAccount.accountAddress });
      console.log(`  ✓ Sent ${FUND_AMOUNT} APT | New balance: ${(newBalance / 100_000_000).toFixed(2)} APT`);
    } catch (e: any) {
      console.log(`  ✗ Failed: ${e.message?.slice(0, 50)}`);
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('DONE - Add these to orchestrator:');
  console.log('='.repeat(60));
  NEW_ACCOUNTS.forEach((key, i) => {
    console.log(`Account ${21 + i}: ${key}`);
  });
}

main().catch(console.error);
