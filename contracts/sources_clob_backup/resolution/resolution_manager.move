/// ============================================================================
/// RESOLUTION MANAGER - Oracle and Committee Resolution for Prediction Markets
/// ============================================================================
///
/// This module handles the resolution of prediction markets through various
/// mechanisms:
/// - Creator Resolution: Market creator decides outcome
/// - Oracle Resolution: External oracle (e.g., Pyth, Switchboard) provides outcome
/// - Committee Resolution: Multi-sig committee votes on outcome
/// - Optimistic Resolution: UMA-style with dispute period
///
/// DESIGN NOTES:
/// - Integrates with Pyth for price-based markets
/// - Supports Switchboard for general purpose oracles
/// - Committee voting with configurable thresholds
/// - Optimistic resolution with bond + dispute period
///
/// ============================================================================

module prediction_market_clob::resolution_manager {
    use std::string::String;
    use std::signer;
    use std::vector;
    use std::option::{Self, Option};
    use aptos_framework::timestamp;
    use aptos_framework::event;
    use aptos_framework::object::{Self, ExtendRef};
    use aptos_std::smart_table::{Self, SmartTable};

    use prediction_market_clob::pm_engine_types::{Self, ConditionId, ResolutionSource};
    use prediction_market_clob::condition_registry;

    // ============================================================================
    // Error Codes
    // ============================================================================

    const E_NOT_AUTHORIZED: u64 = 800;
    const E_RESOLUTION_NOT_FOUND: u64 = 801;
    const E_ALREADY_RESOLVED: u64 = 802;
    const E_RESOLUTION_TIME_NOT_REACHED: u64 = 803;
    const E_INVALID_OUTCOME: u64 = 804;
    const E_NOT_COMMITTEE_MEMBER: u64 = 805;
    const E_ALREADY_VOTED: u64 = 806;
    const E_DISPUTE_PERIOD_NOT_ENDED: u64 = 807;
    const E_DISPUTE_PERIOD_ENDED: u64 = 808;
    const E_INSUFFICIENT_BOND: u64 = 809;
    const E_NO_PROPOSAL: u64 = 810;

    // ============================================================================
    // STRUCTS
    // ============================================================================

    /// Registry for resolution processes
    struct ResolutionRegistry has key {
        /// Map: condition_id -> resolution process address
        processes: SmartTable<u64, address>,
        /// Extension ref
        extend_ref: ExtendRef,
    }

    /// Committee resolution process
    struct CommitteeResolution has key {
        /// Condition being resolved
        condition_id: ConditionId,
        /// Committee members
        members: vector<address>,
        /// Required signatures
        required_signatures: u64,
        /// Votes: outcome -> voters
        votes: SmartTable<u64, vector<address>>,
        /// Has member voted
        has_voted: SmartTable<address, bool>,
        /// Is finalized
        is_finalized: bool,
        /// Winning outcome if finalized
        winning_outcome: Option<u64>,
    }

    /// Optimistic resolution process (UMA-style)
    struct OptimisticResolution has key {
        /// Condition being resolved
        condition_id: ConditionId,
        /// Current proposal
        proposal: Option<ResolutionProposal>,
        /// Bond amount required
        bond_amount: u64,
        /// Dispute period in seconds
        dispute_period_seconds: u64,
        /// Is finalized
        is_finalized: bool,
        /// Winning outcome if finalized
        winning_outcome: Option<u64>,
    }

    /// A resolution proposal
    struct ResolutionProposal has copy, drop, store {
        /// Proposed outcome
        proposed_outcome: u64,
        /// Proposer address
        proposer: address,
        /// When proposal was made
        proposed_at: u64,
        /// Bond deposited
        bond_amount: u64,
    }

    /// A dispute against a proposal
    struct Dispute has copy, drop, store {
        /// Disputed proposal
        disputed_outcome: u64,
        /// Counter-proposed outcome
        counter_outcome: u64,
        /// Disputer address
        disputer: address,
        /// When dispute was raised
        disputed_at: u64,
        /// Bond deposited
        bond_amount: u64,
    }

