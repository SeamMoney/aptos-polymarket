# January 30, 2026 - 21-Worker Infrastructure Checkpoint

## Overview

This document captures the complete state of the 21-worker HFT infrastructure after scaling from 14 to 21 workers.

---

## Infrastructure Summary

| Resource | Count | Details |
|----------|-------|---------|
| Workers | 21 | DigitalOcean SFO2, s-4vcpu-8gb |
| Accounts | 7,500 | Funded with 2 APT + 1000 USD1 each |
| Contracts | 2 | Contract A (W1-W7), Contract B (W8-W21) |
| VFN Endpoints | 4 | 2 US, 1 Tokyo, 1 Custom |

---

## Common Configuration (All Workers)

```bash
ACCOUNT_CONCURRENCY=10    # Accounts batching simultaneously per thread
BATCH_SIZE=10             # Transactions per batch
BATCH_DELAY_MS=80         # Delay between batches
WORKER_COUNT=2            # Piscina worker threads
USE_ORDERLESS=false       # Sequential nonces (safer)
RPC_MODE=custom           # Use explicit FULLNODE_URL
PORT=3001                 # HTTP server port
```

---

## Contract Addresses

| Contract | Address | Workers |
|----------|---------|---------|
| Contract A | `0xca4d40eae9f07fb28a121862d649203fb4335ece9536ee51790e19f812ff7aea` | W1-W7 |
| Contract B | `0x27d2d721a0afb28a003741fb413bfe97424d38aa3b939f1c9789274517871668` | W8-W21 |

**USD1 Metadata:** `0x14b1ec8a5f31554d0cd19c390be83444ed519be2d7108c3e27dcbc4230c01fa3`

---

## VFN Endpoints

| VFN | URL | Workers |
|-----|-----|---------|
| US East 1-0 | `http://vfn0.usce1-0.testnet.aptoslabs.com:80/v1` | W1, W5, W9, W13, W17, W21 |
| US East 1-1 | `http://vfn0.usce1-1.testnet.aptoslabs.com:80/v1` | W2, W6, W10, W14, W18 |
| Tokyo | `http://vfn0.apne1-0.testnet.aptoslabs.com:80/v1` | W3, W7, W11, W15, W19 |
| Custom | `http://aptos.cash.trading:8080/v1` | W4, W8, W12, W16, W20 |

---

## All 21 Workers - Complete Configuration

### Contract A Workers (W1-W7)

| Worker | Droplet Name | IP Address | Account Range | Accounts | VFN |
|--------|--------------|------------|---------------|----------|-----|
| W1 | ubuntu-s-2vcpu-4gb-sfo2-01 | 178.128.177.88 | 0-356 | 357 | usce1-0 |
| W2 | hft-worker-2 | 167.99.164.45 | 357-713 | 357 | usce1-1 |
| W3 | hft-worker-3 | 138.68.0.124 | 714-1070 | 357 | apne1-0 |
| W4 | hft-worker-4 | 138.197.221.123 | 1071-1427 | 357 | custom |
| W5 | hft-worker-5 | 167.172.120.193 | 1428-1784 | 357 | usce1-0 |
| W6 | hft-worker-6 | 138.68.22.167 | 1785-2141 | 357 | usce1-1 |
| W7 | hft-worker-7 | 157.245.168.139 | 2142-2499 | 358 | apne1-0 |

**Contract A Total: 2,500 accounts (0-2499)**

### Contract B Workers - Original (W8-W14)

| Worker | Droplet Name | IP Address | Account Range | Accounts | VFN |
|--------|--------------|------------|---------------|----------|-----|
| W8 | hft-worker-8 | 206.189.160.224 | 2500-2856 | 357 | custom |
| W9 | hft-worker-9 | 165.227.20.62 | 2857-3213 | 357 | usce1-0 |
| W10 | hft-worker-10 | 165.227.4.56 | 3214-3570 | 357 | usce1-1 |
| W11 | hft-worker-11 | 104.248.79.36 | 3571-3927 | 357 | apne1-0 |
| W12 | hft-worker-12 | 165.227.27.110 | 3928-4284 | 357 | custom |
| W13 | hft-worker-13 | 178.128.70.11 | 4285-4641 | 357 | usce1-0 |
| W14 | hft-worker-20 | 138.197.196.42 | 4642-4999 | 358 | usce1-1 |

