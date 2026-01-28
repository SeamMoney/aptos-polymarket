# Aptos Polymarket HFT Infrastructure

## Overview

High-frequency trading (HFT) system for the Aptos Polymarket prediction market, targeting 30,000+ TPS using distributed workers with coordinated stats aggregation.

---

## Contract & Market

| Component | Address |
|-----------|---------|
| V3 Contract | `0xa2e5e47aab07fed78a3bcf95135ee2dad20c547499c94cb16a3e047859ffa7e1` |
| Production Market | `0xfefd1b67818ee4ef12a7953852c83f0efb411a9b92c518a52ba92555e4abdd96` |

**Market Details:**
- Name: Republican Presidential Nominee 2028
- Outcomes: 6 (J.D. Vance, Marco Rubio, Donald Trump, Ron DeSantis, Tucker Carlson, Other)
- Initial Liquidity: 5,000 APT

---

## Worker Architecture

### Coordinator Pattern

The HFT system uses a coordinator pattern for aggregated TPS display:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           YOUR LAPTOP                                    │
│  ┌──────────────────┐                                                   │
│  │ React Frontend   │◄──── WebSocket ────────────────────┐              │
│  │ - TPS Dashboard  │                                    │              │
│  │ - Trade Stream   │                                    │              │
│  └──────────────────┘                                    │              │
└──────────────────────────────────────────────────────────┼──────────────┘
                                                           │
┌──────────────────────────────────────────────────────────┼──────────────┐
│                         CLOUD WORKERS                    │              │
│                                                          ▼              │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                    WORKER 1 (COORDINATOR)                        │   │
│  │                     178.128.177.88:3001                          │   │
│  │                        9 accounts                                │   │
│  │                                                                   │   │
│  │  - WebSocket server (frontend connects here)                     │   │
│  │  - Receives stats from Workers 2 & 3                             │   │
│  │  - Aggregates TPS from ALL 25 accounts                           │   │
│  │  - Broadcasts combined stats to UI                               │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                              ▲                                          │
│              HTTP POST /worker-stats (every 500ms)                      │
│                              │                                          │
│        ┌─────────────────────┴─────────────────────┐                   │
│        │                                           │                    │
│  ┌─────┴───────────────┐                 ┌────────┴──────────────┐    │
│  │    WORKER 2         │                 │      WORKER 3         │    │
│  │  167.99.164.45:3001 │                 │  138.68.0.124:3001    │    │
│  │   1667 accounts     │                 │    1666 accounts      │    │
│  │   (secondary)       │                 │    (secondary)        │    │
│  └─────────────────────┘                 └───────────────────────┘    │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Worker Configuration

| Worker | IP | Port | Accounts | Role |
|--------|-----|------|----------|------|
| Worker 1 | 178.128.177.88 | 3001 | 0-1666 (1667) | **Coordinator** |
| Worker 2 | 167.99.164.45 | 3001 | 1667-3333 (1667) | Secondary |
| Worker 3 | 138.68.0.124 | 3001 | 3334-4999 (1666) | Secondary |
| **Total** | | | **5000** | |

### Environment Variables

**Coordinator (Worker 1):**
```bash
export HFT_PORT=3001
# No COORDINATOR_URL = becomes coordinator
```

**Secondary Workers (Workers 2 & 3):**
```bash
export HFT_PORT=3001
export COORDINATOR_URL="http://178.128.177.88:3001"
export WORKER_ID="worker-2"  # or "worker-3"
```

---

## Orchestrator Commands

The main orchestrator script manages all workers:

```bash
./scripts/orchestrator.sh <command> [options]
```

| Command | Description |
|---------|-------------|
| `deploy` | Push latest server code to all workers |
| `standby` | Start all workers in STANDBY mode (wait for UI) |
| `dryrun` | Quick 100 TPS test (5 seconds) |
| `demo [duration]` | Full 30K TPS demo (default 60 sec) |
| `status` | Check all infrastructure |
| `stop` | Stop all workers |
| `logs` | View logs from all workers |

