/// Market Resolution — Unified resolution interface wiring oracles to markets
///
/// PSEUDO-CODE / DESIGN DRAFT — Not production-ready
///
/// This module bridges the gap between our oracle systems and the AMM contract.
/// Currently, multi_outcome_market.move has:
///   - resolve()           → admin only
///   - resolve_with_pyth() → Pyth price check
///
/// MISSING (what this module adds):
///   - resolve_with_chainlink()  → Chainlink Data Feed check
///   - resolve_from_poly_oracle() → Callback from POLY oracle after vote
///   - schedule_resolution()      → AIP-125 auto-resolution at end_time
///
/// ARCHITECTURE:
///
///   ┌──────────────────────────────────────────────────────────────────┐
///   │                    MARKET CREATION                               │
///   │                                                                  │
///   │  Creator specifies oracle type:                                  │
///   │                                                                  │
///   │  OBJECTIVE MARKETS                SUBJECTIVE MARKETS             │
///   │  ─────────────────                ──────────────────             │
///   │  "BTC above $100K?"               "Did Cardi B perform?"        │
///   │  oracle_type = CHAINLINK (4)      oracle_type = POLY (5)        │
///   │  feed_id = BTC/USD                (no feed needed)              │
///   │  target_price = 100K              (human judgment)              │
///   │  condition = ABOVE                                              │
///   │                                                                  │
///   └──────────────────────────────────────────────────────────────────┘
///                           │
///                           ▼
///   ┌──────────────────────────────────────────────────────────────────┐
///   │                    MARKET TRADING                                │
///   │                                                                  │
///   │  Same for both types:                                           │
///   │  - buy_outcome() / sell_outcome() via CPMM                      │
///   │  - Optional: wrap into confidential balance after trade          │
///   │  - Encrypted mempool hides pre-execution intent (future)         │
///   │                                                                  │
///   └──────────────────────────────────────────────────────────────────┘
///                           │
///                           ▼
///   ┌──────────────────────────────────────────────────────────────────┐
///   │                    MARKET RESOLUTION                             │
///   │                                                                  │
///   │  OBJECTIVE (Chainlink)            SUBJECTIVE (POLY Oracle)       │
///   │  ─────────────────────            ─────────────────────────     │
///   │  1. Market end_time reached       1. Market end_time reached     │
///   │  2. Anyone calls                  2. Proposer posts bond +       │
///   │     resolve_with_chainlink()         proposes outcome            │
///   │  3. Reads Chainlink price         3. 15-min challenge window     │
///   │  4. Checks condition              4a. No challenge → finalized   │
///   │  5. Market resolved instantly     4b. Challenged → 4hr voting    │
///   │                                   5. Votes counted (quadratic)   │
///   │  Time: ~1 second                  6. Market resolved via callback│
///   │  Cost: Gas only                                                  │
///   │                                   Time: 15min - 4hr              │
///   │  OR: AIP-125 scheduled            Cost: 5K POLY bond             │
///   │  auto-resolution at end_time                                    │
///   │  (no human trigger needed)        NEVER stuck: emergency resolve │
///   │                                   after 5hr if no quorum        │
///   └──────────────────────────────────────────────────────────────────┘
///                           │
///                           ▼
///   ┌──────────────────────────────────────────────────────────────────┐
///   │                    REDEMPTION                                    │
///   │                                                                  │
///   │  Same for both types:                                           │
///   │  1. Unwrap confidential position (if wrapped)                   │
///   │  2. redeem_winnings() → winning tokens → collateral (1:1)       │
///   │  3. Re-wrap collateral into confidential balance (optional)      │
///   │                                                                  │
///   └──────────────────────────────────────────────────────────────────┘
///
module prediction_market::market_resolution {
    use std::string::String;
    use aptos_framework::object::Object;
    use aptos_framework::fungible_asset::Metadata;
    // PSEUDO: real imports
    // use prediction_market::multi_outcome_market;
    // use prediction_market::oracle;
    // use prediction_market::chainlink_adapter;
    // use prediction_market::poly_oracle;

    // ==================== Oracle Type Constants ====================
    // Extended from oracle.move

