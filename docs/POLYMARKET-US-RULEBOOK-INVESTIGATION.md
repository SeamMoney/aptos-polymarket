# Polymarket US Rulebook & Infrastructure Deep Investigation

**Date:** March 23, 2026
**Classification:** Internal Research -- Compiled from 15 Agent Investigations
**Sources:** CFTC filings, USPTO records, SEC EDGAR, Polymarket legal documents (6 documents, ~180 pages), GitHub (95 repos), LinkedIn, web OSINT, on-chain data, Polymarket Gamma API (434,578 markets), Sportico investigation, Ontario Securities Commission records

---

## Executive Summary

Polymarket is the world's dominant prediction market platform with $51.7 billion in lifetime volume and a $9-15 billion valuation. This investigation examined the company's corporate structure, US regulatory strategy, resolution infrastructure, oracle architecture, token plans, insider trading posture, and technical direction across 15 parallel research threads. The key findings are:

1. **Polymarket US is a fully centralized, off-chain derivatives exchange with zero blockchain components.** The CFTC-regulated platform (QCX LLC d/b/a Polymarket US) uses a C/C++ matching engine, FIX protocol, FCM clearing, and USD settlement. Contract outcomes are determined by the company at its "sole discretion" with determinations that are "final." There is no oracle, no automated data feed, and no challenge mechanism for outcome determinations anywhere in the 180 pages of legal documents.

2. **The CFTC is actively writing new rules for prediction markets.** An Advanced Notice of Proposed Rulemaking (91 FR 12516) was published March 12, 2026, with comments due April 30, 2026. Critically, Question 2.h explicitly asks about blockchain-based prediction markets. Staff Advisory Letter 26-08 warns that settling based on "yet-to-be-determined sources" may not satisfy Core Principle 3.

3. **POLY token is coming but has no public code.** Trademark filed February 4, 2026 by Blockratize Inc. SEC Form D filings disclose token warrants. CMO confirmed "there will be a token, there will be an airdrop." Zero POLY-related code exists in any of Polymarket's 95 public GitHub repositories. The token is expected to serve as an L2 chain fuel, oracle staking mechanism, and governance instrument.

4. **The EigenLayer collaboration claim is unverifiable.** No evidence of a formal three-way collaboration between EigenLayer, Polymarket, and UMA was found across any public source. The EIGEN whitepaper does reference prediction markets as an application use case, but no implementation exists.

5. **Polymarket is not evaluating Aptos, Sui, or any non-EVM chain.** Zero mentions of Move, Aptos, or Sui appear in 24 job postings, 95 GitHub repos, or any public documentation. The Smart Contract Engineer role specifies Solidity/EVM. The Platform Engineer role references Arbitrum Nova and Optimism.

6. **UMA is demonstrably broken.** $1.79 billion in trader funds stuck in unresolved disputes. 57.2% of disputed markets never resolve. The entire UMA token market cap ($46M) is smaller than individual Polymarket markets ($242M Zelenskyy suit). Polymarket is already migrating away: Chainlink for objective markets (Sep 2025), MOOV2 for managed proposals (Aug 2025), and POLY token for future governance.

---

## 1. Corporate Structure

### The Three-Entity Framework

| Entity | Legal Name | Jurisdiction | Role | Address |
|--------|-----------|-------------|------|---------|
| **Polymarket (Parent)** | Blockratize, Inc. | Delaware, USA (HQ: NYC) | Technology, IP, engineering, PR | New York, NY |
| **Adventure One** | Adventure One QSS Inc. | Panama | "Operator" of international (non-US) exchange | Panama (no identifiable office) |
| **Polymarket US** | QCX LLC d/b/a Polymarket US | Delaware LLC (HQ: FL) | CFTC-regulated DCM for US operations | 7251 W. Palmetto Park Rd, Suite 102, Boca Raton, FL 33433 |
| **Polymarket Clearing** | QC Clearing LLC d/b/a Polymarket Clearing | Delaware LLC | CFTC-registered DCO | Same as QCX LLC |
| **Parent of QCX** | Quad Code USA, Inc. | Delaware | Holds all equity in QCX LLC (per Rulebook Rule 2.1) | -- |
| **ISV Partner** | QC Tech LLC d/b/a PM US Tech | -- | iOS mobile trading app | -- |

### Ownership & Valuation

| Round | Date | Amount | Valuation | Lead Investor |
|-------|------|--------|-----------|---------------|
| Series B | May 2024 | $45M | -- | Founders Fund (Peter Thiel) |
| Series C | Jan 2025 | $150M | $1.2B | -- |
| QCEX Acquisition | Jul 2025 | $112M | -- | (Quadcode Group sold) |
| Series D | Oct 2025 | $2B | $8-9B post-money | Intercontinental Exchange (NYSE parent) |
| Secondary Market | Jan 2026 | -- | $11.6B implied | -- |
| Targeted (rumored) | 2026 | -- | $15-20B | In discussions |

**Platform statistics:** $51.7B lifetime volume, 314,000+ active traders (Dec 2024), 434,578 markets created.

### Adventure One QSS -- The Panama Shell Question

Adventure One QSS Inc. was incorporated in Panama on October 15, 2021, approximately 2.5 months before the CFTC's January 3, 2022 enforcement action against Blockratize. Based on 100+ pages of Panama corporate filings obtained by Sportico:

| Date | Event |
|------|-------|
| Oct 15, 2021 | Incorporated. Resident agent: Mario Ernesto Garcia de Paredes. Initial officers: Diana Munoz (president), Omar Camargo (secretary), Persis Manfred Sarmiento (treasurer) -- all placeholder directors |
| Dec 22, 2021 | Shayne Coplan designated as president (replacing Munoz), 12 days before CFTC settlement |
| Jan 3, 2022 | CFTC settlement: $1.4M fine, Blockratize barred from US operations |
| Apr 7, 2022 | Coplan removed as president, replaced by Harry Jones (Polymarket Director of Global Affairs). Coplan remains director |
| 2022-present | Adventure One nominally "operates" international exchange |

**Evidence of shell status:**
- Zero identifiable employees (confirmed by Sportico via LinkedIn, Panama job boards)
- Website: two lines of boilerplate text ("Web3 Development and Research") since first Wayback Machine archive (2023)
- No separate LinkedIn presence, office space, or operational infrastructure
- ZoomInfo lists Polymarket's company profile under "Adventure One QSS Inc."
- Ontario Securities Commission (April 2025) treated Blockratize AND Adventure One as **co-operators**, imposing a joint $248,000 fine

### Key Personnel Directory

| Person | Role(s) | Entity | Contact/Source |
|--------|---------|--------|----------------|
| **Shayne Coplan** | CEO | Blockratize Inc. / Director, Adventure One | Public figure |
| **Harry Jones** | Director of Global Affairs (Polymarket); President (Adventure One) | Both | @polymarket.com email |
| **Matt Childers** | Chief Compliance Officer | QCX LLC (Polymarket US) | matt.childers@qcex.com, 517-775-9538; ex-NFA Director of Compliance (2012-2022) |
| **Justin D. Hertzberg** | Senior officer (likely General Counsel) | QCX LLC | CC'd on CFTC transmittal letter |
| **Matthew Modabber** | CMO | Blockratize Inc. | Confirmed token/airdrop on Degenz Live podcast (Oct 24, 2025) |
| **William LeGate** | Growth Lead | Blockratize Inc. | Confirmed airdrop snapshot not yet taken (Feb 2026) |
| **Mustafa Aljatery** | Developer | Blockratize Inc. | "1m markets and $POLY next" (Discord/social) |
| **Jeff Bacon** | CTO (pre-acquisition) | QCEX / Quadcode | Ex-Cantor Fitzgerald (CX Futures Exchange), Carleton CS |
| **Sergei Dobrovolskii** | Founder, UBO | Quadcode Group (sold QCEX) | Founder & CEO of Quadcode, IQ Option parent |
| **David J. Gilberg** | Outside Counsel (Partner) | Sullivan & Cromwell LLP | gilbergd@sullcrom.com, (212) 558-4680 |
| **Elianne Neuman Schiff** | Outside Counsel | Sullivan & Cromwell LLP | CC'd on CFTC transmittal |

