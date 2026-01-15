#!/usr/bin/env npx tsx
/**
 * Generate 500 Aptos accounts from a BIP-39 seed phrase
 *
 * Usage:
 *   npx tsx scripts/generate-seed-accounts.ts                    # Generate new seed
 *   SEED_MNEMONIC="word1 word2 ..." npx tsx scripts/generate-seed-accounts.ts  # Use existing seed
 *
 * Output:
 *   - Displays mnemonic (SAVE THIS!)
 *   - Lists first 10 account addresses
 *   - Generates .env.seed with all configuration
 */

import fs from 'fs';
import {
  generateMnemonic,
  validateMnemonic,
  deriveAccounts,
  getPrivateKeysAsEnvString,
  DERIVATION_PATH_PREFIX,
} from '../config/seed-accounts';

const ACCOUNT_COUNT = parseInt(process.env.ACCOUNT_COUNT || '500');

async function main() {
  console.log('='.repeat(70));
  console.log('   SEED-BASED ACCOUNT GENERATOR');
  console.log('   Generating deterministic Aptos accounts from BIP-39 seed');
  console.log('='.repeat(70));
  console.log();

  // Get or generate mnemonic
  let mnemonic = process.env.SEED_MNEMONIC;
  let isNewSeed = false;

  if (mnemonic) {
    console.log('Using existing SEED_MNEMONIC from environment');
    if (!validateMnemonic(mnemonic)) {
      console.error('ERROR: Invalid mnemonic phrase!');
      process.exit(1);
    }
  } else {
    console.log('Generating NEW 24-word seed phrase...');
    mnemonic = generateMnemonic();
    isNewSeed = true;
  }

  console.log();
  console.log('=' .repeat(70));
  console.log('   MNEMONIC SEED PHRASE (SAVE THIS SECURELY!)');
  console.log('=' .repeat(70));
  console.log();
  console.log(mnemonic);
  console.log();
  console.log('=' .repeat(70));
  if (isNewSeed) {
    console.log('   WARNING: This is a NEW seed. Write it down and store safely!');
    console.log('=' .repeat(70));
  }
  console.log();

  // Derive accounts
  console.log(`Deriving ${ACCOUNT_COUNT} accounts...`);
  console.log(`Derivation path: ${DERIVATION_PATH_PREFIX}/<index>`);
  console.log();

  const startTime = Date.now();
  const accounts = deriveAccounts(mnemonic, ACCOUNT_COUNT);
  const elapsed = Date.now() - startTime;

  console.log(`Generated ${accounts.length} accounts in ${elapsed}ms`);
  console.log(`(${(elapsed / accounts.length).toFixed(2)}ms per account)`);
  console.log();

  // Display first 10 accounts
  console.log('First 10 accounts:');
  console.log('-'.repeat(70));
  for (let i = 0; i < Math.min(10, accounts.length); i++) {
    console.log(`  [${i}] ${accounts[i].accountAddress.toString()}`);
  }
  console.log('-'.repeat(70));
  console.log();

  // Generate environment file
  const envContent = `# Seed-Based Accounts Configuration
# Generated: ${new Date().toISOString()}
# Accounts: ${ACCOUNT_COUNT}
# Path: ${DERIVATION_PATH_PREFIX}/<index>

# CRITICAL: Store this mnemonic securely! Anyone with this phrase can access all accounts.
SEED_MNEMONIC="${mnemonic}"

# Number of accounts to use
ACCOUNT_COUNT=${ACCOUNT_COUNT}

# First 20 accounts as comma-separated keys (for backward compatibility)
# Use this with existing ULTRA_PRIVATE_KEYS-based scripts
ULTRA_PRIVATE_KEYS="${getPrivateKeysAsEnvString(mnemonic, 20)}"

# First 10 account addresses (for reference)
${accounts.slice(0, 10).map((a, i) => `# Account ${i}: ${a.accountAddress.toString()}`).join('\n')}

# RPC Configuration
RPC_MODE=internal
FULLNODE_URL=https://aptos.cash.trading/v1

# Contract Configuration (USD1)
CONTRACT_ADDRESS=0xbdea15f5b0f5449ae8f3a6ae95a5e090bdeeec91be1fcac8375b2f5f37f1c134
USD1_METADATA=0x4e977d5ee91d77d680972a44b38b9c7a2c5694439169eeae060a48324e5c4597
USE_USD1=true

# Markets (12 USD1 markets)
MULTI_MARKETS=0x3e690f317df664c413e12b15eaa6e5565606fbd46628464f84f93e0674a3c052,0xf3256638cad294e47c8cc6bb1a6a0fdd85b29ef427b3118028c34b9f061aa50d,0x192f7cfc0c8151deec37c6280c17b55f7557a04b580b486d6076cc11955ddde3,0x9e4583c0af174a119b5316ae84988f4fd988259de35ef95447b371744a355762,0xd82731a9a2259ccfef2fd13db13720c7cc927c5b7879aa160aecc618c4d4654f,0x77a65b92664f992ccbd8a17d73a5f2fc933523ce64a1c475d1db1c0fc2acf42a,0xa84ba7b7364a40031e29d355d7a5f48fd54f922c8eed0ed0009c5d660a6da339,0x8187c1b3b7ca06dbcbac36fe280e0b5343b744c5a299a43263f9162738d4d792,0x551f153ff61f94311a22592550b0ede4b3b57338af161bd9472f21e15da23b4b,0x742e3c66cb6570351ceb7cf1b2df87e726c708b786109a8cdae93b0c3c7b5a04,0x35df09c98f8668c06f6777e98e3a0405fe894c271f06ba2fed0b322e2a5c2f16,0xd3227afa81dce5fa0e8f86f61dc7f3215ee799a0d2e6a112a988e5ac732bf719
`;

  const envPath = '.env.seed';
  fs.writeFileSync(envPath, envContent);
  console.log(`Environment file written to: ${envPath}`);
  console.log();

  // Summary
  console.log('=' .repeat(70));
  console.log('   SUMMARY');
  console.log('=' .repeat(70));
  console.log(`  Total accounts: ${ACCOUNT_COUNT}`);
  console.log(`  Generation time: ${elapsed}ms`);
  console.log(`  Environment file: ${envPath}`);
  console.log();
  console.log('  Next steps:');
  console.log('    1. Run: npx tsx scripts/fund-seed-accounts.ts');
  console.log('    2. Source the env: source .env.seed');
  console.log('    3. Start HFT server with seed accounts');
  console.log('=' .repeat(70));
}

main().catch(console.error);
