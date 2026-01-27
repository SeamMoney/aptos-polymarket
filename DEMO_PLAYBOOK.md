# Demo Playbook: 2000 Account High-TPS Demo

## Quick Reference

```bash
# One-liner for experienced users
./scripts/demo.sh preflight --dual && ./scripts/demo.sh standby --dual && sleep 30 && ./scripts/demo.sh launch 60 --dual
```

---

## Pre-Demo Setup (Day Before)

### 1. Fund Accounts (if needed)
```bash
# Check if accounts need funding
source .env.seed
SEED_MNEMONIC="$SEED_MNEMONIC" npx tsx scripts/pre-flight-2000.ts --dual

# Fund APT (for gas)
SEED_MNEMONIC="$SEED_MNEMONIC" npx tsx scripts/fund-seed-accounts.ts --apt-only --count 2000

# Fund USD1 (for trading)
SEED_MNEMONIC="$SEED_MNEMONIC" npx tsx scripts/fund-seed-accounts.ts --usd1-only --count 2000
```

### 2. Deploy Code to Workers
```bash
./scripts/demo.sh deploy
```

### 3. Verify Workers are Accessible
```bash
./scripts/demo.sh status
```

---

## Demo Day Workflow

### Step 1: Pre-flight Check (2 minutes)
```bash
source .env.seed
./scripts/demo.sh preflight --dual
```

**Expected output:**
- All 2000 accounts funded ✓
- RPC endpoints healthy ✓
- Contract deployed ✓
- Markets active ✓
- Gas budget sufficient ✓

**If preflight fails:** Fix the reported issues before proceeding.

---

### Step 2: Start Workers in Standby (1 minute)
```bash
./scripts/demo.sh standby --dual
```

**What happens:**
- Connects to 3 cloud workers via SSH
- Starts AMM trading servers (500 accounts each = 1500 total)
- Starts Transfer servers (167 accounts each = 500 total)
- Workers initialize accounts and wait for trigger

**Verify workers started:**
```bash
./scripts/demo.sh status
```

**Expected:** All 6 servers (3 AMM + 3 Transfer) show "Running"

---

### Step 3: Open Dashboard (optional)
```bash
# In separate terminal
npm run dev

# Open http://localhost:5173/demo-day
```

---

### Step 4: Launch Demo (60 seconds)
```bash
./scripts/demo.sh launch 60 --dual
```

**What happens:**
- Triggers all 6 servers simultaneously
- AMM servers: Buy/sell outcome tokens on 15 markets
- Transfer servers: USD1 transfers between accounts
- Real-time TPS displayed in terminal

**During demo - watch for:**
- Peak TPS (target: 5,000-8,000)
- Success rate (target: >75%)
- No "mempool full" errors sustained

---

### Step 5: Stop Demo
Demo auto-stops after duration. To stop early:
```bash
./scripts/demo.sh stop
```

---

### Step 6: Collect Results
```bash
./scripts/demo.sh collect
```

**What happens:**
- SCPs transaction hashes from all 3 workers
- Merges into timestamped results directory
- Output: `results/YYYYMMDD-HHMMSS/`

---

### Step 7: Run Analysis
```bash
./scripts/demo.sh analyze
```

**Or for detailed analysis:**
```bash
# Block-based TPS (ground truth)
npx tsx scripts/analyze-tps.ts --minutes 5

# Transaction hash verification
npx tsx scripts/analyze-submitted-txns.ts results/latest/all-amm.json

# Deep analysis
npx tsx scripts/deep-tps-analysis.ts --minutes 5
```

---

## Troubleshooting

### Workers won't start
```bash
# Check SSH connectivity
ssh root@178.128.177.88 "echo OK"
ssh root@147.182.237.239 "echo OK"
ssh root@161.35.231.0 "echo OK"

# Redeploy code
./scripts/demo.sh deploy
```

### Low TPS (<1000)
```bash
# Check mempool status - switch to turbo mode
# Edit demo.sh: DEFAULT_MODE="turbo" instead of "quantum"

# Or reduce batch size
export BATCH_SIZE=20
```

### High failure rate (>30%)
```bash
# Likely the balanced trading bug (selling tokens not owned)
# Ensure USE_ORDERLESS=false (true causes ~50% nonce failures)
export USE_ORDERLESS=false

# Or reduce concurrent accounts
export ACCOUNT_COUNT=1000
```

### RPC errors
```bash
# Check RPC health
curl -s http://vfn0.usce1-0.testnet.aptoslabs.com:80/v1 | jq .chain_id

# Fallback to custom fullnode
export RPC_MODE=custom
```

---

## Demo Modes

| Mode | Batch | Delay | Target TPS | Use Case |
|------|-------|-------|------------|----------|
| `turbo` | 30 | 40ms | 3,000 | **Safe for demos** |
| `quantum` | 50 | 20ms | 5,000 | High throughput |
| `max2k` | 25 | 30ms | 8,000 | 2000 accounts optimized |

To change mode, edit `scripts/demo.sh` line 69:
```bash
DEFAULT_MODE="max2k"  # or "turbo" for safety
```

---

## Key Numbers to Remember

| Metric | Target | Acceptable |
|--------|--------|------------|
| Peak TPS | 5,000+ | 3,000+ |
| Avg TPS | 2,000+ | 1,000+ |
| Success Rate | 80%+ | 70%+ |
| Accounts | 2,000 | 1,500+ |
| Demo Duration | 60s | 30-120s |

---

## Post-Demo Talking Points

1. **TPS Achievement**: "We demonstrated X,000 TPS on Aptos testnet"
2. **Parallelization**: "Each market outcome trades independently thanks to Aptos Block-STM"
3. **Complete Sets Model**: "1 USD1 = 1 of each outcome token, prices always sum to 100%"
4. **Infrastructure**: "3 distributed workers, 2000 accounts, optimized HTTP connections"

---

## Emergency Fallback

If demo fails completely:
```bash
# Quick recovery - single server, fewer accounts
SEED_MNEMONIC="..." \
ACCOUNT_COUNT=500 \
npx tsx server/hft-piscina-server.ts turbo &

# Trigger
curl -X POST "http://localhost:3001/start?duration=30"
```

---

## Files Reference

| File | Purpose |
|------|---------|
| `.env.seed` | SEED_MNEMONIC and config |
| `scripts/demo.sh` | Main orchestrator |
| `scripts/pre-flight-2000.ts` | Pre-flight validation |
| `scripts/auto-analyze.ts` | Post-run analysis |
| `server/hft-piscina-server.ts` | AMM trading server |
| `server/transfer-tps-server.ts` | Transfer server |
| `results/` | Collected demo results |
