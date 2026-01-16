# TPS Benchmark Records

## Verified Peak Performance

### January 16, 2026 - 3,180 TPS (AMM-Fixed Contract, Internal VFN)

**Time:** 1:15 AM - 1:17 AM PST
**Contract Address:** `0xca4d40eae9f07fb28a121862d649203fb4335ece9536ee51790e19f812ff7aea`
**Module:** `multi_outcome_market` (AMM-fixed with per-outcome base_reserve)
**Collateral:** USD1 Stablecoin
**Infrastructure:** Local machine, 500 accounts, 4 worker threads, Aptos Internal VFN

#### Key Discovery: Internal VFN URL Fix

The internal Aptos VFN requires `/v1` suffix:
- ❌ `http://vfn0.usce1-0.testnet.aptoslabs.com:80` (BROKEN - module not found)
- ✅ `http://vfn0.usce1-0.testnet.aptoslabs.com:80/v1` (WORKS)

#### On-Chain Proof

| Block | Txns | Gas Used | Gas/Txn | Output | Events | Success% | Est TPS |
|-------|------|----------|---------|--------|--------|----------|---------|
| **622,302,153** | **300** | 4,837 | 16 | 1.41 MB | 1,228 | 78% | **3,180** |
| 622,302,472 | 300 | 4,506 | 15 | 1.43 MB | 1,249 | 79% | 3,180 |
| 622,302,399 | 288 | 4,810 | 17 | 1.38 MB | 1,210 | 80% | 3,053 |
| 622,302,183 | 284 | 4,019 | 14 | 1.33 MB | 1,156 | 77% | 3,010 |
| 622,302,444 | 278 | 4,112 | 15 | 1.34 MB | 1,175 | 81% | 2,947 |

**TPS Calculation:** 300 txns/block × 10.6 blocks/sec = **3,180 TPS**

#### Server-Reported Results

| Metric | Value |
|--------|-------|
| Total Trades Submitted | 77,880 |
| Successful | 55,748 |
| Failed | 22,132 |
| **Success Rate** | **71.6%** |
| **Peak TPS (server)** | **2,210** |
| Duration | 73 seconds |

#### Full On-Chain Metrics

| Metric | Value |
|--------|-------|
| Total Transactions | 46,114 |
| Successful | 36,523 (79.2%) |
| Failed | 9,591 |
| **Peak TPS (single block)** | **3,180** |
| Peak Txns/Block | 300 |
| Average TPS | 676 |
| Duration | 68.2 seconds |
| Total Gas Used | 850,011 units |
| Gas/Second | 12,468 gas/sec |
| Avg Gas/Transaction | 18 gas |
| Total State Changes | 850,228 |
| Total Events | 191,691 |

#### Configuration Used

```typescript
turbo: {
  batchSize: 30,
  batchDelayMs: 40,
  fireAndForgetRatio: 0.85,
  targetTps: 3000,
}
```

#### Infrastructure

| Component | Value |
|-----------|-------|
| **RPC Endpoint** | `http://vfn0.usce1-0.testnet.aptoslabs.com:80/v1` |
| **Accounts** | 500 (seed-derived) |
| **Worker Threads** | 4 |
| **Script** | `hft-piscina-server.ts` |
| **Mode** | turbo |

#### Launch Command

```bash
SEED_MNEMONIC="..." \
ACCOUNT_COUNT=500 \
RPC_MODE=internal \
CONTRACT_ADDRESS="0xca4d40eae9f07fb28a121862d649203fb4335ece9536ee51790e19f812ff7aea" \
MULTI_MARKETS="0xaf561030c7ebb22b1d8b99b727c27caab1f6944ce39c141fd2b6b0cfbf614a9e,..." \
npx tsx server/hft-piscina-server.ts turbo

# Then trigger:
curl -X POST "http://localhost:3001/start?duration=60"
```

---

### January 16, 2026 - 2,290 TPS (AMM-Fixed Contract, Custom Fullnode)

**Time:** 12:35 AM - 12:37 AM PST
**Contract Address:** `0xca4d40eae9f07fb28a121862d649203fb4335ece9536ee51790e19f812ff7aea`
**Module:** `multi_outcome_market` (AMM-fixed with per-outcome base_reserve)
**Infrastructure:** Local machine, 500 accounts, custom fullnode (aptos.cash.trading)

