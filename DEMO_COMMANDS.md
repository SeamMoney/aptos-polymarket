# USD1 HFT Demo - Command Reference

## Quick Reference

```bash
# ONE-TIME SETUP (before first demo)
./scripts/deploy-vm-usd1-config.sh    # Deploy USD1 config to all VMs

# DEMO WITH ARM/LAUNCH UI WORKFLOW (Recommended)
./scripts/start-demo-standby.sh       # Start all workers in standby, use UI to launch

# DEMO WITH AUTO-START (No UI needed)
./scripts/run-3-workers.sh quantum 60 # Auto-start quantum mode for 60 seconds

# POST-RUN ANALYSIS
npx tsx scripts/analyze-tps.ts --minutes 5
```

---

## Full Demo Workflow (ARM/LAUNCH via UI)

This is the recommended workflow for demos where you want to control start/stop from the browser.

### Terminal 1: Start Frontend
```bash
cd /Users/maxmohammadi/aptos-polymarket
npm run dev
```
Frontend will be at: http://localhost:5173

### Terminal 2: Start Workers in Standby
```bash
cd /Users/maxmohammadi/aptos-polymarket
./scripts/start-demo-standby.sh
```

This will:
1. Stop any existing workers
2. Start VM workers (VM1, VM2, VM3) in standby mode via SSH
3. Start local worker in standby mode (foreground)
4. Wait for UI to ARM and LAUNCH

### Browser: Control the Demo
1. Open: **http://localhost:5173/demo-day**
2. Wait for "Connected" status (green indicator)
3. Click **"ARM SYSTEM"** - runs pre-flight checks
4. Click **"LAUNCH DEMO"** - starts 3-2-1 countdown
5. Watch TPS and trade stream
6. Click **"STOP DEMO"** when done

### Terminal 2: Stop Workers
Press `Ctrl+C` in the terminal running `start-demo-standby.sh`

---

## Auto-Start Demo (No UI)

Use this when you want to run a timed test without the UI.

### Option A: All 3 Workers
```bash
cd /Users/maxmohammadi/aptos-polymarket

# Quantum mode (highest TPS) for 60 seconds
./scripts/run-3-workers.sh quantum 60

# Turbo mode for 120 seconds
./scripts/run-3-workers.sh turbo 120

# Dryrun mode (low TPS, for testing)
./scripts/run-3-workers.sh dryrun 30
```

### Option B: Local Only (No VMs)
```bash
cd /Users/maxmohammadi/aptos-polymarket

# Set environment
export CONTRACT_ADDRESS=0xbdea15f5b0f5449ae8f3a6ae95a5e090bdeeec91be1fcac8375b2f5f37f1c134
export USE_USD1=true
export USD1_METADATA=0x4e977d5ee91d77d680972a44b38b9c7a2c5694439169eeae060a48324e5c4597
export MULTI_MARKETS="0x3e690f317df664c413e12b15eaa6e5565606fbd46628464f84f93e0674a3c052,0xf3256638cad294e47c8cc6bb1a6a0fdd85b29ef427b3118028c34b9f061aa50d,0x192f7cfc0c8151deec37c6280c17b55f7557a04b580b486d6076cc11955ddde3,0x9e4583c0af174a119b5316ae84988f4fd988259de35ef95447b371744a355762,0xd82731a9a2259ccfef2fd13db13720c7cc927c5b7879aa160aecc618c4d4654f,0x77a65b92664f992ccbd8a17d73a5f2fc933523ce64a1c475d1db1c0fc2acf42a,0xa84ba7b7364a40031e29d355d7a5f48fd54f922c8eed0ed0009c5d660a6da339,0x8187c1b3b7ca06dbcbac36fe280e0b5343b744c5a299a43263f9162738d4d792,0x551f153ff61f94311a22592550b0ede4b3b57338af161bd9472f21e15da23b4b,0x742e3c66cb6570351ceb7cf1b2df87e726c708b786109a8cdae93b0c3c7b5a04,0x35df09c98f8668c06f6777e98e3a0405fe894c271f06ba2fed0b322e2a5c2f16,0xd3227afa81dce5fa0e8f86f61dc7f3215ee799a0d2e6a112a988e5ac732bf719"
export ULTRA_PRIVATE_KEYS="0x6e2fca34586261b6f22a973c20024b78ddb370d87f7c974315fb97ba56716a7f,0xe61d22b3dc37c537a20d5b301c4d2b409b2f93cd7b2915f3518d49517c2ab6c4,0x4542c2e4a39beee8202eee0cddeceea886687b21b54b8f50c17e729251fdd7f5,0xcf5154af9664bbc2634fddfcce2317ed788b35de7f004ac0e24aefd68a0b10c5,0xb7d1f406e48c2eddffe987f98445dd4a353e8e9d1630d878621ded084bdd77c7,0xa8088ee787b847f6304807a8b09d1afc15409082ee9c8b7eda6919b0ecb86ea8,0xb5305eb83498dcba61242ccc91fac35263d9b44bddaf5e7417adbaceb1cfcb36"
export HFT_PORT=3001
export EXTRA_RPC_ENDPOINTS="https://aptos.cash.trading/v1"
export APTOS_API_KEY="AG-3JMDT54EN4DCLULDWAUXCYGQ56JJQCYHH"

# Run quantum mode for 60 seconds
npx tsx server/hft-ultra-server.ts quantum 60
```

