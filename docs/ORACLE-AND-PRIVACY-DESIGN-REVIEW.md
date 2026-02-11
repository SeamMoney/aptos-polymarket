# Oracle & Privacy Layer — Design Review and Open Questions

**Date:** 2026-02-10
**Status:** Pseudo-code complete, pre-implementation review

---

## 1. What We've Built (Inventory)

### Production (Deployed on Testnet)

| Contract | Lines | Status | Purpose |
|----------|-------|--------|---------|
| `multi_outcome_market.move` | 1,147 | **Deployed** | CPMM AMM with per-outcome parallelism |
| `usd1.move` | 256 | **Deployed** | Custom collateral avoiding APT contention |
| `oracle.move` | 298 | **Deployed** | Pyth-based price oracle (crypto markets) |
| `optimistic_oracle.move` | 476 | **Deployed** | 15-min challenge oracle (standalone) |
| `prediction_market.move` | 597 | **Deprecated** | Legacy binary market |

### Pseudo-Code Drafts (Not Deployed)

| File | Lines | Pseudo % | Purpose |
|------|-------|----------|---------|
| `poly_token.move` | 201 | ~60% | POLY governance token + staking |
| `poly_oracle.move` | 683 | ~50% | UMA replacement (propose/challenge/vote) |
| `chainlink_adapter.move` | 189 | ~80% | Chainlink Data Feeds wrapper |
| `confidential_trading.move` | 283 | ~80% | Privacy layer (wrap/unwrap positions) |
| `market_resolution.move` | 283 | ~90% | Unified resolution wiring |
| `src/confidential/ConfidentialTrading.ts` | 613 | ~90% | TypeScript SDK for confidential assets |

### Research Documents

| Doc | Purpose |
|-----|---------|
| `docs/UMA-WEAKNESS-ANALYSIS.md` | 434K market scrape, $1.79B stuck, 57% failure rate |
| `docs/UMA-REPLACEMENT-MASTER-BRIEF.md` | Strategic brief for Polymarket/Chainlink/Aptos Foundation |

---

## 2. On-Chain Verification Results

### Confidential Assets — CONFIRMED LIVE (testnet)

- **Address:** `0xbe14a545c8e1f0024a1665f39fc1227c066727a70236e784fb203ec619fedf4c`
- **Modules:** 10 (confidential_asset, confidential_balance, confidential_proof, ristretto255_twisted_elgamal, etc.)
- **Key functions confirmed:**
  - `register()` — register confidential store for a token
  - `deposit()` / `deposit_to()` — public → confidential (wrapping)
  - `withdraw()` / `withdraw_to()` — confidential → public (unwrapping)
  - `confidential_transfer()` — private transfer between users
  - `rollover_pending_balance()` — make deposits spendable
  - `set_auditor()` / `get_auditor()` — regulatory compliance
  - `has_confidential_asset_store()` — view function for conflict checks
- **Crypto primitives:** ristretto255, bulletproofs, twisted_elgamal all available
- **Impact on design:** Our `confidential_trading.move` pseudo-code aligns with the real API

### Chainlink Data Feeds — CONFIRMED LIVE (testnet)

- **Address:** `0xf1099f135ddddad1c065203431be328a408b0ca452ada70374ce26bd2b32fdd3`
- **Modules:** 3 (router, registry, migration_helper)
- **Key functions confirmed:**
  - `get_benchmarks(&signer, vector<vector<u8>>)` — batch price fetch
  - `get_reports(&signer, vector<vector<u8>>)` — batch report fetch
  - `get_feeds()` — view function listing available feeds
  - `get_feed_metadata()` — feed details
- **Returns:** `Benchmark` struct with `get_benchmark_value()` → u256, `get_benchmark_timestamp()` → u256
- **Impact on design:** Our adapter assumed `get_latest_price(feed_id)` pattern but real API uses `get_benchmarks()` with signer. Needs update.

### AIP-125 Event-Driven Transactions — NOT ON TESTNET

- Searched all 127 modules at `0x1` — no scheduling or event-driven modules
- **Impact on design:** Can't use auto-scheduled resolution. Need manual trigger or keeper script.

### Summary Table

