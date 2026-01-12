# Aptos Polymarket 30K TPS Stress Test Demo

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              FRONTEND (Vercel)                               │
│                        https://aptos-polymarket.vercel.app                   │
│                                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │
│  │ /polymarket  │  │  /demo-day   │  │   /market/   │  │  TPS Chart   │    │
│  │  Market List │  │  HFT Demo    │  │   Details    │  │  Trade Feed  │    │
│  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘    │
│                            │                                                 │
│                   WebSocket Connection                                       │
│                            ▼                                                 │
└─────────────────────────────────────────────────────────────────────────────┘
                             │
                             │ ws://178.128.177.88:3001
                             ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    HFT SERVERS (3 Workers - Coordinated)                    │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                   WORKER 1 (COORDINATOR)                             │   │
│  │                    178.128.177.88:3001                               │   │
│  │                       9 accounts                                     │   │
│  │                                                                       │   │
│  │   - WebSocket server (frontend connects here)                        │   │
│  │   - Receives stats from Workers 2 & 3 via HTTP POST                  │   │
│  │   - Aggregates TPS from ALL 25 accounts                              │   │
│  │   - Broadcasts combined stats to UI                                  │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                              ▲                                              │
│              HTTP POST /worker-stats (every 500ms)                          │
│                              │                                              │
│        ┌─────────────────────┴─────────────────────┐                       │
│        │                                           │                        │
│  ┌─────┴───────────────┐                 ┌────────┴──────────────┐        │
│  │    WORKER 2         │                 │      WORKER 3         │        │
│  │ 147.182.237.239:3001│                 │  161.35.231.0:3001    │        │
│  │   8 accounts        │                 │    8 accounts         │        │
│  │   (secondary)       │                 │    (secondary)        │        │
│  └─────────────────────┘                 └───────────────────────┘        │
│                                                                              │
│                    Multi-RPC Load Balancing                                 │
│                                ▼                                            │
└─────────────────────────────────────────────────────────────────────────────┘
                                 │
       ┌─────────────────────────┼─────────────────────────┐
       │                         │                         │
       ▼                         ▼                         ▼
┌─────────────────┐   ┌─────────────────┐   ┌─────────────────┐
│   QuickNode     │   │  Aptos Labs     │   │  Your Fullnode  │
│   (50 RPS)      │   │  (20-30 RPS)    │   │  (Unlimited)    │
│ polished-...    │   │ api.testnet...  │   │ aptos.cash.trading   │
└────────┬────────┘   └────────┬────────┘   └────────┬────────┘
         │                     │                     │
         └─────────────────────┴─────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        APTOS TESTNET BLOCKCHAIN                             │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                    SMART CONTRACT (V3)                                │  │
│  │   0xa2e5e47aab07fed78a3bcf95135ee2dad20c547499c94cb16a3e047859ffa7e1 │  │
│  │                                                                        │  │
│  │   ┌────────────────────────────────────────────────────────────────┐  │  │
│  │   │                  MULTI-OUTCOME MARKET                          │  │  │
│  │   │  0xfefd1b67818ee4ef12a7953852c83f0efb411a9b92c518a52ba92555e... │  │  │
│  │   │                                                                  │  │  │
│  │   │  Question: "Republican Presidential Nominee 2028"               │  │  │
│  │   │  Outcomes: [J.D. Vance, Marco Rubio, Donald Trump,             │  │  │
│  │   │            Ron DeSantis, Tucker Carlson, Other]                 │  │  │
│  │   │  TVL: ~7,000 APT                                                │  │  │
│  │   │                                                                  │  │  │
│  │   │  Features:                                                       │  │  │
│  │   │  ✓ Aggregator V2 (AIP-47) - Parallel reserve updates           │  │  │
│  │   │  ✓ Orderless Txns (AIP-123) - No sequence bottleneck           │  │  │
│  │   │  ✓ CPMM Pricing - Constant product market maker                │  │  │
│  │   └────────────────────────────────────────────────────────────────┘  │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Infrastructure

### Digital Ocean Droplets (3 Workers + 1 Fullnode)

| Worker | IP | Accounts | Role | Est. TPS |
|--------|-----|----------|------|----------|
| Worker 1 | 178.128.177.88 | 9 | **Coordinator** | ~13K |
| Worker 2 | 147.182.237.239 | 8 | Secondary | ~12K |
| Worker 3 | 161.35.231.0 | 8 | Secondary | ~12K |
| Fullnode | aptos.cash.trading | N/A | Aptos Fullnode (32GB) | - |
| **Total** | | **25** | | **~37K** |

**Worker Coordination:**
- Worker 1 is the **coordinator** - frontend connects via WebSocket here
- Workers 2 & 3 are **secondary** - report stats to Worker 1 every 500ms via HTTP POST
- TPS displayed in UI is aggregated from ALL 25 accounts across all workers

### RPC Endpoints

