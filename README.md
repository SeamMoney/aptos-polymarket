# Polymarket on Aptos

A fully functional prediction market platform demonstrating Polymarket-style trading on Aptos blockchain. Features sub-second finality, parallel transaction execution, and real-time HFT bot visualization.

**Live Demo:** http://localhost:5173 (after running `npm run dev`)

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         Frontend (React)                        │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌───────────┐ │
│  │ MarketCard  │ │ HFTVisualizer│ │TurboVisualizer│ │OrderBook │ │
│  └─────────────┘ └─────────────┘ └─────────────┘ └───────────┘ │
└─────────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┼───────────────┐
              │               │               │
              ▼               ▼               ▼
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│  HFT Server     │ │  Turbo Server   │ │  Aptos Testnet  │
│  (WebSocket)    │ │  (WebSocket)    │ │  (RPC)          │
│  Port 3001      │ │  Port 3002      │ │                 │
└─────────────────┘ └─────────────────┘ └─────────────────┘
              │               │               │
              └───────────────┼───────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Aptos Smart Contracts                        │
│  ┌─────────────────────────┐ ┌─────────────────────────────────┐│
│  │  prediction_market.move │ │  multi_outcome_market.move      ││
│  │  (Binary YES/NO)        │ │  (3+ outcomes: elections, etc)  ││
│  └─────────────────────────┘ └─────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

## Key Addresses (Testnet)

| Type | Address |
|------|---------|
| **Contract** | `0x64a81cb9cbd14d45b87bb32ef73107a44f00069b6a96e70d75369fb7e3da5e68` |
| **Bot Wallet** | Same as contract (derived from private key) |
| **Example Market** | `0x9ec8c2987a5d0598969bb48f3acee94dd6bd5570420cbe5993d65e48500380c4` |

## Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Start Frontend
```bash
npm run dev
```

### 3. Start HFT Bot Server
```bash
# Basic (will hit rate limits after ~5 min)
APTOS_PRIVATE_KEY=0x... npx tsx server/hft-server.ts

# With API Key (recommended - no rate limits)
APTOS_PRIVATE_KEY=0x... APTOS_API_KEY=AG-... npx tsx server/hft-server.ts
```

### 4. Start Turbo Mode Server (Optional)
```bash
APTOS_PRIVATE_KEY=0x... npx tsx server/hft-turbo-server.ts
```

## Smart Contracts

### Binary Market (`prediction_market.move`)

A constant product market maker (CPMM) for binary YES/NO outcomes.

**Features:**
- APT as collateral
- 0.3% trading fee
- Automatic price discovery via `x * y = k` formula
- Token redemption after resolution

**Key Functions:**
```move
// Create a new market
public entry fun create_market(
    creator: &signer,
    question: String,
    description: String,
    end_time: u64,
    initial_liquidity: u64
)

// Buy YES tokens
public entry fun buy_yes(
    buyer: &signer,
    market_address: address,
    amount_in: u64,
    min_tokens_out: u64
)

// Buy NO tokens
public entry fun buy_no(...)

// Sell YES tokens
public entry fun sell_yes(...)

// Sell NO tokens
public entry fun sell_no(...)

// Resolve market (creator only)
public entry fun resolve_market(
    resolver: &signer,
    market_address: address,
    outcome: bool  // true = YES wins
)

// Redeem winning tokens
public entry fun redeem(
    user: &signer,
    market_address: address
)
```

### Multi-Outcome Market (`multi_outcome_market.move`)

For markets with 3+ outcomes (elections, sports, etc.).

**Example:** "Who will win the 2024 US Presidential Election?"
- Trump, Biden, DeSantis, RFK Jr, Other

## Frontend Components

### Core Components

| Component | Description |
|-----------|-------------|
| `MarketCard.tsx` | Binary market trading interface |
| `MultiOutcomeMarketCard.tsx` | Multi-outcome market interface |
| `HFTVisualizer.tsx` | Real-time HFT bot visualization |
| `TurboVisualizer.tsx` | Parallel burst transaction demo |
| `OrderBook.tsx` | Synthetic order book from AMM curve |
| `StressTest.tsx` | Load testing comparison (Aptos vs Polygon) |

### Key Hooks

| Hook | Description |
|------|-------------|
| `useMarkets.ts` | Fetches binary markets from chain |
| `useMultiMarkets.ts` | Fetches multi-outcome markets |

## Backend Servers

### HFT Server (`server/hft-server.ts`)

WebSocket server that executes real on-chain trades.

**Port:** 3001

**Environment Variables:**
- `APTOS_PRIVATE_KEY` - Bot wallet private key (required)
- `APTOS_API_KEY` - Aptos Labs API key (recommended)

**WebSocket Messages:**

