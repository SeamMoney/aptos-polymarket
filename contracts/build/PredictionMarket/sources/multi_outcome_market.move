/// Multi-Outcome Prediction Market with Complete Sets Model
///
/// A Polymarket-style prediction market supporting up to 20 outcomes per market.
/// Uses the Complete Sets model where:
/// - 1 APT buys a complete set (1 of each outcome token)
/// - Individual outcome tokens trade via CPMM
/// - Arbitrage keeps prices summing to ~100%
/// - Winning tokens redeem for 1 APT each
module prediction_market::multi_outcome_market {
    use std::string::{Self, String};
    use std::signer;
    use std::option::{Self, Option};
    use std::vector;
    use aptos_framework::object::{Self, Object, ExtendRef};
    use aptos_framework::fungible_asset::{Self, Metadata, FungibleStore, MintRef, TransferRef, BurnRef};
    use aptos_framework::primary_fungible_store;
    use aptos_framework::timestamp;
    use aptos_framework::event;

    // ==================== Error Codes ====================

    const E_NOT_AUTHORIZED: u64 = 1;
    const E_MARKET_NOT_FOUND: u64 = 2;
    const E_MARKET_ALREADY_RESOLVED: u64 = 3;
    const E_MARKET_NOT_RESOLVED: u64 = 4;
    const E_MARKET_STILL_ACTIVE: u64 = 5;
    const E_INSUFFICIENT_LIQUIDITY: u64 = 6;
    const E_SLIPPAGE_EXCEEDED: u64 = 7;
    const E_ZERO_AMOUNT: u64 = 8;
    const E_INVALID_OUTCOME: u64 = 9;
    const E_NO_TOKENS_TO_REDEEM: u64 = 10;
    const E_INVALID_OUTCOME_COUNT: u64 = 11;
    const E_INSUFFICIENT_BALANCE: u64 = 12;

    // ==================== Constants ====================

    /// APT (Aptos Coin) fungible asset metadata address
    const COLLATERAL_METADATA_ADDR: address = @0xa;

    /// Minimum liquidity to prevent division by zero (8 decimals for APT)
    const MINIMUM_LIQUIDITY: u64 = 10000000; // 0.1 APT minimum

    /// Maximum number of outcomes per market
    const MAX_OUTCOMES: u64 = 20;

    /// Minimum number of outcomes per market
    const MIN_OUTCOMES: u64 = 2;

    /// Fee in basis points (0.3% = 30 basis points)
    const FEE_BPS: u64 = 30;
    const BPS_DENOMINATOR: u64 = 10000;

    /// Price scale (100 = 100%)
    const PRICE_SCALE: u64 = 100;

    // ==================== Structs ====================

    /// Outcome token metadata and capabilities
    struct OutcomeToken has store {
        /// Outcome index (0, 1, 2, ...)
        index: u64,
        /// Outcome label (e.g., "Trump", "Biden")
        label: String,
        /// Token metadata object
        metadata: Object<Metadata>,
        /// Minting capability
        mint_ref: MintRef,
        /// Burning capability
        burn_ref: BurnRef,
        /// Transfer capability (for frozen transfers)
        transfer_ref: TransferRef,
        /// Current CPMM reserve for this outcome
        reserve: u64,
    }

    /// Multi-outcome prediction market
    struct MultiMarket has key {
        /// Market question
        question: String,
        /// Detailed description
        description: String,
        /// Category (e.g., "Politics", "Sports", "Crypto")
        category: String,
        /// Unix timestamp when trading ends
        end_time: u64,
        /// Market creator/admin
        creator: address,

        /// All outcome tokens
        outcomes: vector<OutcomeToken>,
        /// Number of outcomes
        outcome_count: u64,

        /// Collateral store (holds APT)
        collateral_store: Object<FungibleStore>,
        /// Total collateral from complete sets
        total_collateral: u64,

        /// Base reserve for CPMM pricing (shared reference)
        base_reserve: u64,

        /// Resolution state
        resolved: bool,
        /// Winning outcome index (0-indexed)
        winning_outcome: Option<u64>,

        /// Object extension ref for signer generation
        extend_ref: ExtendRef,

        /// Fee in basis points
        fee_bps: u64,
        /// Accumulated fees
        accumulated_fees: u64,
    }

