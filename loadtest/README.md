# Polymarket Load Test Tool

High-throughput load testing tool for Polymarket prediction market contracts on Aptos.

## Overview

This tool generates `buy_outcome` transactions against `multi_outcome_market` Move contracts to stress test the system. It uses the Aptos transaction emitter library for efficient parallel transaction submission.

## Prerequisites

- Rust 1.90.0+ (2024 edition)
- Access to Aptos testnet or mainnet RPC endpoints
- A funded account with USD1 minting authority

## Quick Start

```bash
# Build all binaries
cargo build --release

# Set required environment variables
export COIN_SOURCE_KEY="0x..."  # Your private key (hex)
export ACCOUNT_MINTER_SEED="[1,2,3,...,32]"  # 32-byte seed array
export NODE_API_KEY="your-api-key"  # Optional: for authenticated endpoints

# Option 1: Create markets, fund accounts, and run load test
./scripts/fund_and_create_markets.sh 50 markets.txt
./scripts/fund_and_run.sh --markets-file markets.txt 60 5000

# Option 2: Run load test only (if accounts already funded)
./scripts/run_loadtest.sh --markets-file markets.txt 60 5000
```

## Binaries

### polymarket-loadtest
Main load test executable. Generates buy_outcome transactions.

```bash
cargo run --release --bin polymarket-loadtest -- \
    --targets "http://node1/,http://node2/" \
    --contract 0x... \
    --market 0x... --market 0x... \
    --duration 60 \
    --mempool-backlog 5000
```

### fund-accounts
Mints USD1 to test accounts or specific addresses.

```bash
# Fund test accounts (generated from seed)
cargo run --release --bin fund-accounts -- \
    --account-minter-seed "$ACCOUNT_MINTER_SEED" \
    --num-accounts 100 \
    --usd1-amount 100000000000

# Fund a specific address
cargo run --release --bin fund-accounts -- \
    --recipient 0x123... \
    --usd1-amount 100000000000

# Self-fund (mint to minter's own account)
cargo run --release --bin fund-accounts -- \
    --self-fund \
    --usd1-amount 100000000000
```

### create-markets
Creates prediction markets for load testing.

```bash
cargo run --release --bin create-markets -- \
    --num-markets 50 \
    --initial-liquidity 100000000000 \
    --output markets.txt
```

## Scripts

| Script | Description |
|--------|-------------|
| `fund_and_run.sh` | Fund test accounts with USD1, then run load test |
| `run_loadtest.sh` | Run load test only (accounts must have USD1) |
| `create_markets.sh` | Create new prediction markets |
| `fund_and_create_markets.sh` | Fund creator account, then create markets |

### Script Options

```bash
# fund_and_run.sh
./scripts/fund_and_run.sh [OPTIONS] [RPC_URLS] [DURATION] [MEMPOOL_BACKLOG] [NUM_ACCOUNTS]
  --no-fund           Skip USD1 funding step
  --markets-file FILE Read market addresses from file

# run_loadtest.sh
./scripts/run_loadtest.sh [OPTIONS] [RPC_URLS] [DURATION] [MEMPOOL_BACKLOG]
  --markets-file FILE Read market addresses from file
```

## Configuration

### Environment Variables

| Variable | Description |
|----------|-------------|
| `COIN_SOURCE_KEY` | Ed25519 private key (hex) for minting/funding |
| `ACCOUNT_MINTER_SEED` | 32-byte seed for deterministic account generation |
| `NODE_API_KEY` | API key for authenticated RPC endpoints |

### Important Addresses (Testnet)

- **Contract**: `0xca4d40eae9f07fb28a121862d649203fb4335ece9536ee51790e19f812ff7aea`
- **USD1 Metadata**: `0x14b1ec8a5f31554d0cd19c390be83444ed519be2d7108c3e27dcbc4230c01fa3`

## Markets File Format

One market address per line. Comments start with `#`:

```
# My load test markets
0xaf561030c7ebb22b1d8b99b727c27caab1f6944ce39c141fd2b6b0cfbf614a9e
0xa4ee321c4c642e7b5a3e27b9820f2be4c17a1add79f8129122289fca2c3ca7c3
```

## Output

The load test outputs JSON stats to the specified file:

```json
{
  "submitted": 10000,
  "committed": 9950,
  "expired": 50,
  "failed_submission": 0,
  "duration_secs": 60.0,
  "rate_submitted_per_sec": 166.67,
  "rate_committed_per_sec": 165.83
}
```
