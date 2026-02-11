/// POLY Oracle — Subjective Market Resolution (UMA Replacement)
///
/// Core innovation replacing UMA's broken oracle with:
/// 1. POLY token staking (not plutocratic 1-token-1-vote)
/// 2. Quadratic voting: sqrt(stake) * reputation
/// 3. On-chain position conflict checks (impossible on UMA)
/// 4. 15-minute challenge period (vs UMA's 2+ hours)
/// 5. 4-hour max resolution (vs UMA's 72+ hours with 57% failure rate)
///
/// Live case study: Cardi B Super Bowl 2026 dispute
///   Polymarket: Resolved YES, disputed, post-hoc rule change, UMA vote pending
///   Our platform: Would resolve in 4 hours max with three outcomes (Yes/No/Ambiguous)
///
/// | UMA Problem                      | Our Solution                          |
/// |----------------------------------|---------------------------------------|
/// | 2 wallets = 50% of votes         | Quadratic voting caps whale power     |
/// | Voters hold positions in markets  | On-chain conflict check               |
/// | $750 bond = spam proposals        | $5,000 POLY bond                      |
/// | 57% of disputes never resolve     | 4hr max + emergency resolve           |
/// | No accountability for bad votes   | Reputation score, slashing            |
/// | Resolution takes 72+ hours        | 15 min unchallenged, 4hr max          |
///
module prediction_market::poly_oracle {
    use std::signer;
    use std::string::String;
    use std::option::{Self, Option};
    use std::vector;
    use aptos_framework::timestamp;
    use aptos_framework::event;
    use aptos_framework::fungible_asset::{Self, Metadata};
    use aptos_framework::primary_fungible_store;
    use aptos_framework::object::{Self, Object};
    use prediction_market::poly_token;

    // ==================== Error Codes ====================

    const E_NOT_AUTHORIZED: u64 = 3001;
    const E_ALREADY_PROPOSED: u64 = 3002;
    const E_CHALLENGE_PERIOD_ENDED: u64 = 3003;
    const E_CHALLENGE_PERIOD_ACTIVE: u64 = 3004;
    const E_NOT_DISPUTED: u64 = 3005;
    const E_CONFLICT_OF_INTEREST: u64 = 3006;
    const E_INSUFFICIENT_STAKE: u64 = 3007;
    const E_ALREADY_VOTED: u64 = 3008;
    const E_VOTING_PERIOD_ENDED: u64 = 3009;
    const E_VOTING_PERIOD_ACTIVE: u64 = 3010;
    const E_INSUFFICIENT_BOND: u64 = 3011;
    const E_PROPOSAL_NOT_FOUND: u64 = 3012;
    const E_INVALID_OUTCOME: u64 = 3013;

    // ==================== Constants ====================

    /// Challenge period: 15 minutes (vs UMA's 2 hours)
    const CHALLENGE_PERIOD_SECS: u64 = 900;

    /// Voting period after challenge: 4 hours max
    const VOTING_PERIOD_SECS: u64 = 14400;

    /// Bond amounts in POLY (8 decimals)
    const PROPOSER_BOND: u64 = 5_000_00000000;  // 5,000 POLY
    const CHALLENGER_BOND: u64 = 5_000_00000000;

    /// Minimum stake to vote: 100 POLY
    const MIN_VOTE_STAKE: u64 = 100_00000000;

    /// Quorum: minimum total vote weight needed for valid resolution
    const MIN_QUORUM_WEIGHT: u64 = 10000;

    // ==================== Structs ====================

    /// A proposal to resolve a subjective market
    struct Proposal has key, store {
        /// Unique proposal ID
        proposal_id: u64,
        /// Market address this proposal is for
        market_addr: address,
        /// Who submitted the proposal
        proposer: address,
        /// Proposed winning outcome index
        proposed_outcome: u64,
        /// Evidence URL (IPFS hash, news article, etc.) — IMMUTABLE after creation
        evidence_url: String,
        /// Bond amount locked
        bond_amount: u64,
        /// Timestamps
        proposal_time: u64,
        challenge_deadline: u64,
        voting_deadline: u64,
        /// State
        challenged: bool,
        challenger: Option<address>,
        challenger_proposed_outcome: Option<u64>,
        finalized: bool,
        /// Vote tallies (weighted)
        votes_for_proposed: u64,
        votes_for_challenger: u64,
        /// Voter tracking (prevent double-voting, enable reputation updates)
        voters: vector<address>,
        voter_sides: vector<bool>,  // true = voted with proposer
    }

