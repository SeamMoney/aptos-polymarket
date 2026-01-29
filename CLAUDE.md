# Aptos Polymarket

Polymarket-style prediction market on Aptos. Target: 30,000+ TPS with distributed workers.

## Architecture

### Smart Contracts (Move)
Location: `contracts/sources/`

| Contract | Purpose |
|----------|---------|
| `multi_outcome_market.move` | Main market logic - CPMM AMM supporting up to 20 outcomes per market. Uses Complete Sets model (1 USD1 = 1 of each outcome token). Key TPS optimizations: Table registry for O(1) lookups, separate OutcomeMarket objects for parallel trading, aggregator_v2 for numeric state. |
| `usd1.move` | Custom collateral token to avoid APT global state contention |
| `oracle.move` | Basic oracle for price feeds |
| `optimistic_oracle.move` | UMA-style optimistic oracle for market resolution |
| `prediction_market.move` | Legacy binary market (deprecated in favor of multi_outcome) |

**Contract Address (testnet):** `0xca4d40eae9f07fb28a121862d649203fb4335ece9536ee51790e19f812ff7aea`

### HFT Server
Location: `server/`

| File | Purpose |
|------|---------|
| `hft-piscina-server.ts` | **Primary** - Worker pool server using Piscina for parallel transaction submission |
| `trading-worker.ts` | Individual worker that signs/submits transactions |
| `hft-turbo-server.ts` | Alternative high-performance variant |
| `hft-ultra-server.ts` | Ultra-optimized variant for max TPS |

The server broadcasts trades over WebSocket for real-time UI updates.

### Frontend (React + Vite)
Location: `src/`

**Key Pages:**
- `src/polymarket/PolymarketHome.tsx` - Main market listing
- `src/polymarket/MarketDetail.tsx` - Individual market view with trading
- `src/polymarket/HFTDemoPage.tsx` - TPS demonstration dashboard

**Key Hooks:**
- `useMultiMarkets.ts` - Fetches multi-outcome market data from chain
- `useHFTConnection.ts` - WebSocket connection to HFT server
- `useLiveTrades.ts` - Real-time trade stream
- `useLivePrices.ts` - Real-time price updates

### Data Flow
```
HFT Server → WebSocket → useLiveTrades/useLivePrices → UI Components
                ↓
           Aptos Chain ← useMultiMarkets (polling)
```

## Environment Variables

```bash
VITE_CONTRACT_ADDRESS    # Deployed contract address
VITE_USD1_METADATA       # USD1 token metadata address
VITE_MULTI_MARKETS       # Comma-separated market IDs
VITE_RPC_URL             # Aptos fullnode RPC
VITE_GEOMI_GRAPHQL_URL   # Indexer GraphQL endpoint
VITE_GEOMI_API_KEY       # Indexer API key
VITE_HFT_WS_URL          # HFT WebSocket URL (ws://localhost:8080)
```

## Common Commands

```bash
# Development
npm run dev              # Start frontend (localhost:5173)
npm run build            # Build for production

# HFT Demo
./scripts/orchestrator.sh standby   # Start workers in standby mode
./scripts/orchestrator.sh demo      # Full 30K TPS demo
./scripts/orchestrator.sh dryrun    # Quick test (~100 TPS, 5 sec)

# Contract Operations
npx tsx scripts/create-demo-markets.ts     # Create test markets
npx tsx scripts/fund-seed-accounts.ts      # Fund trading accounts
npx tsx scripts/align-prices.ts            # Align on-chain prices
npx tsx scripts/check-balances.ts          # Check account balances

# Testing
npm run test             # Run contract tests
npm run test:stress      # Stress test
```

## Key Concepts

### Complete Sets Model
- 1 USD1 → mint 1 of EACH outcome token (buy complete set)
- Trade individual outcomes via CPMM
- Prices always sum to ~100% (arbitrage enforces this)
- Winning outcome tokens redeem for 1 USD1 each

