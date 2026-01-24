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
import { Account, Ed25519PrivateKey, deriveKey, mnemonicToSeed, isValidBIP44Path, } from '@aptos-labs/ts-sdk';
// Aptos uses coin type 637 in BIP-44 path
const APTOS_COIN_TYPE = 637;
/**
 * Generate a new BIP-39 mnemonic (24 words)
 */
export function generateMnemonic() {
    return bip39.generateMnemonic(256); // 256 bits = 24 words
}
/**
 * Validate a BIP-39 mnemonic
 */
export function validateMnemonic(mnemonic) {
    return bip39.validateMnemonic(mnemonic);
}
/**
 * Derive a single account from a mnemonic at a specific index
 * Path: m/44'/637'/0'/0/index (Aptos SDK format - non-hardened last two components)
 */
export function deriveAccount(mnemonic, index) {
    // Aptos SDK requires non-hardened derivation for account and address index
    const path = `m/44'/${APTOS_COIN_TYPE}'/0'/0/${index}`;
    if (!isValidBIP44Path(path)) {
        throw new Error(`Invalid BIP-44 path: ${path}`);
    }
    // Convert mnemonic to seed
    const seed = mnemonicToSeed(mnemonic);
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
export function deriveAccounts(mnemonic, count) {
    if (!validateMnemonic(mnemonic)) {
        throw new Error('Invalid mnemonic phrase');
    }
    const accounts = [];
    for (let i = 0; i < count; i++) {
        accounts.push(deriveAccount(mnemonic, i));
    }
    return accounts;
}
/**
 * Get private key hex string for an account at index
 * Useful for loading into existing scripts that expect hex keys
 */
export function getPrivateKeyHex(mnemonic, index) {
    const account = deriveAccount(mnemonic, index);
    // Get the private key bytes and convert to hex
    const privateKeyBytes = account.privateKey.toUint8Array();
    return '0x' + Buffer.from(privateKeyBytes).toString('hex');
}
/**
 * Get all private keys as comma-separated hex string
 * Compatible with ULTRA_PRIVATE_KEYS env var format
 */
export function getPrivateKeysAsEnvString(mnemonic, count) {
    const keys = [];
    for (let i = 0; i < count; i++) {
        keys.push(getPrivateKeyHex(mnemonic, i));
    }
    return keys.join(',');
}
/**
 * Derive account info (address only) without creating full Account object
 * More efficient for bulk address generation
 */
export function deriveAccountInfo(mnemonic, index) {
    const account = deriveAccount(mnemonic, index);
    return {
        index,
        address: account.accountAddress.toString(),
    };
}
/**
 * Get account addresses for a range of indices
 */
export function getAccountAddresses(mnemonic, startIndex, count) {
    const addresses = [];
    for (let i = startIndex; i < startIndex + count; i++) {
        const account = deriveAccount(mnemonic, i);
        addresses.push(account.accountAddress.toString());
    }
    return addresses;
}
// Export constants
export const DERIVATION_PATH_PREFIX = `m/44'/${APTOS_COIN_TYPE}'/0'/0`;
export { APTOS_COIN_TYPE };
