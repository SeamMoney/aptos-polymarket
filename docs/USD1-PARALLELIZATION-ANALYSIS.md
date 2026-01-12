# USD1 vs APT: Parallelization Analysis (Revised)

## Status: Hypothesis Under Investigation

**Original hypothesis:** Native Fungible Assets (like USD1) achieve higher TPS than APT because they avoid coin-to-FA pairing overhead.

**Current finding:** Transaction data shows **both APT and USD1 transactions write to the same global resources at `0xa`**. The original hypothesis needs revision.

---

## What We Verified (January 2026)

### Transaction Analysis

We analyzed actual on-chain transactions from our prediction market contracts:

| Transaction Type | Contract | Hash |
|------------------|----------|------|
| APT sell_outcome | `0xa2e5...` (old) | `0x9bce0eee...` |
| USD1 mint | `0xbdea1...` (new) | `0x1b814...` |
| Simple APT transfer | N/A | `0xb6e50fda...` |

### Key Finding: All Transactions Write to `0xa`

**Both APT-collateral and USD1 transactions show `write_resource` for these at address `0xa`:**

```
0x1::coin::PairedCoinType
0x1::coin::PairedFungibleAssetRefs
0x1::fungible_asset::ConcurrentSupply
0x1::fungible_asset::Metadata
0x1::object::ObjectCore
0x1::primary_fungible_store::DeriveRefPod
```

This happens because **all Aptos transactions pay gas in APT**, which triggers the coin-FA pairing layer.

### State Changes Comparison

| Metric | APT sell_outcome | USD1 mint | Simple APT transfer |
|--------|------------------|-----------|---------------------|
| Total state changes | 18 | 15 | 12 |
| Unique addresses touched | 7 | 5 | 5 |
| Writes at `0xa` | 6 | 6 | 6 |
| Gas used | 16 | 544 | 16 |

**Observation:** The number of writes at `0xa` is identical across all transaction types.

---

## Previous Claims (Now Questioned)

### Block 611854263 Data Issue

The BOTTLENECK_ANALYSIS.md referenced block 611854263 with "356 of our transactions".

**When we queried this block, it contained 377 transactions from a different DEX contract** (`0x9f830083...`), not our prediction market.

The claimed contention ratios (356:1 for `coin::PairedCoinType`) cannot be verified from this data.

### "USD1 Bypasses Coin Module" Claim

The original claim stated:
> USD1 never accesses `CoinConversionMap`, `PairedCoinType`, or `PairedFungibleAssetRefs`

**This is incorrect.** Even USD1 transactions show writes to these resources because:
1. Gas is paid in APT
2. APT gas payment goes through the coin-FA pairing layer
3. The pairing resources are written regardless of collateral type

---

## What We Still Don't Know

### Open Questions

1. **Are these true writes or read-tracking?**
   - The Aptos API returns `write_resource` in the changes array
   - In BlockSTM, only write-write conflicts cause serialization
   - We need to understand if these are actual mutations or read-set tracking

2. **Is `ConcurrentSupply` truly parallel-safe?**
   - Uses aggregator pattern for parallel add/sub
   - The metadata address `0xa` is shared, but values might use distributed aggregators

3. **What causes actual TPS differences?**
   - If USD1 does achieve higher TPS, it may be due to:
     - Fewer collateral store writes (not at `0xa`)
     - Different code paths
     - Reduced total state changes (15 vs 18)
   - This needs to be tested empirically

### Tests Needed

To properly compare APT vs USD1 parallelization:

1. **Run identical workloads** with both collateral types
2. **Measure actual TPS** over 60+ seconds
3. **Query transaction versions** to determine actual block distribution
4. **Analyze validator metrics** (if available) for backpressure data

---

## Background: Aptos Token Standards

### Legacy Coin Standard (`coin::Coin<T>`)

The original Aptos token standard:
- Balances stored in `CoinStore<CoinType>` resources per account
- Transfers via `coin::transfer()` and related functions
- Global `CoinInfo<CoinType>` tracks supply and metadata