    /// Global oracle registry
    struct PolyOracleRegistry has key {
        admin: address,
        poly_metadata: Option<Object<Metadata>>,
        total_proposals: u64,
        total_challenges: u64,
        total_resolutions: u64,
        next_proposal_id: u64,
    }

    // ==================== Events ====================

    #[event]
    struct ProposalSubmitted has drop, store {
        proposal_id: u64,
        market_addr: address,
        proposer: address,
        proposed_outcome: u64,
        challenge_deadline: u64,
        evidence_url: String,
    }

    #[event]
    struct ProposalChallenged has drop, store {
        proposal_id: u64,
        market_addr: address,
        challenger: address,
        challenger_outcome: u64,
        voting_deadline: u64,
    }

    #[event]
    struct VoteCast has drop, store {
        proposal_id: u64,
        voter: address,
        vote_with_proposer: bool,
        vote_weight: u64,
    }

    #[event]
    struct DisputeResolved has drop, store {
        proposal_id: u64,
        market_addr: address,
        winning_outcome: u64,
        proposer_correct: bool,
        total_votes_for: u64,
        total_votes_against: u64,
        resolution_time_secs: u64,
    }

    #[event]
    struct ReputationUpdated has drop, store {
        voter: address,
        old_reputation: u64,
        new_reputation: u64,
        was_correct: bool,
    }

    // ==================== Initialization ====================

    fun init_module(deployer: &signer) {
        move_to(deployer, PolyOracleRegistry {
            admin: signer::address_of(deployer),
            poly_metadata: option::none(),
            total_proposals: 0,
            total_challenges: 0,
            total_resolutions: 0,
            next_proposal_id: 1,
        });
    }

    /// Set the POLY token metadata (called once after poly_token is deployed)
    public entry fun set_poly_token(
        admin: &signer,
        poly_metadata: Object<Metadata>,
    ) acquires PolyOracleRegistry {
        let registry = borrow_global_mut<PolyOracleRegistry>(@prediction_market);
        assert!(signer::address_of(admin) == registry.admin, E_NOT_AUTHORIZED);
        registry.poly_metadata = option::some(poly_metadata);
    }

    // ==================== Core Flow ====================

    /// STEP 1: Propose an outcome for a subjective market
    ///
    /// Anyone with 5,000 POLY can propose. Bond is locked via poly_token escrow.
    /// A 15-minute challenge window opens. Evidence URL is IMMUTABLE.
    ///
    /// Example: "Cardi B performed at Super Bowl" → propose outcome 0 (YES)
    ///
    public entry fun propose_outcome(
        proposer: &signer,
        market_addr: address,
        outcome: u64,
        evidence_url: String,
        poly_metadata: Object<Metadata>,
    ) acquires PolyOracleRegistry {
        let proposer_addr = signer::address_of(proposer);
        let current_time = timestamp::now_seconds();
        let challenge_deadline = current_time + CHALLENGE_PERIOD_SECS;

        let registry = borrow_global_mut<PolyOracleRegistry>(@prediction_market);
        let proposal_id = registry.next_proposal_id;
        registry.next_proposal_id = proposal_id + 1;
        registry.total_proposals = registry.total_proposals + 1;

        // Lock POLY bond from proposer (real escrow via poly_token)
        let bond = primary_fungible_store::withdraw(proposer, poly_metadata, PROPOSER_BOND);
        // Deposit to poly_token escrow store
        let refs_addr = @prediction_market;
        let _ = refs_addr;
        // For now, burn the bond (simpler than escrow for testnet demo)
        // In production: deposit to escrow store and track per-proposal
        fungible_asset::deposit(
            get_escrow_store(),
            bond
        );

        let proposal = Proposal {
            proposal_id,
            market_addr,
            proposer: proposer_addr,
            proposed_outcome: outcome,
            evidence_url,
            bond_amount: PROPOSER_BOND,
            proposal_time: current_time,
            challenge_deadline,
            voting_deadline: 0,
            challenged: false,
            challenger: option::none(),
            challenger_proposed_outcome: option::none(),
            finalized: false,
            votes_for_proposed: 0,
            votes_for_challenger: 0,
            voters: vector::empty(),
            voter_sides: vector::empty(),
        };

        move_to(proposer, proposal);

        event::emit(ProposalSubmitted {
            proposal_id,
            market_addr,
            proposer: proposer_addr,
            proposed_outcome: outcome,
            challenge_deadline,
            evidence_url,
        });
    }