**Contract B Original: 2,500 accounts (2500-4999)**

### Contract B Workers - New (W15-W21)

| Worker | Droplet Name | IP Address | Account Range | Accounts | VFN |
|--------|--------------|------------|---------------|----------|-----|
| W15 | hft-worker-15 | 178.128.176.238 | 5000-5356 | 357 | apne1-0 |
| W16 | hft-worker-16 | 178.128.75.159 | 5357-5713 | 357 | custom |
| W17 | hft-worker-17 | 157.245.165.252 | 5714-6070 | 357 | usce1-0 |
| W18 | hft-worker-18 | 64.227.62.177 | 6071-6427 | 357 | usce1-1 |
| W19 | hft-worker-19 | 138.68.31.100 | 6428-6784 | 357 | apne1-0 |
| W20 | hft-worker-21 | 64.225.127.89 | 6785-7141 | 357 | custom |
| W21 | hft-worker-22 | 134.209.6.169 | 7142-7499 | 358 | usce1-0 |

**Contract B New: 2,500 accounts (5000-7499)**

---

## Worker IP Lists (for scripts)

### All 21 Workers
```bash
ALL_WORKERS="178.128.177.88 167.99.164.45 138.68.0.124 138.197.221.123 167.172.120.193 138.68.22.167 157.245.168.139 206.189.160.224 165.227.20.62 165.227.4.56 104.248.79.36 165.227.27.110 178.128.70.11 138.197.196.42 178.128.176.238 178.128.75.159 157.245.165.252 64.227.62.177 138.68.31.100 64.225.127.89 134.209.6.169"
```

### Original 14 Workers (W1-W14)
```bash
ORIGINAL_WORKERS="178.128.177.88 167.99.164.45 138.68.0.124 138.197.221.123 167.172.120.193 138.68.22.167 157.245.168.139 206.189.160.224 165.227.20.62 165.227.4.56 104.248.79.36 165.227.27.110 178.128.70.11 138.197.196.42"
```

### New 7 Workers (W15-W21)
```bash
NEW_WORKERS="178.128.176.238 178.128.75.159 157.245.165.252 64.227.62.177 138.68.31.100 64.225.127.89 134.209.6.169"
```

---

## Contract B Markets (15 markets)

Used by W8-W21:
```
0xc42bc8fd13829bbe4b60d1af184f89b49731a6c2af39270246c99bc7a1bdec5
0x58f1ec6a003bfa02652fc999f28869a6f68f539cb52ab050519fdc51f8914cf4
0xb0071ae6aafddc899344459db5e5ec1012c3e97067675ac988e052bc53a2f6d9
0x7ee2862500e68cce391d50719da318e7bd0c3223aa7333d7431514440d94fd47
0xe389ee67bdaffa192952ad52e2eb8eeedc0bc735ce4a3bb46379e29b9481a6c5
0x6fa05e7a940c6fe2a0f747bd23f7d6153476e3f363a2adc13f2f1d6f52a1aaea
0xc3371396a3bbb085d31c06d4fb6bd1a1f42573c598f4360c93766a0a6bb4e09b
0xafe7b43af0d99ad8537299654b36cd3033edc1d92d50ce7b3a3c1161c3b5a8d3
0x8fb8b0b32ade467f8abf1d5e89142c885e40dbe94ed2c0678e0f320fc978417f
0xa537214ba3a8d0e7a8740a2016721ba1bb174ed73c33797007343148248c11bf
0x3c58cf1cddb01d452dbbb28ba9721d02b80fb3cbe1a6062423016ef82ab27144
0xa204c76f2d1b2f03d3cde08a96193f1ec621ffcabca8ef69653a6a64b76e7f38
0x6199d1bb20d3290a0c023b2a8d5ea978baeca30108c05f20cf5a4467ba7729cb
0xb5217a1c7805e617f8c139fdcf4a2424d1bbab7dff4c7324f37ede2649c1deb6
0xa7724e3537d5448b303ed216534bd7b82c63830739c85d78fc432ea33765d721
```

