#!/usr/bin/env npx tsx
/**
 * Mint Extra USD1 to Specific Accounts
 *
 * Usage:
 *   SEED_MNEMONIC="..." npx tsx scripts/mint-extra-usd1.ts --start 5000 --count 100 --amount 9000
 */

import {
  Aptos,
  AptosConfig,
  Network,
  Account,
  Ed25519PrivateKey,
} from '@aptos-labs/ts-sdk';
import { deriveAccount, validateMnemonic } from '../config/seed-accounts';
import { CONTRACTS, cleanKey } from '../config/wallets';

const USD1_DECIMALS = 100_000_000;
const CONTRACT_ADDRESS = CONTRACTS.address;
const USD1_MODULE = `${CONTRACT_ADDRESS}::usd1`;

// Parse args
const args = process.argv.slice(2);
const startIdx = args.indexOf('--start');
const startIndex = startIdx >= 0 ? parseInt(args[startIdx + 1]) : 5000;
const countIdx = args.indexOf('--count');
const count = countIdx >= 0 ? parseInt(args[countIdx + 1]) : 100;
const amountIdx = args.indexOf('--amount');
const amountPerAccount = amountIdx >= 0 ? parseInt(args[amountIdx + 1]) : 9000;

async function main() {
  console.log('='.repeat(70));
  console.log('   MINT EXTRA USD1 TO ACCOUNTS');
  console.log('='.repeat(70));
  console.log();

  const mnemonic = process.env.SEED_MNEMONIC;
  if (!mnemonic || !validateMnemonic(mnemonic)) {
    console.error('ERROR: Valid SEED_MNEMONIC required');
    process.exit(1);
  }

  const rpcUrl = process.env.FULLNODE_URL || 'https://fullnode.testnet.aptoslabs.com/v1';
  const aptos = new Aptos(new AptosConfig({
    network: Network.TESTNET,
    fullnode: rpcUrl,
  }));

  console.log(`RPC: ${rpcUrl}`);
  console.log(`Account range: ${startIndex} to ${startIndex + count - 1}`);
  console.log(`USD1 to mint per account: ${amountPerAccount}`);
  console.log();

  // Derive accounts
  const accounts: Account[] = [];
  for (let i = startIndex; i < startIndex + count; i++) {
    accounts.push(deriveAccount(mnemonic, i));
  }
  console.log(`Derived ${accounts.length} accounts`);

  // Get minter
  const minterKey = process.env.MINTER_KEY || CONTRACTS.deployerKey;
  const minter = Account.fromPrivateKey({
    privateKey: new Ed25519PrivateKey(cleanKey(minterKey)),
  });
  console.log(`Minter: ${minter.accountAddress.toString().slice(0, 20)}...`);
  console.log();

  let success = 0;
  let failed = 0;

  for (let i = 0; i < accounts.length; i++) {
    const recipient = accounts[i];
    const address = recipient.accountAddress.toString();

    try {
      const mintTx = await aptos.transaction.build.simple({
        sender: minter.accountAddress,
        data: {
          function: `${USD1_MODULE}::mint`,
          functionArguments: [address, amountPerAccount * USD1_DECIMALS],
        },
      });

      const pendingTx = await aptos.signAndSubmitTransaction({
        signer: minter,
        transaction: mintTx,
      });

      await aptos.waitForTransaction({ transactionHash: pendingTx.hash });

      process.stdout.write(`[${i}] ${address.slice(0, 10)}... ✓ +${amountPerAccount} USD1\n`);
      success++;

      if (i % 10 === 9) {
        await new Promise(r => setTimeout(r, 100));
      }
    } catch (e: any) {
      process.stdout.write(`[${i}] ${address.slice(0, 10)}... ✗ ${e.message?.slice(0, 30)}\n`);
      failed++;
    }

    if (i % 50 === 49) {
      console.log(`--- Progress: ${i + 1}/${accounts.length} ---`);
    }
  }

  console.log();
  console.log('='.repeat(70));
  console.log(`   COMPLETE: ${success}/${count} accounts | +${success * amountPerAccount} USD1 total`);
  console.log('='.repeat(70));
}

main().catch(console.error);
