/// ============================================================================
/// COLLATERAL VAULT - Collateral Custody for Prediction Markets
/// ============================================================================
///
/// This module manages collateral (APT, USDC, or any FA) for prediction markets.
/// Each condition has its own collateral vault that holds:
/// - Collateral locked when minting complete sets
/// - Pending margin for open orders
///
/// KEY OPERATIONS:
/// - Deposit: Lock collateral when minting complete sets
/// - Withdraw: Return collateral when burning complete sets
/// - Redeem: Pay out collateral to winning token holders
///
/// DESIGN NOTES:
/// - Uses Aggregators (AIP-47) for parallel execution
/// - Each condition has its own vault (isolated risk)
/// - Supports any Fungible Asset as collateral
///
/// ============================================================================

module prediction_market_clob::collateral_vault {
    use std::signer;
    use aptos_framework::object::{Self, Object, ExtendRef};
    use aptos_framework::fungible_asset::{Self, Metadata, FungibleStore, FungibleAsset};
    use aptos_framework::primary_fungible_store;
    use aptos_framework::event;
    use aptos_framework::aggregator_v2::{Self, Aggregator};
    use aptos_std::smart_table::{Self, SmartTable};

    use prediction_market_clob::pm_engine_types::{Self, ConditionId};

    // ============================================================================
    // Friend Declarations
    // ============================================================================

    friend prediction_market_clob::pm_engine;
    friend prediction_market_clob::pm_clearinghouse;
    friend prediction_market_clob::complete_sets;
    friend prediction_market_clob::condition_registry;

    // ============================================================================
    // Error Codes
    // ============================================================================

    const E_NOT_INITIALIZED: u64 = 300;
    const E_ALREADY_INITIALIZED: u64 = 301;
    const E_VAULT_NOT_FOUND: u64 = 302;
    const E_VAULT_ALREADY_EXISTS: u64 = 303;
    const E_INSUFFICIENT_BALANCE: u64 = 304;
    const E_ZERO_AMOUNT: u64 = 305;
    const E_INSUFFICIENT_VAULT_BALANCE: u64 = 306;
    const E_CONDITION_NOT_RESOLVED: u64 = 307;

    // ============================================================================
    // STRUCTS
    // ============================================================================

    /// Global vault registry
    struct VaultRegistry has key {
        /// Map: condition_id -> vault address
        vaults: SmartTable<u64, address>,
        /// Extension ref for registry signer
        extend_ref: ExtendRef,
    }

    /// Collateral vault for a single condition
    struct ConditionVault has key {
        /// Which condition this vault is for
        condition_id: ConditionId,
        /// Collateral token metadata
        collateral_metadata: Object<Metadata>,
        /// Store holding the actual collateral
        collateral_store: Object<FungibleStore>,
        /// Total collateral from complete sets (uses Aggregator for parallel execution)
        total_collateral: Aggregator<u64>,
        /// Total pending margin (locked for open orders)
        pending_margin: Aggregator<u64>,
        /// Extension ref for vault signer
        extend_ref: ExtendRef,
    }

    /// User's margin account for a condition
    struct UserMargin has key {
        /// Map: condition_id -> locked margin amount
        locked_margin: SmartTable<u64, u64>,
    }

    // ============================================================================
    // EVENTS
    // ============================================================================

    #[event]
    struct VaultCreated has drop, store {
        condition_id: u64,
        vault_address: address,
        collateral_metadata: address,
    }

    #[event]
    struct CollateralDeposited has drop, store {
        condition_id: u64,
        user: address,
        amount: u64,
    }

    #[event]
    struct CollateralWithdrawn has drop, store {
        condition_id: u64,
        user: address,
        amount: u64,
    }

    #[event]
    struct MarginLocked has drop, store {
        condition_id: u64,
        user: address,
        amount: u64,
    }

    #[event]
    struct MarginReleased has drop, store {
        condition_id: u64,
        user: address,
        amount: u64,
    }

    // ============================================================================
    // INITIALIZATION
    // ============================================================================