---

## Post-Run Analysis

After any demo run, analyze performance with the **Deep TPS Analysis** tool:

```bash
cd /Users/maxmohammadi/aptos-polymarket

# RECOMMENDED: Deep analysis with all metrics
npx tsx scripts/deep-tps-analysis.ts

# This provides:
# - Per-second TPS curve (not just averages)
# - Latency histogram (P50, P95, P99 submission→confirmation)
# - Per-account performance breakdown
# - Per-market distribution and contention analysis
# - Block utilization (our txns vs total block capacity)
# - Failure categorization by vm_status
# - Automated bottleneck identification
# - Historical run tracking (saved to ~/.aptos-tps-history/)
```

### Analysis Output Includes:

| Metric | Description |
|--------|-------------|
| Stable TPS | Mid-run TPS excluding warmup/cooldown |
| P95 Latency | 95th percentile confirmation time |
| Confirmation Rate | % of submitted txns confirmed |
| Block Utilization | How much of each block we're filling |
| Bottlenecks | Auto-detected issues |
| Recommendations | Suggested improvements |

### Quick Analysis (Legacy)

For a simpler analysis:

```bash
# Basic analysis (fewer metrics)
npx tsx scripts/analyze-submitted-txns.ts

# Time-based block scanning (less accurate)
npx tsx scripts/analyze-tps.ts --minutes 5
```

### View Historical Runs

```bash
# List past runs
ls -la ~/.aptos-tps-history/

# View run comparison
cat ~/.aptos-tps-history/index.json
```

---

## One-Time Setup Commands

### Deploy USD1 Config to VMs
```bash
./scripts/deploy-vm-usd1-config.sh
```
This uploads the updated `run-hft.sh` with USD1 configuration to all 3 VMs.

### Check VM Status
```bash
./scripts/orchestrator.sh status
```

### View VM Logs
```bash
# All VMs
./scripts/orchestrator.sh logs

# Specific VM (all in SFO2 region)
ssh root@178.128.177.88 "tail -50 /tmp/hft-worker.log"
ssh root@167.99.164.45 "tail -50 /tmp/hft-worker.log"
ssh root@138.68.0.124 "tail -50 /tmp/hft-worker.log"
```

### Stop All Workers
```bash
./scripts/orchestrator.sh stop

# Or manually:
pkill -f hft-ultra-server
ssh root@178.128.177.88 "pkill -f hft-ultra-server"
ssh root@167.99.164.45 "pkill -f hft-ultra-server"
ssh root@138.68.0.124 "pkill -f hft-ultra-server"
```

