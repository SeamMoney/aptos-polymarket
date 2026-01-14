# Polymarket Deep Infrastructure Investigation Report

**Date:** January 2026
**Purpose:** Reverse-engineer Polymarket's infrastructure to understand architecture, bottlenecks, gas costs, peak TPS, and chain congestion impact.

---

## Executive Summary

This investigation analyzed Polymarket's entire on-chain footprint on Polygon, their off-chain CLOB architecture, and historical incidents to provide a complete picture of their infrastructure strengths and weaknesses.

**Key Findings:**
- **$9 billion** trading volume in 2024, **$3.7 billion** on the election alone
- **4.37 million** on-chain settlement transactions across all contracts
- **~3-6 TPS** on-chain settlement (off-chain CLOB handles actual matching)
- **$27,000** total gas fees to Polygon through Oct 2024 (~$0.007/tx)
- **4 critical bottlenecks** identified: Off-chain CLOB, UMA Oracle delays, RPC/Indexing, Operator dependency
- **Polymarket did NOT cause** Polygon congestion; they were **affected by** Polygon infrastructure issues
- **Building own L2** is now their "#1 priority" after December 2024 outage

---

## 1. Complete Contract Architecture

### Core Contracts on Polygon

| Contract | Address | Transactions | TVL/Balance | Purpose |
|----------|---------|--------------|-------------|---------|
| **CTFExchange** | `0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8B8982E` | 276,202 | $473 USDC | Main trading settlement |
| **NegRiskCTFExchange** | `0xC5d563A36AE78145C45a50134d48A1215220f80a` | 103,526 | $3 USDC | Multi-outcome markets |
| **ConditionalTokens** | `0x4D97DCd97eC945f40cF65F87097ACe5EA0476045` | 3,717,826 | **$173M USDC** | ERC1155 outcome tokens |
| **NegRiskAdapter** | `0xd91E80cF2E7be2e162c6513ceD06f1dD0dA35296` | 270,194 | $978 | Links binary markets |
| **USDC.e** | `0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174` | - | Collateral | Settlement currency |

**Total On-Chain Settlement Transactions: ~4.37 million**

### Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    APPLICATION LAYER                         │
│  Web Frontend │ Mobile Apps │ Third-Party Integrations       │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                     SERVICE LAYER                            │
│  ┌─────────────┐  ┌──────────┐  ┌─────────────┐            │
│  │ CLOB API    │  │ Data API │  │ Gamma API   │            │
│  │ (Off-chain) │  │          │  │             │            │
│  │ BOTTLENECK! │  │          │  │             │            │
│  └─────────────┘  └──────────┘  └─────────────┘            │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    PROTOCOL LAYER                            │
│  ┌───────────────┐  ┌───────────────┐  ┌────────────────┐  │
│  │ CTFExchange   │  │ CTF Core      │  │ UMA Oracle     │  │
│  │ Settlement    │  │ ERC1155       │  │ Resolution     │  │
│  │ 276K txns     │  │ 3.7M txns     │  │ 2hr+ delay     │  │
│  └───────────────┘  └───────────────┘  └────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### How the System Works

1. **User places order** → Signed EIP712 message sent to off-chain CLOB
2. **CLOB matches orders** → Centralized operator finds matching counterparties
3. **Operator submits settlement** → `fillOrder()` or `fillOrders()` called on-chain
4. **Tokens transfer atomically** → CTFExchange handles ERC1155 + USDC swaps
5. **Market resolution** → UMA Oracle proposes outcome, 2hr+ challenge period

---

## 2. Trading Volume & Activity Statistics

### 2024-2025 Performance

| Metric | Value | Source |
|--------|-------|--------|
| **Total Trading Volume (2024)** | $9 billion | The Block |
| **2024 Election Volume** | $3.7 billion | Multiple sources |
| **Monthly ATH (Nov 2024)** | $2.63 billion | ChainCatcher |
| **Active Traders (Dec 2024)** | 314,000 | The Block |
| **Total On-Chain Txns (2025)** | 95 million | ChainCatcher |
| **Peak Open Interest** | $510 million | Nov 2024 |

### Daily Activity Peaks

| Period | Volume | Active Users | Notes |
|--------|--------|--------------|-------|
| Election Week Nov 2024 | ~$1B weekly | 191,000+ | 90% election-related |
| October 2024 | $2.5B monthly | 191,000 | 76-91% election |
| December 2024 | $2.63B monthly | 314,500 | ATH traders |

### Growth Trajectory

- January 2024: $54 million volume
- November 2024: $2.63 billion volume
- **48x growth** in 11 months

---

## 3. Gas Cost Analysis

### Polymarket Gas Fees on Polygon

