#!/usr/bin/env npx tsx
/**
 * Check Seed Account Balances
 *
 * Audits all seed-derived accounts for APT and USD1 balances.
 * Useful for verifying funding status before running benchmarks.
 *
 * Usage:
 *   source .env.seed && npx tsx scripts/check-seed-accounts.ts
 *   source .env.seed && npx tsx scripts/check-seed-accounts.ts --count 100
 *   source .env.seed && npx tsx scripts/check-seed-accounts.ts --summary
 */

import {
  Aptos,
  AptosConfig,
  Network,
} from '@aptos-labs/ts-sdk';
import {
  deriveAccounts,
  validateMnemonic,
} from '../config/seed-accounts';
import { CONTRACTS } from '../config/wallets';

// Configuration
const ACCOUNT_COUNT = parseInt(process.env.ACCOUNT_COUNT || '500');
const PARALLEL_BATCH_SIZE = 20;

const OCTAS_PER_APT = 100_000_000;
const USD1_DECIMALS = 100_000_000;

const CONTRACT_ADDRESS = CONTRACTS.address;
const USD1_MODULE = `${CONTRACT_ADDRESS}::usd1`;

// Parse args
const args = process.argv.slice(2);
const summaryOnly = args.includes('--summary');
const countIdx = args.indexOf('--count');
const count = countIdx >= 0 ? parseInt(args[countIdx + 1]) : ACCOUNT_COUNT;

interface AccountStatus {
  index: number;
  address: string;
  aptBalance: number;
  usd1Balance: number;
  hasEnoughApt: boolean;
  hasEnoughUsd1: boolean;
}

async function checkAccountBatch(
  aptos: Aptos,
  addresses: { index: number; address: string }[]
): Promise<AccountStatus[]> {
  const results: AccountStatus[] = [];

  for (const { index, address } of addresses) {
    let aptBalance = 0;
    let usd1Balance = 0;

    // Check APT balance
    try {
      aptBalance = await aptos.getAccountAPTAmount({ accountAddress: address });
    } catch {
      // Account doesn't exist or no balance
    }

    // Check USD1 balance
    try {
      const balanceResult = await aptos.view({
        payload: {
          function: `${USD1_MODULE}::balance`,
          functionArguments: [address],
        },
      });
      usd1Balance = Number(balanceResult[0]);
    } catch {
      // No USD1 balance
    }

    results.push({
      index,
      address,
      aptBalance: aptBalance / OCTAS_PER_APT,
      usd1Balance: usd1Balance / USD1_DECIMALS,
      hasEnoughApt: aptBalance >= 1 * OCTAS_PER_APT, // At least 1 APT
      hasEnoughUsd1: usd1Balance >= 500 * USD1_DECIMALS, // At least 500 USD1
    });
  }

  return results;
}

