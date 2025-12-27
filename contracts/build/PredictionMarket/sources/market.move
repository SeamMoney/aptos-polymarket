/// Prediction Market with CPMM (Constant Product Market Maker)
///
/// A Polymarket-style prediction market on Aptos using APT as collateral.
/// Users can buy/sell YES and NO tokens representing outcomes of binary events.
/// Prices are determined by a constant product formula: x * y = k
module prediction_market::market {
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

    // ==================== Constants ====================

    /// APT (Aptos Coin) fungible asset metadata address
    /// Using APT for demo - no dispatchable hooks, users already have it
    const COLLATERAL_METADATA_ADDR: address = @0xa;

    /// Minimum liquidity to prevent division by zero attacks (8 decimals for APT)
    const MINIMUM_LIQUIDITY: u64 = 10000000; // 0.1 APT minimum

    /// Fee in basis points (0.3% = 30 basis points)
    const FEE_BPS: u64 = 30;
    const BPS_DENOMINATOR: u64 = 10000;

    // ==================== Structs ====================

    /// Global registry of all markets
    struct MarketRegistry has key {
        markets: vector<address>,
        market_count: u64,
    }

    /// A prediction market for a binary yes/no question
    struct Market has key {
        /// The prediction question (e.g., "Will BTC reach $100k by Dec 2025?")
        question: String,
        /// Description/context for the market
        description: String,
        /// Unix timestamp when trading ends
        end_time: u64,
        /// Whether the market has been resolved
        resolved: bool,
        /// The winning outcome (true = YES wins, false = NO wins)
        outcome: Option<bool>,

        // CPMM reserves
        yes_reserve: u64,
        no_reserve: u64,

        // Token metadata objects
        yes_token_metadata: Object<Metadata>,
        no_token_metadata: Object<Metadata>,

        // Token capabilities for minting/burning
        yes_mint_ref: MintRef,
        yes_burn_ref: BurnRef,
        yes_transfer_ref: TransferRef,
        no_mint_ref: MintRef,
        no_burn_ref: BurnRef,
        no_transfer_ref: TransferRef,

        // Collateral store (holds USD1)
        collateral_store: Object<FungibleStore>,

        // Object refs for management
        extend_ref: ExtendRef,

        // Market creator/admin
        creator: address,

        // Accumulated fees
        accumulated_fees: u64,

        // Total trading volume (cumulative APT traded)
        total_volume: u64,
    }

    // ==================== Events ====================

    #[event]
    struct MarketCreated has drop, store {
        market_address: address,
        question: String,
        creator: address,
        end_time: u64,
        initial_liquidity: u64,
    }

    #[event]
    struct TokensPurchased has drop, store {
        market_address: address,
        buyer: address,
        is_yes: bool,
        amount_in: u64,
        amount_out: u64,
        new_yes_price: u64,
    }

    #[event]
    struct TokensSold has drop, store {
        market_address: address,
        seller: address,
        is_yes: bool,
        amount_in: u64,
        amount_out: u64,
        new_yes_price: u64,
    }

    #[event]
    struct MarketResolved has drop, store {
        market_address: address,
        outcome: bool,
        resolver: address,
    }

    #[event]
    struct TokensRedeemed has drop, store {
        market_address: address,
        user: address,
        yes_amount: u64,
        no_amount: u64,
        payout: u64,
    }

    // ==================== Initialization ====================

    /// Initialize the market registry (called once on deployment)
    fun init_module(deployer: &signer) {
        move_to(deployer, MarketRegistry {
            markets: vector::empty(),
            market_count: 0,
        });
    }

    // ==================== Entry Functions ====================