    /// Global registry for all multi-outcome markets
    struct MultiMarketRegistry has key {
        markets: vector<address>,
        market_count: u64,
    }

    // ==================== Events ====================

    #[event]
    struct MultiMarketCreated has drop, store {
        market_address: address,
        question: String,
        category: String,
        outcome_count: u64,
        creator: address,
        end_time: u64,
        initial_liquidity: u64,
    }

    #[event]
    struct CompleteSetMinted has drop, store {
        market_address: address,
        user: address,
        set_count: u64,
        collateral_deposited: u64,
    }

    #[event]
    struct CompleteSetRedeemed has drop, store {
        market_address: address,
        user: address,
        set_count: u64,
        collateral_returned: u64,
    }

    #[event]
    struct OutcomeTokenBought has drop, store {
        market_address: address,
        buyer: address,
        outcome_index: u64,
        collateral_in: u64,
        tokens_out: u64,
        new_price: u64,
    }

    #[event]
    struct OutcomeTokenSold has drop, store {
        market_address: address,
        seller: address,
        outcome_index: u64,
        tokens_in: u64,
        collateral_out: u64,
        new_price: u64,
    }

    #[event]
    struct MultiMarketResolved has drop, store {
        market_address: address,
        winning_outcome: u64,
        resolver: address,
    }

    #[event]
    struct WinningsRedeemed has drop, store {
        market_address: address,
        user: address,
        winning_tokens: u64,
        payout: u64,
    }

    // ==================== Initialization ====================

    /// Initialize the multi-market registry (called once on deployment)
    fun init_module(deployer: &signer) {
        move_to(deployer, MultiMarketRegistry {
            markets: vector::empty(),
            market_count: 0,
        });
    }

    // ==================== Entry Functions ====================

    /// Create a new multi-outcome prediction market
    public entry fun create_multi_market(
        creator: &signer,
        question: String,
        description: String,
        category: String,
        outcome_labels: vector<String>,
        end_time: u64,
        initial_liquidity: u64,
    ) acquires MultiMarketRegistry {
        let outcome_count = vector::length(&outcome_labels);
        assert!(outcome_count >= MIN_OUTCOMES && outcome_count <= MAX_OUTCOMES, E_INVALID_OUTCOME_COUNT);
        assert!(initial_liquidity >= MINIMUM_LIQUIDITY * (outcome_count as u64), E_INSUFFICIENT_LIQUIDITY);

        let creator_addr = signer::address_of(creator);

        // Create market object
        let constructor_ref = object::create_object(creator_addr);
        let market_signer = object::generate_signer(&constructor_ref);
        let market_addr = signer::address_of(&market_signer);
        let extend_ref = object::generate_extend_ref(&constructor_ref);

        // Create outcome tokens
        let outcomes = vector::empty<OutcomeToken>();
        let i = 0;
        while (i < outcome_count) {
            let label = *vector::borrow(&outcome_labels, i);
            let outcome_token = create_outcome_token(&market_signer, (i as u64), label);
            vector::push_back(&mut outcomes, outcome_token);
            i = i + 1;
        };

        // Create collateral store
        let apt_metadata = object::address_to_object<Metadata>(COLLATERAL_METADATA_ADDR);
        let collateral_constructor = object::create_named_object(&market_signer, b"COLLATERAL");
        let collateral_store = fungible_asset::create_store(&collateral_constructor, apt_metadata);

        // Transfer initial liquidity from creator
        let liquidity = primary_fungible_store::withdraw(creator, apt_metadata, initial_liquidity);
        fungible_asset::deposit(collateral_store, liquidity);

        // Initialize with equal reserves per outcome
        let reserve_per_outcome = initial_liquidity / (outcome_count as u64);
        let base_reserve = reserve_per_outcome;

        // Set reserves for each outcome
        let j = 0;
        while (j < outcome_count) {
            let outcome = vector::borrow_mut(&mut outcomes, j);
            outcome.reserve = reserve_per_outcome;
            j = j + 1;
        };

        // Create the market
        move_to(&market_signer, MultiMarket {
            question,
            description,
            category,
            end_time,
            creator: creator_addr,
            outcomes,
            outcome_count: (outcome_count as u64),
            collateral_store,
            total_collateral: initial_liquidity,
            base_reserve,
            resolved: false,
            winning_outcome: option::none(),
            extend_ref,
            fee_bps: FEE_BPS,
            accumulated_fees: 0,
        });

        // Register in global registry
        let registry = borrow_global_mut<MultiMarketRegistry>(@prediction_market);
        vector::push_back(&mut registry.markets, market_addr);
        registry.market_count = registry.market_count + 1;

        event::emit(MultiMarketCreated {
            market_address: market_addr,
            question: string::utf8(b""),
            category,
            outcome_count: (outcome_count as u64),
            creator: creator_addr,
            end_time,
            initial_liquidity,
        });
    }

