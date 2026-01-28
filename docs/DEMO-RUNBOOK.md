# Aptos Polymarket HFT Demo Runbook

## Pre-Demo Checklist

Run the automated pre-flight check:
```bash
./scripts/pre-demo-checklist.sh
```

### Manual Checklist
- [ ] Contract deployed: `0xa2e5e47aab07fed78a3bcf95135ee2dad20c547499c94cb16a3e047859ffa7e1`
- [ ] Market active: `0xfefd1b67818ee4ef12a7953852c83f0efb411a9b92c518a52ba92555e4abdd96`
- [ ] 25 bot wallets funded (~121,000 APT total)
- [ ] QuickNode RPC configured
- [ ] All 3 cloud workers ready
- [ ] Fullnode synced (aptos.cash.trading)

---

## Recommended Workflow (Standby Mode)

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

---

## Orchestrator Commands

| Command | Description |
|---------|-------------|
| `deploy` | Push latest server code to all workers |
| `standby` | Start workers in STANDBY (wait for UI ARM → LAUNCH) |
| `dryrun` | Quick 100 TPS test (5 seconds) |
| `demo [duration]` | Full 30K TPS demo (default 60 sec) |
| `status` | Check all infrastructure |
| `stop` | Stop all workers |
| `logs` | View logs from all workers |

---

## Demo Script

### 1. Show the Market (2 min)
```bash
# Check market status
curl -s -X POST "https://fullnode.testnet.aptoslabs.com/v1/view" \
  -H "Content-Type: application/json" \
  -d '{
    "function": "0xa2e5e47aab07fed78a3bcf95135ee2dad20c547499c94cb16a3e047859ffa7e1::multi_outcome_market::get_all_prices",
    "type_arguments": [],
    "arguments": ["0xfefd1b67818ee4ef12a7953852c83f0efb411a9b92c518a52ba92555e4abdd96"]
  }' | jq .
```

**Talking Points:**
- "Republican Presidential Nominee 2028" prediction market
- 6 outcomes: J.D. Vance, Marco Rubio, Donald Trump, Ron DeSantis, Tucker Carlson, Other
- ~7,000 APT total value locked

### 2. Start HFT Demo (3 min)

**Option A: Standby Mode (Recommended)**
```bash
./scripts/orchestrator.sh standby
```
Then in browser: ARM → LAUNCH

**Option B: Auto-start**
```bash
./scripts/orchestrator.sh demo 60
```

**Watch for:**
- TPS climbing to 30K+ on dashboard
- All 25 accounts trading in parallel
- Worker coordination aggregating stats

### 3. Show Key Metrics
- **TPS**: 30,000+ transactions per second
- **Accounts**: 25 parallel trading accounts
- **Workers**: 3 cloud VMs coordinated
- **Success Rate**: >95%

### 4. Explain Technology (2 min)
**Key Innovations:**
1. **Aggregator V2 (AIP-47)** - Parallel smart contract execution
2. **Orderless Transactions (AIP-123)** - No sequence number bottleneck
3. **Fire-and-forget** - 98% of txns don't wait for confirmation
4. **Multi-RPC load balancing** - Spread load across endpoints
5. **Worker Coordination** - Stats aggregated from all 25 accounts

---

## Infrastructure Summary

| Component | IP | Accounts | Role |
|-----------|-----|----------|------|
| Worker 1 | 178.128.177.88 | 0-1666 (1667) | **Coordinator** |
| Worker 2 | 167.99.164.45 | 1667-3333 (1667) | Secondary |
| Worker 3 | 138.68.0.124 | 3334-4999 (1666) | Secondary |
| Fullnode | aptos.cash.trading | N/A | Aptos Fullnode |
| **Total** | | **5000** | |

**Worker Coordination:**
- Frontend connects to Worker 1 via WebSocket
- Workers 2 & 3 report stats to Worker 1 every 500ms
- Aggregated TPS displayed in UI