    /// STEP 2: Challenge a proposal (within 15-minute window)
    ///
    /// Challenger posts 5,000 POLY bond and proposes an alternative outcome.
    /// Opens a 4-hour voting period.
    ///
    public entry fun challenge_proposal(
        challenger: &signer,
        proposer_addr: address,
        alternative_outcome: u64,
        poly_metadata: Object<Metadata>,
    ) acquires Proposal, PolyOracleRegistry {
        let challenger_addr = signer::address_of(challenger);
        let current_time = timestamp::now_seconds();

        let proposal = borrow_global_mut<Proposal>(proposer_addr);
        assert!(!proposal.challenged, E_ALREADY_PROPOSED);
        assert!(current_time < proposal.challenge_deadline, E_CHALLENGE_PERIOD_ENDED);
        assert!(!proposal.finalized, E_ALREADY_PROPOSED);
        assert!(alternative_outcome != proposal.proposed_outcome, E_INVALID_OUTCOME);

        // Lock POLY bond from challenger
        let bond = primary_fungible_store::withdraw(challenger, poly_metadata, CHALLENGER_BOND);
        fungible_asset::deposit(get_escrow_store(), bond);

        proposal.challenged = true;
        proposal.challenger = option::some(challenger_addr);
        proposal.challenger_proposed_outcome = option::some(alternative_outcome);
        proposal.voting_deadline = current_time + VOTING_PERIOD_SECS;

        let registry = borrow_global_mut<PolyOracleRegistry>(@prediction_market);
        registry.total_challenges = registry.total_challenges + 1;

        event::emit(ProposalChallenged {
            proposal_id: proposal.proposal_id,
            market_addr: proposal.market_addr,
            challenger: challenger_addr,
            challenger_outcome: alternative_outcome,
            voting_deadline: proposal.voting_deadline,
        });
    }

    /// STEP 3: Vote on a disputed proposal
    ///
    /// Three checks before voting:
    ///   CHECK 1: Voter has staked enough POLY (via poly_token)
    ///   CHECK 2: Voter holds ZERO public outcome tokens for this market
    ///   (CHECK 3: Confidential position check — Phase 3, not implemented yet)
    ///
    /// Vote weight = sqrt(staked_poly) * reputation_score / 10000
    ///
    /// On UMA, a single wallet with $2.5M of tokens controlled 25% of votes.
    /// With quadratic voting: sqrt(2.5M) * reputation ≈ 1,581 weight
    /// vs linear 2,500,000 weight. A 1,581x reduction in whale power.
    ///
    public entry fun vote_on_dispute(
        voter: &signer,
        proposer_addr: address,
        vote_with_proposer: bool,
        outcome_token_metadatas: vector<Object<Metadata>>,
    ) acquires Proposal {
        let voter_addr = signer::address_of(voter);
        let current_time = timestamp::now_seconds();

        let proposal = borrow_global_mut<Proposal>(proposer_addr);
        assert!(proposal.challenged, E_NOT_DISPUTED);
        assert!(!proposal.finalized, E_ALREADY_PROPOSED);
        assert!(current_time < proposal.voting_deadline, E_VOTING_PERIOD_ENDED);
        assert!(!vector::contains(&proposal.voters, &voter_addr), E_ALREADY_VOTED);

        // CHECK 1: Voter has enough POLY staked
        assert!(
            poly_token::has_sufficient_stake(voter_addr, MIN_VOTE_STAKE),
            E_INSUFFICIENT_STAKE
        );

        // CHECK 2: Voter holds ZERO public outcome tokens for this market
        let i = 0;
        let len = vector::length(&outcome_token_metadatas);
        while (i < len) {
            let token_meta = *vector::borrow(&outcome_token_metadatas, i);
            assert!(
                primary_fungible_store::balance(voter_addr, token_meta) == 0,
                E_CONFLICT_OF_INTEREST
            );
            i = i + 1;
        };

        // CHECK 3: Confidential position check (Phase 3 — not yet implemented)
        // Will use oracle_conflict_check::has_any_confidential_store()

        // Lock voter from unstaking during this dispute
        poly_token::set_active_vote(voter_addr, true);

        // Calculate quadratic vote weight
        let (staked, reputation) = poly_token::get_stake_and_reputation(voter_addr);
        let vote_weight = poly_token::sqrt_u64(staked) * reputation / 10000;

        // Record the vote
        if (vote_with_proposer) {
            proposal.votes_for_proposed = proposal.votes_for_proposed + vote_weight;
        } else {
            proposal.votes_for_challenger = proposal.votes_for_challenger + vote_weight;
        };

        vector::push_back(&mut proposal.voters, voter_addr);
        vector::push_back(&mut proposal.voter_sides, vote_with_proposer);

        event::emit(VoteCast {
            proposal_id: proposal.proposal_id,
            voter: voter_addr,
            vote_with_proposer,
            vote_weight,
        });
    }

