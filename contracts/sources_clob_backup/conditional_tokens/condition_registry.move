/// ============================================================================
/// CONDITION REGISTRY - Manages Prediction Market Conditions
/// ============================================================================
///
/// A "Condition" represents a prediction market question with N possible outcomes.
/// This module handles:
/// - Creating new conditions (markets)
/// - Tracking condition state (Open, Resolved, Voided)
/// - Managing outcome metadata
/// - Resolution by authorized resolvers
///
/// DESIGN NOTES:
/// - Each condition has a unique ConditionId
/// - Conditions are stored in a global registry
/// - Outcome tokens are created separately in position_tokens.move
/// - Resolution can be by creator, oracle, committee, or optimistic
///
/// ============================================================================

module prediction_market_clob::condition_registry {
    use std::string::String;
    use std::signer;
    use std::vector;
    use std::option::{Self, Option};
    use aptos_framework::object::{Self, Object, ExtendRef};
    use aptos_framework::fungible_asset::Metadata;
    use aptos_framework::timestamp;
    use aptos_framework::event;
    use aptos_std::smart_table::{Self, SmartTable};

    use prediction_market_clob::pm_engine_types::{
        Self,
        ConditionId,
        ResolutionState,
        ResolutionSource,
    };

    // ============================================================================
    // Friend Declarations
    // ============================================================================

    friend prediction_market_clob::pm_engine;
    friend prediction_market_clob::pm_clearinghouse;
    friend prediction_market_clob::complete_sets;
    friend prediction_market_clob::resolution_manager;

    // ============================================================================
    // Error Codes
    // ============================================================================

    const E_NOT_INITIALIZED: u64 = 100;
    const E_ALREADY_INITIALIZED: u64 = 101;
    const E_CONDITION_NOT_FOUND: u64 = 102;
    const E_CONDITION_ALREADY_EXISTS: u64 = 103;
    const E_INVALID_OUTCOME_COUNT: u64 = 104;
    const E_CONDITION_NOT_OPEN: u64 = 105;
    const E_CONDITION_ALREADY_RESOLVED: u64 = 106;
    const E_NOT_AUTHORIZED_RESOLVER: u64 = 107;
    const E_RESOLUTION_TIME_NOT_REACHED: u64 = 108;
    const E_INVALID_WINNING_OUTCOME: u64 = 109;
    const E_OUTCOME_LABELS_MISMATCH: u64 = 110;

    // ============================================================================
    // STRUCTS
    // ============================================================================

    /// Global registry holding all conditions
    struct ConditionRegistry has key {
        /// Map from condition ID to condition object address
        conditions: SmartTable<u64, address>,
        /// Next condition ID to assign
        next_condition_id: u64,
        /// Extension ref for generating registry signer
        extend_ref: ExtendRef,
    }

    /// A prediction market condition (question with outcomes)
    struct Condition has key {
        /// Unique identifier
        id: ConditionId,
        /// The question being asked
        question: String,
        /// Additional description/context
        description: String,
        /// Category (Politics, Sports, Crypto, etc.)
        category: String,
        /// Number of possible outcomes
        outcome_count: u64,
        /// Labels for each outcome (e.g., ["YES", "NO"])
        outcome_labels: vector<String>,
        /// Collateral token for this market
        collateral_metadata: Object<Metadata>,
        /// How resolution will happen
        resolution_source: ResolutionSource,
        /// Unix timestamp when resolution is allowed
        resolution_time: u64,
        /// Current resolution state
        resolution_state: ResolutionState,
        /// Market creator
        creator: address,
        /// Creation timestamp
        created_at: u64,
        /// Outcome market addresses (one per outcome)
        outcome_markets: vector<address>,
        /// Extension ref for condition signer
        extend_ref: ExtendRef,
    }

    // ============================================================================
    // EVENTS
    // ============================================================================

    #[event]
    struct ConditionCreated has drop, store {
        condition_id: u64,
        condition_address: address,
        question: String,
        category: String,
        outcome_count: u64,
        outcome_labels: vector<String>,
        resolution_time: u64,
        creator: address,
    }

    #[event]
    struct ConditionResolved has drop, store {
        condition_id: u64,
        winning_outcome: u64,
        resolver: address,
        resolved_at: u64,
    }

    #[event]
    struct ConditionVoided has drop, store {
        condition_id: u64,
        voided_by: address,
        voided_at: u64,
    }

    #[event]
    struct OutcomeMarketRegistered has drop, store {
        condition_id: u64,
        outcome_index: u64,
        market_address: address,
    }

    // ============================================================================
    // INITIALIZATION
    // ============================================================================

