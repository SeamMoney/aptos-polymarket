# Contract Deployment Guide

This guide documents the process for deploying a new version of the prediction market contract and migrating infrastructure to use it.

**Last Updated:** January 15, 2026
**Current Contract:** `0xca4d40eae9f07fb28a121862d649203fb4335ece9536ee51790e19f812ff7aea`

---

## Overview

When deploying a new contract, these components need updates:
1. Contract compilation and deployment
2. USD1 initialization
3. Market creation
4. Config updates (`config/wallets.ts`, `.env.local`)
5. Re-fund 500 seed accounts with new USD1
6. Update HFT servers

---

## Step 1: Compile the Contract

```bash
cd contracts

# Clean previous build
rm -rf build/

# Compile (use testnet profile)
aptos move compile --named-addresses prediction_market=0xYOUR_NEW_ADDRESS
```

**Package Size Check:** If the package exceeds 60KB, you may need to:
- Remove variant modules to `sources_backup/`
- Use chunked publish (if available)

---

## Step 2: Deploy the Contract

### Option A: Fresh Deployment (New Address)

Use this when struct changes are incompatible with upgrades.

```bash
# Generate a new account
aptos init --network testnet

# Fund the account with APT (need ~10 APT for deployment + gas)

# Deploy using object deployment
aptos move deploy-object \
  --address-name prediction_market \
  --named-addresses prediction_market=default
```

The contract address will be the **same as the deployer address** with object deployment.

### Option B: Upgrade Existing Contract

Only works if no struct changes occurred:

```bash
aptos move upgrade-object \
  --object-address 0xEXISTING_CONTRACT \
  --named-addresses prediction_market=0xEXISTING_CONTRACT
```

**Note:** Struct changes (adding/removing fields) require fresh deployment.

---

## Step 3: Initialize USD1

After deployment, initialize the USD1 stablecoin:

```bash
aptos move run \
  --function-id 0xNEW_CONTRACT::usd1::initialize \
  --profile default
```

Get the USD1 metadata address:

```bash
aptos move view \
  --function-id 0xNEW_CONTRACT::usd1::get_metadata \
  --profile default
```

Save this metadata address - it's needed for `.env.local`.

---

## Step 4: Create Test Market

```typescript
// scripts/create-market-new-contract.ts
const tx = await aptos.transaction.build.simple({
  sender: deployer.accountAddress,
  data: {
    function: `${CONTRACT}::multi_outcome_market::create_multi_market_with_collateral`,
    functionArguments: [
      "Market Title",
      "Description",
      "Category",
      ["Yes", "No"],  // outcomes
      endTime,        // Unix timestamp
      initialLiquidity * 1e8,  // 8 decimals
      usd1Metadata,
    ],
  },
});
```

---

## Step 5: Update Configuration Files

### 5.1: Update `config/wallets.ts`

```typescript
export const CONTRACTS = {
  // NEW contract address
  address: "0xNEW_CONTRACT_ADDRESS",

  // NEW USD1 metadata
  usd1Metadata: "0xNEW_USD1_METADATA",

  // Deployer key (can mint USD1)
  deployerKey: "0xDEPLOYER_PRIVATE_KEY",

  // Markets on new contract
  markets: [
    "0xMARKET_1",
    "0xMARKET_2",
    // ...
  ],

  // Move old contract to legacy section
  legacyPrevious: {
    address: "0xOLD_CONTRACT",
    // ...
  },
};
```

### 5.2: Update `.env.local`

```bash
# New contract
VITE_CONTRACT_ADDRESS=0xNEW_CONTRACT_ADDRESS

# New USD1 metadata
VITE_USD1_METADATA=0xNEW_USD1_METADATA

# New markets (comma-separated)
VITE_MULTI_MARKETS=0xMARKET_1,0xMARKET_2
```

### 5.3: Update `contracts/Move.toml`

```toml
[dev-addresses]
prediction_market = "0xNEW_CONTRACT_ADDRESS"
```

---

## Step 6: Fund 500 Seed Accounts

The seed accounts have APT but need the NEW contract's USD1.

