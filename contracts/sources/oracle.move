/// Oracle Module for Multi-Tier Resolution
///
/// Provides a unified oracle interface for prediction market resolution:
/// - Tier 1: Pyth (instant crypto prices, ~125ms)
/// - Tier 2: Switchboard (verifiable events, minutes)
/// - Tier 3: Optimistic (subjective markets, 15min-4hr)
/// - Tier 4: Admin (manual fallback)
///
/// This replaces UMA's 2+ hour delays with instant to 15-minute resolution.
///
module prediction_market::oracle {
    use std::vector;
    use aptos_framework::timestamp;
    use pyth::pyth;
    use pyth::price::{Self, Price};
    use pyth::price_identifier;
    use pyth::i64;

    // ==================== Error Codes ====================

    const E_STALE_PRICE: u64 = 1001;
    const E_LOW_CONFIDENCE: u64 = 1002;
    const E_INVALID_ORACLE_TYPE: u64 = 1003;
    const E_PRICE_NEGATIVE: u64 = 1004;
    const E_NO_PRICE_FEED: u64 = 1005;

    // ==================== Oracle Type Constants ====================

    /// Admin resolution (manual, fallback)
    const ORACLE_TYPE_ADMIN: u8 = 0;
    /// Pyth oracle (instant crypto prices)
    const ORACLE_TYPE_PYTH: u8 = 1;
    /// Switchboard oracle (verifiable events)
    const ORACLE_TYPE_SWITCHBOARD: u8 = 2;
    /// Optimistic oracle (15-min challenge period)
    const ORACLE_TYPE_OPTIMISTIC: u8 = 3;

    // ==================== Price Condition Constants ====================

    /// Price must be >= target
    const CONDITION_ABOVE: u8 = 0;
    /// Price must be < target
    const CONDITION_BELOW: u8 = 1;
    /// Price must equal target (rarely used)
    const CONDITION_EQUAL: u8 = 2;

    // ==================== Pyth Price Feed IDs (Mainnet) ====================

    /// BTC/USD price feed ID
    const BTC_USD_FEED: vector<u8> = x"e62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43";
    /// ETH/USD price feed ID
    const ETH_USD_FEED: vector<u8> = x"ff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace";
    /// APT/USD price feed ID
    const APT_USD_FEED: vector<u8> = x"44a93dddd8effa54ea51076c4e9c60246bcbc25ef68c4a94e6ab641f13ca1300";
    /// SOL/USD price feed ID
    const SOL_USD_FEED: vector<u8> = x"ef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d";

    // ==================== Structs ====================

    /// Oracle configuration for a market
    /// This determines how the market will be resolved
    struct OracleConfig has copy, drop, store {
        /// Oracle type (0=Admin, 1=Pyth, 2=Switchboard, 3=Optimistic)
        oracle_type: u8,
        /// Pyth price feed ID (for Pyth oracles)
        price_feed_id: vector<u8>,
        /// Target price in USD (8 decimals, e.g., 100000_00000000 = $100,000)
        target_price: u64,
        /// Price condition (0=above, 1=below, 2=equal)
        condition: u8,
        /// Maximum staleness in seconds (default 60s for Pyth)
        max_staleness_secs: u64,
        /// Maximum confidence interval (higher = more tolerance for uncertainty)
        confidence_threshold: u64,
    }

    /// Result of an oracle price check
    struct OracleResult has copy, drop, store {
        /// Whether the price is valid
        valid: bool,
        /// The actual price (8 decimals)
        price: u64,
        /// The confidence interval
        confidence: u64,
        /// Timestamp of the price
        timestamp: u64,
        /// Whether the condition was met (for resolution)
        condition_met: bool,
    }

    // ==================== Public Functions ====================

    /// Create a new oracle config for Admin resolution (default)
    public fun new_admin_config(): OracleConfig {
        OracleConfig {
            oracle_type: ORACLE_TYPE_ADMIN,
            price_feed_id: vector::empty(),
            target_price: 0,
            condition: CONDITION_ABOVE,
            max_staleness_secs: 0,
            confidence_threshold: 0,
        }
    }

    /// Create a new oracle config for Pyth crypto price market
    public fun new_pyth_config(
        price_feed_id: vector<u8>,
        target_price: u64,
        condition: u8,
    ): OracleConfig {
        OracleConfig {
            oracle_type: ORACLE_TYPE_PYTH,
            price_feed_id,
            target_price,
            condition,
            max_staleness_secs: 60, // 60 seconds max staleness
            confidence_threshold: 100000000, // $1.00 max confidence interval
        }
    }