### TPS Optimizations
1. **Per-outcome parallelization**: Each OutcomeMarket is a separate object
2. **Aggregator_v2**: All numeric state uses parallel-safe aggregators
3. **Custom collateral (USD1)**: Avoids APT CoinStore global contention
4. **Table registry**: O(1) lookups without SmartTable overhead

### Fee Structure
- 0.3% (30 basis points) on swaps
- Collected as collateral, not outcome tokens

## File Locations

| What | Where |
|------|-------|
| Contract source | `contracts/sources/*.move` |
| Contract build | `contracts/build/PredictionMarket/` |
| Server code | `server/*.ts` |
| React app | `src/` |
| Trading scripts | `scripts/*.ts` (active), `scripts/legacy/` (deprecated) |
| Shell scripts | `scripts/*.sh` |
| Config/wallets | `config/wallets.ts` |
| Environment | `.env.local`, `.env.seed`, `.env.benchmark` |
| Scripts guide | `docs/SCRIPTS_GUIDE.md` |

## Demo Workflow

1. `./scripts/orchestrator.sh standby` - Start workers waiting
2. `npm run dev` - Start frontend
3. Open http://localhost:5173/demo-day
4. Click ARM → LAUNCH
5. Watch TPS dashboard

Pre-flight: `./scripts/pre-demo-checklist.sh`

---

## TPS Optimization History (Jan 2026)

### Jan 8 Demo Failures - Root Causes
| Error | Count | Cause |
|-------|-------|-------|
| Timeout | 1,570 | quantum mode too aggressive |
| Sequence Number | 991 | Transaction ordering conflicts |
| Mempool Full | 38 | Too many pending txns |
| Batch Submit BCS | Many | `ULEB128 encoding was not minimal` |

### Jan 13 Optimizations (Balaji Arun / Aaron suggestions)

1. **Internal Fullnode** - Direct Aptos Labs VFN access
   ```
   http://vfn0.usce1-0.testnet.aptoslabs.com:80
   ```
   Set via `RPC_MODE=internal`

2. **Table instead of SmartTable** (Aaron)
   - O(1) lookups, better parallelization
   - `contracts/sources/multi_outcome_market.move:27`

3. **Per-Outcome base_reserve Fix**
   ```
   BEFORE: All outcomes share market.base_reserve ← CONTENTION
   AFTER:  Each outcome has independent base_reserve ← PARALLEL
   ```

4. **500 Accounts with Common Seed**
   - Single mnemonic → derive 500 accounts
   - `SEED_MNEMONIC` + `ACCOUNT_COUNT=500`

5. **Piscina Worker Threads**
   - `server/hft-piscina-server.ts` (NEW - use this)
   - 4 worker_threads for true CPU parallelism
   - Each worker handles ~125 accounts independently

### Best Working Configuration

**Verified 3,371 TPS (Jan 12):**
```typescript
turbo: {
  BATCH_SIZE: 30,              // NOT 150
  BATCH_DELAY_MS: 40,          // NOT 20
  FIRE_AND_FORGET_RATIO: 0.85,
  USE_BATCH_SUBMIT: false,     // CRITICAL - causes BCS errors
  USE_ORDERLESS: false,        // CRITICAL - true causes ~50% nonce failures
}
```

**Latest Piscina Server (5000 accounts):**
```bash
SEED_MNEMONIC="..." \
ACCOUNT_COUNT=5000 \
USE_ORDERLESS=false \
RPC_MODE=internal \
npx tsx server/hft-piscina-server.ts turbo
```

### Server Comparison

| Aspect | Old (hft-ultra) | New (hft-piscina) |
|--------|-----------------|-------------------|
| Accounts | 20-25 | 500 |
| Parallelism | async only | worker_threads |
| Fullnode | aptos.cash.trading | vfn0 internal |

### Mode Configs

| Mode | Batch | Delay | Target TPS | Use Case |
|------|-------|-------|------------|----------|
| dryrun | 1 | 100ms | 10 | Quick test |
| light | 3 | 80ms | 100 | Dev testing |
| turbo | 30 | 40ms | 3,000 | **Reliable demos** |
| quantum | 50 | 20ms | 5,000 | Max throughput |

