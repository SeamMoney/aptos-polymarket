# Migration Checklist: 20 to 500 Accounts

This document tracks all files that need updating to support 500 seed-derived accounts.

## Legend
- [x] Completed
- [ ] Pending
- [~] Partially done / needs review

---

## New Files Created (Complete)

- [x] `config/seed-accounts.ts` - BIP-39 derivation utilities
- [x] `scripts/generate-seed-accounts.ts` - Generate accounts from seed
- [x] `scripts/fund-seed-accounts.ts` - Parallel funding
- [x] `scripts/check-seed-accounts.ts` - Balance auditing
- [x] `scripts/drain-seed-accounts.ts` - Fund consolidation
- [x] `server/trading-worker.ts` - Worker thread code
- [x] `server/hft-piscina-server.ts` - Multi-threaded coordinator
- [x] `.env.seed` - Environment configuration
- [x] `docs/SEED_ACCOUNTS_500.md` - Full documentation

---

## Critical Files (Must Update)

### 1. `config/wallets.ts`
**Issue:** 20 hardcoded HFT account keys
**Lines:** 26-52

**Current:**
```typescript
hftAccounts: [
  // Worker 1: accounts 1-7
  { key: "0x6e2fca...", worker: 1 },
  // ... 20 accounts total
]
```

**Action Required:**
- [ ] Add function to load accounts from seed mnemonic
- [ ] Keep legacy keys for backward compatibility
- [ ] Add helper: `getSeedAccounts(mnemonic, count)`

---

### 2. `scripts/recover-apt.ts`
**Issue:** Hardcoded 20 TRADING_ACCOUNT keys
**Lines:** 14-35

**Current:**
```typescript
const TRADING_ACCOUNTS = [
  // 20 hardcoded keys
];
```

**Action Required:**
- [ ] Replace with `deriveAccounts()` from seed-accounts
- [ ] Add SEED_MNEMONIC env var support
- [ ] Keep --legacy flag for old accounts

---

### 3. `scripts/burst-500.ts`
**Issue:** Hardcoded 20 accounts across 3 workers
**Lines:** 30-54

**Current:**
```typescript
// Worker 1 (7 accounts)
// Worker 2 (7 accounts)
// Worker 3 (6 accounts)
const ALL_KEYS = [20 keys];
```

**Action Required:**
- [ ] Use SEED_MNEMONIC + deriveAccounts()
- [ ] Calculate per-worker distribution dynamically
- [ ] Update TARGET_TOTAL calculation

---

### 4. `scripts/full-tps-test.ts`
**Issue:** Hardcoded worker IPs and account distribution
**Lines:** 30-34, 58-62

**Current:**
```typescript
const WORKERS = [
  { host: 'root@178.128.177.88', accounts: 7 },
  { host: 'root@147.182.237.239', accounts: 7 },
  { host: 'root@161.35.231.0', accounts: 6 },
];
```

**Action Required:**
- [ ] Move worker config to environment variables
- [ ] Support dynamic worker count
- [ ] Support seed-based account distribution

---

### 5. `scripts/check-benchmark-accounts.ts`
**Issue:** Only checks 5 hardcoded test accounts
**Lines:** 6-12

**Action Required:**
- [ ] Replace with seed-based account checking
- [ ] Reuse check-seed-accounts.ts logic

---

### 6. `scripts/check-benchmark-txns.ts`
**Issue:** Only checks 2 hardcoded accounts
**Lines:** 6-9

**Action Required:**
- [ ] Replace with seed-based iteration
- [ ] Add --count flag for flexibility

---

## High Priority Files (Should Update)

### 7. `scripts/parallel-burst.ts`
**Issue:** 20 fallback keys, different RPC URL
**Lines:** 22-43, 52

**Action Required:**
- [ ] Replace fallback keys with seed derivation
- [ ] Standardize RPC URL to env var

---

### 8. `scripts/consolidate-remaining.ts`
**Status:** Need to review for hardcoded accounts

---

### 9. `scripts/emergency-withdraw.ts`
**Status:** Need to review for hardcoded accounts

---

### 10. `scripts/emergency-withdraw-all.ts`
**Status:** Need to review for hardcoded accounts

---

### 11. `scripts/audit-accounts.ts`
**Status:** Need to review for hardcoded accounts

---

### 12. `scripts/mega-burst.ts`
**Status:** Need to review for hardcoded accounts

---

## Medium Priority Files (RPC Endpoint Updates)

### 13. `scripts/analyze-submitted-txns.ts`
**Issue:** Hardcoded FULLNODE_URL
**Line:** 18

**Action:**
- [ ] Change to `process.env.FULLNODE_URL || default`

---

### 14. `scripts/deep-tps-analysis.ts`
**Issue:** Hardcoded FULLNODE_URL
**Line:** 24

**Action:**
- [ ] Change to `process.env.FULLNODE_URL || default`

---

### 15. `scripts/analyze-tps.ts`
**Issue:** Hardcoded FULLNODE_URL
**Lines:** 22-23

**Action:**
- [ ] Change to `process.env.FULLNODE_URL || default`

---

## Already Good (No Changes Needed)

- [x] `server/hft-ultra-server.ts` - Uses env vars, dynamic account loading
- [x] `server/hft-piscina-server.ts` - Built for 500 accounts
- [x] `server/trading-worker.ts` - Dynamic account support
- [x] `config/seed-accounts.ts` - Core derivation utilities
- [x] `scripts/generate-seed-accounts.ts` - Dynamic count
- [x] `scripts/fund-seed-accounts.ts` - Dynamic count
- [x] `scripts/check-seed-accounts.ts` - Dynamic count
- [x] `scripts/drain-seed-accounts.ts` - Dynamic count

---

## Post-Migration Verification

After updating files, run these tests:

1. **Account Check:**
   ```bash
   source .env.seed && npx tsx scripts/check-seed-accounts.ts --summary
   ```

2. **Small Scale Test:**
   ```bash
   ACCOUNT_COUNT=20 npx tsx server/hft-piscina-server.ts dryrun
   ```

3. **Full Scale Test:**
   ```bash
   npx tsx server/hft-piscina-server.ts quantum
   ```

4. **Analytics Verification:**
   ```bash
   npx tsx scripts/analyze-submitted-txns.ts
   ```

---

## Environment Variable Reference

### New Variables (500-account system)
```bash
SEED_MNEMONIC="..."        # 24-word BIP-39 phrase
ACCOUNT_COUNT=500          # Total accounts
WORKER_COUNT=4             # Worker threads
RPC_MODE=internal          # internal|custom|balanced
```

### Legacy Variables (still supported)
```bash
ULTRA_PRIVATE_KEYS="..."   # First 20 seed accounts (backward compat)
APTOS_PRIVATE_KEY="..."    # Single account mode
```

---

## Notes

1. **Backward Compatibility:** The `.env.seed` file includes `ULTRA_PRIVATE_KEYS` with the first 20 seed-derived accounts, so scripts using this variable will continue to work.

2. **Migration Strategy:** Update critical scripts first (recovery, burst), then high-priority (drain, audit), then medium-priority (analytics).

3. **Testing:** Always test with `--dry-run` or `--count 10` first before running on full 500 accounts.