    const ORACLE_TYPE_ADMIN: u8 = 0;
    const ORACLE_TYPE_PYTH: u8 = 1;
    const ORACLE_TYPE_SWITCHBOARD: u8 = 2;
    const ORACLE_TYPE_OPTIMISTIC: u8 = 3;  // Legacy (old optimistic_oracle.move)
    const ORACLE_TYPE_CHAINLINK: u8 = 4;   // NEW: Chainlink Data Feeds
    const ORACLE_TYPE_POLY: u8 = 5;        // NEW: POLY token oracle

    // ==================== Market Creation Helpers ====================

    /// Create an objective market with Chainlink resolution
    ///
    /// Example: "Will BTC be above $100,000 on March 1, 2026?"
    /// - Resolves automatically via Chainlink BTC/USD feed
    /// - Anyone can trigger resolution after end_time
    /// - OR use AIP-125 to schedule auto-resolution
    ///
    public entry fun create_objective_market(
        _creator: &signer,
        _question: String,
        _description: String,
        _end_time: u64,
        _chainlink_feed_id: vector<u8>,
        _target_price: u64,
        _condition: u8, // 0=above, 1=below
        _collateral_metadata: Object<Metadata>,
        _initial_liquidity: u64,
    ) {
        // PSEUDO:
        // 1. Create multi-outcome market (binary: Yes/No)
        //    multi_outcome_market::create_multi_market_with_collateral(
        //        creator, question, description, "Crypto",
        //        vector[utf8(b"Yes"), utf8(b"No")],
        //        end_time, initial_liquidity, collateral_metadata
        //    );
        //
        // 2. Set oracle config to Chainlink
        //    let config = chainlink_adapter::new_chainlink_config(
        //        chainlink_feed_id, target_price, condition
        //    );
        //    // Would need to extend oracle.move to support ChainlinkConfig
        //    multi_outcome_market::set_oracle_config(creator, market_addr, ORACLE_TYPE_CHAINLINK, ...);
        //
        // 3. Optionally schedule AIP-125 auto-resolution
        //    schedule_chainlink_resolution(market_addr, end_time);
    }

    /// Create a subjective market with POLY oracle resolution
    ///
    /// Example: "Did Cardi B perform at the Super Bowl?"
    /// - Requires human judgment to resolve
    /// - Anyone can propose (with 5K POLY bond)
    /// - 15-minute challenge window
    /// - If challenged: 4-hour POLY staker voting period
    ///
    public entry fun create_subjective_market(
        _creator: &signer,
        _question: String,
        _description: String,
        _category: String,
        _outcome_labels: vector<String>,
        _end_time: u64,
        _collateral_metadata: Object<Metadata>,
        _initial_liquidity: u64,
    ) {
        // PSEUDO:
        // 1. Create multi-outcome market
        //    multi_outcome_market::create_multi_market_with_collateral(
        //        creator, question, description, category,
        //        outcome_labels, end_time, initial_liquidity, collateral_metadata
        //    );
        //
        // 2. Set oracle config to POLY
        //    multi_outcome_market::set_oracle_config(creator, market_addr, ORACLE_TYPE_POLY, ...);
        //
        // NOTE: No scheduled resolution for subjective markets.
        // Someone must manually propose after end_time.
    }

    // ==================== Resolution Functions ====================

    /// Resolve market using Chainlink Data Feed
    ///
    /// Anyone can call this after market end_time.
    /// Reads the latest Chainlink price, checks the condition,
    /// and resolves the market immediately.
    ///
    public entry fun resolve_with_chainlink(
        _market_addr: address,
    ) {
        // PSEUDO:
        // let market = borrow_global_mut<MultiMarket>(market_addr);
        // assert!(!market.resolved, E_ALREADY_RESOLVED);
        // assert!(timestamp::now_seconds() >= market.end_time, E_MARKET_STILL_ACTIVE);
        //
        // let oracle_config = option::borrow(&market.oracle_config);
        // assert!(oracle::get_oracle_type(oracle_config) == ORACLE_TYPE_CHAINLINK, E_WRONG_ORACLE);
        //
        // // Get Chainlink price
        // let chainlink_config = get_chainlink_config_from_oracle(oracle_config);
        // let (condition_met, price) = chainlink_adapter::check_condition(&chainlink_config);
        //
        // // Determine winner: Yes (0) if condition met, No (1) otherwise
        // let winning_outcome = if (condition_met) { 0 } else { 1 };
        //
        // // Resolve
        // market.resolved = true;
        // market.winning_outcome = option::some(winning_outcome);
        // market.oracle_resolved = true;
        // market.resolution_price = option::some(price);
        //
        // event::emit(OracleResolution { ... });
    }

