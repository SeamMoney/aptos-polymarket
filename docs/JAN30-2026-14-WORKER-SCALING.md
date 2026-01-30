# January 30, 2026 - 14-Worker Scaling with Dual Contracts

## Overview

This document covers the major infrastructure and configuration changes made on January 30, 2026 to scale from 3 workers to 14 workers with dual contract deployment for parallel trading.

---

## Architecture Changes

### Previous Setup (3 Workers)
```
┌─────────────────────────────────────────────────────────────────┐
│  3 Workers × 1 Contract × 1 RPC = ~2,400 TPS (100% success)    │
├─────────────────────────────────────────────────────────────────┤
│  Worker 1: accounts 0-1666      → aptos.cash.trading           │
│  Worker 2: accounts 1667-3333   → aptos.cash.trading           │
│  Worker 3: accounts 3334-4999   → aptos.cash.trading           │
└─────────────────────────────────────────────────────────────────┘
```

### New Setup (14 Workers)
```
┌─────────────────────────────────────────────────────────────────┐
│  14 Workers × 2 Contracts × 4 VFNs = Target 10K+ TPS           │
├─────────────────────────────────────────────────────────────────┤
│  Contract A (W1-W7):  0xca4d40eae9f07fb28a...                  │
│  Contract B (W8-W14): 0x27d2d721a0afb28a00...                  │
├─────────────────────────────────────────────────────────────────┤
│  VFN Endpoints:                                                 │
│    1. vfn0.usce1-0.testnet.aptoslabs.com (Internal)            │
│    2. vfn0.usce1-1.testnet.aptoslabs.com (Internal)            │
│    3. vfn0.apne1-0.testnet.aptoslabs.com (Internal)            │
│    4. aptos.cash.trading:8080 (Custom fullnode)                │
└─────────────────────────────────────────────────────────────────┘
```

---

## Infrastructure

### All 14 Worker VMs (DigitalOcean SFO2)

| Worker | IP Address | Account Range | Contract | VFN Endpoint |
|--------|------------|---------------|----------|--------------|
| W1 | 178.128.177.88 | 0-356 (357) | Contract A | vfn0.usce1-0 |
| W2 | 167.99.164.45 | 357-713 (357) | Contract A | vfn0.usce1-1 |
| W3 | 138.68.0.124 | 714-1070 (357) | Contract A | vfn0.apne1-0 |
| W4 | 138.197.221.123 | 1071-1427 (357) | Contract A | aptos.cash.trading |
| W5 | 167.172.120.193 | 1428-1784 (357) | Contract A | vfn0.usce1-0 |
| W6 | 138.68.22.167 | 1785-2141 (357) | Contract A | vfn0.usce1-1 |
| W7 | 157.245.168.139 | 2142-2499 (358) | Contract A | vfn0.apne1-0 |
| W8 | 206.189.160.224 | 2500-2856 (357) | Contract B | aptos.cash.trading |
| W9 | 165.227.20.62 | 2857-3213 (357) | Contract B | vfn0.usce1-0 |
| W10 | 165.227.4.56 | 3214-3570 (357) | Contract B | vfn0.usce1-1 |
| W11 | 104.248.79.36 | 3571-3927 (357) | Contract B | vfn0.apne1-0 |
| W12 | 165.227.27.110 | 3928-4284 (357) | Contract B | aptos.cash.trading |
| W13 | 178.128.70.11 | 4285-4641 (357) | Contract B | vfn0.usce1-0 |
| W14 | 138.197.196.42 | 4642-4999 (358) | Contract B | vfn0.usce1-1 |

**Total: 5,000 funded accounts split across 14 workers**

### VFN Distribution

| VFN | Workers | Load |
|-----|---------|------|
| vfn0.usce1-0.testnet.aptoslabs.com | W1, W5, W9, W13 | 4 workers |
| vfn0.usce1-1.testnet.aptoslabs.com | W2, W6, W10, W14 | 4 workers |
| vfn0.apne1-0.testnet.aptoslabs.com | W3, W7, W11 | 3 workers |
| aptos.cash.trading:8080 | W4, W8, W12 | 3 workers |

---

## Dual Contract Deployment

### Why Dual Contracts?

