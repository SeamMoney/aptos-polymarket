# 500 Seed-Derived Accounts Documentation

**Generated:** January 14, 2026
**Total Accounts:** 500
**Derivation Path:** `m/44'/637'/0'/0/<index>` (BIP-44 compliant)

## Critical Information

### Mnemonic Seed Phrase
```
venture advance oval deliver profit drill chaos cabbage rapid tag south once rifle call flavor vague sword float town vault calm such grocery elder
```

> **WARNING:** Store this mnemonic securely! Anyone with this phrase can regenerate all 500 accounts and access their funds.

### Environment File
All configuration is stored in `.env.seed`. Source it before running any seed-account scripts:
```bash
source .env.seed
```

---

## Account Registry

### First 20 Accounts (Backward Compatible with ULTRA_PRIVATE_KEYS)

| Index | Address |
|-------|---------|
| 0 | `0x719094c36969fc4ea647701ced4a847b400d3189752bc65161e320272765c519` |
| 1 | `0x5559c70c63a6ed4284a85b7155ba491f74243e6184f21ec82a95315831d1b49e` |
| 2 | `0xd321f11b3956639f289a68bc80b50f108c1f0dc5df9ff619dbe48fb0a81511b9` |
| 3 | `0x62b113070fff7763ed98977769f2290a017dee0cd15ba8b9c3be738e87193d3d` |
| 4 | `0xf4ad72eb3908bee8fb8c6d74de6844ef94bfdb604315057017ccbb6481c8446f` |
| 5 | `0x7098f808ef81194f41d32a9e56db3e425d4d1e7a8069d4ffb83a08b2ed783978` |
| 6 | `0x282dcd5d8bae0949c18649a7916403ccde9e70bbb97db5c5173d96ab336e78e1` |
| 7 | `0x9392fb09efb1ed12c2a379a09c4d995b58e94a202b38d79aacf631468a403524` |
| 8 | `0xb970dac5838a10169412e9b59f9a7accf86164d939ce6164b77f8ecc0560045a` |
| 9 | `0x766b734015356e2cb1f8f4848a44ad2549e57de3e750bfe4651936f85d3e3b36` |
| 10-19 | See `.env.seed` for ULTRA_PRIVATE_KEYS |

### Worker Thread Distribution (4 workers)

| Worker | Account Range | Count | RPC Endpoint |
|--------|---------------|-------|--------------|
| 0 | 0-124 | 125 | `http://vfn0.usce1-0.testnet.aptoslabs.com:80` |
| 1 | 125-249 | 125 | `http://vfn0.usce1-0.testnet.aptoslabs.com:80` |
| 2 | 250-374 | 125 | `http://vfn0.usce1-0.testnet.aptoslabs.com:80` |
| 3 | 375-499 | 125 | `http://vfn0.usce1-0.testnet.aptoslabs.com:80` |

---

## Funding Status

### APT Funding
- **Per Account:** 2 APT
- **Total Required:** 1,000 APT
- **Funder Address:** `0x64a81cb9cbd14d45b87bb32ef73107a44f00069b6a96e70d75369fb7e3da5e68`
- **Funder Balance:** ~481,782 APT (sufficient)

### USD1 Funding
- **Per Account:** 1,000 USD1
- **Total Required:** 500,000 USD1
- **Minter Address:** `0xbdea15f5b0f5449ae8f3a6ae95a5e090bdeeec91be1fcac8375b2f5f37f1c134`
- **Mint Function:** `usd1::mint(to, amount)` (admin-only)

---

## Scripts Reference

### Account Generation
```bash
# Generate new seed (creates .env.seed)
npx tsx scripts/generate-seed-accounts.ts

# Use existing seed
SEED_MNEMONIC="..." npx tsx scripts/generate-seed-accounts.ts
```

### Account Funding
```bash
# Fund all accounts (APT + USD1)
source .env.seed
npx tsx scripts/fund-seed-accounts.ts

# Fund APT only
npx tsx scripts/fund-seed-accounts.ts --apt-only

# Fund USD1 only
npx tsx scripts/fund-seed-accounts.ts --usd1-only

# Fund subset (e.g., first 100)
npx tsx scripts/fund-seed-accounts.ts --count 100
```

### Multi-Threaded HFT Server
```bash
# Start with default 500 accounts, 4 workers
source .env.seed
npx tsx server/hft-piscina-server.ts quantum

# Start with custom settings
ACCOUNT_COUNT=500 WORKER_COUNT=8 RPC_MODE=internal npx tsx server/hft-piscina-server.ts quantum

# POST /start to begin trading
curl -X POST http://localhost:3001/start
```

### Account Auditing
```bash
# Check all seed account balances
source .env.seed
npx tsx scripts/check-seed-accounts.ts
```

---

## Configuration Options

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `SEED_MNEMONIC` | (required) | 24-word BIP-39 seed phrase |
| `ACCOUNT_COUNT` | 500 | Number of accounts to use |
| `WORKER_COUNT` | 4 | Worker threads for parallel execution |
| `RPC_MODE` | internal | `internal`, `custom`, or `balanced` |
| `USE_ORDERLESS` | true | Use orderless transactions (random nonces) |
| `MULTI_MARKETS` | (required) | Comma-separated market addresses |

### RPC Endpoints

| Mode | Endpoint | Description |
|------|----------|-------------|
| internal | `http://vfn0.usce1-0.testnet.aptoslabs.com:80` | Aptos stress testing node |
| custom | `https://aptos.cash.trading/v1` | Your fullnode |
| balanced | Both endpoints | Load balancing |

---

## Migration from 20 Accounts

