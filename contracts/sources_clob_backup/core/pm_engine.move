/// ============================================================================
/// PM ENGINE - Main Coordinator for Prediction Market CLOB
/// ============================================================================
///
/// This is the main entry point module for the prediction market system.
/// It coordinates all the underlying modules and provides user-facing functions.
///
/// USER OPERATIONS:
/// - Create new prediction markets (conditions)
/// - Place limit/market orders
/// - Cancel orders
/// - Mint/burn complete sets
/// - Redeem winnings after resolution
///
/// ADMIN OPERATIONS:
/// - Initialize the system
/// - Resolve conditions
/// - Void conditions (emergency)
///
/// ============================================================================

module prediction_market_clob::pm_engine {
    use std::string::String;
    use std::signer;
    use std::vector;
    use std::option::{Self, Option};
    use aptos_framework::object::Object;
    use aptos_framework::fungible_asset::Metadata;
    use aptos_framework::timestamp;
    use aptos_framework::event;

    use prediction_market_clob::pm_engine_types::{Self, ConditionId, PMOrderMetadata, ResolutionSource};
    use prediction_market_clob::condition_registry;
    use prediction_market_clob::position_tokens;
    use prediction_market_clob::collateral_vault;
    use prediction_market_clob::pm_market;
    use prediction_market_clob::complete_sets;

    // ============================================================================
    // Error Codes
    // ============================================================================

    const E_NOT_INITIALIZED: u64 = 700;
    const E_ALREADY_INITIALIZED: u64 = 701;
    const E_INVALID_OUTCOME_COUNT: u64 = 702;
    const E_CONDITION_NOT_FOUND: u64 = 703;
    const E_MARKET_NOT_ACTIVE: u64 = 704;
    const E_INVALID_PRICE: u64 = 705;
    const E_INVALID_SIZE: u64 = 706;
    const E_INSUFFICIENT_BALANCE: u64 = 707;

    // ============================================================================
    // Constants
    // ============================================================================

    /// Price precision (6 decimals)
    const PRICE_PRECISION: u64 = 1_000_000;

    /// Minimum outcomes (binary)
    const MIN_OUTCOMES: u64 = 2;

    /// Maximum outcomes
    const MAX_OUTCOMES: u64 = 100;

    // ============================================================================
    // EVENTS
    // ============================================================================

    #[event]
    struct SystemInitialized has drop, store {
        deployer: address,
        condition_registry: address,
        token_registry: address,
        vault_registry: address,
        market_registry: address,
    }

    #[event]
    struct ConditionCreatedEvent has drop, store {
        condition_id: u64,
        condition_address: address,
        question: String,
        category: String,
        outcome_count: u64,
        outcome_labels: vector<String>,
        collateral: address,
        resolution_time: u64,
        creator: address,
    }

    #[event]
    struct OrderPlacedEvent has drop, store {
        condition_id: u64,
        outcome_index: u64,
        order_id: u128,
        user: address,
        price: u64,
        size: u64,
        is_bid: bool,
        filled_size: u64,
        is_resting: bool,
    }

    #[event]
    struct OrderCancelledEvent has drop, store {
        condition_id: u64,
        outcome_index: u64,
        order_id: u128,
        user: address,
        cancelled_size: u64,
    }

    // ============================================================================
    // GLOBAL STATE
    // ============================================================================

    /// System configuration and registry addresses
    struct PMEngineConfig has key {
        /// Condition registry address
        condition_registry: address,
        /// Token registry address
        token_registry: address,
        /// Vault registry address
        vault_registry: address,
        /// Market registry address
        market_registry: address,
        /// Admin address
        admin: address,
        /// Is system paused
        is_paused: bool,
    }

    // ============================================================================
    // INITIALIZATION
    // ============================================================================

    /// Initialize the entire prediction market system
    ///
    /// This sets up all the registries and creates the config.
    /// Must be called once by the deployer.
    public entry fun initialize(deployer: &signer) {
        let deployer_addr = signer::address_of(deployer);

        // Initialize all sub-modules
        condition_registry::initialize(deployer);
        position_tokens::initialize(deployer);
        collateral_vault::initialize(deployer);
        pm_market::initialize(deployer);

        // Calculate registry addresses (named objects)
        let condition_registry_addr = get_named_object_address(deployer_addr, b"CONDITION_REGISTRY");
        let token_registry_addr = get_named_object_address(deployer_addr, b"OUTCOME_TOKEN_REGISTRY");
        let vault_registry_addr = get_named_object_address(deployer_addr, b"COLLATERAL_VAULT_REGISTRY");
        let market_registry_addr = get_named_object_address(deployer_addr, b"OUTCOME_MARKET_REGISTRY");

        // Store config
        move_to(deployer, PMEngineConfig {
            condition_registry: condition_registry_addr,
            token_registry: token_registry_addr,
            vault_registry: vault_registry_addr,
            market_registry: market_registry_addr,
            admin: deployer_addr,
            is_paused: false,
        });

        event::emit(SystemInitialized {
            deployer: deployer_addr,
            condition_registry: condition_registry_addr,
            token_registry: token_registry_addr,
            vault_registry: vault_registry_addr,
            market_registry: market_registry_addr,
        });
    }

