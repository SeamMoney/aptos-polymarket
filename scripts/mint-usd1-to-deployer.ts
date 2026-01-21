#!/usr/bin/env npx tsx
/**
 * Mint USD1 to Deployer - Prepare deployer account for USD1 demo funding
 *
 * The USD1 contract has open minting for demo purposes.
 * This script mints USD1 to the deployer account so fund-usd1-demo.ts can distribute it.
 *
 * Usage:
 *   npx tsx scripts/mint-usd1-to-deployer.ts [amount_in_usd1]
 *
 *   Example:
 *   npx tsx scripts/mint-usd1-to-deployer.ts 100000   # Mint 100,000 USD1
 *
 * Environment Variables:
 *   FEE_PAYER_KEY  - Optional: Custom signer (default: deployer from wallets.ts)
 *   RPC_URL        - Optional: Custom RPC endpoint
 */

import {
  Aptos,
  AptosConfig,
  Network,
  Account,
  Ed25519PrivateKey,
} from '@aptos-labs/ts-sdk';
import { WALLETS, CONTRACTS } from '../config/wallets';

// ANSI colors
const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
};

// Configuration
const config = {
  contractAddress: CONTRACTS.address,
  usd1Metadata: CONTRACTS.usd1Metadata,
  deployerKey: WALLETS.deployer.key,
  rpcUrl: process.env.RPC_URL || 'https://fullnode.testnet.aptoslabs.com/v1',
};

// USD1 decimals (8, same as APT)
const DECIMALS = 8;

async function getUsd1Balance(aptos: Aptos, address: string): Promise<bigint> {
  try {
    const result = await aptos.view({
      payload: {
        function: '0x1::primary_fungible_store::balance',
        typeArguments: ['0x1::fungible_asset::Metadata'],
        functionArguments: [address, config.usd1Metadata],
      },
    });
    return BigInt(result[0] as string);
  } catch {
    return BigInt(0);
  }
}

async function getAptBalance(aptos: Aptos, address: string): Promise<bigint> {
  try {
    const result = await aptos.view({
      payload: {
        function: '0x1::coin::balance',
        typeArguments: ['0x1::aptos_coin::AptosCoin'],
        functionArguments: [address],
      },
    });
    return BigInt(result[0] as string);
  } catch {
    return BigInt(0);
  }
}

