# Polymarket on Aptos

A fully functional prediction market platform demonstrating Polymarket-style trading on Aptos blockchain. Features sub-second finality, parallel transaction execution, and real-time HFT bot visualization.

**Target:** 22,500+ TPS with distributed workers

**Live Demo:** http://localhost:5173 (after running `npm run dev`)

## TPS Demo Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           YOUR LAPTOP                                    │
│  ┌──────────────────┐     ┌────────────────────────────────────────┐   │
│  │ React Frontend   │     │ HFT Worker 1 (accounts 1-7)            │   │
│  │ - Market UI      │◄────│ Port 3001 | ~7,500 TPS                 │   │
│  │ - TPS Chart      │ WS  │                                        │   │
│  │ - Liquidity Depth│     └──────────────┬─────────────────────────┘   │
│  │ - Trade Stream   │                    │                              │
│  └──────────────────┘                    │                              │
└──────────────────────────────────────────┼──────────────────────────────┘
                                           │
              ┌────────────────────────────┴────────────────────────────┐
              │                   RPC LOAD BALANCER                      │
              │  Round-robin: Aptos Labs (x3) + Ankr + QuickNode         │
              └───┬────────────┬────────────┬────────────┬──────────────┘
                  │            │            │            │
                  ▼            ▼            ▼            ▼
             Aptos Labs   Aptos Labs   Ankr RPC    QuickNode
              (Public)     (Testnet)   (Free)      (Build)

┌─────────────────────────────────────┐ ┌─────────────────────────────────┐
│       DIGITAL OCEAN VM 1            │ │       DIGITAL OCEAN VM 2        │
│  ┌───────────────────────────────┐  │ │  ┌───────────────────────────┐  │
│  │ HFT Worker 2 (accounts 8-14)  │  │ │  │ HFT Worker 3 (accounts 15-20)│
│  │ IP: 209.38.172.28             │  │ │  │ IP: 147.182.237.239        │  │
│  │ ~7,500 TPS                    │  │ │  │ ~7,500 TPS                 │  │
│  └───────────────────────────────┘  │ │  └───────────────────────────┘  │
└─────────────────────────────────────┘ └─────────────────────────────────┘
                                           │
                                           ▼
                          ┌────────────────────────────────┐
                          │        APTOS TESTNET           │
                          │  Multi-outcome prediction      │
                          │  market with Aggregator V2     │
                          │  ~160k TPS network capacity    │
                          │  ~400ms block finality         │
                          └────────────────────────────────┘
```

### TPS Formula
```
TPS = RPS × Batch_Size × Num_Workers
    = 50 × 150 × 3
    = 22,500 TPS
```

## Key Addresses (Testnet)

| Type | Address |
|------|---------|
| **Contract (v3 - Full Aggregators)** | `0xa2e5e47aab07fed78a3bcf95135ee2dad20c547499c94cb16a3e047859ffa7e1` |
| **Production Market (2028 GOP)** | `0xfefd1b67818ee4ef12a7953852c83f0efb411a9b92c518a52ba92555e4abdd96` |
| **Contract (v2 - Aggregators)** | `0x3f13249e31a1fbdb886741f7945cccc40307311abc08ba188894bd1a050e19b4` |
| **Contract (v1 - Legacy)** | `0x64a81cb9cbd14d45b87bb32ef73107a44f00069b6a96e70d75369fb7e3da5e68` |

## HFT Infrastructure

### Bot Wallets (20 accounts, ~120,800 APT total)

| Accounts | Balance Each | Total | Location |
|----------|--------------|-------|----------|
| 1-7 | ~8,000 APT | ~56,000 APT | Your Mac (Worker 1) |
| 8-14 | ~4,500 APT | ~32,000 APT | DO VM 1 (Worker 2) |
| 15-20 | ~4,000 APT | ~24,000 APT | DO VM 2 (Worker 3) |

### Key Optimizations

| Optimization | Description | Impact |
|--------------|-------------|--------|
| **Orderless Transactions (AIP-123)** | Random nonces instead of sequence numbers | No sequence bottleneck |
| **Aggregator V2 (AIP-47)** | Parallel-safe reserve updates | True parallel contract execution |
| **Multi-RPC Load Balancing** | Round-robin across 5+ RPC endpoints | Bypass rate limits |
| **Fire-and-Forget (98%)** | Don't wait for tx confirmation | Maximum submission speed |
| **Large Batch Size (150)** | More txns per submission cycle | Higher throughput |

## Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Start Frontend
```bash
npm run dev
```

### 3. Run TPS Demo

```bash
# Option 1: Local only (~7,500 TPS)
./scripts/run-demo.sh normal 60