    /// Create a new prediction market
    public entry fun create_market(
        creator: &signer,
        question: String,
        description: String,
        end_time: u64,
        initial_liquidity: u64,
    ) acquires MarketRegistry {
        assert!(initial_liquidity >= MINIMUM_LIQUIDITY * 2, E_INSUFFICIENT_LIQUIDITY);

        let creator_addr = signer::address_of(creator);

        // Create a new object to hold the market
        let constructor_ref = object::create_object(creator_addr);
        let market_signer = object::generate_signer(&constructor_ref);
        let market_addr = signer::address_of(&market_signer);
        let extend_ref = object::generate_extend_ref(&constructor_ref);

        // Create YES token
        let yes_constructor = object::create_named_object(&market_signer, b"YES_TOKEN");
        let _yes_token_signer = object::generate_signer(&yes_constructor);
        primary_fungible_store::create_primary_store_enabled_fungible_asset(
            &yes_constructor,
            option::none(), // unlimited supply
            string::utf8(b"YES"),
            string::utf8(b"YES"),
            8, // decimals match APT
            string::utf8(b""),
            string::utf8(b""),
        );
        let yes_token_metadata = object::object_from_constructor_ref<Metadata>(&yes_constructor);
        let yes_mint_ref = fungible_asset::generate_mint_ref(&yes_constructor);
        let yes_burn_ref = fungible_asset::generate_burn_ref(&yes_constructor);
        let yes_transfer_ref = fungible_asset::generate_transfer_ref(&yes_constructor);

        // Create NO token
        let no_constructor = object::create_named_object(&market_signer, b"NO_TOKEN");
        let _no_token_signer = object::generate_signer(&no_constructor);
        primary_fungible_store::create_primary_store_enabled_fungible_asset(
            &no_constructor,
            option::none(),
            string::utf8(b"NO"),
            string::utf8(b"NO"),
            8, // decimals match APT
            string::utf8(b""),
            string::utf8(b""),
        );
        let no_token_metadata = object::object_from_constructor_ref<Metadata>(&no_constructor);
        let no_mint_ref = fungible_asset::generate_mint_ref(&no_constructor);
        let no_burn_ref = fungible_asset::generate_burn_ref(&no_constructor);
        let no_transfer_ref = fungible_asset::generate_transfer_ref(&no_constructor);

        // Create collateral store for USD1
        let usd1_metadata = object::address_to_object<Metadata>(COLLATERAL_METADATA_ADDR);
        let collateral_constructor = object::create_named_object(&market_signer, b"COLLATERAL");
        let collateral_store = fungible_asset::create_store(&collateral_constructor, usd1_metadata);

        // Transfer USD1 from creator to collateral store
        let collateral = primary_fungible_store::withdraw(creator, usd1_metadata, initial_liquidity);
        fungible_asset::deposit(collateral_store, collateral);

        // Initialize with equal reserves (50/50 odds)
        let half_liquidity = initial_liquidity / 2;

        // Create the market
        move_to(&market_signer, Market {
            question,
            description,
            end_time,
            resolved: false,
            outcome: option::none(),
            yes_reserve: half_liquidity,
            no_reserve: half_liquidity,
            yes_token_metadata,
            no_token_metadata,
            yes_mint_ref,
            yes_burn_ref,
            yes_transfer_ref,
            no_mint_ref,
            no_burn_ref,
            no_transfer_ref,
            collateral_store,
            extend_ref,
            creator: creator_addr,
            accumulated_fees: 0,
            total_volume: 0,
        });

        // Register market in registry
        let registry = borrow_global_mut<MarketRegistry>(@prediction_market);
        vector::push_back(&mut registry.markets, market_addr);
        registry.market_count = registry.market_count + 1;

        // Emit event
        event::emit(MarketCreated {
            market_address: market_addr,
            question: string::utf8(b""),
            creator: creator_addr,
            end_time,
            initial_liquidity,
        });
    }

    /// Buy YES tokens with USD1
    public entry fun buy_yes(
        buyer: &signer,
        market_addr: address,
        usd1_amount: u64,
        min_yes_out: u64,
    ) acquires Market {
        buy_tokens_internal(buyer, market_addr, usd1_amount, min_yes_out, true);
    }

