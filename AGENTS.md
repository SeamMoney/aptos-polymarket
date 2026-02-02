# Repository Guidelines

## Project Structure & Module Organization
- `src/` contains the React frontend (Polymarket UI, demo pages, hooks).
- `server/` contains the Node/Express HFT server (`server/hft-ultra-server.ts`).
- `contracts/sources/` contains Move smart contracts (binary and multi-outcome markets).
- `scripts/` holds orchestration and ops scripts (workers, monitors, funding).
- `tests/` contains TypeScript tests executed via `tsx`.
- `docs/` hosts operational runbooks and architecture notes.
- `loadtest/` contains the Rust-based high-throughput load testing tool.

## Build, Test, and Development Commands
- `npm install` installs dependencies.
- `npm run dev` starts the Vite frontend at `http://localhost:5173`.
- `npm run build` runs TypeScript build + Vite production build.
- `npm run lint` runs ESLint on the codebase.
- `npx tsx server/hft-ultra-server.ts [mode] [duration]` runs the HFT server (e.g., `dryrun 5`).
- `./scripts/orchestrator.sh [dryrun|demo|status|stop]` manages distributed worker demos.

## Coding Style & Naming Conventions
- TypeScript/TSX with 2-space indentation (match existing files).
- Use descriptive `camelCase` for variables/functions and `PascalCase` for React components.
- Keep modules small and focused; prefer hooks in `src/hooks/`.
- Linting via ESLint (`eslint.config.js`) with React Hooks and React Refresh rules.

## Testing Guidelines
- Tests live in `tests/` and run with `tsx`.
- Use `npm run test`, `npm run test:stress`, or `npm run test:tx`.
- Keep test files named by intent (e.g., `contract-test.ts`, `stress-test.ts`).

## Commit & Pull Request Guidelines
- Commit messages follow `type: short description` (examples in history: `feat:`, `fix:`, `perf:`, `docs:`).
- Keep commits scoped and readable; avoid bundling unrelated changes.
- PRs should include: a clear summary, testing notes, and screenshots for UI changes.
- Link related issues or demo run IDs when applicable.

## Security & Configuration Tips
- Secrets and private keys belong in `.env.local` (never commit).
- Common env vars: `APTOS_API_KEY`, `QUICKNODE_RPC`, `ULTRA_PRIVATE_KEYS`, `MULTI_MARKET`.
- When editing scripts in `scripts/`, keep IPs, keys, and durations consistent with `docs/` and `README.md`.

---

## Load Test Tool (`loadtest/`)

The `loadtest/` directory contains a Rust-based load testing tool for generating high-throughput transaction load against the `multi_outcome_market` Move contract.

### Tech Stack
- **Language**: Rust (2024 edition, requires rustc 1.90.0+)
- **Async Runtime**: Tokio
- **CLI Framework**: Clap (derive mode)
- **Blockchain SDK**: Aptos SDK and transaction emitter libraries

### Structure
```
loadtest/
├── Cargo.toml
├── src/
│   ├── main.rs                    # Entry point, orchestrates load test
│   ├── config.rs                  # CLI argument definitions
│   ├── polymarket_entrypoint.rs   # Transaction generator for buy_outcome
│   └── bin/
│       ├── fund_accounts.rs       # USD1 funding utility
│       └── create_markets.rs      # Market creation utility
└── scripts/
    ├── fund_and_run.sh            # Fund accounts + run load test
    ├── run_loadtest.sh            # Load test only
    ├── create_markets.sh          # Create markets
    └── fund_and_create_markets.sh # Fund creator + create markets
```

### Key Binaries

**polymarket-loadtest**: Main load test tool
- Generates `buy_outcome` transactions against multiple markets
- Supports multiple RPC endpoints for load distribution
- Outputs JSON stats on completion

**fund-accounts**: USD1 funding utility
- Mints USD1 to test accounts before load test
- Supports `--self-fund` for funding the minter's own account
- Supports `--recipient` for funding a specific address
- Parallel batch submissions for performance

**create-markets**: Market creation utility
- Creates prediction markets with configurable liquidity
- Saves market addresses to file for use in load tests

### Building & Running
```bash
cd loadtest

# Build all binaries
cargo build --release

# Create markets (funds creator first, then creates markets)
./scripts/fund_and_create_markets.sh 50 markets.txt

# Fund test accounts and run load test
./scripts/fund_and_run.sh --markets-file markets.txt 60 5000

# Run load test only (accounts must have USD1)
./scripts/run_loadtest.sh --markets-file markets.txt 60 5000
```

### Environment Variables
- `COIN_SOURCE_KEY`: Ed25519 private key (hex) for funding/minting
- `ACCOUNT_MINTER_SEED`: Seed for generating deterministic test accounts
- `NODE_API_KEY`: API key for authenticated RPC endpoints

### Important Addresses (Testnet)
- Contract: `0xca4d40eae9f07fb28a121862d649203fb4335ece9536ee51790e19f812ff7aea`
- USD1 Metadata: `0x14b1ec8a5f31554d0cd19c390be83444ed519be2d7108c3e27dcbc4230c01fa3`

### Development Notes
- The tool depends on a specific Aptos Core revision via git dependencies
- BCS serialization must match Move contract argument types
- Test accounts need USD1 balance for `buy_outcome` transactions