    /// Mint a complete set: deposit collateral, receive 1 of each outcome token
    public entry fun mint_complete_set(
        user: &signer,
        market_addr: address,
        collateral_amount: u64,
    ) acquires MultiMarket {
        assert!(collateral_amount > 0, E_ZERO_AMOUNT);

        let market = borrow_global_mut<MultiMarket>(market_addr);
        assert!(!market.resolved, E_MARKET_ALREADY_RESOLVED);

        let user_addr = signer::address_of(user);

        // Take collateral from user
        let apt_metadata = object::address_to_object<Metadata>(COLLATERAL_METADATA_ADDR);
        let collateral = primary_fungible_store::withdraw(user, apt_metadata, collateral_amount);
        fungible_asset::deposit(market.collateral_store, collateral);
        market.total_collateral = market.total_collateral + collateral_amount;

        // Calculate tokens per outcome (1:1 with collateral for complete sets)
        let tokens_per_outcome = collateral_amount;

        // Mint one token of each outcome to user
        let i = 0;
        let outcome_count = market.outcome_count;
        while (i < outcome_count) {
            let outcome = vector::borrow(&market.outcomes, i);
            let tokens = fungible_asset::mint(&outcome.mint_ref, tokens_per_outcome);
            primary_fungible_store::deposit(user_addr, tokens);
            i = i + 1;
        };

        event::emit(CompleteSetMinted {
            market_address: market_addr,
            user: user_addr,
            set_count: collateral_amount,
            collateral_deposited: collateral_amount,
        });
    }

    /// Redeem a complete set: return 1 of each outcome token, receive collateral
    public entry fun redeem_complete_set(
        user: &signer,
        market_addr: address,
        set_amount: u64,
    ) acquires MultiMarket {
        assert!(set_amount > 0, E_ZERO_AMOUNT);

        let market = borrow_global_mut<MultiMarket>(market_addr);
        let user_addr = signer::address_of(user);

        // Verify user has enough of each outcome token
        let i = 0;
        let outcome_count = market.outcome_count;
        while (i < outcome_count) {
            let outcome = vector::borrow(&market.outcomes, i);
            let balance = primary_fungible_store::balance(user_addr, outcome.metadata);
            assert!(balance >= set_amount, E_INSUFFICIENT_BALANCE);
            i = i + 1;
        };

        // Burn tokens from user
        let j = 0;
        while (j < outcome_count) {
            let outcome = vector::borrow(&market.outcomes, j);
            let tokens = primary_fungible_store::withdraw(user, outcome.metadata, set_amount);
            fungible_asset::burn(&outcome.burn_ref, tokens);
            j = j + 1;
        };

        // Return collateral
        market.total_collateral = market.total_collateral - set_amount;
        let market_signer = object::generate_signer_for_extending(&market.extend_ref);
        let payout = fungible_asset::withdraw(&market_signer, market.collateral_store, set_amount);
        primary_fungible_store::deposit(user_addr, payout);

        event::emit(CompleteSetRedeemed {
            market_address: market_addr,
            user: user_addr,
            set_count: set_amount,
            collateral_returned: set_amount,
        });
    }