| Endpoint | Rate Limit | Usage |
|----------|------------|-------|
| QuickNode | 50 RPS (Build plan) | Primary for frontend |
| Aptos Labs API | 20-30 RPS | Fallback |
| Your Fullnode (aptos.cash.trading:8080) | Unlimited | HFT transactions |

```
QuickNode URL: https://polished-evocative-borough.aptos-testnet.quiknode.pro/a0b08bae2dc34e4a8774d91414948d02a5ce2975/v1
```

---

## How It Works

### 1. Frontend Connection

The frontend connects via WebSocket to the HFT server:

```typescript
// .env.local
VITE_HFT_WS_URL=ws://178.128.177.88:3001
```

The `useHFTConnection` hook:
- Receives real-time trade updates
- Batches trades every 100ms to prevent UI freeze
- Shows TPS, success rate, latency stats
- Displays live price changes

### 2. HFT Server Transaction Pipeline

**3-Stage Pipeline (Parallel Execution):**

```
Stage 1: BUILD (Parallel)          Stage 2: SIGN (Local)         Stage 3: SUBMIT (Parallel)
┌─────────────────────┐           ┌─────────────────┐          ┌─────────────────┐
│ Account 1 → RPC A   │           │ Sign with key 1 │          │ Account 1 → RPC A │
│ Account 2 → RPC B   │  ────►    │ Sign with key 2 │  ────►   │ Account 2 → RPC B │
│ Account 3 → RPC C   │           │ Sign with key 3 │          │ Account 3 → RPC C │
│ ...                 │           │ ...             │          │ ...               │
│ Account 20 → RPC A  │           │ Sign with key 20│          │ Account 20 → RPC A│
└─────────────────────┘           └─────────────────┘          └─────────────────┘
        │                                                               │
        └────────── Round-robin RPC selection ──────────────────────────┘
```

### 3. Key Optimizations for 30K TPS

| Optimization | How It Works | Impact |
|--------------|--------------|--------|
| **Orderless Transactions (AIP-123)** | Random nonces instead of sequence numbers | Eliminates sequence bottleneck |
| **Aggregator V2 (AIP-47)** | Parallel-safe reserve updates in contract | Multiple accounts update same market |
| **20 Trading Accounts** | Each submits independently | 20x parallelism |
| **Multi-RPC Load Balancing** | Round-robin across 5+ endpoints | Bypass rate limits |
| **Fire-and-Forget (95%)** | Don't wait for confirmation | Max submission speed |
| **Dedicated Fullnode** | No rate limits | Unlimited RPS |

### 4. Trade Size Distribution

Creates dramatic price swings while conserving APT:

| Probability | Size | Description |
|-------------|------|-------------|
| 0.1% | 0.5-1 APT | Whale spike |
| 0.5% | 0.2-0.5 APT | Large jump |
| 2% | 0.05-0.2 APT | Noticeable |
| 5% | 0.02-0.05 APT | Medium |
| 15% | 0.01-0.02 APT | Small |
| 77.4% | 0.001-0.01 APT | Micro |

---

## TPS Modes

The HFT server supports 5 modes with escalating TPS targets:

| Mode | Target TPS | Batch Size | Delay | Use Case |
|------|-----------|------------|-------|----------|
| 🧪 `dryrun` | ~10 | 1 | 100ms | UI testing, minimal APT |
| 🔄 `normal` | ~1,000 | 10 | 50ms | Light demo |
| ⚡ `turbo` | ~3,000 | 30 | 40ms | Medium intensity |
| 🔥 `ultra` | ~10,000 | 80 | 30ms | High intensity |
| 🚀 `quantum` | ~30,000+ | 150 | 20ms | **DEMO DAY MAX POWER** |

```bash
# Examples
npx tsx server/hft-ultra-server.ts dryrun 30    # 30 seconds at ~10 TPS
npx tsx server/hft-ultra-server.ts quantum 60   # 60 seconds at ~30K TPS
```

---

## Running the Demo

### Recommended Workflow (Standby Mode)

```bash
# Step 1: Deploy latest code to all workers
./scripts/orchestrator.sh deploy

# Step 2: Start all workers in STANDBY mode (no auto-trading)
./scripts/orchestrator.sh standby

# Step 3: Start frontend
npm run dev

# Step 4: Open browser → ARM → LAUNCH
# http://localhost:5173/demo-day
```

### Orchestrator Commands

| Command | Description |
|---------|-------------|
| `deploy` | Push latest server code to all workers |
| `standby` | Start workers in STANDBY (wait for UI ARM → LAUNCH) |
| `dryrun` | Quick 100 TPS test (5 seconds) |
| `demo [duration]` | Full 30K TPS demo (default 60 sec) |
| `status` | Check all infrastructure |
| `stop` | Stop all workers |
| `logs` | View logs from all workers |

### Quick Start (Dry Run - 5 seconds)

```bash
# Single command for quick test
./scripts/orchestrator.sh dryrun

# Or manual:
npx tsx server/hft-ultra-server.ts dryrun 5
```

### Full 30K TPS Demo (QUANTUM MODE)

