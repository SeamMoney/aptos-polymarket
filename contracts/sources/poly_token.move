/// POLY Token — Governance & Staking Token for Subjective Market Resolution
///
/// Replaces UMA's token with key improvements:
/// - On Aptos (not Ethereum) — no cross-chain complexity
/// - Used ONLY for oracle staking/voting, not as collateral
/// - Quadratic voting: vote_weight = sqrt(stake) * reputation / 10000
/// - Testnet: freely mintable for demo
/// - Mainnet: fixed supply, earned via accurate oracle participation
///
module prediction_market::poly_token {
    use std::string;
    use std::signer;
    use std::option;
    use aptos_framework::object::{Self, Object, ExtendRef};
    use aptos_framework::fungible_asset::{Self, Metadata, FungibleStore, MintRef, BurnRef, TransferRef};
    use aptos_framework::primary_fungible_store;
    use aptos_framework::timestamp;

    // ==================== Error Codes ====================

    const E_BELOW_MINIMUM_STAKE: u64 = 4001;
    const E_NOT_STAKER: u64 = 4002;
    const E_NOT_ADMIN: u64 = 4003;
    const E_ACTIVE_VOTE: u64 = 4004;
    const E_INSUFFICIENT_STAKE: u64 = 4005;
    const E_ALREADY_INITIALIZED: u64 = 4006;

    // ==================== Constants ====================

    /// Total supply: 100M POLY (8 decimals)
    const TOTAL_SUPPLY: u64 = 100_000_000_00000000;

    /// Initial circulating: 10M POLY for testnet demo
    const INITIAL_MINT: u64 = 10_000_000_00000000;

    /// Minimum stake to become a voter: 1,000 POLY
    const MIN_VOTER_STAKE: u64 = 1_000_00000000;

    /// Proposer bond: 5,000 POLY (vs UMA's $750 in UMA tokens)
    const PROPOSER_BOND: u64 = 5_000_00000000;

    // ==================== Structs ====================

    /// Global token management — holds mint/burn/transfer refs + escrow store
    struct PolyTokenRefs has key {
        mint_ref: MintRef,
        burn_ref: BurnRef,
        transfer_ref: TransferRef,
        /// Escrow store for staked POLY (locked tokens live here)
        escrow_store: Object<FungibleStore>,
        /// ExtendRef for the escrow object (to generate signer for withdrawals)
        escrow_extend_ref: ExtendRef,
        /// Total minted so far
        total_minted: u64,
        /// Admin who can mint (testnet only)
        admin: address,
    }

    /// Staker record — tracks each POLY staker
    struct Staker has key {
        /// Amount of POLY staked
        staked_amount: u64,
        /// Reputation score (0-10000, basis points)
        /// Starts at 5000 (50%), goes up for correct votes, down for wrong
        reputation_score: u64,
        /// Total votes cast
        votes_cast: u64,
        /// Correct votes (used to calculate accuracy)
        correct_votes: u64,
        /// When staked (for minimum lock period)
        stake_time: u64,
        /// Whether this staker is currently voting on a dispute
        /// (prevents unstaking during active vote)
        active_vote: bool,
    }

    // ==================== Initialization ====================

    /// Create the POLY fungible asset and escrow store
    fun init_module(deployer: &signer) {
        let deployer_addr = signer::address_of(deployer);
        let constructor_ref = object::create_named_object(deployer, b"POLY_TOKEN");
        let token_signer = object::generate_signer(&constructor_ref);

        // Create the fungible asset
        primary_fungible_store::create_primary_store_enabled_fungible_asset(
            &constructor_ref,
            option::some((TOTAL_SUPPLY as u128)),
            string::utf8(b"POLY"),
            string::utf8(b"POLY"),
            8,
            string::utf8(b"https://raw.githubusercontent.com/SeamMoney/aptos-polymarket/main/public/images/poly-token.png"),
            string::utf8(b"https://polymarket.com"),
        );

        let mint_ref = fungible_asset::generate_mint_ref(&constructor_ref);
        let burn_ref = fungible_asset::generate_burn_ref(&constructor_ref);
        let transfer_ref = fungible_asset::generate_transfer_ref(&constructor_ref);

        // Create escrow store (staked POLY lives here)
        let metadata = object::address_to_object<Metadata>(signer::address_of(&token_signer));
        let escrow_constructor = object::create_named_object(deployer, b"POLY_ESCROW");
        let escrow_store = fungible_asset::create_store(&escrow_constructor, metadata);
        let escrow_extend_ref = object::generate_extend_ref(&escrow_constructor);

        // Mint initial supply to deployer for distribution
        let initial = fungible_asset::mint(&mint_ref, INITIAL_MINT);
        primary_fungible_store::deposit(deployer_addr, initial);

        move_to(deployer, PolyTokenRefs {
            mint_ref,
            burn_ref,
            transfer_ref,
            escrow_store,
            escrow_extend_ref,
            total_minted: INITIAL_MINT,
            admin: deployer_addr,
        });
    }

    // ==================== Staking ====================

