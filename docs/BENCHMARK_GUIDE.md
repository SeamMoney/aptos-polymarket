# Aptos HFT Benchmark Guide

**Last Updated:** January 14, 2026
**System:** 500 Seed-Derived Accounts with Multi-Threaded Piscina Server

---

## Quick Start

```bash
# 1. Source environment
source .env.seed

# 2. Run 60-second benchmark (automated)
npx tsx scripts/run-benchmark.ts 60 quantum
```

That's it! The orchestration script handles everything: server startup, trading, stopping, and analytics.

---

## System Overview

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Benchmark System                          │
├─────────────────────────────────────────────────────────────┤
│  run-benchmark.ts (Orchestrator)                            │
│    ├── Starts hft-piscina-server.ts                         │
│    ├── Waits for workers ready                              │
│    ├── POST /start → trades for N seconds                   │
│    ├── POST /stop → collects results                        │
│    └── Runs analytics scripts                               │
├─────────────────────────────────────────────────────────────┤
│  hft-piscina-server.ts (Coordinator)                        │
│    ├── Express/WebSocket server on port 3001                │
│    ├── Spawns 4 worker threads                              │
│    ├── Aggregates stats from workers                        │
│    └── Saves results to /tmp/hft-submitted-txns.json        │
├─────────────────────────────────────────────────────────────┤
│  trading-worker.ts (×4 workers)                             │
│    ├── Worker 0: accounts 0-124 (125 accounts)              │
│    ├── Worker 1: accounts 125-249 (125 accounts)            │
│    ├── Worker 2: accounts 250-374 (125 accounts)            │
│    └── Worker 3: accounts 375-499 (125 accounts)            │
└─────────────────────────────────────────────────────────────┘
```

### Key Components

| Component | File | Purpose |
|-----------|------|---------|
| **Orchestrator** | `scripts/run-benchmark.ts` | Automated end-to-end benchmark |
| **Server** | `server/hft-piscina-server.ts` | Multi-threaded coordinator |
| **Worker** | `server/trading-worker.ts` | Trading loop for subset of accounts |
| **Accounts** | `config/seed-accounts.ts` | BIP-39 derivation utilities |
| **Analytics** | `scripts/analyze-submitted-txns.ts` | Post-run analysis |
| **Deep Analysis** | `scripts/deep-tps-analysis.ts` | Comprehensive metrics |

---

## Benchmark Modes

| Mode | Batch Size | Delay | F&F Ratio | Target TPS | Use Case |
|------|-----------|-------|-----------|------------|----------|
| `dryrun` | 1 | 100ms | 50% | 10 | Testing/debugging |
| `light` | 3 | 80ms | 60% | 100 | Light load test |
| `normal` | 10 | 50ms | 70% | 1,000 | Standard benchmark |
| `turbo` | 30 | 40ms | 85% | 3,000 | High performance |
| `quantum` | 50 | 20ms | 90% | 5,000+ | Maximum TPS |

---

## Running Benchmarks

### Method 1: Automated (Recommended)

```bash
# Source environment first
source .env.seed

# 60-second quantum mode benchmark with analytics
npx tsx scripts/run-benchmark.ts 60 quantum

# 30-second turbo mode without analytics
npx tsx scripts/run-benchmark.ts 30 turbo --no-analytics

# Custom configuration
ACCOUNT_COUNT=100 WORKER_COUNT=2 npx tsx scripts/run-benchmark.ts 60 normal
```

### Method 2: Manual (Advanced)

```bash
# Terminal 1: Start server
source .env.seed
npx tsx server/hft-piscina-server.ts quantum

# Terminal 2: Control trading
curl -X POST http://localhost:3001/start
# Wait 60 seconds...
curl -X POST http://localhost:3001/stop

# Terminal 3: Run analytics
npx tsx scripts/analyze-submitted-txns.ts
npx tsx scripts/deep-tps-analysis.ts
```

### Method 3: Burst Scripts (Single Burst)

```bash
# Single burst of 700 transactions
source .env.tps_optimized
npx tsx scripts/burst-500.ts