    // ============================================================================
    // EVENTS
    // ============================================================================

    #[event]
    struct CommitteeVoteCast has drop, store {
        condition_id: u64,
        voter: address,
        outcome: u64,
        votes_for_outcome: u64,
        required_signatures: u64,
    }

    #[event]
    struct CommitteeResolutionFinalized has drop, store {
        condition_id: u64,
        winning_outcome: u64,
        total_votes: u64,
    }

    #[event]
    struct OptimisticProposalSubmitted has drop, store {
        condition_id: u64,
        proposer: address,
        proposed_outcome: u64,
        bond_amount: u64,
        dispute_deadline: u64,
    }

    #[event]
    struct OptimisticProposalDisputed has drop, store {
        condition_id: u64,
        disputer: address,
        disputed_outcome: u64,
        counter_outcome: u64,
        bond_amount: u64,
    }

    #[event]
    struct OptimisticResolutionFinalized has drop, store {
        condition_id: u64,
        winning_outcome: u64,
        was_disputed: bool,
    }

    // ============================================================================
    // INITIALIZATION
    // ============================================================================

    /// Initialize the resolution registry
    public entry fun initialize(deployer: &signer) {
        let deployer_addr = signer::address_of(deployer);

        let constructor_ref = object::create_named_object(deployer, b"RESOLUTION_REGISTRY");
        let extend_ref = object::generate_extend_ref(&constructor_ref);
        let registry_signer = object::generate_signer(&constructor_ref);

        move_to(&registry_signer, ResolutionRegistry {
            processes: smart_table::new(),
            extend_ref,
        });
    }

    // ============================================================================
    // COMMITTEE RESOLUTION
    // ============================================================================

    /// Initialize committee resolution for a condition
    public fun init_committee_resolution(
        condition_id: ConditionId,
        members: vector<address>,
        required_signatures: u64,
        registry_address: address,
    ): address acquires ResolutionRegistry {
        let registry = borrow_global_mut<ResolutionRegistry>(registry_address);
        let condition_id_value = pm_engine_types::condition_id_value(&condition_id);

        let registry_signer = object::generate_signer_for_extending(&registry.extend_ref);

        // Create resolution process object
        let seed = create_resolution_seed(condition_id_value);
        let constructor_ref = object::create_named_object(&registry_signer, seed);
        let process_signer = object::generate_signer(&constructor_ref);
        let process_address = signer::address_of(&process_signer);

        move_to(&process_signer, CommitteeResolution {
            condition_id,
            members,
            required_signatures,
            votes: smart_table::new(),
            has_voted: smart_table::new(),
            is_finalized: false,
            winning_outcome: option::none(),
        });

        smart_table::add(&mut registry.processes, condition_id_value, process_address);

        process_address
    }

    /// Cast a vote in committee resolution
    public entry fun committee_vote(
        voter: &signer,
        condition_id: u64,
        outcome: u64,
        process_address: address,
        condition_address: address,
    ) acquires CommitteeResolution {
        let voter_addr = signer::address_of(voter);
        let resolution = borrow_global_mut<CommitteeResolution>(process_address);

        // Verify not finalized
        assert!(!resolution.is_finalized, E_ALREADY_RESOLVED);

        // Verify voter is committee member
        assert!(vector::contains(&resolution.members, &voter_addr), E_NOT_COMMITTEE_MEMBER);

        // Verify hasn't voted
        assert!(
            !smart_table::contains(&resolution.has_voted, voter_addr) ||
            !*smart_table::borrow(&resolution.has_voted, voter_addr),
            E_ALREADY_VOTED
        );

        // Record vote
        if (!smart_table::contains(&resolution.votes, outcome)) {
            smart_table::add(&mut resolution.votes, outcome, vector::empty());
        };
        let voters = smart_table::borrow_mut(&mut resolution.votes, outcome);
        vector::push_back(voters, voter_addr);

        // Mark as voted
        if (smart_table::contains(&resolution.has_voted, voter_addr)) {
            let voted = smart_table::borrow_mut(&mut resolution.has_voted, voter_addr);
            *voted = true;
        } else {
            smart_table::add(&mut resolution.has_voted, voter_addr, true);
        };

        let votes_for_outcome = vector::length(voters);

        event::emit(CommitteeVoteCast {
            condition_id,
            voter: voter_addr,
            outcome,
            votes_for_outcome: (votes_for_outcome as u64),
            required_signatures: resolution.required_signatures,
        });

        // Check if threshold reached
        if ((votes_for_outcome as u64) >= resolution.required_signatures) {
            // Finalize resolution
            resolution.is_finalized = true;
            resolution.winning_outcome = option::some(outcome);

            event::emit(CommitteeResolutionFinalized {
                condition_id,
                winning_outcome: outcome,
                total_votes: (votes_for_outcome as u64),
            });

            // Resolve the condition
            condition_registry::resolve_condition(
                &create_resolver_signer(process_address),
                condition_address,
                outcome,
            );
        };
    }

