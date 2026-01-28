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

**Latest Piscina Server (2000 accounts):**
```bash
SEED_MNEMONIC="..." \
ACCOUNT_COUNT=2000 \
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
| Worker 1 | 178.128.177.88 | SFO2 | Accounts 0-165 |
| Worker 2 | 167.99.164.45 | SFO2 | Accounts 166-332 (NEW Jan 28) |
| Worker 3 | 138.68.0.124 | SFO2 | Accounts 333-499 (NEW Jan 28) |

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

### New Worker Setup
```bash
# Worker 1: 178.128.177.88 (accounts 0-165)
# Worker 2: 167.99.164.45 (accounts 166-332) - NEW
# Worker 3: 138.68.0.124 (accounts 333-499) - NEW
```

### Verified Results (3-worker parallel test)
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
export ACCOUNT_START_INDEX=<start>  # 0, 166, or 333
export ACCOUNT_COUNT=<count>        # 166 or 167
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
