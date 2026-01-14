/// Multi-Outcome Prediction Market - SmartTable Variant
/// BENCHMARK: Uses SmartTable instead of Table for registry
/// This is the OLD approach - expected to have worse parallelization due to bucket locking
///
module prediction_market::smarttable_market {
    use std::string::{Self, String};
    use std::signer;
    use std::option::{Self, Option};
    use std::vector;
    use aptos_framework::object::{Self, Object, ExtendRef};
    use aptos_framework::fungible_asset::{Self, Metadata, FungibleStore, MintRef, TransferRef, BurnRef};
    use aptos_framework::primary_fungible_store;
    use aptos_framework::timestamp;
    use aptos_framework::event;
    use aptos_framework::aggregator_v2::{Self, Aggregator};
    use aptos_std::smart_table::{Self, SmartTable};  // <-- CHANGED: Using SmartTable

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
    const E_OUTCOME_NOT_FOUND: u64 = 13;

    // ==================== Constants ====================

    const MINIMUM_LIQUIDITY: u64 = 10000000;
    const MAX_OUTCOMES: u64 = 20;
    const MIN_OUTCOMES: u64 = 2;
    const FEE_BPS: u64 = 30;
    const BPS_DENOMINATOR: u64 = 10000;
    const PRICE_SCALE: u64 = 100;

    // ==================== Structs ====================

    struct OutcomeMarket has key {
        market_addr: address,
        outcome_index: u64,
        label: String,
        metadata: Object<Metadata>,
        mint_ref: MintRef,
        burn_ref: BurnRef,
        transfer_ref: TransferRef,
        reserve: Aggregator<u64>,
    }

    struct MultiMarket has key {
        question: String,
        description: String,
        category: String,
        end_time: u64,
        creator: address,
        outcome_addresses: vector<address>,
        outcome_count: u64,
        collateral_metadata: Object<Metadata>,
        collateral_store: Object<FungibleStore>,
        total_collateral: Aggregator<u64>,
        base_reserve: Aggregator<u64>,
        resolved: bool,
        winning_outcome: Option<u64>,
        extend_ref: ExtendRef,
        fee_bps: u64,
        accumulated_fees: Aggregator<u64>,
    }

    struct MarketMetadata has store, drop, copy {
        creator: address,
        created_at: u64,
        outcome_count: u64,
    }

    /// BENCHMARK: SmartTable registry (has bucket locking overhead)
    struct MultiMarketRegistry has key {
        markets: SmartTable<address, MarketMetadata>,  // <-- CHANGED: SmartTable
        market_count: u64,
        extend_ref: ExtendRef,
        admin: address,
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

    fun init_module(deployer: &signer) {
        let constructor_ref = object::create_named_object(deployer, b"SMARTTABLE_REGISTRY");
        let extend_ref = object::generate_extend_ref(&constructor_ref);

        move_to(deployer, MultiMarketRegistry {
            markets: smart_table::new(),  // <-- CHANGED: smart_table::new()
            market_count: 0,
            extend_ref,
            admin: signer::address_of(deployer),
        });
    }

    // ==================== Entry Functions ====================

