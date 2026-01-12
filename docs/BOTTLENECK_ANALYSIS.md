# Bottleneck Analysis: Why Our Contract Causes Validator Backpressure

## Executive Summary

Our prediction market contract achieves **3,774 TPS peak** but causes **100% execution backpressure** on validators because of **state contention**, not gas costs.

**Key finding:** In a 356-txn block, we make ~7,600 state writes, but ~2,500 of those hit just 3 hot keys, forcing sequential execution.

---

## The Data

### Jan 6, 2026 Peak Block (611854263)

| Metric | Value |
|--------|-------|
| Our transactions | 356 |
| Total state writes | 7,608 |
| Gas per transaction | 17 (very low!) |
| Unique state keys written | ~100 |
| Hot keys (356:1 contention) | 3 |

### State Contention Analysis

| Resource | Writes | Unique Keys | Contention Ratio | Problem |
|----------|--------|-------------|------------------|---------|
| `coin::PairedCoinType` | 356 | 1 | **356:1** | APT transfer |
| `coin::PairedFungibleAssetRefs` | 356 | 1 | **356:1** | APT transfer |
| `MultiMarket` | 356 | 1 | **356:1** | Our contract |
| `fungible_asset::ConcurrentSupply` | 912 | 7 | 130:1 | Token minting |
| `fungible_asset::Metadata` | 912 | 7 | 130:1 | Token minting |

---

## Why This Causes Backpressure

### How Aptos BlockSTM Works

1. Transactions execute **in parallel** optimistically
2. At commit, if two txns wrote the same key, one **aborts and re-executes**
3. With 356:1 contention, effectively **355 transactions abort and retry**

### The Execution Backpressure

When Grafana shows `execution backpressure on proposal: 1.0`:
- Validators are at 100% execution capacity
- They can't execute transactions fast enough
- This is caused by serialization, not raw compute

---

## Root Causes in Our Contract

### 1. APT Coin Global State (Unavoidable with APT)

```move
// Every buy_outcome does this:
let payment = primary_fungible_store::withdraw(buyer, apt_metadata, collateral_in);
fungible_asset::deposit(market.collateral_store, payment);
```

**Problem:** APT coin metadata (`coin::PairedCoinType`) is a global singleton. Every APT transfer writes to it.

**Impact:** All 356 txns serialize on this single key.

### 2. MultiMarket Resource Lock

```move
let market = borrow_global_mut<MultiMarket>(market_addr);  // Exclusive lock!
```

**Problem:** Even though we use `aggregator_v2` for reserves (parallel-safe), the `borrow_global_mut` puts the entire resource in the write set.

**Impact:** All 356 txns serialize on MultiMarket.

### 3. Outcome Token Minting

```move
let tokens = fungible_asset::mint(&outcome.mint_ref, tokens_out);
primary_fungible_store::deposit(buyer_addr, tokens);
```

**Problem:** Minting updates `ConcurrentSupply` and `Metadata` for each outcome token (7 outcomes = 7 keys, but each gets ~50 writes).

---

## What We're Doing Right

1. **Using `aggregator_v2`** for reserves - enables parallel add/sub operations
2. **Low gas usage** - 17 gas per transaction is excellent
3. **Clean event emission** - not causing contention

---

## Potential Optimizations

### Option 1: Use a Different Collateral Token

Instead of APT, use a custom fungible asset with sharded stores.

**Tradeoff:** Users need to wrap APT first.

### Option 2: Object-Based Outcomes (Recommended)

Convert outcomes from a vector to separate objects:

```move
// Current (vector - requires &mut on whole vector):
let outcome = vector::borrow_mut(&mut market.outcomes, outcome_index);

// Better (separate objects - parallel access):
let outcome = borrow_global_mut<Outcome>(outcome_addresses[outcome_index]);
```

**Benefit:** Different outcomes can execute in parallel.

### Option 3: Batch Multiple Trades Per Transaction

Instead of 1 trade per txn, batch 10 trades:

```move
public entry fun batch_buy_outcomes(
    buyer: &signer,
    market_addr: address,
    outcome_indices: vector<u64>,
    amounts: vector<u64>,
) { ... }
```

**Benefit:** 10x fewer transactions = 10x less contention.

### Option 4: Use `borrow_global` Where Possible

For fields that are only read (not aggregator-mutated), use immutable borrow:

```move
// For read-only access to check resolved, fee_bps, etc.
let market = borrow_global<MultiMarket>(market_addr);
```

**Caveat:** Still need `borrow_global_mut` for aggregator operations.

---

## Comparison to Other High-TPS Contracts

| Contract | Avg Gas | State Changes | Contention | TPS |
|----------|---------|---------------|------------|-----|
| **Our market** | 17 | 21 | High (356:1) | 3,774 |
| Simple transfer | 8 | 4 | Low | 10,000+ |
| DEX swap | 25 | 15 | Medium | 5,000+ |

Our contract has low gas but high contention, which limits throughput more than gas would.

---

## Recommendations for Aptos Team

If discussing with Aptos:

1. **Ask about `borrow_global_mut` serialization** - Does it force write-set inclusion even for aggregator-only mutations?

2. **APT coin contention** - Is there a way to avoid `coin::PairedCoinType` writes for deposits/withdrawals?

3. **Object sharding** - Would using object-based outcomes help parallelism?

4. **ConcurrentSupply** - Is fungible asset minting parallel-safe, or does it serialize?

---

## Metrics to Track

After any optimization, run:

```bash
npx tsx scripts/analyze-tps.ts --minutes 5
```

Look for:
- **Lower contention ratio** (target: <10:1 for hot keys)
- **Higher avg TPS** (target: closer to peak TPS)
- **Same or lower gas/txn** (should stay ~17)