async function main(): Promise<void> {
  // Parse amount from command line
  const amountArg = process.argv[2];
  const amountUsd1 = amountArg ? parseInt(amountArg, 10) : 100000; // Default 100K USD1

  if (isNaN(amountUsd1) || amountUsd1 <= 0) {
    console.error(`${c.red}ERROR:${c.reset} Invalid amount. Usage: npx tsx scripts/mint-usd1-to-deployer.ts [amount_in_usd1]`);
    process.exit(1);
  }

  // Convert to smallest unit (8 decimals)
  const amountSmallest = BigInt(amountUsd1) * BigInt(10 ** DECIMALS);

  console.log();
  console.log(`${c.cyan}╔══════════════════════════════════════════════════════════════════════╗${c.reset}`);
  console.log(`${c.cyan}║${c.reset}           ${c.bold}MINT USD1 TO DEPLOYER${c.reset}                                     ${c.cyan}║${c.reset}`);
  console.log(`${c.cyan}╚══════════════════════════════════════════════════════════════════════╝${c.reset}`);
  console.log();

  // Create deployer account
  const feePayerKey = process.env.FEE_PAYER_KEY || config.deployerKey;
  const privateKey = new Ed25519PrivateKey(feePayerKey);
  const deployer = Account.fromPrivateKey({ privateKey });
  const deployerAddress = deployer.accountAddress.toString();

  console.log(`${c.cyan}[CONFIG]${c.reset}`);
  console.log(`  ${c.dim}Contract:${c.reset}     ${config.contractAddress.slice(0, 20)}...`);
  console.log(`  ${c.dim}USD1 Meta:${c.reset}    ${config.usd1Metadata.slice(0, 20)}...`);
  console.log(`  ${c.dim}Deployer:${c.reset}     ${deployerAddress.slice(0, 20)}...`);
  console.log(`  ${c.dim}Amount:${c.reset}       ${amountUsd1.toLocaleString()} USD1`);
  console.log(`  ${c.dim}RPC:${c.reset}          ${config.rpcUrl}`);
  console.log();

  // Create Aptos client
  const aptos = new Aptos(new AptosConfig({
    network: Network.TESTNET,
    fullnode: config.rpcUrl,
  }));

  // Check current balances
  const aptBalanceBefore = await getAptBalance(aptos, deployerAddress);
  const usd1BalanceBefore = await getUsd1Balance(aptos, deployerAddress);

  console.log(`${c.cyan}[BEFORE]${c.reset}`);
  console.log(`  ${c.dim}APT Balance:${c.reset}  ${Number(aptBalanceBefore) / 1e8} APT`);
  console.log(`  ${c.dim}USD1 Balance:${c.reset} ${Number(usd1BalanceBefore) / 1e8} USD1`);
  console.log();

  if (aptBalanceBefore < BigInt(1000000)) { // 0.01 APT minimum for gas
    console.error(`${c.red}ERROR:${c.reset} Deployer has insufficient APT for gas`);
    process.exit(1);
  }

  // Build mint transaction
  console.log(`${c.yellow}[MINT]${c.reset} Minting ${amountUsd1.toLocaleString()} USD1...`);

  try {
    const transaction = await aptos.transaction.build.simple({
      sender: deployer.accountAddress,
      data: {
        function: `${config.contractAddress}::usd1::mint`,
        typeArguments: [],
        functionArguments: [deployerAddress, amountSmallest.toString()],
      },
      options: {
        maxGasAmount: 10000,
        gasUnitPrice: 100,
      },
    });

    const pendingTxn = await aptos.signAndSubmitTransaction({
      signer: deployer,
      transaction,
    });

    console.log(`${c.dim}[TX]${c.reset} ${pendingTxn.hash}`);

    // Wait for confirmation
    console.log(`${c.dim}[WAIT]${c.reset} Waiting for confirmation...`);
    const result = await aptos.waitForTransaction({
      transactionHash: pendingTxn.hash,
      options: { timeoutSecs: 30 },
    });

    if (result.success) {
      console.log(`${c.green}[SUCCESS]${c.reset} Minted ${amountUsd1.toLocaleString()} USD1`);
    } else {
      console.error(`${c.red}[FAILED]${c.reset} Transaction failed: ${result.vm_status}`);
      process.exit(1);
    }

  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`${c.red}[ERROR]${c.reset} ${errorMsg}`);
    process.exit(1);
  }

  // Check balances after
  await new Promise(r => setTimeout(r, 2000)); // Wait for indexing
  const usd1BalanceAfter = await getUsd1Balance(aptos, deployerAddress);

  console.log();
  console.log(`${c.cyan}[AFTER]${c.reset}`);
  console.log(`  ${c.dim}USD1 Balance:${c.reset} ${Number(usd1BalanceAfter) / 1e8} USD1`);
  console.log();

  // Calculate how many accounts can be funded
  const accountsFundable = Math.floor(Number(usd1BalanceAfter) / (100 * 1e8)); // 100 USD1 per account

  console.log(`${c.cyan}═══════════════════════════════════════════════════════════════════════${c.reset}`);
  console.log(`${c.bold}                              READY${c.reset}`);
  console.log(`${c.cyan}═══════════════════════════════════════════════════════════════════════${c.reset}`);
  console.log();
  console.log(`  ${c.green}✓${c.reset} Deployer has ${Number(usd1BalanceAfter) / 1e8} USD1`);
  console.log(`  ${c.green}✓${c.reset} Can fund ~${accountsFundable.toLocaleString()} accounts (at 100 USD1 each)`);
  console.log();
  console.log(`  ${c.cyan}Next step:${c.reset}`);
  console.log(`    SEED_MNEMONIC="..." FEE_PAYER_KEY="${config.deployerKey}" \\`);
  console.log(`    USD1_METADATA="${config.usd1Metadata}" \\`);
  console.log(`    npx tsx scripts/fund-usd1-demo.ts`);
  console.log();
}

main().catch(e => {
  console.error(`${c.red}Fatal error:${c.reset}`, e);
  process.exit(1);
});