```typescript
// Trade executed
{
  type: 'trade',
  data: {
    id: string,
    bot: string,        // Alpha, Beta, Gamma, etc.
    action: string,     // buy_yes, buy_no, sell_yes, sell_no
    amount: number,     // APT
    latency: number,    // ms
    success: boolean,
    txHash?: string,
    explorerUrl?: string
  },
  stats: { totalTrades, successRate, avgLatency, ... },
  market: { yesPrice, noPrice, ... },
  position: { yesTokens, noTokens, pnl, ... },
  botBalance: number,
  marketReserves: { yesReserve, noReserve, tvl }
}

// Low balance warning
{
  type: 'low_balance',
  message: string,
  botBalance: number
}
```

**REST Endpoints:**
- `POST /start` - Start trading
- `POST /stop` - Stop trading
- `GET /stats` - Get current stats
- `GET /health` - Health check

### Turbo Server (`server/hft-turbo-server.ts`)

Demonstrates parallel transaction bursts (10-25+ TPS).

**Port:** 3002

## Scripts

| Script | Description |
|--------|-------------|
| `scripts/create-market.ts` | Create a new binary market |
| `scripts/create-multi-market.ts` | Create a multi-outcome market |
| `scripts/turbo-demo.ts` | Parallel transaction demo |
| `scripts/hft-bot.ts` | Standalone HFT bot |

### Create a Market

```bash
APTOS_PRIVATE_KEY=0x... npx tsx scripts/create-market.ts
```

## Project Structure

```
aptos-polymarket/
├── contracts/
│   └── sources/
│       ├── prediction_market.move      # Binary YES/NO markets
│       └── multi_outcome_market.move   # 3+ outcome markets
├── server/
│   ├── hft-server.ts                   # HFT bot WebSocket server
│   └── hft-turbo-server.ts             # Parallel burst server
├── scripts/
│   ├── create-market.ts                # Create binary market
│   ├── create-multi-market.ts          # Create multi-outcome market
│   ├── turbo-demo.ts                   # Parallel tx demo
│   └── hft-*.ts                        # Various HFT strategies
├── src/
│   ├── components/
│   │   ├── MarketCard.tsx              # Binary market UI
│   │   ├── MultiOutcomeMarketCard.tsx  # Multi-outcome UI
│   │   ├── HFTVisualizer.tsx           # HFT bot visualization
│   │   ├── TurboVisualizer.tsx         # Parallel tx visualization
│   │   ├── OrderBook.tsx               # Synthetic order book
│   │   ├── StressTest.tsx              # Load testing
│   │   └── ...
│   ├── hooks/
│   │   ├── useMarkets.ts               # Fetch binary markets
│   │   └── useMultiMarkets.ts          # Fetch multi-outcome markets
│   ├── utils/
│   │   └── contracts.ts                # Contract addresses
│   └── App.tsx                         # Main app
├── tests/
│   ├── contract-test.ts                # Contract tests
│   └── stress-test.ts                  # Stress tests
└── package.json
```

## How It Works

### Price Mechanism (CPMM)

The market uses a constant product formula like Uniswap:

```
YES_reserve * NO_reserve = k (constant)
```

**Price Calculation:**
```
YES_price = NO_reserve / (YES_reserve + NO_reserve)
NO_price = YES_reserve / (YES_reserve + NO_reserve)
```

**Buying tokens:**
1. User deposits APT
2. Contract calculates tokens out based on reserves
3. Reserves update, price shifts

### HFT Bot Behavior

The bot simulates multiple traders with varied strategies:

- **Bot Names:** Alpha, Beta, Gamma, Delta, Epsilon, Zeta, Omega, Sigma
- **Actions:** buy_yes (30%), buy_no (25%), sell_yes (22%), sell_no (23%)
- **Trade Sizes:** Log-normal distribution, 0.005 - 3.0 APT
- **Adaptive Throttling:** Slows down on rate limits, speeds up on success

### Order Book Visualization

Since this is an AMM (not a traditional order book), the OrderBook component generates a **synthetic order book** by:

1. Calculating price impact at different trade sizes using the AMM formula
2. Aggregating recent trades by price level
3. Showing liquidity depth as visual bars

## Rate Limiting

Without an API key, Aptos testnet limits to **40,000 compute units per 5 minutes**.

**Symptoms:**
- Transactions fail with 429 errors
- Balance checks return 0
- Bot stops trading

**Solutions:**
1. Get an API key from https://developers.aptoslabs.com/
2. Wait 5 minutes for rate limit to reset
3. Reduce trading frequency

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
aptos move publish --named-addresses prediction_market=default
```

### Build Frontend

```bash
npm run build
# Output in dist/
```

## Why Aptos?

| Feature | Aptos | Polygon |
|---------|-------|---------|
| Finality | ~470ms | 2-5 seconds |
| Peak TPS | 160,000+ | ~7,000 |
| Avg Fee | <$0.001 | $0.01-0.10 |
| Parallel Execution | Yes (Block-STM) | No |
| Cross-chain Wallets | Native (AIP-44) | No |

## License

MIT
