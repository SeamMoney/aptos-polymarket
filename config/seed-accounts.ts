/**
 * Seed-based Account Derivation
 *
 * Generates deterministic Aptos accounts from a BIP-39 seed phrase.
 * Uses Aptos SDK's built-in derivation (coin type 637).
 *
 * Usage:
 *   SEED_MNEMONIC="word1 word2 ..." npx tsx scripts/generate-seed-accounts.ts
 */

import * as bip39 from 'bip39';
import {
  Account,
  Ed25519PrivateKey,
  deriveKey,
  mnemonicToSeed,
  isValidBIP44Path,
} from '@aptos-labs/ts-sdk';

// Aptos uses coin type 637 in BIP-44 path
const APTOS_COIN_TYPE = 637;

// Cache mnemonic seed to avoid expensive PBKDF2 on every derivation
// mnemonicToSeed() does 2048 rounds of HMAC-SHA512, taking ~100-200ms per call
// With 357 accounts per worker, caching saves ~71 seconds startup time
let cachedSeed: Uint8Array | null = null;
let cachedMnemonic: string | null = null;

function getCachedSeed(mnemonic: string): Uint8Array {
  if (cachedMnemonic === mnemonic && cachedSeed) {
    return cachedSeed;
  }
  console.log('[SEED] Computing mnemonic seed (one-time operation)...');
  const startTime = Date.now();
  cachedSeed = mnemonicToSeed(mnemonic);
  cachedMnemonic = mnemonic;
  console.log(`[SEED] Seed computed in ${Date.now() - startTime}ms`);
  return cachedSeed;
}

/**
 * Generate a new BIP-39 mnemonic (24 words)
 */
export function generateMnemonic(): string {
  return bip39.generateMnemonic(256); // 256 bits = 24 words
}

/**
 * Validate a BIP-39 mnemonic
 */
export function validateMnemonic(mnemonic: string): boolean {
  return bip39.validateMnemonic(mnemonic);
}

/**
 * Derive a single account from a mnemonic at a specific index
 * Path: m/44'/637'/0'/0/index (Aptos SDK format - non-hardened last two components)
 */
export function deriveAccount(mnemonic: string, index: number): Account {
  // Aptos SDK requires non-hardened derivation for account and address index
  const path = `m/44'/${APTOS_COIN_TYPE}'/0'/0/${index}`;

  if (!isValidBIP44Path(path)) {
    throw new Error(`Invalid BIP-44 path: ${path}`);
  }

  // Use cached seed (avoids ~200ms PBKDF2 per call)
  const seed = getCachedSeed(mnemonic);

  // Derive key at path
  const { key } = deriveKey(path, seed);

  // Create Ed25519 private key
  const privateKey = new Ed25519PrivateKey(key);

  // Create account from private key
  return Account.fromPrivateKey({ privateKey });
}

/**
 * Derive multiple accounts from a mnemonic
 */
export function deriveAccounts(mnemonic: string, count: number): Account[] {
  if (!validateMnemonic(mnemonic)) {
    throw new Error('Invalid mnemonic phrase');
  }

  const accounts: Account[] = [];
  for (let i = 0; i < count; i++) {
    accounts.push(deriveAccount(mnemonic, i));
  }
  return accounts;
}

/**
 * Get private key hex string for an account at index
 * Useful for loading into existing scripts that expect hex keys
 */
export function getPrivateKeyHex(mnemonic: string, index: number): string {
  const account = deriveAccount(mnemonic, index);
  // Get the private key bytes and convert to hex
  const privateKeyBytes = account.privateKey.toUint8Array();
  return '0x' + Buffer.from(privateKeyBytes).toString('hex');
}

/**
 * Get all private keys as comma-separated hex string
 * Compatible with ULTRA_PRIVATE_KEYS env var format
 */
export function getPrivateKeysAsEnvString(mnemonic: string, count: number): string {
  const keys: string[] = [];
  for (let i = 0; i < count; i++) {
    keys.push(getPrivateKeyHex(mnemonic, i));
  }
  return keys.join(',');
}

/**
 * Derive account info (address only) without creating full Account object
 * More efficient for bulk address generation
 */
export function deriveAccountInfo(mnemonic: string, index: number): {
  index: number;
  address: string;
} {
  const account = deriveAccount(mnemonic, index);
  return {
    index,
    address: account.accountAddress.toString(),
  };
}

/**
 * Get account addresses for a range of indices
 */
export function getAccountAddresses(mnemonic: string, startIndex: number, count: number): string[] {
  const addresses: string[] = [];
  for (let i = startIndex; i < startIndex + count; i++) {
    const account = deriveAccount(mnemonic, i);
    addresses.push(account.accountAddress.toString());
  }
  return addresses;
}

// Export constants
export const DERIVATION_PATH_PREFIX = `m/44'/${APTOS_COIN_TYPE}'/0'/0`;
export { APTOS_COIN_TYPE };