    /// Buy tokens of a specific outcome using CPMM pricing
    public entry fun buy_outcome(
        buyer: &signer,
        market_addr: address,
        outcome_index: u64,
        collateral_in: u64,
        min_tokens_out: u64,
    ) acquires MultiMarket {
        assert!(collateral_in > 0, E_ZERO_AMOUNT);

        let market = borrow_global_mut<MultiMarket>(market_addr);
        assert!(!market.resolved, E_MARKET_ALREADY_RESOLVED);
        assert!(outcome_index < market.outcome_count, E_INVALID_OUTCOME);

        let buyer_addr = signer::address_of(buyer);

        // Calculate fee
        let fee = (collateral_in * market.fee_bps) / BPS_DENOMINATOR;
        let amount_after_fee = collateral_in - fee;
        market.accumulated_fees = market.accumulated_fees + fee;

        // Get outcome and calculate output using CPMM
        let outcome = vector::borrow_mut(&mut market.outcomes, outcome_index);
        let tokens_out = calculate_buy_output(market.base_reserve, outcome.reserve, amount_after_fee);
        assert!(tokens_out >= min_tokens_out, E_SLIPPAGE_EXCEEDED);

        // Update reserves
        market.base_reserve = market.base_reserve + amount_after_fee;
        outcome.reserve = outcome.reserve - tokens_out;

        // Take collateral
        let apt_metadata = object::address_to_object<Metadata>(COLLATERAL_METADATA_ADDR);
        let payment = primary_fungible_store::withdraw(buyer, apt_metadata, collateral_in);
        fungible_asset::deposit(market.collateral_store, payment);
        market.total_collateral = market.total_collateral + collateral_in;

        // Mint tokens to buyer
        let tokens = fungible_asset::mint(&outcome.mint_ref, tokens_out);
        primary_fungible_store::deposit(buyer_addr, tokens);

        let new_price = calculate_price(market.base_reserve, outcome.reserve);

        event::emit(OutcomeTokenBought {
            market_address: market_addr,
            buyer: buyer_addr,
            outcome_index,
            collateral_in,
            tokens_out,
            new_price,
        });
    }

    /// Sell tokens of a specific outcome
    public entry fun sell_outcome(
        seller: &signer,
        market_addr: address,
        outcome_index: u64,
        tokens_in: u64,
        min_collateral_out: u64,
    ) acquires MultiMarket {
        assert!(tokens_in > 0, E_ZERO_AMOUNT);

        let market = borrow_global_mut<MultiMarket>(market_addr);
        assert!(!market.resolved, E_MARKET_ALREADY_RESOLVED);
        assert!(outcome_index < market.outcome_count, E_INVALID_OUTCOME);

        let seller_addr = signer::address_of(seller);
        let outcome = vector::borrow_mut(&mut market.outcomes, outcome_index);

        // Calculate collateral out using CPMM
        let collateral_out_before_fee = calculate_sell_output(outcome.reserve, market.base_reserve, tokens_in);
        let fee = (collateral_out_before_fee * market.fee_bps) / BPS_DENOMINATOR;
        let collateral_out = collateral_out_before_fee - fee;
        assert!(collateral_out >= min_collateral_out, E_SLIPPAGE_EXCEEDED);

        market.accumulated_fees = market.accumulated_fees + fee;

        // Update reserves
        outcome.reserve = outcome.reserve + tokens_in;
        market.base_reserve = market.base_reserve - collateral_out_before_fee;

        // Burn tokens from seller
        let tokens = primary_fungible_store::withdraw(seller, outcome.metadata, tokens_in);
        fungible_asset::burn(&outcome.burn_ref, tokens);

        // Return collateral
        market.total_collateral = market.total_collateral - collateral_out;
        let market_signer = object::generate_signer_for_extending(&market.extend_ref);
        let payout = fungible_asset::withdraw(&market_signer, market.collateral_store, collateral_out);
        primary_fungible_store::deposit(seller_addr, payout);

        let new_price = calculate_price(market.base_reserve, outcome.reserve);

        event::emit(OutcomeTokenSold {
            market_address: market_addr,
            seller: seller_addr,
            outcome_index,
            tokens_in,
            collateral_out,
            new_price,
        });
    }

    /// Resolve the market with a winning outcome (creator only)
    public entry fun resolve(
        resolver: &signer,
        market_addr: address,
        winning_outcome: u64,
    ) acquires MultiMarket {
        let market = borrow_global_mut<MultiMarket>(market_addr);
        let resolver_addr = signer::address_of(resolver);

        assert!(resolver_addr == market.creator, E_NOT_AUTHORIZED);
        assert!(!market.resolved, E_MARKET_ALREADY_RESOLVED);
        assert!(timestamp::now_seconds() >= market.end_time, E_MARKET_STILL_ACTIVE);
        assert!(winning_outcome < market.outcome_count, E_INVALID_OUTCOME);

        market.resolved = true;
        market.winning_outcome = option::some(winning_outcome);

        event::emit(MultiMarketResolved {
            market_address: market_addr,
            winning_outcome,
            resolver: resolver_addr,
        });
    }