    /// Initialize the condition registry (called once at deployment)
    public entry fun initialize(deployer: &signer) {
        let deployer_addr = signer::address_of(deployer);
        assert!(!exists<ConditionRegistry>(deployer_addr), E_ALREADY_INITIALIZED);

        let constructor_ref = object::create_named_object(deployer, b"CONDITION_REGISTRY");
        let extend_ref = object::generate_extend_ref(&constructor_ref);
        let registry_signer = object::generate_signer(&constructor_ref);

        move_to(&registry_signer, ConditionRegistry {
            conditions: smart_table::new(),
            next_condition_id: 1,
            extend_ref,
        });
    }

    // ============================================================================
    // CONDITION CREATION
    // ============================================================================

    /// Create a new prediction market condition
    /// Returns the ConditionId for the new condition
    public(friend) fun create_condition(
        creator: &signer,
        question: String,
        description: String,
        category: String,
        outcome_labels: vector<String>,
        collateral_metadata: Object<Metadata>,
        resolution_source: ResolutionSource,
        resolution_time: u64,
        registry_address: address,
    ): ConditionId acquires ConditionRegistry {
        let creator_addr = signer::address_of(creator);
        let outcome_count = vector::length(&outcome_labels);

        // Validate outcome count
        assert!(
            outcome_count >= (pm_engine_types::min_outcomes() as u64) &&
            outcome_count <= pm_engine_types::max_outcomes(),
            E_INVALID_OUTCOME_COUNT
        );

        // Get registry and allocate ID
        let registry = borrow_global_mut<ConditionRegistry>(registry_address);
        let condition_id_value = registry.next_condition_id;
        registry.next_condition_id = condition_id_value + 1;
        let condition_id = pm_engine_types::new_condition_id(condition_id_value);

        // Create condition object
        let registry_signer = object::generate_signer_for_extending(&registry.extend_ref);
        let seed = create_condition_seed(condition_id_value);
        let constructor_ref = object::create_named_object(&registry_signer, seed);
        let condition_signer = object::generate_signer(&constructor_ref);
        let condition_address = signer::address_of(&condition_signer);
        let extend_ref = object::generate_extend_ref(&constructor_ref);

        // Create condition
        let now = timestamp::now_seconds();
        move_to(&condition_signer, Condition {
            id: condition_id,
            question,
            description,
            category,
            outcome_count,
            outcome_labels,
            collateral_metadata,
            resolution_source,
            resolution_time,
            resolution_state: pm_engine_types::resolution_state_open(),
            creator: creator_addr,
            created_at: now,
            outcome_markets: vector::empty(),
            extend_ref,
        });

        // Register in table
        smart_table::add(&mut registry.conditions, condition_id_value, condition_address);

        // Emit event
        event::emit(ConditionCreated {
            condition_id: condition_id_value,
            condition_address,
            question,
            category,
            outcome_count,
            outcome_labels,
            resolution_time,
            creator: creator_addr,
        });

        condition_id
    }

    /// Register an outcome market address for a condition
    public(friend) fun register_outcome_market(
        condition_address: address,
        outcome_index: u64,
        market_address: address,
    ) acquires Condition {
        let condition = borrow_global_mut<Condition>(condition_address);

        // Ensure outcome_markets vector is large enough
        while (vector::length(&condition.outcome_markets) <= outcome_index) {
            vector::push_back(&mut condition.outcome_markets, @0x0);
        };

        // Set the market address
        *vector::borrow_mut(&mut condition.outcome_markets, outcome_index) = market_address;

        event::emit(OutcomeMarketRegistered {
            condition_id: pm_engine_types::condition_id_value(&condition.id),
            outcome_index,
            market_address,
        });
    }

    // ============================================================================
    // RESOLUTION
    // ============================================================================

    /// Resolve a condition to a specific outcome
    public(friend) fun resolve_condition(
        resolver: &signer,
        condition_address: address,
        winning_outcome: u64,
    ) acquires Condition {
        let resolver_addr = signer::address_of(resolver);
        let condition = borrow_global_mut<Condition>(condition_address);

        // Verify condition is still open
        assert!(pm_engine_types::is_open(&condition.resolution_state), E_CONDITION_ALREADY_RESOLVED);

        // Verify resolution time has passed
        let now = timestamp::now_seconds();
        assert!(now >= condition.resolution_time, E_RESOLUTION_TIME_NOT_REACHED);

        // Verify winning outcome is valid
        assert!(winning_outcome < condition.outcome_count, E_INVALID_WINNING_OUTCOME);

        // Verify resolver is authorized
        assert!(is_authorized_resolver(resolver_addr, condition), E_NOT_AUTHORIZED_RESOLVER);

        // Update state
        condition.resolution_state = pm_engine_types::resolution_state_resolved(winning_outcome);

        event::emit(ConditionResolved {
            condition_id: pm_engine_types::condition_id_value(&condition.id),
            winning_outcome,
            resolver: resolver_addr,
            resolved_at: now,
        });
    }