### Failsafe Strategy
If errors start during demo:
1. Switch from `quantum` → `turbo` immediately
2. Say: "Even 3K TPS is 100x Ethereum's throughput"
3. Reference verified benchmarks in `docs/TPS_BENCHMARKS.md`

### Infrastructure

| Component | Address | Region | Notes |
|-----------|---------|--------|-------|
| Internal VFN | `http://vfn0.usce1-0.testnet.aptoslabs.com:80/v1` | - | Aptos Labs VFN (may be unreliable) |
| Custom Fullnode | `http://aptos.cash.trading:8080/v1` | - | Fallback fullnode |
| Worker 1 | 178.128.177.88 | SFO2 | Accounts 0-1666 (1667 accounts) |
| Worker 2 | 167.99.164.45 | SFO2 | Accounts 1667-3333 (1667 accounts) |
| Worker 3 | 138.68.0.124 | SFO2 | Accounts 3334-4999 (1666 accounts) |

**IMPORTANT:** All workers must be in the SAME DigitalOcean region (SFO2) with identical specs for reliable operation.

### Key Docs
- `docs/TPS_BENCHMARKS.md` - Verified on-chain proof of TPS
- `docs/amm-parallelization-analysis.md` - State contention analysis
- `docs/SCRIPTS_GUIDE.md` - Comprehensive scripts reference (active vs legacy)
- `DEMO_GUIDE.md` - Step-by-step demo instructions

---

## Jan 16 2026 - AMM-Fixed Contract Verified

**Contract:** `0xca4d40eae9f07fb28a121862d649203fb4335ece9536ee51790e19f812ff7aea`

| Mode | Accounts | Avg TPS | Peak TPS | Success | Notes |
|------|----------|---------|----------|---------|-------|
| Turbo (internal VFN) | 500 | **676** | **3,180** | 79% | **Best result** |
| Light (custom) | 200 | 625 | 1,929 | 78% | Sustained, reliable |

**Critical Fix:** Internal VFN requires `/v1` suffix in URL:
- ❌ `http://vfn0.usce1-0.testnet.aptoslabs.com:80` (BROKEN)
- ✅ `http://vfn0.usce1-0.testnet.aptoslabs.com:80/v1` (WORKS - 3,180 TPS)

**Working Command (3K+ TPS):**
```bash
SEED_MNEMONIC="..." \
ACCOUNT_COUNT=500 \
RPC_MODE=internal \
CONTRACT_ADDRESS="0xca4d40eae9f07fb28a121862d649203fb4335ece9536ee51790e19f812ff7aea" \
MULTI_MARKETS="0xaf561030c7ebb22b1d8b99b727c27caab1f6944ce39c141fd2b6b0cfbf614a9e,..." \
npx tsx server/hft-piscina-server.ts turbo
```

Then: `curl -X POST "http://localhost:3001/start?duration=60"`

---

## Jan 28 2026 - Multi-Worker Setup Fixed

### Problem
Workers 2 and 3 (old IPs: 147.182.237.239, 161.35.231.0) were not executing trades while Worker 1 worked fine.

### Root Cause
- Old Worker 2 was a **2-year-old droplet** with different specs (120GB Intel disk)
- Old Worker 3 was in a **different region** (SFO3 vs SFO2)
- Internal VFN became unreachable during testing

### Solution
Created 2 fresh droplets in SFO2 (same region as Worker 1) with identical specs:
- `s-2vcpu-4gb` (4GB RAM, 2 vCPUs, 80GB disk)
- Ubuntu 24.04 LTS
- Node.js 20.x

### New Worker Setup (5000 Accounts)
```bash
# Worker 1: 178.128.177.88 (accounts 0-1666)     - 1667 accounts
# Worker 2: 167.99.164.45 (accounts 1667-3333)   - 1667 accounts
# Worker 3: 138.68.0.124 (accounts 3334-4999)    - 1666 accounts
```