**Operating email addresses (polymarketexchange.com):** support@qcex.com, onboarding@qcex.com, institutional@qcex.com, fix@qcex.com (FIX API), data@qcex.com

---

## 2. Polymarket US Rulebook Analysis

### Documents Found and Analyzed (6 documents, ~180 pages total)

| # | Document | Source URL | Pages |
|---|----------|-----------|-------|
| 1 | Exchange Rulebook | `https://www.polymarketexchange.com/files/legal/latest/rulebook` | 76 |
| 2 | Risk Disclosure Statement | `https://www.polymarketexchange.com/files/legal/latest/risk-disclosure-statement` | 3 |
| 3 | Individual Participant Agreement | `https://www.polymarketexchange.com/files/legal/latest/participant-agreement` | 19 |
| 4 | Entity Participant and Clearing Member Agreement | `https://www.polymarketexchange.com/files/legal/latest/participant-agreement-corporate` | 20+ |
| 5 | Website Terms of Use (Sep 29, 2025) | `https://www.polymarketexchange.com/files/legal/Website%20Terms%20of%20Use%20(2025.09.29).pdf` | 9 |
| 6 | Polymarket Clearing Rulebook | `https://www.polymarketclearing.com/files/legal/latest/Polymarket%20Clearing%20Rulebook` | 57 |

**Documents referenced but not found (gated or unpublished):**
- Privacy Policy (referenced in Terms of Use, supposedly at qcex.com)
- Fee Schedule (referenced in Clearinghouse Rule 3.5)
- Individual Contract Rules / Contract Specifications (per Rule 10.2, filed separately with CFTC)
- API Documentation (`https://docs.polymarketexchange.com` -- access-restricted)
- Product Certifications / CFTC Rule 40.6(a) Submissions (notice pages show "Unable to load notices")

### How Contract Outcomes Are Determined

**Rule 10.4 -- Contract Outcome Review Process (the most critical finding):**

> (a) "Prior to Settlement, the Company may at its sole discretion undertake a review process to evaluate circumstances that may have a material impact on reliability or transparency of the underlying event related to a Contract. Following this review, the Company may determine the final outcome of a Contract."

> (c) **"The Company has full discretion in reviewing markets. Determinations made by the Company are final."**

**Rule 10.3 -- Contract Modifications:**

> (a) The Company retains discretion to modify Contract specifications at any time if any event or circumstance may have a material impact on reliability or transparency.

**Rule 10.2 -- Contract Specifications:** Each contract meets specifications "as set forth in the rules governing such Contract" -- meaning per-contract rules are filed separately with the CFTC and are not publicly available.

### What Is Missing from the Rulebook

Across all 180 pages of legal text:
- **Zero mentions** of "oracle," "data feed," "API," "automated resolution," "smart contract," or "blockchain"
- **Zero mentions** of specific data sources (no AP, Reuters, government databases)
- **No challenge mechanism** for outcome determinations -- Rule 10.4(c) states determinations are "final"
- Resolution sources are deferred entirely to individual Contract Rules (not yet public)

### Trading Infrastructure (from Rulebook)

| Feature | Detail |
|---------|--------|
| Order Book | Central Limit Order Book (CLOB) with price-time priority |
| Order Types | Standing Limit, Market to Limit, Fill and Kill (FAK), GTC, GTD |
| Minimum Unit | 1 Contract, quoted in USD, $0.01 minimum increment |
| Self-Trade Prevention | Available |
| Market Makers | Entity Participants only; must maintain two-sided markets |
| Protocols | REST, gRPC, **FIX protocol**, WebSocket, AWS PrivateLink |
| Settlement | USD only (wire transfers, ACH, debit cards) |
| Clearing | Fully collateralized, novation model (clearinghouse as CCP) |

### Dispute Resolution (Chapter 9)

- All disputes: binding arbitration in New York, NY
- 5-member Disciplinary Panel for rule violations
- Sanctions up to $500,000 fines, trading privilege suspension/termination
- **No mechanism exists for participants to challenge a contract outcome determination**

### Governance Structure

- Board of Directors: at least 35% Public Directors (no Material Relationship with Exchange)
- Regulatory Oversight Committee: solely Public Directors, oversees CCO
- CCO reports to ROC for regulatory matters, to CEO otherwise
- NFA provides surveillance, investigation, and regulatory functions per Regulatory Services Agreement (Exhibit N-1, filed with CFTC but confidential)

---

## 3. CFTC Regulatory Landscape

### Regulatory Timeline

| Date | Action | Citation |
|------|--------|---------|
| Jan 3, 2022 | CFTC settlement against Blockratize -- $1.4M fine | CFTC enforcement order |
| Jul 9, 2025 | QCX LLC designated as DCM | CFTC Filing ID 49571 |
| Sep 2, 2025 | No-Action Letter 25-28: relief from certain disclosure requirements | Staff Letter 25-28 |
| Nov 24, 2025 | Amended Order of Designation: FCM intermediation allowed | Amended Order |
| Dec 16, 2024 | QC Clearing LLC registered as DCO | CFTC Filing ID 50836 |
| Dec 11, 2025 | No-Action Letter 25-48: removed third-party clearing prohibition | Staff Letter 25-48 |
| Jan 8, 2026 | No-action letter for Bitnomial on swap reporting | Release 9166-26 |
| Feb 4, 2026 | **Withdrew** 2024 proposed ban on political/sports event contracts | Release 9179-26 |
| Feb 17, 2026 | Chairman Selig op-ed + Ninth Circuit amicus brief (exclusive federal jurisdiction) | seligstatement021726 |
| Feb 25, 2026 | Enforcement Division advisory on prediction market enforcement | Release 9185-26 |
| Mar 12, 2026 | **ANPRM published** (91 FR 12516) + Staff Advisory Letter 26-08 | Releases 9193-26, 9194-26 |
| **Apr 30, 2026** | **Comment deadline for ANPRM** | 91 FR 12516 |

### The ANPRM: What the CFTC Is Asking (91 FR 12516-12524)

The ANPRM contains 40 questions across 6 sections. The most critical for blockchain infrastructure:

**Question 2.h (the single most important question for Aptos):**

> "In general under the DCM Core Principles, what factors should the Commission consider with respect to blockchain-based prediction markets? Are there challenges or advantages in applying existing regulations and guidance to blockchain-based prediction markets? Which areas, if any, would benefit from Commission guidance or rule amendments for blockchain-based prediction markets?"

**Core Principle 2 (Compliance):** What resolution criteria should DCMs apply to event contracts? How to handle disputes about trigger events? Should the CFTC set expectations for alternative dispute resolution?

**Core Principle 3 (Manipulation Resistance):** How to determine if an event contract is "readily susceptible to manipulation"?

**Core Principle 4 (Market Surveillance):** What surveillance practices are useful for prediction markets specifically?

**Core Principle 20 (Operational Risk):** "What sources of operational risk related to prediction markets should the Commission consider? Are there challenges to the reliability, security or scalable capacity of the systems used by prediction markets?"

**Questions 29-32 (Inside Information):** How prediction market prices reflect aggregate beliefs, insider trading rules, government employee trading restrictions.

### Staff Advisory Letter 26-08 -- Resolution Requirements

Key requirements for DCMs listing event contracts:

- Must consider "the nature and sources of the data comprising the cash-settlement calculation" and "safeguards against unauthorized or premature release of the index value"
- Must evaluate "transparency, accuracy, reliability, and impartiality" of resolution sources
- **Footnote 26 (critical):** "A statement that a contract will settle based upon a consensus of yet-to-be-determined sources may not be sufficient to satisfy the requirements of DCM Core Principle 3."
- Self-certification must include: "a description of the settlement methodology of the contract, including identification of the specific data source(s) on which settlement will be based, and an assessment of the reliability, objectivity, and manipulation resistance of such sources"

### Chairman Selig's Four-Part Agenda

1. **Withdraw prior restrictive proposals** -- Done (Feb 4, 2026)
2. **New rulemaking with "clear, workable standards"** -- ANPRM published (Mar 12, 2026)
3. **Defend jurisdictional position in courts** -- Ninth Circuit amicus brief (Feb 17, 2026)
4. **Joint SEC-CFTC Title VII interpretation** -- Clarify boundaries between commodity options, security options, swaps