---

## Test Results

### Config Tuning Tests (14 workers)

| Test | Config | Success Rate | TPS |
|------|--------|--------------|-----|
| Baseline | 2 threads, 10 conc, 80ms | 91.4% | ~19,790 |
| 4 threads | 4 threads, 10 conc, 80ms | 62.3% | ~9,265 |
| 12 concurrency | 2 threads, 12 conc, 80ms | 99.9% | ~12,251 |
| 60ms delay | 2 threads, 10 conc, 60ms | 39.8% | ~4,628 |

**Conclusion:** Baseline config (2/10/80) is optimal.

### New Worker Test (W15-W21 only)

| Metric | Value |
|--------|-------|
| Duration | 10 seconds |
| Workers | 7 (W15-W21) |
| Total Trades | 82,810 |
| Success Rate | 100% |
| Worker-Reported TPS | ~8,281 |
| Dashboard TPS | ~5,000 |

---

## Commands

### Start All 21 Workers
```bash
for ip in 178.128.177.88 167.99.164.45 138.68.0.124 138.197.221.123 167.172.120.193 138.68.22.167 157.245.168.139 206.189.160.224 165.227.20.62 165.227.4.56 104.248.79.36 165.227.27.110 178.128.70.11 138.197.196.42 178.128.176.238 178.128.75.159 157.245.165.252 64.227.62.177 138.68.31.100 64.225.127.89 134.209.6.169; do
  curl -s -X POST "http://$ip:3001/start?duration=30" &
done
wait
```

### Stop All Workers
```bash
for ip in 178.128.177.88 167.99.164.45 138.68.0.124 138.197.221.123 167.172.120.193 138.68.22.167 157.245.168.139 206.189.160.224 165.227.20.62 165.227.4.56 104.248.79.36 165.227.27.110 178.128.70.11 138.197.196.42 178.128.176.238 178.128.75.159 157.245.165.252 64.227.62.177 138.68.31.100 64.225.127.89 134.209.6.169; do
  curl -s -X POST "http://$ip:3001/stop" &
done
wait
```

### Check All Worker Status
```bash
i=1
for ip in 178.128.177.88 167.99.164.45 138.68.0.124 138.197.221.123 167.172.120.193 138.68.22.167 157.245.168.139 206.189.160.224 165.227.20.62 165.227.4.56 104.248.79.36 165.227.27.110 178.128.70.11 138.197.196.42 178.128.176.238 178.128.75.159 157.245.165.252 64.227.62.177 138.68.31.100 64.225.127.89 134.209.6.169; do
  resp=$(curl -s "http://$ip:3001/status")
  threads=$(echo "$resp" | jq -r '.workers.ready')
  accounts=$(echo "$resp" | jq -r '.accounts.total')
  echo "W$i: $threads/2 threads, $accounts accounts"
  i=$((i+1))
done
```

---

## Cost

| Resource | Count | Unit Cost | Monthly |
|----------|-------|-----------|---------|
| Original workers (W1-W14) | 14 | $48/mo | $672 |
| New workers (W15-W21) | 7 | $48/mo | $336 |
| Custom fullnode | 1 | ~$96/mo | $96 |
| **Total** | | | **~$1,104/mo** |

---

## Next Steps

1. Run full 21-worker test to measure combined TPS
2. If DigitalOcean limit increases, add W22-W28 for 28 total workers
3. Fund accounts 7500-9999 for additional capacity

---

## Checkpoint Info

- **Date:** January 30, 2026 (late night)
- **Commit:** `c0ea551`
- **Status:** All 21 workers online and verified
- **Accounts 5000-7499:** Fully funded (APT + USD1)
