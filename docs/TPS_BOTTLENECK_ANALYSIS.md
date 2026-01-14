# TPS Bottleneck Analysis

**Date:** January 13, 2026
**Analyzed Blocks:** 619,967,192 (304 txns), 619,953,007 (279 txns), 619,963,849 (216 txns)

## Key Findings

### Bottleneck #1: Sender Concentration (CRITICAL)

| Block | Transactions | Unique Senders | Sender Ratio |
|-------|-------------|----------------|--------------|
| 619,967,192 | 304 | **5** | 1.6% |
| 619,963,849 | 216 | **22** | 10.2% |
| 619,953,007 | 279 | **45** | 16.1% |

**Problem:** Only 5 accounts sending transactions means sequence numbers queue up.

**Why this matters:**
- Aptos requires sequential execution per account (sequence numbers)
- With 5 accounts, maximum parallelism = 5 concurrent transactions
- Even with 10 markets, transactions from same account serialize

**Solution:** Use 50-100+ funded accounts for benchmarks

### Bottleneck #2: Failed Transactions (15-20% waste)

| Block | Total | Failed | Error |
|-------|-------|--------|-------|
| 619,967,192 | 304 | 47 (15%) | E_INVALID_OUTCOME |
| 619,963,849 | 216 | 40 (19%) | E_INVALID_OUTCOME |

**Problem:** Benchmark script uses `Math.random() * 4` for outcome index, but some markets have fewer outcomes.

**Solution:** Query market outcome_count before building transactions

### Bottleneck #3: Block Time (~85-90ms)

From screenshots:
- Block time ranges from 74ms to 90ms
- Each block can fit ~300 transactions max
- Theoretical max: 300 txns / 0.085s = **3,529 TPS**

This is close to the ~3,000-4,000 TPS we see in peak bursts.

## Contract Analysis

The current `multi_outcome_market.move` is well optimized:

### What's Already Optimized

1. **Aggregator_v2 for counters** - Parallel-safe numeric operations
2. **snapshot() + read_snapshot()** - Avoids sequential read dependencies (AIP-47)
3. **Per-outcome locking** - Only locks OutcomeMarket, not entire market
4. **Pre-calculated event values** - Avoids extra aggregator reads

### Potential Further Optimizations

#### 1. Separate Read Path
Currently `buy_outcome` does:
```move
let market = borrow_global_mut<MultiMarket>(market_addr);
```

This creates a write lock even for mostly-read operations. Could split into:
```move
let market_read = borrow_global<MultiMarket>(market_addr);
// ... read operations ...
let market = borrow_global_mut<MultiMarket>(market_addr);
// ... write operations ...
```

**Impact:** Uncertain - BlockSTM may already handle this

#### 2. Remove Redundant State Updates
The `total_collateral` aggregator is updated but not strictly necessary for CPMM:
```move
aggregator_v2::add(&mut market.total_collateral, collateral_in);
```

**Impact:** Minor - one less aggregator operation

#### 3. Batch Transactions
Allow buying multiple outcomes in one transaction:
```move
public entry fun buy_outcomes_batch(
    buyer: &signer,
    market_addrs: vector<address>,
    outcome_indices: vector<u64>,
    amounts: vector<u64>,
)
```

**Impact:** Reduces per-transaction overhead, better for multi-market strategies

## Theoretical Maximum TPS

### Current Limits

| Factor | Limit | Notes |
|--------|-------|-------|
| Block time | ~85ms | ~11.7 blocks/sec |
| Txns per block | ~300 | For our transaction type |
| Sender accounts | 5 | Current benchmark limitation |

**Observed:** 304 txns in peak block = ~3,500 TPS instantaneous

### To Achieve Higher TPS

1. **More accounts**: 100+ accounts would allow 100+ parallel txns
2. **Fix failures**: Eliminate E_INVALID_OUTCOME errors
3. **Multi-market spread**: Ensure transactions hit different markets
4. **Network conditions**: Testnet varies; mainnet may differ

### Realistic Expectations

| Scenario | Expected TPS |
|----------|-------------|
| 5 accounts, 10 markets | ~300-500 sustained |
| 50 accounts, 10 markets | ~2,000-3,000 sustained |
| 100 accounts, 50 markets | ~3,000-4,000 sustained |
| Network peak capacity | ~10,000+ (theoretical) |

## Recommendations

### Immediate (Benchmark Fixes)
1. Use 50+ funded accounts instead of 5
2. Fix outcome index selection to match actual market outcomes
3. Spread transactions across all 10 markets evenly

### Contract Optimizations (Low Priority)
1. Remove `total_collateral` tracking if not needed for business logic
2. Consider batch buy function for power users
3. Verify aggregator patterns are optimal with Aptos team

### Infrastructure
1. Use dedicated RPC endpoint, not public testnet
2. Pre-sign all transactions before benchmark
3. Fire from multiple geographic locations

## Conclusion

**The contract is already well-optimized.** The main TPS limitation is:

1. **Sender account diversity** - Using only 5 accounts creates a 5-transaction parallelism ceiling
2. **Failed transactions** - 15-20% of block space wasted on invalid outcome errors

With 50+ accounts and fixed outcome indices, we should see sustained TPS closer to the ~3,500 peak observed in block 619,967,192.
