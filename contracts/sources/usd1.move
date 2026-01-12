/// USD1 Stablecoin - World Liberty Financial USD for high-TPS prediction market demos
///
/// WHY THIS EXISTS:
/// Using APT as collateral causes 356:1 state contention because every APT transfer
/// writes to global `coin::PairedCoinType` and `coin::PairedFungibleAssetRefs` state.
/// This custom FA avoids that bottleneck, enabling 10,000+ TPS.
///
/// FEATURES:
/// - Standard Fungible Asset (no coin:: module overhead)
/// - Open minting (anyone can mint for demo purposes)
/// - 8 decimals (APT-compatible for zero code changes)
/// - Uses ConcurrentSupply for parallel minting
/// - USD1-branded to match World Liberty Financial stablecoin
///
/// USAGE:
/// 1. Deploy this module
/// 2. Call initialize() once to create the token
/// 3. Users call mint() to get tokens for testing
/// 4. Use USD1 metadata address as collateral in prediction markets
///
module prediction_market::usd1 {
    use std::string::{Self, String};
    use std::signer;
    use std::option;
    use aptos_framework::object::{Self, Object, ExtendRef};
    use aptos_framework::fungible_asset::{Self, Metadata, MintRef, BurnRef, TransferRef};
    use aptos_framework::primary_fungible_store;
    use aptos_framework::event;

    // ==================== Error Codes ====================

    const E_NOT_INITIALIZED: u64 = 1;
    const E_ALREADY_INITIALIZED: u64 = 2;
    const E_ZERO_AMOUNT: u64 = 3;

    // ==================== Constants ====================

    /// Token decimals (8 for APT compatibility - zero code changes needed)
    const DECIMALS: u8 = 8;

    /// Seed for the token object
    const TOKEN_SEED: vector<u8> = b"USD1_STABLECOIN_V1";

    // ==================== Structs ====================

    /// Token capabilities stored at the metadata object
    struct TokenRefs has key {
        /// Mint capability
        mint_ref: MintRef,
        /// Burn capability
        burn_ref: BurnRef,
        /// Transfer capability
        transfer_ref: TransferRef,
        /// Extension ref for signer generation
        extend_ref: ExtendRef,
    }

    /// Global registry to track the token metadata address
    struct TokenRegistry has key {
        /// The metadata object address
        metadata_address: address,
    }

    // ==================== Events ====================

    #[event]
    struct TokenInitialized has drop, store {
        metadata_address: address,
        name: String,
        symbol: String,
        decimals: u8,
    }

    #[event]
    struct TokensMinted has drop, store {
        recipient: address,
        amount: u64,
    }

    #[event]
    struct TokensBurned has drop, store {
        from: address,
        amount: u64,
    }

    // ==================== Initialization ====================

    /// Initialize the USD1 Stablecoin token
    /// Can only be called once by the deployer
    public entry fun initialize(deployer: &signer) {
        let deployer_addr = signer::address_of(deployer);
        assert!(!exists<TokenRegistry>(deployer_addr), E_ALREADY_INITIALIZED);

        // Create the token object with a named seed for deterministic address
        let constructor_ref = object::create_named_object(deployer, TOKEN_SEED);
        let token_signer = object::generate_signer(&constructor_ref);
        let metadata_address = signer::address_of(&token_signer);

        // Create the fungible asset with primary store enabled
        // This allows automatic store creation for users
        primary_fungible_store::create_primary_store_enabled_fungible_asset(
            &constructor_ref,
            option::none(), // No max supply (unlimited for demo)
            string::utf8(b"USD1 Stablecoin"),
            string::utf8(b"USD1"),
            DECIMALS,
            string::utf8(b"https://assets.panora.exchange/tokens/aptos/USD1.png"), // USD1 icon
            string::utf8(b"https://worldlibertyfinancial.com"), // World Liberty Financial
        );

        // Generate and store capabilities
        let mint_ref = fungible_asset::generate_mint_ref(&constructor_ref);
        let burn_ref = fungible_asset::generate_burn_ref(&constructor_ref);
        let transfer_ref = fungible_asset::generate_transfer_ref(&constructor_ref);
        let extend_ref = object::generate_extend_ref(&constructor_ref);

        // Store refs at the token object
        move_to(&token_signer, TokenRefs {
            mint_ref,
            burn_ref,
            transfer_ref,
            extend_ref,
        });

        // Store registry at deployer for easy lookup
        move_to(deployer, TokenRegistry {
            metadata_address,
        });

        event::emit(TokenInitialized {
            metadata_address,
            name: string::utf8(b"USD1 Stablecoin"),
            symbol: string::utf8(b"USD1"),
            decimals: DECIMALS,
        });
    }