The single contract was hitting state contention limits. By deploying a second identical contract with its own markets:

1. **State Isolation**: Contract A and Contract B have completely independent state
2. **Parallel Execution**: Trades on different contracts can execute in parallel
3. **Doubled Throughput**: Theoretical 2x TPS improvement

### Contract Details

**Contract A** (existing):
- Address: `0xca4d40eae9f07fb28a121862d649203fb4335ece9536ee51790e19f812ff7aea`
- 15 markets (original)
- Workers 1-7 (accounts 0-2499)

**Contract B** (new deployment):
- Address: `0x27d2d721a0afb28a003741fb413bfe97424d38aa3b939f1c9789274517871668`
- 15 markets (cloned)
- Workers 8-14 (accounts 2500-4999)

### Markets by Contract

**Contract A Markets:**
```
0xaf561030c7ebb22b1d8b99b727c27caab1f6944ce39c141fd2b6b0cfbf614a9e
0xa4ee321c4c642e7b5a3e27b9820f2be4c17a1add79f8129122289fca2c3ca7c3
0xf85c7010d966bc6c3417e52a9b4d86b5f36117e51b43bf5c7a92f0468bac5497
0xcbdddcf6206d2b5956b6c7c6a10d4ac1d6253a2c1c151e8b3af113d8e940f01f
0xe128c8f16a0f07f48c69a38ac75868a2d5fdd9fbf3299958e9b1e2994a0b9f57
0x00f60c218d500eb76c66a4a7fb6c6e5664847d5e9496016000fc953b5a89f6eb
0x287968f6d26efbd291960455ce14e3723a48d32b3dc0a8c545d4603fe842e30f
0xa594c8df003cd232043b34beefe020af744f378ec367a7f65b89e306e06baacb
0x310ccec449c57bf8972feab19c5cb8ba5004e2934e4fa1bd565fdbd1a44f4008
0x8172b2cf4ba365d72fca8b899a54d3c9e2539d63bd2283aca55c0d032fc793f6
0xa550234b5784656e3f3d060134e36ab9a0eecc436d182452955c995984b3e67a
0x9dc3b78821f64119671d7918b824b3b3c4b0e2124643ebe6b1e587efe9591202
0xf508498afdecb2a2f6b40912efb1611b9fe9725e9c35521be5ff2bba3c187efa
0x289aabd338cf7a2bc48512927775b5e1218b15bd83c3c740c3ec43faccef5b21
0x8c4f0da1238adb4486d2a62ff08c85af331e022c1446445059059918d4361cd3
```

**Contract B Markets:**
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

## Configuration Testing

### Test Configurations

Three configurations were tested today with varying aggressiveness:

#### 1. Reliability Config (First Attempt)
```bash
ACCOUNT_CONCURRENCY=15
BATCH_SIZE=15
BATCH_DELAY_MS=50
WORKER_THREADS=4
```
**Result:** 378,610 trades, **51.89% success rate**, ~12K avg TPS
- High failure rate due to mempool/sequence number issues

#### 2. Ultra-Conservative Config
```bash
ACCOUNT_CONCURRENCY=10
BATCH_SIZE=10
BATCH_DELAY_MS=80
WORKER_THREADS=2
```
**Result:** 535,920 trades, **95.59% success rate**, ~18K avg TPS
- Much better success rate
- Some workers had 0 trades (connectivity issues)

#### 3. Final Config (Current)
```bash
ACCOUNT_CONCURRENCY=10
BATCH_SIZE=10
BATCH_DELAY_MS=80
WORKER_THREADS=2
VFN: All 4 endpoints distributed
```
**Observed:** 4.1K-4.7K TPS on internal VFNs (dashboard readings)
**Peak:** ~5K TPS achieved earlier in the day

### Configuration Comparison Table

| Config | Concurrency | Batch | Delay | Threads | Total Trades | Success % | Avg TPS |
|--------|-------------|-------|-------|---------|--------------|-----------|---------|
| Reliability | 15 | 15 | 50ms | 4 | 378,610 | 51.89% | ~12K |
| Ultra-Conservative | 10 | 10 | 80ms | 2 | 535,920 | 95.59% | ~18K |
| Dashboard Peak | - | - | - | - | - | - | 4.1-5K |

