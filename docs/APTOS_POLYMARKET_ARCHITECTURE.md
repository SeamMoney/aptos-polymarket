# Aptos Polymarket Architecture Plan

## Executive Summary

This document outlines the architecture for building a **Polymarket clone on Aptos** that is 10x better than the original through:
- Fully on-chain CLOB (no off-chain matching)
- Native Aptos indexer (no Graph dependency)
- Multi-oracle resolution (Pyth + Switchboard + Dispute DAO)
- Parallel execution via Block-STM
- Sub-second finality (~125ms vs Polygon's 2-3s)

## Current State Analysis

### What We Have

1. **Existing Contracts** (`contracts/sources/`)
   - `prediction_market.move`: Binary AMM (CPMM) market
   - `multi_outcome_market.move`: Multi-outcome AMM with Aggregators for parallel execution
   - Uses APT as collateral, mints YES/NO fungible assets
   - Basic resolution by creator

2. **Reference: Decibel Contracts** (`reference/decibel-contracts/`)
   - 51 annotated Move modules from Decibel perpetual DEX
   - Key patterns: on-chain CLOB, multi-oracle, collateral management, fees
   - **CRITICAL**: Decibel uses [Econia's order book](https://github.com/econia-labs/econia) - NOT a simple vector implementation

3. **Prototype Orderbook Contract** (separate worktree)
   - `multi_outcome_orderbook.move`: Naive orderbook implementation
   - **Performance Issue**: Uses O(n²) bubble sort + O(n) vector removal
   - **Max TPS**: ~100-500 (vs 10K+ for CPMM)

---

## CRITICAL: Trading Mechanism Selection

### Performance Comparison

| Metric | Naive Orderbook | CPMM (Current) | Econia CLOB |
|--------|----------------|----------------|-------------|
| **Complexity per trade** | O(n²) sorting | O(1) constant | O(log n) tree ops |
| **Gas cost (empty)** | ~10-15K | ~5-7K | ~8-12K |
| **Gas cost (100 orders)** | ~50-100K+ | ~5-7K | ~10-15K |
| **Parallelization** | ~10% | ~80-90% | ~60-70% |
| **Max TPS** | ~100-500 | ~10,000+ | ~5,000+ |

### Why the Naive Orderbook is Slow

The prototype `multi_outcome_orderbook.move` has fundamental performance issues:

1. **Bubble Sort O(n²)**: Every order placement triggers a full sort of order vectors
   ```move
   // Lines 554-578: sort_orders() called on EVERY order
   while (i < len) {
       while (j < len - i - 1) {  // O(n²)
           vector::swap(orders, j, j + 1);
       }
   }
   ```

2. **Vector Removal O(n)**: Matched orders shift all remaining elements
   ```move
   vector::remove(&mut book.buy_orders, 0);  // O(n) shift
   ```

3. **Sequential Matching**: Cannot parallelize the matching loop
4. **No Proper Data Structures**: Uses vectors instead of heaps/trees

### Recommended Approach

| Option | Speed | Complexity | Best For |
|--------|-------|------------|----------|
| **A: CPMM (Current)** | 10K+ TPS | Low | High throughput, simple UX |
| **B: Econia Integration** | 5K+ TPS | Medium | Full orderbook UX |
| **C: Hybrid (CPMM + Limit)** | 8K+ TPS | Medium | Best of both worlds |
| **D: Naive Orderbook** | 100-500 TPS | Low | NOT RECOMMENDED |

**Recommendation**: Use CPMM as the base trading mechanism. If orderbook UX is required, either:
1. Integrate [Econia's order book](https://econia.org/) (like Decibel does)
2. Build a hybrid where limit orders execute against AMM liquidity

### What Polymarket Has (and their bottlenecks)

| Component | Polymarket (Polygon) | Bottleneck |
|-----------|---------------------|------------|
| Order Matching | Off-chain CLOB | Single point of failure, downtime when matching server fails |
| Settlement | CTFExchange.sol | Gas costs, operator dependency |
| Indexing | 7 subgraphs (The Graph) | Sync delays cause stale prices |
| RPC | Custom eRPC proxy | Required because upstream Polygon RPC fails |
| Oracle | UMA Optimistic | 2-hour minimum delay, dispute escalation takes 48-72h |

**Documented Outages:**
- Dec 2024: 12+ hour outage due to Polygon consensus bug
- Sep 2024/2025: Multiple RPC/node sync issues
- Jan 2026: Recurring subgraph desync (5-40 min each)

## Proposed Architecture

### High-Level Design

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              APTOS L1                                        │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │                     CONDITIONAL TOKENS MODULE                          │ │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                 │ │
│  │  │   Condition  │  │   Position   │  │  Split/Merge │                 │ │
│  │  │   Registry   │  │   Tokens     │  │   Collateral │                 │ │
│  │  │              │  │  (FA std)    │  │              │                 │ │
│  │  └──────────────┘  └──────────────┘  └──────────────┘                 │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │                    PREDICTION MARKET MODULE                            │ │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                 │ │
│  │  │   Market     │  │   On-Chain   │  │  Settlement  │                 │ │
│  │  │   Factory    │  │    CLOB      │  │   Engine     │                 │ │
│  │  │              │  │ (Decibel)    │  │              │                 │ │
│  │  └──────────────┘  └──────────────┘  └──────────────┘                 │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │                       ORACLE MODULE                                    │ │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                 │ │
│  │  │    Pyth      │  │ Switchboard  │  │  Dispute DAO │                 │ │
│  │  │  (crypto)    │  │ (sports/etc) │  │ (UMA-style)  │                 │ │
│  │  └──────────────┘  └──────────────┘  └──────────────┘                 │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                    │                    │                    │
               Aptos Indexer        REST API            WebSocket
                    │                    │                    │
              ┌─────┴─────┐        ┌─────┴─────┐        ┌─────┴─────┐
              │  GraphQL  │        │  Frontend │        │  Live UI  │
              └───────────┘        └───────────┘        └───────────┘
```

## Module Breakdown

### 1. Conditional Tokens Module

**Purpose:** Port Gnosis CTF to Aptos using Fungible Asset standard

**Key Functions:**
```move
module polymarket::conditional_tokens {
    /// Prepare a condition (question with N outcomes)
    public entry fun prepare_condition(
        oracle: address,
        question_id: vector<u8>,
        outcome_count: u8,
    );

    /// Split collateral into outcome tokens
    /// 1 USDC → 1 YES + 1 NO (for binary)
    public entry fun split_position(
        account: &signer,
        condition_id: vector<u8>,
        collateral_amount: u64,
        partition: vector<u64>,  // index sets
    );

    /// Merge outcome tokens back to collateral
    /// 1 YES + 1 NO → 1 USDC
    public entry fun merge_positions(
        account: &signer,
        condition_id: vector<u8>,
        amount: u64,
    );

    /// Report payout for resolved condition
    public entry fun report_payouts(
        oracle: &signer,
        condition_id: vector<u8>,
        payouts: vector<u64>,
    );

    /// Redeem winning tokens for collateral
    public entry fun redeem_positions(
        account: &signer,
        condition_id: vector<u8>,
    );
}
```

**Data Structures:**
```move
/// A condition represents a question with possible outcomes
struct Condition has key, store {
    condition_id: vector<u8>,
    oracle: address,
    outcome_slot_count: u8,
    payout_numerators: vector<u64>,
    payout_denominator: u64,
    resolved: bool,
}

/// Position token for a specific outcome
struct PositionToken has key, store {
    condition_id: vector<u8>,
    collateral_token: Object<Metadata>,
    index_set: u64,  // Bitfield: 0b01 = YES, 0b10 = NO
    metadata: Object<Metadata>,
    mint_ref: MintRef,
    burn_ref: BurnRef,
}
```

**Patterns from Decibel to reuse:**
- `collateral_balance_sheet.move`: Balance tracking with Aggregators
- `accounts_collateral.move`: Deposit/withdraw flow
- `math.move`: Precision handling

### 2. Trading Mechanism Module

**Purpose:** Execute trades for outcome tokens

#### Option A: CPMM (Recommended for Speed)

Already implemented in `multi_outcome_market.move`. Provides:
- O(1) constant-time execution
- 80-90% parallel execution with Block-STM
- 10K+ TPS capability
- Deterministic pricing (no order queue dependency)

#### Option B: On-Chain CLOB (Decibel-Style)

Decibel uses an order book library for their CLOB. From `perp_market.move`:
```move
use order_book::market_types;
use order_book::order_book;
use order_book::order_placement;

/// Wraps order book Market type for prediction markets
enum PerpMarket has key {
    V1 {
        market: market_types::Market<perp_engine_types::OrderMetadata>,
    }
}

/// Places order via optimized matching engine
friend fun place_order_with_id(...) {
    order_placement::place_limit_order(...)
}
```

**Current Landscape (Jan 2026):**
- [Econia](https://github.com/econia-labs/econia) was the primary on-chain order book but is now **archived**
- Econia contracts remain deployed on mainnet/testnet ("persisted indefinitely")
- Decibel is launching Q1 2026 with their own order book infrastructure

**Path Forward Options:**

| Option | Pros | Cons |
|--------|------|------|
| **Use deployed Econia** | Proven ($500M+ vol), already on mainnet | Archived, no active dev |
| **Fork Econia** | Full control, can customize | Need to maintain, deploy ourselves |
| **Build optimized CLOB** | Fully custom, no dependencies | Significant engineering effort |
| **Partner with Decibel** | Use their infrastructure | Dependency on their timeline |

**Recommended Path:**
1. Fork Econia's order book modules
2. Adapt for prediction market outcomes (not perpetuals)
3. Deploy as part of our contract suite
4. Maintain independently

**Integration Pattern from Decibel:**
```move
module polymarket::prediction_market {
    use order_book::market_types;
    use order_book::order_placement;

    struct PredictionMarket has key {
        // Order book for YES token
        yes_market: market_types::Market<OutcomeMetadata>,
        // Order book for NO token
        no_market: market_types::Market<OutcomeMetadata>,
        // ... other fields
    }
}
```

#### Option C: Hybrid (CPMM + Limit Orders)

Best of both worlds approach:
```move
module polymarket::hybrid_trading {
    /// Market order executes against CPMM
    public entry fun market_buy(user: &signer, market: Object<Market>, amount: u64) {
        // Direct AMM execution - instant, O(1)
        cpmm::buy_outcome(user, market, amount);
    }

    /// Limit order places on book, matches against CPMM if price crosses
    public entry fun limit_buy(user: &signer, market: Object<Market>, price: u64, amount: u64) {
        let current_price = cpmm::get_price(market);
        if (price >= current_price) {
            // Execute immediately against AMM
            cpmm::buy_outcome(user, market, amount);
        } else {
            // Rest on book, execute when AMM price reaches limit
            orderbook::place_limit_order(user, market, price, amount);
        }
    }
}
```

#### Option D: Naive Orderbook (NOT Recommended)

The prototype `multi_outcome_orderbook.move` uses vectors with bubble sort.
**Do not use for production** - degrades to O(n²) under load.

### 3. Oracle / Resolution Module

**Purpose:** Resolve markets using multiple oracle sources

**Three-Tier Resolution:**

```move
module polymarket::oracle {
    use pyth::pyth;
    use switchboard::aggregator;

    enum ResolutionType has copy, drop, store {
        /// Auto-resolve using Pyth price feed
        PythPrice { price_id: vector<u8>, threshold: u64 },
        /// Auto-resolve using Switchboard aggregator
        Switchboard { aggregator_addr: address },
        /// Committee of trusted resolvers
        Committee { members: vector<address>, threshold: u64 },
        /// UMA-style optimistic with disputes
        Optimistic { bond: u64, challenge_period: u64 },
    }

    struct PendingResolution has key {
        condition_id: vector<u8>,
        proposed_outcome: u64,
        proposer: address,
        bond: u64,
        proposal_time: u64,
        challenged: bool,
        votes: SimpleMap<address, bool>,
    }

    /// Propose a resolution (for Optimistic type)
    public entry fun propose_resolution(
        proposer: &signer,
        condition_id: vector<u8>,
        outcome: u64,
    );

    /// Challenge a proposed resolution
    public entry fun dispute_resolution(
        disputer: &signer,
        condition_id: vector<u8>,
        counter_outcome: u64,
    );

    /// DAO vote on disputed resolution
    public entry fun vote_on_dispute(
        voter: &signer,
        condition_id: vector<u8>,
        outcome: u64,
    );

    /// Finalize resolution after challenge period
    public entry fun finalize_resolution(
        condition_id: vector<u8>,
    );
}
```

**Oracle Patterns from Decibel (`oracle/oracle.move:27-611`):**
- Multi-source oracle with failover
- Deviation detection between sources
- Staleness checks
- Health status tracking (Ok, Invalid, Down)

### 4. Prediction Market Factory

**Purpose:** Create and manage prediction markets

```move
module polymarket::market_factory {
    struct PredictionMarket has key {
        market_id: address,
        condition_id: vector<u8>,
        question: String,
        description: String,
        category: String,

        // Outcome tokens
        yes_token: Object<Metadata>,
        no_token: Object<Metadata>,

        // Order book
        orderbook: Object<OrderBook>,

        // Resolution
        resolution_type: oracle::ResolutionType,
        end_time: u64,
        resolved: bool,

        // Collateral
        collateral_token: Object<Metadata>,
        collateral_store: Object<FungibleStore>,

        // Fees
        fee_bps: u64,
        fee_treasury: address,
    }

    /// Create a new prediction market
    public entry fun create_market(
        creator: &signer,
        question: String,
        description: String,
        category: String,
        outcomes: vector<String>,
        end_time: u64,
        resolution_type: oracle::ResolutionType,
        initial_liquidity: u64,
    );
}
```

## Implementation Phases

### Phase 1: Conditional Tokens (Week 1-2)
- [ ] Port Gnosis CTF logic to Move
- [ ] Implement split/merge/redeem with Fungible Assets
- [ ] Add parallel execution with Aggregators
- [ ] Write unit tests

### Phase 2: Basic CLOB (Week 3-4)
- [ ] Implement order book data structures
- [ ] Place/cancel/match orders
- [ ] Integrate with conditional tokens
- [ ] Settlement engine

### Phase 3: Oracle Integration (Week 5-6)
- [ ] Pyth integration for crypto markets
- [ ] Switchboard integration for sports/events
- [ ] Optimistic resolution with disputes
- [ ] Committee resolution fallback

### Phase 4: Full Integration (Week 7-8)
- [ ] Market factory with all options
- [ ] Fee system
- [ ] Admin controls
- [ ] Frontend integration

### Phase 5: Production Hardening (Week 9-10)
- [ ] Security audit
- [ ] Gas optimization
- [ ] Mainnet deployment
- [ ] Monitoring setup

## Key Patterns from Decibel to Adopt

### 1. Oracle Multi-Source (`oracle/oracle.move`)
```move
enum OracleSource {
    Single { primary: SingleOracleSource },
    Composite {
        primary: SingleOracleSource,
        secondary: SingleOracleSource,
        oracles_deviation_bps: u64,
        consecutive_deviation_count: u8,
    }
}
```

### 2. Collateral Management (`accounts/accounts_collateral.move`)
- Global state with balance sheets
- Cross/isolated margin patterns
- Validation before settlement

### 3. Fee Distribution (`fees/fee_distribution.move`)
- Tiered fees based on volume
- Referral system
- Builder (frontend) fees

### 4. Public APIs (`core/public_apis.move`)
- Permissionless liquidations
- Keeper incentives
- Trigger matching

## Questions for Polymarket Team

Based on our analysis, here are targeted questions:

### Architecture
1. What's your CLOB matching throughput? (orders/sec)
2. What % of orders fail due to off-chain→on-chain race conditions?
3. Why 7 separate subgraphs instead of one?

### Bottlenecks
4. After Dec 2024 Polygon outage, what exactly broke?
5. What upstream failure rate triggered forking eRPC?
6. How much engineering time goes to reliability vs features?

### Oracle
7. What % of markets use automated vs human resolution?
8. What's your dispute rate with UMA?
9. Would faster resolution change user behavior?

### Migration
10. Would you consider a turnkey Aptos migration?
11. What's blocking multi-chain expansion?
12. Any interest in hybrid deployment (Polygon + Aptos)?

## Comparison: Polymarket vs Aptos Polymarket

| Feature | Polymarket (Polygon) | Aptos Polymarket |
|---------|---------------------|------------------|
| **Order Matching** | Off-chain CLOB | On-chain CLOB |
| **Settlement** | On-chain (gas cost) | On-chain (parallel) |
| **Finality** | 2-3 seconds | ~125ms |
| **TPS** | ~7-15 | 10,000+ |
| **Indexing** | The Graph (7 subgraphs) | Native Aptos Indexer |
| **RPC Layer** | eRPC proxy (custom) | Standard fullnodes |
| **Oracle Delay** | 2 hours minimum | Minutes (configurable) |
| **Gas Cost** | $0.01-0.10 | <$0.001 |
| **Uptime Risk** | Polygon consensus bugs | Single L1, no dependencies |

## Files to Create

```
contracts/sources/
├── conditional_tokens/
│   ├── condition.move
│   ├── position.move
│   └── split_merge.move
├── orderbook/
│   ├── order.move
│   ├── book.move
│   └── matching.move
├── oracle/
│   ├── pyth_resolver.move
│   ├── switchboard_resolver.move
│   ├── committee_resolver.move
│   └── optimistic_resolver.move
├── market/
│   ├── factory.move
│   ├── trading.move
│   └── settlement.move
└── fees/
    ├── fee_manager.move
    └── treasury.move
```

## Two-Track Strategy

### Track 1: Demo (Max TPS Showcase)
**Goal**: Show Polymarket team what Aptos can do

| Component | Approach | Status |
|-----------|----------|--------|
| Trading | CPMM (`multi_outcome_market.move`) | ✅ Done |
| TPS | 10K+ via HFT server | ✅ Done |
| UI | Live trade stream, market view | ✅ Done |

**Demo Message**: "Aptos can process 10,000+ prediction market trades per second with sub-second finality - impossible on Polygon."

### Track 2: Production (Scalable System)
**Goal**: Build what Polymarket would actually deploy

| Component | Approach | Status |
|-----------|----------|--------|
| Trading | Decibel-style CLOB (fork Econia) | 🔲 Planning |
| Conditional Tokens | Port Gnosis CTF to Move | 🔲 Planning |
| Oracle | Pyth + Switchboard + Dispute DAO | 🔲 Planning |
| Indexing | Native Aptos Indexer | 🔲 Planning |

**Production Message**: "Full orderbook UX like Polymarket, but fully on-chain with no single point of failure."

---

## Next Steps

### Immediate (Demo Track)
- [x] CPMM trading contract
- [x] HFT server for 10K+ TPS
- [x] Live UI with trade stream
- [ ] Polish demo flow for Polymarket meeting

### Short-term (Production Track)
1. **Fork Econia order book** - Get the source, understand the architecture
2. **Create `conditional_tokens/condition.move`** - Port Gnosis CTF logic
3. **Adapt order book for outcomes** - YES/NO tokens instead of perpetuals
4. **Integration tests** - Verify CLOB + conditional tokens work together

### Medium-term (Production Track)
1. **Oracle integration** - Pyth for crypto, Switchboard for events
2. **Dispute resolution** - UMA-style optimistic oracle on Aptos
3. **Fee system** - Volume tiers, referrals, builder fees (copy Decibel patterns)
4. **Security audit** - Before mainnet deployment

## Key Insight: Why Polymarket Uses Off-Chain CLOB

Polymarket chose off-chain matching because:
1. **Polygon limitations**: ~7-15 TPS, 2-3s finality, no parallel execution
2. **Gas costs**: On-chain matching on Polygon is expensive
3. **User experience**: They need sub-second response times

**Why Aptos Can Go Fully On-Chain:**
- **10,000+ TPS**: Enough for high-frequency trading
- **~125ms finality**: Faster than most off-chain systems
- **Block-STM parallelization**: Multiple markets trade simultaneously
- **<$0.001 gas**: On-chain matching is economically viable

**The Aptos Advantage:**
```
Polymarket Architecture:
  User → Off-chain CLOB (single point of failure) → On-chain Settlement

Aptos Polymarket Architecture:
  User → On-chain CLOB/AMM (no single point of failure) → Instant Finality
```

This eliminates:
- CLOB server downtime
- Order reconciliation issues
- Off-chain/on-chain race conditions
- The need for eRPC fault-tolerant proxy

---

## Decision Matrix for Polymarket Team

| Question | If Yes → | If No → |
|----------|----------|---------|
| Need traditional limit order UX? | Econia or Hybrid | CPMM |
| Need max throughput (10K+ TPS)? | CPMM | Any option works |
| Want to replicate Polymarket exactly? | Hybrid | CPMM |
| Need price-time priority matching? | Econia | CPMM |
| Want simplest implementation? | CPMM | - |

---

## References

- [Gnosis CTF Developer Guide](https://conditional-tokens.readthedocs.io/en/latest/developer-guide.html)
- [Decibel Contracts](./reference/decibel-contracts/MODULE_INDEX.md)
- [Aptos Oracle Guide](https://aptos.dev/build/guides/oracles)
- [Panana Predictions](https://github.com/servrox-solutions/panana-predictions)
- [Polymarket CTF Exchange](https://github.com/Polymarket/ctf-exchange)
- [Econia Order Book](https://github.com/econia-labs/econia) - Hyper-parallelized CLOB for Aptos
- [Econia Case Study](https://aptosnetwork.com/currents/econia-built-different-case-study) - Performance analysis