# Option 2: All 3 workers (~22,500 TPS)
./scripts/run-3-workers.sh normal 60

# Option 3: Single server mode
ULTRA_PRIVATE_KEYS="key1,key2,..." APTOS_API_KEY=... npx tsx server/hft-ultra-server.ts
```

### 4. Access Demo UI
- **Main App:** http://localhost:5173
- **Demo Day Page:** http://localhost:5173/demo-day

## Smart Contracts

### Multi-Outcome Market (`multi_outcome_market.move`)

Complete Sets model with CPMM pricing for 2-20 outcomes.

**How it works:**
- 1 APT buys a complete set (1 of each outcome token)
- Individual outcome tokens trade via CPMM
- Arbitrage keeps prices summing to ~100%
- Winning tokens redeem for 1 APT each

**Key Features (v3 with Aggregators):**
```move
// All reserves use Aggregator<u64> for parallel execution
struct OutcomeToken has store {
    reserve: Aggregator<u64>,  // Parallel-safe!
}

struct MultiMarket has key {
    total_collateral: Aggregator<u64>,
    base_reserve: Aggregator<u64>,
    accumulated_fees: Aggregator<u64>,
}
```

**Entry Functions:**
```move
// Mint complete set: deposit APT, get 1 of each outcome token
public entry fun mint_complete_set(user: &signer, market: address, amount: u64)

// Redeem complete set: burn 1 of each token, get APT back
public entry fun redeem_complete_set(user: &signer, market: address, amount: u64)

// Buy outcome tokens via CPMM
public entry fun buy_outcome(buyer: &signer, market: address, outcome_index: u64, amount: u64, min_out: u64)

// Sell outcome tokens via CPMM
public entry fun sell_outcome(seller: &signer, market: address, outcome_index: u64, tokens: u64, min_out: u64)

// Resolve market (creator only, after end_time)
public entry fun resolve(resolver: &signer, market: address, winning_outcome: u64)

// Redeem winning tokens for 1 APT each
public entry fun redeem_winnings(user: &signer, market: address)
```

### Binary Market (`prediction_market.move`)

Simple YES/NO CPMM market for binary outcomes.

**Price Mechanism:**
```
YES_reserve * NO_reserve = k (constant)
YES_price = NO_reserve / (YES_reserve + NO_reserve)
```

## Frontend Components

### Core Components

| Component | Description |
|-----------|-------------|
| `MarketCard.tsx` | Binary market trading interface |
| `MultiOutcomeMarketCard.tsx` | Multi-outcome market interface |
| `HFTVisualizer.tsx` | Real-time HFT bot visualization with TPS counter |
| `OrderBook.tsx` | **Real AMM liquidity depth** (not synthetic) |
| `DemoMode.tsx` | TPS chart and demo controls |
| `VisualizerEmbed.tsx` | Block River iframe (Aptos consensus visualizer) |

### Liquidity Depth Visualizer

The OrderBook component shows **real AMM liquidity data**:

| Column | Description |
|--------|-------------|
| Trade Size | 0.1, 0.5, 1, 2, 5, 10, 25, 50 APT |
| Tokens Out | Calculated from CPMM formula |
| Avg Price | Execution price at that size |
| Slippage | Price impact (green <1%, yellow <5%, red >5%) |

Formula used: `tokens_out = reserve_out * amount_in / (reserve_in + amount_in)`

## Backend Servers

### Ultra HFT Server (`server/hft-ultra-server.ts`)

Maximum TPS mode with all optimizations enabled.

**Features:**
- Orderless transactions (AIP-123) - no sequence number bottleneck
- Multi-account parallel submission (20 accounts)
- Multi-RPC load balancing (5+ endpoints)
- 98% fire-and-forget mode
- Large batch sizes (150 txns/batch)
- Exponential backoff/recovery for mempool congestion

**Port:** 3001

**Configuration:**
```typescript
const CONFIG = {
  BATCH_SIZE: 150,
  FIRE_AND_FORGET_RATIO: 0.98,
  USE_ORDERLESS: true,
  USE_MULTI_RPC: true,
};
```

**RPC Endpoints (load-balanced):**
```typescript
const RPC_ENDPOINTS = [
  'https://fullnode.testnet.aptoslabs.com/v1',
  'https://testnet.aptoslabs.com/v1',
  'https://api.testnet.aptoslabs.com/v1',
  'https://rpc.ankr.com/http/aptos_testnet/v1',
  '<QuickNode endpoint>',
];
```

**Expected Performance:**

| Setup | TPS |
|-------|-----|
| Local only (7 accounts) | ~7,500 |
| 2 workers (14 accounts) | ~15,000 |
| 3 workers (20 accounts) | ~22,500 |
| With own fullnode | ~30,000+ |

### WebSocket Messages

```typescript
// Trade executed
{
  type: 'trade',
  data: {
    id: string,
    bot: string,        // Ultra-A, Ultra-B, Hyper-1, etc.
    action: string,     // buy_outcome, sell_outcome, mint_complete_set
    amount: number,     // APT
    latency: number,    // ms (includes ~400ms finality estimate)
    success: boolean,
    txHash?: string,
    explorerUrl?: string
  },
  stats: { totalTrades, successRate, currentTps, peakTps, avgLatency },
  market: { yesPrice, noPrice, outcomePrices, outcomeLabels },
  position: { yesTokens, noTokens, outcomePositions },
  botBalance: number,
  marketReserves: { yesReserve, noReserve, tvl }
}
```

## Demo Day Commands

```bash
# Pre-demo: Check infrastructure
./scripts/check-remote-hft.sh