    /// Stake POLY to become an oracle voter
    /// Minimum: 1,000 POLY
    public entry fun stake(
        staker: &signer,
        amount: u64,
        poly_metadata: Object<Metadata>,
    ) acquires PolyTokenRefs, Staker {
        assert!(amount >= MIN_VOTER_STAKE, E_BELOW_MINIMUM_STAKE);

        let staker_addr = signer::address_of(staker);
        let refs = borrow_global<PolyTokenRefs>(@prediction_market);

        // Transfer POLY from staker to escrow
        let tokens = primary_fungible_store::withdraw(staker, poly_metadata, amount);
        fungible_asset::deposit(refs.escrow_store, tokens);

        // Create or update staker record
        if (!exists<Staker>(staker_addr)) {
            move_to(staker, Staker {
                staked_amount: amount,
                reputation_score: 5000, // Start at 50%
                votes_cast: 0,
                correct_votes: 0,
                stake_time: timestamp::now_seconds(),
                active_vote: false,
            });
        } else {
            let s = borrow_global_mut<Staker>(staker_addr);
            s.staked_amount = s.staked_amount + amount;
        }
    }

    /// Unstake POLY
    public entry fun unstake(
        staker: &signer,
        amount: u64,
        _poly_metadata: Object<Metadata>,
    ) acquires PolyTokenRefs, Staker {
        let staker_addr = signer::address_of(staker);
        assert!(exists<Staker>(staker_addr), E_NOT_STAKER);

        let s = borrow_global_mut<Staker>(staker_addr);
        assert!(!s.active_vote, E_ACTIVE_VOTE);
        assert!(s.staked_amount >= amount, E_INSUFFICIENT_STAKE);

        // Withdraw from escrow and return to staker
        let refs = borrow_global<PolyTokenRefs>(@prediction_market);
        let escrow_signer = object::generate_signer_for_extending(&refs.escrow_extend_ref);
        let tokens = fungible_asset::withdraw(&escrow_signer, refs.escrow_store, amount);
        primary_fungible_store::deposit(staker_addr, tokens);

        s.staked_amount = s.staked_amount - amount;
    }

    // ==================== Oracle Integration ====================

    /// Called by poly_oracle to set active_vote flag (prevents unstaking during vote)
    public fun set_active_vote(staker_addr: address, active: bool) acquires Staker {
        let s = borrow_global_mut<Staker>(staker_addr);
        s.active_vote = active;
    }

    /// Called by poly_oracle to update reputation after vote resolution
    public fun update_reputation(
        voter_addr: address,
        was_correct: bool,
    ) acquires Staker {
        let s = borrow_global_mut<Staker>(voter_addr);
        let old_rep = s.reputation_score;

        if (was_correct) {
            // +1% for correct vote (cap at 10000 = 100%)
            s.reputation_score = if (old_rep + 100 > 10000) { 10000 } else { old_rep + 100 };
            s.correct_votes = s.correct_votes + 1;
        } else {
            // -3% for incorrect vote (floor at 0)
            s.reputation_score = if (old_rep >= 300) { old_rep - 300 } else { 0 };
        };
        s.votes_cast = s.votes_cast + 1;
    }

    /// Check if an address has enough stake to vote
    public fun has_sufficient_stake(voter_addr: address, min_stake: u64): bool acquires Staker {
        if (!exists<Staker>(voter_addr)) return false;
        borrow_global<Staker>(voter_addr).staked_amount >= min_stake
    }

    /// Get staked amount and reputation for vote weight calculation
    public fun get_stake_and_reputation(voter_addr: address): (u64, u64) acquires Staker {
        let s = borrow_global<Staker>(voter_addr);
        (s.staked_amount, s.reputation_score)
    }

    // ==================== Testnet Helpers ====================

    /// Mint POLY for testing (admin only, testnet)
    public entry fun mint_for_testing(
        admin: &signer,
        recipient: address,
        amount: u64,
    ) acquires PolyTokenRefs {
        let refs = borrow_global_mut<PolyTokenRefs>(@prediction_market);
        assert!(signer::address_of(admin) == refs.admin, E_NOT_ADMIN);

        let tokens = fungible_asset::mint(&refs.mint_ref, amount);
        primary_fungible_store::deposit(recipient, tokens);
        refs.total_minted = refs.total_minted + amount;
    }

    // ==================== Math Helpers ====================

    /// Integer square root (Babylonian method)
    public fun sqrt_u64(x: u64): u64 {
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
    public fun get_staker_info(staker_addr: address): (u64, u64, u64, u64) acquires Staker {
        let s = borrow_global<Staker>(staker_addr);
        (s.staked_amount, s.reputation_score, s.votes_cast, s.correct_votes)
    }

    #[view]
    public fun get_vote_weight(staker_addr: address): u64 acquires Staker {
        let s = borrow_global<Staker>(staker_addr);
        // Quadratic: sqrt(stake) * reputation / 10000
        sqrt_u64(s.staked_amount) * s.reputation_score / 10000
    }

    #[view]
    public fun is_staker(addr: address): bool {
        exists<Staker>(addr)
    }

    #[view]
    public fun min_voter_stake(): u64 { MIN_VOTER_STAKE }

    #[view]
    public fun proposer_bond(): u64 { PROPOSER_BOND }

    // ==================== Test Helpers ====================

    #[test_only]
    public fun init_for_test(deployer: &signer) {
        init_module(deployer);
    }
}