    /// Initialize the vault registry
    public entry fun initialize(deployer: &signer) {
        let deployer_addr = signer::address_of(deployer);
        assert!(!exists<VaultRegistry>(deployer_addr), E_ALREADY_INITIALIZED);

        let constructor_ref = object::create_named_object(deployer, b"COLLATERAL_VAULT_REGISTRY");
        let extend_ref = object::generate_extend_ref(&constructor_ref);
        let registry_signer = object::generate_signer(&constructor_ref);

        move_to(&registry_signer, VaultRegistry {
            vaults: smart_table::new(),
            extend_ref,
        });
    }

    // ============================================================================
    // VAULT CREATION
    // ============================================================================

    /// Create a vault for a condition
    /// Called when a new condition is created
    public(friend) fun create_vault(
        condition_id: ConditionId,
        collateral_metadata: Object<Metadata>,
        registry_address: address,
    ): address acquires VaultRegistry {
        let condition_id_value = pm_engine_types::condition_id_value(&condition_id);

        let registry = borrow_global_mut<VaultRegistry>(registry_address);
        assert!(!smart_table::contains(&registry.vaults, condition_id_value), E_VAULT_ALREADY_EXISTS);

        let registry_signer = object::generate_signer_for_extending(&registry.extend_ref);

        // Create vault object
        let seed = create_vault_seed(condition_id_value);
        let constructor_ref = object::create_named_object(&registry_signer, seed);
        let vault_signer = object::generate_signer(&constructor_ref);
        let vault_address = signer::address_of(&vault_signer);
        let extend_ref = object::generate_extend_ref(&constructor_ref);

        // Create the collateral store
        let collateral_store = fungible_asset::create_store(&constructor_ref, collateral_metadata);

        // Initialize the vault
        move_to(&vault_signer, ConditionVault {
            condition_id,
            collateral_metadata,
            collateral_store,
            total_collateral: aggregator_v2::create_unbounded_aggregator(),
            pending_margin: aggregator_v2::create_unbounded_aggregator(),
            extend_ref,
        });

        // Register in table
        smart_table::add(&mut registry.vaults, condition_id_value, vault_address);

        event::emit(VaultCreated {
            condition_id: condition_id_value,
            vault_address,
            collateral_metadata: object::object_address(&collateral_metadata),
        });

        vault_address
    }

    // ============================================================================
    // COLLATERAL OPERATIONS (for complete sets)
    // ============================================================================

    /// Deposit collateral when minting complete sets
    public(friend) fun deposit_collateral(
        user: &signer,
        vault_address: address,
        amount: u64,
    ) acquires ConditionVault {
        assert!(amount > 0, E_ZERO_AMOUNT);

        let vault = borrow_global_mut<ConditionVault>(vault_address);
        let user_addr = signer::address_of(user);

        // Transfer collateral from user to vault
        let collateral = primary_fungible_store::withdraw(user, vault.collateral_metadata, amount);
        fungible_asset::deposit(vault.collateral_store, collateral);

        // Update total
        aggregator_v2::add(&mut vault.total_collateral, amount);

        event::emit(CollateralDeposited {
            condition_id: pm_engine_types::condition_id_value(&vault.condition_id),
            user: user_addr,
            amount,
        });
    }

    /// Deposit collateral as FungibleAsset (for internal transfers)
    public(friend) fun deposit_collateral_fa(
        vault_address: address,
        collateral: FungibleAsset,
    ) acquires ConditionVault {
        let amount = fungible_asset::amount(&collateral);
        assert!(amount > 0, E_ZERO_AMOUNT);

        let vault = borrow_global_mut<ConditionVault>(vault_address);

        // Deposit collateral
        fungible_asset::deposit(vault.collateral_store, collateral);

        // Update total
        aggregator_v2::add(&mut vault.total_collateral, amount);
    }

    /// Withdraw collateral when burning complete sets
    public(friend) fun withdraw_collateral(
        vault_address: address,
        recipient: address,
        amount: u64,
    ) acquires ConditionVault {
        assert!(amount > 0, E_ZERO_AMOUNT);

        let vault = borrow_global_mut<ConditionVault>(vault_address);

        // Verify vault has enough
        let vault_balance = aggregator_v2::read(&vault.total_collateral);
        assert!(vault_balance >= amount, E_INSUFFICIENT_VAULT_BALANCE);

        // Get vault signer to withdraw
        let vault_signer = object::generate_signer_for_extending(&vault.extend_ref);

        // Withdraw and transfer to recipient
        let collateral = fungible_asset::withdraw(&vault_signer, vault.collateral_store, amount);
        primary_fungible_store::deposit(recipient, collateral);

        // Update total
        aggregator_v2::sub(&mut vault.total_collateral, amount);

        event::emit(CollateralWithdrawn {
            condition_id: pm_engine_types::condition_id_value(&vault.condition_id),
            user: recipient,
            amount,
        });
    }