    /// Create a new oracle config for Optimistic resolution
    public fun new_optimistic_config(): OracleConfig {
        OracleConfig {
            oracle_type: ORACLE_TYPE_OPTIMISTIC,
            price_feed_id: vector::empty(),
            target_price: 0,
            condition: CONDITION_ABOVE,
            max_staleness_secs: 900, // 15 minutes challenge period
            confidence_threshold: 0,
        }
    }

    /// Get the BTC/USD price feed ID
    public fun btc_usd_feed(): vector<u8> {
        BTC_USD_FEED
    }

    /// Get the ETH/USD price feed ID
    public fun eth_usd_feed(): vector<u8> {
        ETH_USD_FEED
    }

    /// Get the APT/USD price feed ID
    public fun apt_usd_feed(): vector<u8> {
        APT_USD_FEED
    }

    /// Get the SOL/USD price feed ID
    public fun sol_usd_feed(): vector<u8> {
        SOL_USD_FEED
    }

    /// Get oracle type from config
    public fun get_oracle_type(config: &OracleConfig): u8 {
        config.oracle_type
    }

    /// Get target price from config
    public fun get_target_price(config: &OracleConfig): u64 {
        config.target_price
    }

    /// Check if oracle type is Pyth
    public fun is_pyth(config: &OracleConfig): bool {
        config.oracle_type == ORACLE_TYPE_PYTH
    }

    /// Check if oracle type is Optimistic
    public fun is_optimistic(config: &OracleConfig): bool {
        config.oracle_type == ORACLE_TYPE_OPTIMISTIC
    }

    /// Check if oracle type is Admin
    public fun is_admin(config: &OracleConfig): bool {
        config.oracle_type == ORACLE_TYPE_ADMIN
    }

    /// Get Pyth price and validate it
    /// Returns (price, confidence, timestamp, valid)
    public fun get_pyth_price(config: &OracleConfig): OracleResult {
        assert!(config.oracle_type == ORACLE_TYPE_PYTH, E_INVALID_ORACLE_TYPE);

        // Get price from Pyth
        let price_id = price_identifier::from_byte_vec(config.price_feed_id);
        let pyth_price: Price = pyth::get_price_unsafe(price_id);

        // Extract price components
        let price_i64 = price::get_price(&pyth_price);
        let conf_u64 = price::get_conf(&pyth_price);
        let price_timestamp = price::get_timestamp(&pyth_price);

        // Check if price is negative (invalid for our use case)
        let price_is_negative = i64::get_is_negative(&price_i64);
        if (price_is_negative) {
            return OracleResult {
                valid: false,
                price: 0,
                confidence: conf_u64,
                timestamp: price_timestamp,
                condition_met: false,
            }
        };

        let price_u64 = i64::get_magnitude_if_positive(&price_i64);

        // Check staleness
        let current_time = timestamp::now_seconds();
        let is_stale = (current_time > price_timestamp) &&
                       (current_time - price_timestamp > config.max_staleness_secs);

        // Check confidence
        let low_confidence = conf_u64 > config.confidence_threshold;

        let valid = !is_stale && !low_confidence;

        // Check condition
        let condition_met = if (config.condition == CONDITION_ABOVE) {
            price_u64 >= config.target_price
        } else if (config.condition == CONDITION_BELOW) {
            price_u64 < config.target_price
        } else {
            price_u64 == config.target_price
        };

        OracleResult {
            valid,
            price: price_u64,
            confidence: conf_u64,
            timestamp: price_timestamp,
            condition_met: valid && condition_met,
        }
    }

    /// Check if price condition is met (convenience function for resolution)
    /// Returns (condition_met, actual_price)
    public fun check_price_condition(config: &OracleConfig): (bool, u64) {
        let result = get_pyth_price(config);
        (result.condition_met, result.price)
    }

    /// Validate that Pyth price is fresh enough for resolution
    public fun validate_pyth_price(config: &OracleConfig): bool {
        let result = get_pyth_price(config);
        result.valid
    }

    // ==================== View Functions ====================

    #[view]
    /// Get oracle type constant for Admin
    public fun oracle_type_admin(): u8 {
        ORACLE_TYPE_ADMIN
    }

    #[view]
    /// Get oracle type constant for Pyth
    public fun oracle_type_pyth(): u8 {
        ORACLE_TYPE_PYTH
    }

    #[view]
    /// Get oracle type constant for Switchboard
    public fun oracle_type_switchboard(): u8 {
        ORACLE_TYPE_SWITCHBOARD
    }

    #[view]
    /// Get oracle type constant for Optimistic
    public fun oracle_type_optimistic(): u8 {
        ORACLE_TYPE_OPTIMISTIC
    }

    #[view]
    /// Get condition constant for ABOVE
    public fun condition_above(): u8 {
        CONDITION_ABOVE
    }

    #[view]
    /// Get condition constant for BELOW
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
