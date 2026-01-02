# Repository Guidelines

## Project Structure & Module Organization
- `src/` contains the React frontend (Polymarket UI, demo pages, hooks).
- `server/` contains the Node/Express HFT server (`server/hft-ultra-server.ts`).
- `contracts/sources/` contains Move smart contracts (binary and multi-outcome markets).
- `scripts/` holds orchestration and ops scripts (workers, monitors, funding).
- `tests/` contains TypeScript tests executed via `tsx`.
- `docs/` hosts operational runbooks and architecture notes.

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
