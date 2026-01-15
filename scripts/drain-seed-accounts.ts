#!/usr/bin/env npx tsx
/**
 * Drain Seed Accounts
 *
 * Consolidates APT and USD1 from all seed-derived accounts back to the deployer.
 * Useful for recovering funds after benchmarking.
 *
 * Usage:
 *   source .env.seed && npx tsx scripts/drain-seed-accounts.ts
 *   source .env.seed && npx tsx scripts/drain-seed-accounts.ts --apt-only
 *   source .env.seed && npx tsx scripts/drain-seed-accounts.ts --usd1-only
 *   source .env.seed && npx tsx scripts/drain-seed-accounts.ts --count 100
 *   source .env.seed && npx tsx scripts/drain-seed-accounts.ts --dry-run
 */

import {
  Aptos,
  AptosConfig,
  Network,
  Account,
  Ed25519PrivateKey,
} from '@aptos-labs/ts-sdk';
import {
  deriveAccounts,
  validateMnemonic,
} from '../config/seed-accounts';
import { WALLETS, CONTRACTS, cleanKey } from '../config/wallets';

// Configuration
const ACCOUNT_COUNT = parseInt(process.env.ACCOUNT_COUNT || '500');
const OCTAS_PER_APT = 100_000_000;
const USD1_DECIMALS = 100_000_000;
const MIN_APT_KEEP = 0.01 * OCTAS_PER_APT; // Keep 0.01 APT for gas

const CONTRACT_ADDRESS = CONTRACTS.address;
const USD1_MODULE = `${CONTRACT_ADDRESS}::usd1`;

// Parse args
const args = process.argv.slice(2);
const aptOnly = args.includes('--apt-only');
const usd1Only = args.includes('--usd1-only');
const dryRun = args.includes('--dry-run');
const countIdx = args.indexOf('--count');
const count = countIdx >= 0 ? parseInt(args[countIdx + 1]) : ACCOUNT_COUNT;

async function drainAPT(
  aptos: Aptos,
  accounts: Account[],
  targetAddress: string
): Promise<{ success: number; failed: number; totalDrained: number }> {
  let success = 0;
  let failed = 0;
  let totalDrained = 0;

  for (let i = 0; i < accounts.length; i++) {
    const account = accounts[i];
    const address = account.accountAddress.toString();

    try {
      // Get balance
      let balance = 0;
      try {
        balance = await aptos.getAccountAPTAmount({ accountAddress: account.accountAddress });
      } catch {
        // No balance
      }

      // Skip if not enough to transfer
      const transferAmount = balance - MIN_APT_KEEP;
      if (transferAmount <= 0) {
        process.stdout.write(`[${i}] ${address.slice(0, 10)}... ✓ no APT to drain\n`);
        success++;
        continue;
      }

      if (dryRun) {
        process.stdout.write(`[${i}] ${address.slice(0, 10)}... [DRY] would drain ${(transferAmount / OCTAS_PER_APT).toFixed(2)} APT\n`);
        totalDrained += transferAmount;
        success++;
        continue;
      }

      // Transfer APT to target
      const txn = await aptos.transferCoinTransaction({
        sender: account.accountAddress,
        recipient: targetAddress,
        amount: transferAmount,
      });

      const pendingTxn = await aptos.signAndSubmitTransaction({
        signer: account,
        transaction: txn,
      });

      await aptos.waitForTransaction({ transactionHash: pendingTxn.hash });

      const drainedApt = transferAmount / OCTAS_PER_APT;
      totalDrained += transferAmount;
      process.stdout.write(`[${i}] ${address.slice(0, 10)}... ✓ drained ${drainedApt.toFixed(2)} APT\n`);
      success++;
    } catch (e: any) {
      process.stdout.write(`[${i}] ${address.slice(0, 10)}... ✗ ${e.message?.slice(0, 30)}\n`);
      failed++;
    }

    // Progress update every 50 accounts
    if (i % 50 === 49) {
      console.log(`--- APT Drain Progress: ${i + 1}/${accounts.length} ---`);
    }
  }

  return { success, failed, totalDrained };
}