| Metric | Value | Notes |
|--------|-------|-------|
| **Total Fees to Polygon (Oct 2024)** | ~$27,000 | Entire year to date |
| **Avg Cost Per Transaction** | ~$0.007 | Extremely low |
| **Typical Gas Per Fill** | 150,000-300,000 gas | fillOrder function |
| **Gas Price (Normal)** | 50-150 Gwei | Typical range |
| **Gas Price (Peak Jan 2026)** | 2,359 Gwei | Network congestion |

### Why Gas Costs Are So Low

1. **Off-chain CLOB**: Most computation happens off-chain
2. **Batch settlements**: Multiple orders settled in single tx
3. **Polygon L2**: Inherently cheaper than Ethereum L1
4. **Meta-transactions**: Platform absorbs user gas costs

### Fee Structure

- **No trading fees** on most markets
- **No platform fees** on winnings
- **Taker fees** only on 15-minute crypto markets (redistributed to market makers)
- Users only pay for deposit/withdrawal blockchain costs

### Comparison with Aptos

| Metric | Polygon/Polymarket | Aptos |
|--------|-------------------|-------|
| Avg Tx Cost | $0.007 | <$0.001 |
| Settlement Time | 2-5 seconds | ~125ms |
| Finality | Probabilistic | Instant |
| TPS Capacity | ~1,000 (claimed) | 160,000+ |

---

## 4. Peak TPS Analysis

### Polymarket's Polygon Footprint

| Metric | Value | Notes |
|--------|-------|-------|
| **Peak Gas Usage Share** | 8% of Polygon | Oct 2024 |
| **Daily Txns (Polygon-wide)** | 5.3 million | Jan 2026 |
| **Polymarket Daily Txns (est.)** | ~250-500K | During peaks |
| **Implied TPS (Polymarket)** | 3-6 TPS | Settlement only |

### TPS Calculation

```
Average:
95 million txns / 365 days = 260,274 txns/day
260,274 / 86,400 seconds = ~3 TPS

Peak periods (election):
~500,000 txns/day estimated = ~5.8 TPS
```

### Critical Insight: Why TPS Seems Low

This is **ONLY on-chain settlement TPS**. The actual order matching happens off-chain:

| Component | TPS | Where |
|-----------|-----|-------|
| Order Matching | 1000s/sec (estimated) | Off-chain CLOB |
| Settlement | 3-6 TPS | On-chain |

**Implication**: Polymarket's architecture relies entirely on centralized off-chain infrastructure. The blockchain is just a settlement layer.

---

## 5. Bottlenecks Identified

### Critical Bottleneck #1: Off-Chain CLOB (Single Point of Failure)

```
User Order → Off-Chain CLOB (CENTRALIZED) → On-Chain Settlement
                    │
                    └── IF CLOB DOWN = TRADING HALTS
```

**Evidence**:
- December 2024: Polygon RPC issues = full Polymarket downtime
- Error message: "Polymarket is down... Oops... we didn't forecast this"
- Team response: "#1 priority" is building own L2

**GitHub Issues (py-clob-client) - 54 open issues including**:
- HTTP 500 "Order crosses the book"
- HTTP 404/405 errors on endpoints
- "Connection to remote host was lost"
- Order book returns stale data (0.99/0.01)
- Price validation failures (API rejects valid prices)

### Critical Bottleneck #2: UMA Oracle (2+ Hour Delays)

| Phase | Duration | Risk |
|-------|----------|------|
| Proposal Period | 2 hours minimum | Trading frozen |
| Dispute Period | 48-72 hours | Extended delays |
| DVM Voting | Additional days | Extreme cases |

**Impact**: Markets cannot resolve quickly. Even obvious outcomes (e.g., who won an election) take 2+ hours minimum.

### Critical Bottleneck #3: RPC/Indexing Dependency

**From eRPC commits (Polymarket fork)**:
- `#428`: "clone under lock to avoid corrupted responses under high-load"
- `#399`: "properly reuse connections to avoid high churn"
- `#417`: "memory improvements on response handling"
- `#421`: "decrease score of misbehaving upstreams"
- `#404`: "classify empty point-lookup as missing data (enables retries)"

**7 Separate Subgraphs** with frequent "data ingestion not syncing" errors.

### Critical Bottleneck #4: Operator Dependency

```solidity
modifier onlyOperator() {
    require(operators[msg.sender], "Only operator");
    _;
}

function fillOrder(...) external nonReentrant onlyOperator { ... }
function fillOrders(...) external nonReentrant onlyOperator { ... }
function matchOrders(...) external onlyOperator { ... }
```

**Issues**:
- Only designated operators can submit settlements
- Creates censorship risk
- Single point of failure
- Requires trust in operator

---

## 6. Chain Congestion Analysis

### Did Polymarket Cause Polygon Congestion?

| Question | Answer | Evidence |
|----------|--------|----------|
| Peak Polygon gas share? | 8% | Oct 2024 data |
| Caused network-wide congestion? | **No** | Polygon handled volume fine |
| Affected by congestion? | **Yes** | Dec 2024 & Jan 2026 outages |
| Root cause? | Polygon infrastructure | RPC/node issues, not Polymarket |