### Verified Results (3-worker parallel test with 500 accounts)
| Worker | Success Rate | Peak TPS | Total Trades |
|--------|-------------|----------|--------------|
| Worker 1 | 98.7% | 1,181 | 117,390 |
| Worker 2 | 98.8% | 818 | 124,800 |
| Worker 3 | 99.2% | 954 | 133,770 |
| **Combined** | **98.9%** | **~2,953** | **375,960** |

### Worker Startup Script Template
Each worker has `/opt/aptos-hft/start-hft.sh`:
```bash
#!/bin/bash
export SEED_MNEMONIC="<mnemonic>"
export ACCOUNT_START_INDEX=<start>  # 0, 1667, or 3334
export ACCOUNT_COUNT=<count>        # 1667 or 1666
export USE_ORDERLESS=false
export RPC_MODE=custom
export FULLNODE_URL="http://aptos.cash.trading:8080/v1"
export CONTRACT_ADDRESS="0xca4d40eae9f07fb28a121862d649203fb4335ece9536ee51790e19f812ff7aea"
export USD1_METADATA="0x14b1ec8a5f31554d0cd19c390be83444ed519be2d7108c3e27dcbc4230c01fa3"
export MULTI_MARKETS="<comma-separated market IDs>"
export PORT=3001

cd /opt/aptos-hft
npx tsx server/hft-piscina-server.ts turbo
```

### Starting All Workers
```bash
# Start all 3 workers
ssh root@178.128.177.88 'cd /opt/aptos-hft && nohup ./start-hft.sh > /tmp/hft.log 2>&1 &'
ssh root@167.99.164.45 'cd /opt/aptos-hft && nohup ./start-hft.sh > /tmp/hft.log 2>&1 &'
ssh root@138.68.0.124 'cd /opt/aptos-hft && nohup ./start-hft.sh > /tmp/hft.log 2>&1 &'

# Wait for initialization (~20 seconds), then start trading
sleep 20
curl -X POST "http://178.128.177.88:3001/start?duration=30" &
curl -X POST "http://167.99.164.45:3001/start?duration=30" &
curl -X POST "http://138.68.0.124:3001/start?duration=30" &
```

### Key Lessons
1. **All workers must be in the same region** - SFO2 works, mixing regions causes issues
2. **Use fresh droplets** - 2-year-old droplets can have hidden issues
3. **Internal VFN may be unreliable** - Fall back to `aptos.cash.trading` when needed
4. **RPC_MODE=custom** with explicit FULLNODE_URL for reliability

---

## Jan 29 2026 - CRITICAL: Worker Code Deployment

### The Problem
Workers 2 and 3 showed 0 trades even though:
- SSH worked fine
- RPC connectivity was fine
- Accounts were funded
- Code files were deployed

### Root Cause
**The server loads pre-compiled `trading-worker.js`, NOT `trading-worker.ts`!**

The Piscina worker pool loads workers from `server/trading-worker.js` (compiled JavaScript), not the TypeScript source. Deploying only `.ts` files does nothing - the old `.js` continues to run.

### Solution: Always Rebuild Before Deploy

```bash
# CORRECT: Rebuild JS then deploy
npx esbuild server/trading-worker.ts \
  --bundle \
  --platform=node \
  --outfile=server/trading-worker.js \
  --format=esm \
  --external:@aptos-labs/ts-sdk \
  --external:bip39 \
  --external:@scure/bip32

# Then deploy the .js file
scp server/trading-worker.js root@<worker-ip>:/opt/aptos-hft/server/
```

### Deployment Scripts

| Script | Purpose |
|--------|---------|
| `./scripts/deploy-workers.sh` | **FULL DEPLOY**: Rebuild → Deploy → Restart → Verify → Test |
| `./scripts/deploy-workers.sh --build-only` | Just rebuild locally |
| `./scripts/deploy-workers.sh --verify` | Check workers have correct version |
| `./scripts/worker-status.sh` | Quick status check of all workers |

### Pre-Demo Checklist