#### On-Chain Proof

| Block | Txns | Gas Used | Gas/Txn | Output | Events | Success% | Est TPS |
|-------|------|----------|---------|--------|--------|----------|---------|
| **622,272,712** | **216** | 4,253 | 20 | 1.04 MB | 911 | 81% | **2,290** |
| 622,272,817 | 203 | 3,511 | 17 | 1001.5 KB | 856 | 81% | 2,152 |
| 622,272,716 | 185 | 3,751 | 20 | 908.8 KB | 776 | 80% | 1,961 |
| 622,272,759 | 181 | 4,687 | 26 | 858.2 KB | 731 | 76% | 1,919 |

**TPS Calculation:** 216 txns/block × 10.6 blocks/sec = **2,290 TPS**

#### Full On-Chain Metrics

| Metric | Value |
|--------|-------|
| Total Transactions | 26,813 |
| Successful | 20,670 (77.1%) |
| **Peak TPS (single block)** | **2,290** |
| Peak Txns/Block | 216 |
| Average TPS | 263 |
| Duration | 102.0 seconds |
| Total Gas Used | 734,768 units |

#### Notes

This run used `aptos.cash.trading` as the RPC endpoint because the internal VFN URL was missing `/v1`. After discovering the URL fix, subsequent runs used the internal VFN and achieved higher TPS.

---

### January 16, 2026 - 1,929 TPS (Light Mode, Custom Fullnode)

**Time:** 12:39 AM - 12:41 AM PST
**Contract Address:** `0xca4d40eae9f07fb28a121862d649203fb4335ece9536ee51790e19f812ff7aea`
**Infrastructure:** Local machine, 200 accounts, light mode

#### On-Chain Proof

| Block | Txns | Gas Used | Output | Events | Success% | Est TPS |
|-------|------|----------|--------|--------|----------|---------|
| **622,275,275** | **182** | 2,601 | 874.9 KB | 747 | 78% | **1,929** |
| 622,275,197 | 154 | 2,775 | 762.9 KB | 652 | 81% | 1,632 |
| 622,275,746 | 152 | 2,300 | 765.9 KB | 655 | 83% | 1,611 |

#### Full On-Chain Metrics

| Metric | Value |
|--------|-------|
| Total Transactions | 47,337 |
| Successful | 36,929 (78%) |
| **Peak TPS (single block)** | **1,929** |
| Average TPS | 625 |
| Duration | 75.7 seconds |

#### Notes

Light mode (batchSize: 3, batchDelayMs: 80) provides more sustained throughput with higher success rates, useful for demos where reliability matters more than peak TPS.

---

### January 12, 2026 - 3,371 TPS (3 Workers, Turbo Mode)

**Time:** 7:12 PM - 7:15 PM PST
**Contract Address:** `0xbdea15f5b0f5449ae8f3a6ae95a5e090bdeeec91be1fcac8375b2f5f37f1c134`
**Module:** `multi_outcome_market` (Prediction Market with LMSR pricing)
**Collateral:** USD1 Stablecoin (Fungible Asset, avoids APT global state contention)

#### On-Chain Proof

| Block | Txns | Gas Used | Output | Events | Success% | Est TPS |
|-------|------|----------|--------|--------|----------|---------|
| **618,833,330** | **318** | 5,074 | 1.68 MB | 1,518 | 87% | **3,371** |
| 618,834,443 | 205 | 3,280 | 1.09 MB | 983 | 87% | 2,173 |
| 618,834,051 | 150 | 2,049 | 694.6 KB | 600 | 70% | 1,590 |
| 618,834,086 | 146 | 2,475 | 825.4 KB | 729 | 91% | 1,548 |
| 618,834,168 | 104 | 1,581 | 538.6 KB | 472 | 83% | 1,102 |

**TPS Calculation:** 318 txns/block × 10.6 blocks/sec = **3,371 TPS**

#### Server-Reported Results (All 3 Workers)

| Worker | IP Address | Total Trades | Success | Failed | Success Rate | Notes |
|--------|------------|-------------|---------|--------|--------------|-------|
| Worker 1 | 178.128.177.88 | 13,786 | 13,702 | 84 | 99.4% | Primary coordinator, stable |
| Worker 2 | 147.182.237.239 | 7,016 | 2,768 | 4,248 | 39.5% | Fullnode connectivity issues |
| Worker 3 | 161.35.231.0 | 15,330 | 12,073 | 3,257 | 78.8% | Good throughput |
| **Total** | - | **36,132** | **28,543** | **7,589** | **79.0%** | - |

