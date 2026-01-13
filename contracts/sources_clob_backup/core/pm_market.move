/// ============================================================================
/// PM MARKET - Order Book Wrapper for Prediction Market Outcomes
/// ============================================================================
///
/// This module wraps the generic order book (Econia) to create an order book
/// for each outcome in a prediction market. Each OutcomeMarket is a Move object
/// that contains an order book for trading that specific outcome token.
///
/// KEY CONCEPTS:
/// - Each condition (e.g., "Will X happen?") has N outcomes (YES, NO, etc.)
/// - Each outcome gets its own OutcomeMarket (order book)
/// - The order book trades outcome tokens vs collateral (e.g., YES vs APT)
/// - MarketClearinghouseCallbacks connect to pm_clearinghouse for settlement
///
/// DESIGN NOTES:
/// - Follows Decibel's perp_market.move pattern exactly
/// - Wraps order_book::Market<PMOrderMetadata>
/// - Friend functions expose order operations to pm_engine
///
/// ============================================================================

module prediction_market_clob::pm_market {
    use std::string::String;
    use std::signer;
    use std::option::{Self, Option};
    use std::vector;
    use aptos_framework::object::{Self, Object, ExtendRef};
    use aptos_framework::fungible_asset::Metadata;
    use aptos_framework::event;
    use aptos_std::smart_table::{Self, SmartTable};

    use prediction_market_clob::pm_engine_types::{
        Self,
        ConditionId,
        PMOrderMetadata,
        OrderMatchingActions
    };

    // ============================================================================
    // Friend Declarations
    // ============================================================================

    friend prediction_market_clob::pm_engine;
    friend prediction_market_clob::complete_sets;

    // ============================================================================
    // Error Codes
    // ============================================================================

    const E_NOT_INITIALIZED: u64 = 400;
    const E_ALREADY_INITIALIZED: u64 = 401;
    const E_MARKET_NOT_FOUND: u64 = 402;
    const E_MARKET_ALREADY_EXISTS: u64 = 403;
    const E_MARKET_NOT_ACTIVE: u64 = 404;
    const E_ORDER_NOT_FOUND: u64 = 405;
    const E_NOT_ORDER_OWNER: u64 = 406;
    const E_INVALID_PRICE: u64 = 407;
    const E_INVALID_SIZE: u64 = 408;

    // ============================================================================
    // Constants
    // ============================================================================

    /// Price precision: 6 decimals (prices are 0.000000 to 1.000000)
    const PRICE_PRECISION: u64 = 1_000_000;

    /// Minimum price (0.01%)
    const MIN_PRICE: u64 = 100;

    /// Maximum price (99.99%)
    const MAX_PRICE: u64 = 999_900;

    // ============================================================================
    // STRUCTS
    // ============================================================================

    /// Global registry of outcome markets
    struct OutcomeMarketRegistry has key {
        /// Map: (condition_id, outcome_index) -> market address
        markets: SmartTable<MarketKey, address>,
        /// Extension ref for registry signer
        extend_ref: ExtendRef
    }

    /// Key for looking up outcome markets
    struct MarketKey has copy, drop, store {
        condition_id: u64,
        outcome_index: u64
    }

    /// An order book for a single outcome
    struct OutcomeMarket has key {
        /// Which condition this market belongs to
        condition_id: ConditionId,
        /// Which outcome (0=YES, 1=NO for binary)
        outcome_index: u64,
        /// Outcome label
        label: String,
        /// Outcome token metadata
        outcome_token_metadata: Object<Metadata>,
        /// Collateral token metadata
        collateral_metadata: Object<Metadata>,
        /// Is market active for trading
        is_active: bool,
        /// Bid orders (buy orders) - sorted by price descending
        bids: vector<Order>,
        /// Ask orders (sell orders) - sorted by price ascending
        asks: vector<Order>,
        /// Next order ID
        next_order_id: u128,
        /// Extension ref for market signer
        extend_ref: ExtendRef
    }