    /// Resolve market from POLY oracle callback
    ///
    /// This is a FRIEND function — only callable by poly_oracle module.
    /// Called after:
    ///   a) Unchallenged proposal is finalized (15 min)
    ///   b) Dispute vote is counted and resolved (up to 4 hr)
    ///   c) Emergency resolution by admin (last resort)
    ///
    public entry fun resolve_from_poly_oracle(
        _oracle_signer: &signer,  // Must be poly_oracle module
        _market_addr: address,
        _winning_outcome: u64,
    ) {
        // PSEUDO:
        // // Verify caller is the poly_oracle module
        // assert!(signer::address_of(oracle_signer) == @prediction_market, E_NOT_AUTHORIZED);
        //
        // let market = borrow_global_mut<MultiMarket>(market_addr);
        // assert!(!market.resolved, E_ALREADY_RESOLVED);
        //
        // market.resolved = true;
        // market.winning_outcome = option::some(winning_outcome);
        // market.oracle_resolved = true;
        //
        // event::emit(MultiMarketResolved { ... });
    }

    // ==================== AIP-125 Scheduling ====================
    //
    // PSEUDO: AIP-125 Event-Driven Transactions
    //
    // When AIP-125 launches on mainnet, we can schedule resolution
    // at market creation time:
    //
    // fun schedule_chainlink_resolution(market_addr: address, end_time: u64) {
    //     // This tells Aptos to execute resolve_with_chainlink(market_addr)
    //     // at the specified end_time, automatically, with no human trigger.
    //     //
    //     // On Polymarket (Polygon), this requires:
    //     //   - Chainlink Automation (keeper network)
    //     //   - Monthly subscription fee
    //     //   - External dependency
    //     //
    //     // On Aptos with AIP-125:
    //     //   - Native, no external dependency
    //     //   - Gas paid at scheduling time
    //     //   - Deterministic execution at end_time
    //     //
    //     // This is why AIP-125 cuts Chainlink's work by 20-30%:
    //     // They don't need to port Automation to Aptos at all.
    // }

    // ==================== Comparison with Polymarket ====================
    //
    // POLYMARKET (POLYGON)              | OUR DESIGN (APTOS)
    // ──────────────────────            | ────────────────────
    // Objective: Chainlink              | Objective: Chainlink Data Feeds
    //   Data Streams + Automation       |   + AIP-125 (native scheduling)
    //                                   |
    // Subjective: UMA                   | Subjective: POLY Oracle
    //   $750 bond, 2hr challenge        |   $5K POLY bond, 15min challenge
    //   72hr+ resolution                |   4hr max resolution
    //   57% failure rate                |   Emergency resolve = 0% failure
    //   1 token = 1 vote (whales win)   |   Quadratic voting
    //   No conflict checks              |   On-chain position verification
    //   No privacy                      |   Confidential positions
    //                                   |
    // Trading: fully public             | Trading: confidential positions
    //   Everyone sees your bets         |   Amounts hidden via Twisted ElGamal
    //   MEV bots frontrun               |   Encrypted mempool (future)
    //   Insiders use burner wallets     |   Native privacy, no workarounds
    //                                   |
    // Compliance: none on-chain         | Compliance: auditor selective disclosure
    //   CFTC can't audit in real-time   |   Global auditor key decrypts all
    //   Relies on Polymarket's DB       |   Fully on-chain, provable
    //                                   |
    // Speed: Polygon L2                 | Speed: Aptos L1
    //   ~2 sec blocks                   |   Sub-second (Archon: <10ms)
    //   ~100 TPS effective              |   3,000+ TPS verified
    //   Sequential execution            |   Parallel (Block-STM v2)
}