```bash
# Option A: Orchestrator with standby (RECOMMENDED)
./scripts/orchestrator.sh standby
# Then ARM → LAUNCH from UI

# Option B: Auto-start demo (60 seconds)
./scripts/orchestrator.sh demo

# Option C: Custom duration
./scripts/orchestrator.sh demo 30
```

### Using the HFT Launch Control UI

1. Navigate to `/demo-day`
2. **Pre-flight checks** must all pass:
   - ✓ HFT Server Connection
   - ✓ Trading Accounts Ready (25 accounts)
   - ✓ Market Contract Active
   - ✓ Sufficient Gas Funds
3. Click **"ARM SYSTEM"**
4. Click **"LAUNCH DEMO"**
5. Watch TPS climb to 30K+

---

## Monitoring

### Key Metrics

| Metric | Target | Location |
|--------|--------|----------|
| Current TPS | 30,000+ | Demo page header |
| Peak TPS | 35,000+ | Stats grid |
| Success Rate | >95% | Stats grid |
| Avg Latency | <500ms | Stats grid |

### Check Market Status

```bash
# Get current prices
curl -s -X POST "https://fullnode.testnet.aptoslabs.com/v1/view" \
  -H "Content-Type: application/json" \
  -d '{
    "function": "0xa2e5e47aab07fed78a3bcf95135ee2dad20c547499c94cb16a3e047859ffa7e1::multi_outcome_market::get_all_prices",
    "arguments": ["0xfefd1b67818ee4ef12a7953852c83f0efb411a9b92c518a52ba92555e4abdd96"]
  }' | jq .
```

### Log Viewing

```bash
# Single worker
./scripts/dryrun-view.sh

# 3 workers (3-pane tmux)
./scripts/demo-view.sh
```

---

## Troubleshooting

| Issue | Cause | Solution |
|-------|-------|----------|
| "Rate limit exceeded" | Public API blocked | QuickNode or fullnode fixes this |
| "Mempool is full" | Too many pending txns | Server auto-backoffs |
| No trades showing | WebSocket not connected | Check VITE_HFT_WS_URL in .env.local |
| TPS < 1000 | Single worker only | Use ./scripts/run-3-workers.sh |
| "INSUFFICIENT_BALANCE" | Account out of APT | Run fund-accounts script |

---

## File Structure

```
aptos-polymarket/
├── server/
│   └── hft-ultra-server.ts     # HFT server (1,800+ lines, worker coordination)
│
├── src/
│   ├── polymarket/
│   │   ├── HFTDemoPage.tsx     # Main demo dashboard
│   │   ├── HFTLaunchControl.tsx # Launch control UI
│   │   ├── TradeFeed.tsx       # Trade stream
│   │   └── TPSChart.tsx        # TPS visualization
│   │
│   └── hooks/
│       ├── useHFTConnection.ts # WebSocket hook
│       ├── useMultiMarkets.ts  # Market data (QuickNode)
│       └── useMarkets.ts       # Binary markets
│
├── scripts/
│   ├── orchestrator.sh         # Master control script
│   ├── run-3-workers.sh        # 3-worker distributed setup
│   └── run-demo.sh             # Single worker setup
│
└── contracts/sources/
    └── multi_outcome_market.move # Smart contract (Aggregator V2)
```

---

## Key Addresses

| Component | Address |
|-----------|---------|
| **V3 Contract** | `0xa2e5e47aab07fed78a3bcf95135ee2dad20c547499c94cb16a3e047859ffa7e1` |
| **GOP 2028 Market** | `0xfefd1b67818ee4ef12a7953852c83f0efb411a9b92c518a52ba92555e4abdd96` |

---

## TPS Formula

```
TPS = Total_Accounts × Batch_Size × (1000 / Batch_Delay_Ms)

Quantum Mode (30K+ TPS):
  25 accounts × 150 batch × (1000 / 20ms) = 187,500 theoretical
  Real-world: ~30,000-40,000 TPS (mempool + network limits)

Mode Examples:
  dryrun:  25 × 1 × (1000/100)   = 250 theoretical → ~10 real
  normal:  25 × 10 × (1000/50)   = 5,000 theoretical → ~1K real
  turbo:   25 × 30 × (1000/40)   = 18,750 theoretical → ~3K real
  ultra:   25 × 80 × (1000/30)   = 66,666 theoretical → ~10K real
  quantum: 25 × 150 × (1000/20)  = 187,500 theoretical → ~30K+ real
```

---

## Summary

This demo showcases Aptos' true parallel execution capabilities:
- **25 trading accounts** across 3 cloud workers
- **5 TPS modes**: dryrun (10), normal (1K), turbo (3K), ultra (10K), quantum (30K+)
- **Orderless transactions** eliminating sequence bottlenecks
- **Aggregator V2** enabling parallel smart contract updates
- **Multi-RPC load balancing** distributing requests
- **500K APT** ready for demo day
- Real 30,000+ TPS on Aptos testnet