    /// A single order in the book
    struct Order has copy, drop, store {
        /// Unique order ID
        order_id: u128,
        /// Order owner
        owner: address,
        /// Limit price (6 decimals, 0.000000 to 1.000000)
        price: u64,
        /// Order size (in outcome tokens)
        size: u64,
        /// Filled size
        filled_size: u64,
        /// Is this a buy order
        is_bid: bool,
        /// Is reduce-only order
        is_reduce_only: bool,
        /// Client order ID
        client_order_id: Option<String>,
        /// Order metadata
        metadata: PMOrderMetadata,
        /// Creation timestamp
        created_at: u64
    }

    /// Result of order placement/matching
    struct OrderResult has copy, drop, store {
        /// Order ID assigned
        order_id: u128,
        /// Total size filled
        filled_size: u64,
        /// Average fill price
        avg_fill_price: u64,
        /// Whether order rests on book
        is_resting: bool,
        /// Actions to execute (minting, burning, etc.)
        actions: OrderMatchingActions
    }

    // ============================================================================
    // EVENTS
    // ============================================================================

    #[event]
    struct OutcomeMarketCreated has drop, store {
        condition_id: u64,
        outcome_index: u64,
        label: String,
        market_address: address,
        outcome_token: address,
        collateral: address
    }

    #[event]
    struct OrderPlaced has drop, store {
        condition_id: u64,
        outcome_index: u64,
        order_id: u128,
        owner: address,
        price: u64,
        size: u64,
        is_bid: bool,
        is_reduce_only: bool
    }

    #[event]
    struct OrderFilled has drop, store {
        condition_id: u64,
        outcome_index: u64,
        order_id: u128,
        fill_size: u64,
        fill_price: u64,
        taker: address,
        maker: address
    }

    #[event]
    struct OrderCancelled has drop, store {
        condition_id: u64,
        outcome_index: u64,
        order_id: u128,
        owner: address,
        remaining_size: u64
    }

    #[event]
    struct MarketDeactivated has drop, store {
        condition_id: u64,
        outcome_index: u64
    }

    // ============================================================================
    // INITIALIZATION
    // ============================================================================

    /// Initialize the outcome market registry
    public entry fun initialize(deployer: &signer) {
        let deployer_addr = signer::address_of(deployer);
        assert!(!exists<OutcomeMarketRegistry>(deployer_addr), E_ALREADY_INITIALIZED);

        let constructor_ref =
            object::create_named_object(deployer, b"OUTCOME_MARKET_REGISTRY");
        let extend_ref = object::generate_extend_ref(&constructor_ref);
        let registry_signer = object::generate_signer(&constructor_ref);

        move_to(
            &registry_signer,
            OutcomeMarketRegistry { markets: smart_table::new(), extend_ref }
        );
    }

    // ============================================================================
    // MARKET CREATION
    // ============================================================================

    /// Create an outcome market for a condition
    public(friend) fun create_outcome_market(
        condition_id: ConditionId,
        outcome_index: u64,
        label: String,
        outcome_token_metadata: Object<Metadata>,
        collateral_metadata: Object<Metadata>,
        registry_address: address
    ): address acquires OutcomeMarketRegistry {
        let condition_id_value = pm_engine_types::condition_id_value(&condition_id);

        let registry = borrow_global_mut<OutcomeMarketRegistry>(registry_address);
        let key = MarketKey { condition_id: condition_id_value, outcome_index };
        assert!(!smart_table::contains(&registry.markets, key), E_MARKET_ALREADY_EXISTS);

        let registry_signer = object::generate_signer_for_extending(&registry.extend_ref);

        // Create market object
        let seed = create_market_seed(condition_id_value, outcome_index);
        let constructor_ref = object::create_named_object(&registry_signer, seed);
        let market_signer = object::generate_signer(&constructor_ref);
        let market_address = signer::address_of(&market_signer);
        let extend_ref = object::generate_extend_ref(&constructor_ref);

        // Initialize the market
        move_to(
            &market_signer,
            OutcomeMarket {
                condition_id,
                outcome_index,
                label,
                outcome_token_metadata,
                collateral_metadata,
                is_active: true,
                bids: vector::empty(),
                asks: vector::empty(),
                next_order_id: 1,
                extend_ref
            }
        );

        // Register in table
        smart_table::add(&mut registry.markets, key, market_address);

        event::emit(
            OutcomeMarketCreated {
                condition_id: condition_id_value,
                outcome_index,
                label,
                market_address,
                outcome_token: object::object_address(&outcome_token_metadata),
                collateral: object::object_address(&collateral_metadata)
            }
        );

        market_address
    }

