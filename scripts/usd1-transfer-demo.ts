#!/usr/bin/env npx tsx
/**
 * USD1 Transfer Demo - High TPS demonstration with Fungible Asset transfers
 *
 * This script demonstrates Aptos throughput using USD1 FA transfers
 * between derived accounts. Requires USD1 to be deployed and funded.
 *
 * Usage:
 *   SEED_MNEMONIC="..." USD1_METADATA="0x..." npx tsx scripts/usd1-transfer-demo.ts [mode]
 *
 * Modes:
 *   light   - 200 accounts, 4 workers, ~2K TPS target
 *   turbo   - 500 accounts, 4 workers, ~5K TPS target
 *   quantum - 1000 accounts, 8 workers, ~10K TPS target
 *   hyper   - 2000 accounts, 16 workers, ~16K TPS target
 *
 * Environment Variables:
 *   SEED_MNEMONIC     - Required: BIP-39 seed phrase
 *   USD1_METADATA     - Required: USD1 token metadata address
 *   NETWORK           - mainnet|testnet (default: testnet)
 *   DURATION          - Demo duration in seconds (default: 60)
 *   TRANSFER_AMOUNT   - Amount per transfer in smallest unit (default: 1)
 *   RPC_URL           - Custom RPC endpoint (optional)
 *   VFN_URL           - Internal VFN endpoint (optional)
 *   VERBOSE           - Show individual transfers (default: false)
 *
 * Mainnet Example (~$200 budget):
 *   NETWORK=mainnet SEED_MNEMONIC="..." USD1_METADATA="0x..." \
 *     npx tsx scripts/usd1-transfer-demo.ts hyper
 *
 * Note: You must first fund sender accounts with USD1 using fund-usd1-demo.ts
 */

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Get mode from args
const mode = process.argv[2] || 'turbo';

// Set token type to USD1
process.env.TOKEN_TYPE = 'usd1';

// Validate mode
const validModes = ['reliable', 'light', 'proven', 'turbo', 'quantum', 'hyper'];
if (!validModes.includes(mode)) {
  console.error(`Invalid mode: ${mode}`);
  console.error(`Valid modes: ${validModes.join(', ')}`);
  process.exit(1);
}

// Check required env vars
if (!process.env.SEED_MNEMONIC) {
  console.error('ERROR: SEED_MNEMONIC environment variable required');
  console.error('');
  console.error('Usage:');
  console.error('  SEED_MNEMONIC="..." USD1_METADATA="0x..." npx tsx scripts/usd1-transfer-demo.ts [mode]');
  process.exit(1);
}

if (!process.env.USD1_METADATA) {
  console.error('ERROR: USD1_METADATA environment variable required');
  console.error('');
  console.error('Get the USD1 metadata address from your deployment or use:');
  console.error('  Testnet: Check VITE_USD1_METADATA in .env.local');
  console.error('  Mainnet: Deploy USD1 or use an existing FA token');
  process.exit(1);
}

// Run the transfer server
const serverPath = path.resolve(__dirname, '../server/transfer-tps-server.ts');

const child = spawn('npx', ['tsx', serverPath, mode], {
  stdio: 'inherit',
  env: {
    ...process.env,
    TOKEN_TYPE: 'usd1',
  },
});

child.on('exit', (code) => {
  process.exit(code || 0);
});

child.on('error', (err) => {
  console.error('Failed to start transfer demo:', err);
  process.exit(1);
});