```bash
# 1. Check current worker status
./scripts/worker-status.sh

# 2. If ANY changes were made to trading-worker.ts, MUST redeploy:
./scripts/deploy-workers.sh

# 3. Verify all workers ready
./scripts/worker-status.sh

# 4. Run demo
curl -X POST "http://178.128.177.88:3001/start?duration=60" &
curl -X POST "http://167.99.164.45:3001/start?duration=60" &
curl -X POST "http://138.68.0.124:3001/start?duration=60" &
```

### Version Tracking

The `trading-worker.ts` includes a version marker:
```typescript
const WORKER_VERSION = '2026-01-29-v3';
console.log(`[WORKER_VERSION] ${WORKER_VERSION}`);
```

Check loaded version:
```bash
ssh root@<ip> "grep 'WORKER_VERSION' /tmp/hft.log | tail -1"
```

### Results After Fix (3 Workers, 5000 Accounts)

| Worker | Trades | Success Rate |
|--------|--------|--------------|
| Worker 1 | 15,660 | 100% |
| Worker 2 | 29,460 | 100% |
| Worker 3 | 27,180 | 100% |
| **TOTAL** | **72,300** | **100%** |

**~2,400 TPS combined with 100% success rate!**

### Concurrency Control

The trading-worker.ts uses a Semaphore to limit concurrent HTTP requests:
- `ACCOUNT_CONCURRENCY=40` (env var or workerData)
- With batchSize=30, this means max 1,200 concurrent HTTP requests per worker thread
- Prevents socket exhaustion that caused 0 TPS with many accounts

---

## Jan 29 2026 - TPS Scaling Analysis

### Systematic Testing Results

Tested various configurations to find bottlenecks and path to 10x TPS.

#### Baseline Established (3 workers × 4 threads × 60 concurrency)

| Metric | Value |
|--------|-------|
| Combined Peak TPS | **~1,579** |
| Average TPS | **~1,200** |
| Success Rate | **100%** |
| Total Accounts | 5,000 (split across 3 workers) |

#### Per-Worker Performance

| Worker | Accounts | Trades/30s | Avg TPS | Notes |
|--------|----------|------------|---------|-------|
| Worker 1 | 0-1666 | 4,020 | ~134 | **Underperforms** - slow to start |
| Worker 2 | 1667-3333 | 14,310 | ~477 | Normal |
| Worker 3 | 3334-4999 | 16,950 | ~565 | Normal |

### What Was Tested

| Test | Config Change | Result |
|------|--------------|--------|
| More accounts | 2500 vs 1667 per worker | **No improvement** - accounts not bottleneck |
| Higher concurrency | 80 vs 60 | **Failed** - Worker 3 had 63% failure rate |
| More threads | 8 vs 4 | **Worker 1 stuck** - others no significant improvement |
| Single worker 5000 accounts | 1 VM, 8 threads | **~680 TPS** - lower than 3-worker combined |
| Unfunded accounts | Range 4167-6666 | **INSUFFICIENT_BALANCE errors** |

### Key Findings

1. **Linear scaling with workers** - Adding VMs is the most reliable path to higher TPS
2. **Per-worker TPS caps at ~520-550** - Regardless of accounts, threads, or concurrency
3. **Worker 1 consistently underperforms** - ~134 TPS vs ~520 for others (accounts 0-1666 specifically)
4. **Funded accounts: 0-4999 ONLY** - Going beyond this range causes INSUFFICIENT_BALANCE_FOR_TRANSACTION_FEE
5. **Higher concurrency causes failures** - 80+ concurrency leads to mempool/nonce issues
6. **More threads can cause instability** - 8 threads caused Worker 1 to get stuck

### Worker 1 Slow Start Issue

Worker 1 (accounts 0-1666) consistently:
- Takes 20-25 seconds to start producing trades
- Eventually reaches similar TPS (~400-600) but starts late
- Higher CPU/memory usage (97% vs 83% for others)
- Possibly related to account range 0-1666 having more prior transaction history

### Path to 10K+ TPS