### Exclusive Federal Jurisdiction

The CFTC asserts exclusive federal jurisdiction over event contracts as commodity derivatives. Nearly 50 active state-level lawsuits target Kalshi, Polymarket, Coinbase, and Crypto.com. The *Loper Bright* Supreme Court decision (overturning *Chevron* deference) means courts will independently interpret statutory text, making formal rulemaking more important.

### Expected Rulemaking Timeline

| Phase | Expected Date |
|-------|--------------|
| ANPRM comment period closes | April 30, 2026 |
| CFTC review of comments | Q3-Q4 2026 |
| Notice of Proposed Rulemaking (NPRM) | Q1-Q2 2027 |
| NPRM comment period | 60-90 days |
| Final rule | Q3 2027 - Q1 2028 at earliest |

In the interim, DCMs can list event contracts via self-certification (17 CFR 40.2).

---

## 4. QCEX Acquisition & Pre-History

### What Polymarket Bought for $112 Million

QCEX was a subsidiary of **Quadcode Group**, an international fintech conglomerate founded by **Sergei Dobrovolskii**. Quadcode has 700+ employees across 7 countries. Its portfolio includes:

| Brand | Description |
|-------|------------|
| **IQ Option** | Binary options/CFD platform (founded 2013, CySEC-licensed, fined EUR 630,000 total) |
| **Quadcode Markets** | FX/CFD trading (CySEC + Bahamas licensed) |
| **Quadcode SaaS** | White-label brokerage platform |
| **QCEX** | CFTC-licensed US exchange (the acquired entity) |
| **Invetra / Amaiz** | Neobanking products |

### QCEX Was Pre-Operational -- A Regulatory Vehicle

**QCEX never operated as a live exchange before Polymarket acquired it.** Zero trading volume, zero users, zero listed contracts. The DCM designation was granted July 9, 2025, and Polymarket closed the acquisition 12 days later on July 21. QCEX was a freshly licensed shell purchased for the value of its CFTC licenses and 3+ years of regulatory application work.

### QCEX Regulatory Timeline

| Date | Event |
|------|-------|
| ~2021 | Dobrovolskii begins pursuing CFTC licenses |
| Feb 2022 | Matt Childers joins as CCO (from NFA) |
| Jun 2022 | QCX LLC formally applies for DCM designation |
| Nov 2023 | DCM application exhibits filed (Form DCM, Exhibits G, L, M, U) |
| Dec 2024 | QC Clearing LLC registered as DCO |
| Jul 9, 2025 | QCX LLC receives Order of Designation as DCM |
| Jul 21, 2025 | Polymarket closes $112M acquisition |

### CFTC Filing Details

| Document | CFTC Filename |
|----------|--------------|
| Original Order of Designation | `orgdcmqcexorderofd250709.pdf` |
| Amended Order of Designation | `Polymarket US Amended Order of Designation` |
| Form DCM Application | `orgdcmqcexformdcm231129.pdf` |
| Transmittal Letter | `orgdcmqcextranslet231129.pdf` |
| Exhibit G (Organizational Docs) | `orgdcmqcexexhibitg231129.pdf` |
| Exhibit L (Core Principles) | `orgdcmqcexexhibitl231130.pdf` |
| Exhibit M (Rulebook) | `orgdcmqcexexhibitm231129.pdf` |
| Exhibit U (Confidentiality Request) | `orgdcmqcexexhibitu231130.pdf` |

### Deal Structure

- **Price:** $112 million (cash + Polymarket equity shares)
- **Post-deal:** Quadcode Group received "a meaningful equity stake and an ongoing partnership"
- **What transferred:** DCM license (QCX LLC), DCO license (QC Clearing LLC), Boca Raton office, CLOB matching engine, compliance team (especially Matt Childers), Quadcode technology partnership
- **What was built new:** Resolution methodology, actual contracts, user-facing platform, settlement sources

### The Jeff Bacon / Cantor Fitzgerald Connection

CTO Jeff Bacon was previously a Technical Product Manager at **Cantor Fitzgerald**, which operated CX Futures Exchange -- another CFTC-licensed event contracts exchange. This experience was directly relevant to building QCEX's DCM application.

---

## 5. Trading Infrastructure: US vs International Comparison

| Aspect | International (Polygon) | US (Polymarket US / QCX LLC) |
|--------|------------------------|------------------------------|
| **Blockchain** | Polygon (Chain ID 137) | **None -- fully off-chain, fiat-based** |
| **Settlement** | On-chain (CTF Exchange smart contracts) | Centralized clearinghouse (DCO) |
| **Collateral** | USDC.e on Polygon | USD (wire, ACH, debit cards) |
| **Matching Engine** | Off-chain CLOB, on-chain settlement | **C/C++ Central Limit Order Book (fully off-chain)** |
| **Resolution** | UMA Optimistic Oracle + Chainlink | **"Company determines final outcome" (centralized)** |
| **Regulation** | Unregulated (banned in US) | **CFTC-regulated DCM + DCO** |
| **Protocols** | REST API, WebSocket | REST, gRPC, **FIX protocol**, WebSocket, AWS PrivateLink |
| **Auth** | Crypto wallets | RSA keys + Auth0 OAuth 2.0 JWT |
| **Partner Types** | Traders, API users | **ISVs, Introducing Brokers, FCMs** |
| **On-chain TPS** | ~3-6 TPS (settlement only) | N/A (no blockchain) |
| **Gas Cost** | $0.007/tx | N/A |

### International Platform -- Core Contracts on Polygon

| Contract | Address | Transactions | TVL/Balance |
|----------|---------|--------------|-------------|
| CTFExchange | `0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8B8982E` | 276,202 | $473 USDC |
| NegRiskCTFExchange | `0xC5d563A36AE78145C45a50134d48A1215220f80a` | 103,526 | $3 USDC |
| ConditionalTokens | `0x4D97DCd97eC945f40cF65F87097ACe5EA0476045` | 3,717,826 | **$173M USDC** |
| NegRiskAdapter | `0xd91E80cF2E7be2e162c6513ceD06f1dD0dA35296` | 270,194 | $978 |
| USDC.e | `0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174` | -- | Collateral |

**Total on-chain settlement transactions: ~4.37 million**

### International Platform Architecture

```
User places order -> Signed EIP712 message to off-chain CLOB (CENTRALIZED)
                           |
                           v
                    CLOB matches orders
                           |
                           v
             Operator submits fillOrder() on-chain
                           |
                           v
              CTFExchange: ERC1155 + USDC atomic swap
                           |
                           v
          Market resolution: UMA Oracle proposes outcome
                (2hr+ challenge period)
```

The `onlyOperator` modifier on `fillOrder()`, `fillOrders()`, and `matchOrders()` means only designated operators can submit settlements -- a centralized single point of failure.

### Platform Outages (2024-2025)

| Date | Duration | Root Cause | Impact |
|------|----------|------------|--------|
| Dec 18, 2024 | Multi-hour | Polygon consensus bug (Bor layer) | Full trading halt |
| Jul 30, 2025 | ~1 hour | Polygon Heimdall consensus | Trading frozen |
| Nov 2025 | Hours | Cloudflare disruption | 86% users affected |
| Dec 5, 2025 | 20 minutes | Site outage | Full unavailability |
| Dec 18-19, 2025 | Hours | Polygon network | Trading disrupted |
| Dec 30, 2025 | Multiple short | Markets API | Search broken |

> "The platform is about to take its own Layer 2 (L2) seriously... It's the #1 priority." -- Polymarket team member (Discord)

---

## 6. Oracle & Resolution Architecture

### Current State: Three Layers

**Layer 1 -- Chainlink Data Streams (Objective Markets, Live Sep 2025)**
- Sub-second verifiable price feeds for crypto price markets
- Chainlink Automation triggers settlement at predefined times
- Handles ~15% of Polymarket volume (5-minute crypto markets)
- **Zero public code** -- no public repo for the Chainlink integration despite being live on Polygon
- UMA token dropped ~10% on Chainlink announcement

**Layer 2 -- UMA Managed Optimistic Oracle V2 / MOOV2 (Subjective Markets, Live Aug 2025)**