```bash
# Verify mnemonic is set
source .env.seed

# Fund USD1 only (accounts already have APT)
SEED_MNEMONIC="..." npx tsx scripts/fund-seed-accounts.ts --usd1-only

# Or fund specific count
SEED_MNEMONIC="..." npx tsx scripts/fund-seed-accounts.ts --usd1-only --count 100
```

**Expected time:** ~3-4 minutes for 500 accounts (sequential minting)

**Verify funding:**
```bash
npx tsx -e "
const { deriveAccount } = require('./config/seed-accounts');
const { Aptos, AptosConfig, Network } = require('@aptos-labs/ts-sdk');

const aptos = new Aptos(new AptosConfig({ network: Network.TESTNET }));
const USD1 = '0xNEW_USD1_METADATA';
const mnemonic = 'your mnemonic here';

async function check() {
  for (let i = 0; i < 5; i++) {
    const account = deriveAccount(mnemonic, i);
    const res = await aptos.getCurrentFungibleAssetBalances({
      options: { where: { owner_address: { _eq: account.accountAddress.toString() }, asset_type: { _eq: USD1 } } }
    });
    console.log('Account', i, (res[0]?.amount || 0) / 1e8, 'USD1');
  }
}
check();
"
```

---

## Step 7: Update HFT Servers

### 7.1: Update Environment Variables

On each worker server:

```bash
export CONTRACT_ADDRESS=0xNEW_CONTRACT
export MULTI_MARKETS=0xMARKET_1,0xMARKET_2
```

### 7.2: Restart HFT Server

```bash
# Stop existing
pkill -f hft-piscina-server

# Start with new contract
source .env.seed
npx tsx server/hft-piscina-server.ts quantum
```

---

## Verification Checklist

- [ ] Contract deployed and verified on explorer
- [ ] USD1 initialized (`usd1::get_metadata` returns valid address)
- [ ] At least 1 market created
- [ ] `config/wallets.ts` updated with new addresses
- [ ] `.env.local` updated
- [ ] `contracts/Move.toml` dev-addresses updated
- [ ] 500 seed accounts funded with new USD1
- [ ] Frontend shows new markets
- [ ] HFT server connects to new contract

---

## Common Issues

### Issue: Package Too Large (>60KB)

**Solution:** Move variant modules to backup folder:
```bash
mv contracts/sources/variants contracts/sources_backup/
```

### Issue: Struct Upgrade Incompatible

**Solution:** Must deploy to fresh address. Use `aptos move deploy-object`.

### Issue: USD1 Balance Check Fails

The `usd1::balance` function may not work for accounts without a store. Use `getCurrentFungibleAssetBalances` instead:
```typescript
const res = await aptos.getCurrentFungibleAssetBalances({
  options: { where: { owner_address: { _eq: addr }, asset_type: { _eq: USD1_METADATA } } }
});
```

### Issue: SEQUENCE_NUMBER_TOO_OLD

Sequential minting can cause sequence number drift. The funding script handles this with small delays.

---

## File Reference

| File | Purpose | Update Required |
|------|---------|-----------------|
| `config/wallets.ts` | Contract addresses, deployer keys | Yes |
| `.env.local` | Frontend environment | Yes |
| `contracts/Move.toml` | Build configuration | Yes |
| `scripts/fund-seed-accounts.ts` | Funds trading accounts | No (uses config) |
| `server/hft-piscina-server.ts` | HFT trading server | No (uses env vars) |
| `server/hft-ultra-server.ts` | Single-thread HFT | No (uses env vars) |

---

## Deployment History

| Date | Contract | Reason |
|------|----------|--------|
| Jan 14, 2026 | `0xca4d40eae9f07fb28a...` | AMM fix: per-outcome base_reserve |
| Jan 11, 2026 | `0xbdea15f5b0f5449ae8...` | USD1 v2 with admin drainers |
| Earlier | `0xa2e5e47aab07fed78a...` | APT-based v3 (TVL locked) |
| Earlier | `0x64a81cb9cbd14d45b8...` | APT-based v1 (TVL locked) |