### Legacy Account System (config/wallets.ts)
- **20 HFT accounts** across 3 workers
- **Keys hardcoded** in `config/wallets.ts`
- **Worker IPs hardcoded** in infrastructure config

### New Seed Account System
- **500 accounts** from single mnemonic
- **Dynamic derivation** - no hardcoding needed
- **Any worker count** - configured via env vars

### Backward Compatibility
The `.env.seed` file includes `ULTRA_PRIVATE_KEYS` with the first 20 seed accounts for scripts that haven't been updated yet.

---

## Edge Cases & Considerations

### 1. Post-Run Analytics
**Issue:** Analytics scripts scrape transactions from chain. With 500 accounts instead of 20, queries may be slower.

**Files Affected:**
- `scripts/analyze-submitted-txns.ts`
- `scripts/deep-tps-analysis.ts`
- `scripts/analyze-tps.ts`

**Solution:** These scripts filter by contract address, not sender address, so they should work unchanged.

### 2. Transaction Hash Tracking
**Issue:** `hft-ultra-server.ts` saves tx hashes to `/tmp/hft-submitted-txns.json` for post-run analysis.

**Solution:** The piscina server should aggregate tx hashes from all workers. Currently NOT implemented in worker threads.

### 3. Account Balance Recovery
**Issue:** Legacy scripts like `recover-apt.ts` have hardcoded 20-account arrays.

**Files Needing Update:**
- `scripts/recover-apt.ts` - Hardcoded 20 accounts
- `scripts/consolidate-remaining.ts` - Likely hardcoded
- `scripts/emergency-withdraw.ts` - Likely hardcoded

**Solution:** Create new seed-aware recovery scripts.

### 4. Different RPC Endpoints
**Issue:** Internal stress testing node vs custom fullnode may return different results.

**Considerations:**
- Internal node: `http://vfn0.usce1-0.testnet.aptoslabs.com:80` - No rate limits, optimized for stress testing
- Custom node: `https://aptos.cash.trading/v1` - Your infrastructure, may have different performance

**For Analytics:** Always use the same RPC endpoint for consistent results.

### 5. Sequence Number Management
**Issue:** With 500 accounts, sequence number tracking is more complex.

**Orderless Mode (USE_ORDERLESS=true):**
- Uses random nonces instead of sequence numbers
- No sequence sync needed
- Simpler at scale

**Sequence Mode (USE_ORDERLESS=false):**
- Each account maintains its own sequence
- Workers must track independently
- Sync on `SEQUENCE_NUMBER_TOO_OLD` errors

### 6. Memory Usage
**Issue:** 500 Account objects consume more memory than 20.

**Estimation:**
- Each Account object: ~2KB
- 500 accounts: ~1MB
- Per worker (125 accounts): ~250KB

**Solution:** Workers derive accounts lazily and don't share memory.

### 7. Funding Gas Costs
**Issue:** Funding 500 accounts requires 500 separate transactions for APT and 500 for USD1.

**Gas Estimation:**
- APT transfer: ~100 gas units each
- USD1 mint: ~200 gas units each
- Total: ~150,000 gas units (~15 APT at current prices)

---

## Files Inventory

### New Files (Created for 500-account support)
| File | Purpose |
|------|---------|
| `config/seed-accounts.ts` | BIP-39 derivation utilities |
| `scripts/generate-seed-accounts.ts` | Generate accounts from seed |
| `scripts/fund-seed-accounts.ts` | Parallel funding |
| `server/trading-worker.ts` | Worker thread for trading |
| `server/hft-piscina-server.ts` | Multi-threaded coordinator |
| `.env.seed` | Environment configuration |
| `docs/SEED_ACCOUNTS_500.md` | This documentation |

### Legacy Files (May need updates)
| File | Issue | Priority |
|------|-------|----------|
| `config/wallets.ts` | 20 hardcoded accounts | Medium |
| `scripts/recover-apt.ts` | 20 hardcoded accounts | High |
| `scripts/burst-500.ts` | 20 hardcoded accounts | High |
| `scripts/full-tps-test.ts` | Worker IPs hardcoded | Medium |
| `scripts/check-benchmark-accounts.ts` | 5 hardcoded accounts | Low |

---

## Recovery Procedures

### Regenerate All Accounts
If you lose the account list but have the mnemonic:
```bash
SEED_MNEMONIC="venture advance oval..." npx tsx scripts/generate-seed-accounts.ts
```

### Drain All Funds
To consolidate funds back to deployer:
```bash
source .env.seed

# Drain both APT and USD1
npx tsx scripts/drain-seed-accounts.ts

# Dry run first to see what would be drained
npx tsx scripts/drain-seed-accounts.ts --dry-run

# Drain only APT
npx tsx scripts/drain-seed-accounts.ts --apt-only

# Drain only USD1
npx tsx scripts/drain-seed-accounts.ts --usd1-only

# Drain first 100 accounts only
npx tsx scripts/drain-seed-accounts.ts --count 100
```

### Emergency Stop
To stop all trading immediately:
```bash
curl -X POST http://localhost:3001/stop
# Or kill the process
pkill -f hft-piscina-server
```

---

## Verification Checklist

Before running high-TPS benchmarks:

- [ ] `.env.seed` sourced
- [ ] All 500 accounts funded with APT (check with audit script)
- [ ] All 500 accounts funded with USD1 (check with audit script)
- [ ] Markets exist and have liquidity
- [ ] RPC endpoint accessible (`curl http://vfn0.usce1-0.testnet.aptoslabs.com:80/v1`)
- [ ] Workers initialized successfully (POST /status returns all workers ready)
