#!/usr/bin/env npx tsx
/**
 * Fund USD1 Demo - Distribute USD1 and APT to sender accounts for TPS testing
 *
 * Funds multiple sender accounts with:
 * - APT for gas fees
 * - USD1 tokens for transfers
 *
 * Usage:
 *   # Testnet
 *   SEED_MNEMONIC="..." USD1_METADATA="0x..." npx tsx scripts/fund-usd1-demo.ts
 *
 *   # Mainnet
 *   NETWORK=mainnet SEED_MNEMONIC="..." USD1_METADATA="0x..." FEE_PAYER_KEY="0x..." \
 *     npx tsx scripts/fund-usd1-demo.ts
 *
 * Environment Variables:
 *   SEED_MNEMONIC     - Required: BIP-39 seed phrase for account derivation
 *   USD1_METADATA     - Required: USD1 token metadata address
 *   NETWORK           - mainnet|testnet (default: testnet)
 *   FEE_PAYER_KEY     - Private key of funded account (required for mainnet)
 *   NUM_SENDERS       - Number of sender accounts to fund (default: 500)
 *   APT_AMOUNT        - APT per sender in octas (default: 100000 = 0.001 APT for gas)
 *   USD1_AMOUNT       - USD1 per sender in smallest unit (default: 100000000 = 1 USD1)
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
  magenta: '\x1b[35m',
};

// Configuration
const config = {
  network: (process.env.NETWORK?.toLowerCase() || 'testnet') as 'mainnet' | 'testnet',
  mnemonic: process.env.SEED_MNEMONIC || '',
  usd1Metadata: process.env.USD1_METADATA || '',
  feePayerKey: process.env.FEE_PAYER_KEY || null,
  numSenders: parseInt(process.env.NUM_SENDERS || '500', 10),
  aptAmount: parseInt(process.env.APT_AMOUNT || '100000', 10), // 0.001 APT for gas
  usd1Amount: parseInt(process.env.USD1_AMOUNT || '100000000', 10), // 1 USD1
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

// Check APT balance
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

// Check USD1/FA balance
async function getUsd1Balance(aptos: Aptos, address: string, metadata: string): Promise<bigint> {
  try {
    const result = await aptos.view({
      payload: {
        function: '0x1::primary_fungible_store::balance',
        typeArguments: ['0x1::fungible_asset::Metadata'],
        functionArguments: [address, metadata],
      },
    });
    return BigInt(result[0] as string);
  } catch {
    return BigInt(0);
  }
}

// Fund with APT
async function fundWithApt(
  aptos: Aptos,
  feePayer: Account,
  recipientAddress: string,
  amount: number,
  nonce: bigint
): Promise<{ success: boolean; hash?: string }> {
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
  } catch {
    return { success: false };
  }
}

// Fund with USD1
async function fundWithUsd1(
  aptos: Aptos,
  feePayer: Account,
  recipientAddress: string,
  metadata: string,
  amount: number,
  nonce: bigint
): Promise<{ success: boolean; hash?: string }> {
  try {
    const transaction = await aptos.transaction.build.simple({
      sender: feePayer.accountAddress,
      data: {
        function: '0x1::primary_fungible_store::transfer',
        typeArguments: ['0x1::fungible_asset::Metadata'],
        functionArguments: [metadata, recipientAddress, amount],
      },
      options: {
        accountSequenceNumber: nonce,
        maxGasAmount: 500,
        gasUnitPrice: 100,
      },
    });

    const pendingTxn = await aptos.signAndSubmitTransaction({
      signer: feePayer,
      transaction,
    });

    return { success: true, hash: pendingTxn.hash };
  } catch {
    return { success: false };
  }
}

async function main(): Promise<void> {
  console.log();
  console.log(`${c.cyan}╔══════════════════════════════════════════════════════════════════════╗${c.reset}`);
  console.log(`${c.cyan}║${c.reset}           ${c.bold}FUND USD1 DEMO ACCOUNTS${c.reset}                                  ${c.cyan}║${c.reset}`);
  console.log(`${c.cyan}╚══════════════════════════════════════════════════════════════════════╝${c.reset}`);
  console.log();

  // Validate inputs
  if (!config.mnemonic) {
    console.error(`${c.red}ERROR:${c.reset} SEED_MNEMONIC environment variable required`);
    process.exit(1);
  }

  if (!validateMnemonic(config.mnemonic)) {
    console.error(`${c.red}ERROR:${c.reset} Invalid mnemonic phrase`);
    process.exit(1);
  }

  if (!config.usd1Metadata) {
    console.error(`${c.red}ERROR:${c.reset} USD1_METADATA environment variable required`);
    process.exit(1);
  }

  // Configuration display
  console.log(`${c.cyan}[CONFIG]${c.reset} Settings:`);
  console.log(`  ${c.dim}Network:${c.reset}         ${config.network.toUpperCase()}`);
  console.log(`  ${c.dim}Senders to fund:${c.reset} ${config.numSenders}`);
  console.log(`  ${c.dim}APT per sender:${c.reset}  ${config.aptAmount} octas (${config.aptAmount / 100000000} APT)`);
  console.log(`  ${c.dim}USD1 per sender:${c.reset} ${config.usd1Amount} (${config.usd1Amount / 100000000} USD1)`);
  console.log(`  ${c.dim}USD1 metadata:${c.reset}   ${config.usd1Metadata.slice(0, 20)}...`);
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
    feePayer = deriveAccount(config.mnemonic, 0);
    console.log(`${c.cyan}[FEE PAYER]${c.reset} Using derived account 0: ${feePayer.accountAddress.toString().slice(0, 16)}...`);
  }

  // Check fee payer balances
  let aptBalance = await getAptBalance(aptos, feePayer.accountAddress.toString());
  let usd1Balance = await getUsd1Balance(aptos, feePayer.accountAddress.toString(), config.usd1Metadata);

  console.log(`${c.cyan}[FEE PAYER]${c.reset} APT Balance: ${Number(aptBalance) / 100000000} APT`);
  console.log(`${c.cyan}[FEE PAYER]${c.reset} USD1 Balance: ${Number(usd1Balance) / 100000000} USD1`);

  // Calculate needed amounts
  const aptNeeded = BigInt(config.numSenders * config.aptAmount + 10000000); // +0.1 APT for gas
  const usd1Needed = BigInt(config.numSenders * config.usd1Amount);

  // For testnet, try faucet for APT
  if (config.network === 'testnet' && aptBalance < aptNeeded) {
    console.log();
    console.log(`${c.yellow}[FAUCET]${c.reset} Fee payer needs APT...`);

    const faucetAttempts = Math.ceil(Number(aptNeeded - aptBalance) / 100000000) + 1;
    for (let i = 0; i < Math.min(faucetAttempts, 10); i++) {
      const success = await requestFaucet(feePayer.accountAddress.toString());
      if (success) {
        console.log(`  ${c.green}[OK]${c.reset} Faucet request ${i + 1} succeeded`);
      } else {
        console.log(`  ${c.red}[FAIL]${c.reset} Faucet request ${i + 1} failed`);
      }
      await new Promise(r => setTimeout(r, 1000));
    }

    await new Promise(r => setTimeout(r, 2000));
    aptBalance = await getAptBalance(aptos, feePayer.accountAddress.toString());
    console.log(`${c.cyan}[FEE PAYER]${c.reset} Updated APT balance: ${Number(aptBalance) / 100000000} APT`);
  }

  // Check balances are sufficient
  if (aptBalance < aptNeeded) {
    console.error();
    console.error(`${c.red}ERROR:${c.reset} Insufficient APT balance`);
    console.error(`  Have: ${Number(aptBalance) / 100000000} APT`);
    console.error(`  Need: ${Number(aptNeeded) / 100000000} APT`);
    process.exit(1);
  }

  if (usd1Balance < usd1Needed) {
    console.error();
    console.error(`${c.red}ERROR:${c.reset} Insufficient USD1 balance`);
    console.error(`  Have: ${Number(usd1Balance) / 100000000} USD1`);
    console.error(`  Need: ${Number(usd1Needed) / 100000000} USD1`);
    console.error();
    console.error(`Mint USD1 to the fee payer first, then run this script again.`);
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

  // Check which accounts need APT funding
  console.log();
  console.log(`${c.cyan}[CHECK]${c.reset} Checking APT balances...`);
  const needsApt: string[] = [];

  for (let i = 0; i < senderAddresses.length; i++) {
    const balance = await getAptBalance(aptos, senderAddresses[i]);
    if (balance < BigInt(config.aptAmount)) {
      needsApt.push(senderAddresses[i]);
    }
    if ((i + 1) % 50 === 0) {
      process.stdout.write(`\r${c.dim}[CHECK APT]${c.reset} ${i + 1}/${senderAddresses.length}`);
    }
  }
  console.log(`\r${c.green}[CHECK APT]${c.reset} ${needsApt.length} accounts need APT`);

  // Check which accounts need USD1 funding
  console.log(`${c.cyan}[CHECK]${c.reset} Checking USD1 balances...`);
  const needsUsd1: string[] = [];

  for (let i = 0; i < senderAddresses.length; i++) {
    const balance = await getUsd1Balance(aptos, senderAddresses[i], config.usd1Metadata);
    if (balance < BigInt(config.usd1Amount)) {
      needsUsd1.push(senderAddresses[i]);
    }
    if ((i + 1) % 50 === 0) {
      process.stdout.write(`\r${c.dim}[CHECK USD1]${c.reset} ${i + 1}/${senderAddresses.length}`);
    }
  }
  console.log(`\r${c.green}[CHECK USD1]${c.reset} ${needsUsd1.length} accounts need USD1`);

  if (needsApt.length === 0 && needsUsd1.length === 0) {
    console.log();
    console.log(`${c.green}All accounts already funded!${c.reset}`);
    process.exit(0);
  }

  // Get fee payer nonce
  const feePayerInfo = await aptos.account.getAccountInfo({
    accountAddress: feePayer.accountAddress,
  });
  let nonce = BigInt(feePayerInfo.sequence_number);

  // Fund APT
  let aptFunded = 0;
  let aptFailed = 0;

  if (needsApt.length > 0) {
    console.log();
    console.log(`${c.cyan}[FUND APT]${c.reset} Funding ${needsApt.length} accounts with APT...`);

    for (const addr of needsApt) {
      const result = await fundWithApt(aptos, feePayer, addr, config.aptAmount, nonce);
      if (result.success) {
        aptFunded++;
        nonce++;
      } else {
        aptFailed++;
        try {
          const info = await aptos.account.getAccountInfo({ accountAddress: feePayer.accountAddress });
          nonce = BigInt(info.sequence_number);
        } catch {}
      }

      if ((aptFunded + aptFailed) % 10 === 0) {
        process.stdout.write(`\r${c.dim}[FUND APT]${c.reset} ${aptFunded + aptFailed}/${needsApt.length}`);
      }
    }
    console.log(`\r${c.green}[FUND APT]${c.reset} ${aptFunded} success, ${aptFailed} failed   `);
  }

  // Fund USD1
  let usd1Funded = 0;
  let usd1Failed = 0;

  if (needsUsd1.length > 0) {
    console.log();
    console.log(`${c.magenta}[FUND USD1]${c.reset} Funding ${needsUsd1.length} accounts with USD1...`);

    for (const addr of needsUsd1) {
      const result = await fundWithUsd1(aptos, feePayer, addr, config.usd1Metadata, config.usd1Amount, nonce);
      if (result.success) {
        usd1Funded++;
        nonce++;
      } else {
        usd1Failed++;
        try {
          const info = await aptos.account.getAccountInfo({ accountAddress: feePayer.accountAddress });
          nonce = BigInt(info.sequence_number);
        } catch {}
      }

      if ((usd1Funded + usd1Failed) % 10 === 0) {
        process.stdout.write(`\r${c.dim}[FUND USD1]${c.reset} ${usd1Funded + usd1Failed}/${needsUsd1.length}`);
      }
    }
    console.log(`\r${c.green}[FUND USD1]${c.reset} ${usd1Funded} success, ${usd1Failed} failed   `);
  }

  // Final results
  await new Promise(r => setTimeout(r, 2000));
  const finalAptBalance = await getAptBalance(aptos, feePayer.accountAddress.toString());
  const finalUsd1Balance = await getUsd1Balance(aptos, feePayer.accountAddress.toString(), config.usd1Metadata);

  console.log();
  console.log(`${c.cyan}═══════════════════════════════════════════════════════════════════════${c.reset}`);
  console.log(`${c.bold}                              RESULTS${c.reset}`);
  console.log(`${c.cyan}═══════════════════════════════════════════════════════════════════════${c.reset}`);
  console.log(`  ${c.dim}APT funded:${c.reset}        ${c.green}${aptFunded}${c.reset} accounts`);
  console.log(`  ${c.dim}APT failed:${c.reset}        ${c.red}${aptFailed}${c.reset} accounts`);
  console.log(`  ${c.dim}USD1 funded:${c.reset}       ${c.green}${usd1Funded}${c.reset} accounts`);
  console.log(`  ${c.dim}USD1 failed:${c.reset}       ${c.red}${usd1Failed}${c.reset} accounts`);
  console.log();
  console.log(`  ${c.dim}Fee payer APT:${c.reset}     ${Number(finalAptBalance) / 100000000} APT`);
  console.log(`  ${c.dim}Fee payer USD1:${c.reset}    ${Number(finalUsd1Balance) / 100000000} USD1`);
  console.log(`${c.cyan}═══════════════════════════════════════════════════════════════════════${c.reset}`);
  console.log();

  if (aptFailed > 0 || usd1Failed > 0) {
    console.log(`${c.yellow}Warning:${c.reset} Some accounts failed to fund. Run again to retry.`);
  } else {
    console.log(`${c.green}Ready to run:${c.reset} USD1_METADATA="${config.usd1Metadata}" npx tsx scripts/usd1-transfer-demo.ts [mode]`);
  }
}

main().catch(e => {
  console.error(`${c.red}Fatal error:${c.reset}`, e);
  process.exit(1);
});
