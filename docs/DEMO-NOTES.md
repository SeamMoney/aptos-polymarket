# Demo Prep Notes

## Current Demo Modes
- `dryrun`: quick UI test, tiny trades, 2 accounts, minimal APT usage.
  - Run: `npx tsx server/hft-ultra-server.ts dryrun 5`
- `prod`: full TPS run, multi-RPC, 25 accounts across workers.
  - Run: `./scripts/orchestrator.sh demo`

## Recent Changes (Jan 2026)
- Added `/status` endpoint on HFT server to power real pre-flight checks.
- Wired launch control to `/status` so ARM only passes with:
  - server reachable + WS connected
  - active accounts > 0
  - market address set
- Implemented two-mode HFT config:
  - dryrun: `BATCH_SIZE=1`, `BATCH_DELAY_MS=100`, `USE_MULTI_RPC=false`
  - prod: `BATCH_SIZE=150`, `BATCH_DELAY_MS=100`, `USE_MULTI_RPC=true`
- Added “Ended” badges for markets past end time or resolved.

## Verified Canonical Data
- Worker IPs (from `scripts/orchestrator.sh`):
  - Worker 1: `178.128.177.88` (9 accounts)
  - Worker 2: `147.182.237.239` (8 accounts)
  - Worker 3: `161.35.231.0` (8 accounts)
  - Fullnode: `aptos.cash.trading:8080`
- On-chain outcome labels:
  - `["J.D. Vance","Marco Rubio","Donald Trump","Ron DeSantis","Tucker Carlson","Other"]`
- Faucet address (frontend):
  - `0x20a30d83eec219a31e4d4a6aec1787bbaab089c99a8d263df03147782a0d490c`

## Demo Readiness Checklist
1. Server health: `GET /health` and `GET /status` return `status: ok`.
2. Frontend: `npm run dev` and verify `/polymarket` + `/demo-day`.
3. Wallet funding: faucet has enough APT for demo wallets.
4. Market list: GOP 2028 market visible; ended markets show “Ended”.
5. Run `./scripts/orchestrator.sh dryrun` before recording.
6. Run `./scripts/orchestrator.sh demo` for the 30k TPS segment.
