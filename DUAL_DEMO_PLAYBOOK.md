# Dual Demo Playbook

**Last Audit: Jan 27, 2026**

---

## Quick Start (One Command)

```bash
./scripts/demo.sh full 60 --dual
```

This runs everything automatically: preflight → standby → launch → collect → analyze

---

## Pre-Demo Audit Summary

### Infrastructure Status

| Component | Status | Details |
|-----------|--------|---------|
| Worker 1 | ✓ Online | 178.128.177.88 (SFO2) |
| Worker 2 | ✓ Online | 167.99.164.45 (SFO2) |
| Worker 3 | ✓ Online | 138.68.0.124 (SFO2) |
| Internal VFN | ✓ Online | vfn0.usce1-0.testnet.aptoslabs.com:80/v1 |
| Custom RPC | ✓ Online | aptos.cash.trading/v1 |

### Account Funding (2000 Accounts)

| Metric | Value | Status |
|--------|-------|--------|
| APT Funded (≥0.5 APT) | 2000/2000 | ✓ 100% |
| USD1 Funded (≥50 USD1) | 1999/2000 | ✓ 99.95% |
| Total APT | 3,960 APT | ✓ Sufficient |
| Total USD1 | 1,989,635 USD1 | ✓ Sufficient |
| Min APT Balance | 1.34 APT | ✓ OK |
| Gas Budget (60s @ 5K TPS) | ~60 APT needed | ✓ 66x margin |

### Markets (15 Active)

| # | Market | TVL (USD1) |
|---|--------|------------|
| 1 | WLFI OCC banking charter 2026 | 3,179.93 |
| 2 | Trump acquire Greenland | 1,865.10 |
| 3 | Trump Fed Chair nominee | 1,881.48 |
| 4 | Iran Supreme Leader | 16,448.95 |
| 5 | China invade Taiwan 2026 | 4,125.49 |
| 6 | Russia-Ukraine ceasefire Q2 2026 | 1,225.73 |
| 7 | Venezuela leadership | 1,126.94 |
| 8 | Fed rate decision Jan 2026 | 1,245.03 |
| 9 | Bitcoin price Q1 2026 | 1,352.76 |
| 10 | Bitcoin $150K before 2027 | 1,063.49 |
| 11 | BTC above $100K Feb 2026 | 5,215.83 |
| 12 | Trump Insurrection Act 2026 | 1,062.63 |
| 13 | Nov 2026 midterms | 1,124.34 |
| 14 | Trump third term announcement | 1,064.03 |
| 15 | GOP Presidential Nominee 2028 | 31,578.01 |
| **Total** | | **72,559.74** |

---

## Configuration

### Critical Settings

```bash
USE_ORDERLESS=false      # CRITICAL - true causes ~50% failures
ACCOUNT_COUNT=2000       # Total accounts
RPC_MODE=internal        # Use internal VFN for best TPS
```

### Contract Addresses

```bash
CONTRACT_ADDRESS=0xca4d40eae9f07fb28a121862d649203fb4335ece9536ee51790e19f812ff7aea
USD1_METADATA=0x14b1ec8a5f31554d0cd19c390be83444ed519be2d7108c3e27dcbc4230c01fa3
```

---

## Demo Workflow

### Option 1: Full Automated (Recommended)

```bash
./scripts/demo.sh full 60 --dual
```

What happens:
1. Pre-flight check (validates accounts, RPC, contracts)
2. SSH to all 3 workers and start servers
3. Verify workers ready
4. 5-second countdown
5. Launch 60-second demo
6. Collect transaction hashes from all workers
7. Run post-run analysis

### Option 2: Step-by-Step

```bash
# 1. Pre-flight check
./scripts/demo.sh preflight --dual

# 2. Start workers (SSHs automatically)
./scripts/demo.sh standby --dual

# 3. Verify workers are ready
./scripts/demo.sh status

# 4. Launch demo
./scripts/demo.sh launch 60 --dual

# 5. Collect results
./scripts/demo.sh collect

# 6. Analyze
./scripts/demo.sh analyze
```

---

## Expected Results

| Mode | Accounts | Expected TPS | Notes |
|------|----------|--------------|-------|
| Turbo | 500 | 3,000-3,500 | Reliable |
| Max2k | 2000 | 5,000-8,000 | Peak performance |
| Dual | 1500+500 | 6,000-10,000 | AMM + Transfers |

---

## Troubleshooting

### High failure rate (>30%)

```bash
# Ensure correct settings
export USE_ORDERLESS=false
export ACCOUNT_COUNT=1000  # Reduce if needed
```

### Workers not responding

```bash
# Check status
./scripts/demo.sh status

# View logs
./scripts/demo.sh logs

# Restart workers
./scripts/demo.sh stop
./scripts/demo.sh standby --dual
```

### RPC errors

```bash
# Check RPC health
curl -s http://vfn0.usce1-0.testnet.aptoslabs.com:80/v1 | jq .chain_id

# Fallback to custom
export RPC_MODE=custom
```

---

## Post-Demo

Results are saved to `results/` directory:
- Transaction hashes
- TPS metrics
- Success/failure rates
- Detailed analysis

Run analysis anytime:
```bash
./scripts/demo.sh analyze
```

---

## Emergency Stop

```bash
./scripts/demo.sh stop
```

This SSHs to all workers and kills all running servers.