    /// Buy NO tokens with USD1
    public entry fun buy_no(
        buyer: &signer,
        market_addr: address,
        usd1_amount: u64,
        min_no_out: u64,
    ) acquires Market {
        buy_tokens_internal(buyer, market_addr, usd1_amount, min_no_out, false);
    }

    /// Sell YES tokens for USD1
    public entry fun sell_yes(
        seller: &signer,
        market_addr: address,
        yes_amount: u64,
        min_usd1_out: u64,
    ) acquires Market {
        sell_tokens_internal(seller, market_addr, yes_amount, min_usd1_out, true);
    }

    /// Sell NO tokens for USD1
    public entry fun sell_no(
        seller: &signer,
        market_addr: address,
        no_amount: u64,
        min_usd1_out: u64,
    ) acquires Market {
        sell_tokens_internal(seller, market_addr, no_amount, min_usd1_out, false);
    }

    /// Resolve the market (creator only, after end_time)
    public entry fun resolve(
        resolver: &signer,
        market_addr: address,
        outcome: bool,
    ) acquires Market {
        let market = borrow_global_mut<Market>(market_addr);
        let resolver_addr = signer::address_of(resolver);

        assert!(resolver_addr == market.creator, E_NOT_AUTHORIZED);
        assert!(!market.resolved, E_MARKET_ALREADY_RESOLVED);
        assert!(timestamp::now_seconds() >= market.end_time, E_MARKET_STILL_ACTIVE);

        market.resolved = true;
        market.outcome = option::some(outcome);

        event::emit(MarketResolved {
            market_address: market_addr,
            outcome,
            resolver: resolver_addr,
        });
    }

    /// Redeem winning tokens for USD1 after resolution
    public entry fun redeem(
        user: &signer,
        market_addr: address,
    ) acquires Market {
        let market = borrow_global_mut<Market>(market_addr);
        let user_addr = signer::address_of(user);

        assert!(market.resolved, E_MARKET_NOT_RESOLVED);
        let outcome = *option::borrow(&market.outcome);

        // Get user's token balances
        let yes_balance = primary_fungible_store::balance(user_addr, market.yes_token_metadata);
        let no_balance = primary_fungible_store::balance(user_addr, market.no_token_metadata);

        // Calculate payout based on outcome
        let payout = if (outcome) {
            // YES wins - pay out YES token holders
            yes_balance
        } else {
            // NO wins - pay out NO token holders
            no_balance
        };

        assert!(payout > 0, E_NO_TOKENS_TO_REDEEM);

        // Burn user's tokens
        if (yes_balance > 0) {
            let yes_tokens = primary_fungible_store::withdraw(user, market.yes_token_metadata, yes_balance);
            fungible_asset::burn(&market.yes_burn_ref, yes_tokens);
        };
        if (no_balance > 0) {
            let no_tokens = primary_fungible_store::withdraw(user, market.no_token_metadata, no_balance);
            fungible_asset::burn(&market.no_burn_ref, no_tokens);
        };

        // Pay out USD1 to user
        let market_signer = object::generate_signer_for_extending(&market.extend_ref);
        let payout_asset = fungible_asset::withdraw(&market_signer, market.collateral_store, payout);
        primary_fungible_store::deposit(user_addr, payout_asset);

        event::emit(TokensRedeemed {
            market_address: market_addr,
            user: user_addr,
            yes_amount: yes_balance,
            no_amount: no_balance,
            payout,
        });
    }

    // ==================== Internal Functions ====================

