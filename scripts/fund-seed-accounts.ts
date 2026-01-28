#!/usr/bin/env npx tsx
/**
 * Fund Seed-Derived Accounts
 *
 * Funds accounts with APT and USD1. Supports start index for scaling.
 *
 * Prerequisites:
 *   - Run generate-seed-accounts.ts first to get the seed
 *   - Ensure funder account has enough APT and minter can mint USD1
 *
 * Usage:
 *   SEED_MNEMONIC="..." npx tsx scripts/fund-seed-accounts.ts
 *   SEED_MNEMONIC="..." npx tsx scripts/fund-seed-accounts.ts --apt-only
 *   SEED_MNEMONIC="..." npx tsx scripts/fund-seed-accounts.ts --usd1-only
 *   SEED_MNEMONIC="..." npx tsx scripts/fund-seed-accounts.ts --count 100
 *   SEED_MNEMONIC="..." npx tsx scripts/fund-seed-accounts.ts --start 2000 --count 3000
 */

import {
  Aptos,
  AptosConfig,
  Network,
  Account,
  Ed25519PrivateKey,
} from '@aptos-labs/ts-sdk';
import {
  deriveAccount,
  validateMnemonic,
} from '../config/seed-accounts';
import { WALLETS, CONTRACTS, cleanKey } from '../config/wallets';

// Configuration
const ACCOUNT_COUNT = parseInt(process.env.ACCOUNT_COUNT || '500');
const APT_PER_ACCOUNT = 2; // 2 APT per account (for gas)
const USD1_PER_ACCOUNT = 1000; // 1000 USD1 per account (for trading)
const PARALLEL_BATCH_SIZE = 20; // Process 20 accounts in parallel

const OCTAS_PER_APT = 100_000_000;
const USD1_DECIMALS = 100_000_000;

const CONTRACT_ADDRESS = CONTRACTS.address;
const USD1_MODULE = `${CONTRACT_ADDRESS}::usd1`;

// Parse args
const args = process.argv.slice(2);
const aptOnly = args.includes('--apt-only');
const usd1Only = args.includes('--usd1-only');
const countIdx = args.indexOf('--count');
const count = countIdx >= 0 ? parseInt(args[countIdx + 1]) : ACCOUNT_COUNT;
const startIdx = args.indexOf('--start');
const startIndex = startIdx >= 0 ? parseInt(args[startIdx + 1]) : 0;

async function fundWithAPT(
  aptos: Aptos,
  funder: Account,
  recipients: Account[],
  amountPerAccount: number
): Promise<{ success: number; failed: number }> {
  let success = 0;
  let failed = 0;

  // APT transfers must be sequential (single funder = single sequence number)
  for (let i = 0; i < recipients.length; i++) {
    const recipient = recipients[i];
    const address = recipient.accountAddress.toString();

    try {
      // Check if account already has enough APT
      let balance = 0;
      try {
        balance = await aptos.getAccountAPTAmount({ accountAddress: recipient.accountAddress });
      } catch {
        // Account doesn't exist yet, balance is 0
      }

      if (balance >= amountPerAccount * OCTAS_PER_APT * 0.5) {
        process.stdout.write(`[${i}] ${address.slice(0, 10)}... ✓ already has APT\n`);
        success++;
        continue;
      }

      // Transfer APT
      const txn = await aptos.transferCoinTransaction({
        sender: funder.accountAddress,
        recipient: address,
        amount: amountPerAccount * OCTAS_PER_APT,
      });

      const pendingTxn = await aptos.signAndSubmitTransaction({
        signer: funder,
        transaction: txn,
      });

      await aptos.waitForTransaction({ transactionHash: pendingTxn.hash });

      process.stdout.write(`[${i}] ${address.slice(0, 10)}... ✓ ${amountPerAccount} APT\n`);
      success++;
    } catch (e: any) {
      process.stdout.write(`[${i}] ${address.slice(0, 10)}... ✗ ${e.message?.slice(0, 30)}\n`);
      failed++;
    }

    // Progress update every 50 accounts
    if (i % 50 === 49) {
      console.log(`--- APT Progress: ${i + 1}/${recipients.length} ---`);
    }
  }

  return { success, failed };
}

async function fundWithUSD1(
  aptos: Aptos,
  minter: Account,
  recipients: Account[],
  amountPerAccount: number
): Promise<{ success: number; failed: number }> {
  let success = 0;
  let failed = 0;

  // USD1 minting must be sequential (minter has one sequence number)
  // But we can check balances in parallel first

  for (let i = 0; i < recipients.length; i++) {
    const recipient = recipients[i];
    const address = recipient.accountAddress.toString();

    try {
      // Check current balance
      let balance = 0;
      try {
        const balanceResult = await aptos.view({
          payload: {
            function: `${USD1_MODULE}::balance`,
            functionArguments: [address],
          },
        });
        balance = Number(balanceResult[0]) / USD1_DECIMALS;
      } catch {
        // Account might not have USD1 store yet
      }

      if (balance >= amountPerAccount * 0.5) {
        process.stdout.write(`[${i}] ${address.slice(0, 10)}... ✓ already has ${balance.toFixed(0)} USD1\n`);
        success++;
        continue;
      }

      // Mint USD1
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

      process.stdout.write(`[${i}] ${address.slice(0, 10)}... ✓ ${amountPerAccount} USD1\n`);
      success++;

      // Small delay to avoid sequence number issues
      if (i % 10 === 9) {
        await new Promise(r => setTimeout(r, 100));
      }
    } catch (e: any) {
      process.stdout.write(`[${i}] ${address.slice(0, 10)}... ✗ ${e.message?.slice(0, 30)}\n`);
      failed++;
    }

    // Progress update every 50 accounts
    if (i % 50 === 49) {
      console.log(`--- USD1 Progress: ${i + 1}/${recipients.length} ---`);
    }
  }

  return { success, failed };
}

