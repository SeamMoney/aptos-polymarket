/// ============================================================================
/// POSITION TOKENS - Fungible Asset Outcome Tokens
/// ============================================================================
///
/// This module manages the creation and manipulation of outcome tokens.
/// Each outcome in a condition has its own Fungible Asset token.
///
/// KEY CONCEPTS:
/// - Each outcome has a separate FA token (YES token, NO token, etc.)
/// - Tokens are minted when collateral is deposited (split)
/// - Tokens are burned when redeeming or merging
/// - Uses Aptos Fungible Asset standard for compatibility
///
/// DESIGN NOTES:
/// - Follows existing multi_outcome_market.move pattern
/// - Stores mint/burn refs in OutcomeTokenRefs struct
/// - Uses primary_fungible_store for user balances
///
/// ============================================================================

module prediction_market_clob::position_tokens {
    use std::string::{Self, String};
    use std::signer;
    use std::vector;
    use std::option;
    use aptos_framework::object::{Self, Object, ConstructorRef, ExtendRef};
    use aptos_framework::fungible_asset::{Self, Metadata, MintRef, BurnRef, TransferRef, FungibleAsset};
    use aptos_framework::primary_fungible_store;
    use aptos_framework::event;
    use aptos_std::smart_table::{Self, SmartTable};

    use prediction_market_clob::pm_engine_types::{Self, ConditionId};

    // ============================================================================
    // Friend Declarations
    // ============================================================================

    friend prediction_market_clob::pm_engine;
    friend prediction_market_clob::pm_clearinghouse;
    friend prediction_market_clob::complete_sets;

    // ============================================================================
    // Error Codes
    // ============================================================================

    const E_NOT_INITIALIZED: u64 = 200;
    const E_ALREADY_INITIALIZED: u64 = 201;
    const E_OUTCOME_TOKEN_NOT_FOUND: u64 = 202;
    const E_OUTCOME_TOKEN_ALREADY_EXISTS: u64 = 203;
    const E_INSUFFICIENT_BALANCE: u64 = 204;
    const E_ZERO_AMOUNT: u64 = 205;

    // ============================================================================
    // Constants
    // ============================================================================

    /// Token decimals (matches APT/USDC)
    const TOKEN_DECIMALS: u8 = 8;

    // ============================================================================
    // STRUCTS
    // ============================================================================

    /// Global registry of outcome tokens
    struct OutcomeTokenRegistry has key {
        /// Map: (condition_id, outcome_index) -> token address
        tokens: SmartTable<TokenKey, address>,
        /// Extension ref for registry signer
        extend_ref: ExtendRef,
    }

    /// Key for looking up outcome tokens
    struct TokenKey has copy, drop, store {
        condition_id: u64,
        outcome_index: u64,
    }

    /// Capabilities for an outcome token
    /// Stored at the token's object address
    struct OutcomeTokenRefs has key {
        /// Which condition this token belongs to
        condition_id: ConditionId,
        /// Which outcome (0, 1, 2, ...)
        outcome_index: u64,
        /// Token label (e.g., "YES", "NO")
        label: String,
        /// Token metadata object
        metadata: Object<Metadata>,
        /// Minting capability
        mint_ref: MintRef,
        /// Burning capability
        burn_ref: BurnRef,
        /// Transfer capability
        transfer_ref: TransferRef,
        /// Extension ref for token operations
        extend_ref: ExtendRef,
    }

    // ============================================================================
    // EVENTS
    // ============================================================================

    #[event]
    struct OutcomeTokenCreated has drop, store {
        condition_id: u64,
        outcome_index: u64,
        label: String,
        token_address: address,
        metadata_address: address,
    }

    #[event]
    struct TokensMinted has drop, store {
        condition_id: u64,
        outcome_index: u64,
        recipient: address,
        amount: u64,
    }

    #[event]
    struct TokensBurned has drop, store {
        condition_id: u64,
        outcome_index: u64,
        from: address,
        amount: u64,
    }

    // ============================================================================
    // INITIALIZATION
    // ============================================================================

    /// Initialize the outcome token registry
    public entry fun initialize(deployer: &signer) {
        let deployer_addr = signer::address_of(deployer);
        assert!(!exists<OutcomeTokenRegistry>(deployer_addr), E_ALREADY_INITIALIZED);

        let constructor_ref = object::create_named_object(deployer, b"OUTCOME_TOKEN_REGISTRY");
        let extend_ref = object::generate_extend_ref(&constructor_ref);
        let registry_signer = object::generate_signer(&constructor_ref);

        move_to(&registry_signer, OutcomeTokenRegistry {
            tokens: smart_table::new(),
            extend_ref,
        });
    }

    // ============================================================================
    // TOKEN CREATION
    // ============================================================================

