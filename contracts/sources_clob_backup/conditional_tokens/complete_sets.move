/// ============================================================================
/// COMPLETE SETS - Split, Merge, and Redeem Operations
/// ============================================================================
///
/// This module implements the core economic mechanism of prediction markets:
/// the Complete Sets model.
///
/// KEY OPERATIONS:
/// - Split (Mint): 1 collateral → 1 of each outcome token
/// - Merge (Burn): 1 of each outcome token → 1 collateral
/// - Redeem: After resolution, winning tokens → collateral
///
/// ECONOMIC INVARIANTS:
/// - Total value of complete set = collateral amount
/// - Sum of outcome token supplies = collateral locked
/// - After resolution: only winning tokens have value
///
/// EXAMPLE (Binary Market):
/// - User deposits 1 APT
/// - Receives: 1 YES token + 1 NO token
/// - If YES wins: 1 YES token redeems for 1 APT
/// - If NO wins: 1 NO token redeems for 1 APT
///
/// ============================================================================

module prediction_market_clob::complete_sets {
    use std::signer;
    use std::vector;
    use aptos_framework::event;

    use prediction_market_clob::pm_engine_types::{Self, ConditionId};
    use prediction_market_clob::condition_registry;
    use prediction_market_clob::position_tokens;
    use prediction_market_clob::collateral_vault;

    // ============================================================================
    // Friend Declarations
    // ============================================================================

    friend prediction_market_clob::pm_engine;
    friend prediction_market_clob::pm_clearinghouse;

    // ============================================================================
    // Error Codes
    // ============================================================================

    const E_ZERO_AMOUNT: u64 = 600;
    const E_CONDITION_NOT_FOUND: u64 = 601;
    const E_CONDITION_NOT_OPEN: u64 = 602;
    const E_CONDITION_NOT_RESOLVED: u64 = 603;
    const E_CONDITION_VOIDED: u64 = 604;
    const E_INSUFFICIENT_TOKENS: u64 = 605;
    const E_INSUFFICIENT_COLLATERAL: u64 = 606;
    const E_NOT_WINNING_OUTCOME: u64 = 607;

    // ============================================================================
    // EVENTS
    // ============================================================================

    #[event]
    struct CompleteSetMinted has drop, store {
        condition_id: u64,
        user: address,
        amount: u64,
        outcome_count: u64,
    }

    #[event]
    struct CompleteSetBurned has drop, store {
        condition_id: u64,
        user: address,
        amount: u64,
        collateral_returned: u64,
    }

    #[event]
    struct WinningsRedeemed has drop, store {
        condition_id: u64,
        user: address,
        winning_outcome: u64,
        token_amount: u64,
        collateral_received: u64,
    }

    #[event]
    struct VoidedPositionRedeemed has drop, store {
        condition_id: u64,
        user: address,
        total_sets_redeemed: u64,
        collateral_received: u64,
    }

    // ============================================================================
    // SPLIT (MINT COMPLETE SET)
    // ============================================================================

    /// Mint a complete set of outcome tokens
    ///
    /// User deposits collateral and receives one token for each outcome.
    /// For a binary market: 1 APT → 1 YES + 1 NO
    ///
    /// # Arguments
    /// * `user` - The user minting tokens
    /// * `condition_id` - Which condition to mint for
    /// * `amount` - Amount of complete sets to mint
    /// * `condition_address` - Address of the condition
    /// * `vault_address` - Address of the collateral vault
    /// * `token_registry_address` - Address of the token registry
    public(friend) fun mint_complete_set(
        user: &signer,
        condition_id: ConditionId,
        amount: u64,
        condition_address: address,
        vault_address: address,
        token_registry_address: address,
    ) {
        assert!(amount > 0, E_ZERO_AMOUNT);

        // Verify condition is open
        assert!(condition_registry::is_condition_open(condition_address), E_CONDITION_NOT_OPEN);

        let condition_id_value = pm_engine_types::condition_id_value(&condition_id);
        let user_addr = signer::address_of(user);

        // Get outcome count
        let outcome_count = condition_registry::get_outcome_count(condition_address);

        // 1. Deposit collateral to vault
        collateral_vault::deposit_collateral(user, vault_address, amount);

        // 2. Mint one token for each outcome
        let i = 0;
        while (i < outcome_count) {
            let token_address = position_tokens::get_token_address(
                token_registry_address,
                condition_id_value,
                i,
            );
            position_tokens::mint_tokens(token_address, user_addr, amount);
            i = i + 1;
        };

        event::emit(CompleteSetMinted {
            condition_id: condition_id_value,
            user: user_addr,
            amount,
            outcome_count,
        });
    }

