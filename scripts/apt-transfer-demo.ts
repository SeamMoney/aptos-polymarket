#!/usr/bin/env npx tsx
/**
 * APT Transfer Demo - High TPS demonstration with native APT transfers
 *
 * This script demonstrates Aptos throughput using simple APT transfers
 * between derived accounts. No smart contracts required.
 *
 * Usage:
 *   SEED_MNEMONIC="..." npx tsx scripts/apt-transfer-demo.ts [mode]
 *
 * Modes:
 *   light   - 200 accounts, 4 workers, ~2K TPS target
 *   turbo   - 500 accounts, 4 workers, ~5K TPS target
 *   quantum - 1000 accounts, 8 workers, ~10K TPS target
 *   hyper   - 2000 accounts, 16 workers, ~16K TPS target
 *
 * Environment Variables:
 *   SEED_MNEMONIC     - Required: BIP-39 seed phrase
 *   NETWORK           - mainnet|testnet (default: testnet)
 *   DURATION          - Demo duration in seconds (default: 60)
 *   TRANSFER_AMOUNT   - Amount per transfer in octas (default: 1)
 *   RPC_URL           - Custom RPC endpoint (optional)
 *   VFN_URL           - Internal VFN endpoint (optional)
 *   VERBOSE           - Show individual transfers (default: false)
 *
 * Mainnet Example (~$100-200 budget):
 *   NETWORK=mainnet SEED_MNEMONIC="..." npx tsx scripts/apt-transfer-demo.ts hyper
 */

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Get mode from args
const mode = process.argv[2] || 'turbo';

// Set token type to APT
process.env.TOKEN_TYPE = 'apt';

// Validate mode
const validModes = ['light', 'proven', 'turbo', 'quantum', 'hyper'];
if (!validModes.includes(mode)) {
  console.error(`Invalid mode: ${mode}`);
  console.error(`Valid modes: ${validModes.join(', ')}`);
  process.exit(1);
}

// Check mnemonic
if (!process.env.SEED_MNEMONIC) {
  console.error('ERROR: SEED_MNEMONIC environment variable required');
  console.error('');
  console.error('Usage:');
  console.error('  SEED_MNEMONIC="word1 word2 ..." npx tsx scripts/apt-transfer-demo.ts [mode]');
  console.error('');
  console.error('Modes:');
  console.error('  light   - 200 accounts, ~2K TPS');
  console.error('  proven  - 500 accounts, ~5K TPS (battle-tested AMM config)');
  console.error('  turbo   - 500 accounts, ~5K TPS');
  console.error('  quantum - 1000 accounts, ~10K TPS');
  console.error('  hyper   - 2000 accounts, ~16K TPS');
  process.exit(1);
}

// Run the transfer server
const serverPath = path.resolve(__dirname, '../server/transfer-tps-server.ts');

const child = spawn('npx', ['tsx', serverPath, mode], {
  stdio: 'inherit',
  env: {
    ...process.env,
    TOKEN_TYPE: 'apt',
  },
});

child.on('exit', (code) => {
  process.exit(code || 0);
});

child.on('error', (err) => {
  console.error('Failed to start transfer demo:', err);
  process.exit(1);
});