---

## Quick Single-Server Commands (Worker 1)

For quick demos without the full orchestrator setup, use these SSH commands:

```bash
# Standby mode (UI control via ARM → LAUNCH)
ssh root@178.128.177.88 '/opt/aptos-hft/start-standby.sh'

# Verify mode (~1 TPS, confirmed on-chain)
ssh root@178.128.177.88 '/opt/aptos-hft/start-verify.sh'

# Turbo mode (~3K TPS, 300 seconds)
ssh root@178.128.177.88 '/opt/aptos-hft/start-turbo.sh'

# Quantum mode (~30K TPS, 120 seconds)
ssh root@178.128.177.88 '/opt/aptos-hft/start-quantum.sh'

# Start trading via API (if in standby mode)
curl -X POST http://178.128.177.88:3001/start \
  -H "Content-Type: application/json" \
  -d '{"mode":"turbo","duration":300}'

# Stop trading
curl -X POST http://178.128.177.88:3001/stop
```

**Note:** Quantum mode is very aggressive and may block HTTP responses. Use Turbo mode for demos that need UI responsiveness.

---

## Troubleshooting

### Server won't start
```bash
# Check status
./scripts/orchestrator.sh status

# Kill any existing processes and restart
./scripts/orchestrator.sh stop
./scripts/orchestrator.sh standby
```

### TPS lower than expected
```bash
# Check if all workers are reporting
curl http://178.128.177.88:3001/aggregated-stats

# Check individual workers (all in SFO2 region)
curl http://167.99.164.45:3001/status
curl http://138.68.0.124:3001/status
```

### Workers not aggregating
- Check COORDINATOR_URL is set on Workers 2 & 3
- Check Worker 1 is receiving POST requests on /worker-stats
- Verify all workers have latest code: `./scripts/orchestrator.sh deploy`

### "Rate limit exceeded"
- Check QuickNode dashboard
- Workers should auto-fallback to fullnode
- Switch to fullnode-only mode if needed

---

## Key URLs

| Resource | URL |
|----------|-----|
| Demo Dashboard | http://localhost:5173/demo-day |
| HFT Demo (Alt) | http://localhost:5173/polymarket/hft-demo |
| Market Page | http://localhost:5173/polymarket |
| Outcome Detail | http://localhost:5173/outcome/{marketId}/{outcomeId} |
| Contract Explorer | https://explorer.aptoslabs.com/account/0xa2e5e47aab07fed78a3bcf95135ee2dad20c547499c94cb16a3e047859ffa7e1?network=testnet |
| Market Explorer | https://explorer.aptoslabs.com/account/0xfefd1b67818ee4ef12a7953852c83f0efb411a9b92c518a52ba92555e4abdd96?network=testnet |

---

## TPS Expectations

| Setup | Theoretical Max | Notes |
|-------|-----------------|-------|
| Single worker | ~13K TPS | 9 accounts × 150 batch |
| All 3 workers | ~37K TPS | 25 accounts coordinated |
| With Fullnode | ~30K+ TPS | No rate limits |

---

## Post-Demo

```bash
# Stop all workers
./scripts/orchestrator.sh stop

# Check market state
curl -s -X POST "https://fullnode.testnet.aptoslabs.com/v1/view" \
  -H "Content-Type: application/json" \
  -d '{
    "function": "0xa2e5e47aab07fed78a3bcf95135ee2dad20c547499c94cb16a3e047859ffa7e1::multi_outcome_market::get_all_prices",
    "type_arguments": [],
    "arguments": ["0xfefd1b67818ee4ef12a7953852c83f0efb411a9b92c518a52ba92555e4abdd96"]
  }' | jq .
```

---

## Log Viewing

```bash
# Single worker view
./scripts/dryrun-view.sh

# 3-worker view (3-pane tmux)
./scripts/demo-view.sh

# Raw logs from orchestrator
./scripts/orchestrator.sh logs
```
