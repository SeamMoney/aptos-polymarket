# Polymarket Investigation Questions

## Purpose
Questions to ask the Polymarket team to understand their pain points and how Aptos can solve them.

---

## 1. CLOB / Order Matching (Off-chain)

**Context:** Polymarket uses an off-chain CLOB with on-chain settlement. When their matching server goes down, trading halts.

| # | Question | Why We Ask |
|---|----------|------------|
| 1 | What's your peak order matching throughput (orders/second)? | Aptos can handle 1M+ on-chain |
| 2 | How do you handle order book state during network partitions? | We eliminate this with on-chain matching |
| 3 | Is the CLOB horizontally scalable? How many matching engines run in parallel? | Single point of failure concern |
| 4 | What's the latency from order submission to matching acknowledgment? | Aptos: <200ms end-to-end |
| 5 | What happens to matched orders if on-chain settlement fails? Reconciliation process? | On-chain = atomic, no reconciliation needed |

---

## 2. RPC / Infrastructure

**Context:** They forked eRPC to build a fault-tolerant RPC proxy. Commits show memory issues, connection churn, and consensus problems.

| # | Question | Why We Ask |
|---|----------|------------|
| 6 | What upstreams do you use? (Alchemy, QuickNode, Infura, public?) | Aptos fullnodes are more reliable |
| 7 | What's your typical RPC failure rate? How often does circuit breaker trip? | Quantify the problem |
| 8 | How do you handle reorgs in caching? Typical reorg depth on Polygon? | Aptos has instant finality |
| 9 | What's your RPC request rate during peak trading hours? | Sizing comparison |
| 10 | Have you experienced full provider outages? Recovery time? | Aptos: no RPC layer needed |

---

## 3. Subgraph / Indexing

**Context:** They run 7 separate subgraphs. Status page shows frequent "data ingestion not syncing" errors.

| # | Question | Why We Ask |
|---|----------|------------|
| 11 | Why 7 separate subgraphs instead of one unified subgraph? | Complexity concern |
| 12 | What's the typical indexing lag from on-chain event to queryable data? | Aptos indexer: <1 second |
| 13 | Have you experienced subgraph desync issues? Detection/recovery? | We eliminate this dependency |
| 14 | Which subgraph is queried most heavily? | Priority for migration |
| 15 | Do you use Goldsky, The Graph network, or self-hosted graph-node? | Infrastructure comparison |
| 16 | What's the data freshness requirement for your frontend? | Aptos indexer handles this natively |

---

## 4. On-Chain Settlement (CTFExchange)

**Context:** Their CTFExchange contract handles atomic swaps between ERC1155 outcome tokens and USDC.

| # | Question | Why We Ask |
|---|----------|------------|
| 17 | What's the typical gas cost for fillOrder vs fillOrders (batch)? Batch diminishing returns? | Aptos: ~1000x cheaper |
| 18 | How do you handle Polygon congestion? Dynamic gas pricing? | Aptos: consistent low fees |
| 19 | Settlement latency from match to on-chain confirmation? | Aptos: ~125ms finality |
| 20 | How often do you hit the "onlyOperator" constraint? Multiple operators? | We can make permissionless |
| 21 | What % of trades use MINT vs MERGE vs NORMAL matching? Gas comparison? | Optimization opportunity |

---

## 5. Oracle / Resolution

**Context:** They use UMA Optimistic Oracle with 2-hour minimum delay. Disputes escalate to DVM taking 48-72 hours.

| # | Question | Why We Ask |
|---|----------|------------|
| 22 | What % of markets require dispute resolution vs clean optimistic resolution? | Scope of dispute system |
| 23 | How do you handle markets where UMA resolution takes 48-72 hours? Trading halted? | User experience concern |
| 24 | Have you experienced oracle manipulation attempts? | Security patterns |
| 25 | What % of markets are crypto-price-based (could use Pyth)? | Immediate automation |
| 26 | What % are sports/events (could use Switchboard)? | Resolution strategy |
| 27 | What % require human judgment (politics, etc.)? | Committee design |

---

## 6. Historical Incidents

**Context:** Documented outages from status page and news articles.

| # | Question | Why We Ask |
|---|----------|------------|
| 28 | December 2024 Polygon outage (12+ hours): What specifically broke? | Root cause analysis |
| 29 | How much trading volume was lost during outages? | Business impact |
| 30 | What monitoring detects issues before users notice? | Observability patterns |
| 31 | Post-mortems available for major incidents? | Learning opportunity |

---

## 7. Business / Migration

| # | Question | Why We Ask |
|---|----------|------------|
| 32 | Team mentioned building own L2 - timeline and status? | Competitive landscape |
| 33 | What's blocking multi-chain expansion today? | Technical barriers |
| 34 | Would you consider a turnkey migration if we handle technical lift? | Partnership opportunity |
| 35 | Interest in hybrid deployment (Polygon + Aptos)? | Gradual migration path |
| 36 | What % of engineering time goes to reliability vs features? | Value proposition |

---

## Evidence from GitHub Issues

### clob-client issues (reliability-related)
- `#248`: POLY_ADDRESS header uses wrong address for Magic wallet
- `#244`: Request for order timeout/abort functionality
- `#232`: Invalid tick size on market orders
- `#191`: Intermittent order failures with pricing errors
- `#176`: L2 auth header creation returns 401

### py-clob-client issues
- `#231`: HTTP 500 "Order crosses the book" for GTC orders
- `#208`: HTTP 405 error on CLOB
- `#204`: "Connection to remote host was lost"
- `#202`: `get_market_trades_events` returns 404

### eRPC commits (what they fixed)
- `#428`: "clone under lock to avoid corrupted responses under high-load"
- `#399`: "properly reuse connections to avoid high churn"
- `#417`: "memory improvements on response handling"
- `#421`: "decrease score of misbehaving upstreams"
- `#404`: "classify empty point-lookup as missing data (enables retries)"

---

## Reverse Engineering Opportunities

### 1. Monitor Their Status Page
```
https://status.polymarket.com/
```
Track incidents to understand failure frequency.

### 2. Query Their Subgraphs
```graphql
{
  _meta {
    block { number }
    hasIndexingErrors
  }
}
```
Check indexing health and lag.

### 3. Compare Off-Chain vs On-Chain
- Subscribe to WebSocket price feeds
- Compare with on-chain settlement events
- Delta = system lag or inconsistency

### 4. Gas Analysis
- Monitor CTFExchange transactions on Polygonscan
- Track gas costs during congestion periods
- Compare with Aptos transaction costs

---

## What Aptos Solves

| Polymarket Problem | Root Cause | Aptos Solution |
|-------------------|------------|----------------|
| CLOB downtime | Off-chain matching server | On-chain CLOB (Decibel pattern) |
| Subgraph desync | External dependency | Native Aptos Indexer |
| RPC failures | Polygon node issues | Reliable fullnodes, no proxy needed |
| Settlement delays | Polygon congestion | 10,000+ TPS, ~125ms finality |
| High gas costs | Polygon pricing | <$0.001 per transaction |
| Oracle delays (2h+) | UMA optimistic period | Pyth (instant) + configurable disputes |
| Reorg risk | Polygon block production | Instant finality |
| L2 dependency | Building own chain | Use Aptos L1 directly |