| Feature | On Testnet? | Our Pseudo-Code Valid? |
|---------|-------------|----------------------|
| Confidential Assets (CA) | **YES** | YES — API matches |
| CA Auditor support | **YES** | YES — `set_auditor()` exists |
| CA `has_confidential_asset_store()` | **YES** | YES — conflict check works |
| Chainlink Data Feeds | **YES** | NEEDS UPDATE — different API pattern |
| AIP-125 Scheduling | **NO** | N/A — need keeper script instead |
| Ristretto255 + Bulletproofs | **YES** (at 0x1) | YES — ZK proofs possible |

---

## 3. Architecture: What Works

### Hybrid Oracle Model (mirrors Polymarket)
```
OBJECTIVE MARKETS          SUBJECTIVE MARKETS
(BTC > $100K?)            (Did Cardi B perform?)
       │                          │
  Chainlink Data Feed       POLY Oracle
  (instant, permissionless) (15min-4hr, bonded)
       │                          │
       └──────────┬───────────────┘
                  │
     multi_outcome_market.resolve()
                  │
          Redemption (1:1)
```

This is validated. Polymarket uses exactly this pattern (Chainlink + UMA → settlement).

### Confidential Position Model
```
Buy (public AMM) → Wrap (position hidden) → Accumulate → Unwrap → Sell/Redeem
                                                                      │
                                                              Re-wrap proceeds
```

Individual trades visible at execution. Cumulative position hidden. Auditor can decrypt all. This is the right tradeoff for prediction markets.

### Voter Conflict Check (Novel)
```
Want to vote on "BTC > $100K?" dispute:
  1. Check: voter staked >= 100 POLY? ✓
  2. Check: voter public BTC-YES tokens == 0? ✓
  3. Check: voter confidential BTC-YES tokens == 0? (ZK proof) ✓
  → Allowed to vote
```

This is impossible on Polymarket/UMA. It's our key differentiator.

---

## 4. Open Questions — MUST RESOLVE BEFORE BUILDING

### Q1: Chainlink API Pattern Mismatch
**Problem:** Our `chainlink_adapter.move` assumes a `get_latest_price(feed_id)` pattern (from Decibel reference code). But the actual on-chain contract at `0xf1099f...` uses `get_benchmarks(&signer, vector<vector<u8>>)`.

**Questions:**
- Does `get_benchmarks()` require the caller to be a registered feed consumer?
- Is the signer just for authentication/fee purposes, or does it restrict who can read?
- Can any address call `get_benchmarks()`, or do we need to register first?
- Are there actual live feeds on testnet we can test against? (`get_feeds()` should tell us)

**Action:** Call `get_feeds()` view function on testnet to see what feeds exist and test `get_benchmarks()`.

### Q2: Confidential Asset Integration Mechanics
**Problem:** We know the CA module is live, but haven't tested the actual flow.

**Questions:**
- What's the exact format for the `encryption_key` parameter in `register()`?
- How does `rollover_pending_balance()` work — does it require a proof?
- What WASM bindings are needed client-side? Is `@aptos-labs/confidential-asset-wasm-bindings` published?
- Can we `deposit()` fungible asset tokens that were created by our contract (outcome tokens), or only "official" tokens?
- What happens if we `set_auditor()` on outcome tokens we created — does it work for tokens minted by our AMM?

**Action:** Write a minimal test script that registers a CA store for an outcome token and deposits/withdraws.

### Q3: Zero-Balance Proof Feasibility
**Problem:** Our oracle voter conflict check requires proving "I hold zero confidential tokens in this market." We designed three approaches but haven't validated any.

**Questions:**
- **Approach A (store existence check):** If `has_confidential_asset_store()` returns false, voter never held confidential tokens. But what if they registered, wrapped, then unwrapped back to zero? Store still exists.
- **Approach B (sigma proof):** Can we build a Schnorr-like proof using `ristretto255` that's available at 0x1? The proof would show all ciphertext chunks encrypt zero. Has anyone done this on Aptos?
- **Approach C (auditor attestation):** The auditor decrypts and attests zero balance. But this means the auditor must be online during every vote. Is that acceptable?

**Practical path:** Start with Approach A for demo (imperfect but simple). Build Approach B for production. Keep Approach C as fallback.

