# Polymarket Oracle Research Index

This file is a navigation map for the existing research and implementation artifacts in this repo.  
It does not replace any document; it organizes what already exists so you can find answers quickly.

---

## 1) Fast Navigation by Question

If you need a specific answer, start here:

| Question | Primary Source | Supporting Sources |
|---|---|---|
| What is fundamentally wrong with UMA? | `docs/UMA-WEAKNESS-ANALYSIS.md` | `docs/UMA-ONE-PAGE-WHATS-WRONG.md`, `docs/UMA-REPLACEMENT-MASTER-BRIEF.md` |
| What empirical data proves UMA failure? | `docs/UMA-WEAKNESS-ANALYSIS.md` | `docs/UMA-REPLACEMENT-MASTER-BRIEF.md` |
| What is the architecture replacement plan? | `docs/UMA-ORACLE-POLYMARKET-REPORT.md` | `docs/ORACLE_ARCHITECTURE_PROPOSAL.md`, `docs/ORACLE-AND-PRIVACY-DESIGN-REVIEW.md` |
| What is the POLY token oracle design? | `docs/UMA-ORACLE-POLYMARKET-REPORT.md` (Part VI) | `docs/UMA-REPLACEMENT-MASTER-BRIEF.md`, `contracts/sources/poly_token.move`, `contracts/sources/poly_oracle.move` |
| What did we validate on-chain vs pseudo-code? | `docs/ORACLE-AND-PRIVACY-DESIGN-REVIEW.md` | `contracts/sources/*.move` listed below |
| What are Polymarket infra bottlenecks today? | `docs/POLYMARKET_INFRASTRUCTURE_REPORT.md` | `docs/POLYMARKET_FAILURE_DATA.md`, `docs/POLYMARKET_INVESTIGATION_ANSWERS.md` |
| What are the investigation Q&A details and evidence? | `docs/POLYMARKET_INVESTIGATION_ANSWERS.md` | `docs/POLYMARKET_INVESTIGATION_QUESTIONS.md` |
| What is the compact memo version? | `docs/UMA-ONE-PAGE-WHATS-WRONG.md` | `docs/UMA-ONE-PAGE-WHATS-WRONG.pdf` |

---

## 2) Canonical Reading Order (3 Tracks)

### A) Executive / Decision Track (fast)
1. `docs/UMA-ONE-PAGE-WHATS-WRONG.md`
2. `docs/UMA-REPLACEMENT-MASTER-BRIEF.md`
3. `docs/POLYMARKET_INFRASTRUCTURE_REPORT.md`

### B) Evidence / Diligence Track (deep)
1. `docs/UMA-WEAKNESS-ANALYSIS.md`
2. `docs/POLYMARKET_INVESTIGATION_ANSWERS.md`
3. `docs/POLYMARKET_FAILURE_DATA.md`
4. `docs/UMA-ORACLE-POLYMARKET-REPORT.md`

### C) Implementation / Build Track (engineering)
1. `docs/ORACLE-AND-PRIVACY-DESIGN-REVIEW.md`
2. `docs/ORACLE_ARCHITECTURE_PROPOSAL.md`
3. `docs/oracle-integration.md`
4. Contracts and frontend artifacts listed in Sections 4 and 5

---

## 3) Document Catalog by Theme

### UMA Failure, Risk, and Replacement Narrative

| File | Role | Core Value |
|---|---|---|
| `docs/UMA-WEAKNESS-ANALYSIS.md` | Primary empirical evidence report | Largest quantitative UMA-failure dataset in repo; dispute/failure/griefing metrics and incident analysis |
| `docs/UMA-REPLACEMENT-MASTER-BRIEF.md` | Strategic replacement brief | Connects empirical evidence to migration and POLY-oriented replacement positioning |
| `docs/UMA-ORACLE-POLYMARKET-REPORT.md` | Full architecture + migration options | End-to-end problem/solution report with implementation details and deployment strategy |
| `docs/UMA-ONE-PAGE-WHATS-WRONG.md` | Condensed technical memo | Compact statement of failure modes and why UMA is structurally misaligned |
| `docs/UMA-ONE-PAGE-WHATS-WRONG.pdf` | Shareable formatted output | Presentation-ready version of the one-page memo |

### Oracle Architecture and Integration Design

| File | Role | Core Value |
|---|---|---|
| `docs/ORACLE_ARCHITECTURE_PROPOSAL.md` | Multi-tier oracle architecture concept | Tiered resolution model (objective vs subjective), incident framing, and migration rationale |
| `docs/ORACLE-AND-PRIVACY-DESIGN-REVIEW.md` | Validation checkpoint and gap analysis | Production vs pseudo-code inventory, testnet verification, open design questions, build priorities |
| `docs/oracle-integration.md` | Integration reference | Implementation-facing notes for wiring oracle behavior into the market system |

### Polymarket Infrastructure and Investigation Evidence