# Sustained TPS for 10 seconds
DURATION=10 npx tsx scripts/sustained-tps.ts
```

---

## Environment Variables

### Required

| Variable | Description | Example |
|----------|-------------|---------|
| `SEED_MNEMONIC` | BIP-39 seed phrase | `venture advance oval...` |
| `MULTI_MARKETS` | Comma-separated market addresses | `0xdda...,0x568...` |

### Optional

| Variable | Default | Description |
|----------|---------|-------------|
| `ACCOUNT_COUNT` | 500 | Number of accounts to use |
| `WORKER_COUNT` | 4 | Number of worker threads |
| `RPC_MODE` | internal | `internal`, `custom`, `balanced` |
| `USE_ORDERLESS` | true | Use orderless transactions |
| `CONTRACT_ADDRESS` | (hardcoded) | Smart contract address |
| `PORT` | 3001 | HTTP server port |

### RPC Endpoints

| Mode | Endpoint | Description |
|------|----------|-------------|
| `internal` | `http://vfn0.usce1-0.testnet.aptoslabs.com:80` | Aptos stress testing node |
| `custom` | `https://aptos.cash.trading/v1` | Your fullnode |
| `balanced` | Both endpoints | Load balancing |

---

## Output & Analytics

### Results File

After each run, results are saved to:
- `/tmp/hft-submitted-txns.json` (latest run)
- `~/.aptos-tps-history/{runId}.json` (historical)

### Results Schema

```json
{
  "runId": "run-1704000000000",
  "contractAddress": "0x...",
  "startTime": 1704000000000,
  "endTime": 1704000060000,
  "mode": "quantum",
  "rpcMode": "internal",
  "accountCount": 500,
  "workerCount": 4,
  "useOrderless": true,
  "markets": ["0x...", "0x..."],
  "totalSubmitted": 15000,
  "successfulTrades": 14850,
  "failedTrades": 150,
  "peakTps": 425,
  "transactions": [
    {
      "hash": "0x...",
      "timestamp": 1704000001234,
      "market": "0x...",
      "outcome": 2,
      "isBuy": true,
      "sender": "0x..."
    }
  ]
}
```

### Analytics Scripts

```bash
# Basic analysis of submitted transactions
npx tsx scripts/analyze-submitted-txns.ts

# Deep analysis with latency percentiles, per-account breakdown
npx tsx scripts/deep-tps-analysis.ts

# Time-based blockchain analysis (last N minutes)
npx tsx scripts/analyze-tps.ts --minutes 5

# Specific block range analysis
npx tsx scripts/analyze-tps.ts --range 611854000 611856000
```

---

## Monitoring During Run

### HTTP Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Server health + worker status |
| `/status` | GET | Full configuration and stats |
| `/stats` | GET | Aggregated trading stats |
| `/start` | POST | Start trading |
| `/stop` | POST | Stop trading + save results |

### Example: Check Status

```bash
curl http://localhost:3001/status | jq .
```

### WebSocket Stats

Connect to `ws://localhost:3001` for real-time stats:

```json
{
  "type": "stats",
  "data": {
    "totalTrades": 15000,
    "successfulTrades": 14850,
    "failedTrades": 150,
    "currentTps": 245,
    "totalAccounts": 500,
    "activeAccounts": 500,
    "workerCount": 4,
    "successRate": "99.0",
    "elapsedSeconds": 60
  }
}
```

---

## TPS Predictions

Based on historical benchmarks and the new 500-account setup:

### Previous Results (20 accounts)

| Date | Peak TPS | Sustained TPS | Configuration |
|------|----------|---------------|---------------|
| Jan 13, 2026 | 8,544 | 873 | Table optimization, single machine |
| Jan 12, 2026 | 3,371 | ~500 | 3 workers, USD1 collateral |
| Jan 6, 2026 | 3,773 | ~400 | 3 workers, APT collateral |