#### Full On-Chain Metrics

| Metric | Value |
|--------|-------|
| Total Transactions | 4,407 |
| Successful | 3,709 (84.2%) |
| **Peak TPS (single block)** | **3,371** |
| Peak Txns/Block | 318 |
| Average TPS | 25 |
| Duration | 176.9 seconds |
| Total Gas Used | 68,784 units |
| Gas/Second | 389 gas/sec |
| Avg Gas/Transaction | 16 gas |
| Total State Changes | 90,565 |
| Total Events | 20,383 |

#### Worker Infrastructure Details

| Property | Worker 1 | Worker 2 | Worker 3 |
|----------|----------|----------|----------|
| **IP Address** | 178.128.177.88 | 147.182.237.239 | 161.35.231.0 |
| **Provider** | DigitalOcean | DigitalOcean | DigitalOcean |
| **Region** | SFO3 | SFO3 | SFO3 |
| **Droplet Size** | 2 vCPU / 4GB RAM | 2 vCPU / 4GB RAM | 2 vCPU / 4GB RAM |
| **OS** | Ubuntu 22.04 | Ubuntu 22.04 | Ubuntu 22.04 |
| **Node.js** | v20.x | v20.x | v20.x |
| **Script** | `hft-ultra-server.ts` | `hft-ultra-server.ts` | `hft-ultra-server.ts` |
| **Run Mode** | turbo | turbo | turbo |
| **Run Duration** | 120 seconds | 120 seconds | 120 seconds |
| **Trading Accounts** | 20 (from ULTRA_PRIVATE_KEYS) | 20 (from ULTRA_PRIVATE_KEYS) | 20 (from ULTRA_PRIVATE_KEYS) |

#### Worker Launch Commands

```bash
# Worker 1 (launched first as coordinator)
ssh root@178.128.177.88 "cd /opt/aptos-hft && source .env.usd1 && \
  export USE_BATCH_SUBMIT=false && \
  nohup npx tsx server/hft-ultra-server.ts turbo 120 > /tmp/hft-w1.log 2>&1 &"

# Worker 2 (launched 2 seconds after Worker 1)
ssh root@147.182.237.239 "cd /opt/aptos-hft && source .env.usd1 && \
  export USE_BATCH_SUBMIT=false && \
  nohup npx tsx server/hft-ultra-server.ts turbo 120 > /tmp/hft-w2.log 2>&1 &"

# Worker 3 (launched 2 seconds after Worker 2)
ssh root@161.35.231.0 "cd /opt/aptos-hft && source .env.usd1 && \
  export USE_BATCH_SUBMIT=false && \
  nohup npx tsx server/hft-ultra-server.ts turbo 120 > /tmp/hft-w3.log 2>&1 &"
```

#### Environment Variables (`.env.usd1`)

```bash
# Contract configuration
CONTRACT_ADDRESS=0xbdea15f5b0f5449ae8f3a6ae95a5e090bdeeec91be1fcac8375b2f5f37f1c134
USE_USD1=true
USD1_METADATA=0x69091fbab5f7d635ee7ac5098cf0c1efbe31d68fec0f2cd565e8d168daf52832

# 12 multi-outcome markets (USD1 collateral)
MULTI_MARKETS=0x3e690f317df664c413e12b15eaa6e5565606fbd46628464f84f93e0674a3c052,0xf3256638cad294e47c8cc6bb1a6a0fdd85b29ef427b3118028c34b9f061aa50d,...

# RPC endpoints
FULLNODE_URL=http://aptos.cash.trading:8080/v1
APTOS_API_KEY=<quicknode_api_key>

# 20 trading accounts (each worker has same 20 accounts, orderless txns prevent conflicts)
ULTRA_PRIVATE_KEYS=0x...,0x...,0x...  # 20 Ed25519 private keys
```

#### Configuration Used (turbo mode)