    // ============================================================================
    // OPTIMISTIC RESOLUTION (UMA-style)
    // ============================================================================

    /// Initialize optimistic resolution for a condition
    public fun init_optimistic_resolution(
        condition_id: ConditionId,
        bond_amount: u64,
        dispute_period_seconds: u64,
        registry_address: address,
    ): address acquires ResolutionRegistry {
        let registry = borrow_global_mut<ResolutionRegistry>(registry_address);
        let condition_id_value = pm_engine_types::condition_id_value(&condition_id);

        let registry_signer = object::generate_signer_for_extending(&registry.extend_ref);

        let seed = create_resolution_seed(condition_id_value);
        let constructor_ref = object::create_named_object(&registry_signer, seed);
        let process_signer = object::generate_signer(&constructor_ref);
        let process_address = signer::address_of(&process_signer);

        move_to(&process_signer, OptimisticResolution {
            condition_id,
            proposal: option::none(),
            bond_amount,
            dispute_period_seconds,
            is_finalized: false,
            winning_outcome: option::none(),
        });

        smart_table::add(&mut registry.processes, condition_id_value, process_address);

        process_address
    }

    /// Submit an optimistic resolution proposal
    public entry fun submit_proposal(
        proposer: &signer,
        condition_id: u64,
        proposed_outcome: u64,
        process_address: address,
    ) acquires OptimisticResolution {
        let proposer_addr = signer::address_of(proposer);
        let resolution = borrow_global_mut<OptimisticResolution>(process_address);

        // Verify not finalized
        assert!(!resolution.is_finalized, E_ALREADY_RESOLVED);

        // Verify no existing proposal (or implement replacement logic)
        assert!(option::is_none(&resolution.proposal), E_ALREADY_RESOLVED);

        // TODO: Transfer bond from proposer to escrow

        let now = timestamp::now_seconds();
        let proposal = ResolutionProposal {
            proposed_outcome,
            proposer: proposer_addr,
            proposed_at: now,
            bond_amount: resolution.bond_amount,
        };

        resolution.proposal = option::some(proposal);

        event::emit(OptimisticProposalSubmitted {
            condition_id,
            proposer: proposer_addr,
            proposed_outcome,
            bond_amount: resolution.bond_amount,
            dispute_deadline: now + resolution.dispute_period_seconds,
        });
    }

    /// Dispute an optimistic resolution proposal
    public entry fun dispute_proposal(
        disputer: &signer,
        condition_id: u64,
        counter_outcome: u64,
        process_address: address,
    ) acquires OptimisticResolution {
        let disputer_addr = signer::address_of(disputer);
        let resolution = borrow_global_mut<OptimisticResolution>(process_address);

        // Verify not finalized
        assert!(!resolution.is_finalized, E_ALREADY_RESOLVED);

        // Verify there's a proposal to dispute
        assert!(option::is_some(&resolution.proposal), E_NO_PROPOSAL);

        let proposal = option::borrow(&resolution.proposal);
        let now = timestamp::now_seconds();

        // Verify within dispute period
        let dispute_deadline = proposal.proposed_at + resolution.dispute_period_seconds;
        assert!(now < dispute_deadline, E_DISPUTE_PERIOD_ENDED);

        // TODO: Transfer bond from disputer to escrow
        // TODO: Escalate to external arbitration (committee, UMA DVM, etc.)

        event::emit(OptimisticProposalDisputed {
            condition_id,
            disputer: disputer_addr,
            disputed_outcome: proposal.proposed_outcome,
            counter_outcome,
            bond_amount: resolution.bond_amount,
        });
    }

