/**
 * Fund HFT Accounts with USD1
 *
 * Mints USD1 to all trading accounts for high-TPS demos.
 *
 * Usage:
 *   ULTRA_PRIVATE_KEYS="key1,key2,..." npx tsx scripts/fund-usd1-accounts.ts
 *
 * Or with single account:
 *   APTOS_PRIVATE_KEY=0x... npx tsx scripts/fund-usd1-accounts.ts
 */

import {
  Aptos,
  AptosConfig,
  Network,
  Account,
  Ed25519PrivateKey,
} from '@aptos-labs/ts-sdk';

// Contract address - USD1 v2 with admin drainers (Jan 11, 2026)
const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS || '0xbdea15f5b0f5449ae8f3a6ae95a5e090bdeeec91be1fcac8375b2f5f37f1c134';
const USD1_MODULE = `${CONTRACT_ADDRESS}::usd1` as const;

// Amount to mint per account (default: 10,000 USD1)
const MINT_AMOUNT = Number(process.env.USD1_MINT_AMOUNT) || 10000_00000000; // 10,000 USD1 (8 decimals)
const MIN_BALANCE = Number(process.env.USD1_MIN_BALANCE) || 100_00000000; // 100 USD1 minimum

// HFT account keys (from fund-accounts.ts for fallback)
const DEFAULT_KEYS = [
  "0x6e2fca34586261b6f22a973c20024b78ddb370d87f7c974315fb97ba56716a7f",
  "0xe61d22b3dc37c537a20d5b301c4d2b409b2f93cd7b2915f3518d49517c2ab6c4",
  "0x4542c2e4a39beee8202eee0cddeceea886687b21b54b8f50c17e729251fdd7f5",
  "0xcf5154af9664bbc2634fddfcce2317ed788b35de7f004ac0e24aefd68a0b10c5",
];

async function main() {
  const aptos = new Aptos(new AptosConfig({ network: Network.TESTNET }));

  // Get private keys from env (ULTRA_PRIVATE_KEYS or single APTOS_PRIVATE_KEY) or use defaults
  let privateKeys: string[];

  if (process.env.ULTRA_PRIVATE_KEYS) {
    privateKeys = process.env.ULTRA_PRIVATE_KEYS.split(',').map(k => k.trim()).filter(k => k);
  } else if (process.env.APTOS_PRIVATE_KEY) {
    privateKeys = [process.env.APTOS_PRIVATE_KEY];
  } else {
    privateKeys = DEFAULT_KEYS;
  }

  console.log('');
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║           USD1 ACCOUNT FUNDING - HIGH TPS DEMO               ║');
  console.log('╠══════════════════════════════════════════════════════════════╣');
  console.log(`║  Accounts to fund: ${privateKeys.length}`.padEnd(65) + '║');
  console.log(`║  Mint amount: ${(MINT_AMOUNT / 100_000_000).toLocaleString()} USD1 per account`.padEnd(65) + '║');
  console.log(`║  Min balance: ${(MIN_BALANCE / 100_000_000).toLocaleString()} USD1`.padEnd(65) + '║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log('');

  // Check if USD1 is initialized
  let usd1Metadata: string;
  try {
    const metadataResult = await aptos.view({
      payload: {
        function: `${USD1_MODULE}::get_metadata_address`,
        functionArguments: [],
      },
    });
    usd1Metadata = metadataResult[0] as string;
    console.log(`✓ USD1 Metadata: ${usd1Metadata.slice(0, 30)}...`);
  } catch (e) {
    console.error('✗ USD1 not initialized! Run: npx tsx scripts/deploy-usd1-markets.ts --init-usd1');
    process.exit(1);
  }

  // Get a signer for minting (use first key as minter)
  const minterKey = new Ed25519PrivateKey(privateKeys[0].replace('ed25519-priv-', ''));
  const minter = Account.fromPrivateKey({ privateKey: minterKey });

  console.log(`\nMinter: ${minter.accountAddress.toString().slice(0, 20)}...`);
  console.log('');

  // Process each account
  let funded = 0;
  let skipped = 0;
  let failed = 0;

  for (const keyHex of privateKeys) {
    try {
      const privateKey = new Ed25519PrivateKey(keyHex.replace('ed25519-priv-', ''));
      const account = Account.fromPrivateKey({ privateKey });
      const addr = account.accountAddress.toString();

      // Check current USD1 balance
      let currentBalance: number;
      try {
        const balanceResult = await aptos.view({
          payload: {
            function: `${USD1_MODULE}::balance`,
            functionArguments: [addr],
          },
        });
        currentBalance = Number(balanceResult[0]);
      } catch {
        currentBalance = 0;
      }

      const balanceUSD1 = currentBalance / 100_000_000;
      process.stdout.write(`${addr.slice(0, 12)}... | ${balanceUSD1.toFixed(2).padStart(12)} USD1`);

      if (currentBalance >= MIN_BALANCE) {
        console.log(' | SKIP (sufficient)');
        skipped++;
        continue;
      }

      // Mint USD1 to this account
      const mintTx = await aptos.transaction.build.simple({
        sender: minter.accountAddress,
        data: {
          function: `${USD1_MODULE}::mint`,
          functionArguments: [addr, MINT_AMOUNT],
        },
      });

      const pendingTx = await aptos.signAndSubmitTransaction({
        signer: minter,
        transaction: mintTx,
      });

      await aptos.waitForTransaction({ transactionHash: pendingTx.hash });

      // Verify new balance
      const newBalanceResult = await aptos.view({
        payload: {
          function: `${USD1_MODULE}::balance`,
          functionArguments: [addr],
        },
      });
      const newBalance = Number(newBalanceResult[0]) / 100_000_000;
      console.log(` | MINTED → ${newBalance.toFixed(2)} USD1`);
      funded++;

      // Small delay to avoid rate limits
      await new Promise(r => setTimeout(r, 500));

    } catch (e: any) {
      console.log(` | ERROR: ${e.message.slice(0, 30)}...`);
      failed++;
    }
  }

  // Summary
  console.log('');
  console.log('═'.repeat(60));
  console.log(`Funded: ${funded} | Skipped: ${skipped} | Failed: ${failed}`);
  console.log('═'.repeat(60));

  if (funded > 0) {
    console.log('\n✓ Accounts funded with USD1. Ready for high-TPS demo!');
  }
}

main().catch(console.error);