| Approach | Details |
|----------|---------|
| Current baseline | ~1,200 TPS with 3 workers |
| Per-worker TPS | ~520 TPS average (Workers 2 & 3) |
| **Workers needed for 10K TPS** | **~20 workers** |
| **Workers needed for 30K TPS** | **~60 workers** |
| Accounts needed | ~33,000 funded (for 20 workers) |
| Cost estimate | ~$80/month (20 × $4 droplets) |

### Recommended Configuration

For reliable demos, use this conservative config:
```bash
WORKER_COUNT=4
ACCOUNT_CONCURRENCY=60  # NOT 80+
USE_ORDERLESS=false
RPC_MODE=custom
FULLNODE_URL="http://aptos.cash.trading:8080/v1"
```

### Scaling Checklist

To scale TPS, in order of priority:
1. **Add more worker VMs** - Each adds ~500 TPS (linear)
2. **Fund more accounts** - Current limit is 5,000
3. **Investigate Worker 1** - Fixing would add ~400 TPS
4. **Optimize fullnode** - User's own node (aptos.cash.trading) has no rate limits

### Error Types Encountered

| Error | Cause | Solution |
|-------|-------|----------|
| INSUFFICIENT_BALANCE_FOR_TRANSACTION_FEE | Unfunded accounts | Use accounts 0-4999 only |
| Transaction already in mempool | Sequence number conflicts | Reduce concurrency |
| Socket exhaustion | Too many concurrent HTTP | Use ACCOUNT_CONCURRENCY semaphore |
| Worker stuck at 0 TPS | Too many threads + high concurrency | Use 4 threads, not 8 |

---

## Jan 29 2026 - 4 vCPU Upgrade & Fullnode Bottleneck Discovery

### CPU Upgrade Test Results

Upgraded all 3 workers from 2 vCPU → 4 vCPU ($24 → $48/month each).

| Config | Per-Worker Peak | Per-Worker Avg | Combined TPS |
|--------|-----------------|----------------|--------------|
| 2 vCPU, 4 threads | 1,064 | 690 | ~1,600 |
| **4 vCPU, 4 threads** | **1,990** | **1,381** | ~1,600 |
| 4 vCPU, 8 threads | 2,040 | 1,117 | - |

**Key Finding:** 4 threads (1 per vCPU) is optimal. 8 threads causes context switching overhead.

### Fullnode Bottleneck Discovered

**CRITICAL:** Combined TPS stayed at ~1,600 despite doubling per-worker capacity.

The fullnode (aptos.cash.trading) caps at ~1,600 TPS total, regardless of worker count or CPU capacity. This explains why adding more workers stopped helping.

**Proof:**
- Single 4 vCPU worker: 1,990 peak TPS
- Three 4 vCPU workers: 1,570 combined TPS (capped by fullnode)

### Current Infrastructure (after upgrade)

| Worker | IP | vCPU | RAM | Cost |
|--------|-----|------|-----|------|
| Worker 1 | 178.128.177.88 | 4 | 8GB | $48/mo |
| Worker 2 | 167.99.164.45 | 4 | 8GB | $48/mo |
| Worker 3 | 138.68.0.124 | 4 | 8GB | $48/mo |
| **Total** | | **12** | **24GB** | **$144/mo** |

### Path Forward for Higher TPS

Since fullnode is now the bottleneck, options are:

1. **Multiple fullnodes** - Split workers across different RPC endpoints
2. **Internal VFN** - Use Aptos Labs internal VFN if reliable
3. **Dedicated fullnode** - Run our own high-capacity fullnode
4. **Indexer approach** - Different architecture for higher throughput

### Updated Scaling Model

```
Per-worker capacity:
  2 vCPU: ~690 avg TPS, ~1,100 peak
  4 vCPU: ~1,100 avg TPS, ~2,000 peak

Fullnode limits:
  aptos.cash.trading: ~1,600 TPS max
  Internal VFN: Unknown (unreliable)

To scale beyond 1,600 TPS:
  Need multiple fullnode endpoints
```