---

## Configuration Reference

### USD1 Contract (Jan 11, 2026)
```
Contract:      0xbdea15f5b0f5449ae8f3a6ae95a5e090bdeeec91be1fcac8375b2f5f37f1c134
USD1 Metadata: 0x4e977d5ee91d77d680972a44b38b9c7a2c5694439169eeae060a48324e5c4597
```

### 12 USD1-Backed Markets
| # | Name | Address |
|---|------|---------|
| 1 | Republican 2028 | 0x3e690f317df664c413e12b15eaa6e5565606fbd46628464f84f93e0674a3c052 |
| 2 | WLFI Charter | 0xf3256638cad294e47c8cc6bb1a6a0fdd85b29ef427b3118028c34b9f061aa50d |
| 3 | Greenland | 0x192f7cfc0c8151deec37c6280c17b55f7557a04b580b486d6076cc11955ddde3 |
| 4 | Fed Chair | 0x9e4583c0af174a119b5316ae84988f4fd988259de35ef95447b371744a355762 |
| 5 | Iran Binary | 0xd82731a9a2259ccfef2fd13db13720c7cc927c5b7879aa160aecc618c4d4654f |
| 6 | China Taiwan | 0x77a65b92664f992ccbd8a17d73a5f2fc933523ce64a1c475d1db1c0fc2acf42a |
| 7 | Russia-Ukraine | 0xa84ba7b7364a40031e29d355d7a5f48fd54f922c8eed0ed0009c5d660a6da339 |
| 8 | Venezuela | 0x8187c1b3b7ca06dbcbac36fe280e0b5343b744c5a299a43263f9162738d4d792 |
| 9 | Fed Jan 2026 | 0x551f153ff61f94311a22592550b0ede4b3b57338af161bd9472f21e15da23b4b |
| 10 | BTC Q1 2026 | 0x742e3c66cb6570351ceb7cf1b2df87e726c708b786109a8cdae93b0c3c7b5a04 |
| 11 | BTC $150K | 0x35df09c98f8668c06f6777e98e3a0405fe894c271f06ba2fed0b322e2a5c2f16 |
| 12 | Iran Date | 0xd3227afa81dce5fa0e8f86f61dc7f3215ee799a0d2e6a112a988e5ac732bf719 |

### VM Workers (all in SFO2 region - Jan 28 2026)
| Worker | VM IP | Accounts | Port |
|--------|-------|----------|------|
| Worker 1 | 178.128.177.88 | 0-1666 (1667) | 3001 |
| Worker 2 | 167.99.164.45 | 1667-3333 (1667) | 3001 |
| Worker 3 | 138.68.0.124 | 3334-4999 (1666) | 3001 |

### TPS Modes
| Mode | Target TPS | Use Case |
|------|------------|----------|
| dryrun | ~10 | UI testing |
| light | ~100 | Light stress test |
| normal | ~1,000 | Medium demo |
| turbo | ~3,000 | High TPS demo |
| quantum | ~10,000+ | Maximum TPS |

---

## Troubleshooting

### Workers not connecting
```bash
# Check if server is running
curl http://localhost:3001/health

# Check VM connectivity
ssh root@178.128.177.88 "echo ok"
```

### UI shows "Disconnected"
- Make sure the HFT server is running (`start-demo-standby.sh`)
- Check browser console for WebSocket errors
- Verify `VITE_HFT_WS_URL` in frontend config

### Low TPS
- Check all workers are running: `./scripts/orchestrator.sh status`
- Verify USD1 is enabled: look for "USE_USD1: true" in server output
- Check account balances have sufficient USD1

### VM worker issues
```bash
# SSH to VM and check logs
ssh root@178.128.177.88
tail -100 /tmp/hft-worker.log

# Restart worker
pkill -f hft-ultra-server
cd /opt/aptos-hft && ./run-hft.sh quantum 60
```