### Q4: optimistic_oracle.move vs poly_oracle.move
**Problem:** We have two oracle contracts for subjective markets. The old `optimistic_oracle.move` is deployed but has a critical gap — it doesn't callback to `multi_outcome_market` to actually resolve. The new `poly_oracle.move` is a more complete design but is pseudocode.

**Questions:**
- Do we deprecate `optimistic_oracle.move` entirely?
- Or do we refactor it to become the real implementation of `poly_oracle.move`?
- The deployed version has a committee model (7 members, 4/7 quorum). The new design uses quadratic token-weighted voting. Which do we keep?
- Can we deploy a new version that replaces the old one, or do we need a migration?

**Recommendation:** Deprecate `optimistic_oracle.move`. Build `poly_oracle.move` as the replacement. The quadratic voting model is strictly better than committee voting for decentralization.

### Q5: POLY Token Economics
**Problem:** The token design has several unresolved economic parameters.

**Questions:**
- **Supply:** 100M fixed — but who gets the initial distribution?
- **Bond size:** 5,000 POLY to propose. At what POLY price does this become too expensive or too cheap?
- **Minimum voter stake:** 100 POLY. Same question — what's the right level?
- **Slashing:** Losing proposer loses bond. But do incorrect voters get slashed? How much?
- **Reputation formula:** +1% for correct vote, -3% for incorrect. Is this asymmetry right?
- **Initial reputation:** New stakers start at 50% (5000/10000). Too high? Too low?
- **Staking cooldown:** How long before unstaked POLY is withdrawable? (Prevents vote-and-run)

**Action:** These are game theory questions. Need modeling or at minimum a spreadsheet showing attack scenarios.

### Q6: AIP-125 Replacement
**Problem:** AIP-125 (scheduled transactions) is not on testnet. Our design assumed it for auto-resolution of objective markets.

**Questions:**
- Do we build a TypeScript keeper that polls for expired markets and calls `resolve_with_chainlink()`?
- How frequently should the keeper poll? Every block? Every 10 seconds?
- Who pays gas for keeper-triggered resolution? Market creator pre-funds? Anyone can trigger?
- Should we incentivize resolution (small reward for the caller)?

**Recommendation:** Build a simple keeper script. Anyone can call `resolve_with_chainlink()` after `end_time` — it's permissionless. No reward needed initially (gas is cheap on Aptos). Add AIP-125 when it ships.

### Q7: Friend Module Pattern for Oracle Callbacks
**Problem:** `poly_oracle.move` needs to call back into `multi_outcome_market.move` to resolve a market. But `resolve()` is currently admin-only.

**Questions:**
- Do we add a `friend` declaration so `poly_oracle` can call a `resolve_from_oracle()` function?
- Or do we use a resource account / object signer pattern?
- The existing `resolve_with_pyth()` works because anyone can call it (permissionless). Can we make `resolve_from_poly_oracle()` similarly permissionless with an on-chain state check?

**Recommendation:** Add a new `resolve_from_oracle(market_addr, winning_outcome, oracle_proof)` function that:
1. Checks the market's `oracle_config` type matches the caller
2. Verifies the oracle proof (Chainlink result or POLY oracle finalization event)
3. Resolves the market

This avoids friend modules and keeps it permissionless.

### Q8: Confidential Trading — When to Wrap?
**Problem:** The `buy_and_wrap()` convenience function buys via public AMM then wraps. But the trade is visible at execution time.

**Questions:**
- Is "visible at execution, hidden after" good enough for our use case?
- With encrypted mempool (future), even the trade would be hidden. When is this expected on Aptos?
- Should we build a "confidential AMM" where reserves are also encrypted? (Much harder, probably not worth it)
- Do market makers need special treatment? They need to see their positions to manage risk.

**Answer:** "Visible at execution, hidden after" is the same model as a stock exchange dark pool. It's sufficient. The key privacy property is that accumulated position size is hidden, preventing copy-trading and frontrunning of large exits. Market makers can use the standard public interface.

---

## 5. Known Gaps in Pseudo-Code

### Critical (blocks any demo)

| Gap | In File | Impact |
|-----|---------|--------|
| Chainlink API mismatch | `chainlink_adapter.move` | Can't resolve objective markets |
| No callback from oracle → market | `poly_oracle.move` / `multi_outcome_market.move` | POLY oracle can't actually resolve |
| Bond escrow not implemented | `poly_oracle.move`, `poly_token.move` | No economic security for proposals |