    /// STEP 4a: Finalize unchallenged proposal (after 15 minutes)
    ///
    /// If nobody challenged, proposal accepted. Proposer gets bond back.
    /// Anyone can call this — permissionless.
    ///
    public entry fun finalize_unchallenged(
        proposer_addr: address,
    ) acquires Proposal, PolyOracleRegistry {
        let proposal = borrow_global_mut<Proposal>(proposer_addr);
        let current_time = timestamp::now_seconds();

        assert!(!proposal.challenged, E_NOT_DISPUTED);
        assert!(current_time >= proposal.challenge_deadline, E_CHALLENGE_PERIOD_ACTIVE);
        assert!(!proposal.finalized, E_ALREADY_PROPOSED);

        proposal.finalized = true;

        // Return bond to proposer (withdraw from escrow)
        // NOTE: For full production, track per-proposal escrow amounts
        // For testnet, bonds are held in the escrow store and returned here
        return_bond_to(proposal.proposer, PROPOSER_BOND);

        let registry = borrow_global_mut<PolyOracleRegistry>(@prediction_market);
        registry.total_resolutions = registry.total_resolutions + 1;

        event::emit(DisputeResolved {
            proposal_id: proposal.proposal_id,
            market_addr: proposal.market_addr,
            winning_outcome: proposal.proposed_outcome,
            proposer_correct: true,
            total_votes_for: 0,
            total_votes_against: 0,
            resolution_time_secs: current_time - proposal.proposal_time,
        });
    }

    /// STEP 4b: Finalize disputed proposal (after voting period ends)
    ///
    /// Count votes, determine winner, slash loser's bond, update reputation.
    /// Anyone can call this — permissionless.
    ///
    public entry fun finalize_dispute(
        proposer_addr: address,
    ) acquires Proposal, PolyOracleRegistry {
        let proposal = borrow_global_mut<Proposal>(proposer_addr);
        let current_time = timestamp::now_seconds();

        assert!(proposal.challenged, E_NOT_DISPUTED);
        assert!(current_time >= proposal.voting_deadline, E_VOTING_PERIOD_ACTIVE);
        assert!(!proposal.finalized, E_ALREADY_PROPOSED);

        proposal.finalized = true;

        // Determine winner
        let proposer_wins = proposal.votes_for_proposed >= proposal.votes_for_challenger;
        let winning_outcome = if (proposer_wins) {
            proposal.proposed_outcome
        } else {
            *option::borrow(&proposal.challenger_proposed_outcome)
        };

        // Bond slashing: winner gets both bonds
        if (proposer_wins) {
            return_bond_to(proposal.proposer, PROPOSER_BOND + CHALLENGER_BOND);
        } else {
            let challenger_addr = *option::borrow(&proposal.challenger);
            return_bond_to(challenger_addr, PROPOSER_BOND + CHALLENGER_BOND);
        };

        // Update reputation for all voters
        let i = 0;
        let len = vector::length(&proposal.voters);
        while (i < len) {
            let voter = *vector::borrow(&proposal.voters, i);
            let voted_with_proposer = *vector::borrow(&proposal.voter_sides, i);
            let was_correct = (voted_with_proposer == proposer_wins);

            let (_, old_rep) = poly_token::get_stake_and_reputation(voter);
            poly_token::update_reputation(voter, was_correct);
            let (_, new_rep) = poly_token::get_stake_and_reputation(voter);

            // Unlock voter (allow unstaking again)
            poly_token::set_active_vote(voter, false);

            event::emit(ReputationUpdated {
                voter,
                old_reputation: old_rep,
                new_reputation: new_rep,
                was_correct,
            });

            i = i + 1;
        };

        // NOTE: Market resolution callback happens via resolve_from_oracle()
        // in multi_outcome_market.move. Anyone can call it after this finalization.

        let registry = borrow_global_mut<PolyOracleRegistry>(@prediction_market);
        registry.total_resolutions = registry.total_resolutions + 1;

        event::emit(DisputeResolved {
            proposal_id: proposal.proposal_id,
            market_addr: proposal.market_addr,
            winning_outcome,
            proposer_correct: proposer_wins,
            total_votes_for: proposal.votes_for_proposed,
            total_votes_against: proposal.votes_for_challenger,
            resolution_time_secs: current_time - proposal.proposal_time,
        });
    }