```typescript
turbo: {
  BATCH_SIZE: 30,              // 30 transactions per batch
  BATCH_DELAY_MS: 40,          // 40ms delay between batches
  USE_MULTI_RPC: true,         // Distribute across RPC endpoints
  FIRE_AND_FORGET_RATIO: 0.85, // 85% don't wait for response
  TARGET_TPS: 3000,            // Target throughput
  MAX_PENDING: 100,            // Max pending transactions
  USE_BATCH_SUBMIT: false,     // Disabled due to BCS encoding issues
  USE_ORDERLESS: true,         // AIP-123 orderless transactions (no sequence numbers)
}
```

#### RPC Endpoints Used

| Endpoint | URL | Purpose | Rate Limit |
|----------|-----|---------|------------|
| **Primary Fullnode** | `http://aptos.cash.trading:8080/v1` | Transaction submission | Unlimited (self-hosted) |
| **QuickNode Fallback** | `https://polished-evocative-borough.aptos-testnet.quiknode.pro/.../v1` | Fallback & analysis | 25 RPS |
| **Public API** | `https://api.testnet.aptoslabs.com/v1` | Backup | Rate limited |

---

### January 12, 2026 - 2,194 TPS (Single Worker, Turbo Mode)

**Time:** 6:39 PM - 6:45 PM PST
**Contract Address:** `0xbdea15f5b0f5449ae8f3a6ae95a5e090bdeeec91be1fcac8375b2f5f37f1c134`
**Module:** `multi_outcome_market` (Prediction Market with LMSR pricing)
**Collateral:** USD1 Stablecoin (Fungible Asset)
**Infrastructure:** Single worker (Worker 1: 178.128.177.88) running turbo mode

#### On-Chain Proof

| Block | Our Txns | Gas Used | Output | Events | Success% | Est TPS |
|-------|----------|----------|--------|--------|----------|---------|
| **618,811,573** | **207** | 3,006 | 1019.7 KB | 893 | 78% | **2,194** |
| 618,811,608 | 174 | 2,643 | 885.7 KB | 776 | 78% | 1,844 |
| 618,811,570 | 165 | 1,554 | 473.9 KB | 393 | 28% | 1,749 |
| 618,811,600 | 152 | 2,139 | 721.8 KB | 629 | 74% | 1,611 |
| 618,811,775 | 140 | 2,146 | 735.6 KB | 646 | 86% | 1,484 |

**TPS Calculation:** 207 txns/block × 10.6 blocks/sec = **2,194 TPS**

#### Server-Reported Results (Worker 1)

| Metric | Value |
|--------|-------|
| Total Trades | 24,570 |
| Successful | 24,570 |
| Failed | 0 |
| **Success Rate** | **100%** |
| Fire-and-Forget Resolved | 20,790 |

#### Full On-Chain Metrics (10-minute window)

| Metric | Value |
|--------|-------|
| Total Transactions | 9,386 |
| Successful | 7,283 (77.6%) |
| **Peak TPS (single block)** | **2,194** |
| Peak Txns/Block | 207 |
| Average TPS | 25 |
| Duration | 378.2 seconds |
| Total Gas Used | 140,776 units |
| Gas/Second | 372 gas/sec |
| Avg Gas/Transaction | 15 gas |
| Total State Changes | 185,428 |
| Total Events | 40,938 |

#### Configuration Used (turbo mode, batch submit disabled)

```typescript
turbo: {
  BATCH_SIZE: 30,
  BATCH_DELAY_MS: 40,
  USE_MULTI_RPC: true,
  FIRE_AND_FORGET_RATIO: 0.85,
  TARGET_TPS: 3000,
  MAX_PENDING: 150,
  USE_BATCH_SUBMIT: false,  // Disabled due to BCS encoding issues
}
```

#### Issues Encountered

1. **Batch Submit BCS Error:** `/v1/transactions/batch` endpoint rejected transactions with `ULEB128 encoding was not minimal` error. Workaround: disabled batch submit.
2. **Quantum Mode Port Exhaustion:** `EADDRNOTAVAIL` errors from too many concurrent connections in quantum mode. Used turbo mode instead.
3. **Fullnode 502 Errors:** Custom fullnode (aptos.cash.trading) returned 502 during analysis. Used QuickNode fallback.

#### Key Differences from Jan 6 Run

| Factor | Jan 6 | Jan 12 |
|--------|-------|--------|
| Contract | APT collateral | USD1 collateral |
| Mode | Quantum | Turbo |
| Batch Submit | Enabled | Disabled |
| Workers | 3 | 1 |
| Peak TPS | 3,773 | 2,194 |

---

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