    /// Finalize optimistic resolution after dispute period
    public entry fun finalize_optimistic(
        condition_id: u64,
        process_address: address,
        condition_address: address,
    ) acquires OptimisticResolution {
        let resolution = borrow_global_mut<OptimisticResolution>(process_address);

        // Verify not finalized
        assert!(!resolution.is_finalized, E_ALREADY_RESOLVED);

        // Verify there's a proposal
        assert!(option::is_some(&resolution.proposal), E_NO_PROPOSAL);

        let proposal = option::borrow(&resolution.proposal);
        let now = timestamp::now_seconds();

        // Verify dispute period has ended
        let dispute_deadline = proposal.proposed_at + resolution.dispute_period_seconds;
        assert!(now >= dispute_deadline, E_DISPUTE_PERIOD_NOT_ENDED);

        let winning_outcome = proposal.proposed_outcome;

        // Finalize
        resolution.is_finalized = true;
        resolution.winning_outcome = option::some(winning_outcome);

        event::emit(OptimisticResolutionFinalized {
            condition_id,
            winning_outcome,
            was_disputed: false,
        });

        // Resolve the condition
        condition_registry::resolve_condition(
            &create_resolver_signer(process_address),
            condition_address,
            winning_outcome,
        );

        // TODO: Return bond to proposer
    }

    // ============================================================================
    // ORACLE RESOLUTION (Pyth, Switchboard)
    // ============================================================================

    /// Resolve using Pyth price feed
    /// This would be called by an automation service that monitors Pyth
    public entry fun resolve_with_pyth_price(
        _resolver: &signer,
        _condition_id: u64,
        _price_feed_id: vector<u8>,
        _threshold_price: u64,
        _condition_address: address,
    ) {
        // TODO: Integrate with Pyth price feeds
        // 1. Get latest price from Pyth
        // 2. Compare against threshold
        // 3. Determine winning outcome
        // 4. Resolve condition
        abort 0 // Placeholder
    }

    /// Resolve using Switchboard oracle
    public entry fun resolve_with_switchboard(
        _resolver: &signer,
        _condition_id: u64,
        _aggregator_address: address,
        _condition_address: address,
    ) {
        // TODO: Integrate with Switchboard
        abort 0 // Placeholder
    }

    // ============================================================================
    // VIEW FUNCTIONS
    // ============================================================================

    #[view]
    /// Get committee resolution status
    public fun get_committee_status(
        process_address: address,
    ): (bool, Option<u64>, u64) acquires CommitteeResolution {
        let resolution = borrow_global<CommitteeResolution>(process_address);
        (
            resolution.is_finalized,
            resolution.winning_outcome,
            resolution.required_signatures,
        )
    }

    #[view]
    /// Get optimistic resolution status
    public fun get_optimistic_status(
        process_address: address,
    ): (bool, Option<u64>, u64, u64) acquires OptimisticResolution {
        let resolution = borrow_global<OptimisticResolution>(process_address);
        (
            resolution.is_finalized,
            resolution.winning_outcome,
            resolution.bond_amount,
            resolution.dispute_period_seconds,
        )
    }

    // ============================================================================
    // INTERNAL FUNCTIONS
    // ============================================================================

    /// Create seed for resolution process object
    fun create_resolution_seed(condition_id: u64): vector<u8> {
        let seed = b"RESOLUTION_";
        let id_bytes = std::bcs::to_bytes(&condition_id);
        vector::append(&mut seed, id_bytes);
        seed
    }

    /// Create a resolver signer (placeholder)
    fun create_resolver_signer(_process_address: address): signer {
        // This would need proper implementation using ExtendRef
        abort 0 // Placeholder
    }
}