    /// Mint complete set with explicit signer (for internal use)
    public(friend) fun mint_complete_set_for(
        user_addr: address,
        condition_id: ConditionId,
        amount: u64,
        condition_address: address,
        vault_address: address,
        token_registry_address: address,
    ) {
        assert!(amount > 0, E_ZERO_AMOUNT);

        let condition_id_value = pm_engine_types::condition_id_value(&condition_id);

        // Get outcome count
        let outcome_count = condition_registry::get_outcome_count(condition_address);

        // Note: Collateral should already be in vault (pre-deposited)

        // Mint one token for each outcome
        let i = 0;
        while (i < outcome_count) {
            let token_address = position_tokens::get_token_address(
                token_registry_address,
                condition_id_value,
                i,
            );
            position_tokens::mint_tokens(token_address, user_addr, amount);
            i = i + 1;
        };

        event::emit(CompleteSetMinted {
            condition_id: condition_id_value,
            user: user_addr,
            amount,
            outcome_count,
        });
    }

    // ============================================================================
    // MERGE (BURN COMPLETE SET)
    // ============================================================================

    /// Burn a complete set of outcome tokens
    ///
    /// User returns one token of each outcome and receives collateral back.
    /// For a binary market: 1 YES + 1 NO → 1 APT
    ///
    /// This is useful when a trader holds all outcomes and wants to exit.
    ///
    /// # Arguments
    /// * `user` - The user burning tokens
    /// * `condition_id` - Which condition to burn for
    /// * `amount` - Amount of complete sets to burn
    /// * `condition_address` - Address of the condition
    /// * `vault_address` - Address of the collateral vault
    /// * `token_registry_address` - Address of the token registry
    public(friend) fun burn_complete_set(
        user: &signer,
        condition_id: ConditionId,
        amount: u64,
        condition_address: address,
        vault_address: address,
        token_registry_address: address,
    ) {
        assert!(amount > 0, E_ZERO_AMOUNT);

        // Condition must be open (can't burn after resolution)
        assert!(condition_registry::is_condition_open(condition_address), E_CONDITION_NOT_OPEN);

        let condition_id_value = pm_engine_types::condition_id_value(&condition_id);
        let user_addr = signer::address_of(user);

        // Get outcome count
        let outcome_count = condition_registry::get_outcome_count(condition_address);

        // 1. Verify user has all outcome tokens
        let i = 0;
        while (i < outcome_count) {
            let token_address = position_tokens::get_token_address(
                token_registry_address,
                condition_id_value,
                i,
            );
            let balance = position_tokens::get_balance(user_addr, token_address);
            assert!(balance >= amount, E_INSUFFICIENT_TOKENS);
            i = i + 1;
        };

        // 2. Burn all outcome tokens
        i = 0;
        while (i < outcome_count) {
            let token_address = position_tokens::get_token_address(
                token_registry_address,
                condition_id_value,
                i,
            );
            position_tokens::burn_tokens(user, token_address, amount);
            i = i + 1;
        };

        // 3. Return collateral to user
        collateral_vault::withdraw_collateral(vault_address, user_addr, amount);

        event::emit(CompleteSetBurned {
            condition_id: condition_id_value,
            user: user_addr,
            amount,
            collateral_returned: amount,
        });
    }

    // ============================================================================
    // REDEEM (AFTER RESOLUTION)
    // ============================================================================

    /// Redeem winning outcome tokens for collateral
    ///
    /// After a condition is resolved, holders of winning tokens can
    /// redeem them for collateral at 1:1 ratio.
    ///
    /// # Arguments
    /// * `user` - The user redeeming tokens
    /// * `condition_id` - Which condition to redeem for
    /// * `condition_address` - Address of the condition
    /// * `vault_address` - Address of the collateral vault
    /// * `token_registry_address` - Address of the token registry
    public(friend) fun redeem_winnings(
        user: &signer,
        condition_id: ConditionId,
        condition_address: address,
        vault_address: address,
        token_registry_address: address,
    ): u64 {
        let condition_id_value = pm_engine_types::condition_id_value(&condition_id);
        let user_addr = signer::address_of(user);

        // Get resolution state
        let resolution_state = condition_registry::get_resolution_state(condition_address);

        // Handle based on resolution state
        if (pm_engine_types::is_voided(&resolution_state)) {
            // Voided: refund all positions proportionally
            return redeem_voided(
                user,
                condition_id,
                condition_address,
                vault_address,
                token_registry_address,
            )
        };

        // Must be resolved (not open)
        assert!(pm_engine_types::is_resolved(&resolution_state), E_CONDITION_NOT_RESOLVED);

        // Get winning outcome
        let winning_outcome = pm_engine_types::get_winning_outcome(&resolution_state);

        // Get winning token address
        let winning_token_address = position_tokens::get_token_address(
            token_registry_address,
            condition_id_value,
            winning_outcome,
        );

        // Get user's winning token balance
        let winning_balance = position_tokens::get_balance(user_addr, winning_token_address);

        if (winning_balance == 0) {
            return 0
        };

        // Burn winning tokens
        position_tokens::burn_tokens(user, winning_token_address, winning_balance);

        // Return collateral (1:1 ratio)
        collateral_vault::withdraw_collateral(vault_address, user_addr, winning_balance);

        event::emit(WinningsRedeemed {
            condition_id: condition_id_value,
            user: user_addr,
            winning_outcome,
            token_amount: winning_balance,
            collateral_received: winning_balance,
        });

        winning_balance
    }