async function main() {
  console.log('='.repeat(70));
  console.log('   SEED ACCOUNT FUNDING');
  console.log('   Funding accounts with APT and USD1');
  console.log('='.repeat(70));
  console.log();

  // Get mnemonic
  const mnemonic = process.env.SEED_MNEMONIC;
  if (!mnemonic) {
    console.error('ERROR: SEED_MNEMONIC environment variable not set');
    console.error('Run: SEED_MNEMONIC="..." npx tsx scripts/fund-seed-accounts.ts');
    process.exit(1);
  }

  if (!validateMnemonic(mnemonic)) {
    console.error('ERROR: Invalid mnemonic phrase');
    process.exit(1);
  }

  // Setup Aptos client
  const rpcUrl = process.env.FULLNODE_URL || 'https://aptos.cash.trading/v1';
  const aptos = new Aptos(new AptosConfig({
    network: Network.TESTNET,
    fullnode: rpcUrl,
  }));

  console.log(`RPC: ${rpcUrl}`);
  console.log(`Accounts to fund: ${count}`);
  console.log(`Account range: ${startIndex} to ${startIndex + count - 1}`);
  console.log(`APT per account: ${APT_PER_ACCOUNT}`);
  console.log(`USD1 per account: ${USD1_PER_ACCOUNT}`);
  console.log(`Mode: ${aptOnly ? 'APT only' : usd1Only ? 'USD1 only' : 'Both APT and USD1'}`);
  console.log();

  // Derive accounts from startIndex
  const endIndex = startIndex + count;
  console.log(`Deriving ${count} accounts from seed (indices ${startIndex} to ${endIndex - 1})...`);
  const startDerive = Date.now();
  const accounts: Account[] = [];
  for (let i = startIndex; i < endIndex; i++) {
    accounts.push(deriveAccount(mnemonic, i));
  }
  console.log(`Derived ${accounts.length} accounts in ${Date.now() - startDerive}ms`);
  console.log();

  // Get funder for APT (use deployer or specify via env)
  const funderKey = process.env.FUNDER_KEY || WALLETS.deployer.key;
  const funder = Account.fromPrivateKey({
    privateKey: new Ed25519PrivateKey(cleanKey(funderKey)),
  });
  console.log(`APT Funder: ${funder.accountAddress.toString().slice(0, 20)}...`);

  // Check funder balance
  const funderBalance = await aptos.getAccountAPTAmount({
    accountAddress: funder.accountAddress,
  });
  console.log(`Funder APT balance: ${(funderBalance / OCTAS_PER_APT).toFixed(2)} APT`);

  const totalAptNeeded = count * APT_PER_ACCOUNT;
  if (funderBalance < totalAptNeeded * OCTAS_PER_APT) {
    console.warn(`WARNING: Funder may not have enough APT (need ${totalAptNeeded} APT)`);
  }

  // Get minter for USD1 (use contract deployer - can mint USD1)
  const minterKey = process.env.MINTER_KEY || CONTRACTS.deployerKey;
  const minter = Account.fromPrivateKey({
    privateKey: new Ed25519PrivateKey(cleanKey(minterKey)),
  });
  console.log(`USD1 Minter: ${minter.accountAddress.toString().slice(0, 20)}...`);
  console.log(`USD1 Contract: ${CONTRACT_ADDRESS.slice(0, 20)}...`);
  console.log();

  // Fund with APT
  if (!usd1Only) {
    console.log('='.repeat(70));
    console.log('   PHASE 1: APT DISTRIBUTION');
    console.log('='.repeat(70));
    console.log();

    const aptStart = Date.now();
    const aptResult = await fundWithAPT(aptos, funder, accounts, APT_PER_ACCOUNT);
    const aptElapsed = Date.now() - aptStart;

    console.log();
    console.log(`APT Distribution complete:`);
    console.log(`  Success: ${aptResult.success}/${count}`);
    console.log(`  Failed: ${aptResult.failed}`);
    console.log(`  Time: ${(aptElapsed / 1000).toFixed(1)}s`);
    console.log();
  }

  // Fund with USD1
  if (!aptOnly) {
    console.log('='.repeat(70));
    console.log('   PHASE 2: USD1 MINTING');
    console.log('='.repeat(70));
    console.log();

    const usd1Start = Date.now();
    const usd1Result = await fundWithUSD1(aptos, minter, accounts, USD1_PER_ACCOUNT);
    const usd1Elapsed = Date.now() - usd1Start;

    console.log();
    console.log(`USD1 Minting complete:`);
    console.log(`  Success: ${usd1Result.success}/${count}`);
    console.log(`  Failed: ${usd1Result.failed}`);
    console.log(`  Time: ${(usd1Elapsed / 1000).toFixed(1)}s`);
    console.log();
  }

  // Summary
  console.log('='.repeat(70));
  console.log('   FUNDING COMPLETE');
  console.log('='.repeat(70));
  console.log(`  Total accounts: ${count}`);
  if (!usd1Only) console.log(`  APT distributed: ${count * APT_PER_ACCOUNT} APT`);
  if (!aptOnly) console.log(`  USD1 minted: ${count * USD1_PER_ACCOUNT} USD1`);
  console.log();
  console.log('  Next steps:');
  console.log('    1. source .env.seed');
  console.log('    2. npx tsx server/hft-piscina-server.ts quantum');
  console.log('='.repeat(70));
}

main().catch(console.error);