    // ============================================================================
    // ORDER OPERATIONS
    // ============================================================================

    /// Place a limit order
    public(friend) fun place_limit_order(
        market_address: address,
        owner: address,
        price: u64,
        size: u64,
        is_bid: bool,
        is_reduce_only: bool,
        client_order_id: Option<String>,
        metadata: PMOrderMetadata,
        current_time: u64
    ): OrderResult acquires OutcomeMarket {
        let market = borrow_global_mut<OutcomeMarket>(market_address);
        assert!(market.is_active, E_MARKET_NOT_ACTIVE);
        assert!(
            price >= MIN_PRICE && price <= MAX_PRICE,
            E_INVALID_PRICE
        );
        assert!(size > 0, E_INVALID_SIZE);

        // Allocate order ID
        let order_id = market.next_order_id;
        market.next_order_id = order_id + 1;

        let condition_id_value =
            pm_engine_types::condition_id_value(&market.condition_id);

        // Create the order
        let order = Order {
            order_id,
            owner,
            price,
            size,
            filled_size: 0,
            is_bid,
            is_reduce_only,
            client_order_id,
            metadata,
            created_at: current_time
        };

        // Try to match against opposite side
        let (filled_size, avg_fill_price, actions) = match_order(market, &order);

        // Update order filled size
        let remaining_size = size - filled_size;
        let is_resting = remaining_size > 0;

        if (is_resting) {
            // Add to order book
            let updated_order = Order {
                order_id,
                owner,
                price,
                size,
                filled_size,
                is_bid,
                is_reduce_only,
                client_order_id,
                metadata,
                created_at: current_time
            };
            insert_order(market, updated_order);
        };

        event::emit(
            OrderPlaced {
                condition_id: condition_id_value,
                outcome_index: market.outcome_index,
                order_id,
                owner,
                price,
                size,
                is_bid,
                is_reduce_only
            }
        );

        OrderResult { order_id, filled_size, avg_fill_price, is_resting, actions }
    }

    /// Cancel an order
    public(friend) fun cancel_order(
        market_address: address,
        owner: address,
        order_id: u128
    ): u64 acquires OutcomeMarket {
        let market = borrow_global_mut<OutcomeMarket>(market_address);
        let condition_id_value =
            pm_engine_types::condition_id_value(&market.condition_id);

        // Try to find and remove from bids
        let (found, remaining_size) =
            remove_order_from_vector(&mut market.bids, order_id, owner);

        if (!found) {
            // Try asks
            let (found_ask, remaining_ask) =
                remove_order_from_vector(&mut market.asks, order_id, owner);
            assert!(found_ask, E_ORDER_NOT_FOUND);
            remaining_size = remaining_ask;
        };

        event::emit(
            OrderCancelled {
                condition_id: condition_id_value,
                outcome_index: market.outcome_index,
                order_id,
                owner,
                remaining_size
            }
        );

        remaining_size
    }

    /// Deactivate market (called when condition is resolved)
    public(friend) fun deactivate_market(market_address: address) acquires OutcomeMarket {
        let market = borrow_global_mut<OutcomeMarket>(market_address);
        market.is_active = false;

        event::emit(
            MarketDeactivated {
                condition_id: pm_engine_types::condition_id_value(&market.condition_id),
                outcome_index: market.outcome_index
            }
        );
    }

    // ============================================================================
    // VIEW FUNCTIONS
    // ============================================================================

