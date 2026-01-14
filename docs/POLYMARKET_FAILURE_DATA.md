# Polymarket & Polygon Failure Data

**Purpose:** Evidence to demonstrate why Aptos is a better infrastructure choice.

---

## 1. Platform Outages

### Documented Incidents

| Date | Duration | Root Cause | User Impact | Source |
|------|----------|------------|-------------|--------|
| **Dec 18, 2024** | Multi-hour | Polygon consensus bug | Full trading halt | [Cryptopolitan](https://www.cryptopolitan.com/polymarket-l2-polygon-network-disruption/) |
| **July 30, 2025** | ~1 hour | Polygon Heimdall consensus | Trading frozen | [CoinJournal](https://coinjournal.net/news/polygon-team-blames-temporary-outage-on-suspected-consensus-bug/) |
| **Nov 2025** | Hours | Cloudflare disruption | 86% users affected | [TheStreet](https://www.thestreet.com/crypto/outage/polymarket-goes-down-as-users-flood-outage-reports) |
| **Dec 5, 2025** | 20 minutes | Site outage | Full unavailability | Status page |
| **Dec 18-19, 2025** | Hours | Polygon network | Trading disrupted | [Unchained](https://unchainedcrypto.com/polymarket-resolves-issues-after-polygon-network-disruption/) |
| **Dec 30, 2025** | Multiple short | Markets API | Search broken | Status page |

### User Impact Statistics (Nov 2025 Outage)
- **86%** reported website issues
- **11%** couldn't log in
- **3%** couldn't start tests
- **Downdetector spike** visible

### Response
> "The platform is about to take its own Layer 2 (L2) seriously... It's the #1 priority." - Polymarket team member (Discord)

---

## 2. UMA Oracle Failures

### Major Incidents

#### March 2025: $7 Million Governance Attack
| Aspect | Detail |
|--------|--------|
| **Market** | "Will Ukraine agree to Trump's mineral deal before April?" |
| **Manipulation** | Price moved from 9% → 100% (incorrect) |
| **Attacker** | UMA whale with **5 million tokens** (25% voting power) |
| **Method** | 3 accounts used to concentrate votes |
| **$ Lost** | **$7 million** |
| **Outcome** | Resolved "Yes" despite no official agreement |

#### Multiple Wrong Resolutions
| Incident | What Happened |
|----------|---------------|
| **Confirmed Wrong** | Polymarket officially stated UMA reached incorrect outcome |
| **User Impact** | "Yes" holders lost everything when market resolved "No" |
| **Appeal Process** | None - "Code is law" |
| **Quote** | "The finality of the blockchain becomes a curse when the input data is flawed, leaving users with empty wallets." |

### Systemic Issues

| Problem | Evidence |
|---------|----------|
| **Concentrated Power** | Single whale controlled 25% of votes |
| **Slow Resolution** | 2-hour minimum, 48-72 hours for disputes |
| **Ambiguous Markets** | Wording creates interpretation disputes |
| **No Appeals** | Wrong outcomes are final |

---

## 3. Infrastructure Issues

### eRPC Fork Evidence (Polymarket forked eRPC)

| Commit | Issue Fixed |
|--------|-------------|
| `#428` | "clone under lock to avoid corrupted responses under high-load" |
| `#399` | "properly reuse connections to avoid high churn" |
| `#417` | "memory improvements on response handling" |
| `#421` | "decrease score of misbehaving upstreams" |
| `#404` | "classify empty point-lookup as missing data (enables retries)" |

### py-clob-client Issues (54 open)

| Issue | Type | Impact |
|-------|------|--------|
| HTTP 500 | "Order crosses the book" | Trade failures |
| HTTP 404/405 | Endpoint errors | API unavailable |
| Connection lost | Network drops | Session interruption |
| Stale data | Order book returns 0.99/0.01 | Incorrect pricing |
| Price validation | API rejects valid prices | Can't place orders |

### Subgraph Issues
- **7 separate subgraphs** (complexity)
- Frequent "data ingestion not syncing" errors
- 5-40 minute desync events documented

---

## 4. Gas/Network Congestion

### Polygon Gas Spikes

| Date | Gas Price | Normal Baseline |
|------|-----------|-----------------|
| **Jan 5-6, 2026** | **2,359 Gwei** | 50-150 Gwei |
| Nov 2024 (Election) | 100-200 Gwei | 50-150 Gwei |

### Polymarket's Polygon Footprint
- **8%** of Polygon gas at peak (Oct 2024)
- **$27,000** total fees through Oct 2024
- **$0.007** average per transaction

---

## 5. Key Quotes

### On Building Own L2
> "Polymarket has decided to treat the development of its own L2 as the '#1' priority."
> - Team member Mustafa, Discord

### On UMA Failure
> "Polymarket itself later issued a statement confirming UMA had reached the incorrect outcome."
> - News reports

### On Infrastructure Dependency
> "The service interruption was traced back to a critical outage on the Polygon network, the Layer 2 blockchain infrastructure upon which Polymarket's decentralized application is built."
> - Unchained Crypto

---

## 6. Comparison Data for Demo

### Uptime
| Platform | Documented Outages 2024-25 | Est. Downtime |
|----------|---------------------------|---------------|
| Polymarket/Polygon | 6+ major incidents | 10+ hours |
| Aptos | 0 | 0 |

### Resolution Speed
| Market Type | UMA | Aptos (Proposed) |
|-------------|-----|------------------|
| Crypto price | 2+ hours | **Instant** (Pyth) |
| Sports/Events | 2+ hours | **Minutes** (Switchboard) |
| Subjective | 2-72 hours | **15min-4hr** |

### Manipulation Risk
| Platform | Incidents | $ Lost |
|----------|-----------|--------|
| Polymarket/UMA | Multiple | **$7M+ documented** |
| Aptos (Proposed) | 0 | $0 |

---

## 7. Sources

### News Articles
- [Cryptopolitan - L2 Plans](https://www.cryptopolitan.com/polymarket-l2-polygon-network-disruption/)
- [Unchained - Issues Resolved](https://unchainedcrypto.com/polymarket-resolves-issues-after-polygon-network-disruption/)
- [CoinJournal - Polygon Consensus Bug](https://coinjournal.net/news/polygon-team-blames-temporary-outage-on-suspected-consensus-bug/)
- [TheStreet - Downtime](https://www.thestreet.com/crypto/outage/polymarket-goes-down-as-users-flood-outage-reports)
- [Orochi Network - Oracle Manipulation](https://orochi.network/blog/oracle-manipulation-in-polymarket-2025)

### Official Sources
- [Polymarket Status Page](https://status.polymarket.com)
- [Polymarket Docs - Resolution](https://docs.polymarket.com/polymarket-learn/markets/how-are-markets-resolved)
- [GitHub - py-clob-client Issues](https://github.com/Polymarket/py-clob-client/issues)
- [GitHub - eRPC Commits](https://github.com/erpc/erpc)