    /// Redeem all outcomes for a specific winning outcome
    /// (Called when user knows which outcome to redeem)
    public(friend) fun redeem_outcome(
        user: &signer,
        condition_id: ConditionId,
        outcome_index: u64,
        condition_address: address,
        vault_address: address,
        token_registry_address: address,
    ): u64 {
        let condition_id_value = pm_engine_types::condition_id_value(&condition_id);
        let user_addr = signer::address_of(user);

        // Get resolution state
        let resolution_state = condition_registry::get_resolution_state(condition_address);

        // Must be resolved
        assert!(pm_engine_types::is_resolved(&resolution_state), E_CONDITION_NOT_RESOLVED);

        // Check this is the winning outcome
        let winning_outcome = pm_engine_types::get_winning_outcome(&resolution_state);
        assert!(outcome_index == winning_outcome, E_NOT_WINNING_OUTCOME);

        // Get token address
        let token_address = position_tokens::get_token_address(
            token_registry_address,
            condition_id_value,
            outcome_index,
        );

        // Get user's balance
        let balance = position_tokens::get_balance(user_addr, token_address);

        if (balance == 0) {
            return 0
        };

        // Burn tokens
        position_tokens::burn_tokens(user, token_address, balance);

        // Return collateral
        collateral_vault::withdraw_collateral(vault_address, user_addr, balance);

        event::emit(WinningsRedeemed {
            condition_id: condition_id_value,
            user: user_addr,
            winning_outcome,
            token_amount: balance,
            collateral_received: balance,
        });

        balance
    }

    // ============================================================================
    // VOIDED REDEMPTION
    // ============================================================================

    /// Redeem positions for a voided condition
    ///
    /// When a condition is voided (e.g., ambiguous resolution), all
    /// complete sets can be redeemed for collateral.
    ///
    /// User gets back: min(balance across all outcomes)
    fun redeem_voided(
        user: &signer,
        condition_id: ConditionId,
        condition_address: address,
        vault_address: address,
        token_registry_address: address,
    ): u64 {
        let condition_id_value = pm_engine_types::condition_id_value(&condition_id);
        let user_addr = signer::address_of(user);

        // Get outcome count
        let outcome_count = condition_registry::get_outcome_count(condition_address);

        // Find minimum balance across all outcomes (complete sets)
        let min_balance = 0xFFFFFFFFFFFFFFFF; // u64 max
        let i = 0;
        while (i < outcome_count) {
            let token_address = position_tokens::get_token_address(
                token_registry_address,
                condition_id_value,
                i,
            );
            let balance = position_tokens::get_balance(user_addr, token_address);
            if (balance < min_balance) {
                min_balance = balance;
            };
            i = i + 1;
        };

        if (min_balance == 0 || min_balance == 0xFFFFFFFFFFFFFFFF) {
            return 0
        };

        // Burn min_balance from each outcome
        i = 0;
        while (i < outcome_count) {
            let token_address = position_tokens::get_token_address(
                token_registry_address,
                condition_id_value,
                i,
            );
            position_tokens::burn_tokens(user, token_address, min_balance);
            i = i + 1;
        };

        // Return collateral
        collateral_vault::withdraw_collateral(vault_address, user_addr, min_balance);

        event::emit(VoidedPositionRedeemed {
            condition_id: condition_id_value,
            user: user_addr,
            total_sets_redeemed: min_balance,
            collateral_received: min_balance,
        });

        min_balance
    }

    // ============================================================================
    // VIEW FUNCTIONS
    // ============================================================================

    #[view]
    /// Get the maximum complete sets a user can burn
    public fun max_burnable_sets(
        user: address,
        condition_id: u64,
        outcome_count: u64,
        token_registry_address: address,
    ): u64 {
        let min_balance = 0xFFFFFFFFFFFFFFFF;
        let i = 0;
        while (i < outcome_count) {
            let token_address = position_tokens::get_token_address(
                token_registry_address,
                condition_id,
                i,
            );
            let balance = position_tokens::get_balance(user, token_address);
            if (balance < min_balance) {
                min_balance = balance;
            };
            i = i + 1;
        };

        if (min_balance == 0xFFFFFFFFFFFFFFFF) {
            0
        } else {
            min_balance
        }
    }

    #[view]
    /// Get user's redeemable amount for a resolved condition
    public fun redeemable_amount(
        user: address,
        condition_id: u64,
        condition_address: address,
        token_registry_address: address,
    ): u64 {
        // Check resolution state
        let resolution_state = condition_registry::get_resolution_state(condition_address);

        if (pm_engine_types::is_open(&resolution_state)) {
            return 0
        };

        if (pm_engine_types::is_voided(&resolution_state)) {
            // For voided, return min balance (complete sets)
            let outcome_count = condition_registry::get_outcome_count(condition_address);
            return max_burnable_sets(user, condition_id, outcome_count, token_registry_address)
        };

        // Resolved - return winning token balance
        let winning_outcome = pm_engine_types::get_winning_outcome(&resolution_state);
        let winning_token = position_tokens::get_token_address(
            token_registry_address,
            condition_id,
            winning_outcome,
        );

        position_tokens::get_balance(user, winning_token)
    }
}