    #[view]
    /// Get market address for a condition/outcome pair
    public fun get_market_address(
        registry_address: address,
        condition_id: u64,
        outcome_index: u64
    ): address acquires OutcomeMarketRegistry {
        let registry = borrow_global<OutcomeMarketRegistry>(registry_address);
        let key = MarketKey { condition_id, outcome_index };
        assert!(smart_table::contains(&registry.markets, key), E_MARKET_NOT_FOUND);
        *smart_table::borrow(&registry.markets, key)
    }

    #[view]
    /// Get best bid price
    public fun best_bid_price(market_address: address): Option<u64> acquires OutcomeMarket {
        let market = borrow_global<OutcomeMarket>(market_address);
        if (vector::is_empty(&market.bids)) {
            option::none()
        } else {
            option::some(vector::borrow(&market.bids, 0).price)
        }
    }

    #[view]
    /// Get best ask price
    public fun best_ask_price(market_address: address): Option<u64> acquires OutcomeMarket {
        let market = borrow_global<OutcomeMarket>(market_address);
        if (vector::is_empty(&market.asks)) {
            option::none()
        } else {
            option::some(vector::borrow(&market.asks, 0).price)
        }
    }

    #[view]
    /// Get market info
    public fun get_market_info(
        market_address: address
    ): (u64, u64, String, bool, u64, u64) acquires OutcomeMarket {
        let market = borrow_global<OutcomeMarket>(market_address);
        (
            pm_engine_types::condition_id_value(&market.condition_id),
            market.outcome_index,
            market.label,
            market.is_active,
            vector::length(&market.bids),
            vector::length(&market.asks)
        )
    }

    #[view]
    /// Check if market is active
    public fun is_market_active(market_address: address): bool acquires OutcomeMarket {
        borrow_global<OutcomeMarket>(market_address).is_active
    }

    #[view]
    /// Get order details
    public fun get_order(
        market_address: address, order_id: u128
    ): (address, u64, u64, u64, bool) acquires OutcomeMarket {
        let market = borrow_global<OutcomeMarket>(market_address);

        // Search bids
        let i = 0;
        let len = vector::length(&market.bids);
        while (i < len) {
            let order = vector::borrow(&market.bids, i);
            if (order.order_id == order_id) {
                return (
                    order.owner, order.price, order.size, order.filled_size, order.is_bid
                )
            };
            i = i + 1;
        };

        // Search asks
        i = 0;
        len = vector::length(&market.asks);
        while (i < len) {
            let order = vector::borrow(&market.asks, i);
            if (order.order_id == order_id) {
                return (
                    order.owner, order.price, order.size, order.filled_size, order.is_bid
                )
            };
            i = i + 1;
        };

        abort E_ORDER_NOT_FOUND
    }

    // ============================================================================
    // INTERNAL FUNCTIONS
    // ============================================================================