| Contract | Address (Polygon) | Block |
|----------|--------------------|-------|
| ManagedOptimisticOracleV2 | `0x2C0367a9DB231dDeBd88a94b4f6461a6e47C58B1` | 74,677,419 |
| UmaCtfAdapterV4 | `0x65070BE91477460D8A7AeEb94ef92fe056C2f2A7` | 74,797,879 |
| NegRiskUmaCtfAdapterV4 | `0x69c47De9D4D3Dad79590d61b9e05918E03775f24` | 82,000,000 |
| ModRegistry | `0xe1c92715e72b81f80fDE1e6bCe0A5E6E91fF69Df` | 52,699,785 |
| OptimisticOracleV2 | `0xeE3Afe34... ` | 35,203,539 |

MOOV2 changes from original UMA:
- Restricts proposals to 37-177 whitelisted addresses (Risk Labs/Polymarket employees + high-accuracy proposers)
- Role-based access control: CONFIG_ADMIN, REQUEST_MANAGER, UPGRADE_ADMIN
- Custom bond ranges and configurable liveness periods
- Source code NOT in any Polymarket public repo (likely developed by UMA/Risk Labs)

Sports-specific oracle (`uma-sports-oracle`):
- Deployed at `0xb21182d0494521Cf45DbbeEbb5A3ACAAb6d22093` (Polygon)
- Uses `MULTIPLE_VALUES` identifier (UMIP-183)
- Supports Winner, Spreads, Totals market types
- ChainSecurity audited (Jun 2025)

**Layer 3 -- Polymarket US: Company Discretion (US Platform Only)**
- "Markets Team" determines outcomes directly (centralized, no oracle)
- No publicly confirmed dispute process
- Settlement sources "named in market description" per contract
- Market Operations Analyst role handles "audit resolutions for consistency and integrity"

### UMA Failure Data (from 434,578 Market Scrape)

| Metric | Value |
|--------|-------|
| Total markets scraped | 434,578 |
| Total platform volume | $51.73 billion |
| Markets with UMA activity | 271,582 (62.5%) |
| Markets with actual disputes | 1,200 (0.28%) |
| **Volume stuck in unresolved disputes** | **$1.79 billion** |
| **Resolution failure rate** | **57.2%** (687 of 1,200 never resolve) |
| Griefing rate (>95% consensus, still stuck) | 95% of unresolved |

**Death spiral -- more disputes = less resolution:**

| Dispute Rounds | Count | Resolution Rate |
|----------------|-------|-----------------|
| 1 dispute | 1,013 | 47.6% |
| 2 disputes | 181 | 16.6% |
| 3+ disputes | 6 | 16.7% |

**Disputes by category:**

| Category | % of Disputes | Volume | Resolution Rate |
|----------|---------------|--------|-----------------|
| Politics/Geopolitics | 23.3% | $1.46B (66.7%) | **23.2%** |
| Crypto/Finance | 26.1% | $371M | 33.6% |
| Sports/Entertainment | 23.2% | $193M | 47.0% |
| Other | 25.2% | $134M | 66.2% |

**Top griefed markets (>95% price consensus, still unresolved):**

| Market | Volume | Consensus | Disputes |
|--------|--------|-----------|----------|
| Zelenskyy wear a suit | $242M | 100% | 5 |
| US government shutdown Saturday | $157M | 100% | 2 |
| Trump Epstein files by Dec 19 | $91M | 100% | 2 |
| Stranger Things "Eleven dies" | $81M | 100% | 2 |
| Xi Jinping out in 2025 | $79M | 100% | 2 |

### UMA Token Concentration -- Plutocracy

| Metric | Value |
|--------|-------|
| UMA Market Cap | ~$46M |
| Top 10 wallets | 75.7% of supply |
| Top 2 holders | >50% of voting power |
| Price vs ATH | $0.51 vs $41-45 (down 98.8%) |
| Cost for 25% voting power (proven) | ~$2.5M |
| Single dispute bond | $750 |

### Documented UMA Attacks

**1. Ukraine Mineral Deal ($7M, March 2025)**
- 5M UMA tokens across 3 accounts = 25% voting power
- BornTooLate.eth was a top-5 staker
- Resolved YES despite no agreement existing
- Polymarket: "unprecedented" -- no refunds
- Led to MOOV2 migration

**2. Zelenskyy Suit ($242M, June-July 2025)**
- 5 dispute rounds (most ever), ~1 week duration
- 40+ media outlets confirmed suit; UMA voted NO
- Market volume exceeded UMA's entire market cap by 2.5x
- Power user: "This isn't decentralized."

**3. Cardi B Super Bowl ($5.3M, Feb 2026)**
- She danced but didn't sing -- "perform" is ambiguous
- Price at 99.95% YES, still unresolved
- Kalshi resolved at $0.26 YES (opposite interpretation)

**4. Barron Trump Meme Coin**
- Polymarket overturned a UMA resolution
- If Polymarket can override UMA, why use UMA?

**5. UFO Declassification ($16M, Dec 2025)**
- Resolved "Yes" despite no actual declassification
- Late-session whale buying near 99 cents forced outcome

### POLY Token Oracle Design (Speculative -- Based on Public Signals)

The most detailed public description comes from Bitget's "Farewell, Polygon" analysis (December 2025):

1. **POLY as an Ethereum L2 chain** -- Polymarket migrating from Polygon to its own L2 called POLY
2. **Oracle node staking** -- POLY token is "the necessary vehicle for staking oracle nodes"
3. **Tiered resolution:**
   - Routine: automated nodes resolve quickly and cheaply
   - Complex: "extremely complex disputes will be adjudicated by real stakeholders of POLY"
4. **Token as "consumable"** -- framed as "industrial raw material" and "operational consumable" to avoid securities classification
5. **Governance voting** -- POLY holders vote on "market categories, trading fees, oracle settings, and partnerships"

**No whitepaper or official tokenomics document has been published as of March 2026.**

### EigenLayer Hypothesis

**Key Finding: No direct EigenLayer-Polymarket-UMA collaboration exists.** After exhaustive searching across EigenLayer's blog, forums, GitHub (Layr-Labs), UMA's discourse/GitHub/docs, Polymarket's blog/docs, academic databases (arXiv), and general web searches, no evidence of a formal collaboration was found.

**What does exist:**
- EIGEN whitepaper (page 27): "Prediction markets require an oracle to resolve at the end of the market. Therefore using intersubjective staking for these oracles makes them more permissionless and rigid."
- EIGEN whitepaper (page 5): Explicitly references Augur and UMA as prior work, positioning EIGEN as improvement
- Devcon Bangkok hackathon AVS (Nov 2024): Blockchain at Berkeley team built proof-of-concept prediction market AVS (GitHub: `eztramble123/prediction-market-avs`)
- eoracle (EO): Primary oracle AVS on EigenLayer, but no prediction market support
- The intersubjective forking mechanism theoretically solves UMA's whale concentration problem

**Conclusion:** The hypothesis is theoretically sound but lacks evidence of implementation. The "Early 2025 EigenLayer collaboration" claim in existing docs appears to be forward-looking inference rather than documented fact.

---

## 7. POLY Token Strategy

### Confirmed Facts