    /// Create outcome tokens for a condition
    /// Called when a new condition is created
    public(friend) fun create_outcome_tokens(
        condition_id: ConditionId,
        condition_address: address,
        outcome_labels: &vector<String>,
        registry_address: address,
    ): vector<Object<Metadata>> acquires OutcomeTokenRegistry, OutcomeTokenRefs {
        let registry = borrow_global_mut<OutcomeTokenRegistry>(registry_address);
        let registry_signer = object::generate_signer_for_extending(&registry.extend_ref);

        let condition_id_value = pm_engine_types::condition_id_value(&condition_id);
        let outcome_count = vector::length(outcome_labels);
        let metadata_objects = vector::empty<Object<Metadata>>();

        let i = 0;
        while (i < outcome_count) {
            let label = *vector::borrow(outcome_labels, i);
            let token_address = create_single_outcome_token(
                &registry_signer,
                condition_id,
                condition_id_value,
                (i as u64),
                label,
            );

            // Get metadata from token
            let token_refs = borrow_global<OutcomeTokenRefs>(token_address);
            vector::push_back(&mut metadata_objects, token_refs.metadata);

            // Register in table
            let key = TokenKey {
                condition_id: condition_id_value,
                outcome_index: (i as u64),
            };
            smart_table::add(&mut registry.tokens, key, token_address);

            i = i + 1;
        };

        metadata_objects
    }

    /// Create a single outcome token
    fun create_single_outcome_token(
        registry_signer: &signer,
        condition_id: ConditionId,
        condition_id_value: u64,
        outcome_index: u64,
        label: String,
    ): address {
        // Create unique seed for this token
        let seed = create_token_seed(condition_id_value, outcome_index);
        let constructor_ref = object::create_named_object(registry_signer, seed);
        let token_signer = object::generate_signer(&constructor_ref);
        let token_address = signer::address_of(&token_signer);
        let extend_ref = object::generate_extend_ref(&constructor_ref);

        // Create the fungible asset
        primary_fungible_store::create_primary_store_enabled_fungible_asset(
            &constructor_ref,
            option::none(), // unlimited supply
            label,
            label,
            TOKEN_DECIMALS,
            string::utf8(b""), // icon URI
            string::utf8(b""), // project URI
        );

        // Get refs
        let metadata = object::object_from_constructor_ref<Metadata>(&constructor_ref);
        let mint_ref = fungible_asset::generate_mint_ref(&constructor_ref);
        let burn_ref = fungible_asset::generate_burn_ref(&constructor_ref);
        let transfer_ref = fungible_asset::generate_transfer_ref(&constructor_ref);

        // Store refs
        move_to(&token_signer, OutcomeTokenRefs {
            condition_id,
            outcome_index,
            label,
            metadata,
            mint_ref,
            burn_ref,
            transfer_ref,
            extend_ref,
        });

        event::emit(OutcomeTokenCreated {
            condition_id: condition_id_value,
            outcome_index,
            label,
            token_address,
            metadata_address: object::object_address(&metadata),
        });

        token_address
    }

    // ============================================================================
    // TOKEN OPERATIONS
    // ============================================================================

    /// Mint outcome tokens to a user
    /// Called when minting complete sets or during trade settlement
    public(friend) fun mint_tokens(
        token_address: address,
        recipient: address,
        amount: u64,
    ) acquires OutcomeTokenRefs {
        assert!(amount > 0, E_ZERO_AMOUNT);

        let refs = borrow_global<OutcomeTokenRefs>(token_address);
        let tokens = fungible_asset::mint(&refs.mint_ref, amount);
        primary_fungible_store::deposit(recipient, tokens);

        event::emit(TokensMinted {
            condition_id: pm_engine_types::condition_id_value(&refs.condition_id),
            outcome_index: refs.outcome_index,
            recipient,
            amount,
        });
    }

    /// Burn outcome tokens from a user
    /// Called when burning complete sets, redeeming winnings, or during settlement
    public(friend) fun burn_tokens(
        user: &signer,
        token_address: address,
        amount: u64,
    ) acquires OutcomeTokenRefs {
        assert!(amount > 0, E_ZERO_AMOUNT);

        let refs = borrow_global<OutcomeTokenRefs>(token_address);
        let user_addr = signer::address_of(user);

        // Verify balance
        let balance = primary_fungible_store::balance(user_addr, refs.metadata);
        assert!(balance >= amount, E_INSUFFICIENT_BALANCE);

        // Withdraw and burn
        let tokens = primary_fungible_store::withdraw(user, refs.metadata, amount);
        fungible_asset::burn(&refs.burn_ref, tokens);

        event::emit(TokensBurned {
            condition_id: pm_engine_types::condition_id_value(&refs.condition_id),
            outcome_index: refs.outcome_index,
            from: user_addr,
            amount,
        });
    }

