# TPS Optimization - January 13, 2026

## Summary

Deployed a TPS-optimized version of the prediction market contract and achieved significant throughput improvements using USD1 (native Fungible Asset) as collateral.

## Key Results

| Metric | Result |
|--------|--------|
| Peak single block | **806 transactions** |
| Peak TPS (single block) | **8,544 TPS** |
| Sustained avg TPS | **873 TPS** |
| Best burst | 71 blocks, 6,517 txns in 7.5s |
| Blocks with 200+ txns | 10 consecutive |
| On-chain success rate | 85% |

## Contract Optimizations

### 1. SmartTable → Table Migration
- Changed `SmartTable<address, MarketMetadata>` to `Table<address, MarketMetadata>`
- Table provides O(1) lookups with better parallelization characteristics
- SmartTable has internal bucket locking that can cause contention

### 2. USD1 Native Fungible Asset
- USD1 is a **native FA** created via `primary_fungible_store::create_primary_store_enabled_fungible_asset()`
- APT is a **migrated coin** with pairing overhead (`CoinConversionMap`, `PairedCoinType`)
- USD1 avoids global state contention that serializes APT transfers

### 3. Per-Outcome Parallelization
- Each outcome has its own `OutcomeMarket` object
- Trades on different outcomes don't conflict
- Combined with 10 markets = 40 independent trading targets

## Deployed Addresses

**Contract (TPS Optimized):**
```
0xda51d5f87be27cac0a1d72fe500da145c61b2356547ac811e0cd822c80f99a3b
```

**USD1 Metadata:**
```
0xff7e7db4e38ce829a087d08d129585154bfed104d880486bc170d1464a504a8b
```

**10 Markets:**
1. WLFI Banking Charter: `0xdda603f5809b7e3c...`
2. Trump Greenland: `0x568914c73b8aed2a...`
3. Fed Chair Nomination: `0x10932ea9a3448eb1...`
4. Iran Supreme Leader: `0xbbfcd32bfc2b653d...`
5. China Taiwan: `0xbc2240693af5df64...`
6. Russia-Ukraine Ceasefire: `0xcb0e753cfa2a0305...`
7. Venezuela Leadership: `0xe83d90a6e7229a6a...`
8. Fed Jan 2026 Rate: `0x1267b37dd2c196a1...`
9. Bitcoin Q1 2026: `0x3c704b2a85071b56...`
10. Bitcoin $150K: `0x66523f60f28f17e8...`

## Test Scripts Created

### `scripts/burst-500.ts`
Single burst of 700 transactions from 20 accounts.
```bash
source .env.tps_optimized
npx tsx scripts/burst-500.ts
```

### `scripts/sustained-tps.ts`
Continuous firing for sustained TPS measurement.
```bash
DURATION=10 npx tsx scripts/sustained-tps.ts
```

### `scripts/mega-burst.ts`
Pre-build 10,000+ transactions then fire all at once.
```bash
TXNS_PER_ACCOUNT=500 npx tsx scripts/mega-burst.ts
```

### `scripts/parallel-burst.ts`
Split accounts across parallel workers for maximum throughput.
```bash
WORKER_ID=0 TOTAL_WORKERS=4 npx tsx scripts/parallel-burst.ts
```

## Analysis

Run post-test analysis with:
```bash
source .env.tps_optimized
FULLNODE_URL="http://aptos.cash.trading:8080/v1" npx tsx scripts/analyze-tps.ts --minutes 2
```

## Bottlenecks Identified

1. **Single Machine Limit**: ~900 TPS submission rate from one Node.js process
2. **20 Accounts**: Sequence number throughput limited by account count
3. **Network Latency**: Client-to-fullnode RTT affects submission rate

## Next Steps

To achieve 50+ consecutive blocks with 200+ txns each:
1. Get distributed VMs back online (3 VMs with dedicated accounts)
2. Fund more accounts with USD1
3. Run from machines geographically closer to fullnode

## Configuration Files

- `.env.tps_optimized` - Full configuration with contract, markets, and account keys
- `scripts/orchestrator.sh` - Updated with new contract/market addresses
- `contracts/Move.toml` - Updated dev-addresses for new contract