async function drainUSD1(
  aptos: Aptos,
  accounts: Account[],
  targetAddress: string
): Promise<{ success: number; failed: number; totalDrained: number }> {
  let success = 0;
  let failed = 0;
  let totalDrained = 0;

  for (let i = 0; i < accounts.length; i++) {
    const account = accounts[i];
    const address = account.accountAddress.toString();

    try {
      // Get USD1 balance
      let balance = 0;
      try {
        const balanceResult = await aptos.view({
          payload: {
            function: `${USD1_MODULE}::balance`,
            functionArguments: [address],
          },
        });
        balance = Number(balanceResult[0]);
      } catch {
        // No USD1 balance
      }

      // Skip if no balance
      if (balance <= 0) {
        process.stdout.write(`[${i}] ${address.slice(0, 10)}... ✓ no USD1 to drain\n`);
        success++;
        continue;
      }

      if (dryRun) {
        process.stdout.write(`[${i}] ${address.slice(0, 10)}... [DRY] would drain ${(balance / USD1_DECIMALS).toFixed(0)} USD1\n`);
        totalDrained += balance;
        success++;
        continue;
      }

      // Transfer USD1 to target
      const txn = await aptos.transaction.build.simple({
        sender: account.accountAddress,
        data: {
          function: `${USD1_MODULE}::transfer`,
          functionArguments: [targetAddress, balance],
        },
      });

      const pendingTxn = await aptos.signAndSubmitTransaction({
        signer: account,
        transaction: txn,
      });

      await aptos.waitForTransaction({ transactionHash: pendingTxn.hash });

      const drainedUsd1 = balance / USD1_DECIMALS;
      totalDrained += balance;
      process.stdout.write(`[${i}] ${address.slice(0, 10)}... ✓ drained ${drainedUsd1.toFixed(0)} USD1\n`);
      success++;
    } catch (e: any) {
      process.stdout.write(`[${i}] ${address.slice(0, 10)}... ✗ ${e.message?.slice(0, 30)}\n`);
      failed++;
    }

    // Progress update every 50 accounts
    if (i % 50 === 49) {
      console.log(`--- USD1 Drain Progress: ${i + 1}/${accounts.length} ---`);
    }
  }

  return { success, failed, totalDrained };
}

async function main() {
  console.log('='.repeat(70));
  console.log('   SEED ACCOUNT DRAIN');
  console.log('   Consolidating funds back to deployer');
  if (dryRun) console.log('   [DRY RUN MODE - No actual transfers]');
  console.log('='.repeat(70));
  console.log();

  // Get mnemonic
  const mnemonic = process.env.SEED_MNEMONIC;
  if (!mnemonic) {
    console.error('ERROR: SEED_MNEMONIC environment variable not set');
    console.error('Run: source .env.seed && npx tsx scripts/drain-seed-accounts.ts');
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

  // Target address (deployer)
  const deployer = Account.fromPrivateKey({
    privateKey: new Ed25519PrivateKey(cleanKey(WALLETS.deployer.key)),
  });
  const targetAddress = deployer.accountAddress.toString();

  console.log(`RPC: ${rpcUrl}`);
  console.log(`Accounts to drain: ${count}`);
  console.log(`Target address: ${targetAddress}`);
  console.log(`Mode: ${aptOnly ? 'APT only' : usd1Only ? 'USD1 only' : 'Both APT and USD1'}`);
  console.log();

  // Derive accounts
  console.log(`Deriving ${count} accounts from seed...`);
  const startDerive = Date.now();
  const accounts = deriveAccounts(mnemonic, count);
  console.log(`Derived ${accounts.length} accounts in ${Date.now() - startDerive}ms`);
  console.log();

  // Drain USD1 first (need APT for gas)
  if (!aptOnly) {
    console.log('='.repeat(70));
    console.log('   PHASE 1: USD1 DRAIN');
    console.log('='.repeat(70));
    console.log();

    const usd1Start = Date.now();
    const usd1Result = await drainUSD1(aptos, accounts, targetAddress);
    const usd1Elapsed = Date.now() - usd1Start;

    console.log();
    console.log(`USD1 Drain complete:`);
    console.log(`  Success: ${usd1Result.success}/${count}`);
    console.log(`  Failed: ${usd1Result.failed}`);
    console.log(`  Total drained: ${(usd1Result.totalDrained / USD1_DECIMALS).toFixed(0)} USD1`);
    console.log(`  Time: ${(usd1Elapsed / 1000).toFixed(1)}s`);
    console.log();
  }

  // Drain APT
  if (!usd1Only) {
    console.log('='.repeat(70));
    console.log('   PHASE 2: APT DRAIN');
    console.log('='.repeat(70));
    console.log();

    const aptStart = Date.now();
    const aptResult = await drainAPT(aptos, accounts, targetAddress);
    const aptElapsed = Date.now() - aptStart;

    console.log();
    console.log(`APT Drain complete:`);
    console.log(`  Success: ${aptResult.success}/${count}`);
    console.log(`  Failed: ${aptResult.failed}`);
    console.log(`  Total drained: ${(aptResult.totalDrained / OCTAS_PER_APT).toFixed(2)} APT`);
    console.log(`  Time: ${(aptElapsed / 1000).toFixed(1)}s`);
    console.log();
  }

  // Summary
  console.log('='.repeat(70));
  console.log('   DRAIN COMPLETE');
  console.log('='.repeat(70));
  console.log(`  Total accounts: ${count}`);
  console.log(`  Target: ${targetAddress}`);
  if (dryRun) {
    console.log('  [DRY RUN - No actual transfers made]');
  }
  console.log('='.repeat(70));
}

main().catch(console.error);