| Date | Event | Source |
|------|-------|--------|
| Oct 8, 2025 | Coplan tweets "$BTC $ETH $BNB $SOL $POLY" -- first POLY tease | X (@shayne_coplan) |
| Oct 24, 2025 | CMO Modabber confirms: "There will be a token, there will be an airdrop." | Degenz Live podcast |
| Feb 4, 2026 | **Blockratize Inc. files USPTO trademarks for "POLY" and "$POLY"** | USPTO (Serial #99637043) |
| Feb 2026 | Growth lead William LeGate confirms airdrop snapshot NOT yet taken | Social media |
| Mar 2026 | Developer Mustafa Aljatery: "1m markets and $POLY next" | Discord |

Polymarket's official FAQ still states: "Polymarket does not have a token" and "has not announced plans for any airdrop or token generation event" -- a deliberate legal posture contradicting team statements.

### Trademark Filings

- **Filing entity:** Blockratize, Inc. (Delaware) -- the US parent, not Adventure One (Panama)
- **Marks:** "POLY" (Serial #99637043) and "$POLY"
- **Filing basis:** Intent to use
- **Coverage:** Downloadable software for blockchain-based prediction markets, financial services involving virtual currency, cryptocurrency-related services, trading platform services
- **Additional trademark:** "LIVETRADE" (Serial #99599899) -- live trading feature
- **Likely Nice Classifications:** Class 9 (downloadable software), Class 36 (financial services), Class 42 (SaaS/platform)

### SEC Form D Filings (Token Warrants)

| Filing | Accession Number | Date | Details |
|--------|-----------------|------|---------|
| Form D | 0002041378-24-000001 | Oct 18, 2024 | File #021-527240, Item 06B ("Other" securities) |
| Form D/A | 0002041378-25-000001 | Feb 25, 2025 | Amendment to above |
| Form D | 0002041378-25-000003 | Aug 1, 2025 | File #021-553453, **$257.5M total financing**, 23 investors, Item 06B |

**Item 06B = "Other" securities type** -- standard classification for token warrants (rights to receive future tokens). This is the same mechanism dYdX used before its token launch. ICE's $2B investment at $9B valuation almost certainly includes token warrant provisions.

### Cross-References in Other Companies' SEC Filings

| Company | Filing | Date | Significance |
|---------|--------|------|-------------|
| ICE | 424B5 | Nov 5 & 7, 2025 | Prospectus supplements mentioning Blockratize |
| ICE | 10-Q | Oct 30, 2025 | Q3 2025 quarterly report mentioning Blockratize |
| ICE | 10-K | Feb 5, 2026 | FY2025 annual report mentioning Blockratize |
| Robinhood | 10-K | Feb 18, 2026 | Annual report mentioning Blockratize (competitive landscape) |

### Expected Tokenomics (Speculative)

**Token utility (based on all public signals):**
- Governance: vote on platform parameters (fees, market creation rules, categories)
- Curation: which markets get listed, promoted, organized
- Oracle/Resolution: stake POLY as collateral for market creation and resolution, slashing for misreporting
- Revenue sharing: stakers earn portion of platform trading fees ($1M+/week)
- L2 chain fuel: gas for the POLY L2 network
- Separates wager currency (USDC) from truth/governance currency (POLY)

**Distribution (speculative, based on Hyperliquid model cited by CMO):**
- Community/airdrop: possibly 5-31% (Modabber praised Hyperliquid's 31% user distribution)
- Team and advisors: unknown, likely with vesting
- Investors: token warrants from Series B/C/D
- Ecosystem/treasury: unknown

**"Consumable" regulatory framing:** POLY is defined as the "industrial raw material" and "operational consumable" -- fuel for L2, staking for oracles, medium for settlement -- deliberately framed to avoid securities classification.

### Valuation Dependency on Token

> "Token-based fee accrual is expected to contribute 90% or more of future reportable income. It's the singular event required to justify the $9 billion to $15 billion valuation." -- Revenue Memo analysis

### Token Launch Timeline Consensus

Q2-Q4 2026. U.S. relaunch comes first. Token depends on regulated US exchange being operational.

---

## 8. Insider Trading: From "Cool" to Compliance

### Phase 1: "Insider Trading Is Cool" (Pre-2026)

**Shayne Coplan, 60 Minutes interview (CBS, November 30, 2025), with Anderson Cooper:**

> "I think people going and having an edge to the market is a good thing."

> "Sort of an inevitability that this will happen, and there's a lot of benefits from it."

**Axios BFD Summit, New York City (November 2025):**

> "I think what's cool about Polymarket is that it creates this financial incentive for people to go and divulge the information to the market."

When asked whether Polymarket guards against insider trading, Coplan said it is "effectively allowed, and perhaps even encouraged, as a way to show market validity."

### Phase 2: Scandals Force a Pivot (Jan-March 2026)

| Incident | Date | Details | Profit |
|----------|------|---------|--------|
| Venezuela/Maduro capture | Jan 2026 | Mystery trader bet on Maduro's capture hours before US forces seized him | ~$410,000 |
| Iran strikes | Feb 28, 2026 | Six fresh accounts netted ~$1.2M betting on US strikes timing. "Magamyman" turned $87K into $553K betting 71 min before news broke (odds at 17%) | ~$1.2M total |
| Israeli military insiders | Early 2026 | Israeli authorities arrested and indicted a civilian and military reservist for using classified information to place Polymarket bets | Unknown |
| Kalshi political candidate | Feb 2026 | Candidate traded on own candidacy. $2,246 disgorgement, 5-year ban | $2,246 |
| Kalshi YouTube editor | Feb 2026 | Traded on foreknowledge of video content. $20,398 disgorgement, 2-year ban | $20,398 |

### Phase 3: Regulatory Compliance (March 2026)

Polymarket published **enhanced market integrity rules** on March 20, 2026, applying to **both** DeFi and US platforms:

**Three categories of prohibited conduct:**
1. Trading on stolen confidential information (violating duty of trust/confidence)
2. Trading on illegal tips (using MNPI passed by someone who owed a duty)
3. Trading by those who can influence the outcome

**Additional prohibitions:** spoofing, wash trading, fictitious transactions, self-dealing, front-running, information misuse, attempted manipulation.

**Enforcement architecture (US platform, three tiers):**
1. **Palantir/Vergence AI surveillance** (pre-trade and post-trade)
2. Real-time control desk
3. NFA Regulatory Services Agreement

### The Palantir Partnership (Announced March 10, 2026)

Partnership with **Palantir Technologies** and **TWG AI** to build "next-generation sports integrity platform."

**The Vergence AI engine provides:**
- End-to-end trade monitoring (pre-trade and post-trade)
- Anomaly detection: near real-time detection of manipulation, coordinated activity, insider risks
- Prohibited trader screening against restricted participant datasets
- Operations center enablement for compliance teams
- Compliance reporting automation

**Built on:** Palantir's Foundry (data operations) and AIP (Artificial Intelligence Platform)

**Scope:** US regulated platform only (initially). International DeFi platform not covered by Vergence.

**The Peter Thiel connection:** Thiel co-founded Palantir. Founders Fund (Thiel's firm) led Polymarket's $45M Series B. Donald Trump Jr. is a Polymarket adviser. Thiel has deep ties to the Trump administration.

### The Information Markets Thesis

**Robin Hanson (George Mason University)**, the intellectual godfather of prediction markets, argues insider trading is "just not really an issue for prediction markets" because the conflict in stock markets (where insiders exploit investors) doesn't apply. His position: insiders make prices more accurate, which is the whole point.

**The legal distinction (CFTC Rule 180.1, modeled on SEC Rule 10b-5):** Insider trading is the misuse of material nonpublic information obtained through a pre-existing duty of trust or confidence. The test is not whether you know more than other traders -- it is whether you breached a duty to obtain that information.

**Lawful informed trading:** satellite imagery of parking lots, domain expertise, faster public news interpretation -- all legal and encouraged.
**Illegal insider trading:** company employee trading on earnings, candidate trading on own race -- breach of fiduciary/confidential relationship.

### Coplan's Key Public Quotes (Comprehensive)

| Venue | Date | Quote |
|-------|------|-------|
| X (tweet) | Oct 8, 2025 | "$BTC $ETH $BNB $SOL $POLY" |
| CNBC Squawk Box (with ICE CEO) | Oct 7, 2025 | "Nothing is more valuable than the truth." |
| Cantor Fitzgerald Crypto Conference | Nov 12, 2025 | "The cool thing about blockchains is it lets some kid in his bedroom go and innovate." |
| Axios BFD Summit | Nov 2025 | "What's cool about Polymarket is that it creates this financial incentive for people to go and divulge the information." |
| CBS 60 Minutes | Nov 30, 2025 | "It's the most accurate thing we have as mankind right now." |
| Post-2024 election (X) | 2024 | "The global truth machine is here, powered by the people." |

---

## 9. Kalshi Comparison

### Regulatory Structure

KalshiEX LLC is a CFTC-registered DCM that self-certifies contracts under Section 5c(c) and CFTC Regulation 40.2(a). Each contract type is submitted with:
- Cover letter (signed by Head of Markets, Xavier Sottile)
- Contract Terms and Conditions (Appendix A)
- Confidential appendices (Source Agency analysis, Core Principles compliance)

### Resolution Architecture

Kalshi uses a **centralized, exchange-determined model** -- identical in structure to Polymarket US. Key components per contract:

| Element | Description |
|---------|-------------|
| **Underlying** | The specific real-world fact being measured |
| **Source Agency** | Designated authoritative source(s) |
| **Expiration Value** | Value of Underlying as documented by Source Agency on Expiration Date |
| **Payout Criterion** | Condition triggering Yes or No outcome |
| **Settlement Value** | Always $1.00 per contract |

### Designated Resolution Sources by Category

**Political contracts (NEXTLEADER, NEWPOPE):**
- 14-17 news organizations: The New York Times, AP, Bloomberg, Reuters, Axios, Politico, Semafor, The Information, Washington Post, WSJ, ABC, CBS, CNN, Fox News, MSNBC, NBC

**Financial/data contracts (BTC price):**
- Single source: CF Benchmarks (CF Bitcoin Real-Time Index)
- Resolution: simple average of 60 BRTI readings in minute before expiration

**Corporate events (IPO):**
- Hierarchical sources: SEC, company, exchange (NYSE/NASDAQ), then news outlets
- Exhaustive positive/negative resolution examples in contract specs

### How Kalshi Handles Ambiguity

**Rule 6.3(b):** If Expiration Value cannot be determined, Kalshi determines payouts at its sole discretion.

**Rule 6.3(c)/(d):** Before settlement, Kalshi may initiate the "Market Outcome Review Process" at its sole discretion.

### Insider Trading Prohibitions (Per Contract)

1. Persons employed by any Source Agency are prohibited from trading
2. Persons with material nonpublic information are prohibited
3. Political contracts add extensive additional prohibitions: candidates, campaign staffers, party employees, PAC employees, polling organization employees, members of Congress, congressional staffers, and household/family members of all the above

### Kalshi vs CFTC Litigation (Congressional Control Contracts)

- Jun 2023: Kalshi self-certified congressional control contracts
- Sep 22, 2023: CFTC disapproved on three grounds: (1) gaming, (2) unlawful under state law, (3) contrary to public interest
- Kalshi sued; district court sided with Kalshi (Sep 2024)
- CFTC appealed to DC Circuit; ultimately withdrew appeal under Chairman Selig

### Key Difference from Polymarket US

Kalshi specifies exact resolution sources and detailed rules per contract in public filings. Polymarket US's per-contract rules are filed with the CFTC but not yet publicly available. Both use "company sole discretion" as the ultimate backstop.

---

## 10. Hiring Signals & Technical Direction

### Current Openings (24 Roles on Ashby)

**US Exchange Engineering (most revealing):**

| Role | Location | Key Signal |
|------|----------|------------|
| **Senior C/C++ Engineer, US Exchange** | NYC (on-site) | Low-latency matching engine -- traditional finance, NOT blockchain |
| Senior Backend Engineer, US Exchange | NYC | Core exchange backend |
| Senior API Engineer - Polymarket US | NYC | API layer for regulated exchange |
| Software Engineer, Polymarket US | NYC | TypeScript + **Go** + React. "CFTC-regulated exchange operations" |
| **Smart Contract Engineer** | Remote/NYC | **Solidity + EVM** (international platform). Mentions Uniswap V2/V3/X, dYdX v4 |

**Platform/Infrastructure:**

| Role | Key Details |
|------|------------|
| Senior Platform Engineer | Go, Rust, C++; **Arbitrum Nova, Optimism roll-ups, BFT consensus, libp2p** |
| Senior Infrastructure Engineer | AWS, Kubernetes, Terraform, Kafka, Redis |
| Market Operations Analyst | **"Audit resolutions for consistency and integrity," "dispute handling"** -- the human resolution team |
| Developer Relations Manager | API integrations, liquidity providers, ecosystem grants |

### Languages Hired For

| Language | Use | Platform |
|----------|-----|----------|
| **C/C++** | Matching engine | US exchange |
| **Go** | Backend services | Both |
| **Rust** | Systems programming, client SDKs | Both |
| **TypeScript** | Frontend, API layer | Both |
| **Solidity** | Smart contracts | International only |
| **Python** | Tooling, automation, AI agents | Both |
| **Move** | -- | **Not mentioned anywhere** |

### Critical Finding: No Aptos/Sui/Non-EVM Signals

**Zero mentions** of Move, Aptos, or Sui anywhere in:
- 24 job postings
- 95 GitHub repositories
- Technical documentation (200+ pages)
- Public API/SDK ecosystem
- Conference talks or blog posts

The Smart Contract Engineer role specifies Solidity/EVM exclusively. The Platform Engineer role references Arbitrum Nova and Optimism (EVM L2s), suggesting the international platform's L2 migration will remain in the EVM ecosystem.

---

## 11. GitHub Intelligence

### Repository Overview

95 public repositories under the Polymarket GitHub organization. **Zero contain POLY token, oracle staking, EigenLayer, or next-gen resolution code.**

### Resolution Contract Addresses (from resolution-subgraph)

| Contract | Address (Polygon) | Start Block |
|----------|-------------------|-------------|
| UmaCtfAdapterOld | `0xCB1822859...` | 23,569,780 |
| UmaCtfAdapterV2 | `0x6A9D2226...` | 35,203,539 |
| UmaCtfAdapterV3.1 | `0x157Ce2d6...` | 46,755,254 |
| **UmaCtfAdapterV4** | `0x65070BE91477460D8A7AeEb94ef92fe056C2f2A7` | 74,797,879 |
| NegRiskUmaCtfAdapter | `0x2F5e3684...` | 50,505,488 |
| **NegRiskUmaCtfAdapterV4** | `0x69c47De9D4D3Dad79590d61b9e05918E03775f24` | 82,000,000 |
| **ManagedOptimisticOracleV2** | `0x2C0367a9DB231dDeBd88a94b4f6461a6e47C58B1` | 74,677,419 |
| OptimisticOracleV2 | `0xeE3Afe34...` | 35,203,539 |
| ModRegistry | `0xe1c92715e72b81f80fDE1e6bCe0A5E6E91fF69Df` | 52,699,785 |

### Repos Created After POLY Announcement (Oct 2025)

| Repo | Created | Purpose | POLY-Related? |
|------|---------|---------|---------------|
| polymarket-cli | Feb 24, 2026 | Rust CLI for trading | No |
| agent-skills | Feb 19, 2026 | Agent integration docs | No |
| polymarket-us-python | Jan 22, 2026 | US exchange Python SDK | No |
| polymarket-us-typescript | Jan 20, 2026 | US exchange TypeScript SDK | No |
| safe-wallet-integration | Dec 20, 2025 | Safe wallet examples | No |
| rs-clob-client | Dec 8, 2025 | Rust CLOB client | No |
| Builder program examples | Nov-Dec 2025 | Third-party integration | No |

### Private Development Gap

Five categories of expected code are missing from public repos:

1. **Chainlink integration** -- live on Polygon, zero public code
2. **MOOV2 contract source** -- indexed in subgraph (ABI included) but source not public (likely UMA/Risk Labs)
3. **ModRegistry source** -- manages moderators, not in public repos
4. **US exchange backend** -- SDKs connect to gateway.polymarket.us but engine/clearing/settlement is private
5. **POLY token/oracle code** -- zero evidence of any development in public repos

### Key Search Terms -- Zero Results Across All Repos

- "poly_token" -- 0 results
- "eigenlayer" -- 0 results
- "chainlink" -- 0 results
- "staking" -- 0 results
- "insider" / "integrity" / "surveillance" -- 0 results
- "QCX" / "PMUS" -- 0 results

### US Exchange SDK Architecture

The `polymarket-us-typescript` and `polymarket-us-python` SDKs connect to:
- `gateway.polymarket.us`
- `api.polymarket.us`

Market states include CFTC-standard states: OPEN, PREOPEN, SUSPENDED, HALTED, EXPIRED, TERMINATED. Settlement is simple: `settlementPrice` + `settledAt` timestamp. **No blockchain oracle references -- it is a centralized exchange.**

---

## 12. Key Personnel Directory

### Polymarket / Blockratize Inc.

| Name | Title | Notable |
|------|-------|---------|
| **Shayne Coplan** | CEO, Founder | Director of Adventure One QSS; youngest self-made billionaire (Fortune, Oct 2025) |
| **Harry Jones** | Director of Global Affairs | President of Adventure One QSS (since Apr 2022) |
| **Matthew Modabber** | CMO | Confirmed token/airdrop on Degenz Live (Oct 24, 2025) |
| **William LeGate** | Growth Lead | Confirmed airdrop snapshot not yet taken (Feb 2026) |
| **Mustafa Aljatery** | Developer | "1m markets and $POLY next" |

### QCX LLC (Polymarket US)

| Name | Title | Contact | Background |
|------|-------|---------|------------|
| **Matt Childers** | Chief Compliance Officer | matt.childers@qcex.com, 517-775-9538 | NFA Director of Compliance 2012-2022; MBA, U of Chicago Booth |
| **Justin D. Hertzberg** | Senior Officer (likely GC) | CC'd on CFTC transmittal letter | -- |

### QCEX / Quadcode (Pre-Acquisition)

| Name | Title | Background |
|------|-------|------------|
| **Sergei Dobrovolskii** | Founder, UBO | Quadcode Group CEO; IQ Option parent; 20+ years fintech |
| **Jeff Bacon** | CTO | Ex-Cantor Fitzgerald (CX Futures Exchange); Carleton CS |
| **Dmitry Zaretsky** | IQ Option Founder | Founded IQ Option 2013 in Saint Petersburg, Russia |

### Outside Counsel

| Name | Firm | Contact |
|------|------|---------|
| **David J. Gilberg** | Sullivan & Cromwell LLP | gilbergd@sullcrom.com, (212) 558-4680 |
| **Elianne Neuman Schiff** | Sullivan & Cromwell LLP | CC'd on CFTC filings |

### Adventure One QSS Inc. (Panama)

| Name | Role | Period |
|------|------|--------|
| Diana Munoz | Initial President (placeholder) | Oct-Dec 2021 |
| Omar Camargo | Secretary (placeholder) | Oct 2021-? |
| Persis Manfred Sarmiento | Treasurer (placeholder) | Oct 2021-? |
| Mario Ernesto Garcia de Paredes | Resident Agent | Oct 2021-present |

### CFTC Officials (from DCM Application)

| Name | Role |
|------|------|
| Christopher J. Kirkpatrick | Secretary of the Commission (signed Orders of Designation) |
| Robert N. Sidman | Deputy Secretary (signed DCO registration) |
| Nancy Markowitz | CFTC (CC'd on application) |
| Aleko Stamoulis | CFTC (CC'd on application) |

### Regulatory Partners

| Name | Organization | Role |
|------|-------------|------|
| **Xavier Sottile** | KalshiEX LLC | Head of Markets (signs CFTC contract submissions) |
| **Brian Quintenz** | a16z | Former CFTC Commissioner; now a16z crypto policy lead |

---

## 13. Open Questions & Research Priorities

### High Priority (Actionable)

1. **CFTC ANPRM Comment Letter (Deadline: April 30, 2026):** Question 2.h explicitly asks about blockchain-based prediction markets. A public comment demonstrating how Aptos infrastructure addresses CFTC concerns (scalability, auditability, manipulation resistance) would be strategically valuable.

2. **Per-Contract Resolution Rules:** Polymarket US files individual Contract Rules with the CFTC specifying resolution sources for each contract type. These are not yet publicly available. Monitoring CFTC filings page for QCX LLC (Filing ID 49571) would reveal what resolution infrastructure they're building.

3. **POLY Token Whitepaper:** No official document published. When it drops, it will reveal the oracle architecture, tokenomics, and chain choice. This is the single highest-signal event to watch.

4. **On-Chain Contract Ownership:** Who controls the admin keys for CTFExchange, NegRiskAdapter, ConditionalTokens, and MOOV2 on Polygon? Verifiable today on-chain.

### Medium Priority

5. **Blockratize ownership of Adventure One:** What percentage stake does Blockratize hold? If sole or majority shareholder, the "independence" argument collapses.

6. **ICE Technology Partnership:** ICE operates its own exchange technology platform. Could ICE be providing the C/C++ matching engine for Polymarket US?

7. **Chainlink Integration Code:** The Chainlink Data Streams integration is live but entirely private. Understanding this architecture would reveal how Polymarket approaches automated resolution.

8. **POLY L2 Chain Architecture:** Is it an Optimism rollup? Arbitrum Orbit? Custom? The Platform Engineer role mentioning "Arbitrum Nova, Optimism roll-ups" suggests an OP Stack or Arbitrum L2.

### Lower Priority (But Interesting)

9. **Garcia de Paredes Law Firm:** Pattern analysis of other crypto entities using this firm for Panama incorporations.

10. **FBI FOIA Request:** Search warrant affidavit from November 2024 raid on Coplan's apartment could contain information about Adventure One.

11. **Token Issuance Entity:** The trademark is held by Blockratize (Delaware), but the token will likely be issued by a separate offshore entity (Cayman foundation, Swiss association). Which entity will issue POLY?

---

## 14. Strategic Implications for Aptos

### The Reality Check

Polymarket is not evaluating Aptos for its US or international platform. The evidence is unambiguous:
- Zero Move/Aptos mentions in hiring, code, or documentation
- US platform is fully off-chain (C/C++, FIX, FCM)
- International platform is Solidity/EVM with Arbitrum Nova/Optimism exploration
- The Smart Contract Engineer role specifies Solidity exclusively

### Where the Opportunity Remains

1. **CFTC Comment Window (April 30, 2026):** The ANPRM explicitly asks about blockchain infrastructure for prediction markets. A well-crafted comment letter could shape the regulatory framework.

2. **The UMA Replacement Gap:** $1.79B stuck in unresolved disputes. POLY token is coming but has no public code. If Aptos can demonstrate a working oracle alternative before POLY launches, there is a theoretical opportunity.

3. **Regulatory Arbitrage for New Entrants:** The CFTC is writing new rules. A new prediction market built natively on Aptos could apply for DCM designation with blockchain-native resolution built in from the start.

4. **The Resolution Data Source Requirement:** Staff Letter 26-08 requires DCMs to identify specific, reliable, manipulation-resistant data sources. On-chain oracle infrastructure with verifiable data provenance directly addresses this requirement.

5. **The Polymarket US Resolution Vacuum:** "Company sole discretion" with no specified data sources or challenge mechanism may not survive the CFTC's new rulemaking. There is an opportunity to build the resolution infrastructure that the CFTC will eventually require.

### What Has Been Built on Aptos (Testnet)

| Component | Location | Status |
|-----------|----------|--------|
| Oracle Integration | `contracts/sources/oracle.move` | Deployed |
| Optimistic Oracle | `contracts/sources/optimistic_oracle.move` | Deployed |
| Multi-Outcome Market | `contracts/sources/multi_outcome_market.move` | Deployed |
| Oracle Status UI | `src/components/oracle/OracleStatusPanel.tsx` | Built |
| POLY Token Design | Research pack Part VI | Designed |

**Testnet contract address:** `0xca4d40eae9f07fb28a121862d649203fb4335ece9536ee51790e19f812ff7aea`

---

## 15. Source Index

### CFTC Filings & Press Releases

| Document | URL/Citation |
|----------|-------------|
| CFTC Order: Blockratize Inc. (Jan 2022) | `https://www.cftc.gov/media/6891/enfblockratizeorder010322/download` |
| QCX LLC Order of Designation (Jul 2025) | `https://www.cftc.gov/sites/default/files/filings/documents/2025/orgdcmqcexorderofd250709.pdf` |
| QCX LLC Industry Filings | `https://www.cftc.gov/IndustryOversight/IndustryFilings/TradingOrganizations/49571` |
| Amended Order of Designation (Nov 2025) | `https://www.cftc.gov/media/12806/Polymarket%20US%20Amended%20Order%20of%20Designation/download` |
| No-Action Letter 25-28 (Sep 2025) | `https://www.cftc.gov/csl/25-28/download` |
| Release 9179-26: Withdrew proposed ban (Feb 2026) | CFTC Press Room |
| Release 9185-26: Enforcement advisory (Feb 2026) | CFTC Press Room |
| Release 9193-26: ANPRM published (Mar 2026) | CFTC Press Room |
| Release 9194-26: Staff Letter 26-08 (Mar 2026) | CFTC Press Room |
| ANPRM (91 FR 12516) | Federal Register |
| CFTC Ninth Circuit amicus brief (Feb 2026) | seligstatement021726 |
| Kalshi disapproval order (Sep 2023) | `https://www.cftc.gov/sites/default/files/filings/documents/2023/orgkexkalshiordersig230922.pdf` |

### Polymarket US Legal Documents

| Document | URL |
|----------|-----|
| Exchange Rulebook | `https://www.polymarketexchange.com/files/legal/latest/rulebook` |
| Risk Disclosure Statement | `https://www.polymarketexchange.com/files/legal/latest/risk-disclosure-statement` |
| Individual Participant Agreement | `https://www.polymarketexchange.com/files/legal/latest/participant-agreement` |
| Entity Participant Agreement | `https://www.polymarketexchange.com/files/legal/latest/participant-agreement-corporate` |
| Terms of Use (Sep 2025) | `https://www.polymarketexchange.com/files/legal/Website%20Terms%20of%20Use%20(2025.09.29).pdf` |
| Clearing Rulebook | `https://www.polymarketclearing.com/files/legal/latest/Polymarket%20Clearing%20Rulebook` |

### SEC EDGAR Filings

| Filing | CIK | Accession | Date |
|--------|-----|-----------|------|
| Form D | 0002041378 | 0002041378-24-000001 | Oct 18, 2024 |
| Form D/A | 0002041378 | 0002041378-25-000001 | Feb 25, 2025 |
| Form D ($257.5M) | 0002041378 | 0002041378-25-000003 | Aug 1, 2025 |

### USPTO Trademark Filings

| Mark | Serial Number | Filing Date | Applicant |
|------|--------------|------------|-----------|
| POLY | 99637043 | Feb 4, 2026 | Blockratize, Inc. |
| $POLY | (companion) | Feb 4, 2026 | Blockratize, Inc. |
| LIVETRADE | 99599899 | -- | Blockratize, Inc. |

### News & Analysis

| Source | Date | URL/Topic |
|--------|------|-----------|
| Sportico: Panama Structure | Feb 19, 2026 | `https://www.sportico.com/business/sports-betting/2026/polymarket-panama-adventure-one-prediction-market-1234885035/` |
| Ontario Securities Commission | Apr 2025 | `https://www.osc.ca/en/news-events/news/osc-reaches-settlement-current-and-former-operators-polymarket-breach-binary-options-ban` |
| Capital Markets Tribunal | Apr 17, 2025 | `https://www.capitalmarketstribunal.ca/sites/default/files/2025-04/rad_20250417_osc-blockratize.pdf` |
| PR Newswire: QCEX Acquisition | Jul 2025 | `https://www.prnewswire.com/news-releases/polymarket-acquires-cftc-licensed-exchange-and-clearinghouse-qcex-for-112-million-302509626.html` |
| Quadcode Blog: QCEX Sale | Jul 2025 | `https://quadcode.com/blog/quadcode-group-completes-112-million-sale-of-qcex-to-polymarket` |
| CoinDesk: CFTC Go-Ahead for QCX | Sep 2025 | `https://www.coindesk.com/policy/2025/09/03/u-s-cftc-gives-go-ahead-for-polymarket-s-new-exchange-qcx` |
| Sidley Austin: CFTC Rulemaking | Feb 2026 | `https://www.sidley.com/en/insights/newsupdates/2026/02/us-cftc-signals-imminent-rulemaking-on-prediction-markets` |
| CNBC: CFTC Scraps Ban | Jan 29, 2026 | `https://www.cnbc.com/2026/01/29/cftc-scraps-proposed-ban-on-sports-contracts-says-new-rules-coming.html` |
| CBS 60 Minutes: Coplan Interview | Nov 30, 2025 | `https://www.cbsnews.com/news/polymarket-ceo-shayne-coplan-online-betting-platform-60-minutes-transcript/` |
| Fortune: FBI Raid | Nov 14, 2024 | `https://fortune.com/crypto/2024/11/14/polymarket-ceo-shayne-coplan-fbi-raid/` |
| CNBC: DOJ/CFTC Drop Investigations | Jul 15, 2025 | `https://www.cnbc.com/2025/07/15/polymarket-investigations-doj-cftc-betting-market.html` |
| Fortune: Youngest Billionaire | Oct 2025 | `https://fortune.com/2025/10/11/shayne-coplan-polymarket-youngest-self-made-billionaire-nyse-investment-success/` |
| CoinDesk: Polymarket US Launch | Nov 25, 2025 | `https://www.coindesk.com/business/2025/11/25/polymarket-secures-cftc-approval-for-regulated-u-s-return` |
| MarketsWiki: QCX LLC | -- | `https://www.marketswiki.com/wiki/QCX,_LLC` |
| Kalshi Regulatory Filings | -- | `https://kalshi.com/regulatory/filings` |

### On-Chain Data Sources

| Data | Source |
|------|--------|
| Polymarket contracts on Polygon | PolygonScan |
| UMA token distribution | Etherscan, CoinCarp Rich List |
| Polymarket market data (434,578 markets) | Polymarket Gamma API (`https://gamma-api.polymarket.com/markets`) |
| UMA DVM voting records | UMA Docs, on-chain |
| Voter conflict of interest research | coldvision.xyz (Jan 2026) |

### GitHub Repositories

| Repo | URL | Key Content |
|------|-----|-------------|
| uma-ctf-adapter | `https://github.com/Polymarket/uma-ctf-adapter` | V4 adapter (deployed Sep 2025) |
| uma-sports-oracle | `https://github.com/Polymarket/uma-sports-oracle` | Sports resolution (deployed Feb 2025) |
| neg-risk-ctf-adapter | `https://github.com/Polymarket/neg-risk-ctf-adapter` | NegRisk adapter (delay removed Jan 2026) |
| resolution-subgraph | `https://github.com/Polymarket/resolution-subgraph` | All deployed resolution contracts |
| ctf-exchange | `https://github.com/Polymarket/ctf-exchange` | Core exchange contracts |
| polymarket-us-typescript | `https://github.com/Polymarket/polymarket-us-typescript` | US exchange SDK |
| polymarket-us-python | `https://github.com/Polymarket/polymarket-us-python` | US exchange SDK |
| polymarket-cli | `https://github.com/Polymarket/polymarket-cli` | Rust CLI |

### Academic & Technical References

| Reference | Source |
|-----------|--------|
| EIGEN whitepaper | `https://github.com/Layr-Labs/whitepaper/blob/master/EIGEN_Token_Whitepaper.pdf` |
| Prediction market AVS (hackathon) | `https://github.com/eztramble123/prediction-market-avs` |
| EigenLayer forum: AVS for Prediction Markets | `https://forum.eigenlayer.xyz/t/avs-for-prediction-markets-devcon-hacker-house-2024` |
| Hayek: "The Use of Knowledge in Society" (1945) | Foundation of information markets thesis |
| Robin Hanson: "Insider Trading and Prediction Markets" | George Mason University |

### Internal Research Documents

| Document | Location |
|----------|----------|
| Panama Corporate Structure Analysis | `docs/POLYMARKET-PANAMA-CORPORATE-STRUCTURE-ANALYSIS.md` |
| UMA Replacement Master Brief | `docs/UMA-REPLACEMENT-MASTER-BRIEF.md` |
| UMA Weakness Analysis | `docs/UMA-WEAKNESS-ANALYSIS.md` |
| Infrastructure Report | `docs/POLYMARKET_INFRASTRUCTURE_REPORT.md` |
| Failure Data | `docs/POLYMARKET_FAILURE_DATA.md` |
| Oracle Architecture Report | `docs/UMA-ORACLE-POLYMARKET-REPORT.md` |
| Oracle Architecture Proposal | `docs/ORACLE_ARCHITECTURE_PROPOSAL.md` |
| Investigation Questions | `docs/POLYMARKET_INVESTIGATION_QUESTIONS.md` |
| Investigation Answers | `docs/POLYMARKET_INVESTIGATION_ANSWERS.md` |

---

*Document compiled March 23, 2026. Data from 15 parallel agent investigations, 434,578 scraped markets, 95 GitHub repositories, ~180 pages of legal documents, CFTC/SEC/USPTO filings, and OSINT analysis.*
