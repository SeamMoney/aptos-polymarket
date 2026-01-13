/// ============================================================================
/// PM CLEARINGHOUSE - Trade Settlement for Prediction Markets
/// ============================================================================
///
/// This module handles trade settlement between buyers and sellers of outcome
/// tokens. Unlike perpetuals, prediction markets are fully collateralized with
/// no leverage or liquidations.
///
/// KEY RESPONSIBILITIES:
/// - Settle trades between taker and maker
/// - Transfer outcome tokens and collateral
/// - Auto-mint complete sets when seller doesn't have tokens
/// - Validate order placement (active market, sufficient balance)
/// - Handle order cleanup on cancellation
///
/// TRADE SETTLEMENT FLOW:
/// 1. Buyer pays collateral (price * size)
/// 2. If seller has outcome tokens → transfer to buyer
/// 3. If seller lacks tokens → mint complete set, then transfer
/// 4. Emit trade event
///
/// DESIGN NOTES:
/// - Follows Decibel's clearinghouse_perp.move pattern
/// - Simplified: no margin, no leverage, no liquidations
/// - Complete set minting makes selling always possible
///
/// ============================================================================

module prediction_market_clob::pm_clearinghouse {
    use std::signer;
    use std::option::{Self, Option};
    use std::string::String;
    use aptos_framework::event;
    use aptos_framework::timestamp;
    use aptos_framework::object::Object;
    use aptos_framework::fungible_asset::Metadata;
    use aptos_framework::primary_fungible_store;

    use prediction_market_clob::pm_engine_types::{Self, ConditionId, PMOrderMetadata, OrderMatchingActions, OrderActions};
    use prediction_market_clob::condition_registry;
    use prediction_market_clob::position_tokens;
    use prediction_market_clob::collateral_vault;

    // ============================================================================
    // Friend Declarations
    // ============================================================================

    friend prediction_market_clob::pm_engine;

    // ============================================================================
    // Error Codes
    // ============================================================================

    const E_MARKET_NOT_ACTIVE: u64 = 500;
    const E_INSUFFICIENT_COLLATERAL: u64 = 501;
    const E_INSUFFICIENT_TOKENS: u64 = 502;
    const E_INVALID_SIZE: u64 = 503;
    const E_INVALID_PRICE: u64 = 504;
    const E_SAME_TAKER_MAKER: u64 = 505;
    const E_CONDITION_RESOLVED: u64 = 506;

    // ============================================================================
    // Constants
    // ============================================================================

    /// Price precision (6 decimals: 0.000000 to 1.000000)
    const PRICE_PRECISION: u64 = 1_000_000;

    // ============================================================================
    // EVENTS
    // ============================================================================

    #[event]
    struct TradeSettled has drop, store {
        condition_id: u64,
        outcome_index: u64,
        taker: address,
        maker: address,
        taker_order_id: u128,
        maker_order_id: u128,
        price: u64,
        size: u64,
        taker_is_buyer: bool,
        collateral_transferred: u64,
        timestamp: u64,
    }

    #[event]
    struct CompleteSetMintedForTrade has drop, store {
        condition_id: u64,
        seller: address,
        amount: u64,
    }

    #[event]
    struct OrderValidated has drop, store {
        condition_id: u64,
        outcome_index: u64,
        user: address,
        order_id: u128,
        is_bid: bool,
        price: u64,
        size: u64,
    }

    #[event]
    struct OrderCleanedUp has drop, store {
        condition_id: u64,
        outcome_index: u64,
        user: address,
        order_id: u128,
        remaining_size: u64,
        was_filled: bool,
    }

    // ============================================================================
    // TRADE SETTLEMENT
    // ============================================================================

