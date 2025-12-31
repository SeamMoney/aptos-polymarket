# Aptos Polymarket HFT Demo Runbook

## Pre-Demo Checklist

### Infrastructure Status
- [ ] Contract deployed: `0xa2e5e47aab07fed78a3bcf95135ee2dad20c547499c94cb16a3e047859ffa7e1`
- [ ] Market active: `0xfefd1b67818ee4ef12a7953852c83f0efb411a9b92c518a52ba92555e4abdd96`
- [ ] 20 bot wallets funded (~120,800 APT total)
- [ ] QuickNode RPC configured
- [ ] Remote VMs ready (209.38.172.28, 147.182.237.239)
- [ ] Fullnode synced (164.92.117.18) - for 30k+ TPS

---

## Quick Start Commands

### Option 1: Local Only (~7,500 TPS)
```bash
cd ~/aptos-polymarket
./scripts/run-demo.sh normal 60
```

### Option 2: 3 Workers (~22,500 TPS)
```bash
cd ~/aptos-polymarket
./scripts/run-3-workers.sh normal 60
```

### Option 3: With Fullnode (~30,000+ TPS)
*Requires fullnode to be synced first*
```bash
# Update HFT server to use fullnode
# Then run 3-workers
./scripts/run-3-workers.sh normal 60
```

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
- 6 outcomes: Trump Jr, Vance, DeSantis, Haley, Ramaswamy, Other
- 5,000 APT initial liquidity (~$50,000 at current prices)

### 2. Start HFT Demo (3 min)
```bash
./scripts/run-3-workers.sh normal 60
```

**Watch for:**
- "Fired: 150 txns in Xms" messages
- TPS counter in output
- All 20 accounts trading in parallel

### 3. Show Key Metrics
- Transactions per second (TPS)
- Number of parallel accounts
- Orderless transactions (no sequence bottleneck)

### 4. Explain Technology (2 min)
**Key Innovations:**
1. **Aggregator V2 (AIP-47)** - Parallel smart contract execution
2. **Orderless Transactions (AIP-123)** - No sequence number bottleneck
3. **Fire-and-forget** - 98% of txns don't wait for confirmation
4. **Multi-RPC load balancing** - Spread load across endpoints

---

## Troubleshooting

### "Rate limit exceeded"
- Check QuickNode dashboard
- Use multiple workers from different IPs
- Switch to fullnode when synced

### Server won't start
```bash
# Kill any existing processes
pkill -f hft-ultra-server

# Check for port conflicts
lsof -i :3001
```

### Remote VM not working
```bash
# SSH and check
ssh root@209.38.172.28 "docker ps; cd /opt/aptos-hft && ls -la"

# Restart HFT on VM
ssh root@209.38.172.28 "pkill -f hft-ultra-server"
ssh root@209.38.172.28 "cd /opt/aptos-hft && ./run-hft.sh normal 60"
```

---

## Key URLs

| Resource | URL |
|----------|-----|
| Contract Explorer | `https://explorer.aptoslabs.com/account/0xa2e5e47aab07fed78a3bcf95135ee2dad20c547499c94cb16a3e047859ffa7e1?network=testnet` |
| Market Explorer | `https://explorer.aptoslabs.com/account/0xfefd1b67818ee4ef12a7953852c83f0efb411a9b92c518a52ba92555e4abdd96?network=testnet` |
| QuickNode Dashboard | `https://dashboard.quicknode.com/` |

---

## Infrastructure Summary

| Component | Details | Status |
|-----------|---------|--------|
| V3 Contract | Full Aggregator support | ✅ |
| Market | 6 outcomes, 5,000 APT | ✅ |
| Bot Wallets | 20 accounts, 120,800 APT | ✅ |
| Local Mac | Worker 1 (accounts 1-7) | ✅ |
| VM1 (209.38.172.28) | Worker 2 (accounts 8-14) | ✅ |
| VM2 (147.182.237.239) | Worker 3 (accounts 15-20) | ✅ |
| Fullnode (164.92.117.18) | Syncing... | ⏳ |

---

## TPS Expectations

| Setup | Theoretical Max | Notes |
|-------|-----------------|-------|
| Local only | ~7,500 TPS | QuickNode 50 RPS × 150 batch |
| 3 workers | ~22,500 TPS | 3 IPs × QuickNode limits |
| With Fullnode | ~30,000+ TPS | No rate limits |

---

## Post-Demo

```bash
# Stop all workers
pkill -f hft-ultra-server
./scripts/stop-remote-hft.sh

# Check market state
curl -s -X POST "https://fullnode.testnet.aptoslabs.com/v1/view" \
  -H "Content-Type: application/json" \
  -d '{
    "function": "0xa2e5e47aab07fed78a3bcf95135ee2dad20c547499c94cb16a3e047859ffa7e1::multi_outcome_market::get_all_prices",
    "type_arguments": [],
    "arguments": ["0xfefd1b67818ee4ef12a7953852c83f0efb411a9b92c518a52ba92555e4abdd96"]
  }' | jq .
```