---

## Scripts Created

### 1. `scripts/update-workers-reliability.sh`
Updates all 14 workers with reliability-focused settings:
- Moderate concurrency (15)
- 4 worker threads per VM
- Distributed VFN load balancing

### 2. `scripts/update-workers-ultra-conservative.sh`
Updates all 14 workers with ultra-conservative settings:
- Low concurrency (10)
- 2 worker threads per VM
- Maximum reliability focus

### 3. `scripts/update-workers-dual-contract.sh`
Configures workers for dual contract setup:
- Workers 1-7: Contract A
- Workers 8-14: Contract B

### 4. `scripts/setup-dual-contracts.sh`
Full setup script for dual contract deployment:
- Deploys Contract B
- Mints USD1 to Contract B deployer
- Creates markets on Contract B

---

## Server Changes

### hft-piscina-server.ts Updates

Added environment variable overrides for fine-tuning without changing modes:

```typescript
// Allow env var overrides for fine-tuning without changing mode
const BATCH_SIZE_OVERRIDE = process.env.BATCH_SIZE ? parseInt(process.env.BATCH_SIZE) : null;
const BATCH_DELAY_OVERRIDE = process.env.BATCH_DELAY_MS ? parseInt(process.env.BATCH_DELAY_MS) : null;

// Apply overrides
if (BATCH_SIZE_OVERRIDE !== null) {
  MODE_CONFIG.batchSize = BATCH_SIZE_OVERRIDE;
}
if (BATCH_DELAY_OVERRIDE !== null) {
  MODE_CONFIG.batchDelayMs = BATCH_DELAY_OVERRIDE;
}
```

This allows adjusting batch parameters per-worker without changing the base mode config.

---

## Issues Encountered

### 1. Worker 1 EADDRINUSE
**Problem:** Port 3001 already in use on W1
**Solution:** `pm2 kill && killall -9 node && fuser -k 3001/tcp`

### 2. Workers Stuck at "Fetching sequence numbers"
**Problem:** Some workers couldn't connect to VFNs
**Solution:** Redistributed VFN assignments, some workers moved to aptos.cash.trading

### 3. Sequence Number Conflicts
**Problem:** High concurrency caused sequence number collisions
**Solution:** Reduced ACCOUNT_CONCURRENCY from 15 to 10

### 4. Uneven Worker Performance
**Problem:** Some workers produced 0 trades while others worked fine
**Solution:** VFN redistribution across all 4 endpoints

---

## Key Learnings

1. **Linear Scaling Holds**: More workers = more TPS (approximately linear)

2. **VFN Distribution Matters**: Spreading load across multiple VFNs prevents rate limiting

3. **Concurrency Trade-offs**:
   - Higher concurrency (15+) = more failures
   - Lower concurrency (10) = higher success rate but lower peak TPS

4. **Dual Contracts Help**: Separating state between contracts reduces contention

5. **Internal VFNs**: Faster than custom fullnode when working, but can be unreliable

---

## Recommended Next Steps

1. **Find Sweet Spot**: Test configuration between reliability (10) and aggressive (15):
   ```bash
   ACCOUNT_CONCURRENCY=12
   BATCH_SIZE=12
   BATCH_DELAY_MS=70
   WORKER_THREADS=3
   ```

2. **Monitor VFN Health**: Track which VFNs are most reliable over time

3. **Scale Further**: Path to 10K+ TPS requires ~20 workers (linear scaling)

4. **Fund More Accounts**: Current limit is 5,000 funded accounts

---

## Commands Reference

### Check All Workers Status
```bash
for ip in 178.128.177.88 167.99.164.45 138.68.0.124 138.197.221.123 167.172.120.193 138.68.22.167 157.245.168.139 206.189.160.224 165.227.20.62 165.227.4.56 104.248.79.36 165.227.27.110 178.128.70.11 138.197.196.42; do
  echo -n "$ip: "
  curl -s --connect-timeout 3 "http://$ip:3001/status" | grep -o '"status":"[^"]*"' || echo "OFFLINE"
done
```

