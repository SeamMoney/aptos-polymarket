/**
 * Deploy prediction market contract to Aptos Mainnet
 *
 * Prerequisites:
 * 1. Real APT in your account (buy from exchange)
 * 2. Set APTOS_PRIVATE_KEY environment variable
 *
 * Usage: APTOS_PRIVATE_KEY=0x... npx tsx scripts/deploy-mainnet.ts
 */

import {
  Aptos,
  AptosConfig,
  Network,
  Account,
  Ed25519PrivateKey,
} from '@aptos-labs/ts-sdk';
import * as fs from 'fs';
import * as path from 'path';

// Geomi API key for mainnet
const GEOMI_API_KEY = 'AG-PBRRDTVTGPEDATI1NHY3UANNUYSKBPJMA';

const aptosConfig = new AptosConfig({
  network: Network.MAINNET,
  clientConfig: {
    HEADERS: {
      'Authorization': `Bearer ${GEOMI_API_KEY}`,
    },
  },
});
const aptos = new Aptos(aptosConfig);

async function getAccount(): Promise<Account> {
  const privateKey = process.env.APTOS_PRIVATE_KEY;
  if (!privateKey) {
    console.error('ERROR: Set APTOS_PRIVATE_KEY environment variable');
    process.exit(1);
  }
  return Account.fromPrivateKey({ privateKey: new Ed25519PrivateKey(privateKey) });
}

async function main() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('MAINNET DEPLOYMENT - PREDICTION MARKET');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('\n⚠️  WARNING: This deploys to MAINNET with REAL APT!');
  console.log('    Gas fees will cost real money.\n');

  const account = await getAccount();
  const address = account.accountAddress.toString();

  console.log(`Account: ${address}`);

  // Check balance
  try {
    const balance = await aptos.getAccountAPTAmount({ accountAddress: account.accountAddress });
    console.log(`Balance: ${(balance / 100_000_000).toFixed(4)} APT`);

    if (balance < 100_000_000) { // Less than 1 APT
      console.error('\n❌ Insufficient balance. Need at least 1 APT for deployment + gas.');
      console.log('\nTo get mainnet APT:');
      console.log('1. Buy APT from Coinbase, Binance, etc.');
      console.log('2. Send to your address: ' + address);
      process.exit(1);
    }
  } catch (err) {
    console.error('Could not check balance:', err);
    process.exit(1);
  }

  // Check if contract module exists
  const contractPath = path.join(__dirname, '..', 'contracts');
  if (!fs.existsSync(contractPath)) {
    console.error('\n❌ Contracts directory not found at:', contractPath);
    console.log('Run: aptos move compile --package-dir contracts');
    process.exit(1);
  }

  console.log('\n📦 To deploy, run:');
  console.log(`cd ${contractPath}`);
  console.log('aptos move publish --network mainnet --named-addresses prediction_market=default');

  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('After deployment, update CONTRACT_ADDRESS in hft-mainnet.ts');
  console.log('═══════════════════════════════════════════════════════════════\n');
}

main().catch(console.error);
