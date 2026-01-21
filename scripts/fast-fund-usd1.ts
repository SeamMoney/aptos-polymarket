#!/usr/bin/env npx tsx
/**
 * Fast USD1 Funding - Sequential fire-and-forget (no wait for confirmation)
 */

import {
  Aptos,
  AptosConfig,
  Network,
  Account,
  Ed25519PrivateKey,
} from '@aptos-labs/ts-sdk';
import { deriveAccount, validateMnemonic } from '../config/seed-accounts';
import { WALLETS, CONTRACTS } from '../config/wallets';

const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
};

const USD1_AMOUNT = 100_000_000; // 1 USD1

async function main() {
  const mnemonic = process.env.SEED_MNEMONIC;
  if (!mnemonic || !validateMnemonic(mnemonic)) {
    console.error(`${c.red}ERROR:${c.reset} Invalid SEED_MNEMONIC`);
    process.exit(1);
  }

  const numAccounts = parseInt(process.env.NUM_ACCOUNTS || '500', 10);

  console.log();
  console.log(`${c.cyan}╔══════════════════════════════════════════════════════════════════════╗${c.reset}`);
  console.log(`${c.cyan}║${c.reset}           ${c.bold}FAST USD1 FUNDING (FIRE-AND-FORGET)${c.reset}                      ${c.cyan}║${c.reset}`);
  console.log(`${c.cyan}╚══════════════════════════════════════════════════════════════════════╝${c.reset}`);
  console.log();

  const aptos = new Aptos(new AptosConfig({
    network: Network.TESTNET,
    fullnode: 'https://fullnode.testnet.aptoslabs.com/v1',
  }));

  const feePayerKey = new Ed25519PrivateKey(process.env.FEE_PAYER_KEY || WALLETS.deployer.key);
  const feePayer = Account.fromPrivateKey({ privateKey: feePayerKey });

  console.log(`${c.cyan}[CONFIG]${c.reset} Funding ${numAccounts} accounts`);

  // Get starting nonce
  const accountInfo = await aptos.account.getAccountInfo({ accountAddress: feePayer.accountAddress });
  let nonce = BigInt(accountInfo.sequence_number);
  console.log(`${c.dim}Starting nonce: ${nonce}${c.reset}`);

  // Derive addresses (parallel check for balance)
  console.log(`${c.yellow}[1/2]${c.reset} Checking which accounts need USD1...`);
  const checkStart = Date.now();
  const needsFunding: string[] = [];

  const checkPromises = [];
  for (let i = 0; i < numAccounts; i++) {
    const addr = deriveAccount(mnemonic, i).accountAddress.toString();
    checkPromises.push(
      aptos.view({
        payload: {
          function: '0x1::primary_fungible_store::balance',
          typeArguments: ['0x1::fungible_asset::Metadata'],
          functionArguments: [addr, CONTRACTS.usd1Metadata],
        },
      }).then(r => ({ addr, bal: BigInt(r[0] as string) }))
        .catch(() => ({ addr, bal: BigInt(0) }))
    );
  }

  const balances = await Promise.all(checkPromises);
  for (const { addr, bal } of balances) {
    if (bal < BigInt(USD1_AMOUNT)) {
      needsFunding.push(addr);
    }
  }
  console.log(`${c.green}✓${c.reset} ${needsFunding.length}/${numAccounts} need USD1 (${Date.now() - checkStart}ms)`);

  if (needsFunding.length === 0) {
    console.log(`\n${c.green}All accounts funded!${c.reset}`);
    process.exit(0);
  }

  // Fund sequentially but fire-and-forget (no wait)
  console.log(`${c.yellow}[2/2]${c.reset} Submitting ${needsFunding.length} mint transactions...`);
  const fundStart = Date.now();
  let submitted = 0;
  let failed = 0;
  const hashes: string[] = [];

  for (const addr of needsFunding) {
    try {
      const txn = await aptos.transaction.build.simple({
        sender: feePayer.accountAddress,
        data: {
          function: `${CONTRACTS.address}::usd1::mint`,
          typeArguments: [],
          functionArguments: [addr, USD1_AMOUNT.toString()],
        },
        options: {
          accountSequenceNumber: nonce,
          maxGasAmount: 5000,
          gasUnitPrice: 100,
        },
      });

      const pending = await aptos.signAndSubmitTransaction({
        signer: feePayer,
        transaction: txn,
      });

      hashes.push(pending.hash);
      submitted++;
      nonce++;
    } catch (e: any) {
      failed++;
      // If sequence number error, refresh nonce
      if (e.message?.includes('SEQUENCE_NUMBER')) {
        const info = await aptos.account.getAccountInfo({ accountAddress: feePayer.accountAddress });
        nonce = BigInt(info.sequence_number);
      }
    }

    if ((submitted + failed) % 50 === 0 || submitted + failed === needsFunding.length) {
      const elapsed = ((Date.now() - fundStart) / 1000).toFixed(1);
      const rate = (submitted / parseFloat(elapsed)).toFixed(0);
      process.stdout.write(`\r  Submitted: ${submitted}/${needsFunding.length} | Failed: ${failed} | ${elapsed}s | ${rate}/s`);
    }
  }

  const totalTime = ((Date.now() - fundStart) / 1000).toFixed(1);
  console.log(`\n\n${c.cyan}═══════════════════════════════════════════════════════════════════════${c.reset}`);
  console.log(`${c.bold}                              RESULTS${c.reset}`);
  console.log(`${c.cyan}═══════════════════════════════════════════════════════════════════════${c.reset}`);
  console.log(`  ${c.green}Submitted:${c.reset} ${submitted} transactions`);
  console.log(`  ${c.red}Failed:${c.reset}    ${failed} transactions`);
  console.log(`  ${c.dim}Time:${c.reset}      ${totalTime}s`);
  console.log(`${c.cyan}═══════════════════════════════════════════════════════════════════════${c.reset}`);

  // Wait a bit then verify
  console.log(`\n${c.dim}Waiting 5s for confirmation...${c.reset}`);
  await new Promise(r => setTimeout(r, 5000));

  // Quick verification
  let verified = 0;
  const verifyPromises = needsFunding.slice(0, 50).map(addr =>
    aptos.view({
      payload: {
        function: '0x1::primary_fungible_store::balance',
        typeArguments: ['0x1::fungible_asset::Metadata'],
        functionArguments: [addr, CONTRACTS.usd1Metadata],
      },
    }).then(r => BigInt(r[0] as string) >= BigInt(USD1_AMOUNT))
      .catch(() => false)
  );
  const verifyResults = await Promise.all(verifyPromises);
  verified = verifyResults.filter(Boolean).length;

  console.log(`${c.cyan}[VERIFY]${c.reset} ${verified}/50 sample accounts confirmed funded`);

  if (verified < 40) {
    console.log(`\n${c.yellow}Run again to retry failed accounts${c.reset}`);
  } else {
    console.log(`\n${c.green}Ready!${c.reset} npx tsx scripts/usd1-transfer-demo.ts proven`);
  }
}

main().catch(e => {
  console.error(`${c.red}Fatal:${c.reset}`, e.message);
  process.exit(1);
});
