# Legacy Scripts

This folder contains deprecated scripts that have been superseded by newer implementations.

**DO NOT DELETE** - These are kept for reference and historical context.

## Why These Were Deprecated

### `/hft/` - Legacy HFT Scripts
- `hft-bot.ts`, `hft-turbo.ts`, `hft-burst.ts`, `hft-max.ts` - Single account HFT bots, replaced by multi-worker `orchestrator.sh` and `hft-piscina-server.ts`
- `turbo-demo.ts`, `speed-demo.ts`, `parallel-demo.ts` - Standalone demos replaced by `run-usd1-tps-demo.ts`
- `burst-with-ui.ts`, `burst-per-market.ts` - Old burst implementations

### `/accounts/` - Legacy Account Management
- `generate-accounts.ts`, `generate-more-accounts.ts` - Manual key generation, replaced by seed-based `generate-seed-accounts.ts`
- `fund-*.ts` - Old funding scripts replaced by `fund-seed-accounts.ts` and `fast-fund-usd1.ts`

### `/shell/` - Legacy Shell Scripts
- `start-hft.sh`, `start-ultra-hft.sh`, `start-demo.sh` - Fragmented scripts consolidated into `orchestrator.sh`
- `stop-remote-hft.sh`, `check-remote-hft.sh` - Now use `orchestrator.sh stop` and `orchestrator.sh status`
- `demo-dashboard.sh`, `watch-tps.sh`, `monitor-*.sh` - Old monitoring, replaced by built-in analytics

### `/trading/` - Legacy Trading Scripts
- `flood-test.ts` - Dangerous mempool flooding, use controlled modes instead
- `tps-original-style.ts`, `max-tps-local.ts` - Old TPS measurement methods
- `pnl-demo.ts`, `demo-faucet.ts` - Outdated demo utilities

### `/markets/` - Market Manipulation Scripts (CAUTION)
- `pump-yes.ts`, `pump-no-choppy.ts`, `demo-pump.ts` - Artificial price manipulation
- `tier-prices.ts`, `big-tiers.ts`, `create-and-pump.ts` - Setup scripts that manipulate prices

### `/infrastructure/` - Old Infrastructure Scripts
- `10k-tps-demo.sh` - Outdated TPS target
- `demo-deploy-all.sh`, `demo-start-all.sh`, `demo-stop-all.sh` - Replaced by orchestrator
- `setup-remote-hft.sh`, `deploy-worker.sh` - Old VM setup

## Migration Path

| Old Script | New Script |
|------------|------------|
| `hft-bot.ts` | `server/hft-piscina-server.ts` |
| `generate-accounts.ts` | `generate-seed-accounts.ts` |
| `fund-accounts.ts` | `fund-seed-accounts.ts` |
| `start-hft.sh` | `orchestrator.sh` |
| `turbo-demo.ts` | `run-usd1-tps-demo.ts` |
| `flood-test.ts` | Use controlled modes in `hft-piscina-server.ts` |

## Restoring a Legacy Script

If you need to use a legacy script:
```bash
# Copy back to main scripts folder
cp scripts/legacy/hft/hft-bot.ts scripts/

# Or run directly from legacy folder
npx tsx scripts/legacy/hft/hft-bot.ts
```

---

*Last organized: January 21, 2026*