    public entry fun create_multi_market_with_collateral(
        creator: &signer,
        question: String,
        description: String,
        category: String,
        outcome_labels: vector<String>,
        end_time: u64,
        initial_liquidity: u64,
        collateral_metadata: Object<Metadata>,
    ) acquires MultiMarketRegistry {
        let outcome_count = vector::length(&outcome_labels);
        assert!(outcome_count >= MIN_OUTCOMES && outcome_count <= MAX_OUTCOMES, E_INVALID_OUTCOME_COUNT);
        assert!(initial_liquidity >= MINIMUM_LIQUIDITY * (outcome_count as u64), E_INSUFFICIENT_LIQUIDITY);

        let creator_addr = signer::address_of(creator);

        let constructor_ref = object::create_object(creator_addr);
        let market_signer = object::generate_signer(&constructor_ref);
        let market_addr = signer::address_of(&market_signer);
        let extend_ref = object::generate_extend_ref(&constructor_ref);

        let outcome_addresses = vector::empty<address>();
        let reserve_per_outcome = initial_liquidity / (outcome_count as u64);
        let i = 0;
        while (i < outcome_count) {
            let label = *vector::borrow(&outcome_labels, i);
            let outcome_addr = create_outcome_market(&market_signer, market_addr, (i as u64), label, reserve_per_outcome);
            vector::push_back(&mut outcome_addresses, outcome_addr);
            i = i + 1;
        };

        let collateral_constructor = object::create_named_object(&market_signer, b"COLLATERAL");
        let collateral_store = fungible_asset::create_store(&collateral_constructor, collateral_metadata);

        let liquidity = primary_fungible_store::withdraw(creator, collateral_metadata, initial_liquidity);
        fungible_asset::deposit(collateral_store, liquidity);

        move_to(&market_signer, MultiMarket {
            question,
            description,
            category,
            end_time,
            creator: creator_addr,
            outcome_addresses,
            outcome_count: (outcome_count as u64),
            collateral_metadata,
            collateral_store,
            total_collateral: aggregator_v2::create_unbounded_aggregator_with_value(initial_liquidity),
            base_reserve: aggregator_v2::create_unbounded_aggregator_with_value(reserve_per_outcome),
            resolved: false,
            winning_outcome: option::none(),
            extend_ref,
            fee_bps: FEE_BPS,
            accumulated_fees: aggregator_v2::create_unbounded_aggregator_with_value(0u64),
        });

        // BENCHMARK: SmartTable add (has bucket locking)
        let registry = borrow_global_mut<MultiMarketRegistry>(@prediction_market);
        smart_table::add(&mut registry.markets, market_addr, MarketMetadata {  // <-- CHANGED
            creator: creator_addr,
            created_at: timestamp::now_seconds(),
            outcome_count: (outcome_count as u64),
        });
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

    public entry fun mint_complete_set(
        user: &signer,
        market_addr: address,
        collateral_amount: u64,
    ) acquires MultiMarket, OutcomeMarket {
        assert!(collateral_amount > 0, E_ZERO_AMOUNT);

        let market = borrow_global_mut<MultiMarket>(market_addr);
        assert!(!market.resolved, E_MARKET_ALREADY_RESOLVED);

        let user_addr = signer::address_of(user);

        let collateral = primary_fungible_store::withdraw(user, market.collateral_metadata, collateral_amount);
        fungible_asset::deposit(market.collateral_store, collateral);
        aggregator_v2::add(&mut market.total_collateral, collateral_amount);

        let tokens_per_outcome = collateral_amount;

        let i = 0;
        let outcome_count = market.outcome_count;
        while (i < outcome_count) {
            let outcome_addr = *vector::borrow(&market.outcome_addresses, i);
            let outcome = borrow_global<OutcomeMarket>(outcome_addr);
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

    public entry fun buy_outcome(
        buyer: &signer,
        market_addr: address,
        outcome_index: u64,
        collateral_in: u64,
        min_tokens_out: u64,
    ) acquires MultiMarket, OutcomeMarket {
        assert!(collateral_in > 0, E_ZERO_AMOUNT);

        let market = borrow_global_mut<MultiMarket>(market_addr);
        assert!(!market.resolved, E_MARKET_ALREADY_RESOLVED);
        assert!(outcome_index < market.outcome_count, E_INVALID_OUTCOME);

        let buyer_addr = signer::address_of(buyer);

        let fee = (collateral_in * market.fee_bps) / BPS_DENOMINATOR;
        let amount_after_fee = collateral_in - fee;
        aggregator_v2::add(&mut market.accumulated_fees, fee);

        let outcome_addr = *vector::borrow(&market.outcome_addresses, outcome_index);
        let outcome = borrow_global_mut<OutcomeMarket>(outcome_addr);

        let base_snapshot = aggregator_v2::snapshot(&market.base_reserve);
        let outcome_snapshot = aggregator_v2::snapshot(&outcome.reserve);
        let current_base_reserve = aggregator_v2::read_snapshot(&base_snapshot);
        let current_outcome_reserve = aggregator_v2::read_snapshot(&outcome_snapshot);

        let tokens_out = calculate_buy_output(current_base_reserve, current_outcome_reserve, amount_after_fee);
        assert!(tokens_out >= min_tokens_out, E_SLIPPAGE_EXCEEDED);

        aggregator_v2::add(&mut market.base_reserve, amount_after_fee);
        aggregator_v2::sub(&mut outcome.reserve, tokens_out);

        let payment = primary_fungible_store::withdraw(buyer, market.collateral_metadata, collateral_in);
        fungible_asset::deposit(market.collateral_store, payment);
        aggregator_v2::add(&mut market.total_collateral, collateral_in);

        let tokens = fungible_asset::mint(&outcome.mint_ref, tokens_out);
        primary_fungible_store::deposit(buyer_addr, tokens);

        let new_price = calculate_price(
            current_base_reserve + amount_after_fee,
            current_outcome_reserve - tokens_out
        );

        event::emit(OutcomeTokenBought {
            market_address: market_addr,
            buyer: buyer_addr,
            outcome_index,
            collateral_in,
            tokens_out,
            new_price,
        });
    }

    public entry fun sell_outcome(
        seller: &signer,
        market_addr: address,
        outcome_index: u64,
        tokens_in: u64,
        min_collateral_out: u64,
    ) acquires MultiMarket, OutcomeMarket {
        assert!(tokens_in > 0, E_ZERO_AMOUNT);

        let market = borrow_global_mut<MultiMarket>(market_addr);
        assert!(!market.resolved, E_MARKET_ALREADY_RESOLVED);
        assert!(outcome_index < market.outcome_count, E_INVALID_OUTCOME);

        let seller_addr = signer::address_of(seller);

        let outcome_addr = *vector::borrow(&market.outcome_addresses, outcome_index);
        let outcome = borrow_global_mut<OutcomeMarket>(outcome_addr);

        let base_snapshot = aggregator_v2::snapshot(&market.base_reserve);
        let outcome_snapshot = aggregator_v2::snapshot(&outcome.reserve);
        let current_base_reserve = aggregator_v2::read_snapshot(&base_snapshot);
        let current_outcome_reserve = aggregator_v2::read_snapshot(&outcome_snapshot);

        let collateral_out_before_fee = calculate_sell_output(current_outcome_reserve, current_base_reserve, tokens_in);
        let fee = (collateral_out_before_fee * market.fee_bps) / BPS_DENOMINATOR;
        let collateral_out = collateral_out_before_fee - fee;
        assert!(collateral_out >= min_collateral_out, E_SLIPPAGE_EXCEEDED);

        aggregator_v2::add(&mut market.accumulated_fees, fee);
        aggregator_v2::add(&mut outcome.reserve, tokens_in);
        aggregator_v2::sub(&mut market.base_reserve, collateral_out_before_fee);

        let tokens = primary_fungible_store::withdraw(seller, outcome.metadata, tokens_in);
        fungible_asset::burn(&outcome.burn_ref, tokens);

        aggregator_v2::sub(&mut market.total_collateral, collateral_out);
        let market_signer = object::generate_signer_for_extending(&market.extend_ref);
        let payout = fungible_asset::withdraw(&market_signer, market.collateral_store, collateral_out);
        primary_fungible_store::deposit(seller_addr, payout);

        let new_price = calculate_price(
            current_base_reserve - collateral_out_before_fee,
            current_outcome_reserve + tokens_in
        );

        event::emit(OutcomeTokenSold {
            market_address: market_addr,
            seller: seller_addr,
            outcome_index,
            tokens_in,
            collateral_out,
            new_price,
        });
    }

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

    public entry fun redeem_winnings(
        user: &signer,
        market_addr: address,
    ) acquires MultiMarket, OutcomeMarket {
        let market = borrow_global_mut<MultiMarket>(market_addr);
        assert!(market.resolved, E_MARKET_NOT_RESOLVED);

        let user_addr = signer::address_of(user);
        let winning_index = *option::borrow(&market.winning_outcome);
        let winning_outcome_addr = *vector::borrow(&market.outcome_addresses, winning_index);
        let winning_outcome = borrow_global<OutcomeMarket>(winning_outcome_addr);

        let winning_balance = primary_fungible_store::balance(user_addr, winning_outcome.metadata);
        assert!(winning_balance > 0, E_NO_TOKENS_TO_REDEEM);

        let tokens = primary_fungible_store::withdraw(user, winning_outcome.metadata, winning_balance);
        fungible_asset::burn(&winning_outcome.burn_ref, tokens);

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

    public entry fun emergency_withdraw(
        admin: &signer,
        market_addr: address,
        amount: u64,
    ) acquires MultiMarket {
        let market = borrow_global_mut<MultiMarket>(market_addr);
        let admin_addr = signer::address_of(admin);

        assert!(admin_addr == market.creator, E_NOT_AUTHORIZED);

        let market_signer = object::generate_signer_for_extending(&market.extend_ref);
        let withdraw_asset = fungible_asset::withdraw(&market_signer, market.collateral_store, amount);
        primary_fungible_store::deposit(admin_addr, withdraw_asset);

        aggregator_v2::sub(&mut market.total_collateral, amount);
    }

    // ==================== Internal Functions ====================

    fun create_outcome_market(
        market_signer: &signer,
        market_addr: address,
        index: u64,
        label: String,
        initial_reserve: u64,
    ): address {
        let seed = b"OUTCOME_";
        vector::append(&mut seed, *string::bytes(&label));

        let constructor = object::create_named_object(market_signer, seed);
        let outcome_signer = object::generate_signer(&constructor);
        let outcome_addr = signer::address_of(&outcome_signer);

        primary_fungible_store::create_primary_store_enabled_fungible_asset(
            &constructor,
            option::none(),
            label,
            label,
            8,
            string::utf8(b""),
            string::utf8(b""),
        );

        let metadata = object::object_from_constructor_ref<Metadata>(&constructor);
        let mint_ref = fungible_asset::generate_mint_ref(&constructor);
        let burn_ref = fungible_asset::generate_burn_ref(&constructor);
        let transfer_ref = fungible_asset::generate_transfer_ref(&constructor);

        move_to(&outcome_signer, OutcomeMarket {
            market_addr,
            outcome_index: index,
            label,
            metadata,
            mint_ref,
            burn_ref,
            transfer_ref,
            reserve: aggregator_v2::create_unbounded_aggregator_with_value(initial_reserve),
        });

        outcome_addr
    }

    fun calculate_buy_output(base_reserve: u64, outcome_reserve: u64, amount_in: u64): u64 {
        let numerator = (outcome_reserve as u128) * (amount_in as u128);
        let denominator = (base_reserve as u128) + (amount_in as u128);
        ((numerator / denominator) as u64)
    }

    fun calculate_sell_output(outcome_reserve: u64, base_reserve: u64, tokens_in: u64): u64 {
        let numerator = (base_reserve as u128) * (tokens_in as u128);
        let denominator = (outcome_reserve as u128) + (tokens_in as u128);
        ((numerator / denominator) as u64)
    }

    fun calculate_price(base_reserve: u64, outcome_reserve: u64): u64 {
        let total = (base_reserve as u128) + (outcome_reserve as u128);
        if (total == 0) {
            return 50
        };
        (((base_reserve as u128) * (PRICE_SCALE as u128)) / total as u64)
    }

    // ==================== View Functions ====================

    #[view]
    public fun get_all_prices(market_addr: address): vector<u64> acquires MultiMarket, OutcomeMarket {
        let market = borrow_global<MultiMarket>(market_addr);
        let base_reserve = aggregator_v2::read(&market.base_reserve);
        let prices = vector::empty<u64>();
        let i = 0;
        while (i < market.outcome_count) {
            let outcome_addr = *vector::borrow(&market.outcome_addresses, i);
            let outcome = borrow_global<OutcomeMarket>(outcome_addr);
            let outcome_reserve = aggregator_v2::read(&outcome.reserve);
            let price = calculate_price(base_reserve, outcome_reserve);
            vector::push_back(&mut prices, price);
            i = i + 1;
        };
        prices
    }

    #[view]
    public fun get_market_count(): u64 acquires MultiMarketRegistry {
        let registry = borrow_global<MultiMarketRegistry>(@prediction_market);
        registry.market_count
    }

    #[view]
    public fun market_exists(market_addr: address): bool acquires MultiMarketRegistry {
        let registry = borrow_global<MultiMarketRegistry>(@prediction_market);
        smart_table::contains(&registry.markets, market_addr)  // <-- CHANGED
    }

    #[test_only]
    public fun init_for_test(deployer: &signer) {
        init_module(deployer);
    }
}