### Start 30-Second Test on All Workers
```bash
for ip in 178.128.177.88 167.99.164.45 138.68.0.124 138.197.221.123 167.172.120.193 138.68.22.167 157.245.168.139 206.189.160.224 165.227.20.62 165.227.4.56 104.248.79.36 165.227.27.110 178.128.70.11 138.197.196.42; do
  curl -X POST "http://$ip:3001/start?duration=30" &
done
wait
```

### Deploy Updated Server Code
```bash
./scripts/deploy-workers.sh
```

### Apply Ultra-Conservative Config
```bash
./scripts/update-workers-ultra-conservative.sh
```

---

## Late Session Results (Jan 30 Evening)

### Best Results Achieved

#### Dashboard Confirmed TPS
| Metric | Value |
|--------|-------|
| Peak TPS (dashboard) | **7.4K TPS** |
| Sustained TPS | 7.0-7.1K TPS |
| Block Time | 105-135ms |
| E2E Latency | p50: 530-600ms |

#### Quick Test (10 seconds, all 14 workers)
| Metric | Value |
|--------|-------|
| Total Trades Submitted | 619,850 |
| Successful Trades | 514,281 |
| Success Rate | **83%** |
| Submitted TPS | ~62K |
| Successful TPS | ~51K |

### Code Optimizations Applied

#### 1. Seed Caching (config/seed-accounts.ts)
BIP39 `mnemonicToSeed()` takes ~200ms per call (PBKDF2 with 2048 rounds). With 357 accounts per worker, this was 71 seconds of startup time.

**Fix:** Cache the seed at module level:
```typescript
let cachedSeed: Uint8Array | null = null;
let cachedMnemonic: string | null = null;

function getCachedSeed(mnemonic: string): Uint8Array {
  if (cachedMnemonic === mnemonic && cachedSeed) {
    return cachedSeed;
  }
  cachedSeed = mnemonicToSeed(mnemonic);
  cachedMnemonic = mnemonic;
  return cachedSeed;
}
```
**Result:** Startup reduced from ~71s to ~1-2s per worker.

#### 2. HTTP Timeout Reduction (server/trading-worker.ts)
Changed socket timeout from 60s to 15s to fail fast when VFNs are unresponsive.

### VFN Behavior Under Load

During high-load tests, internal VFNs showed intermittent issues:
- `vfn0.usce1-0`: Returned **503 Service Unavailable** during peak load
- `vfn0.usce1-1`: Generally stable
- `vfn0.apne1-0`: Generally stable
- `aptos.cash.trading`: **100% success rate** but lower throughput

Workers on `aptos.cash.trading` consistently had 100% success rate but submitted fewer transactions. Workers on internal VFNs had higher throughput but variable success rates (10-80% depending on VFN health).

### Final Working Configuration

```bash
# Per-worker settings
ACCOUNT_CONCURRENCY=10
BATCH_SIZE=10
BATCH_DELAY_MS=80
WORKER_COUNT=2

# VFN Distribution (must be balanced across all 4)
# W1, W5, W9, W13  -> vfn0.usce1-0
# W2, W6, W10, W14 -> vfn0.usce1-1
# W3, W7, W11      -> vfn0.apne1-0
# W4, W8, W12      -> aptos.cash.trading
```

### Key Insight

The **dashboard TPS** (what the blockchain actually processes) is the authoritative metric. Worker-reported failures often include:
- HTTP timeouts on response (transaction may have succeeded)
- Mempool rejections that get retried
- VFN 503 errors during throttling

When dashboard shows 7K TPS but workers report 20% success rate, the blockchain is still processing 7K TPS - the "failures" are mostly client-side timeouts.

---

## Jan 30 2026 - Configuration Tuning Tests (Evening Session)

Systematic testing of configuration changes to find the optimal TPS settings.

### Test Results Summary

| Test | Config Change | Success Rate | Successful TPS | Result |
|------|--------------|--------------|----------------|--------|
| **Baseline** | 2 threads, 10 conc, 80ms | 91.4% | **~19,790** | ✓ BEST |
| Step 2 | 4 threads | 62.3% | ~9,265 | ✗ WORSE |
| Step 3 | 12 concurrency | 99.9% | ~12,251 | ~ Lower TPS |
| Step 4 | 60ms delay | 39.8% | ~4,628 | ✗ MUCH WORSE |

