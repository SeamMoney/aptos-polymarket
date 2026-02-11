/// POLY Oracle — Subjective Market Resolution (UMA Replacement)
///
/// PSEUDO-CODE / DESIGN DRAFT — Not production-ready
///
/// This is the core innovation. Replaces UMA's broken oracle with:
/// 1. POLY token staking (not plutocratic 1-token-1-vote)
/// 2. Quadratic voting: sqrt(stake) * reputation
/// 3. On-chain position conflict checks (impossible on UMA)
/// 4. Confidential position verification via ZK proofs
/// 5. 15-minute challenge period (vs UMA's 2+ hours)
/// 6. 4-hour max resolution (vs UMA's 72+ hours with 57% failure rate)
///
/// UMA's failure modes and how we fix them:
///
/// | UMA Problem                      | Our Solution                          |
/// |----------------------------------|---------------------------------------|
/// | 2 wallets = 50% of votes         | Quadratic voting caps whale power     |
/// | Voters hold positions in markets  | On-chain conflict check (+ ZK proof)  |
/// | $750 bond = spam proposals        | $5,000 POLY bond                      |
/// | 57% of disputes never resolve     | 4hr max, committee MUST resolve       |
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
    use aptos_framework::object::Object;
    // PSEUDO: These would be real imports
    // use prediction_market::poly_token;
    // use prediction_market::multi_outcome_market;
    // use aptos_experimental::confidential_asset;

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
    const E_HAS_CONFIDENTIAL_POSITION: u64 = 3014;

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

    /// Reputation change per correct/incorrect vote (basis points)
    const REPUTATION_GAIN: u64 = 100;   // +1% for correct vote
    const REPUTATION_LOSS: u64 = 300;   // -3% for incorrect vote (asymmetric — wrong hurts more)

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
        /// Evidence URL (IPFS hash, news article, etc.)
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
        /// Vote tallies per outcome
        /// PSEUDO: In real impl, this would be a vector<VoteTally>
        votes_for_proposed: u64,    // weighted votes supporting proposer
        votes_for_challenger: u64,  // weighted votes supporting challenger
        /// List of voters (to prevent double-voting and update reputation)
        voters: vector<address>,
        voter_sides: vector<bool>,  // true = voted with proposer
    }

    /// Global oracle registry
    struct PolyOracleRegistry has key {
        /// Admin
        admin: address,
        /// POLY token metadata address
        poly_metadata: Option<Object<Metadata>>,
        /// Stats
        total_proposals: u64,
        total_challenges: u64,
        total_resolutions: u64,
        /// Proposal counter for unique IDs
        next_proposal_id: u64,
        /// Active proposals by market (market_addr -> proposer_addr)
        /// PSEUDO: would use Table for O(1) lookup
        // active_proposals: Table<address, address>,
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
        conflict_check_passed: bool,
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
    /// Anyone with 5,000 POLY can propose. The bond is locked in escrow.
    /// A 15-minute challenge window opens.
    ///
    /// Example: "Cardi B performed at Super Bowl" → propose outcome 0 (YES)
    ///
    public entry fun propose_outcome(
        proposer: &signer,
        market_addr: address,
        outcome: u64,
        evidence_url: String,
    ) acquires PolyOracleRegistry {
        let proposer_addr = signer::address_of(proposer);
        let current_time = timestamp::now_seconds();
        let challenge_deadline = current_time + CHALLENGE_PERIOD_SECS;

        let registry = borrow_global_mut<PolyOracleRegistry>(@prediction_market);
        let proposal_id = registry.next_proposal_id;
        registry.next_proposal_id = proposal_id + 1;
        registry.total_proposals = registry.total_proposals + 1;

        // PSEUDO: Lock POLY bond from proposer
        // let poly_meta = *option::borrow(&registry.poly_metadata);
        // let bond = primary_fungible_store::withdraw(proposer, poly_meta, PROPOSER_BOND);
        // fungible_asset::deposit(escrow_store, bond);

        // PSEUDO: Verify market exists and is past end_time
        // let (_, _, _, _, end_time, resolved, _, _) = multi_outcome_market::get_multi_market_info(market_addr);
        // assert!(!resolved, E_ALREADY_PROPOSED);
        // assert!(current_time >= end_time, E_MARKET_STILL_ACTIVE);

        let proposal = Proposal {
            proposal_id,
            market_addr,
            proposer: proposer_addr,
            proposed_outcome: outcome,
            evidence_url,
            bond_amount: PROPOSER_BOND,
            proposal_time: current_time,
            challenge_deadline,
            voting_deadline: 0, // Set when challenged
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
    /// Challenger must also post 5,000 POLY bond and propose an alternative outcome.
    /// This opens a 4-hour voting period.
    ///
    public entry fun challenge_proposal(
        challenger: &signer,
        proposer_addr: address,
        alternative_outcome: u64,
    ) acquires Proposal, PolyOracleRegistry {
        let challenger_addr = signer::address_of(challenger);
        let current_time = timestamp::now_seconds();

        let proposal = borrow_global_mut<Proposal>(proposer_addr);
        assert!(!proposal.challenged, E_ALREADY_PROPOSED);
        assert!(current_time < proposal.challenge_deadline, E_CHALLENGE_PERIOD_ENDED);
        assert!(!proposal.finalized, E_ALREADY_PROPOSED);
        assert!(alternative_outcome != proposal.proposed_outcome, E_INVALID_OUTCOME);

        // PSEUDO: Lock POLY bond from challenger
        // let poly_meta = *option::borrow(&registry.poly_metadata);
        // let bond = primary_fungible_store::withdraw(challenger, poly_meta, CHALLENGER_BOND);
        // fungible_asset::deposit(escrow_store, bond);

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
    /// THIS IS THE KEY INNOVATION — three checks before voting:
    ///
    /// CHECK 1: Voter has staked enough POLY
    /// CHECK 2: Voter holds ZERO public outcome tokens for this market
    /// CHECK 3: Voter holds ZERO confidential outcome tokens for this market
    ///
    /// Vote weight = sqrt(staked_poly) * reputation_score / 10000
    ///
    /// On UMA, a single wallet with $2.5M of tokens controlled 25% of votes.
    /// With quadratic voting, that same amount only gets sqrt(2.5M) ≈ 1,581 weight
    /// vs a linear 2,500,000 weight. A 1,581x reduction in whale power.
    ///
    public entry fun vote_on_dispute(
        voter: &signer,
        proposer_addr: address,
        vote_with_proposer: bool,
    ) acquires Proposal {
        let voter_addr = signer::address_of(voter);
        let current_time = timestamp::now_seconds();

        let proposal = borrow_global_mut<Proposal>(proposer_addr);
        assert!(proposal.challenged, E_NOT_DISPUTED);
        assert!(!proposal.finalized, E_ALREADY_PROPOSED);
        assert!(current_time < proposal.voting_deadline, E_VOTING_PERIOD_ENDED);

        // CHECK: Voter hasn't already voted on this proposal
        assert!(!vector::contains(&proposal.voters, &voter_addr), E_ALREADY_VOTED);

        // ====================================================================
        // CHECK 1: Voter has enough POLY staked
        // ====================================================================
        // PSEUDO:
        // let (staked, reputation, _, _) = poly_token::get_staker_info(voter_addr);
        // assert!(staked >= MIN_VOTE_STAKE, E_INSUFFICIENT_STAKE);
        let staked: u64 = 0;       // PSEUDO: read from Staker
        let reputation: u64 = 5000; // PSEUDO: read from Staker

        // ====================================================================
        // CHECK 2: Voter holds ZERO PUBLIC outcome tokens for this market
        // ====================================================================
        // This checks the regular fungible_asset balance for each outcome token
        //
        // PSEUDO:
        // let market_info = multi_outcome_market::get_market_info(proposal.market_addr);
        // let outcome_addrs = market_info.outcome_addresses;
        // for each outcome_addr in outcome_addrs {
        //     let outcome_meta = object::address_to_object<Metadata>(outcome_addr);
        //     let balance = primary_fungible_store::balance(voter_addr, outcome_meta);
        //     assert!(balance == 0, E_CONFLICT_OF_INTEREST);
        // }

        // ====================================================================
        // CHECK 3: Voter holds ZERO CONFIDENTIAL outcome tokens for this market
        // ====================================================================
        //
        // Three approaches, from simplest to most private:
        //
        // APPROACH A (Simple — used for demo):
        //   Check if voter has a confidential store registered for any outcome token.
        //   If no store registered → they definitely have zero.
        //   If store registered → they must have withdrawn everything first.
        //
        //   for each outcome_addr in outcome_addrs {
        //       let outcome_meta = object::address_to_object<Metadata>(outcome_addr);
        //       assert!(
        //           !confidential_asset::has_confidential_asset_store(voter_addr, outcome_meta),
        //           E_HAS_CONFIDENTIAL_POSITION
        //       );
        //   }
        //
        // APPROACH B (Better — voter proves zero):
        //   Voter submits a ZK proof that their confidential balance = 0 for each
        //   outcome token. Uses Bulletproofs range proof where the committed value
        //   is provably 0. This doesn't reveal anything about other balances.
        //
        //   for each outcome_addr in outcome_addrs {
        //       let zero_proof = voter_provided_proofs[i];
        //       confidential_proof::verify_zero_balance(voter_addr, outcome_meta, zero_proof);
        //   }
        //
        // APPROACH C (Best — auditor attestation):
        //   The platform auditor (who holds the global auditor DK) attests that
        //   the voter's confidential balance is zero. The voter doesn't need to
        //   reveal anything. The auditor signs an attestation that gets verified
        //   on-chain.
        //
        //   for each outcome_addr in outcome_addrs {
        //       let attestation = auditor_attestations[i];
        //       verify_auditor_attestation(voter_addr, outcome_meta, attestation);
        //   }
        //
        // DESIGN DECISION: For testnet demo, use Approach A. It's simple and
        // demonstrates the concept. Voters must not have confidential stores
        // for the market's outcome tokens. In production, upgrade to Approach B.

        // ====================================================================
        // CALCULATE VOTE WEIGHT (Quadratic)
        // ====================================================================
        //
        // UMA: vote_weight = staked_tokens (linear → whales dominate)
        //
        // Ours: vote_weight = sqrt(staked_poly) * reputation / 10000
        //
        // Example with 1M POLY staked, 80% reputation:
        //   UMA-style:  1,000,000 weight
        //   Our style:  sqrt(1,000,000) * 8000 / 10000 = 1000 * 0.8 = 800 weight
        //
        // Example with 100 POLY staked, 95% reputation:
        //   UMA-style:  100 weight
        //   Our style:  sqrt(100) * 9500 / 10000 = 10 * 0.95 = 9.5 weight
        //
        // The ratio between whale and small staker:
        //   UMA:  1,000,000 / 100 = 10,000x
        //   Ours: 800 / 9.5 = 84x
        //
        // 119x reduction in whale advantage.
        //
        let vote_weight = sqrt_u64(staked) * reputation / 10000;

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
            conflict_check_passed: true,
        });
    }

    /// STEP 4a: Finalize unchallenged proposal (after 15 minutes)
    ///
    /// If nobody challenged within 15 minutes, the proposal is accepted.
    /// Proposer gets bond back. Market is resolved.
    /// Anyone can call this — it's permissionless.
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

        // PSEUDO: Return bond to proposer
        // return_bond(proposal.proposer, proposal.bond_amount);

        // PSEUDO: Callback to resolve the market
        // multi_outcome_market::resolve_from_oracle(proposal.market_addr, proposal.proposed_outcome);

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
    /// Anyone can call this — it's permissionless.
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

        // ====================================================================
        // BOND SLASHING
        // ====================================================================
        // Winner gets their bond back + loser's bond
        //
        // PSEUDO:
        // if (proposer_wins) {
        //     // Return proposer bond + give them challenger's bond
        //     return_bond(proposal.proposer, PROPOSER_BOND + CHALLENGER_BOND);
        // } else {
        //     // Return challenger bond + give them proposer's bond
        //     let challenger_addr = *option::borrow(&proposal.challenger);
        //     return_bond(challenger_addr, PROPOSER_BOND + CHALLENGER_BOND);
        // }

        // ====================================================================
        // REPUTATION UPDATES
        // ====================================================================
        // Every voter's reputation is updated based on whether they were correct
        //
        // PSEUDO:
        // let i = 0;
        // while (i < vector::length(&proposal.voters)) {
        //     let voter = *vector::borrow(&proposal.voters, i);
        //     let voted_with_proposer = *vector::borrow(&proposal.voter_sides, i);
        //     let was_correct = (voted_with_proposer == proposer_wins);
        //
        //     let staker = borrow_global_mut<Staker>(voter);
        //     if (was_correct) {
        //         staker.reputation_score = min(10000, staker.reputation_score + REPUTATION_GAIN);
        //         staker.correct_votes = staker.correct_votes + 1;
        //     } else {
        //         staker.reputation_score = saturating_sub(staker.reputation_score, REPUTATION_LOSS);
        //     };
        //     staker.votes_cast = staker.votes_cast + 1;
        //
        //     event::emit(ReputationUpdated { voter, old_rep, new_rep, was_correct });
        //     i = i + 1;
        // }

        // ====================================================================
        // RESOLVE THE MARKET
        // ====================================================================
        // PSEUDO: Callback to multi_outcome_market
        // multi_outcome_market::resolve_from_oracle(proposal.market_addr, winning_outcome);

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
    /// Only used if voting fails to reach quorum within 4 hours
    /// This is a LAST RESORT — existence of this prevents permanent gridlock
    /// (UMA has no equivalent, which is why 57% of disputes never resolve)
    public entry fun emergency_resolve(
        admin: &signer,
        proposer_addr: address,
        final_outcome: u64,
    ) acquires Proposal, PolyOracleRegistry {
        let registry = borrow_global<PolyOracleRegistry>(@prediction_market);
        assert!(signer::address_of(admin) == registry.admin, E_NOT_AUTHORIZED);

        let proposal = borrow_global_mut<Proposal>(proposer_addr);
        assert!(!proposal.finalized, E_ALREADY_PROPOSED);

        // Can only emergency resolve after voting period + 1 hour grace
        let current_time = timestamp::now_seconds();
        if (proposal.challenged) {
            assert!(current_time >= proposal.voting_deadline + 3600, E_VOTING_PERIOD_ACTIVE);
        };

        proposal.finalized = true;

        // PSEUDO: Return both bonds (dispute was ambiguous, don't punish either side)
        // return_bond(proposal.proposer, PROPOSER_BOND);
        // if (proposal.challenged) {
        //     return_bond(*option::borrow(&proposal.challenger), CHALLENGER_BOND);
        // }

        // PSEUDO: Resolve market
        // multi_outcome_market::resolve_from_oracle(proposal.market_addr, final_outcome);

        let registry_mut = borrow_global_mut<PolyOracleRegistry>(@prediction_market);
        registry_mut.total_resolutions = registry_mut.total_resolutions + 1;

        event::emit(DisputeResolved {
            proposal_id: proposal.proposal_id,
            market_addr: proposal.market_addr,
            winning_outcome: final_outcome,
            proposer_correct: false, // emergency = neither side "wins"
            total_votes_for: proposal.votes_for_proposed,
            total_votes_against: proposal.votes_for_challenger,
            resolution_time_secs: current_time - proposal.proposal_time,
        });
    }

    // ==================== Math Helpers ====================

    /// Integer square root (Babylonian method)
    /// Used for quadratic vote weighting
    fun sqrt_u64(x: u64): u64 {
        if (x == 0) return 0;
        let z = x;
        let y = (z + 1) / 2;
        while (y < z) {
            z = y;
            y = (z + x / z) / 2;
        };
        z
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
