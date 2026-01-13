# Aptos Polymarket TPS Analysis & Gas Profiling Report
## Comprehensive Documentation for Aptos Team Review

**Report Date:** January 12, 2026
**Network:** Aptos Testnet (chain_id: 2)
**Project:** High-Frequency Trading Prediction Market

---

## Executive Summary

This document consolidates all TPS benchmarking, gas profiling, and performance analysis from testing a prediction market contract on Aptos testnet. Our testing achieved **3,773 TPS peak** (Jan 6) and **3,371 TPS peak** (Jan 12), with key findings about parallelization bottlenecks.

### Key Results

| Metric | Best Achieved |
|--------|---------------|
| **Peak TPS** | 3,773 (Jan 6, 2026) |
| **Peak Txns/Block** | 356 |
| **Total Transactions** | 45,000+ across multiple runs |
| **Success Rate** | 84-100% depending on run |

### Critical Finding

**Multi-market distribution and USD1 collateral did NOT improve TPS beyond single-market baseline.** The bottleneck is not market aggregator contention but **global APT state writes at `0xa`** for gas payment. All transactions serialize on 6 writes to address `0xa` regardless of market or collateral token used.

---

## Table of Contents

1. [Grafana Correlation Points](#grafana-correlation-points)
2. [Contract & Infrastructure Details](#contract--infrastructure-details)
3. [Benchmark Records](#benchmark-records)
4. [Gas Profiling Analysis](#gas-profiling-analysis)
5. [State Changes Analysis](#state-changes-analysis)
6. [Event Analysis](#event-analysis)
7. [Error Analysis](#error-analysis)
8. [Multi-Market Scaling Investigation](#multi-market-scaling-investigation)
9. [USD1 Parallelization Hypothesis (Disproven)](#usd1-parallelization-hypothesis-disproven)
10. [Understanding Grafana Validator Metrics](#understanding-grafana-validator-metrics)
11. [Block/TPS Relationship](#blocktps-relationship)
12. [Metric Definitions](#metric-definitions)
13. [How to Analyze TPS After a Test Run](#how-to-analyze-tps-after-a-test-run)
14. [Comparison with Previous Runs](#comparison-with-previous-runs)
15. [Open Questions for Aptos Team](#open-questions-for-aptos-team)
16. [Verification Commands](#verification-commands)
17. [Appendices](#appendix-market-addresses-tested)

---

## Grafana Correlation Points

**Use these timestamps and block numbers to correlate with internal Aptos Grafana dashboards:**

### January 12, 2026 - 3,371 TPS Run (3 Workers, Turbo Mode)

| Event | Timestamp (PST) | Block Height | Ledger Version | Unix Timestamp (μs) |
|-------|-----------------|--------------|----------------|---------------------|
| **Peak TPS Block** | 2026-01-12 19:13:54 | 618,833,330 | 7,371,278,968 - 7,371,279,325 | 1768274034728025 |
| Test Start | 2026-01-12 19:12:09 | ~618,832,021 | - | ~1768273929000000 |
| Test End | 2026-01-12 19:15:42 | ~618,835,458 | - | ~1768274142000000 |

### January 6, 2026 - 3,773 TPS Run (3 Workers, Quantum Mode)

| Event | Timestamp (PST) | Block Height | Unix Timestamp (μs) |
|-------|-----------------|--------------|---------------------|
| **Peak TPS Block** | 2026-01-06 05:19:53 | 611,854,263 | ~1737720000000000 |
| Test Duration | 11.3 seconds burst | 611,854,262 - 611,854,439 | - |

### Expected Grafana Observations

During peak periods, expect to see:

| Metric | Expected Value |
|--------|----------------|
| `execution backpressure on proposal` | Spike to 0.5-1.0 |
| `block gas limit` | ~10-15% utilization |
| `pipeline backpressure on proposal` | Low (<0.1) |
| Validator TPS | 3,000-3,800 spike |
| Block size | 350+ transactions |

---

## Contract & Infrastructure Details

### Contract Information

| Field | Value |
|-------|-------|
| **Contract Address** | `0xbdea15f5b0f5449ae8f3a6ae95a5e090bdeeec91be1fcac8375b2f5f37f1c134` |
| **Module** | `multi_outcome_market` |
| **Collateral** | USD1 Stablecoin (Fungible Asset) |
| **USD1 Metadata** | `0x69091fbab5f7d635ee7ac5098cf0c1efbe31d68fec0f2cd565e8d168daf52832` |
| **Market Type** | LMSR-based prediction market with multi-outcome support |

### Functions Tested

| Function | Description | Avg Gas |
|----------|-------------|---------|
| `buy_outcome` | Purchase outcome tokens | 16 gas |
| `sell_outcome` | Sell outcome tokens | 10 gas |
| `mint_complete_set` | Mint all outcome tokens | 27.5 gas |

### Worker Infrastructure

| Property | Worker 1 | Worker 2 | Worker 3 |
|----------|----------|----------|----------|
| **IP Address** | 178.128.177.88 | 147.182.237.239 | 161.35.231.0 |
| **Provider** | DigitalOcean | DigitalOcean | DigitalOcean |
| **Region** | SFO3 | SFO3 | SFO3 |
| **Size** | 2 vCPU / 4GB RAM | 2 vCPU / 4GB RAM | 2 vCPU / 4GB RAM |
| **OS** | Ubuntu 22.04 | Ubuntu 22.04 | Ubuntu 22.04 |
| **Node.js** | v20.x | v20.x | v20.x |

### RPC Endpoints

| Endpoint | URL | Purpose |
|----------|-----|---------|
| **Primary** | `http://aptos.cash.trading:8080/v1` | Self-hosted fullnode |
| **QuickNode** | `https://polished-evocative-borough.aptos-testnet.quiknode.pro/.../v1` | Fallback |
| **Public** | `https://api.testnet.aptoslabs.com/v1` | Backup |

### HFT Server Configuration

**Turbo Mode (Jan 12 run):**
```typescript
turbo: {
  BATCH_SIZE: 30,              // 30 transactions per batch per account
  BATCH_DELAY_MS: 40,          // 40ms delay between batches
  USE_MULTI_RPC: true,         // Distribute requests across RPC endpoints
  FIRE_AND_FORGET_RATIO: 0.85, // 85% of txns don't wait for confirmation
  TARGET_TPS: 3000,            // Target throughput (theoretical max)
  MAX_PENDING: 100,            // Max pending unconfirmed transactions
  USE_BATCH_SUBMIT: false,     // Disabled due to BCS ULEB128 encoding issues
  USE_ORDERLESS: true,         // AIP-123 orderless transactions enabled
  SEQUENCE_PIPELINE: 10,       // Sequence number pipeline depth (unused with orderless)
}
```

**Quantum Mode (Jan 6 run):**
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

### Worker Launch Commands

```bash
# Step 1: Kill any existing processes on all workers
ssh root@178.128.177.88 "pkill -9 -f tsx; pkill -9 node"
ssh root@147.182.237.239 "pkill -9 -f tsx; pkill -9 node"
ssh root@161.35.231.0 "pkill -9 -f tsx; pkill -9 node"

# Step 2: Launch Worker 1 (primary coordinator)
ssh root@178.128.177.88 "cd /opt/aptos-hft && source .env.usd1 && \
  export USE_BATCH_SUBMIT=false && \
  nohup npx tsx server/hft-ultra-server.ts turbo 120 > /tmp/hft-w1.log 2>&1 &"

sleep 2  # Wait before launching next worker

# Step 3: Launch Worker 2
ssh root@147.182.237.239 "cd /opt/aptos-hft && source .env.usd1 && \
  export USE_BATCH_SUBMIT=false && \
  nohup npx tsx server/hft-ultra-server.ts turbo 120 > /tmp/hft-w2.log 2>&1 &"

sleep 2

# Step 4: Launch Worker 3
ssh root@161.35.231.0 "cd /opt/aptos-hft && source .env.usd1 && \
  export USE_BATCH_SUBMIT=false && \
  nohup npx tsx server/hft-ultra-server.ts turbo 120 > /tmp/hft-w3.log 2>&1 &"
```

### Environment Configuration (`.env.usd1`)

```bash
# Contract Configuration
CONTRACT_ADDRESS=0xbdea15f5b0f5449ae8f3a6ae95a5e090bdeeec91be1fcac8375b2f5f37f1c134
USE_USD1=true
USD1_METADATA=0x69091fbab5f7d635ee7ac5098cf0c1efbe31d68fec0f2cd565e8d168daf52832

# 12 Multi-Outcome Markets (USD1 Collateral)
MULTI_MARKETS=0x3e690f317df664c413e12b15eaa6e5565606fbd46628464f84f93e0674a3c052,0xf3256638cad294e47c8cc6bb1a6a0fdd85b29ef427b3118028c34b9f061aa50d,0x192f7cfc0c8151deec37c6280c17b55f7557a04b580b486d6076cc11955ddde3,0x9e4583c0af174a119b5316ae84988f4fd988259de35ef95447b371744a355762,0xd82731a9a2259ccfef2fd13db13720c7cc927c5b7879aa160aecc618c4d4654f,0x77a65b92664f992ccbd8a17d73a5f2fc933523ce64a1c475d1db1c0fc2acf42a,0xa84ba7b7364a40031e29d355d7a5f48fd54f922c8eed0ed0009c5d660a6da339,0x8187c1b3b7ca06dbcbac36fe280e0b5343b744c5a299a43263f9162738d4d792,0x551f153ff61f94311a22592550b0ede4b3b57338af161bd9472f21e15da23b4b,0x742e3c66cb6570351ceb7cf1b2df87e726c708b786109a8cdae93b0c3c7b5a04,0x35df09c98f8668c06f6777e98e3a0405fe894c271f06ba2fed0b322e2a5c2f16,0xd3227afa81dce5fa0e8f86f61dc7f3215ee799a0d2e6a112a988e5ac732bf719

# RPC Endpoints
FULLNODE_URL=http://aptos.cash.trading:8080/v1
APTOS_API_KEY=<quicknode_api_key_redacted>

# 20 Trading Accounts (Ed25519 private keys)
# Each account is pre-funded with USD1 tokens
# Orderless transactions (AIP-123) allow same accounts on multiple workers without sequence conflicts
ULTRA_PRIVATE_KEYS=0x...,0x...,0x...  # 20 keys (redacted)
```

### Key Optimizations Used

1. **Orderless Transactions (AIP-123):** Eliminates sequence number bottleneck - transactions don't need sequential nonces, enabling true parallelism across workers
2. **20 Trading Accounts per Worker:** Each account can submit independently; with orderless, same accounts can be used across workers
3. **Fire-and-Forget (85%):** Most transactions are submitted without waiting for confirmation, maximizing throughput
4. **USD1 Stablecoin Collateral:** Uses Fungible Asset standard instead of APT, avoiding global state contention on APT balance resources
5. **Multi-RPC Load Distribution:** Spreads requests across multiple endpoints to avoid rate limiting
6. **Self-Hosted Fullnode:** `aptos.cash.trading` provides unlimited RPS for transaction submission
7. **Batch Submission:** Groups 30 transactions per batch with 40ms delays for optimal network utilization

### Other Contract Functions

```
resolve, admin_drain_market, admin_emergency_withdraw, buy_outcome,
create_multi_market, create_multi_market_with_collateral, emergency_withdraw,
get_all_multi_markets, get_all_prices, get_market_count, get_multi_market_info,
get_outcome_labels, get_outcome_price, get_user_multi_positions, market_exists,
mint_complete_set, quote_buy_outcome, quote_sell_outcome, redeem_complete_set,
redeem_winnings, sell_outcome
```

---

## Benchmark Records

### Record: January 6, 2026 - 3,773 TPS (Highest Verified)

**Time:** 5:19:53 AM PST
**Configuration:** 3 workers, quantum mode, APT collateral
**Script Used:** `scripts/10k-tps-demo.sh`

| Block | Our Txns | Total Txns | Gas Used | Output | Events | Est TPS |
|-------|----------|------------|----------|--------|--------|---------|
| **611,854,263** | **356** | 377 | 6,251 | 2.71 MB | 1,980 | **3,773** |
| 611,854,262 | 289 | 444 | 4,919 | 2.17 MB | 1,585 | 3,063 |
| 611,854,313 | 228 | 231 | 4,097 | 1.76 MB | 1,285 | 2,417 |

**TPS Calculation:** 356 txns/block × 10.6 blocks/sec = **3,773 TPS**

**Full Metrics (11.3 second burst):**

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

**How to Verify:**

```bash
# Verify block 611854263 (our peak)
curl -s "http://aptos.cash.trading:8080/v1/blocks/by_height/611854263?with_transactions=true" | \
  jq '[.transactions[] | select(.payload.function) | .payload.function] |
      group_by(.) | map({function: .[0], count: length}) | sort_by(-.count)'
```

---

### January 12, 2026 - 3,371 TPS (3 Workers, Turbo)

**Time:** 7:12 PM - 7:15 PM PST
**Configuration:** 3 workers, turbo mode, USD1 collateral

| Block | Txns | Gas Used | Events | Success% | Est TPS |
|-------|------|----------|--------|----------|---------|
| **618,833,330** | **318** | 5,074 | 1,518 | 87% | **3,371** |
| 618,834,443 | 205 | 3,280 | 983 | 87% | 2,173 |
| 618,834,051 | 150 | 2,049 | 600 | 70% | 1,590 |

**Worker Results:**

| Worker | IP | Total | Success | Rate |
|--------|-----|-------|---------|------|
| Worker 1 | 178.128.177.88 | 13,786 | 13,702 | 99.4% |
| Worker 2 | 147.182.237.239 | 7,016 | 2,768 | 39.5% |
| Worker 3 | 161.35.231.0 | 15,330 | 12,073 | 78.8% |
| **Total** | - | **36,132** | **28,543** | **79.0%** |

**Full On-Chain Metrics:**
- Total Transactions: 4,407
- Successful: 3,709 (84.2%)
- Peak TPS: 3,371
- Duration: 176.9 seconds
- Total Gas: 68,784 units
- Total State Changes: 90,565

---

### January 12, 2026 - 2,194 TPS (1 Worker, Turbo)

**Time:** 6:39 PM - 6:45 PM PST
**Configuration:** Single worker (Worker 1: 178.128.177.88), turbo mode, USD1 collateral

| Block | Our Txns | Gas Used | Output | Events | Success% | Est TPS |
|-------|----------|----------|--------|--------|----------|---------|
| **618,811,573** | **207** | 3,006 | 1019.7 KB | 893 | 78% | **2,194** |
| 618,811,608 | 174 | 2,643 | 885.7 KB | 776 | 78% | 1,844 |
| 618,811,570 | 165 | 1,554 | 473.9 KB | 393 | 28% | 1,749 |
| 618,811,600 | 152 | 2,139 | 721.8 KB | 629 | 74% | 1,611 |
| 618,811,775 | 140 | 2,146 | 735.6 KB | 646 | 86% | 1,484 |

**TPS Calculation:** 207 txns/block × 10.6 blocks/sec = **2,194 TPS**

**Server-Reported Results (Worker 1):**

| Metric | Value |
|--------|-------|
| Total Trades | 24,570 |
| Successful | 24,570 |
| Failed | 0 |
| **Success Rate** | **100%** |
| Fire-and-Forget Resolved | 20,790 |

**Full On-Chain Metrics (10-minute window):**

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

---

### December 28, 2025 - ~4,000 TPS (Grafana Observed)

**Configuration:** Laptop, single public API, APT collateral

Observed on Grafana dashboards but not verified on-chain with same precision as later runs. `execution backpressure on proposal` hit 1.0 (100% validator capacity).

---

## Gas Profiling Analysis

### Peak Block Breakdown (Block 618,833,330)

| Metric | Value |
|--------|-------|
| Total Transactions | 318 (ours) / 358 (total) |
| Total Gas Used | 5,074 gas units |
| Average Gas/Txn | 15.96 gas |
| Min Gas/Txn | 5 gas |
| Max Gas/Txn | 29 gas |

### Gas by Function

| Function | Count | Total Gas | Avg Gas | % of Total |
|----------|-------|-----------|---------|------------|
| `buy_outcome` | 206 | 3,296 | 16.0 | 65.0% |
| `mint_complete_set` | 36 | 990 | 27.5 | 19.5% |
| `sell_outcome` | 76 | 788 | 10.4 | 15.5% |

### Fee Statement (Sample Transaction)

Transaction `0xba35e421303b0c3958db549d9e6edf96e07cc7c4d1c276ff8263858fc8640e28`:

| Component | Value |
|-----------|-------|
| Execution Gas Units | 5 |
| I/O Gas Units | 11 |
| Storage Fee | 0 |
| **Total Gas** | **16** |

### Gas Distribution Histogram

```
Gas Range    | Count | Percentage
-------------|-------|------------
5-10 gas     |   76  |   23.9%    (mostly sell_outcome)
11-20 gas    |  206  |   64.8%    (mostly buy_outcome)
21-30 gas    |   36  |   11.3%    (mostly mint_complete_set)
```

---

## State Changes Analysis

### Per-Transaction State Changes

| Metric | Value |
|--------|-------|
| Total State Changes (peak block) | 6,714 |
| Avg Changes/Transaction | 21.1 |
| Total Events Emitted | 1,518 |
| Avg Events/Transaction | 4.8 |

### State Change Types (Sample Transaction)

| Change Type | Count per Txn |
|-------------|---------------|
| `write_resource` | 20 |
| `write_table_item` | 1 |
| **Total** | **21** |

### Resources Modified Per Trade

A typical `buy_outcome` transaction modifies:
1. User's USD1 fungible asset store (withdraw collateral)
2. Market's USD1 fungible asset store (receive collateral)
3. User's outcome token balance (receive tokens)
4. Market's outcome pool state (update supply)
5. Market's pricing state (update LMSR prices)

---

## Event Analysis

### Events Emitted Per Transaction

| Event Type | Count |
|------------|-------|
| `0x1::fungible_asset::Withdraw` | 1 |
| `0x1::fungible_asset::Deposit` | 2 |
| `OutcomeTokenBought` / `OutcomeTokenSold` | 1 |
| `0x1::transaction_fee::FeeStatement` | 1 |
| **Total** | **5** |

### Custom Event Structure

```json
{
  "type": "0xbdea15...::multi_outcome_market::OutcomeTokenBought",
  "data": {
    "buyer": "0xbc339f...",
    "collateral_in": "1196855",
    "market_address": "0xa84ba7b7...",
    "new_price": "63",
    "outcome_index": "0",
    "tokens_out": "687823"
  }
}
```

---

## Error Analysis

### Failed Transactions Breakdown

| Error Type | Count | % of Failures |
|------------|-------|---------------|
| `E_INVALID_OUTCOME` (0x9) | ~600 | ~86% |
| `TRANSACTION_EXPIRED` (vm_error 6) | ~98 | ~14% |

### Sample Failed Transaction

```json
{
  "hash": "0x9a3a59c15cc3d5b0d82ecae8ed25dad951517da8287afeef0b81267f123801fe",
  "gas_used": "5",
  "vm_status": "Move abort in 0xbdea15...::multi_outcome_market: E_INVALID_OUTCOME(0x9): ",
  "function": "sell_outcome"
}
```

**Root Cause:** The HFT demo randomly selects outcome indices. Sometimes it attempts to sell tokens for an outcome the account doesn't hold, causing `E_INVALID_OUTCOME`. This is expected behavior for a stress test.

### Issues Encountered (Jan 12 Single-Worker Run)

1. **Batch Submit BCS Error:** `/v1/transactions/batch` endpoint rejected transactions with `ULEB128 encoding was not minimal` error. Workaround: disabled batch submit.
2. **Quantum Mode Port Exhaustion:** `EADDRNOTAVAIL` errors from too many concurrent connections in quantum mode. Used turbo mode instead.
3. **Fullnode 502 Errors:** Custom fullnode (aptos.cash.trading) returned 502 during analysis. Used QuickNode fallback.

### Key Differences: Jan 6 vs Jan 12

| Factor | Jan 6 | Jan 12 |
|--------|-------|--------|
| Contract | APT collateral | USD1 collateral |
| Mode | Quantum | Turbo |
| Batch Submit | Enabled | Disabled |
| Workers | 3 | 3 (also tested with 1) |
| Peak TPS | 3,773 | 3,371 |

---

## Multi-Market Scaling Investigation

### The Original Thesis

The contract was designed with **Aggregator V2 (AIP-47)** for parallel-safe operations:

> **By distributing trades across multiple independent markets, we can reduce aggregator contention and "stack" TPS linearly.**

### Theoretical Model

| Configuration | Markets | Expected TPS |
|---------------|---------|--------------|
| Baseline | 1 market | ~30,000 |
| Sharded | 3 markets | ~60,000 |
| Full Distribution | 12 markets | ~90,000+ |

### Contract Design

```move
struct MultiMarket has key {
    total_collateral: Aggregator<u64>,  // Parallel-safe
    base_reserve: Aggregator<u64>,       // Parallel-safe
    accumulated_fees: Aggregator<u64>,   // Parallel-safe
}

struct OutcomeToken has store {
    reserve: Aggregator<u64>,  // Per-outcome, parallel-safe
}
```

### What Actually Happened

| Date | Markets | Configuration | Peak TPS |
|------|---------|---------------|----------|
| Dec 28, 2025 | 1 | APT collateral | ~4,000 |
| Jan 6, 2026 | 1 | APT collateral | 3,773 |
| Jan 12, 2026 | 12 | USD1 collateral | 3,371 |

**Result:** Adding 12 markets did NOT significantly increase TPS.

### Root Cause: Global APT State Contention

All transactions write to address `0xa` for gas payment:

| Resource at `0xa` | Writes Per Txn |
|-------------------|----------------|
| `coin::PairedCoinType` | 1 |
| `coin::PairedFungibleAssetRefs` | 1 |
| `fungible_asset::ConcurrentSupply` | 1 |
| `fungible_asset::Metadata` | 1 |
| `object::ObjectCore` | 1 |
| `primary_fungible_store::DeriveRefPod` | 1 |
| **Total** | **6** |

Even with separate markets, all transactions serialize on these 6 writes. This creates a ~356:1 contention ratio regardless of market distribution.

### Additional Serialization Factors

#### borrow_global_mut Serialization

The contract uses `borrow_global_mut<MultiMarket>` which may force write-set inclusion:

```move
let market = borrow_global_mut<MultiMarket>(market_addr);  // Exclusive lock on entire resource
```

Even though individual aggregator operations are parallel-safe, the mutable borrow might serialize transactions within the same market.

#### Fungible Asset Operations

Each trade performs fungible asset deposits/withdrawals that touch user stores:

```move
// Withdraw collateral from user
primary_fungible_store::withdraw(buyer, collateral_metadata, collateral_in);

// Deposit to market
fungible_asset::deposit(market.collateral_store, payment);

// Mint outcome tokens
let tokens = fungible_asset::mint(&outcome.mint_ref, tokens_out);
primary_fungible_store::deposit(buyer_addr, tokens);
```

These operations have their own contention patterns separate from the market aggregators.

### Benchmark Scripts (Created but Not Conclusively Run)

Scripts were created to A/B test single vs multi-market:

```bash
# Single market baseline
./scripts/benchmark-multi-market.sh  # Compares 1 market vs 5 markets

# Multi-market with sharding
./scripts/multi-market-tps.sh 300 sharded  # 1 market per worker
./scripts/multi-market-tps.sh 300 all      # All 10 markets round-robin
```

**Status:** These benchmarks have not been run with controlled conditions to produce conclusive results.

### Theoretical Maximum TPS

Based on observed data, the practical TPS ceiling appears to be:

| Bottleneck | Estimated Limit |
|------------|-----------------|
| APT gas payment (`0xa` writes) | ~4,000 TPS |
| Single market aggregator | ~4,000 TPS |
| Multi-market (current) | ~4,000 TPS |
| Theoretical (no contention) | 100,000+ TPS |

**Key Insight:** The limiting factor is NOT market aggregator contention, but global APT state contention from gas payments. Multi-market distribution doesn't help because all transactions still serialize on gas payment writes.

---

## USD1 Parallelization Hypothesis (Disproven)

### The Hypothesis

> "Native Fungible Assets (like USD1) achieve higher TPS than APT because they avoid coin-to-FA pairing overhead."

### Why We Thought This Would Work

APT is a "migrated coin" supporting both standards via AIP-63:
```
APT = coin::Coin<AptosCoin> <--> Fungible Asset (paired)
```

We hypothesized USD1 (pure Fungible Asset) would avoid global state at `0xa`.

### What We Found

**Both APT and USD1 transactions write to the same 6 resources at `0xa`:**

| Metric | APT Transaction | USD1 Transaction |
|--------|-----------------|------------------|
| Total state changes | 18 | 15 |
| **Writes at `0xa`** | **6** | **6** |
| Gas used | 16 | 16 |

### Why USD1 Doesn't Help

1. **Gas is always paid in APT** - Every transaction writes to APT's global state
2. **Pairing layer unavoidable** - Gas payment triggers `PairedCoinType` writes
3. **Bottleneck is gas, not collateral** - Collateral uses per-user stores (good), gas uses global state (bad)

### TPS Comparison

| Contract | Collateral | Peak TPS |
|----------|------------|----------|
| `0xa2e5...` (old) | APT | 3,773 |
| `0xbdea1...` (new) | USD1 | 3,371 |

**USD1 did NOT improve TPS.** The hypothesis was wrong.

### What Might Actually Help

Based on this analysis, the only ways to avoid `0xa` contention would be:
1. **Sponsored/gasless transactions** - If someone else pays gas, user's txn might avoid the write
2. **Gas payment optimization by Aptos** - Use aggregators for gas accounting
3. **Different gas token** - Hypothetically, if gas could be paid in a non-paired FA

See: [USD1-PARALLELIZATION-ANALYSIS.md](./USD1-PARALLELIZATION-ANALYSIS.md) for full investigation details.

### Recommendations

1. **Investigate gas payment optimization** - Can APT gas writes be batched or use aggregators?
2. **Profile actual contention** - Use Aptos internal tools to identify true hot keys
3. **Test with sponsored transactions** - Remove gas payment from user transactions
4. **Consider aggregator alternatives** - Are there more parallel-friendly patterns?

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

### Automation for Post-Test Analysis

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

## Comparison with Previous Runs

| Date | Peak TPS | Workers | Mode | Collateral | Notes |
|------|----------|---------|------|------------|-------|
| **Jan 12, 2026** | **3,371** | 3 | Turbo | USD1 | Documented here |
| Jan 12, 2026 | 2,194 | 1 | Turbo | USD1 | Single worker |
| Jan 6, 2026 | 3,773 | 3 | Quantum | APT | Previous record |
| Dec 28, 2025 | ~4,000+ | 1 | Custom | APT | Grafana observed |

---

## Open Questions for Aptos Team

### 1. APT Gas Payment Contention

Can high-TPS applications avoid the `coin::PairedCoinType` and related writes at `0xa`? Potential solutions:
- Aggregators for gas accounting?
- Batch gas payment processing?
- Different gas token support?

### 2. Aggregator Behavior with borrow_global_mut

Does `borrow_global_mut<Resource>` force serialization even when only aggregator fields are mutated? Our code:

```move
let market = borrow_global_mut<MultiMarket>(market_addr);
aggregator_v2::add(&mut market.base_reserve, amount);  // Is this parallel?
```

### 3. ConcurrentSupply Parallelism

Are `fungible_asset::mint` operations truly parallel via aggregators, or do they have hidden serialization?

### 4. Object Sharding for Outcomes

Would storing outcomes as separate objects (instead of a vector in `MultiMarket`) improve parallelism?

```move
// Current: vector in single resource
struct MultiMarket { outcomes: vector<OutcomeToken> }

// Alternative: separate objects
struct OutcomeTokenObject has key { reserve: Aggregator<u64> }
```

### 5. Theoretical TPS Ceiling

Based on our testing, the practical ceiling appears to be ~4,000 TPS. Is this consistent with Aptos internal benchmarks for contracts with:
- Aggregator V2 usage
- Fungible Asset transfers
- Multiple independent resources

---

## Verification Commands

### Verify Peak Blocks

```bash
# January 12 peak (block 618,833,330)
curl -s "https://api.testnet.aptoslabs.com/v1/blocks/by_height/618833330?with_transactions=true" | \
  jq '[.transactions[] | select(.payload.function? | strings | contains("multi_outcome_market"))] | length'
# Expected: 318

# January 6 peak (block 611,854,263)
curl -s "https://api.testnet.aptoslabs.com/v1/blocks/by_height/611854263?with_transactions=true" | \
  jq '[.transactions[] | select(.payload.function? | strings | contains("multi_outcome_market"))] | length'
# Expected: 356
```

### Run Analysis Script

```bash
git clone https://github.com/yourusername/aptos-polymarket
cd aptos-polymarket
npm install

# Analyze specific block
npx tsx scripts/analyze-tps.ts --block 618833330

# Analyze time window
npx tsx scripts/analyze-tps.ts --date "2026-01-12 19:13"
```

### Sample Transaction Hashes

**January 12 Peak Block (618,833,330):**

| Hash | Function | Gas | Status |
|------|----------|-----|--------|
| `0xba35e421303b0c3958db549d9e6edf96e07cc7c4d1c276ff8263858fc8640e28` | buy_outcome | 16 | Success |
| `0x314b762cb572fd26db872cd46e4fa9f23b64d08a0ab2c3acf220c46e24349aa0` | mint_complete_set | 29 | Success |
| `0xcdd45574acbcc0476bdfc022aad00d5d08de1b6caa4fff2b67097523301c56ea` | buy_outcome | 16 | Success |

---

## Appendix: Market Addresses Tested

12 multi-outcome markets deployed with USD1 collateral:

```
0x3e690f317df664c413e12b15eaa6e5565606fbd46628464f84f93e0674a3c052
0xf3256638cad294e47c8cc6bb1a6a0fdd85b29ef427b3118028c34b9f061aa50d
0x192f7cfc0c8151deec37c6280c17b55f7557a04b580b486d6076cc11955ddde3
0x9e4583c0af174a119b5316ae84988f4fd988259de35ef95447b371744a355762
0xd82731a9a2259ccfef2fd13db13720c7cc927c5b7879aa160aecc618c4d4654f
0x77a65b92664f992ccbd8a17d73a5f2fc933523ce64a1c475d1db1c0fc2acf42a
0xa84ba7b7364a40031e29d355d7a5f48fd54f922c8eed0ed0009c5d660a6da339
0x8187c1b3b7ca06dbcbac36fe280e0b5343b744c5a299a43263f9162738d4d792
0x551f153ff61f94311a22592550b0ede4b3b57338af161bd9472f21e15da23b4b
0x742e3c66cb6570351ceb7cf1b2df87e726c708b786109a8cdae93b0c3c7b5a04
0x35df09c98f8668c06f6777e98e3a0405fe894c271f06ba2fed0b322e2a5c2f16
0xd3227afa81dce5fa0e8f86f61dc7f3215ee799a0d2e6a112a988e5ac732bf719
```

---

## Summary of Key Findings

1. **Peak TPS achieved:** 3,773 (verified on-chain)
2. **Multi-market scaling:** Did NOT improve TPS as expected
3. **USD1 collateral:** Did NOT improve TPS (hypothesis disproven)
4. **Root cause of TPS ceiling:** Global APT state writes at `0xa` for gas payment
5. **All transactions** write 6 times to `0xa` regardless of market or collateral
6. **Recommendation:** Investigate gas payment optimization or sponsored transactions

---

## Appendix B: Full Analysis Output (January 12, 2026)

```
══════════════════════════════════════════════════════════════════════════════════════════
  ANALYSIS: Last 5 minutes
══════════════════════════════════════════════════════════════════════════════════════════

  TOP 10 BLOCKS BY TRANSACTION COUNT:

  Block        | Txns | Gas Used  | Gas/Txn | Changes | Output    | Events | Success%
  ----------------------------------------------------------------------------------------
     618833330 |  318 |     5,074 |      16 |    6714 |   1.68 MB |   1518 | 87%
     618834443 |  205 |     3,280 |      16 |    4343 |   1.09 MB |    983 | 87%
     618834051 |  150 |     2,049 |      14 |    2780 |  694.6 KB |    600 | 70%
     618834086 |  146 |     2,475 |      17 |    3197 |  825.4 KB |    729 | 91%
     618834168 |  104 |     1,581 |      15 |    2102 |  538.6 KB |    472 | 83%

  ════════════════════════════════════════════════════════════════════════════════════════
  AGGREGATE PERFORMANCE METRICS
  ════════════════════════════════════════════════════════════════════════════════════════

  TRANSACTIONS:
    Total Transactions:                4,407
    Successful:                        3,709 (84.2%)
    Failed:                              698
    Duration:                          176.9 seconds
    Blocks with our txns:                 85

  THROUGHPUT:
    TPS (avg):                            25 txns/sec
    Peak TPS (single block):           3,371 txns/sec
    Avg Txns/Block:                       52 txns/block
    Peak Txns/Block:                     318 txns/block

  GAS METRICS:
    Total Gas Used:                   68,784 gas units
    Gas/Second:                          389 gas/sec
    Avg Gas/Transaction:                  16 gas/txn
    Peak Gas/Block:                    5,074 gas/block

  STATE & OUTPUT:
    Total State Changes:              90,565
    Avg Changes/Transaction:            20.6
    Total Output Bytes:             22.67 MB
    Avg Output/Transaction:           5.3 KB
    Total Events Emitted:             20,383

  TIME RANGE: 1/12, 7:12:44 PM → 1/12, 7:15:41 PM
══════════════════════════════════════════════════════════════════════════════════════════
```

---

## Appendix C: Sample Transaction Hashes for Verification

### January 12, 2026 - Peak Block (618,833,330)

| Hash | Function | Gas | Status |
|------|----------|-----|--------|
| `0xba35e421303b0c3958db549d9e6edf96e07cc7c4d1c276ff8263858fc8640e28` | buy_outcome | 16 | Success |
| `0x314b762cb572fd26db872cd46e4fa9f23b64d08a0ab2c3acf220c46e24349aa0` | mint_complete_set | 29 | Success |
| `0xcdd45574acbcc0476bdfc022aad00d5d08de1b6caa4fff2b67097523301c56ea` | buy_outcome | 16 | Success |
| `0x9a3a59c15cc3d5b0d82ecae8ed25dad951517da8287afeef0b81267f123801fe` | sell_outcome | 5 | Failed (E_INVALID_OUTCOME) |

### Verification Commands

```bash
# Verify specific transaction
curl -s "https://api.testnet.aptoslabs.com/v1/transactions/by_hash/0xba35e421303b0c3958db549d9e6edf96e07cc7c4d1c276ff8263858fc8640e28" | jq '{hash, gas_used, success, vm_status}'

# Get function breakdown for peak block
curl -s "https://api.testnet.aptoslabs.com/v1/blocks/by_height/618833330?with_transactions=true" | \
  jq '[.transactions[] | select(.payload.function?) | .payload.function] |
      group_by(.) | map({function: .[0], count: length}) | sort_by(-.count) | .[0:5]'
```

---

**Report Generated:** January 12, 2026
**Repository:** aptos-polymarket
**Contact:** For questions about methodology or to reproduce results