    /// Withdraw collateral as FungibleAsset (for internal transfers)
    public(friend) fun withdraw_collateral_fa(
        vault_address: address,
        amount: u64,
    ): FungibleAsset acquires ConditionVault {
        assert!(amount > 0, E_ZERO_AMOUNT);

        let vault = borrow_global_mut<ConditionVault>(vault_address);

        // Verify vault has enough
        let vault_balance = aggregator_v2::read(&vault.total_collateral);
        assert!(vault_balance >= amount, E_INSUFFICIENT_VAULT_BALANCE);

        // Get vault signer to withdraw
        let vault_signer = object::generate_signer_for_extending(&vault.extend_ref);

        // Update total first
        aggregator_v2::sub(&mut vault.total_collateral, amount);

        // Withdraw and return
        fungible_asset::withdraw(&vault_signer, vault.collateral_store, amount)
    }

    // ============================================================================
    // MARGIN OPERATIONS (for order book trading)
    // ============================================================================

    /// Lock margin for a pending order
    public(friend) fun lock_margin(
        user: &signer,
        vault_address: address,
        amount: u64,
    ) acquires ConditionVault, UserMargin {
        assert!(amount > 0, E_ZERO_AMOUNT);

        let vault = borrow_global_mut<ConditionVault>(vault_address);
        let user_addr = signer::address_of(user);
        let condition_id_value = pm_engine_types::condition_id_value(&vault.condition_id);

        // Transfer collateral from user to vault
        let collateral = primary_fungible_store::withdraw(user, vault.collateral_metadata, amount);
        fungible_asset::deposit(vault.collateral_store, collateral);

        // Update pending margin
        aggregator_v2::add(&mut vault.pending_margin, amount);

        // Track user's locked margin
        ensure_user_margin_exists(user);
        let user_margin = borrow_global_mut<UserMargin>(user_addr);
        if (smart_table::contains(&user_margin.locked_margin, condition_id_value)) {
            let current = smart_table::borrow_mut(&mut user_margin.locked_margin, condition_id_value);
            *current = *current + amount;
        } else {
            smart_table::add(&mut user_margin.locked_margin, condition_id_value, amount);
        };

        event::emit(MarginLocked {
            condition_id: condition_id_value,
            user: user_addr,
            amount,
        });
    }

    /// Release margin when order is cancelled or filled
    public(friend) fun release_margin(
        vault_address: address,
        user_addr: address,
        amount: u64,
    ) acquires ConditionVault, UserMargin {
        assert!(amount > 0, E_ZERO_AMOUNT);

        let vault = borrow_global_mut<ConditionVault>(vault_address);
        let condition_id_value = pm_engine_types::condition_id_value(&vault.condition_id);

        // Verify pending margin
        let pending = aggregator_v2::read(&vault.pending_margin);
        assert!(pending >= amount, E_INSUFFICIENT_BALANCE);

        // Get vault signer
        let vault_signer = object::generate_signer_for_extending(&vault.extend_ref);

        // Withdraw and return to user
        let collateral = fungible_asset::withdraw(&vault_signer, vault.collateral_store, amount);
        primary_fungible_store::deposit(user_addr, collateral);

        // Update pending margin
        aggregator_v2::sub(&mut vault.pending_margin, amount);

        // Update user's tracked margin
        if (exists<UserMargin>(user_addr)) {
            let user_margin = borrow_global_mut<UserMargin>(user_addr);
            if (smart_table::contains(&user_margin.locked_margin, condition_id_value)) {
                let current = smart_table::borrow_mut(&mut user_margin.locked_margin, condition_id_value);
                if (*current >= amount) {
                    *current = *current - amount;
                };
            };
        };

        event::emit(MarginReleased {
            condition_id: condition_id_value,
            user: user_addr,
            amount,
        });
    }