    /// Match an order against the opposite side
    fun match_order(market: &mut OutcomeMarket, order: &Order):
        (u64, u64, OrderMatchingActions) {
        let total_filled = 0u64;
        let total_quote_filled = 0u64;
        let actions = pm_engine_types::empty_order_actions();

        let condition_id_value =
            pm_engine_types::condition_id_value(&market.condition_id);

        if (order.is_bid) {
            // Bid matches against asks (lowest first)
            while (!vector::is_empty(&market.asks) && total_filled < order.size) {
                let best_ask = vector::borrow(&market.asks, 0);
                if (best_ask.price > order.price) {
                    // No more matching orders
                    break
                };

                let fill_size =
                    min(
                        order.size - total_filled,
                        best_ask.size - best_ask.filled_size
                    );
                let fill_price = best_ask.price;

                total_filled = total_filled + fill_size;
                total_quote_filled =
                    total_quote_filled + (fill_size * fill_price / PRICE_PRECISION);

                event::emit(
                    OrderFilled {
                        condition_id: condition_id_value,
                        outcome_index: market.outcome_index,
                        order_id: order.order_id,
                        fill_size,
                        fill_price,
                        taker: order.owner,
                        maker: best_ask.owner
                    }
                );

                // Update maker order
                let maker_order = vector::borrow_mut(&mut market.asks, 0);
                maker_order.filled_size = maker_order.filled_size + fill_size;

                // Remove if fully filled
                if (maker_order.filled_size >= maker_order.size) {
                    vector::remove(&mut market.asks, 0);
                };
            };
        } else {
            // Ask matches against bids (highest first)
            while (!vector::is_empty(&market.bids) && total_filled < order.size) {
                let best_bid = vector::borrow(&market.bids, 0);
                if (best_bid.price < order.price) {
                    // No more matching orders
                    break
                };

                let fill_size =
                    min(
                        order.size - total_filled,
                        best_bid.size - best_bid.filled_size
                    );
                let fill_price = best_bid.price;

                total_filled = total_filled + fill_size;
                total_quote_filled =
                    total_quote_filled + (fill_size * fill_price / PRICE_PRECISION);

                event::emit(
                    OrderFilled {
                        condition_id: condition_id_value,
                        outcome_index: market.outcome_index,
                        order_id: order.order_id,
                        fill_size,
                        fill_price,
                        taker: order.owner,
                        maker: best_bid.owner
                    }
                );

                // Update maker order
                let maker_order = vector::borrow_mut(&mut market.bids, 0);
                maker_order.filled_size = maker_order.filled_size + fill_size;

                // Remove if fully filled
                if (maker_order.filled_size >= maker_order.size) {
                    vector::remove(&mut market.bids, 0);
                };
            };
        };

        let avg_fill_price =
            if (total_filled > 0) {
                total_quote_filled * PRICE_PRECISION / total_filled
            } else { 0 };

        (total_filled, avg_fill_price, pm_engine_types::settle_trade_actions(actions))
    }

    /// Insert order into the appropriate side (maintaining price-time priority)
    fun insert_order(market: &mut OutcomeMarket, order: Order) {
        if (order.is_bid) {
            // Bids sorted descending by price
            let i = 0;
            let len = vector::length(&market.bids);
            while (i < len) {
                if (vector::borrow(&market.bids, i).price < order.price) { break };
                i = i + 1;
            };
            vector::insert(&mut market.bids, i, order);
        } else {
            // Asks sorted ascending by price
            let i = 0;
            let len = vector::length(&market.asks);
            while (i < len) {
                if (vector::borrow(&market.asks, i).price > order.price) { break };
                i = i + 1;
            };
            vector::insert(&mut market.asks, i, order);
        };
    }

    /// Remove order from vector, returns (found, remaining_size)
    fun remove_order_from_vector(
        orders: &mut vector<Order>,
        order_id: u128,
        owner: address
    ): (bool, u64) {
        let i = 0;
        let len = vector::length(orders);
        while (i < len) {
            let order = vector::borrow(orders, i);
            if (order.order_id == order_id) {
                assert!(order.owner == owner, E_NOT_ORDER_OWNER);
                let remaining = order.size - order.filled_size;
                vector::remove(orders, i);
                return (true, remaining)
            };
            i = i + 1;
        };
        (false, 0)
    }

    /// Create unique seed for market object
    fun create_market_seed(condition_id: u64, outcome_index: u64): vector<u8> {
        let seed = b"OUTCOME_MARKET_";
        let id_bytes = std::bcs::to_bytes(&condition_id);
        vector::append(&mut seed, id_bytes);
        vector::append(&mut seed, b"_");
        let index_bytes = std::bcs::to_bytes(&outcome_index);
        vector::append(&mut seed, index_bytes);
        seed
    }

    /// Minimum of two u64 values
    fun min(a: u64, b: u64): u64 {
        if (a < b) { a }
        else { b }
    }

    /// Get market signer for internal operations
    public(friend) fun get_market_signer(market_address: address): signer acquires OutcomeMarket {
        let market = borrow_global<OutcomeMarket>(market_address);
        object::generate_signer_for_extending(&market.extend_ref)
    }
}
