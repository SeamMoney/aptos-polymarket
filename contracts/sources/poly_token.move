/// POLY Token — Governance & Staking Token for Subjective Market Resolution
///
/// PSEUDO-CODE / DESIGN DRAFT — Not production-ready
///
/// This replaces UMA's token. Key differences:
/// - On Aptos (not Ethereum) — no cross-chain complexity
/// - Used ONLY for oracle staking/voting, not as collateral
/// - Testnet: freely mintable for demo
/// - Mainnet: fixed supply, earned via accurate oracle participation
///
module prediction_market::poly_token {
    use std::string;
    use std::signer;
    use std::option;
    use aptos_framework::object::{Self, Object};
    use aptos_framework::fungible_asset::{Self, Metadata, MintRef, BurnRef, TransferRef};
    use aptos_framework::primary_fungible_store;

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

    /// Global token management — holds mint/burn/transfer refs
    struct PolyTokenRefs has key {
        mint_ref: MintRef,
        burn_ref: BurnRef,
        transfer_ref: TransferRef,
        /// Total minted so far
        total_minted: u64,
        /// Admin who can mint (testnet only)
        admin: address,
    }

    /// Staker record — tracks each POLY staker
    /// KEY DESIGN: This is where position tracking lives
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

    /// Create the POLY fungible asset
    fun init_module(deployer: &signer) {
        let constructor_ref = object::create_named_object(deployer, b"POLY_TOKEN");

        // Create the fungible asset
        primary_fungible_store::create_primary_store_enabled_fungible_asset(
            &constructor_ref,
            option::some((TOTAL_SUPPLY as u128)),  // max supply
            string::utf8(b"POLY"),
            string::utf8(b"POLY"),
            8, // decimals
            string::utf8(b""),  // icon
            string::utf8(b"https://polymarket-aptos.xyz"),  // project
        );

        // Store refs for minting/burning
        let mint_ref = fungible_asset::generate_mint_ref(&constructor_ref);
        let burn_ref = fungible_asset::generate_burn_ref(&constructor_ref);
        let transfer_ref = fungible_asset::generate_transfer_ref(&constructor_ref);

        move_to(deployer, PolyTokenRefs {
            mint_ref,
            burn_ref,
            transfer_ref,
            total_minted: 0,
            admin: signer::address_of(deployer),
        });

        // PSEUDO: Mint initial supply to deployer for distribution
        // let initial = fungible_asset::mint(&mint_ref, INITIAL_MINT);
        // primary_fungible_store::deposit(signer::address_of(deployer), initial);
    }

    // ==================== Staking ====================

    /// Stake POLY to become an oracle voter
    /// Minimum: 1,000 POLY
    public entry fun stake(
        staker: &signer,
        amount: u64,
        _poly_metadata: Object<Metadata>,
    ) {
        assert!(amount >= MIN_VOTER_STAKE, 1); // E_BELOW_MINIMUM_STAKE

        let staker_addr = signer::address_of(staker);

        // PSEUDO: Transfer POLY from staker to escrow
        // let tokens = primary_fungible_store::withdraw(staker, poly_metadata, amount);
        // fungible_asset::deposit(escrow_store, tokens);

        // Create or update staker record
        if (!exists<Staker>(staker_addr)) {
            move_to(staker, Staker {
                staked_amount: amount,
                reputation_score: 5000, // Start at 50%
                votes_cast: 0,
                correct_votes: 0,
                stake_time: 0, // PSEUDO: timestamp::now_seconds()
                active_vote: false,
            });
        } else {
            // PSEUDO: Add to existing stake
            // let s = borrow_global_mut<Staker>(staker_addr);
            // s.staked_amount = s.staked_amount + amount;
        }
    }

    /// Unstake POLY (with cooldown period)
    public entry fun unstake(
        staker: &signer,
        amount: u64,
        _poly_metadata: Object<Metadata>,
    ) {
        let staker_addr = signer::address_of(staker);
        assert!(exists<Staker>(staker_addr), 2); // E_NOT_STAKER

        // PSEUDO: Check not actively voting
        // let s = borrow_global<Staker>(staker_addr);
        // assert!(!s.active_vote, E_ACTIVE_VOTE);

        // PSEUDO: Check cooldown period (e.g., 7 days after last vote)
        // assert!(timestamp::now_seconds() > s.last_vote_time + COOLDOWN, E_COOLDOWN);

        // PSEUDO: Return POLY tokens
        // let tokens = fungible_asset::withdraw(escrow_signer, escrow_store, amount);
        // primary_fungible_store::deposit(staker_addr, tokens);

        // PSEUDO: Update staker record
        // s.staked_amount = s.staked_amount - amount;
        let _ = staker_addr;
        let _ = amount;
        let _ = staker;
    }

    // ==================== Testnet Helpers ====================

    /// Mint POLY for testing (admin only, testnet)
    public entry fun mint_for_testing(
        admin: &signer,
        recipient: address,
        amount: u64,
    ) acquires PolyTokenRefs {
        let refs = borrow_global_mut<PolyTokenRefs>(@prediction_market);
        assert!(signer::address_of(admin) == refs.admin, 3); // E_NOT_ADMIN

        let tokens = fungible_asset::mint(&refs.mint_ref, amount);
        primary_fungible_store::deposit(recipient, tokens);
        refs.total_minted = refs.total_minted + amount;
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
        // PSEUDO: sqrt not native in Move, would need math library
        // let weight = math::sqrt(s.staked_amount) * s.reputation_score / 10000;
        let _ = s;
        0 // PSEUDO: return calculated weight
    }

    #[view]
    public fun min_voter_stake(): u64 { MIN_VOTER_STAKE }

    #[view]
    public fun proposer_bond(): u64 { PROPOSER_BOND }
}