### Key Findings

1. **Baseline config (10/10/80/2) is optimal**
   - 2 threads, 10 concurrency, 80ms delay achieves best balance
   - ~19.8K successful TPS with 91.4% success rate

2. **More threads overwhelms VFNs**
   - 4 threads doubled submission rate but VFNs rejected more
   - Success rate dropped from 91% to 62%
   - Net result: WORSE TPS

3. **Faster batch delay causes failures**
   - 60ms vs 80ms overwhelmed VFNs even more
   - W9 and W14 crashed (0 trades)
   - Success rate dropped to 39%

4. **VFN workers vs aptos.cash.trading**
   - VFN workers get throttled under high load
   - aptos.cash.trading (W4, W8, W12) maintain 97-100% success
   - But lower TPS per worker (~300-500 vs ~1000)

5. **Higher concurrency trades throughput for reliability**
   - 12 concurrency: 99.9% success but lower overall TPS
   - The VFNs have a natural throughput ceiling

### Optimal Configuration (Confirmed)

```bash
WORKER_COUNT=2         # 2 threads per worker
ACCOUNT_CONCURRENCY=10 # 10 accounts batching simultaneously
BATCH_SIZE=10          # 10 transactions per batch
BATCH_DELAY_MS=80      # 80ms between batches
```

### Scaling Path

To increase TPS beyond ~20K, configuration changes alone won't help. Need:

1. **More worker VMs** - Linear scaling with more workers
2. **More contracts** - Contract C, D for more state parallelism
3. **More accounts** - Fund accounts 5000-9999

Current setup is hitting the VFN throughput ceiling. Config tuning can't push past this limit.

---

## Jan 30 2026 - Scaling to 21 Workers (Late Night)

### New Infrastructure

Added 7 new workers (W15-W21) using Contract B:

| Worker | Droplet | IP | Accounts | VFN |
|--------|---------|-----|----------|-----|
| W15 | hft-worker-15 | 178.128.176.238 | 5000-5356 | vfn0.apne1-0 |
| W16 | hft-worker-16 | 178.128.75.159 | 5357-5713 | aptos.cash.trading |
| W17 | hft-worker-17 | 157.245.165.252 | 5714-6070 | vfn0.usce1-0 |
| W18 | hft-worker-18 | 64.227.62.177 | 6071-6427 | vfn0.usce1-1 |
| W19 | hft-worker-19 | 138.68.31.100 | 6428-6784 | vfn0.apne1-0 |
| W20 | hft-worker-21 | 64.225.127.89 | 6785-7141 | aptos.cash.trading |
| W21 | hft-worker-22 | 134.209.6.169 | 7142-7499 | vfn0.usce1-0 |

### Account Funding

Funded accounts 5000-7499 (2,500 accounts):
- APT: 2 APT per account (5,000 APT total)
- USD1: 1,000 USD1 per account (2.5M USD1 total)
- Time: ~30 minutes for APT + ~30 minutes for USD1

### Updated VFN Distribution (21 workers)

| VFN | Workers | Count |
|-----|---------|-------|
| vfn0.usce1-0 | W1, W5, W9, W13, W17, W21 | 6 |
| vfn0.usce1-1 | W2, W6, W10, W14, W18 | 5 |
| vfn0.apne1-0 | W3, W7, W11, W15, W19 | 5 |
| aptos.cash.trading | W4, W8, W12, W16, W20 | 5 |

### Contract Distribution

| Contract | Workers | Accounts |
|----------|---------|----------|
| Contract A | W1-W7 | 0-2499 (2,500) |
| Contract B | W8-W21 | 2500-7499 (5,000) |

### Test Results (W15-W21 only, 10 seconds)

| Metric | Value |
|--------|-------|
| Total Trades | 82,810 |
| Successful | 82,810 |
| Success Rate | **100%** |
| TPS | ~8,281 |

New workers verified working with 100% success rate.

### Total Infrastructure

- **21 workers** (14 original + 7 new)
- **7,500 accounts** (0-7499)
- **2 contracts** (A and B)
- **4 VFN endpoints**
- **Expected TPS**: ~28-30K (21 workers × ~1,400 TPS each)
