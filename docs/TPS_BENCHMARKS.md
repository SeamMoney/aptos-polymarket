# TPS Benchmark Records

## Verified Peak Performance

### January 6, 2026 - 3,773 TPS (Verified On-Chain)

**Time:** 5:19:53 AM PST
**Infrastructure:** 3 DigitalOcean droplets running quantum mode
**Script Used:** `scripts/10k-tps-demo.sh`

#### On-Chain Proof

| Block | Our Txns | Total Txns | Gas Used | Output | Events | Est TPS |
|-------|----------|------------|----------|--------|--------|---------|
| **611854263** | **356** | 377 | 6,251 | 2.71 MB | 1,980 | **3,773** |
| 611854262 | 289 | 444 | 4,919 | 2.17 MB | 1,585 | 3,063 |
| 611854313 | 228 | 231 | 4,097 | 1.76 MB | 1,285 | 2,417 |

**TPS Calculation:** 356 txns/block × 10.6 blocks/sec = **3,773 TPS**

#### Full Metrics (11.3 second burst)

| Metric | Value |
|--------|-------|
| Total Transactions | 7,103 |
| Success Rate | 100% |
| Avg TPS | 629 |
| Peak TPS (single block) | 3,774 |
| Total Gas Used | 122,976 units |
| Gas/Second | 10,889 gas/sec |
| Avg Gas/Transaction | 17 gas |
| Total State Changes | 149,754 |
| Avg State Changes/Txn | 21.1 |
| Total Output Bytes | 53.69 MB |
| Avg Output/Transaction | 7.7 KB |
| Total Events Emitted | 39,165 |

#### How to Verify

```bash
# Verify block 611854263 (our peak)
curl -s "http://aptos.cash.trading:8080/v1/blocks/by_height/611854263?with_transactions=true" | \
  jq '[.transactions[] | select(.payload.function) | .payload.function] |
      group_by(.) | map({function: .[0], count: length}) | sort_by(-.count)'
```

#### Configuration Used (quantum mode)

```typescript
quantum: {
  BATCH_SIZE: 150,
  BATCH_DELAY_MS: 20,
  USE_MULTI_RPC: true,
  FIRE_AND_FORGET_RATIO: 0.95,
  TARGET_TPS: 30000,
  MAX_PENDING: 300,
}
```

#### Infrastructure

- **Worker 1:** 178.128.177.88
- **Worker 2:** 147.182.237.239
- **Worker 3:** 161.35.231.0
- **Fullnode:** aptos.cash.trading:8080

---

### December 28, 2025 - 4K+ TPS (Grafana Observed)

**Configuration:** commit `e4083b2` ("TPS INCREASE")
**Infrastructure:** Laptop + single public API

```typescript
// Actual Dec 28 config that worked from laptop
{
  BATCH_SIZE: 30,
  BATCH_DELAY_MS: 0,
  SEQUENCE_PIPELINE: 60,
  MAX_PENDING: 120,
  FIRE_AND_FORGET_RATIO: 0.0,  // No fire-and-forget
  USE_MULTI_RPC: false,        // Single client
}
```

---

## How to Analyze TPS After a Test Run

### Quick Analysis (Last N Minutes)

```bash
# Analyze last 5 minutes
npx tsx scripts/analyze-tps.ts

# Analyze last 30 minutes
npx tsx scripts/analyze-tps.ts --minutes 30
```

### Analyze Specific Time

```bash
# Analyze around a specific date/time (PST)
npx tsx scripts/analyze-tps.ts --date "2026-01-06 05:19"
```

### Analyze Specific Block Range

```bash
# If you know the block range
npx tsx scripts/analyze-tps.ts --range 611854000 611856000

# Or around a specific block
npx tsx scripts/analyze-tps.ts --block 611854263
```

### Output Example