### Modern Fungible Asset Standard (FA)

The newer standard ([AIP-21](https://github.com/aptos-foundation/AIPs/blob/main/aips/aip-21.md)):
- Balances stored in `FungibleStore` objects (one per user per asset)
- Primary store address deterministically derived from user + metadata
- Supports concurrent supply via aggregators

### APT's Dual Compatibility (Migrated Coin)

APT supports both standards via [AIP-63](https://github.com/aptos-foundation/AIPs/blob/main/aips/aip-63.md):

```
APT = coin::Coin<AptosCoin> <--> Fungible Asset (paired)
```

This pairing creates the resources at `0xa` that all transactions access.

---

## Theoretical Parallelization Benefit

### Where USD1 Might Help (Hypothesis)

Even though both transaction types write to `0xa`, USD1 as collateral might reduce contention in other ways:

1. **Collateral store isolation**: User's USD1 stores and market collateral stores are at unique addresses, not `0xa`

2. **Fewer total state changes**: USD1 transactions had 15 changes vs 18 for APT

3. **Different contention patterns**: The collateral transfer doesn't add to `0xa` contention beyond gas payment

### FungibleStore Write Locations (Verified)

APT sell_outcome FungibleStore writes:
- `0x33a3a5...` (user's APT store)
- `0x91307e...` (outcome token store)
- `0xcc1fa7...` (market collateral store)

USD1 mint FungibleStore writes:
- `0x8395bf...` (destination USD1 store)
- `0x8b3b45...` (another store)

**None at `0xa`** - FungibleStores are per-user, not global.

---

## Recommendations for Aptos Engineers

### Questions to Investigate

1. **Write semantics at `0xa`**: Does `write_resource` in transaction output mean actual mutation, or does it include read-set tracking?

2. **Aggregator behavior**: Are `ConcurrentSupply` updates truly parallel via aggregators, or do they serialize?

3. **Gas payment overhead**: Is there a way to reduce the state changes at `0xa` for high-TPS applications?

4. **Read-only access**: Can `coin::PairedCoinType` be accessed without triggering a write-set entry?

### Suggested Analysis

To determine if USD1 provides parallelization benefits:

```bash
# 1. Deploy identical markets with APT and USD1 collateral
# 2. Run HFT demo with APT collateral
./scripts/run-3-workers.sh quantum 60  # with APT
npx tsx scripts/deep-tps-analysis.ts

# 3. Run HFT demo with USD1 collateral
./scripts/run-3-workers.sh quantum 60  # with USD1
npx tsx scripts/deep-tps-analysis.ts

# 4. Compare results
```

---

## Contract References

### USD1 Contract (Current)
- **Address:** `0xbdea15f5b0f5449ae8f3a6ae95a5e090bdeeec91be1fcac8375b2f5f37f1c134`
- **USD1 Metadata:** `0x4e977d5ee91d77d680972a44b38b9c7a2c5694439169eeae060a48324e5c4597`

### Old APT-Based Contract
- **Address:** `0xa2e5e47aab07fed78a3bcf95135ee2dad20c547499c94cb16a3e047859ffa7e1`

### Source Code
- [contracts/sources/usd1.move](../contracts/sources/usd1.move) - USD1 stablecoin
- [contracts/sources/multi_outcome_market.move](../contracts/sources/multi_outcome_market.move) - Prediction market

---

## References

- [AIP-21: Fungible Asset Standard](https://github.com/aptos-foundation/AIPs/blob/main/aips/aip-21.md)
- [AIP-63: Coin to FA Migration](https://github.com/aptos-foundation/AIPs/blob/main/aips/aip-63.md)
- [Block-STM: Parallel Execution](https://medium.com/aptoslabs/block-stm-how-we-execute-over-160k-transactions-per-second-on-the-aptos-blockchain-3b003657571)
- [Aptos coin.move source](https://github.com/aptos-labs/aptos-core/blob/main/aptos-move/framework/aptos-framework/sources/coin.move)
