# Data Structure Benchmark Results

**Date:** January 13, 2026
**Network:** Aptos Testnet
**Contract:** `0x07aa6210d6eb8befe55e0cb983964ad5f2e4edb4eb80be8ea6a2ec7860ff34f0`

## Summary

Controlled A/B benchmark comparing three data structure variants for the prediction market registry:

| Variant | Peak TPS | Submit TPS | Success Rate | Gas/Txn |
|---------|----------|------------|--------------|---------|
| **Table** | **339** | 316 | 100% | **16** |
| BigOrderedMap | 265 | 246 | 100% | 330 |
| SmartTable | 127 | 125 | 100% | 170 |

## Winner: Table

**Table is the clear winner** for high-TPS prediction market use cases:

- **2.67x faster** than SmartTable (339 vs 127 TPS)
- **1.28x faster** than BigOrderedMap (339 vs 265 TPS)
- **10x less gas** than SmartTable (16 vs 170 gas)
- **20x less gas** than BigOrderedMap (16 vs 330 gas)

## Data Structure Analysis

### Table (Winner)
```move
struct MultiMarketRegistry has key {
    markets: Table<address, MarketMetadata>,
}
```
- **O(1) lookup/insert** - constant time operations
- **Excellent parallelization** - no bucket locking, each key is independent
- **No iteration support** - but not needed for our use case
- **Lowest gas cost** - minimal overhead

### SmartTable (2.67x slower)
```move
struct MultiMarketRegistry has key {
    markets: SmartTable<address, MarketMetadata>,
}
```
- **O(1) average lookup** - but bucket-based
- **Poor parallelization** - bucket locking causes contention
- **Iteration support** - can enumerate all keys
- **Higher gas** - bucket management overhead

### BigOrderedMap (1.28x slower)
```move
struct MultiMarketRegistry has key {
    markets: BigOrderedMap<address, MarketMetadata>,
}
```
- **O(log N) operations** - B+Tree structure
- **Good parallelization** - for distant keys
- **Ordered iteration** - maintains key order
- **Highest gas** - tree traversal and rebalancing

## Test Methodology

1. **Identical workloads** - 250 buy_outcome transactions per variant
2. **Same accounts** - 5 test accounts with 50 txns each
3. **Same markets** - 10 markets per variant
4. **Sequential tests** - 30s cooldown between variants
5. **APT collateral** - fair comparison using native APT

## Detailed Results

### Table Variant
```json
{
  "variant": "Table",
  "totalSubmitted": 250,
  "mempoolAccepted": 250,
  "mempoolRejected": 0,
  "submitDurationSec": 0.792,
  "avgSubmitTps": 316,
  "peakTps": 339,
  "onChainSuccess": 250,
  "onChainFailed": 0,
  "avgGasPerTxn": 16
}
```

### SmartTable Variant
```json
{
  "variant": "SmartTable",
  "totalSubmitted": 250,
  "mempoolAccepted": 250,
  "mempoolRejected": 0,
  "submitDurationSec": 2.001,
  "avgSubmitTps": 125,
  "peakTps": 127,
  "onChainSuccess": 250,
  "onChainFailed": 0,
  "avgGasPerTxn": 170
}
```

### BigOrderedMap Variant
```json
{
  "variant": "BigOrderedMap",
  "totalSubmitted": 250,
  "mempoolAccepted": 250,
  "mempoolRejected": 0,
  "submitDurationSec": 1.018,
  "avgSubmitTps": 246,
  "peakTps": 265,
  "onChainSuccess": 250,
  "onChainFailed": 0,
  "avgGasPerTxn": 330
}
```

## Why SmartTable is Slow

SmartTable uses bucket-based storage for iteration support. Under BlockSTM parallel execution:

1. **Bucket contention** - Multiple transactions touching the same bucket must serialize
2. **Lock granularity** - Even with different keys, same bucket = conflict
3. **Retry overhead** - BlockSTM aborts and retries conflicting transactions

## When to Use Each

| Use Case | Recommended |
|----------|-------------|
| High-TPS trading | **Table** |
| Need iteration | SmartTable |
| Ordered keys | BigOrderedMap |
| Range queries | BigOrderedMap |

## Reproducing Results

```bash
# Source environment
source .env.benchmark

# Run benchmark (20 seconds per variant)
npx tsx scripts/benchmark-variants.ts 20
```

## Files

- **Benchmark script:** `scripts/benchmark-variants.ts`
- **Environment config:** `.env.benchmark`
- **Table contract:** `contracts/sources/multi_outcome_market.move`
- **SmartTable contract:** `contracts/sources/variants/smarttable_market.move`
- **BigOrderedMap contract:** `contracts/sources/variants/bigorderedmap_market.move`

## Conclusion

For prediction market platforms requiring high transaction throughput:

1. **Use Table** for market registry storage
2. **Avoid SmartTable** - bucket locking kills parallelism
3. **BigOrderedMap** is viable if ordering is required, but 20x higher gas

The 2.67x TPS improvement from Table over SmartTable explains the dramatic performance gains observed between the Jan 6 (SmartTable) and Jan 13 (Table) deployments.
