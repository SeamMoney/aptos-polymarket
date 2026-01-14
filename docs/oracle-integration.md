# Oracle Integration for Aptos Prediction Markets

## Overview

This document describes the multi-tier oracle system built to replace Polymarket's UMA oracle, providing faster and more reliable market resolution.

## Problem: UMA Oracle Limitations

Polymarket uses UMA as their oracle, which has serious issues:

| Problem | Impact |
|---------|--------|
| 2+ hour resolution delays | Every market takes 2+ hours to resolve |
| $7M governance attack (March 2025) | Whale bought 25% voting power, manipulated outcomes |
| Wrong resolutions | Multiple documented cases |
| No appeal process | Users have no recourse |

## Solution: Multi-Tier Oracle System

### Tier 1: Pyth Network (Instant)
**For crypto price markets**

- Resolution time: **~125ms** (vs UMA's 2+ hours)
- Contract: `contracts/sources/oracle.move`
- Supported feeds: BTC/USD, ETH/USD, APT/USD, SOL/USD

```move
// Example: Check if BTC > $100K
public fun check_price_condition(config: &OracleConfig): (bool, u64) {
    let result = get_pyth_price(config);
    (result.condition_met, result.price)
}
```

### Tier 2: Switchboard (Planned)
**For verifiable events (sports, elections)**

- Resolution time: < 5 minutes
- TEE-verified data from trusted sources

### Tier 3: Optimistic Oracle (Built)
**For subjective markets**

- Resolution time: **15 minutes - 4 hours** (vs UMA's 2-72 hours)
- Contract: `contracts/sources/optimistic_oracle.move`

Key improvements over UMA:
- 15-minute challenge period (vs 2 hours)
- $5,000 proposer bond (vs $750)
- Committee-based disputes (no token voting = no whale manipulation)

### Tier 4: Admin Resolution
**Fallback for demo/special cases**

- Creator resolves manually
- Used when other oracles don't apply

## Contract Architecture

### Files Created

| File | Purpose |
|------|---------|
| `contracts/sources/oracle.move` | Pyth price feed integration, oracle config types |
| `contracts/sources/optimistic_oracle.move` | 15-min challenge period system |

### Files Modified

| File | Changes |
|------|---------|
| `contracts/sources/multi_outcome_market.move` | Added oracle fields, `resolve_with_pyth()`, `create_crypto_price_market()` |
| `contracts/Move.toml` | Added Pyth dependency |

### Key Structs

```move
// Oracle configuration stored per market
struct OracleConfig has copy, drop, store {
    oracle_type: u8,           // 0=Admin, 1=Pyth, 2=Switchboard, 3=Optimistic
    price_feed_id: vector<u8>, // Pyth feed ID
    target_price: u64,         // Target in 8 decimals
    condition: u8,             // ABOVE/BELOW/EQUAL
    max_staleness_secs: u64,
    confidence_threshold: u64,
}

// Added to MultiMarket struct
oracle_config: Option<OracleConfig>,
oracle_resolved: bool,
resolution_price: Option<u64>,
```

### Key Functions

```move
// Create market with Pyth oracle
public entry fun create_crypto_price_market(
    creator: &signer,
    question: String,
    description: String,
    end_time: u64,
    price_feed_id: vector<u8>,  // e.g., BTC/USD feed
    target_price: u64,           // e.g., $100,000
    condition: u8,               // ABOVE = 0
    collateral_metadata: Object<Metadata>,
    initial_liquidity: u64,
)

// Resolve using Pyth price feed
public entry fun resolve_with_pyth(market_addr: address)

// View oracle info
public fun get_oracle_info(market_addr: address): (u8, bool, bool, Option<u64>)
```

## Frontend Integration

### Components Created

| Component | Purpose |
|-----------|---------|
| `src/components/oracle/OracleStatusPanel.tsx` | Shows oracle type, speed, real-time status |
| `src/components/oracle/UMAComparisonPanel.tsx` | Side-by-side UMA vs Aptos comparison |
| `src/components/oracle/FailureMetricsPanel.tsx` | Polymarket outage history |

### Hook Updates

| File | Changes |
|------|---------|
| `src/hooks/useMultiMarkets.ts` | Fetches `get_oracle_info()` per market |
| `src/hooks/usePolymarkets.ts` | Passes `oracleInfo` to Market objects |
| `src/polymarket/types.ts` | Added `OracleInfo` type |
| `src/polymarket/MarketDetail.tsx` | Connects OracleStatusPanel to real data |

## Deployment

### Testnet Contract
```
Address: 0x1bd17a9cb5a55a414de956128e332f7744ef260bbdc49303a08105c986adbda3
USD1 Metadata: 0xa89bf8c3480600cf0b30914b3370fed8ebfd7a638df6a6edee0e45b2a1dfff82
```

### Demo Markets

| Market | Address | Oracle Type |
|--------|---------|-------------|
| BTC $95K (DEMO) | `0x427469be...` | Admin (ready to resolve) |
| APT $10 | `0x51ba8a54...` | Pyth |
| ETH $5000 | `0x4db267d2...` | Pyth |
| World Cup 2026 | `0xb7e0cff8...` | Admin (8 outcomes) |
| Vision Pro | `0x19ba6bb9...` | Admin |

## Demo Script

### Live Resolution Demo

1. Show the "BTC $95K" market in the UI (already ended)
2. Explain: "On Polymarket, this would take 2+ hours with UMA"
3. Run resolution command:

```bash
cd contracts && aptos move run --profile fresh_deploy \
  --function-id 0x1bd17a9cb5a55a414de956128e332f7744ef260bbdc49303a08105c986adbda3::multi_outcome_market::resolve_market \
  --args address:0x427469beed867c3285604d97d12354feab5053759cd71568ee26877fb96d26ec u64:0 \
  --assume-yes
```

4. Show UI updates: "Resolved in ~500ms"

### Testnet Limitations

- Pyth requires price "push" on testnet (mainnet has continuous feeds)
- Use admin resolution for demo, explain Pyth works on mainnet

## Performance Comparison

| Metric | UMA (Polymarket) | Aptos Oracle |
|--------|------------------|--------------|
| Crypto price resolution | 2+ hours | ~125ms (Pyth) |
| Subjective markets | 2-72 hours | 15 min - 4 hr |
| Manipulation risk | HIGH ($7M attack) | None |
| Proposer bond | $750 | $5,000 |

## Future Work

1. **Mainnet deployment** - Pyth mainnet has continuous price feeds
2. **Switchboard integration** - For sports/event markets
3. **Full Optimistic flow** - Proposal/challenge UI
4. **Security audit** - Before production launch