# Start all 3 workers (~22,500 TPS)
./scripts/run-3-workers.sh normal 60

# Stop all workers
pkill -f hft-ultra-server
./scripts/stop-remote-hft.sh

# Check market prices
curl -s -X POST "https://fullnode.testnet.aptoslabs.com/v1/view" \
  -H "Content-Type: application/json" \
  -d '{
    "function": "0xa2e5e47aab07fed78a3bcf95135ee2dad20c547499c94cb16a3e047859ffa7e1::multi_outcome_market::get_all_prices",
    "arguments": ["0xfefd1b67818ee4ef12a7953852c83f0efb411a9b92c518a52ba92555e4abdd96"]
  }' | jq .
```

## Project Structure

```
aptos-polymarket/
├── contracts/
│   └── sources/
│       ├── prediction_market.move      # Binary YES/NO markets
│       └── multi_outcome_market.move   # Multi-outcome markets (v3)
├── server/
│   ├── hft-ultra-server.ts             # Maximum TPS server (primary)
│   ├── hft-server.ts                   # Standard HFT server
│   └── hft-turbo-server.ts             # Parallel burst server
├── scripts/
│   ├── run-demo.sh                     # Local demo launcher
│   ├── run-3-workers.sh                # Distributed launcher
│   ├── setup-remote-hft.sh             # Setup DO workers
│   ├── create-multi-market.ts          # Create multi-outcome market
│   └── ...
├── docs/
│   ├── HFT-SETUP.md                    # Full infrastructure docs
│   └── DEMO-RUNBOOK.md                 # Demo day checklist
├── src/
│   ├── components/
│   │   ├── HFTVisualizer.tsx           # HFT visualization
│   │   ├── OrderBook.tsx               # AMM liquidity depth
│   │   ├── DemoMode.tsx                # TPS charts
│   │   └── ...
│   └── ...
└── package.json
```

## Why Aptos?

| Feature | Aptos | Polygon | Ethereum |
|---------|-------|---------|----------|
| Finality | ~400ms | 2-5 sec | 12+ sec |
| Peak TPS | 160,000+ | ~7,000 | ~30 |
| Parallel Execution | Yes (Block-STM) | No | No |
| Avg Fee | <$0.001 | $0.01-0.10 | $1-50 |
| Orderless Txns | Yes (AIP-123) | No | No |

### Key Aptos Features Used

1. **Block-STM**: Parallel transaction execution via optimistic concurrency
2. **Aggregator V2 (AIP-47)**: Parallel-safe counters for high-contention data
3. **Orderless Transactions (AIP-123)**: Random nonces eliminate sequence bottleneck
4. **Fungible Asset Standard**: Native token support with primary stores

## Rate Limiting

Without an API key, Aptos testnet limits to **40,000 compute units per 5 minutes**.

**Solutions:**
1. Get an API key from https://developers.aptoslabs.com/
2. Use multi-RPC load balancing (already configured)
3. Run your own fullnode for unlimited TPS

## Cost Summary

| Component | Monthly Cost |
|-----------|--------------|
| QuickNode Build | $49 |
| DO VM 1 (4GB) | ~$24 |
| DO VM 2 (4GB) | ~$24 |
| **Current Total** | **~$97** |
| Fullnode (optional) | +$192 |

## Testing

```bash
# Run contract tests
npm run test

# Run stress tests
npm run test:stress

# Run transaction tests
npm run test:tx
```

## Deployment

### Deploy Contracts

```bash
cd contracts

# Deploy to new address (required for struct changes)
aptos init --network testnet
aptos account fund-with-faucet --account default
aptos move publish --named-addresses prediction_market=default
```

### Create a Market

```bash
APTOS_PRIVATE_KEY=0x... npx tsx scripts/create-multi-market.ts
```

## License

MIT