    /// Burn tokens from a specific address (for settlement callbacks)
    /// Requires the token's signer (held by registry)
    public(friend) fun burn_tokens_from(
        token_address: address,
        from: address,
        amount: u64,
    ) acquires OutcomeTokenRefs {
        assert!(amount > 0, E_ZERO_AMOUNT);

        let refs = borrow_global<OutcomeTokenRefs>(token_address);

        // Verify balance
        let balance = primary_fungible_store::balance(from, refs.metadata);
        assert!(balance >= amount, E_INSUFFICIENT_BALANCE);

        // Use transfer_ref to force withdraw, then burn
        let from_store = primary_fungible_store::ensure_primary_store_exists(from, refs.metadata);
        let tokens = fungible_asset::withdraw_with_ref(&refs.transfer_ref, from_store, amount);
        fungible_asset::burn(&refs.burn_ref, tokens);

        event::emit(TokensBurned {
            condition_id: pm_engine_types::condition_id_value(&refs.condition_id),
            outcome_index: refs.outcome_index,
            from,
            amount,
        });
    }

    /// Transfer tokens between users (for settlement)
    public(friend) fun transfer_tokens(
        token_address: address,
        from: address,
        to: address,
        amount: u64,
    ) acquires OutcomeTokenRefs {
        assert!(amount > 0, E_ZERO_AMOUNT);

        let refs = borrow_global<OutcomeTokenRefs>(token_address);

        // Verify balance
        let balance = primary_fungible_store::balance(from, refs.metadata);
        assert!(balance >= amount, E_INSUFFICIENT_BALANCE);

        // Use transfer_ref to force transfer
        let from_store = primary_fungible_store::ensure_primary_store_exists(from, refs.metadata);
        let to_store = primary_fungible_store::ensure_primary_store_exists(to, refs.metadata);
        fungible_asset::transfer_with_ref(&refs.transfer_ref, from_store, to_store, amount);
    }

    // ============================================================================
    // VIEW FUNCTIONS
    // ============================================================================

    #[view]
    /// Get token address for a condition/outcome pair
    public fun get_token_address(
        registry_address: address,
        condition_id: u64,
        outcome_index: u64,
    ): address acquires OutcomeTokenRegistry {
        let registry = borrow_global<OutcomeTokenRegistry>(registry_address);
        let key = TokenKey { condition_id, outcome_index };
        assert!(smart_table::contains(&registry.tokens, key), E_OUTCOME_TOKEN_NOT_FOUND);
        *smart_table::borrow(&registry.tokens, key)
    }

    #[view]
    /// Get token metadata object
    public fun get_token_metadata(token_address: address): Object<Metadata> acquires OutcomeTokenRefs {
        borrow_global<OutcomeTokenRefs>(token_address).metadata
    }

    #[view]
    /// Get user balance for a token
    public fun get_balance(
        user: address,
        token_address: address,
    ): u64 acquires OutcomeTokenRefs {
        let refs = borrow_global<OutcomeTokenRefs>(token_address);
        primary_fungible_store::balance(user, refs.metadata)
    }

    #[view]
    /// Get user balances for all outcomes in a condition
    public fun get_all_balances(
        user: address,
        registry_address: address,
        condition_id: u64,
        outcome_count: u64,
    ): vector<u64> acquires OutcomeTokenRegistry, OutcomeTokenRefs {
        let balances = vector::empty<u64>();
        let i = 0;
        while (i < outcome_count) {
            let token_address = get_token_address(registry_address, condition_id, i);
            let balance = get_balance(user, token_address);
            vector::push_back(&mut balances, balance);
            i = i + 1;
        };
        balances
    }

    #[view]
    /// Get token info
    public fun get_token_info(
        token_address: address,
    ): (u64, u64, String) acquires OutcomeTokenRefs {
        let refs = borrow_global<OutcomeTokenRefs>(token_address);
        (
            pm_engine_types::condition_id_value(&refs.condition_id),
            refs.outcome_index,
            refs.label,
        )
    }

    // ============================================================================
    // INTERNAL FUNCTIONS
    // ============================================================================

    /// Create unique seed for token object
    fun create_token_seed(condition_id: u64, outcome_index: u64): vector<u8> {
        let seed = b"OUTCOME_TOKEN_";
        let id_bytes = std::bcs::to_bytes(&condition_id);
        vector::append(&mut seed, id_bytes);
        vector::append(&mut seed, b"_");
        let index_bytes = std::bcs::to_bytes(&outcome_index);
        vector::append(&mut seed, index_bytes);
        seed
    }

    /// Check if token exists
    public(friend) fun token_exists(
        registry_address: address,
        condition_id: u64,
        outcome_index: u64,
    ): bool acquires OutcomeTokenRegistry {
        let registry = borrow_global<OutcomeTokenRegistry>(registry_address);
        let key = TokenKey { condition_id, outcome_index };
        smart_table::contains(&registry.tokens, key)
    }
}
