/**
 * DISPERSE USD1 TO ALL HFT ACCOUNTS
 *
 * 1. Mints USD1 to each HFT account
 * 2. Uses centralized wallet registry
 * 3. Parallel minting for speed
 *
 * Usage:
 *   npx tsx scripts/disperse-usd1.ts
 *   npx tsx scripts/disperse-usd1.ts --amount 50000  # Custom amount per account
 */

import {
  Aptos,
  AptosConfig,
  Network,
  Account,
  Ed25519PrivateKey,
} from '@aptos-labs/ts-sdk';
import { WALLETS, CONTRACTS, cleanKey } from '../config/wallets';

const CONTRACT_ADDRESS = CONTRACTS.address;
const USD1_MODULE = `${CONTRACT_ADDRESS}::usd1`;

// Parse command line args
const args = process.argv.slice(2);
const amountIndex = args.indexOf('--amount');
const AMOUNT_PER_ACCOUNT = amountIndex >= 0
  ? Number(args[amountIndex + 1]) * 100_000_000  // Convert to 8 decimals
  : 10000_00000000; // Default: 10,000 USD1

async function main() {
  const aptos = new Aptos(new AptosConfig({ network: Network.TESTNET }));

  console.log('');
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║              USD1 DISPERSAL - HFT ACCOUNTS                   ║');
  console.log('╠══════════════════════════════════════════════════════════════╣');
  console.log(`║  Contract: ${CONTRACT_ADDRESS.slice(0, 20)}...`.padEnd(65) + '║');
  console.log(`║  Amount per account: ${(AMOUNT_PER_ACCOUNT / 100_000_000).toLocaleString()} USD1`.padEnd(65) + '║');
  console.log(`║  Total accounts: ${WALLETS.hftAccounts.length}`.padEnd(65) + '║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log('');

  // Get USD1 deployer as minter (the contract deployer can mint)
  const minterKey = new Ed25519PrivateKey(cleanKey(WALLETS.usd1Deployer.key));
  const minter = Account.fromPrivateKey({ privateKey: minterKey });

  console.log(`Minter: ${minter.accountAddress.toString().slice(0, 20)}...`);
  console.log('');

  // Process each HFT account
  let success = 0;
  let failed = 0;

  for (const hftAccount of WALLETS.hftAccounts) {
    try {
      const key = new Ed25519PrivateKey(cleanKey(hftAccount.key));
      const account = Account.fromPrivateKey({ privateKey: key });
      const addr = account.accountAddress.toString();

      process.stdout.write(`Worker ${hftAccount.worker} | ${addr.slice(0, 16)}... `);

      // Mint USD1 to this account
      const mintTx = await aptos.transaction.build.simple({
        sender: minter.accountAddress,
        data: {
          function: `${USD1_MODULE}::mint`,
          functionArguments: [addr, AMOUNT_PER_ACCOUNT],
        },
      });

      const pendingTx = await aptos.signAndSubmitTransaction({
        signer: minter,
        transaction: mintTx,
      });

      await aptos.waitForTransaction({ transactionHash: pendingTx.hash });

      // Check balance
      const balanceResult = await aptos.view({
        payload: {
          function: `${USD1_MODULE}::balance`,
          functionArguments: [addr],
        },
      });
      const balance = Number(balanceResult[0]) / 100_000_000;

      console.log(`✓ ${balance.toLocaleString()} USD1`);
      success++;

      // Small delay to avoid rate limiting
      await new Promise(r => setTimeout(r, 200));

    } catch (e: any) {
      console.log(`✗ Error: ${e.message?.slice(0, 30) || e}`);
      failed++;
    }
  }

  // Summary
  console.log('');
  console.log('═'.repeat(60));
  console.log(`SUCCESS: ${success}/${WALLETS.hftAccounts.length} accounts funded`);
  if (failed > 0) {
    console.log(`FAILED: ${failed} accounts`);
  }
  console.log(`TOTAL MINTED: ${((success * AMOUNT_PER_ACCOUNT) / 100_000_000).toLocaleString()} USD1`);
  console.log('═'.repeat(60));
}

main().catch(console.error);