    /// Redeem winning outcome tokens for collateral (1:1)
    public entry fun redeem_winnings(
        user: &signer,
        market_addr: address,
    ) acquires MultiMarket {
        let market = borrow_global_mut<MultiMarket>(market_addr);
        assert!(market.resolved, E_MARKET_NOT_RESOLVED);

        let user_addr = signer::address_of(user);
        let winning_index = *option::borrow(&market.winning_outcome);
        let winning_outcome = vector::borrow(&market.outcomes, winning_index);

        // Get user's winning token balance
        let winning_balance = primary_fungible_store::balance(user_addr, winning_outcome.metadata);
        assert!(winning_balance > 0, E_NO_TOKENS_TO_REDEEM);

        // Burn winning tokens
        let tokens = primary_fungible_store::withdraw(user, winning_outcome.metadata, winning_balance);
        fungible_asset::burn(&winning_outcome.burn_ref, tokens);

        // Payout = 1 APT per winning token
        let payout = winning_balance;
        let market_signer = object::generate_signer_for_extending(&market.extend_ref);
        let payout_asset = fungible_asset::withdraw(&market_signer, market.collateral_store, payout);
        primary_fungible_store::deposit(user_addr, payout_asset);

        event::emit(WinningsRedeemed {
            market_address: market_addr,
            user: user_addr,
            winning_tokens: winning_balance,
            payout,
        });
    }

    // ==================== Internal Functions ====================

    /// Create an outcome token
    fun create_outcome_token(
        market_signer: &signer,
        index: u64,
        label: String,
    ): OutcomeToken {
        // Create unique seed for each outcome token
        let seed = b"OUTCOME_";
        vector::append(&mut seed, *string::bytes(&label));

        let constructor = object::create_named_object(market_signer, seed);
        primary_fungible_store::create_primary_store_enabled_fungible_asset(
            &constructor,
            option::none(), // unlimited supply
            label,
            label,
            8, // decimals match APT
            string::utf8(b""),
            string::utf8(b""),
        );

        let metadata = object::object_from_constructor_ref<Metadata>(&constructor);
        let mint_ref = fungible_asset::generate_mint_ref(&constructor);
        let burn_ref = fungible_asset::generate_burn_ref(&constructor);
        let transfer_ref = fungible_asset::generate_transfer_ref(&constructor);

        OutcomeToken {
            index,
            label,
            metadata,
            mint_ref,
            burn_ref,
            transfer_ref,
            reserve: 0,
        }
    }

    /// CPMM buy formula: tokens_out = reserve_out * amount_in / (reserve_in + amount_in)
    fun calculate_buy_output(base_reserve: u64, outcome_reserve: u64, amount_in: u64): u64 {
        let numerator = (outcome_reserve as u128) * (amount_in as u128);
        let denominator = (base_reserve as u128) + (amount_in as u128);
        ((numerator / denominator) as u64)
    }

    /// CPMM sell formula: collateral_out = base_reserve * tokens_in / (outcome_reserve + tokens_in)
    fun calculate_sell_output(outcome_reserve: u64, base_reserve: u64, tokens_in: u64): u64 {
        let numerator = (base_reserve as u128) * (tokens_in as u128);
        let denominator = (outcome_reserve as u128) + (tokens_in as u128);
        ((numerator / denominator) as u64)
    }

    /// Calculate price as percentage (0-100)
    /// Price = base_reserve / (base_reserve + outcome_reserve) * 100
    fun calculate_price(base_reserve: u64, outcome_reserve: u64): u64 {
        let total = (base_reserve as u128) + (outcome_reserve as u128);
        if (total == 0) {
            return 50
        };
        (((base_reserve as u128) * (PRICE_SCALE as u128)) / total as u64)
    }

    // ==================== View Functions ====================