```
══════════════════════════════════════════════════════════════════════
  ANALYSIS: Around 1/6/2026, 5:19:00 AM
══════════════════════════════════════════════════════════════════════

  TOP 10 BLOCKS BY OUR TRANSACTION COUNT:

  Block        | Our Txns | Total | Buy  | Sell | Mint | Time                | Est TPS
  ------------------------------------------------------------------------------------------
     611854263 |      356 |   377 |  244 |   72 |   40 | 1/6/2026, 5:19:53 AM | 3,773
     611854262 |      289 |   444 |  209 |   52 |   28 | 1/6/2026, 5:19:53 AM | 3,063
     611854439 |      268 |   268 |  ... |  ... |  ... | 1/6/2026, 5:20:16 AM | 2,840

  ────────────────────────────────────────────────────────────────────
  SUMMARY:
    Blocks with our txns: 847
    Total our txns:       45,231
    Peak block:           611854263 (356 txns = ~3,773 TPS)
    Time range:           5:15:00 AM - 5:25:00 AM
══════════════════════════════════════════════════════════════════════
```

---

## Automation for Post-Test Analysis

Add to your test run script:

```bash
#!/bin/bash
# Run the TPS test
./scripts/10k-tps-demo.sh 180

# Wait for transactions to finalize
sleep 10

# Analyze the last 5 minutes
npx tsx scripts/analyze-tps.ts --minutes 5 | tee "benchmarks/run-$(date +%Y%m%d-%H%M%S).txt"
```

---

## Contract Details

- **Contract Address:** `0xa2e5e47aab07fed78a3bcf95135ee2dad20c547499c94cb16a3e047859ffa7e1`
- **Module:** `multi_outcome_market`
- **Functions Tracked:**
  - `buy_outcome`
  - `sell_outcome`
  - `mint_complete_set`

---

## Understanding Grafana Validator Metrics

When running high TPS tests, monitor the Aptos Grafana dashboard: `aptos-core > blockchain-health`

### Backpressure Metrics (0.0 - 1.0 scale)

| Metric | What It Means | Target |
|--------|---------------|--------|
| **execution backpressure on proposal** | Validators can't execute transactions fast enough | < 0.5 |
| **block gas limit** | Block hitting gas limit cap | < 0.3 |
| **pipeline backpressure on proposal** | Transaction pipeline is saturated | < 0.2 |
| **quorum store backpressure txn count** | Too many txns waiting in quorum store | 0 |
| **chain health backoff** | Network-wide health issues detected | 0 |

### What Peak TPS Looks Like

On Dec 28, 2025 at 04:45:30 when we hit ~4K TPS:
- `execution backpressure on proposal`: **1.0** (100% - validators at max capacity)
- `block gas limit`: **0.116** (11.6% of gas limit used)
- `pipeline backpressure on proposal`: **0.0771** (minimal)

**Key insight:** When `execution backpressure` hits 1.0, you've maxed out the validator execution capacity. This is the ceiling.

---

## Block/TPS Relationship

Aptos testnet produces ~10.6 blocks per second (94ms per block).

| Txns/Block | Estimated TPS |
|------------|---------------|
| 100 | 1,060 |
| 200 | 2,120 |
| 300 | 3,180 |
| 377 | 3,996 |
| 400 | 4,240 |
| 500 | 5,300 |

---

## Metric Definitions

| Metric | Description | How We Calculate |
|--------|-------------|------------------|
| **TPS** | Transactions per second | txns / duration_seconds |
| **Gas Used** | Compute resources consumed | Sum of `gas_used` field per txn |
| **Gas/Second** | Compute rate | total_gas / duration_seconds |
| **State Changes** | Storage writes per txn | Count of `changes` array entries |
| **Output Bytes** | Data written to state | JSON size of change data |
| **Events** | On-chain events emitted | Count of `events` array entries |

### Per-Transaction Averages (our contract)

| Metric | Typical Value |
|--------|---------------|
| Gas per txn | ~17-18 gas units |
| State changes per txn | ~21 |
| Output bytes per txn | ~7.7 KB |
| Events per txn | ~5-6 |