### Recommended Workflow

```bash
# Step 1: Deploy latest code
./scripts/orchestrator.sh deploy

# Step 2: Start in standby mode
./scripts/orchestrator.sh standby

# Step 3: Start frontend
npm run dev

# Step 4: Open browser → ARM → LAUNCH
# http://localhost:5173/demo-day
```

---

## RPC Endpoints

| Endpoint | Rate Limit | Usage |
|----------|------------|-------|
| QuickNode | 50 RPS | Primary for frontend |
| Aptos Labs | 20-30 RPS | Fallback |
| Your Fullnode (aptos.cash.trading:8080) | Unlimited | HFT transactions |

---

## Bot Wallets

### Account Distribution

| Worker | Accounts | Balance Each | Total Balance |
|--------|----------|--------------|---------------|
| Worker 1 | 9 | ~1,400 APT | ~12,660 APT |
| Worker 2 | 8 | ~2,350 APT | ~18,800 APT |
| Worker 3 | 8 | ~11,200 APT | ~89,600 APT |
| **Total** | **25** | | **~121,060 APT** |

---

## TPS Modes

| Mode | Target TPS | Batch | Delay | Use Case |
|------|-----------|-------|-------|----------|
| `dryrun` | ~10 | 1 | 100ms | UI testing |
| `normal` | ~1,000 | 10 | 50ms | Light demo |
| `turbo` | ~3,000 | 30 | 40ms | Medium |
| `ultra` | ~10,000 | 80 | 30ms | High intensity |
| `quantum` | ~30,000+ | 150 | 20ms | **DEMO DAY** |

---

## Key Optimizations

1. **Orderless Transactions (AIP-123)** - No sequence number bottleneck
2. **Aggregator V2 (AIP-47)** - Parallel contract execution
3. **Multi-RPC Load Balancing** - Spread requests across endpoints
4. **Fire-and-Forget (98%)** - Don't wait for confirmations
5. **Large Batch Sizes (150)** - More txns per RPC call
6. **Worker Coordination** - Aggregated TPS from all 25 accounts

---

## Configuration Files

| File | Purpose |
|------|---------|
| `.env.local` | Frontend WebSocket URL |
| `server/hft-ultra-server.ts` | Main HFT server (1,800+ lines) |
| `scripts/orchestrator.sh` | Deployment and control |
| `/tmp/run-worker-*.sh` | Per-worker launch scripts |

---

## Fullnode Setup (For 30k+ TPS)

To eliminate rate limits entirely, run your own Aptos fullnode:

### Hardware Requirements

| Resource | Minimum |
|----------|---------|
| CPU | 8 cores |
| RAM | 32 GB |
| Storage | 300 GB SSD |

### Current Fullnode

- IP: aptos.cash.trading:8080
- Type: DigitalOcean General Purpose 32GB

---

## Troubleshooting

### Workers not aggregating?
```bash
# Check if Worker 1 is receiving stats
curl http://178.128.177.88:3001/aggregated-stats

# Check if secondary workers are reporting
curl http://147.182.237.239:3001/status
curl http://161.35.231.0:3001/status
```

### Rate Limit Errors
- Add more RPC endpoints to `EXTRA_RPC_ENDPOINTS`
- Use multiple workers from different IPs
- Consider fullnode for unlimited TPS

### Mempool Full Errors
- Server automatically backs off with exponential delay
- Reduce batch size if persistent

### Account Balance Low
```bash
# Check all balances
npx tsx scripts/audit-accounts.ts
```

---

## Cost Summary

| Component | Monthly Cost |
|-----------|--------------|
| QuickNode Build | $49 |
| Worker 1 (4GB) | ~$24 |
| Worker 2 (4GB) | ~$24 |
| Worker 3 (4GB) | ~$24 |
| Fullnode (32GB) | $192 |
| **Total** | **~$313** |