    /// Settle a trade between taker and maker
    ///
    /// For prediction markets:
    /// - Buyer pays: price * size in collateral
    /// - Seller delivers: size outcome tokens
    /// - If seller lacks tokens, mint complete set first
    public(friend) fun settle_trade(
        condition_id: ConditionId,
        outcome_index: u64,
        taker: address,
        maker: address,
        taker_order_id: u128,
        maker_order_id: u128,
        taker_is_buyer: bool,
        price: u64,
        size: u64,
        condition_address: address,
        vault_address: address,
        token_registry_address: address,
    ): (u64, Option<String>, Option<String>, OrderMatchingActions) {
        // Basic validations
        assert!(taker != maker, E_SAME_TAKER_MAKER);
        assert!(size > 0, E_INVALID_SIZE);
        assert!(price > 0 && price < PRICE_PRECISION, E_INVALID_PRICE);

        // Check condition is still open
        assert!(condition_registry::is_condition_open(condition_address), E_CONDITION_RESOLVED);

        let condition_id_value = pm_engine_types::condition_id_value(&condition_id);

        // Determine buyer and seller
        let (buyer, seller) = if (taker_is_buyer) {
            (taker, maker)
        } else {
            (maker, taker)
        };

        // Calculate collateral amount (price is in decimals, size is in tokens)
        let collateral_amount = (price * size) / PRICE_PRECISION;

        // Get token address for this outcome
        let token_address = position_tokens::get_token_address(
            token_registry_address,
            condition_id_value,
            outcome_index,
        );

        // Get collateral metadata for balance checks
        let collateral_metadata = condition_registry::get_collateral_metadata(condition_address);

        // Check if seller has outcome tokens
        let seller_token_balance = position_tokens::get_balance(seller, token_address);

        let actions = pm_engine_types::empty_order_actions();

        if (seller_token_balance >= size) {
            // Seller has tokens - simple transfer
            // 1. Transfer collateral: buyer -> seller
            // 2. Transfer tokens: seller -> buyer
            transfer_collateral(buyer, seller, collateral_metadata, collateral_amount);
            position_tokens::transfer_tokens(token_address, seller, buyer, size);
        } else {
            // Seller needs to mint complete set first
            // This is the key innovation: selling is always possible
            let tokens_needed = size - seller_token_balance;

            // Mint complete set for seller (locks collateral, gives all outcome tokens)
            // This requires seller to have collateral
            mint_complete_set_for_seller(
                condition_id,
                seller,
                tokens_needed,
                condition_address,
                vault_address,
                token_registry_address,
            );

            event::emit(CompleteSetMintedForTrade {
                condition_id: condition_id_value,
                seller,
                amount: tokens_needed,
            });

            // Record action for tracking
            pm_engine_types::add_action(
                &mut actions,
                pm_engine_types::mint_complete_set_action(seller, condition_id, tokens_needed),
            );

            // Now seller has tokens - do the transfer
            transfer_collateral(buyer, seller, collateral_metadata, collateral_amount);
            position_tokens::transfer_tokens(token_address, seller, buyer, size);
        };

        let now = timestamp::now_seconds();

        event::emit(TradeSettled {
            condition_id: condition_id_value,
            outcome_index,
            taker,
            maker,
            taker_order_id,
            maker_order_id,
            price,
            size,
            taker_is_buyer,
            collateral_transferred: collateral_amount,
            timestamp: now,
        });

        // Return settled size and actions
        (size, option::none(), option::none(), pm_engine_types::settle_trade_actions(actions))
    }

    // ============================================================================
    // ORDER VALIDATION
    // ============================================================================

    /// Validate an order before placing on book
    ///
    /// For buyers: check sufficient collateral
    /// For sellers: either have tokens OR collateral for complete set
    public(friend) fun validate_order(
        user: &signer,
        condition_id: ConditionId,
        outcome_index: u64,
        is_bid: bool,
        price: u64,
        size: u64,
        condition_address: address,
        vault_address: address,
        token_registry_address: address,
    ): bool {
        let user_addr = signer::address_of(user);
        let condition_id_value = pm_engine_types::condition_id_value(&condition_id);

        // Check condition is open
        if (!condition_registry::is_condition_open(condition_address)) {
            return false
        };

        // Get collateral metadata
        let collateral_metadata = condition_registry::get_collateral_metadata(condition_address);

        if (is_bid) {
            // Buyer needs collateral for worst case (price * size)
            let required_collateral = (price * size) / PRICE_PRECISION;
            let user_balance = primary_fungible_store::balance(user_addr, collateral_metadata);
            if (user_balance < required_collateral) {
                return false
            };
        } else {
            // Seller needs either:
            // 1. Outcome tokens to sell, OR
            // 2. Collateral to mint complete set

            // Get token address
            let token_address = position_tokens::get_token_address(
                token_registry_address,
                condition_id_value,
                outcome_index,
            );

            let token_balance = position_tokens::get_balance(user_addr, token_address);

            if (token_balance < size) {
                // Need collateral to mint remaining tokens
                let tokens_needed = size - token_balance;
                let collateral_needed = tokens_needed; // 1:1 for complete set
                let user_collateral = primary_fungible_store::balance(user_addr, collateral_metadata);

                // Also need to receive collateral from buyer
                // Price is what buyer pays, seller receives it
                let will_receive = (price * size) / PRICE_PRECISION;

                // Net collateral needed = tokens_needed - will_receive
                // But we need tokens_needed upfront, then get will_receive later
                if (user_collateral < collateral_needed) {
                    return false
                };
            };
        };

        true
    }