    fun buy_tokens_internal(
        buyer: &signer,
        market_addr: address,
        amount_in: u64,
        min_out: u64,
        is_yes: bool,
    ) acquires Market {
        assert!(amount_in > 0, E_ZERO_AMOUNT);

        let market = borrow_global_mut<Market>(market_addr);
        assert!(!market.resolved, E_MARKET_ALREADY_RESOLVED);

        let buyer_addr = signer::address_of(buyer);

        // Calculate fee
        let fee = (amount_in * FEE_BPS) / BPS_DENOMINATOR;
        let amount_after_fee = amount_in - fee;
        market.accumulated_fees = market.accumulated_fees + fee;

        // Track volume
        market.total_volume = market.total_volume + amount_in;

        // Calculate output using CPMM formula
        let (reserve_in, reserve_out) = if (is_yes) {
            (market.no_reserve, market.yes_reserve)
        } else {
            (market.yes_reserve, market.no_reserve)
        };

        let amount_out = calculate_output(reserve_in, reserve_out, amount_after_fee);
        assert!(amount_out >= min_out, E_SLIPPAGE_EXCEEDED);

        // Transfer USD1 from buyer to market
        let usd1_metadata = object::address_to_object<Metadata>(COLLATERAL_METADATA_ADDR);
        let payment = primary_fungible_store::withdraw(buyer, usd1_metadata, amount_in);
        fungible_asset::deposit(market.collateral_store, payment);

        // Update reserves
        if (is_yes) {
            market.no_reserve = market.no_reserve + amount_after_fee;
            market.yes_reserve = market.yes_reserve - amount_out;
        } else {
            market.yes_reserve = market.yes_reserve + amount_after_fee;
            market.no_reserve = market.no_reserve - amount_out;
        };

        // Mint tokens to buyer
        let tokens = if (is_yes) {
            fungible_asset::mint(&market.yes_mint_ref, amount_out)
        } else {
            fungible_asset::mint(&market.no_mint_ref, amount_out)
        };
        primary_fungible_store::deposit(buyer_addr, tokens);

        event::emit(TokensPurchased {
            market_address: market_addr,
            buyer: buyer_addr,
            is_yes,
            amount_in,
            amount_out,
            new_yes_price: get_yes_price_internal(market.yes_reserve, market.no_reserve),
        });
    }

    fun sell_tokens_internal(
        seller: &signer,
        market_addr: address,
        amount_in: u64,
        min_out: u64,
        is_yes: bool,
    ) acquires Market {
        assert!(amount_in > 0, E_ZERO_AMOUNT);

        let market = borrow_global_mut<Market>(market_addr);
        assert!(!market.resolved, E_MARKET_ALREADY_RESOLVED);

        let seller_addr = signer::address_of(seller);

        // Calculate output using CPMM formula (selling tokens gives USD1)
        let (reserve_in, reserve_out) = if (is_yes) {
            (market.yes_reserve, market.no_reserve)
        } else {
            (market.no_reserve, market.yes_reserve)
        };

        let amount_out_before_fee = calculate_output(reserve_in, reserve_out, amount_in);
        let fee = (amount_out_before_fee * FEE_BPS) / BPS_DENOMINATOR;
        let amount_out = amount_out_before_fee - fee;
        market.accumulated_fees = market.accumulated_fees + fee;

        // Track volume (use output value as volume for sells)
        market.total_volume = market.total_volume + amount_out;

        assert!(amount_out >= min_out, E_SLIPPAGE_EXCEEDED);

        // Burn tokens from seller
        let tokens = if (is_yes) {
            primary_fungible_store::withdraw(seller, market.yes_token_metadata, amount_in)
        } else {
            primary_fungible_store::withdraw(seller, market.no_token_metadata, amount_in)
        };

        if (is_yes) {
            fungible_asset::burn(&market.yes_burn_ref, tokens);
        } else {
            fungible_asset::burn(&market.no_burn_ref, tokens);
        };

        // Update reserves
        if (is_yes) {
            market.yes_reserve = market.yes_reserve + amount_in;
            market.no_reserve = market.no_reserve - amount_out_before_fee;
        } else {
            market.no_reserve = market.no_reserve + amount_in;
            market.yes_reserve = market.yes_reserve - amount_out_before_fee;
        };

        // Transfer USD1 to seller
        let market_signer = object::generate_signer_for_extending(&market.extend_ref);
        let payout = fungible_asset::withdraw(&market_signer, market.collateral_store, amount_out);
        primary_fungible_store::deposit(seller_addr, payout);

        event::emit(TokensSold {
            market_address: market_addr,
            seller: seller_addr,
            is_yes,
            amount_in,
            amount_out,
            new_yes_price: get_yes_price_internal(market.yes_reserve, market.no_reserve),
        });
    }