### Gas Price Correlation

| Date | Gas Price | Event |
|------|-----------|-------|
| Jan 5-6, 2026 | 2,359 Gwei | Network congestion (not Polymarket) |
| Nov 2024 Election | ~100-200 Gwei | Heavy Polymarket activity |
| Normal | 50-150 Gwei | Baseline |

**Conclusion**: Polymarket's 8% gas share did NOT cause network congestion. The high gas events were Polygon infrastructure issues that AFFECTED Polymarket.

---

## 7. Historical Incidents

### December 2024 Outage (Major)

| Aspect | Detail |
|--------|--------|
| **Date** | December 18, 2024 |
| **Root Cause** | Polygon PoS network issues affecting Bor (block-producing layer) |
| **Impact** | Full Polymarket downtime |
| **User Symptoms** | 86% website issues, 11% login failures, 3% test failures |
| **Duration** | Multiple hours |
| **Resolution** | Polygon patched bug, "war room" coordination |
| **Response** | Polymarket now prioritizing own L2 |

### Ongoing Issues (From GitHub)

| Issue Type | Count | Examples |
|------------|-------|----------|
| API Errors | 15+ | HTTP 404, 405, 500 |
| Connection Issues | 5+ | "Connection to remote host was lost" |
| Data Staleness | 3+ | Order book returns 0.99/0.01 |
| Price Validation | 5+ | API rejects valid prices |
| Authentication | 3+ | L2 auth header returns 401 |

### Status Page Incidents

Frequent "data ingestion not syncing" errors across their 7 subgraphs, indicating ongoing indexing reliability issues.

---

## 8. Smart Contract Analysis

### CTFExchange Functions

| Function | Purpose | Gas Usage |
|----------|---------|-----------|
| `fillOrder()` | Single order settlement | ~150-300K gas |
| `fillOrders()` | Batch order settlement | ~100-200K per order |
| `matchOrders()` | Taker-maker matching | Variable |
| `registerToken()` | Register outcome tokens | ~50-100K gas |

### Match Types

| Type | Description | When Used |
|------|-------------|-----------|
| **NORMAL** | Direct token swap | User-to-user trade |
| **MINT** | Create new outcome tokens | Both parties buying |
| **MERGE** | Burn tokens for collateral | Both parties selling |

### Fee Configuration

- **Max Fee Rate**: 1000 basis points (10%)
- **Current Trading Fee**: 0% on most markets
- **Fee Formula**: `baseRate × min(price, 1-price) × size`

---

## 9. What Aptos Solves

### Problems and Solutions

| Polymarket Problem | Root Cause | Aptos Solution |
|-------------------|------------|----------------|
| CLOB downtime | Off-chain centralized | **On-chain CLOB** (no SPOF) |
| Settlement delays | Polygon 2-5 sec | **~125ms finality** |
| RPC failures | Node infrastructure | **Reliable fullnodes** |
| Operator dependency | onlyOperator modifier | **Permissionless matching** |
| Oracle delays (2hr+) | UMA optimistic period | **Pyth instant + configurable disputes** |
| Reorg risk | Polygon consensus | **Instant finality** |
| Gas spikes | Polygon congestion | **Stable low fees** |
| Own L2 needed | Polygon unreliable | **Use Aptos L1 directly** |

### Quantified Improvements

| Metric | Polymarket/Polygon | Aptos | Improvement |
|--------|-------------------|-------|-------------|
| Finality | 2-5 seconds | 125ms | **20-40x faster** |
| On-chain TPS | ~3-6 (settlement) | 10,000+ | **1,600x+ capacity** |
| Gas cost | $0.007 | <$0.001 | **7x+ cheaper** |
| Reorg risk | Yes | None | **Eliminated** |
| CLOB | Off-chain (SPOF) | On-chain | **No single point of failure** |

---

## 10. Sources

- [The Block - Polymarket's Huge Year: $9B Volume, 314K Traders](https://www.theblock.co/post/333050/polymarkets-huge-year-9-billion-in-volume-and-314000-active-traders-redefine-prediction-markets)
- [ChainCatcher - 95M Transactions Analysis](https://www.chaincatcher.com/en/article/2233047)
- [Cryptopolitan - Polymarket L2 After Polygon Disruption](https://www.cryptopolitan.com/polymarket-l2-polygon-network-disruption/)
- [RockNBlock - How Polymarket Works](https://rocknblock.io/blog/how-polymarket-works-the-tech-behind-prediction-markets)
- [Polymarket CLOB Documentation](https://docs.polymarket.com/developers/CLOB/introduction)
- [GitHub - Polymarket CTF Exchange](https://github.com/Polymarket/ctf-exchange)
- [PolygonScan - Contract Data](https://polygonscan.com/)
- [Polymarket Trading Fees Docs](https://docs.polymarket.com/polymarket-learn/trading/fees)