    #[view]
    /// Get all outcome prices (returns vector of prices 0-100)
    public fun get_all_prices(market_addr: address): vector<u64> acquires MultiMarket {
        let market = borrow_global<MultiMarket>(market_addr);
        let prices = vector::empty<u64>();
        let i = 0;
        while (i < market.outcome_count) {
            let outcome = vector::borrow(&market.outcomes, i);
            let price = calculate_price(market.base_reserve, outcome.reserve);
            vector::push_back(&mut prices, price);
            i = i + 1;
        };
        prices
    }

    #[view]
    /// Get single outcome price
    public fun get_outcome_price(market_addr: address, outcome_index: u64): u64 acquires MultiMarket {
        let market = borrow_global<MultiMarket>(market_addr);
        assert!(outcome_index < market.outcome_count, E_INVALID_OUTCOME);
        let outcome = vector::borrow(&market.outcomes, outcome_index);
        calculate_price(market.base_reserve, outcome.reserve)
    }

    #[view]
    /// Get market info
    public fun get_multi_market_info(market_addr: address): (
        String,      // question
        String,      // description
        String,      // category
        u64,         // outcome_count
        u64,         // end_time
        bool,        // resolved
        Option<u64>, // winning_outcome
        u64,         // total_collateral
    ) acquires MultiMarket {
        let market = borrow_global<MultiMarket>(market_addr);
        (
            market.question,
            market.description,
            market.category,
            market.outcome_count,
            market.end_time,
            market.resolved,
            market.winning_outcome,
            market.total_collateral,
        )
    }

    #[view]
    /// Get all outcome labels
    public fun get_outcome_labels(market_addr: address): vector<String> acquires MultiMarket {
        let market = borrow_global<MultiMarket>(market_addr);
        let labels = vector::empty<String>();
        let i = 0;
        while (i < market.outcome_count) {
            vector::push_back(&mut labels, vector::borrow(&market.outcomes, i).label);
            i = i + 1;
        };
        labels
    }

    #[view]
    /// Get user positions for all outcomes
    public fun get_user_multi_positions(
        market_addr: address,
        user: address,
    ): vector<u64> acquires MultiMarket {
        let market = borrow_global<MultiMarket>(market_addr);
        let balances = vector::empty<u64>();
        let i = 0;
        while (i < market.outcome_count) {
            let outcome = vector::borrow(&market.outcomes, i);
            let balance = primary_fungible_store::balance(user, outcome.metadata);
            vector::push_back(&mut balances, balance);
            i = i + 1;
        };
        balances
    }

    #[view]
    /// Quote buy for a specific outcome
    public fun quote_buy_outcome(
        market_addr: address,
        outcome_index: u64,
        collateral_in: u64,
    ): u64 acquires MultiMarket {
        let market = borrow_global<MultiMarket>(market_addr);
        assert!(outcome_index < market.outcome_count, E_INVALID_OUTCOME);
        let fee = (collateral_in * market.fee_bps) / BPS_DENOMINATOR;
        let amount_after_fee = collateral_in - fee;
        let outcome = vector::borrow(&market.outcomes, outcome_index);
        calculate_buy_output(market.base_reserve, outcome.reserve, amount_after_fee)
    }

    #[view]
    /// Quote sell for a specific outcome
    public fun quote_sell_outcome(
        market_addr: address,
        outcome_index: u64,
        tokens_in: u64,
    ): u64 acquires MultiMarket {
        let market = borrow_global<MultiMarket>(market_addr);
        assert!(outcome_index < market.outcome_count, E_INVALID_OUTCOME);
        let outcome = vector::borrow(&market.outcomes, outcome_index);
        let collateral_out_before_fee = calculate_sell_output(outcome.reserve, market.base_reserve, tokens_in);
        let fee = (collateral_out_before_fee * market.fee_bps) / BPS_DENOMINATOR;
        collateral_out_before_fee - fee
    }

    #[view]
    /// Get all multi-outcome market addresses
    public fun get_all_multi_markets(): vector<address> acquires MultiMarketRegistry {
        let registry = borrow_global<MultiMarketRegistry>(@prediction_market);
        registry.markets
    }

    // ==================== Test Helpers ====================

    #[test_only]
    public fun init_for_test(deployer: &signer) {
        init_module(deployer);
    }
}