    /// CPMM formula: dy = y * dx / (x + dx)
    fun calculate_output(reserve_in: u64, reserve_out: u64, amount_in: u64): u64 {
        let numerator = (reserve_out as u128) * (amount_in as u128);
        let denominator = (reserve_in as u128) + (amount_in as u128);
        ((numerator / denominator) as u64)
    }

    /// Calculate YES price as percentage (0-100)
    fun get_yes_price_internal(yes_reserve: u64, no_reserve: u64): u64 {
        let total = (yes_reserve as u128) + (no_reserve as u128);
        if (total == 0) {
            return 50 // Default to 50% if no liquidity
        };
        // Price of YES = no_reserve / total (inverse relationship in CPMM)
        (((no_reserve as u128) * 100) / total as u64)
    }

    // ==================== View Functions ====================

    #[view]
    /// Get the current YES token price (0-100 representing probability %)
    public fun get_yes_price(market_addr: address): u64 acquires Market {
        let market = borrow_global<Market>(market_addr);
        get_yes_price_internal(market.yes_reserve, market.no_reserve)
    }

    #[view]
    /// Get the current NO token price (0-100 representing probability %)
    public fun get_no_price(market_addr: address): u64 acquires Market {
        100 - get_yes_price(market_addr)
    }

    #[view]
    /// Get market details
    public fun get_market_info(market_addr: address): (String, String, u64, bool, Option<bool>, u64, u64, u64) acquires Market {
        let market = borrow_global<Market>(market_addr);
        (
            market.question,
            market.description,
            market.end_time,
            market.resolved,
            market.outcome,
            market.yes_reserve,
            market.no_reserve,
            market.total_volume,
        )
    }

    #[view]
    /// Get user's token balances for a market
    public fun get_user_positions(market_addr: address, user: address): (u64, u64) acquires Market {
        let market = borrow_global<Market>(market_addr);
        let yes_balance = primary_fungible_store::balance(user, market.yes_token_metadata);
        let no_balance = primary_fungible_store::balance(user, market.no_token_metadata);
        (yes_balance, no_balance)
    }

    #[view]
    /// Get all market addresses
    public fun get_all_markets(): vector<address> acquires MarketRegistry {
        let registry = borrow_global<MarketRegistry>(@prediction_market);
        registry.markets
    }

    #[view]
    /// Calculate expected output for a buy
    public fun quote_buy(market_addr: address, amount_in: u64, is_yes: bool): u64 acquires Market {
        let market = borrow_global<Market>(market_addr);
        let fee = (amount_in * FEE_BPS) / BPS_DENOMINATOR;
        let amount_after_fee = amount_in - fee;

        let (reserve_in, reserve_out) = if (is_yes) {
            (market.no_reserve, market.yes_reserve)
        } else {
            (market.yes_reserve, market.no_reserve)
        };

        calculate_output(reserve_in, reserve_out, amount_after_fee)
    }

    #[view]
    /// Calculate expected output for a sell
    public fun quote_sell(market_addr: address, amount_in: u64, is_yes: bool): u64 acquires Market {
        let market = borrow_global<Market>(market_addr);

        let (reserve_in, reserve_out) = if (is_yes) {
            (market.yes_reserve, market.no_reserve)
        } else {
            (market.no_reserve, market.yes_reserve)
        };

        let amount_out_before_fee = calculate_output(reserve_in, reserve_out, amount_in);
        let fee = (amount_out_before_fee * FEE_BPS) / BPS_DENOMINATOR;
        amount_out_before_fee - fee
    }

    // ==================== Test Helpers ====================

    #[test_only]
    public fun init_for_test(deployer: &signer) {
        init_module(deployer);
    }
}