    /// Called when a maker order rests on the book
    public(friend) fun place_maker_order(
        condition_id: ConditionId,
        outcome_index: u64,
        account: address,
        order_id: u128,
        price: u64,
        size: u64,
        is_bid: bool,
        metadata: PMOrderMetadata,
        vault_address: address,
    ): OrderMatchingActions {
        let actions = pm_engine_types::empty_order_actions();

        // For buyers, we could lock collateral here
        // For now, we validate at order time and lock at trade time

        event::emit(OrderValidated {
            condition_id: pm_engine_types::condition_id_value(&condition_id),
            outcome_index,
            user: account,
            order_id,
            is_bid,
            price,
            size,
        });

        pm_engine_types::place_maker_actions(actions)
    }

    /// Called when an order is removed from the book
    public(friend) fun cleanup_order(
        condition_id: ConditionId,
        outcome_index: u64,
        account: address,
        order_id: u128,
        remaining_size: u64,
        is_bid: bool,
        was_filled: bool,
        metadata: PMOrderMetadata,
        vault_address: address,
    ) {
        // Release any locked margin if we implement pre-locking
        // For now, just emit event

        event::emit(OrderCleanedUp {
            condition_id: pm_engine_types::condition_id_value(&condition_id),
            outcome_index,
            user: account,
            order_id,
            remaining_size,
            was_filled,
        });
    }

    // ============================================================================
    // INTERNAL FUNCTIONS
    // ============================================================================

    /// Transfer collateral between users
    fun transfer_collateral(
        from: address,
        to: address,
        metadata: Object<Metadata>,
        amount: u64,
    ) {
        // Note: This requires the 'from' address to have pre-approved or
        // we need to use a different pattern with the vault
        // For now, we'll rely on the trade being atomic within the module
        primary_fungible_store::transfer(
            &create_internal_signer(from),
            metadata,
            to,
            amount,
        );
    }

    /// Mint complete set for seller who lacks tokens
    fun mint_complete_set_for_seller(
        condition_id: ConditionId,
        seller: address,
        amount: u64,
        condition_address: address,
        vault_address: address,
        token_registry_address: address,
    ) {
        let condition_id_value = pm_engine_types::condition_id_value(&condition_id);
        let outcome_count = condition_registry::get_outcome_count(condition_address);

        // Deposit collateral from seller to vault
        // Note: This would need seller's signer in production
        // In the callback context, we'd use a different approach

        // Mint all outcome tokens to seller
        let i = 0;
        while (i < outcome_count) {
            let token_address = position_tokens::get_token_address(
                token_registry_address,
                condition_id_value,
                i,
            );
            position_tokens::mint_tokens(token_address, seller, amount);
            i = i + 1;
        };
    }

    /// Create an internal signer for atomic operations
    /// Note: This is a placeholder - in production we'd use different patterns
    fun create_internal_signer(_addr: address): signer {
        // This is a design challenge - we need to transfer on behalf of users
        // Options:
        // 1. Use transfer_ref from position_tokens (for tokens)
        // 2. Pre-lock funds in the vault
        // 3. Use dispatchable tokens pattern
        // For now, this will need to be addressed during integration
        abort 0 // Placeholder - will be replaced with proper pattern
    }
}