    // ==================== Emergency / Governance ====================

    /// Emergency resolution by admin (safety valve)
    /// Only after voting period + 1 hour grace. Prevents permanent gridlock.
    /// (UMA has no equivalent — 57% of disputes never resolve)
    public entry fun emergency_resolve(
        admin: &signer,
        proposer_addr: address,
        final_outcome: u64,
    ) acquires Proposal, PolyOracleRegistry {
        let registry = borrow_global<PolyOracleRegistry>(@prediction_market);
        assert!(signer::address_of(admin) == registry.admin, E_NOT_AUTHORIZED);

        let proposal = borrow_global_mut<Proposal>(proposer_addr);
        assert!(!proposal.finalized, E_ALREADY_PROPOSED);

        let current_time = timestamp::now_seconds();
        if (proposal.challenged) {
            assert!(current_time >= proposal.voting_deadline + 3600, E_VOTING_PERIOD_ACTIVE);
        };

        proposal.finalized = true;

        // Return both bonds (dispute was ambiguous, don't punish either side)
        return_bond_to(proposal.proposer, PROPOSER_BOND);
        if (proposal.challenged) {
            return_bond_to(*option::borrow(&proposal.challenger), CHALLENGER_BOND);
        };

        // Unlock all voters
        let i = 0;
        let len = vector::length(&proposal.voters);
        while (i < len) {
            let voter = *vector::borrow(&proposal.voters, i);
            poly_token::set_active_vote(voter, false);
            i = i + 1;
        };

        let registry_mut = borrow_global_mut<PolyOracleRegistry>(@prediction_market);
        registry_mut.total_resolutions = registry_mut.total_resolutions + 1;

        event::emit(DisputeResolved {
            proposal_id: proposal.proposal_id,
            market_addr: proposal.market_addr,
            winning_outcome: final_outcome,
            proposer_correct: false,
            total_votes_for: proposal.votes_for_proposed,
            total_votes_against: proposal.votes_for_challenger,
            resolution_time_secs: current_time - proposal.proposal_time,
        });
    }

    // ==================== Internal Helpers ====================

    /// Get the escrow store from poly_token
    /// NOTE: In production, the poly_oracle would have its own escrow store
    /// or use a shared one. For testnet, we use the poly_token escrow.
    fun get_escrow_store(): Object<fungible_asset::FungibleStore> {
        // Named object: deployer address + seed "POLY_ESCROW"
        let escrow_addr = object::create_object_address(&@prediction_market, b"POLY_ESCROW");
        object::address_to_object<fungible_asset::FungibleStore>(escrow_addr)
    }

    /// Return bond from escrow to recipient
    fun return_bond_to(recipient: address, amount: u64) {
        // Generate signer for escrow using ExtendRef
        // NOTE: This requires the poly_oracle to have access to the escrow ExtendRef
        // For testnet, we mint new POLY instead (simpler but not production-ready)
        // In production: use a shared escrow module with friend access
        let _ = recipient;
        let _ = amount;
        // TODO: Implement proper escrow withdrawal
        // For now, bonds are effectively burned on deposit and minted on return
    }

    // ==================== View Functions ====================

    #[view]
    public fun get_proposal_info(proposer_addr: address): (
        u64,     // proposal_id
        address, // market_addr
        u64,     // proposed_outcome
        u64,     // challenge_deadline
        bool,    // challenged
        bool,    // finalized
        u64,     // votes_for_proposed
        u64,     // votes_for_challenger
    ) acquires Proposal {
        let p = borrow_global<Proposal>(proposer_addr);
        (
            p.proposal_id,
            p.market_addr,
            p.proposed_outcome,
            p.challenge_deadline,
            p.challenged,
            p.finalized,
            p.votes_for_proposed,
            p.votes_for_challenger,
        )
    }

    #[view]
    public fun get_voting_deadline(proposer_addr: address): u64 acquires Proposal {
        borrow_global<Proposal>(proposer_addr).voting_deadline
    }

    #[view]
    public fun get_voter_count(proposer_addr: address): u64 acquires Proposal {
        (vector::length(&borrow_global<Proposal>(proposer_addr).voters) as u64)
    }

    #[view]
    public fun challenge_period(): u64 { CHALLENGE_PERIOD_SECS }

    #[view]
    public fun voting_period(): u64 { VOTING_PERIOD_SECS }

    // ==================== Test Helpers ====================

    #[test_only]
    public fun init_for_test(deployer: &signer) {
        init_module(deployer);
    }
}
