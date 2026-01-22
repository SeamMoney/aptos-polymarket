# Aptos Polymarket Scripts Guide

Comprehensive guide to all scripts in this repository. Last audited: **January 21, 2026**.

---

## Quick Reference: What to Use

| Task | Script | Command |
|------|--------|---------|
| **Run TPS demo** | `run-usd1-tps-demo.ts` | `npx tsx scripts/run-usd1-tps-demo.ts turbo` |
| **Run market trading demo** | `orchestrator.sh` | `./scripts/orchestrator.sh demo` |
| **Run dual demo (AMM + transfers)** | `dual-demo.sh` | `./scripts/dual-demo.sh 60` |
| **Pre-flight check** | `pre-demo-checklist.sh` | `./scripts/pre-demo-checklist.sh` |
| **Verify TPS results** | `analyze-tps.ts` | `npx tsx scripts/analyze-tps.ts` |
| **Fund 500 accounts** | `fund-seed-accounts.ts` | `npx tsx scripts/fund-seed-accounts.ts` |
| **Generate accounts** | `generate-seed-accounts.ts` | `npx tsx scripts/generate-seed-accounts.ts` |
| **Create markets** | `create-demo-markets.ts` | `npx tsx scripts/create-demo-markets.ts` |
| **Resume verification** | `ralphy-resume.ts` | `npx tsx scripts/ralphy-resume.ts --latest` |

---

## Evolution Timeline

### Phase 1: Initial HFT (Dec 30, 2025)
- Single-account HFT bots
- ~100 TPS max
- Scripts: `hft-bot.ts`, `hft-turbo.ts` (now in `legacy/hft/`)

### Phase 2: Multi-Worker (Dec 31 - Jan 2, 2026)
- 3-worker distributed architecture
- ~1K TPS achieved
- Scripts: `orchestrator.sh` created

### Phase 3: Batch Submission (Jan 8-11, 2026)
- Attempted `/transactions/batch` endpoint
- **FAILED** - BCS encoding errors
- Scripts: `flood-test.ts` (now in `legacy/trading/`)

### Phase 4: USD1 Integration (Jan 12, 2026)
- Custom collateral token to avoid APT contention
- ~1K TPS sustained
- Scripts: `deep-tps-analysis.ts`, `fund-usd1-accounts.ts`

### Phase 5: Data Structure Optimization (Jan 13, 2026)
- Table instead of SmartTable
- Aggregator_v2 for numeric state
- ~2K TPS achieved
- Scripts: `benchmark-variants.ts`, `benchmark-tps-max.ts`

### Phase 6: 500-Account System (Jan 14, 2026)
- Seed-based account derivation
- Piscina worker threads
- ~2.5K TPS achieved
- Scripts: `generate-seed-accounts.ts`, `fund-seed-accounts.ts`

### Phase 7: AMM-Fixed Contract (Jan 16, 2026)
- Per-outcome `base_reserve` (parallel state updates)
- **3,180 TPS achieved**
- Scripts: `tps-test-new-contract.ts`

### Phase 8: Token Transfer TPS (Jan 18-21, 2026)
- Pure FA transfers (no AMM logic)
- **16K+ TPS target**
- Scripts: `run-usd1-tps-demo.ts`, `transfer-tps-server.ts`

---

## Script Categories

### A. TPS Testing & Benchmarking

#### Primary Scripts (USE THESE)

| Script | Purpose | Modes |
|--------|---------|-------|
| `run-usd1-tps-demo.ts` | Master TPS demo with full lifecycle | dryrun, reliable, light, proven, turbo, quantum, hyper |
| `analyze-tps.ts` | Post-run on-chain TPS verification | Queries blocks directly |
| `analyze-submitted-txns.ts` | Transaction-level verification | Per-hash lookup |
| `deep-tps-analysis.ts` | Advanced analytics | Latency, per-second curves |

#### Configuration Modes

| Mode | Accounts | Workers | Batch | Target TPS |
|------|----------|---------|-------|------------|
| dryrun | 10 | 1 | 1 | 10 |
| reliable | 100 | 4 | 1 | 500 |
| light | 200 | 4 | 5 | 2,000 |
| proven | 500 | 4 | 30 | 3,180 (verified) |
| turbo | 500 | 4 | 20 | 5,000 |
| quantum | 1000 | 8 | 20 | 10,000 |
| hyper | 2000 | 16 | 20 | 16,000 |

### B. Account Management

| Script | Purpose | When to Use |
|--------|---------|-------------|
| `generate-seed-accounts.ts` | Derive N accounts from mnemonic | Initial setup |
| `fund-seed-accounts.ts` | Fund accounts with APT + USD1 | Before demos |
| `check-seed-accounts.ts` | Verify balances | Pre-flight |
| `drain-seed-accounts.ts` | Withdraw all funds | Cleanup |
| `fast-fund-usd1.ts` | Rapid parallel USD1 funding | Quick refill |
| `mint-usd1-to-deployer.ts` | Mint USD1 to primary account | When low on USD1 |

### C. Market Management

| Script | Purpose |
|--------|---------|
| `create-demo-markets.ts` | Create 10 Polymarket-style markets |
| `align-prices.ts` | Align with real Polymarket odds |
| `align-new-markets.ts` | Auto-align newly created markets |
| `create-aligned-markets.ts` | Create + align in one step |
| `move-prices.ts` | Manual price manipulation (CAUTION) |

### D. Infrastructure & Orchestration