async function main() {
  console.log('='.repeat(70));
  console.log('   SEED ACCOUNT BALANCE CHECKER');
  console.log('='.repeat(70));
  console.log();

  // Get mnemonic
  const mnemonic = process.env.SEED_MNEMONIC;
  if (!mnemonic) {
    console.error('ERROR: SEED_MNEMONIC environment variable not set');
    console.error('Run: source .env.seed && npx tsx scripts/check-seed-accounts.ts');
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
  console.log(`Checking ${count} accounts...`);
  console.log();

  // Derive accounts
  console.log('Deriving accounts...');
  const accounts = deriveAccounts(mnemonic, count);
  console.log(`Derived ${accounts.length} accounts`);
  console.log();

  // Check balances in parallel batches
  const allStatuses: AccountStatus[] = [];
  const startTime = Date.now();

  for (let i = 0; i < accounts.length; i += PARALLEL_BATCH_SIZE) {
    const batch = accounts.slice(i, i + PARALLEL_BATCH_SIZE);
    const addressBatch = batch.map((acc, batchIdx) => ({
      index: i + batchIdx,
      address: acc.accountAddress.toString(),
    }));

    const batchStatuses = await checkAccountBatch(aptos, addressBatch);
    allStatuses.push(...batchStatuses);

    // Progress
    const processed = Math.min(i + PARALLEL_BATCH_SIZE, accounts.length);
    process.stdout.write(`\rProgress: ${processed}/${accounts.length}`);
  }

  console.log('\n');
  const elapsed = Date.now() - startTime;

  // Calculate summary
  const totalApt = allStatuses.reduce((sum, s) => sum + s.aptBalance, 0);
  const totalUsd1 = allStatuses.reduce((sum, s) => sum + s.usd1Balance, 0);
  const fundedApt = allStatuses.filter(s => s.hasEnoughApt).length;
  const fundedUsd1 = allStatuses.filter(s => s.hasEnoughUsd1).length;
  const fullyFunded = allStatuses.filter(s => s.hasEnoughApt && s.hasEnoughUsd1).length;
  const unfunded = allStatuses.filter(s => !s.hasEnoughApt && !s.hasEnoughUsd1).length;

  // Print individual statuses (unless summary only)
  if (!summaryOnly) {
    console.log('Individual Account Status:');
    console.log('-'.repeat(70));
    console.log('Index  | Address                                            | APT      | USD1     | Status');
    console.log('-'.repeat(70));

    for (const status of allStatuses) {
      const apt = status.aptBalance.toFixed(2).padStart(8);
      const usd1 = status.usd1Balance.toFixed(0).padStart(8);
      const addr = status.address.slice(0, 10) + '...' + status.address.slice(-8);
      const idx = String(status.index).padStart(5);

      let statusIcon = '';
      if (status.hasEnoughApt && status.hasEnoughUsd1) {
        statusIcon = '\x1b[32m✓✓\x1b[0m'; // Green double check
      } else if (status.hasEnoughApt) {
        statusIcon = '\x1b[33m✓-\x1b[0m'; // Yellow (APT only)
      } else if (status.hasEnoughUsd1) {
        statusIcon = '\x1b[33m-✓\x1b[0m'; // Yellow (USD1 only)
      } else {
        statusIcon = '\x1b[31m--\x1b[0m'; // Red (neither)
      }

      console.log(`${idx}  | ${addr} | ${apt} | ${usd1} | ${statusIcon}`);
    }
    console.log('-'.repeat(70));
    console.log();
  }

  // Print summary
  console.log('='.repeat(70));
  console.log('   SUMMARY');
  console.log('='.repeat(70));
  console.log(`  Total Accounts: ${count}`);
  console.log(`  Check Time: ${(elapsed / 1000).toFixed(1)}s`);
  console.log();
  console.log('  BALANCES:');
  console.log(`    Total APT: ${totalApt.toFixed(2)} APT`);
  console.log(`    Total USD1: ${totalUsd1.toFixed(0)} USD1`);
  console.log();
  console.log('  FUNDING STATUS:');
  console.log(`    Fully Funded (APT + USD1): ${fullyFunded}/${count} (${((fullyFunded / count) * 100).toFixed(1)}%)`);
  console.log(`    Has APT (≥1): ${fundedApt}/${count} (${((fundedApt / count) * 100).toFixed(1)}%)`);
  console.log(`    Has USD1 (≥500): ${fundedUsd1}/${count} (${((fundedUsd1 / count) * 100).toFixed(1)}%)`);
  console.log(`    Unfunded: ${unfunded}/${count}`);
  console.log();

  // Print accounts that need funding
  const needsFunding = allStatuses.filter(s => !s.hasEnoughApt || !s.hasEnoughUsd1);
  if (needsFunding.length > 0 && needsFunding.length <= 20) {
    console.log('  ACCOUNTS NEEDING FUNDING:');
    for (const status of needsFunding) {
      const needs = [];
      if (!status.hasEnoughApt) needs.push('APT');
      if (!status.hasEnoughUsd1) needs.push('USD1');
      console.log(`    [${status.index}] ${status.address.slice(0, 20)}... needs: ${needs.join(', ')}`);
    }
    console.log();
  } else if (needsFunding.length > 20) {
    console.log(`  ${needsFunding.length} accounts need funding. Run fund-seed-accounts.ts to fund them.`);
    console.log();
  }

  // Final recommendation
  if (fullyFunded === count) {
    console.log('\x1b[32m  ✓ All accounts are fully funded and ready for benchmarking!\x1b[0m');
  } else if (fullyFunded > count * 0.9) {
    console.log('\x1b[33m  ! Most accounts are funded. Consider funding remaining accounts.\x1b[0m');
  } else {
    console.log('\x1b[31m  ✗ Many accounts need funding. Run: npx tsx scripts/fund-seed-accounts.ts\x1b[0m');
  }
  console.log('='.repeat(70));
}

main().catch(console.error);
