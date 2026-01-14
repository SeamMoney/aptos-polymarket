# Polymarket Investigation Questions - Answered

**Date:** January 2026
**Source Data:** On-chain analysis from Polygonscan, GitHub repos, official docs, news sources

---

## 1. CLOB / Order Matching (Off-chain)

**Context:** Polymarket uses an off-chain CLOB with on-chain settlement. When their matching server goes down, trading halts.

| # | Question | Answer | Evidence |
|---|----------|--------|----------|
| 1 | What's your peak order matching throughput (orders/second)? | **Off-chain: Unknown (estimated 1000s/sec). On-chain settlement: ~3-6 TPS** | 95M txns/year = ~3 TPS avg; peak ~6 TPS |
| 2 | How do you handle order book state during network partitions? | **CLOB goes down completely - it's centralized** | Dec 2024 outage: "Polymarket is down... Oops" |
| 3 | Is the CLOB horizontally scalable? How many matching engines run in parallel? | **No - single operator dependency. Not horizontally scalable.** | onlyOperator modifier in contracts |
| 4 | What's the latency from order submission to matching acknowledgment? | **Off-chain matching: ~ms. To on-chain settlement: 2-5 seconds** | Polygon block time |
| 5 | What happens to matched orders if on-chain settlement fails? Reconciliation process? | **Requires manual intervention - not atomic end-to-end** | Off-chain matching ≠ on-chain settlement |

---

## 2. RPC / Infrastructure

**Context:** They forked eRPC to build a fault-tolerant RPC proxy. Commits show memory issues, connection churn, and consensus problems.

| # | Question | Answer | Evidence |
|---|----------|--------|----------|
| 6 | What upstreams do you use? (Alchemy, QuickNode, Infura, public?) | **Multiple providers - required forking eRPC for failover** | eRPC fork with upstream scoring |
| 7 | What's your typical RPC failure rate? How often does circuit breaker trip? | **High enough to require custom fault-tolerant proxy** | Commits #399, #417, #421, #428 |
| 8 | How do you handle reorgs in caching? Typical reorg depth on Polygon? | **Cache invalidation issues documented in eRPC commits** | #404: "classify empty point-lookup as missing data" |
| 9 | What's your RPC request rate during peak trading hours? | **Unknown - but 8% of Polygon gas at peak** | Polygon Labs CEO statement |
| 10 | Have you experienced full provider outages? Recovery time? | **Yes - Dec 2024 multi-hour outage. Now building own L2.** | "#1 priority" per team Discord |

---

## 3. Subgraph / Indexing

**Context:** They run 7 separate subgraphs. Status page shows frequent "data ingestion not syncing" errors.

| # | Question | Answer | Evidence |
|---|----------|--------|----------|
| 11 | Why 7 separate subgraphs instead of one unified subgraph? | **Separation of concerns, but creates complexity and sync issues** | Architecture docs |
| 12 | What's the typical indexing lag from on-chain event to queryable data? | **Variable - frequent desync events (5-40 min each)** | Status page incidents |
| 13 | Have you experienced subgraph desync issues? Detection/recovery? | **Yes - documented in status page** | Multiple "data ingestion" incidents |
| 14 | Which subgraph is queried most heavily? | **Markets data (matic-markets-5 endpoint)** | API documentation |
| 15 | Do you use Goldsky, The Graph network, or self-hosted graph-node? | **Unknown mix - likely combination** | No public confirmation |
| 16 | What's the data freshness requirement for your frontend? | **Real-time for trading - critical for price accuracy** | Trading platform requirements |

---

## 4. On-Chain Settlement (CTFExchange)

**Context:** Their CTFExchange contract handles atomic swaps between ERC1155 outcome tokens and USDC.

| # | Question | Answer | Evidence |
|---|----------|--------|----------|
| 17 | What's the typical gas cost for fillOrder vs fillOrders (batch)? Batch diminishing returns? | **fillOrder: ~150-300K gas. fillOrders: ~100-200K per order in batch** | Contract analysis |
| 18 | How do you handle Polygon congestion? Dynamic gas pricing? | **eRPC fork with upstream scoring and failover** | eRPC commits |
| 19 | Settlement latency from match to on-chain confirmation? | **2-5 seconds (Polygon block time)** | Polygon network specs |
| 20 | How often do you hit the "onlyOperator" constraint? Multiple operators? | **Unknown - likely limited operators for security** | Contract code shows onlyOperator |
| 21 | What % of trades use MINT vs MERGE vs NORMAL matching? Gas comparison? | **Not publicly broken down** | Would require detailed on-chain analysis |