    // ============================================================================
    // MARKET CREATION
    // ============================================================================

    /// Create a new prediction market (condition)
    ///
    /// This creates:
    /// 1. A new condition in the registry
    /// 2. Outcome tokens for each outcome
    /// 3. A collateral vault
    /// 4. Order book markets for each outcome
    public entry fun create_condition(
        creator: &signer,
        question: String,
        description: String,
        category: String,
        outcome_labels: vector<String>,
        collateral_metadata: Object<Metadata>,
        resolution_time: u64,
        config_address: address,
    ) acquires PMEngineConfig {
        let config = borrow_global<PMEngineConfig>(config_address);
        let creator_addr = signer::address_of(creator);

        // Validate outcome count
        let outcome_count = vector::length(&outcome_labels);
        assert!(outcome_count >= MIN_OUTCOMES && outcome_count <= MAX_OUTCOMES, E_INVALID_OUTCOME_COUNT);

        // Create resolution source (creator resolves by default)
        let resolution_source = pm_engine_types::resolution_source_creator();

        // 1. Create condition
        let condition_id = condition_registry::create_condition(
            creator,
            question,
            description,
            category,
            outcome_labels,
            collateral_metadata,
            resolution_source,
            resolution_time,
            config.condition_registry,
        );

        let condition_id_value = pm_engine_types::condition_id_value(&condition_id);
        let condition_address = condition_registry::get_condition_address(
            config.condition_registry,
            condition_id_value,
        );

        // 2. Create outcome tokens
        let token_metadatas = position_tokens::create_outcome_tokens(
            condition_id,
            condition_address,
            &outcome_labels,
            config.token_registry,
        );

        // 3. Create collateral vault
        let vault_address = collateral_vault::create_vault(
            condition_id,
            collateral_metadata,
            config.vault_registry,
        );

        // 4. Create order book markets for each outcome
        let i = 0;
        while (i < outcome_count) {
            let label = *vector::borrow(&outcome_labels, i);
            let token_metadata = *vector::borrow(&token_metadatas, i);

            let market_address = pm_market::create_outcome_market(
                condition_id,
                (i as u64),
                label,
                token_metadata,
                collateral_metadata,
                config.market_registry,
            );

            // Register market address with condition
            condition_registry::register_outcome_market(
                condition_address,
                (i as u64),
                market_address,
            );

            i = i + 1;
        };

        event::emit(ConditionCreatedEvent {
            condition_id: condition_id_value,
            condition_address,
            question,
            category,
            outcome_count: (outcome_count as u64),
            outcome_labels,
            collateral: aptos_framework::object::object_address(&collateral_metadata),
            resolution_time,
            creator: creator_addr,
        });
    }

    // ============================================================================
    // TRADING
    // ============================================================================

    /// Place a limit order on an outcome market
    ///
    /// # Arguments
    /// * `user` - The trader
    /// * `condition_id` - Which prediction market
    /// * `outcome_index` - Which outcome (0=YES, 1=NO for binary)
    /// * `price` - Limit price (6 decimals, 0.01 to 0.99)
    /// * `size` - Order size in outcome tokens
    /// * `is_bid` - True for buy, false for sell
    /// * `is_reduce_only` - Only reduce existing position
    /// * `client_order_id` - Optional client-assigned ID
    public entry fun place_limit_order(
        user: &signer,
        condition_id: u64,
        outcome_index: u64,
        price: u64,
        size: u64,
        is_bid: bool,
        is_reduce_only: bool,
        client_order_id: Option<String>,
        config_address: address,
    ) acquires PMEngineConfig {
        let config = borrow_global<PMEngineConfig>(config_address);
        let user_addr = signer::address_of(user);

        // Get addresses
        let condition_address = condition_registry::get_condition_address(
            config.condition_registry,
            condition_id,
        );
        let market_address = condition_registry::get_outcome_market(
            condition_address,
            outcome_index,
        );

        // Create order metadata
        let cond_id = pm_engine_types::new_condition_id(condition_id);
        let metadata = pm_engine_types::new_order_metadata(
            cond_id,
            outcome_index,
            is_reduce_only,
            client_order_id,
        );

        let current_time = timestamp::now_seconds();

        // Place order
        let result = pm_market::place_limit_order(
            market_address,
            user_addr,
            price,
            size,
            is_bid,
            is_reduce_only,
            client_order_id,
            metadata,
            current_time,
        );

        // Extract result fields
        let (order_id, filled_size, _, is_resting, _) = unpack_order_result(result);

        event::emit(OrderPlacedEvent {
            condition_id,
            outcome_index,
            order_id,
            user: user_addr,
            price,
            size,
            is_bid,
            filled_size,
            is_resting,
        });
    }