| File | Role | Core Value |
|---|---|---|
| `docs/POLYMARKET_INFRASTRUCTURE_REPORT.md` | Infra deep-dive | On-chain/off-chain architecture mapping, throughput realities, bottlenecks, outage context |
| `docs/POLYMARKET_FAILURE_DATA.md` | Incident/failure evidence pack | Outage timeline, UMA failure incidents, and infrastructure pain-point evidence |
| `docs/POLYMARKET_INVESTIGATION_QUESTIONS.md` | Research checklist | Structured investigation prompts by subsystem |
| `docs/POLYMARKET_INVESTIGATION_ANSWERS.md` | Evidence-backed Q&A | Filled answers with source-backed findings across CLOB, RPC, subgraph, settlement, and oracle |
| `docs/APTOS_POLYMARKET_ARCHITECTURE.md` | Broader architecture baseline | Comprehensive architecture context used across oracle and infra discussions |

---

## 4) Contract Artifacts (Source of Truth for Implementation)

These are the core Move modules connected to the oracle/POLY/market-resolution narrative:

| File | Focus Area | Current Role in Research Narrative |
|---|---|---|
| `contracts/sources/multi_outcome_market.move` | Market engine + resolution hooks | Main market contract and settlement integration point |
| `contracts/sources/oracle.move` | Objective oracle path | Pyth-oriented objective market resolution base |
| `contracts/sources/optimistic_oracle.move` | Subjective oracle path (existing) | Baseline optimistic flow with challenge mechanics |
| `contracts/sources/market_resolution.move` | Resolution orchestration | Unifies and wires market resolution paths |
| `contracts/sources/chainlink_adapter.move` | Chainlink feed adapter | Connects Chainlink data feed pattern to settlement flow |
| `contracts/sources/poly_token.move` | POLY token economics/governance | Staking and governance primitives for replacement model |
| `contracts/sources/poly_oracle.move` | UMA replacement oracle logic | Propose/challenge/vote design for subjective outcomes |
| `contracts/sources/confidential_trading.move` | Privacy layer for positions | Confidential position handling and conflict-check support |

---

## 5) Frontend and SDK Artifacts

| File | Purpose |
|---|---|
| `src/components/oracle/OracleStatusPanel.tsx` | Oracle status and flow visualization in UI |
| `src/components/oracle/UMAComparisonPanel.tsx` | Comparative UI framing for UMA vs proposed model |
| `src/components/oracle/FailureMetricsPanel.tsx` | Visualizes failure/statistics discussion |
| `src/confidential/ConfidentialTrading.ts` | TypeScript integration layer for confidential trading flows |

---

## 6) Claims-to-Sources Crosswalk

Use this when you want to verify specific high-impact claims quickly:

| Claim | Primary Source |
|---|---|
| 434,578 markets analyzed; $51.7B volume | `docs/UMA-WEAKNESS-ANALYSIS.md` |
| 57.2% disputed markets unresolved | `docs/UMA-WEAKNESS-ANALYSIS.md` |
| ~$1.79B stuck in unresolved disputed markets | `docs/UMA-WEAKNESS-ANALYSIS.md` |
| 95% unresolved disputes against clear consensus (griefing framing) | `docs/UMA-WEAKNESS-ANALYSIS.md` |
| Top 10 UMA holders concentration and voting power concern | `docs/UMA-WEAKNESS-ANALYSIS.md`, `docs/UMA-REPLACEMENT-MASTER-BRIEF.md` |
| March 2025 high-impact governance attack narrative | `docs/UMA-WEAKNESS-ANALYSIS.md`, `docs/POLYMARKET_FAILURE_DATA.md` |
| MOOV2 proposer restriction shift (open -> whitelist) | `docs/UMA-WEAKNESS-ANALYSIS.md`, `docs/UMA-REPLACEMENT-MASTER-BRIEF.md` |
| Chainlink integration for objective-market path | `docs/UMA-REPLACEMENT-MASTER-BRIEF.md`, `docs/ORACLE-AND-PRIVACY-DESIGN-REVIEW.md` |
| Infra bottlenecks (CLOB, oracle delay, RPC/indexing/operator dependence) | `docs/POLYMARKET_INFRASTRUCTURE_REPORT.md` |

---

## 7) Data and Reproducibility Notes

- Some docs reference external or previously generated analysis outputs/scripts (for example under `prediction-market-analysis/...` paths).
- Those referenced JSON/script paths are not currently present under this repo root in this workspace snapshot.
- For repeatable data workflows, treat `docs/UMA-WEAKNESS-ANALYSIS.md` as the authoritative embedded summary unless/until raw data artifacts are restored into the repository.

---

## 8) Recommended Organization Convention Going Forward

Without deleting or rewriting existing documents, use this lightweight convention:

1. Keep this index as the top navigation entry point.
2. Treat `UMA-WEAKNESS-ANALYSIS.md` as empirical source-of-truth for UMA critiques.
3. Treat `ORACLE-AND-PRIVACY-DESIGN-REVIEW.md` as implementation status tracker.
4. Treat `UMA-ORACLE-POLYMARKET-REPORT.md` as full architecture/migration master doc.
5. Keep memo outputs (`UMA-ONE-PAGE-*`) as communication artifacts derived from the above.

This preserves all current writing while making the corpus easier to read, verify, and maintain.