| Script | Purpose | Usage |
|--------|---------|-------|
| `orchestrator.sh` | Master 3-worker controller | `./scripts/orchestrator.sh [standby\|demo\|dryrun\|status\|stop]` |
| `dual-demo.sh` | Run AMM + USD1 transfers simultaneously | `./scripts/dual-demo.sh 60` |
| `pre-demo-checklist.sh` | Full infrastructure validation | **Run before every demo** |
| `demo-morning.sh` | Morning startup workflow | Two-key activation |
| `transfer-preflight.sh` | Transfer demo pre-flight | Quick checks |

### E. Analytics & Verification

| Script | Purpose | Output |
|--------|---------|--------|
| `analyze-tps.ts` | Block-by-block TPS | CSV, ground truth |
| `analyze-submitted-txns.ts` | Hash verification | Per-txn status |
| `deep-tps-analysis.ts` | Full analytics suite | JSON report |
| `analyze-peak-blocks.ts` | Find peak trading blocks | Block IDs |
| `benchmark-geomi.ts` | Indexer performance | Query latency |

### F. Ralphy Verification System (NEW)

| Script | Purpose |
|--------|---------|
| `ralphy-resume.ts` | Resume interrupted verification |
| `lib/ralphy-collector.ts` | Disk-stream transaction hashes |
| `lib/ralphy-verifier.ts` | Multi-pass verification loop |
| `lib/ralphy-analytics.ts` | Comprehensive analytics |

Usage:
```bash
# List all demo runs
npx tsx scripts/ralphy-resume.ts --list

# Resume latest demo
npx tsx scripts/ralphy-resume.ts --latest

# Generate analytics only
npx tsx scripts/ralphy-resume.ts --latest --analytics
```

---

## Server Implementations

| Server | Architecture | Accounts | Peak TPS | Use Case |
|--------|-------------|----------|----------|----------|
| `hft-piscina-server.ts` | Worker threads | 500 | **3,180** | Market trading |
| `transfer-tps-server.ts` | Worker threads | 2000 | **16K target** | Token transfers |
| `hft-ultra-server.ts` | Single process | 25 | 4,441* | Legacy |
| `hft-server.ts` | Single account | 1 | 0.6 | Production safe |

\* Historical with old contract

### Which Server to Use

**For market trading demos:** `hft-piscina-server.ts`
```bash
SEED_MNEMONIC="..." ACCOUNT_COUNT=500 RPC_MODE=internal \
npx tsx server/hft-piscina-server.ts turbo
```

**For token transfer TPS:** `transfer-tps-server.ts`
```bash
SEED_MNEMONIC="..." MODE=proven TOKEN_TYPE=apt \
npx tsx server/transfer-tps-server.ts
```

---

## Fire-and-Forget vs Verified Results

### Scripts that may INFLATE results
These report "submitted" not "confirmed":
- Any script with `fireAndForgetRatio > 0`
- `sustained-tps.ts`, `parallel-burst.ts`, `mega-burst.ts`

### Scripts that give REAL results
These query on-chain data:
- `analyze-tps.ts` - Scans blocks directly
- `analyze-submitted-txns.ts` - Verifies each hash
- `deep-tps-analysis.ts` - Cross-references submit vs confirm
- Ralphy system - 100% verification guarantee

---

## Environment Variables

### Required for TPS Demos
```bash
SEED_MNEMONIC="your 12/24 word mnemonic"
ACCOUNT_COUNT=500
```

### Optional Configuration
```bash
RPC_MODE=internal          # internal|custom|public
TOKEN_TYPE=apt             # apt|usd1
DURATION=60                # seconds
MODE=turbo                 # dryrun|light|turbo|quantum|hyper
CONTRACT_ADDRESS=0x...     # Override default
```

### RPC Endpoints
```
Internal VFN:  http://vfn0.usce1-0.testnet.aptoslabs.com:80/v1  (fastest)
Custom:        http://aptos.cash.trading:8080/v1
Public:        https://fullnode.testnet.aptoslabs.com/v1
```

**CRITICAL:** Internal VFN requires `/v1` suffix!

---

## Legacy Scripts

Scripts in `scripts/legacy/` are deprecated but kept for reference:

| Folder | Contents | Replaced By |
|--------|----------|-------------|
| `legacy/hft/` | Old HFT bots | `hft-piscina-server.ts` |
| `legacy/accounts/` | Manual key management | Seed-based scripts |
| `legacy/shell/` | Fragmented shell scripts | `orchestrator.sh` |
| `legacy/trading/` | Dangerous/outdated trading | Controlled modes |
| `legacy/markets/` | Price manipulation | Use with caution |
| `legacy/infrastructure/` | Old VM setup | Current orchestrator |

See `scripts/legacy/README.md` for details.

---

## Troubleshooting

### "Module not found" with internal VFN
Add `/v1` suffix to URL:
```
http://vfn0.usce1-0.testnet.aptoslabs.com:80/v1
```

### Low TPS / High failures
1. Check account balances: `npx tsx scripts/check-seed-accounts.ts`
2. Use `proven` mode instead of `turbo` or `quantum`
3. Verify RPC endpoint: `./scripts/pre-demo-checklist.sh`

### Sequence number errors
- Enable orderless transactions (AIP-123)
- Reduce batch size
- Increase batch delay

### Verifying actual TPS
Always run post-analysis:
```bash
npx tsx scripts/analyze-tps.ts
npx tsx scripts/deep-tps-analysis.ts
```

---

## Best Practices

1. **Always run pre-flight** before demos
2. **Use `proven` mode** for reliable results (3,180 TPS verified)
3. **Verify with analytics** - don't trust fire-and-forget numbers
4. **Use Ralphy system** for 100% transaction verification
5. **Document results** in `docs/TPS_BENCHMARKS.md`

---

*Last updated: January 21, 2026*
