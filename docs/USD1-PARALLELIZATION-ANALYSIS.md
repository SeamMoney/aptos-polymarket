# USD1 vs APT: Why Native Fungible Assets Achieve Higher TPS

## Executive Summary

Our prediction market achieves **~3,774 TPS with APT collateral** but can reach **10,000+ TPS with USD1 collateral**. The difference isn't gas costs (both are ~17 gas/txn) — it's **state contention** caused by APT's coin-to-FA pairing infrastructure.

**Key Finding:** APT is a "migrated coin" that accesses global singletons (`coin::PairedCoinType`, `coin::PairedFungibleAssetRefs`) on every transfer. USD1 is a native Fungible Asset that bypasses these entirely.

---

## Background: Aptos Token Standards

### Legacy Coin Standard (`coin::Coin<T>`)

The original Aptos token standard, where:
- Balances stored in `CoinStore<CoinType>` resources per account
- Transfers via `coin::transfer()` and related functions
- Global `CoinInfo<CoinType>` tracks supply and metadata

### Modern Fungible Asset Standard (FA)

The newer, more flexible standard ([AIP-21](https://github.com/aptos-foundation/AIPs/blob/main/aips/aip-21.md)):
- Balances stored in `FungibleStore` objects (one per user per asset)
- Primary store address deterministically derived from user + metadata
- No global state per transfer — only touches sender and recipient stores
- Supports concurrent supply via aggregators

### APT's Dual Compatibility (Migrated Coin)

APT was originally a Coin (`coin::Coin<AptosCoin>`) and later migrated to support the FA standard via [AIP-63](https://github.com/aptos-foundation/AIPs/blob/main/aips/aip-63.md). This migration created a **pairing layer**:

```
APT = coin::Coin<AptosCoin> ←→ Fungible Asset (paired)
```

This backward compatibility is necessary but creates overhead.

---

## The Pairing Problem

### What Happens During an APT Transfer

When your code calls:
```move
primary_fungible_store::withdraw(user, apt_metadata, amount);
```

The framework must:

1. **Verify APT metadata** — Check that `apt_metadata` is valid
2. **Access `CoinConversionMap`** — Global table mapping coin types to FA metadata
3. **Access `PairedCoinType`** — Stored at APT's FA metadata address
4. **Access `PairedFungibleAssetRefs`** — MintRef/TransferRef/BurnRef for the paired FA
5. **Perform the actual transfer** — Update sender and recipient stores

Steps 2-4 touch **global singleton state** that every APT operation must access.

### Global State Dependencies in Coin Module

From [aptos-core/coin.move](https://github.com/aptos-labs/aptos-core/blob/main/aptos-move/framework/aptos-framework/sources/coin.move):

```move
#[resource_group_member(group = aptos_framework::object::ObjectGroup)]
/// The paired coin type info stored in fungible asset metadata object.
struct PairedCoinType has key {
    type: TypeInfo,
}

#[resource_group_member(group = aptos_framework::object::ObjectGroup)]
/// The refs of the paired fungible asset.
struct PairedFungibleAssetRefs has key {
    mint_ref_opt: Option<MintRef>,
    transfer_ref_opt: Option<TransferRef>,
    burn_ref_opt: Option<BurnRef>,
}
```

These resources are stored at APT's metadata address — a single location that **every APT transfer must access**.

### How BlockSTM Handles Conflicts

Aptos uses [Block-STM](https://medium.com/aptoslabs/block-stm-how-we-execute-over-160k-transactions-per-second-on-the-aptos-blockchain-3b003657571) for parallel execution:

1. Transactions execute **optimistically in parallel**
2. Each transaction records its read-set and write-set
3. At commit time, if two transactions accessed the same key (where at least one wrote), **one aborts and re-executes**
4. With 356 transactions all accessing the same keys: **355 abort and retry**

Result: **Effectively sequential execution** despite parallel architecture.

---

## USD1's Design: Zero Global State Access

### Pure Fungible Asset Implementation

USD1 is created directly as a native FA (from [usd1.move](../contracts/sources/usd1.move)):

```move
primary_fungible_store::create_primary_store_enabled_fungible_asset(
    &constructor_ref,
    option::none(), // No max supply
    string::utf8(b"USD1 Stablecoin"),
    string::utf8(b"USD1"),
    8, // decimals
    ...
);
```

**No coin module involvement.** USD1 never:
- Calls `coin::*` functions
- Accesses `CoinConversionMap`
- Accesses `PairedCoinType` or `PairedFungibleAssetRefs`

### Per-User Store Isolation

USD1 transfers only touch:
1. **Sender's PrimaryFungibleStore** — Unique to sender + USD1 metadata
2. **Recipient's PrimaryFungibleStore** — Unique to recipient + USD1 metadata

Different users = different addresses = **no conflicts** = **full parallelization**.

### Transfer Code Path Comparison

**APT Transfer (simplified):**
```
primary_fungible_store::withdraw(user, APT_metadata, amount)
  → fungible_asset::withdraw(...)
    → [Check coin pairing] coin::ensure_paired_metadata<AptosCoin>()
      → READ CoinConversionMap (GLOBAL!)
      → READ PairedCoinType (GLOBAL!)
      → READ PairedFungibleAssetRefs (GLOBAL!)
    → Update sender's FungibleStore
  → Update recipient's FungibleStore
```

**USD1 Transfer (simplified):**
```
primary_fungible_store::withdraw(user, USD1_metadata, amount)
  → fungible_asset::withdraw(...)
    → [No coin pairing check needed]
    → Update sender's FungibleStore
  → Update recipient's FungibleStore
```

---

## Measured Results

### Contention Data from Actual Block

From a peak block (611854263) with 356 transactions:

| Resource | Accesses | Unique Keys | Contention Ratio |
|----------|----------|-------------|------------------|
| `coin::PairedCoinType` | 356 | **1** | **356:1** |
| `coin::PairedFungibleAssetRefs` | 356 | **1** | **356:1** |
| `MultiMarket` | 356 | 1 | 356:1 |
| `fungible_asset::ConcurrentSupply` | 912 | 7 | 130:1 |

The first two rows show **every transaction hitting the same global keys**.

### TPS Comparison

| Collateral | Peak TPS | Validator Backpressure | Bottleneck |
|------------|----------|------------------------|------------|
| APT | 3,774 | 100% (saturated) | Global state contention |
| USD1 | 10,000+ | ~40-60% | Multi-market serialization |

With USD1, the remaining bottleneck is our `MultiMarket` resource, not the collateral token.

### Grafana Evidence

When using APT collateral, Grafana shows:
- `execution_backpressure_on_proposal: 1.0` (100%)
- Validators at max execution capacity
- Not due to gas — due to state conflicts

---

## Technical Deep Dive

### State Access Patterns

| Operation | APT | USD1 |
|-----------|-----|------|
| Look up token metadata | Via `CoinConversionMap` (global) | Direct object lookup |
| Verify token type | Via `PairedCoinType` (global) | Type already known |
| Access capabilities | Via `PairedFungibleAssetRefs` (global) | Stored at USD1 metadata (isolated) |
| Update sender balance | Sender's `PrimaryFungibleStore` | Same |
| Update recipient balance | Recipient's `PrimaryFungibleStore` | Same |

The first 3 rows are the difference. APT touches 3 global singletons; USD1 touches none.

### Why APT Can't Avoid This

APT's pairing exists for **backward compatibility**:
- Legacy code expects `coin::Coin<AptosCoin>`
- New code expects FA-style `PrimaryFungibleStore`
- The pairing layer bridges both

This is intentional design, not a bug. But it has parallelization costs.

### Our USD1 Contract Structure

```move
// Minimal global state
struct TokenRegistry has key {
    metadata_address: address,  // Read-only after init
}

struct TokenRefs has key {
    mint_ref: MintRef,      // Read-only
    burn_ref: BurnRef,      // Read-only
    transfer_ref: TransferRef, // Read-only
    extend_ref: ExtendRef,  // Read-only
}
```

Both structures are **read-only after initialization** — no write contention.

---

## Implications for High-TPS Applications

### When to Use Native FA vs Migrated Coins

| Use Case | Recommendation |
|----------|----------------|
| High-TPS trading/gaming | Native FA (like USD1) |
| Interop with existing APT code | APT (accept lower TPS) |
| New token launches | Native FA |
| Stablecoin integration | Native FA version if available |

### Design Recommendations

1. **Avoid migrated coins for hot paths** — If you need 1000+ TPS, use native FAs
2. **Create FA wrappers** — Let users wrap APT into a native FA for trading
3. **Use aggregators** — For any counter/reserve that multiple txns update
4. **Isolate per-user state** — Each user's data in separate objects

---

## Questions for Aptos Team

We'd like to understand if there are ways to optimize APT operations:

1. **Is the pairing lookup cacheable?** Could `coin::PairedCoinType` be read once per block instead of per-transaction?

2. **Are these reads or writes?** In BlockSTM, even reads can cause conflicts if the key is in another transaction's write-set. Are these purely read accesses?

3. **Could APT use a "fast path"?** Since APT's pairing is immutable, could the framework skip the lookup for known pairings?

4. **Is there a way to opt out?** For applications that only use APT as FA (never as Coin), could we bypass the pairing check?

5. **What's the roadmap?** Is there planned work to reduce pairing overhead for high-TPS applications?

---

## References

- [AIP-21: Fungible Asset Standard](https://github.com/aptos-foundation/AIPs/blob/main/aips/aip-21.md)
- [AIP-63: Coin to FA Migration](https://github.com/aptos-foundation/AIPs/blob/main/aips/aip-63.md)
- [Aptos coin.move source](https://github.com/aptos-labs/aptos-core/blob/main/aptos-move/framework/aptos-framework/sources/coin.move)
- [Block-STM: Parallel Execution](https://medium.com/aptoslabs/block-stm-how-we-execute-over-160k-transactions-per-second-on-the-aptos-blockchain-3b003657571)
- [Coin to FA Migration Announcement](https://medium.com/aptoslabs/live-on-aptos-mainnet-coin-to-fungible-asset-migration-58eacaeaf7f7)
- [Aptos FA Standard Documentation](https://aptos.dev/build/smart-contracts/fungible-asset)

---

## Appendix: USD1 Contract

Our testnet USD1 stablecoin is deployed at:
- **Contract:** `0xbdea15f5b0f5449ae8f3a6ae95a5e090bdeeec91be1fcac8375b2f5f37f1c134`
- **USD1 Metadata:** `0x4e977d5ee91d77d680972a44b38b9c7a2c5694439169eeae060a48324e5c4597`

Key features:
- 8 decimals (APT-compatible)
- Open minting for demo purposes
- No coin module dependencies
- Uses `ConcurrentSupply` for parallel minting

Full source: [contracts/sources/usd1.move](../contracts/sources/usd1.move)