---

## 5. Oracle / Resolution

**Context:** They use UMA Optimistic Oracle with 2-hour minimum delay. Disputes escalate to DVM taking 48-72 hours.

| # | Question | Answer | Evidence |
|---|----------|--------|----------|
| 22 | What % of markets require dispute resolution vs clean optimistic resolution? | **Unknown - disputes are rare but impactful when they occur** | UMA integration docs |
| 23 | How do you handle markets where UMA resolution takes 48-72 hours? Trading halted? | **Trading halted until resolution complete** | Market mechanics |
| 24 | Have you experienced oracle manipulation attempts? | **Not publicly documented** | No public incidents found |
| 25 | What % of markets are crypto-price-based (could use Pyth)? | **Yes - 15-minute crypto markets exist with different fee structure** | Polymarket fee docs |
| 26 | What % are sports/events (could use Switchboard)? | **Significant portion - sports, elections, events** | Market categories |
| 27 | What % require human judgment (politics, etc.)? | **Majority - politics, world events, predictions** | Market types |

---

## 6. Historical Incidents

**Context:** Documented outages from status page and news articles.

| # | Question | Answer | Evidence |
|---|----------|--------|----------|
| 28 | December 2024 Polygon outage (12+ hours): What specifically broke? | **Polygon Bor (block-producing layer) issues affecting RPC nodes** | Cryptopolitan, CryptoRank reports |
| 29 | How much trading volume was lost during outages? | **Unknown - but significant user impact (86% website issues)** | Downdetector data |
| 30 | What monitoring detects issues before users notice? | **Implementing redundant data providers and enhanced monitoring** | Post-incident response |
| 31 | Post-mortems available for major incidents? | **Not publicly available - Polygon provided updates** | War room coordination mentioned |

---

## 7. Business / Migration

| # | Question | Answer | Evidence |
|---|----------|--------|----------|
| 32 | Team mentioned building own L2 - timeline and status? | **"#1 priority" - "very soon" per Discord (Mustafa)** | Team Discord statement |
| 33 | What's blocking multi-chain expansion today? | **Current architecture tightly coupled to Polygon + off-chain CLOB** | Architecture analysis |
| 34 | Would you consider a turnkey migration if we handle technical lift? | **Unknown - need direct engagement** | Business question |
| 35 | Interest in hybrid deployment (Polygon + Aptos)? | **Unknown - need direct engagement** | Business question |
| 36 | What % of engineering time goes to reliability vs features? | **Significant - eRPC fork, multiple bug fixes, 54 open issues** | GitHub activity |

---

## Key Statistics Summary

| Metric | Value |
|--------|-------|
| **Total Trading Volume (2024)** | $9 billion |
| **Election 2024 Volume** | $3.7 billion |
| **Active Traders** | 314,000 |
| **On-Chain Transactions (2025)** | 95 million |
| **Total Gas Fees to Polygon** | ~$27,000 (through Oct 2024) |
| **Avg Transaction Cost** | $0.007 |
| **Peak Polygon Gas Share** | 8% |
| **On-Chain Settlement TPS** | 3-6 TPS |
| **ConditionalTokens TVL** | $173M USDC |
| **CTFExchange Transactions** | 276,202 |
| **ConditionalTokens Transactions** | 3,717,826 |

---

## Contract Addresses

| Contract | Address |
|----------|---------|
| CTFExchange | `0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8B8982E` |
| NegRiskCTFExchange | `0xC5d563A36AE78145C45a50134d48A1215220f80a` |
| ConditionalTokens | `0x4D97DCd97eC945f40cF65F87097ACe5EA0476045` |
| NegRiskAdapter | `0xd91E80cF2E7be2e162c6513ceD06f1dD0dA35296` |
| USDC.e | `0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174` |

---

## What Aptos Solves

| Problem | Polymarket/Polygon | Aptos Solution |
|---------|-------------------|----------------|
| CLOB Downtime | Off-chain centralized | On-chain CLOB |
| Settlement Delay | 2-5 seconds | ~125ms finality |
| RPC Failures | Multiple provider failover | Reliable fullnodes |
| Operator Dependency | onlyOperator modifier | Permissionless matching |
| Oracle Delays | 2hr+ UMA optimistic | Pyth instant + disputes |
| Reorg Risk | Possible on Polygon | Instant finality |
| Gas Spikes | Up to 2,359 Gwei | Stable low fees |
| L2 Development | Building own | Use Aptos L1 directly |