    // ==================== Public Functions ====================

    /// Mint tokens to any address (open for demo purposes)
    /// In production, this would be restricted to authorized minters
    public entry fun mint(
        _minter: &signer, // Anyone can mint in demo mode
        recipient: address,
        amount: u64,
    ) acquires TokenRegistry, TokenRefs {
        assert!(amount > 0, E_ZERO_AMOUNT);

        let registry = borrow_global<TokenRegistry>(@prediction_market);
        let refs = borrow_global<TokenRefs>(registry.metadata_address);

        // Mint tokens
        let tokens = fungible_asset::mint(&refs.mint_ref, amount);

        // Deposit to recipient (creates store automatically if needed)
        primary_fungible_store::deposit(recipient, tokens);

        event::emit(TokensMinted {
            recipient,
            amount,
        });
    }

    /// Mint tokens to self (convenience function)
    public entry fun mint_to_self(
        minter: &signer,
        amount: u64,
    ) acquires TokenRegistry, TokenRefs {
        mint(minter, signer::address_of(minter), amount);
    }

    /// Burn tokens from sender
    public entry fun burn(
        owner: &signer,
        amount: u64,
    ) acquires TokenRegistry, TokenRefs {
        assert!(amount > 0, E_ZERO_AMOUNT);

        let registry = borrow_global<TokenRegistry>(@prediction_market);
        let refs = borrow_global<TokenRefs>(registry.metadata_address);
        let metadata = get_metadata_internal(registry.metadata_address);

        let owner_addr = signer::address_of(owner);

        // Withdraw and burn
        let tokens = primary_fungible_store::withdraw(owner, metadata, amount);
        fungible_asset::burn(&refs.burn_ref, tokens);

        event::emit(TokensBurned {
            from: owner_addr,
            amount,
        });
    }

    /// Transfer tokens (standard transfer, but without coin:: overhead)
    public entry fun transfer(
        sender: &signer,
        recipient: address,
        amount: u64,
    ) acquires TokenRegistry {
        assert!(amount > 0, E_ZERO_AMOUNT);

        let metadata = get_metadata();
        let tokens = primary_fungible_store::withdraw(sender, metadata, amount);
        primary_fungible_store::deposit(recipient, tokens);
    }

    // ==================== View Functions ====================

    #[view]
    /// Get the token metadata object
    public fun get_metadata(): Object<Metadata> acquires TokenRegistry {
        let registry = borrow_global<TokenRegistry>(@prediction_market);
        get_metadata_internal(registry.metadata_address)
    }

    #[view]
    /// Get the token metadata address (use this for collateral in markets)
    public fun get_metadata_address(): address acquires TokenRegistry {
        borrow_global<TokenRegistry>(@prediction_market).metadata_address
    }

    #[view]
    /// Get balance of an address
    public fun balance(owner: address): u64 acquires TokenRegistry {
        let metadata = get_metadata();
        primary_fungible_store::balance(owner, metadata)
    }

    #[view]
    /// Get total supply
    public fun total_supply(): u128 acquires TokenRegistry {
        let metadata = get_metadata();
        option::get_with_default(&fungible_asset::supply(metadata), 0u128)
    }

    #[view]
    /// Check if initialized
    public fun is_initialized(): bool {
        exists<TokenRegistry>(@prediction_market)
    }

    // ==================== Internal Functions ====================

    fun get_metadata_internal(metadata_address: address): Object<Metadata> {
        object::address_to_object<Metadata>(metadata_address)
    }

    // ==================== Test Helpers ====================

    #[test_only]
    public fun init_for_test(deployer: &signer) {
        initialize(deployer);
    }
}