    /// Void a condition (refund all positions)
    public(friend) fun void_condition(
        admin: &signer,
        condition_address: address,
    ) acquires Condition {
        let admin_addr = signer::address_of(admin);
        let condition = borrow_global_mut<Condition>(condition_address);

        // Verify condition is still open
        assert!(pm_engine_types::is_open(&condition.resolution_state), E_CONDITION_ALREADY_RESOLVED);

        // Only creator can void (for now)
        assert!(admin_addr == condition.creator, E_NOT_AUTHORIZED_RESOLVER);

        // Update state
        condition.resolution_state = pm_engine_types::resolution_state_voided();

        event::emit(ConditionVoided {
            condition_id: pm_engine_types::condition_id_value(&condition.id),
            voided_by: admin_addr,
            voided_at: timestamp::now_seconds(),
        });
    }

    // ============================================================================
    // VIEW FUNCTIONS
    // ============================================================================

    #[view]
    /// Get condition address from ID
    public fun get_condition_address(
        registry_address: address,
        condition_id: u64,
    ): address acquires ConditionRegistry {
        let registry = borrow_global<ConditionRegistry>(registry_address);
        assert!(smart_table::contains(&registry.conditions, condition_id), E_CONDITION_NOT_FOUND);
        *smart_table::borrow(&registry.conditions, condition_id)
    }

    #[view]
    /// Get condition info
    public fun get_condition_info(
        condition_address: address,
    ): (String, String, String, u64, vector<String>, u64, bool, Option<u64>) acquires Condition {
        let condition = borrow_global<Condition>(condition_address);
        let winning = if (pm_engine_types::is_resolved(&condition.resolution_state)) {
            option::some(pm_engine_types::get_winning_outcome(&condition.resolution_state))
        } else {
            option::none()
        };
        (
            condition.question,
            condition.description,
            condition.category,
            condition.outcome_count,
            condition.outcome_labels,
            condition.resolution_time,
            !pm_engine_types::is_open(&condition.resolution_state),
            winning,
        )
    }

    #[view]
    /// Get outcome labels
    public fun get_outcome_labels(condition_address: address): vector<String> acquires Condition {
        borrow_global<Condition>(condition_address).outcome_labels
    }

    #[view]
    /// Get outcome count
    public fun get_outcome_count(condition_address: address): u64 acquires Condition {
        borrow_global<Condition>(condition_address).outcome_count
    }

    #[view]
    /// Get collateral metadata
    public fun get_collateral_metadata(condition_address: address): Object<Metadata> acquires Condition {
        borrow_global<Condition>(condition_address).collateral_metadata
    }

    #[view]
    /// Get resolution state
    public fun get_resolution_state(condition_address: address): ResolutionState acquires Condition {
        borrow_global<Condition>(condition_address).resolution_state
    }

    #[view]
    /// Check if condition is open
    public fun is_condition_open(condition_address: address): bool acquires Condition {
        pm_engine_types::is_open(&borrow_global<Condition>(condition_address).resolution_state)
    }

    #[view]
    /// Get outcome market address
    public fun get_outcome_market(
        condition_address: address,
        outcome_index: u64,
    ): address acquires Condition {
        let condition = borrow_global<Condition>(condition_address);
        *vector::borrow(&condition.outcome_markets, outcome_index)
    }

    #[view]
    /// Get all outcome markets
    public fun get_all_outcome_markets(condition_address: address): vector<address> acquires Condition {
        borrow_global<Condition>(condition_address).outcome_markets
    }

    #[view]
    /// Get condition creator
    public fun get_creator(condition_address: address): address acquires Condition {
        borrow_global<Condition>(condition_address).creator
    }

    #[view]
    /// Get next condition ID
    public fun get_next_condition_id(registry_address: address): u64 acquires ConditionRegistry {
        borrow_global<ConditionRegistry>(registry_address).next_condition_id
    }

    // ============================================================================
    // INTERNAL FUNCTIONS
    // ============================================================================

    /// Get condition signer for internal operations
    public(friend) fun get_condition_signer(condition_address: address): signer acquires Condition {
        let condition = borrow_global<Condition>(condition_address);
        object::generate_signer_for_extending(&condition.extend_ref)
    }

    /// Get condition ID from address
    public(friend) fun get_condition_id(condition_address: address): ConditionId acquires Condition {
        borrow_global<Condition>(condition_address).id
    }

    /// Check if resolver is authorized for this condition
    fun is_authorized_resolver(resolver: address, condition: &Condition): bool {
        pm_engine_types::is_authorized_resolver(
            resolver,
            condition.creator,
            &condition.resolution_source,
        )
    }

    /// Create seed for condition object
    fun create_condition_seed(condition_id: u64): vector<u8> {
        let seed = b"CONDITION_";
        let id_bytes = std::bcs::to_bytes(&condition_id);
        vector::append(&mut seed, id_bytes);
        seed
    }
}
