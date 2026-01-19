#!/usr/bin/env npx tsx
/**
 * Fund APT Demo - Distribute APT to sender accounts for TPS testing
 *
 * Funds multiple sender accounts from a fee payer account.
 * On testnet, uses the faucet if needed.
 * On mainnet, requires a funded fee payer.
 *
 * Usage:
 *   # Testnet (uses faucet)
 *   SEED_MNEMONIC="..." npx tsx scripts/fund-apt-demo.ts
 *
 *   # Mainnet (requires funded fee payer)
 *   NETWORK=mainnet SEED_MNEMONIC="..." FEE_PAYER_KEY="0x..." npx tsx scripts/fund-apt-demo.ts
 *
 * Environment Variables:
 *   SEED_MNEMONIC     - Required: BIP-39 seed phrase for account derivation
 *   NETWORK           - mainnet|testnet (default: testnet)
 *   FEE_PAYER_KEY     - Private key of funded account (required for mainnet)
 *   NUM_SENDERS       - Number of sender accounts to fund (default: 500)
 *   FUNDING_AMOUNT    - Amount per sender in octas (default: 100000 = 0.001 APT)
 *   RPC_URL           - Custom RPC endpoint (optional)
 */

import {
  Aptos,
  AptosConfig,
  Network,
  Account,
  Ed25519PrivateKey,
} from '@aptos-labs/ts-sdk';
import { deriveAccount, validateMnemonic } from '../config/seed-accounts';

// ANSI colors
const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
};

// Configuration
const config = {
  network: (process.env.NETWORK?.toLowerCase() || 'testnet') as 'mainnet' | 'testnet',
  mnemonic: process.env.SEED_MNEMONIC || '',
  feePayerKey: process.env.FEE_PAYER_KEY || null,
  numSenders: parseInt(process.env.NUM_SENDERS || '500', 10),
  fundingAmount: parseInt(process.env.FUNDING_AMOUNT || '100000', 10), // 0.001 APT
  rpcUrl: process.env.RPC_URL || null,
};

// Get RPC endpoint
function getRpcEndpoint(): string {
  if (config.rpcUrl) return config.rpcUrl;
  if (config.network === 'mainnet') {
    return 'https://fullnode.mainnet.aptoslabs.com/v1';
  }
  return 'https://fullnode.testnet.aptoslabs.com/v1';
}

// Request testnet faucet
async function requestFaucet(address: string, amount: number = 100000000): Promise<boolean> {
  try {
    const response = await fetch(
      `https://faucet.testnet.aptoslabs.com/mint?amount=${amount}&address=${address}`,
      { method: 'POST', headers: { 'Content-Length': '0' } }
    );
    if (response.ok) {
      const data = await response.json();
      return Array.isArray(data) && data.length > 0;
    }
    return false;
  } catch {
    return false;
  }
}