    /// Cancel an existing order
    public entry fun cancel_order(
        user: &signer,
        condition_id: u64,
        outcome_index: u64,
        order_id: u128,
        config_address: address,
    ) acquires PMEngineConfig {
        let config = borrow_global<PMEngineConfig>(config_address);
        let user_addr = signer::address_of(user);

        // Get market address
        let condition_address = condition_registry::get_condition_address(
            config.condition_registry,
            condition_id,
        );
        let market_address = condition_registry::get_outcome_market(
            condition_address,
            outcome_index,
        );

        // Cancel order
        let cancelled_size = pm_market::cancel_order(market_address, user_addr, order_id);

        event::emit(OrderCancelledEvent {
            condition_id,
            outcome_index,
            order_id,
            user: user_addr,
            cancelled_size,
        });
    }

    // ============================================================================
    // COMPLETE SETS
    // ============================================================================

    /// Mint complete sets (deposit collateral, get all outcome tokens)
    public entry fun mint_complete_set(
        user: &signer,
        condition_id: u64,
        amount: u64,
        config_address: address,
    ) acquires PMEngineConfig {
        let config = borrow_global<PMEngineConfig>(config_address);

        let cond_id = pm_engine_types::new_condition_id(condition_id);
        let condition_address = condition_registry::get_condition_address(
            config.condition_registry,
            condition_id,
        );
        let vault_address = collateral_vault::get_vault_address(
            config.vault_registry,
            condition_id,
        );

        complete_sets::mint_complete_set(
            user,
            cond_id,
            amount,
            condition_address,
            vault_address,
            config.token_registry,
        );
    }

    /// Burn complete sets (return all outcome tokens, get collateral back)
    public entry fun burn_complete_set(
        user: &signer,
        condition_id: u64,
        amount: u64,
        config_address: address,
    ) acquires PMEngineConfig {
        let config = borrow_global<PMEngineConfig>(config_address);

        let cond_id = pm_engine_types::new_condition_id(condition_id);
        let condition_address = condition_registry::get_condition_address(
            config.condition_registry,
            condition_id,
        );
        let vault_address = collateral_vault::get_vault_address(
            config.vault_registry,
            condition_id,
        );

        complete_sets::burn_complete_set(
            user,
            cond_id,
            amount,
            condition_address,
            vault_address,
            config.token_registry,
        );
    }

    // ============================================================================
    // RESOLUTION & REDEMPTION
    // ============================================================================

    /// Resolve a condition to a specific outcome
    public entry fun resolve_condition(
        resolver: &signer,
        condition_id: u64,
        winning_outcome: u64,
        config_address: address,
    ) acquires PMEngineConfig {
        let config = borrow_global<PMEngineConfig>(config_address);

        let condition_address = condition_registry::get_condition_address(
            config.condition_registry,
            condition_id,
        );

        // Resolve the condition
        condition_registry::resolve_condition(
            resolver,
            condition_address,
            winning_outcome,
        );

        // Deactivate all outcome markets
        let outcome_count = condition_registry::get_outcome_count(condition_address);
        let i = 0;
        while (i < outcome_count) {
            let market_address = condition_registry::get_outcome_market(condition_address, i);
            pm_market::deactivate_market(market_address);
            i = i + 1;
        };
    }