### Predictions (500 accounts, 4 workers)

| Scenario | TPS Range | Confidence |
|----------|-----------|------------|
| Conservative | 4,000 - 6,000 | High |
| Moderate | 6,000 - 10,000 | Medium |
| Optimistic | 10,000 - 15,000 | Low |

**Expected: 5,000 - 8,000 sustained TPS**

### Known Bottlenecks

1. **Global APT State (`0xa`)**: All transactions write to `0x1::coin::PairedCoinType` for gas payment
2. **`borrow_global_mut` Serialization**: May serialize on market resource
3. **Block Production Rate**: ~10.6 blocks/second on testnet

---

## Troubleshooting

### Workers Not Ready

```
ERROR: Timeout waiting for workers (only 2/4 ready)
```

**Cause**: Account derivation taking too long or RPC issues.

**Fix**:
- Reduce `ACCOUNT_COUNT` for faster startup
- Check RPC endpoint connectivity
- Increase startup timeout in server

### High Failure Rate

```
Success Rate: 75.0%
```

**Causes**:
- `E_INVALID_OUTCOME`: Trading outcome not held (expected in demo)
- `SEQUENCE_NUMBER_TOO_OLD`: Sequence desync (use orderless mode)
- `TRANSACTION_EXPIRED`: RPC congestion

**Fix**:
- Enable orderless mode: `USE_ORDERLESS=true`
- Use internal RPC: `RPC_MODE=internal`

### Out of Gas

```
INSUFFICIENT_BALANCE_FOR_TRANSACTION_FEE
```

**Fix**:
```bash
source .env.seed
npx tsx scripts/fund-seed-accounts.ts --apt-only
```

### Missing Markets

```
ERROR: No markets configured
```

**Fix**: Set `MULTI_MARKETS` with valid market addresses:
```bash
export MULTI_MARKETS="0xdda603f5...,0x568914c7..."
```

---

## Verification Checklist

Before running high-TPS benchmarks:

- [ ] `.env.seed` sourced
- [ ] `SEED_MNEMONIC` set and valid
- [ ] `MULTI_MARKETS` set with market addresses
- [ ] All 500 accounts funded with APT
- [ ] All 500 accounts funded with USD1
- [ ] RPC endpoint accessible
- [ ] Markets exist and have liquidity

### Quick Verification

```bash
# Check account balances
source .env.seed
npx tsx scripts/check-seed-accounts.ts --summary

# Test RPC connectivity
curl http://vfn0.usce1-0.testnet.aptoslabs.com:80/v1
```

---

## File Reference

### Scripts

| Script | Purpose |
|--------|---------|
| `scripts/run-benchmark.ts` | Automated benchmark orchestration |
| `scripts/check-seed-accounts.ts` | Verify account balances |
| `scripts/fund-seed-accounts.ts` | Fund accounts with APT/USD1 |
| `scripts/drain-seed-accounts.ts` | Recover funds to deployer |
| `scripts/analyze-submitted-txns.ts` | Analyze submitted transactions |
| `scripts/deep-tps-analysis.ts` | Comprehensive performance analysis |
| `scripts/analyze-tps.ts` | Time-based blockchain analysis |

### Configuration

| File | Purpose |
|------|---------|
| `.env.seed` | Main environment configuration |
| `.env.tps_optimized` | TPS-optimized contract addresses |
| `config/seed-accounts.ts` | BIP-39 derivation utilities |
| `config/wallets.ts` | Legacy wallet configuration |

### Documentation

| File | Purpose |
|------|---------|
| `docs/BENCHMARK_GUIDE.md` | This guide |
| `docs/SEED_ACCOUNTS_500.md` | Account system documentation |
| `docs/MIGRATION_CHECKLIST.md` | Legacy script updates |
| `docs/TPS_BENCHMARKS.md` | Historical benchmark results |
| `docs/BOTTLENECK_ANALYSIS.md` | Performance bottleneck analysis |