// Check account balance
async function getBalance(aptos: Aptos, address: string): Promise<bigint> {
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

// Fund a single account
async function fundAccount(
  aptos: Aptos,
  feePayer: Account,
  recipientAddress: string,
  amount: number,
  nonce: bigint
): Promise<{ success: boolean; hash?: string; error?: string }> {
  try {
    const transaction = await aptos.transaction.build.simple({
      sender: feePayer.accountAddress,
      data: {
        function: '0x1::aptos_account::transfer',
        typeArguments: [],
        functionArguments: [recipientAddress, amount],
      },
      options: {
        accountSequenceNumber: nonce,
        maxGasAmount: 200,
        gasUnitPrice: 100,
      },
    });

    const pendingTxn = await aptos.signAndSubmitTransaction({
      signer: feePayer,
      transaction,
    });

    return { success: true, hash: pendingTxn.hash };
  } catch (e: any) {
    return { success: false, error: e.message?.slice(0, 100) };
  }
}

async function main(): Promise<void> {
  console.log();
  console.log(`${c.cyan}╔══════════════════════════════════════════════════════════════════════╗${c.reset}`);
  console.log(`${c.cyan}║${c.reset}           ${c.bold}FUND APT DEMO ACCOUNTS${c.reset}                                   ${c.cyan}║${c.reset}`);
  console.log(`${c.cyan}╚══════════════════════════════════════════════════════════════════════╝${c.reset}`);
  console.log();

  // Validate mnemonic
  if (!config.mnemonic) {
    console.error(`${c.red}ERROR:${c.reset} SEED_MNEMONIC environment variable required`);
    process.exit(1);
  }

  if (!validateMnemonic(config.mnemonic)) {
    console.error(`${c.red}ERROR:${c.reset} Invalid mnemonic phrase`);
    process.exit(1);
  }

  // Configuration display
  console.log(`${c.cyan}[CONFIG]${c.reset} Settings:`);
  console.log(`  ${c.dim}Network:${c.reset}         ${config.network.toUpperCase()}`);
  console.log(`  ${c.dim}Senders to fund:${c.reset} ${config.numSenders}`);
  console.log(`  ${c.dim}Amount each:${c.reset}     ${config.fundingAmount} octas (${config.fundingAmount / 100000000} APT)`);
  console.log(`  ${c.dim}Total needed:${c.reset}    ${(config.numSenders * config.fundingAmount / 100000000).toFixed(4)} APT`);
  console.log();

  // Create Aptos client
  const networkEnum = config.network === 'mainnet' ? Network.MAINNET : Network.TESTNET;
  const aptos = new Aptos(new AptosConfig({
    network: networkEnum,
    fullnode: getRpcEndpoint(),
  }));

  console.log(`${c.dim}[RPC]${c.reset} ${getRpcEndpoint()}`);

  // Set up fee payer
  let feePayer: Account;

  if (config.feePayerKey) {
    const privateKey = new Ed25519PrivateKey(config.feePayerKey);
    feePayer = Account.fromPrivateKey({ privateKey });
    console.log(`${c.cyan}[FEE PAYER]${c.reset} Using provided key: ${feePayer.accountAddress.toString().slice(0, 16)}...`);
  } else {
    // Use first derived account as fee payer
    feePayer = deriveAccount(config.mnemonic, 0);
    console.log(`${c.cyan}[FEE PAYER]${c.reset} Using derived account 0: ${feePayer.accountAddress.toString().slice(0, 16)}...`);
  }

  // Check fee payer balance
  let feePayerBalance = await getBalance(aptos, feePayer.accountAddress.toString());
  console.log(`${c.cyan}[FEE PAYER]${c.reset} Balance: ${Number(feePayerBalance) / 100000000} APT`);

  // For testnet, fund fee payer from faucet if needed
  const totalNeeded = BigInt(config.numSenders * config.fundingAmount + 10000000); // +0.1 APT for gas

  if (config.network === 'testnet' && feePayerBalance < totalNeeded) {
    console.log();
    console.log(`${c.yellow}[FAUCET]${c.reset} Fee payer needs funding...`);

    const faucetAttempts = Math.ceil(Number(totalNeeded - feePayerBalance) / 100000000) + 1;
    for (let i = 0; i < Math.min(faucetAttempts, 10); i++) {
      const success = await requestFaucet(feePayer.accountAddress.toString());
      if (success) {
        console.log(`  ${c.green}[OK]${c.reset} Faucet request ${i + 1} succeeded`);
      } else {
        console.log(`  ${c.red}[FAIL]${c.reset} Faucet request ${i + 1} failed`);
      }
      await new Promise(r => setTimeout(r, 1000));
    }

    // Recheck balance
    await new Promise(r => setTimeout(r, 2000));
    feePayerBalance = await getBalance(aptos, feePayer.accountAddress.toString());
    console.log(`${c.cyan}[FEE PAYER]${c.reset} Updated balance: ${Number(feePayerBalance) / 100000000} APT`);
  }

  if (feePayerBalance < totalNeeded) {
    console.error();
    console.error(`${c.red}ERROR:${c.reset} Insufficient balance`);
    console.error(`  Have: ${Number(feePayerBalance) / 100000000} APT`);
    console.error(`  Need: ${Number(totalNeeded) / 100000000} APT`);
    process.exit(1);
  }

  // Generate sender addresses
  console.log();
  console.log(`${c.cyan}[DERIVE]${c.reset} Generating ${config.numSenders} sender addresses...`);
  const senderAddresses: string[] = [];

  for (let i = 0; i < config.numSenders; i++) {
    const account = deriveAccount(config.mnemonic, i);
    senderAddresses.push(account.accountAddress.toString());
  }
  console.log(`${c.green}[DERIVE]${c.reset} Generated ${senderAddresses.length} addresses`);

  // Check which accounts need funding
  console.log();
  console.log(`${c.cyan}[CHECK]${c.reset} Checking existing balances...`);
  const accountsToFund: string[] = [];

  for (let i = 0; i < senderAddresses.length; i++) {
    const balance = await getBalance(aptos, senderAddresses[i]);
    if (balance < BigInt(config.fundingAmount)) {
      accountsToFund.push(senderAddresses[i]);
    }
    if ((i + 1) % 50 === 0) {
      process.stdout.write(`\r${c.dim}[CHECK]${c.reset} ${i + 1}/${senderAddresses.length}`);
    }
  }
  console.log(`\r${c.green}[CHECK]${c.reset} ${senderAddresses.length}/${senderAddresses.length} - ${accountsToFund.length} need funding`);

  if (accountsToFund.length === 0) {
    console.log();
    console.log(`${c.green}All accounts already funded!${c.reset}`);
    process.exit(0);
  }

  // Get fee payer nonce
  const feePayerInfo = await aptos.account.getAccountInfo({
    accountAddress: feePayer.accountAddress,
  });
  let nonce = BigInt(feePayerInfo.sequence_number);

  // Fund accounts
  console.log();
  console.log(`${c.cyan}[FUND]${c.reset} Funding ${accountsToFund.length} accounts...`);

  let funded = 0;
  let failed = 0;

  // Process sequentially to maintain nonce order
  for (const addr of accountsToFund) {
    const result = await fundAccount(aptos, feePayer, addr, config.fundingAmount, nonce);

    if (result.success) {
      funded++;
      nonce++;
    } else {
      failed++;
      // Refresh nonce on error
      try {
        const info = await aptos.account.getAccountInfo({
          accountAddress: feePayer.accountAddress,
        });
        nonce = BigInt(info.sequence_number);
      } catch {}
    }

    if ((funded + failed) % 10 === 0) {
      process.stdout.write(`\r${c.dim}[FUND]${c.reset} ${funded + failed}/${accountsToFund.length} (${c.green}${funded}${c.reset} success, ${c.red}${failed}${c.reset} failed)`);
    }
  }

  console.log(`\r${c.green}[FUND]${c.reset} ${funded + failed}/${accountsToFund.length} (${funded} success, ${failed} failed)   `);

  // Final balance check
  await new Promise(r => setTimeout(r, 2000));
  const finalFeePayerBalance = await getBalance(aptos, feePayer.accountAddress.toString());
  const spent = Number(feePayerBalance - finalFeePayerBalance) / 100000000;

  console.log();
  console.log(`${c.cyan}═══════════════════════════════════════════════════════════════════════${c.reset}`);
  console.log(`${c.bold}                              RESULTS${c.reset}`);
  console.log(`${c.cyan}═══════════════════════════════════════════════════════════════════════${c.reset}`);
  console.log(`  ${c.dim}Accounts funded:${c.reset}  ${c.green}${funded}${c.reset}`);
  console.log(`  ${c.dim}Accounts failed:${c.reset}  ${c.red}${failed}${c.reset}`);
  console.log(`  ${c.dim}APT spent:${c.reset}        ${spent.toFixed(4)} APT`);
  console.log(`  ${c.dim}Fee payer balance:${c.reset} ${Number(finalFeePayerBalance) / 100000000} APT`);
  console.log(`${c.cyan}═══════════════════════════════════════════════════════════════════════${c.reset}`);
  console.log();

  if (failed > 0) {
    console.log(`${c.yellow}Warning:${c.reset} ${failed} accounts failed to fund. Run again to retry.`);
  } else {
    console.log(`${c.green}Ready to run:${c.reset} npx tsx scripts/apt-transfer-demo.ts [mode]`);
  }
}

main().catch(e => {
  console.error(`${c.red}Fatal error:${c.reset}`, e);
  process.exit(1);
});