    /// Void a condition (cancel market, allow full refunds)
    public entry fun void_condition(
        admin: &signer,
        condition_id: u64,
        config_address: address,
    ) acquires PMEngineConfig {
        let config = borrow_global<PMEngineConfig>(config_address);

        let condition_address = condition_registry::get_condition_address(
            config.condition_registry,
            condition_id,
        );

        // Void the condition
        condition_registry::void_condition(admin, condition_address);

        // Deactivate all outcome markets
        let outcome_count = condition_registry::get_outcome_count(condition_address);
        let i = 0;
        while (i < outcome_count) {
            let market_address = condition_registry::get_outcome_market(condition_address, i);
            pm_market::deactivate_market(market_address);
            i = i + 1;
        };
    }

    /// Redeem winning tokens for collateral after resolution
    public entry fun redeem_winnings(
        user: &signer,
        condition_id: u64,
        config_address: address,
    ) acquires PMEngineConfig {
        let config = borrow_global<PMEngineConfig>(config_address);

        let cond_id = pm_engine_types::new_condition_id(condition_id);
        let condition_address = condition_registry::get_condition_address(
            config.condition_registry,
            condition_id,
        );
        let vault_address = collateral_vault::get_vault_address(
            config.vault_registry,
            condition_id,
        );

        complete_sets::redeem_winnings(
            user,
            cond_id,
            condition_address,
            vault_address,
            config.token_registry,
        );
    }

    // ============================================================================
    // VIEW FUNCTIONS
    // ============================================================================

    #[view]
    /// Get system configuration
    public fun get_config(config_address: address): (address, address, address, address) acquires PMEngineConfig {
        let config = borrow_global<PMEngineConfig>(config_address);
        (
            config.condition_registry,
            config.token_registry,
            config.vault_registry,
            config.market_registry,
        )
    }

    #[view]
    /// Get condition info
    public fun get_condition_info(
        config_address: address,
        condition_id: u64,
    ): (String, String, String, u64, vector<String>, u64, bool, Option<u64>) acquires PMEngineConfig {
        let config = borrow_global<PMEngineConfig>(config_address);
        let condition_address = condition_registry::get_condition_address(
            config.condition_registry,
            condition_id,
        );
        condition_registry::get_condition_info(condition_address)
    }

    #[view]
    /// Get user's token balances for a condition
    public fun get_user_balances(
        config_address: address,
        user: address,
        condition_id: u64,
    ): vector<u64> acquires PMEngineConfig {
        let config = borrow_global<PMEngineConfig>(config_address);
        let condition_address = condition_registry::get_condition_address(
            config.condition_registry,
            condition_id,
        );
        let outcome_count = condition_registry::get_outcome_count(condition_address);

        position_tokens::get_all_balances(
            user,
            config.token_registry,
            condition_id,
            outcome_count,
        )
    }

    #[view]
    /// Get best bid/ask for an outcome market
    public fun get_best_prices(
        config_address: address,
        condition_id: u64,
        outcome_index: u64,
    ): (Option<u64>, Option<u64>) acquires PMEngineConfig {
        let config = borrow_global<PMEngineConfig>(config_address);
        let condition_address = condition_registry::get_condition_address(
            config.condition_registry,
            condition_id,
        );
        let market_address = condition_registry::get_outcome_market(
            condition_address,
            outcome_index,
        );

        let best_bid = pm_market::best_bid_price(market_address);
        let best_ask = pm_market::best_ask_price(market_address);
        (best_bid, best_ask)
    }

    #[view]
    /// Get redeemable amount for user
    public fun get_redeemable_amount(
        config_address: address,
        user: address,
        condition_id: u64,
    ): u64 acquires PMEngineConfig {
        let config = borrow_global<PMEngineConfig>(config_address);
        let condition_address = condition_registry::get_condition_address(
            config.condition_registry,
            condition_id,
        );

        complete_sets::redeemable_amount(
            user,
            condition_id,
            condition_address,
            config.token_registry,
        )
    }

    // ============================================================================
    // INTERNAL FUNCTIONS
    // ============================================================================

    /// Calculate named object address
    fun get_named_object_address(creator: address, seed: vector<u8>): address {
        let seed_with_type = vector::empty<u8>();
        vector::append(&mut seed_with_type, seed);
        aptos_framework::object::create_object_address(&creator, seed)
    }

    /// Unpack OrderResult struct
    fun unpack_order_result(
        result: pm_market::OrderResult,
    ): (u128, u64, u64, bool, pm_engine_types::OrderMatchingActions) {
        // Note: This would need to be implemented based on actual OrderResult structure
        // For now, returning placeholder values
        (0, 0, 0, false, pm_engine_types::settle_trade_actions(pm_engine_types::empty_order_actions()))
    }
}
