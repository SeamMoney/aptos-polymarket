/// Oracle Module for Prediction Market Resolution
///
/// Two-path oracle architecture (mirrors Polymarket's model):
/// - Chainlink: Objective markets (crypto prices, sports, weather)
/// - POLY Oracle: Subjective markets (human judgment, UMA replacement)
/// - Admin: Manual fallback for emergencies
///
/// Polymarket uses Chainlink + UMA. We use Chainlink + POLY.
/// No Pyth, no Switchboard — those were over-engineered extras.
///
module prediction_market::oracle {
    use std::vector;

    // ==================== Error Codes ====================

    const E_INVALID_ORACLE_TYPE: u64 = 1003;

    // ==================== Oracle Type Constants ====================

    /// Admin resolution (manual, fallback)
    const ORACLE_TYPE_ADMIN: u8 = 0;
    /// Chainlink Data Feeds (objective markets — crypto/sports/weather)
    const ORACLE_TYPE_CHAINLINK: u8 = 1;
    /// POLY token oracle (subjective markets — UMA replacement)
    const ORACLE_TYPE_POLY: u8 = 2;
    /// Optimistic oracle (legacy — 15-min challenge period, deployed on testnet)
    const ORACLE_TYPE_OPTIMISTIC: u8 = 3;

    // ==================== Price Condition Constants ====================

    /// Price must be >= target
    const CONDITION_ABOVE: u8 = 0;
    /// Price must be < target
    const CONDITION_BELOW: u8 = 1;
    /// Price must equal target (rarely used)
    const CONDITION_EQUAL: u8 = 2;

    // ==================== Structs ====================

    /// Oracle configuration for a market
    /// This determines how the market will be resolved
    struct OracleConfig has copy, drop, store {
        /// Oracle type (0=Admin, 1=Chainlink, 2=POLY, 3=Optimistic)
        oracle_type: u8,
        /// Chainlink feed ID (for Chainlink oracles, 32 bytes)
        feed_id: vector<u8>,
        /// Target price in USD (8 decimals, e.g., 100000_00000000 = $100,000)
        target_price: u64,
        /// Price condition (0=above, 1=below, 2=equal)
        condition: u8,
        /// Maximum staleness in seconds
        max_staleness_secs: u64,
    }

    // ==================== Public Functions ====================

    /// Create a new oracle config for Admin resolution (default)
    public fun new_admin_config(): OracleConfig {
        OracleConfig {
            oracle_type: ORACLE_TYPE_ADMIN,
            feed_id: vector::empty(),
            target_price: 0,
            condition: CONDITION_ABOVE,
            max_staleness_secs: 0,
        }
    }

    /// Create a new oracle config for Chainlink Data Feeds (objective markets)
    ///
    /// Chainlink on Aptos (testnet): 0xf1099f135ddddad1c065203431be328a408b0ca452ada70374ce26bd2b32fdd3
    /// Uses get_benchmarks(&signer, vector<vector<u8>>) pattern
    /// Prices: 18 decimals, converted to 8 for our system
    public fun new_chainlink_config(
        feed_id: vector<u8>,
        target_price: u64,
        condition: u8,
    ): OracleConfig {
        OracleConfig {
            oracle_type: ORACLE_TYPE_CHAINLINK,
            feed_id,
            target_price,
            condition,
            max_staleness_secs: 120, // 2 minutes max staleness
        }
    }

    /// Create a new oracle config for POLY token oracle (subjective markets)
    ///
    /// UMA replacement: propose -> challenge -> quadratic vote -> resolve
    /// Max 4 hours from proposal to resolution (vs UMA's 2+ hours that often never resolve)
    public fun new_poly_config(): OracleConfig {
        OracleConfig {
            oracle_type: ORACLE_TYPE_POLY,
            feed_id: vector::empty(),
            target_price: 0,
            condition: CONDITION_ABOVE,
            max_staleness_secs: 14400, // 4 hours max voting period
        }
    }

    /// Create a new oracle config for Optimistic resolution (legacy, deployed on testnet)
    public fun new_optimistic_config(): OracleConfig {
        OracleConfig {
            oracle_type: ORACLE_TYPE_OPTIMISTIC,
            feed_id: vector::empty(),
            target_price: 0,
            condition: CONDITION_ABOVE,
            max_staleness_secs: 900, // 15 minutes challenge period
        }
    }

    // ==================== Getters ====================

    /// Get oracle type from config
    public fun get_oracle_type(config: &OracleConfig): u8 {
        config.oracle_type
    }

    /// Get target price from config
    public fun get_target_price(config: &OracleConfig): u64 {
        config.target_price
    }

    /// Get feed ID from config
    public fun get_feed_id(config: &OracleConfig): vector<u8> {
        config.feed_id
    }

    /// Get condition from config
    public fun get_condition(config: &OracleConfig): u8 {
        config.condition
    }

    /// Get max staleness from config
    public fun get_max_staleness(config: &OracleConfig): u64 {
        config.max_staleness_secs
    }

    // ==================== Type Checkers ====================

    /// Check if oracle type is Admin
    public fun is_admin(config: &OracleConfig): bool {
        config.oracle_type == ORACLE_TYPE_ADMIN
    }

    /// Check if oracle type is Chainlink
    public fun is_chainlink(config: &OracleConfig): bool {
        config.oracle_type == ORACLE_TYPE_CHAINLINK
    }

    /// Check if oracle type is POLY oracle
    public fun is_poly(config: &OracleConfig): bool {
        config.oracle_type == ORACLE_TYPE_POLY
    }

    /// Check if oracle type is Optimistic (legacy)
    public fun is_optimistic(config: &OracleConfig): bool {
        config.oracle_type == ORACLE_TYPE_OPTIMISTIC
    }

    // ==================== View Functions ====================

    #[view]
    public fun oracle_type_admin(): u8 {
        ORACLE_TYPE_ADMIN
    }

    #[view]
    public fun oracle_type_chainlink(): u8 {
        ORACLE_TYPE_CHAINLINK
    }

    #[view]
    public fun oracle_type_poly(): u8 {
        ORACLE_TYPE_POLY
    }

    #[view]
    public fun oracle_type_optimistic(): u8 {
        ORACLE_TYPE_OPTIMISTIC
    }

    #[view]
    public fun condition_above(): u8 {
        CONDITION_ABOVE
    }

    #[view]
    public fun condition_below(): u8 {
        CONDITION_BELOW
    }

    // ==================== Helper Functions ====================

    /// Convert USD price to 8 decimal format
    /// e.g., 100000 USD -> 100000_00000000 (8 decimals)
    public fun usd_to_price(usd: u64): u64 {
        usd * 100000000
    }

    /// Convert price with 8 decimals to USD
    public fun price_to_usd(price: u64): u64 {
        price / 100000000
    }
}