### Important (blocks production, not demo)

| Gap | In File | Impact |
|-----|---------|--------|
| Zero-balance proof not implemented | `confidential_trading.move` | Voter conflict check is fake |
| Reputation tracking not wired | `poly_oracle.move` | All voters weighted equally |
| Slashing not implemented | `poly_token.move` | No penalty for bad proposals |
| WASM bindings integration | `ConfidentialTrading.ts` | Can't generate ZK proofs client-side |

### Nice-to-Have (future)

| Gap | In File | Impact |
|-----|---------|--------|
| AIP-125 scheduling | `market_resolution.move` | Need manual trigger for resolution |
| Encrypted mempool | N/A | Trades visible at execution time |
| Multi-source oracle | `oracle.move` | Only Pyth, not Chainlink+Pyth composite |

---

## 6. Build Priority (Recommended Order)

### Phase 1: Objective Market Resolution (1-2 weeks)
1. Fix `chainlink_adapter.move` to use real `get_benchmarks()` API
2. Add `resolve_from_oracle()` to `multi_outcome_market.move`
3. Wire Chainlink adapter → market resolution
4. Build keeper script for post-`end_time` resolution
5. **Deliverable:** Markets that auto-resolve using Chainlink price feeds

### Phase 2: POLY Oracle (2-3 weeks)
1. Implement `poly_token.move` fully (staking, escrow, slashing)
2. Implement `poly_oracle.move` core flow (propose → challenge → vote → resolve)
3. Wire oracle callback to market resolution
4. Build frontend for proposing/challenging/voting
5. **Deliverable:** Subjective markets with bonded resolution

### Phase 3: Confidential Positions (2-3 weeks)
1. Test CA integration with our outcome tokens
2. Implement `confidential_trading.move` wrap/unwrap
3. Build TypeScript SDK with WASM proof generation
4. Implement Approach A (simple store check) for voter conflict
5. **Deliverable:** Users can hide position sizes

### Phase 4: Production Hardening (1-2 weeks)
1. Zero-balance proofs (Approach B) for voter conflict
2. Auditor integration for regulatory compliance
3. Reputation tracking and slashing
4. Formal verification of critical paths

---

## 7. Comparison: Us vs Polymarket

| Aspect | Polymarket (Polygon) | Our Design (Aptos) | Status |
|--------|---------------------|--------------------|---------|
| **Objective Oracle** | Chainlink Data Streams + Automation | Chainlink Data Feeds + keeper | Pseudo-code |
| **Subjective Oracle** | UMA ($750 bond, 72hr+, 57% fail) | POLY ($5K bond, 4hr max, 0% fail) | Pseudo-code |
| **Voting** | 1 token = 1 vote (whales win) | Quadratic: sqrt(tokens) * reputation | Pseudo-code |
| **Voter Conflicts** | None checked on-chain | Position check + ZK proof | Pseudo-code |
| **Position Privacy** | Fully public | Confidential Assets (hidden amounts) | Pseudo-code |
| **Regulatory** | Off-chain DB only | On-chain auditor selective disclosure | Pseudo-code |
| **Speed** | ~2s blocks, 100 TPS | Sub-second, 3,000+ TPS verified | **Production** |
| **AMM** | CLOB (off-chain matching) | On-chain CPMM with parallelism | **Production** |
| **Collateral** | USDC | USD1 (custom, parallel-safe) | **Production** |

**Bottom line:** AMM + TPS are production-ready. Oracle + privacy are designed but not built.

---

## 8. Files Changed / Created in This Design Phase

### New files (untracked, to be committed):
```
contracts/sources/chainlink_adapter.move     — Chainlink price feed wrapper
contracts/sources/confidential_trading.move  — Privacy layer for positions
contracts/sources/market_resolution.move     — Unified resolution wiring
contracts/sources/poly_oracle.move           — UMA replacement oracle
contracts/sources/poly_token.move            — POLY governance token
src/confidential/ConfidentialTrading.ts      — TypeScript SDK for CA
```

### Existing docs (already committed):
```
docs/UMA-WEAKNESS-ANALYSIS.md              — 434K market empirical analysis
docs/UMA-REPLACEMENT-MASTER-BRIEF.md       — Strategic pitch document
```