    /// Convert pending margin to complete set collateral
    /// Called when seller needs to mint tokens during trade settlement
    public(friend) fun convert_margin_to_collateral(
        vault_address: address,
        user_addr: address,
        amount: u64,
    ) acquires ConditionVault, UserMargin {
        assert!(amount > 0, E_ZERO_AMOUNT);

        let vault = borrow_global_mut<ConditionVault>(vault_address);
        let condition_id_value = pm_engine_types::condition_id_value(&vault.condition_id);

        // Move from pending to total collateral
        let pending = aggregator_v2::read(&vault.pending_margin);
        assert!(pending >= amount, E_INSUFFICIENT_BALANCE);

        aggregator_v2::sub(&mut vault.pending_margin, amount);
        aggregator_v2::add(&mut vault.total_collateral, amount);

        // Update user's tracked margin
        if (exists<UserMargin>(user_addr)) {
            let user_margin = borrow_global_mut<UserMargin>(user_addr);
            if (smart_table::contains(&user_margin.locked_margin, condition_id_value)) {
                let current = smart_table::borrow_mut(&mut user_margin.locked_margin, condition_id_value);
                if (*current >= amount) {
                    *current = *current - amount;
                };
            };
        };
    }

    // ============================================================================
    // VIEW FUNCTIONS
    // ============================================================================

    #[view]
    /// Get vault address for a condition
    public fun get_vault_address(
        registry_address: address,
        condition_id: u64,
    ): address acquires VaultRegistry {
        let registry = borrow_global<VaultRegistry>(registry_address);
        assert!(smart_table::contains(&registry.vaults, condition_id), E_VAULT_NOT_FOUND);
        *smart_table::borrow(&registry.vaults, condition_id)
    }

    #[view]
    /// Get total collateral in vault
    public fun get_total_collateral(vault_address: address): u64 acquires ConditionVault {
        aggregator_v2::read(&borrow_global<ConditionVault>(vault_address).total_collateral)
    }

    #[view]
    /// Get pending margin in vault
    public fun get_pending_margin(vault_address: address): u64 acquires ConditionVault {
        aggregator_v2::read(&borrow_global<ConditionVault>(vault_address).pending_margin)
    }

    #[view]
    /// Get collateral metadata for vault
    public fun get_collateral_metadata(vault_address: address): Object<Metadata> acquires ConditionVault {
        borrow_global<ConditionVault>(vault_address).collateral_metadata
    }

    #[view]
    /// Get user's locked margin for a condition
    public fun get_user_locked_margin(
        user: address,
        condition_id: u64,
    ): u64 acquires UserMargin {
        if (!exists<UserMargin>(user)) {
            return 0
        };
        let user_margin = borrow_global<UserMargin>(user);
        if (smart_table::contains(&user_margin.locked_margin, condition_id)) {
            *smart_table::borrow(&user_margin.locked_margin, condition_id)
        } else {
            0
        }
    }

    #[view]
    /// Check if vault exists
    public fun vault_exists(
        registry_address: address,
        condition_id: u64,
    ): bool acquires VaultRegistry {
        let registry = borrow_global<VaultRegistry>(registry_address);
        smart_table::contains(&registry.vaults, condition_id)
    }

    // ============================================================================
    // INTERNAL FUNCTIONS
    // ============================================================================

    /// Create unique seed for vault object
    fun create_vault_seed(condition_id: u64): vector<u8> {
        let seed = b"COLLATERAL_VAULT_";
        let id_bytes = std::bcs::to_bytes(&condition_id);
        std::vector::append(&mut seed, id_bytes);
        seed
    }

    /// Ensure UserMargin exists for user
    fun ensure_user_margin_exists(user: &signer) {
        let user_addr = signer::address_of(user);
        if (!exists<UserMargin>(user_addr)) {
            move_to(user, UserMargin {
                locked_margin: smart_table::new(),
            });
        };
    }

    /// Get vault signer for internal operations
    public(friend) fun get_vault_signer(vault_address: address): signer acquires ConditionVault {
        let vault = borrow_global<ConditionVault>(vault_address);
        object::generate_signer_for_extending(&vault.extend_ref)
    }
}
