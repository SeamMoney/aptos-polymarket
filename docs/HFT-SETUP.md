# Aptos Polymarket HFT Infrastructure

## Overview

High-frequency trading (HFT) system for the Aptos Polymarket prediction market, targeting 20,000+ TPS using distributed workers and orderless transactions.

---

## Contract & Market

| Component | Address |
|-----------|---------|
| V3 Contract | `0xa2e5e47aab07fed78a3bcf95135ee2dad20c547499c94cb16a3e047859ffa7e1` |
| Production Market | `0xfefd1b67818ee4ef12a7953852c83f0efb411a9b92c518a52ba92555e4abdd96` |

**Market Details:**
- Name: Republican Presidential Nominee 2028
- Outcomes: 6 (Trump Jr, Vance, DeSantis, Haley, Ramaswamy, Other)
- Initial Liquidity: 5,000 APT

---

## Bot Wallets

### Account Distribution

| Accounts | Balance Each | Total | Keys |
|----------|--------------|-------|------|
| 1-10 | 8,000 APT | 80,000 APT | Original (secp256k1 + ed25519) |
| 11-20 | 4,080 APT | 40,800 APT | New (ed25519) |
| **Total** | | **~120,800 APT** | 20 accounts |

### All Private Keys

See `.env.local` for the complete list of private keys.

---

## Infrastructure

### Worker Distribution

| Worker | Location | IP | Accounts | Balance |
|--------|----------|-----|----------|---------|
| Worker 1 | Your Mac | localhost | 1-7 | ~56,000 APT |
| Worker 2 | DO VM 1 | 209.38.172.28 | 8-14 | ~32,000 APT |
| Worker 3 | DO VM 2 | 147.182.237.239 | 15-20 | ~24,000 APT |

### RPC Endpoints

| Endpoint | Type | Rate Limit |
|----------|------|------------|
| QuickNode Build | Premium | 50 RPS |
| Aptos Labs Public | Free | ~30 RPS |
| Ankr | Free | 30 RPS |

---

## Scripts Reference

### Running the HFT System

```bash
# Single worker (local, all 20 accounts)
./scripts/run-demo.sh normal 60

# 3 workers combined (~22k TPS)
./scripts/run-3-workers.sh normal 60

# Check remote worker status
./scripts/check-remote-hft.sh

# Stop remote workers
./scripts/stop-remote-hft.sh
```

### On Remote VMs (SSH first)

```bash
# VM 1
ssh root@209.38.172.28
cd /opt/aptos-hft && ./run-hft.sh normal 60

# VM 2
ssh root@147.182.237.239
cd /opt/aptos-hft && ./run-hft.sh normal 60
```

---

## TPS Capacity

| Configuration | Workers | Theoretical Max TPS |
|---------------|---------|---------------------|
| Local only | 1 | ~7,500 |
| Local + 1 VM | 2 | ~15,000 |
| Local + 2 VMs | 3 | ~22,500 |
| **With Fullnode** | 1+ | **30,000+** |

### TPS Formula

```
TPS = RPS × Batch_Size × Num_Workers

Example (3 workers):
  50 RPS × 150 batch × 3 workers = 22,500 TPS
```

---

## Key Optimizations

1. **Orderless Transactions (AIP-123)** - No sequence number bottleneck
2. **Aggregator V2 (AIP-47)** - Parallel contract execution
3. **Multi-RPC Load Balancing** - Spread requests across endpoints
4. **Fire-and-Forget (98%)** - Don't wait for confirmations
5. **Large Batch Sizes (150)** - More txns per RPC call

---

## Configuration Files

| File | Purpose |
|------|---------|
| `.env.local` | All private keys and config (git-ignored) |
| `server/hft-ultra-server.ts` | Main HFT server |
| `scripts/run-demo.sh` | Local demo launcher |
| `scripts/run-3-workers.sh` | Distributed launcher |
| `scripts/setup-fullnode.sh` | Fullnode setup (for 30k+ TPS) |

---

## Fullnode Setup (For 30k+ TPS)

To eliminate rate limits entirely, run your own Aptos fullnode:

### Hardware Requirements

| Resource | Minimum |
|----------|---------|
| CPU | 8 cores |
| RAM | 32 GB |
| Storage | 300 GB SSD |

### Recommended: DigitalOcean General Purpose 32GB ($192/mo)

See `scripts/setup-fullnode.sh` for automated setup.

---

## Troubleshooting

### Rate Limit Errors
- Add more RPC endpoints to `RPC_ENDPOINTS` array
- Use multiple workers from different IPs
- Consider fullnode for unlimited TPS

### Mempool Full Errors
- Server automatically backs off with exponential delay
- Reduce `BATCH_SIZE` if persistent

### Account Balance Low
- Check balances: `aptos account list --account <address>`
- Transfer more APT to bot wallets

---

## Cost Summary

| Component | Monthly Cost |
|-----------|--------------|
| QuickNode Build | $49 |
| DO VM 1 (4GB) | ~$24 |
| DO VM 2 (4GB) | ~$24 |
| Fullnode (optional) | $192 |
| **Current Total** | **~$97** |
| **With Fullnode** | **~$289** |
