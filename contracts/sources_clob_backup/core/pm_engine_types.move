/// ============================================================================
/// PM ENGINE TYPES - Order Metadata and Action Types for Prediction Markets
/// ============================================================================
///
/// This module defines the core data structures used throughout the prediction
/// market trading engine for order metadata, actions, and matching results.
///
/// KEY TYPES:
/// - ConditionId: Unique identifier for a prediction market (question)
/// - PMOrderMetadata: Attached to every order in Econia
/// - SingleOrderAction: Actions to take on orders (cancel, mint/burn sets)
/// - OrderMatchingActions: Batch of actions from trade settlement
/// - ResolutionState: Market state (Open, Resolved, Voided)
///
/// DESIGN NOTES:
/// - Follows Decibel's pattern for Econia integration
/// - PMOrderMetadata is the generic type parameter for Econia's Market<T>
/// - Actions are collected during matching and executed afterwards
///
/// ============================================================================

module prediction_market_clob::pm_engine_types {
    use std::option::{Self, Option};
    use std::string::String;
    use std::vector;
    use aptos_std::bcs;

    // ============================================================================
    // Friend Declarations
    // ============================================================================

    friend prediction_market_clob::condition_registry;
    friend prediction_market_clob::pm_clearinghouse;
    friend prediction_market_clob::pm_market;
    friend prediction_market_clob::pm_engine;
    friend prediction_market_clob::complete_sets;
    friend prediction_market_clob::collateral_vault;

    // ============================================================================
    // Constants
    // ============================================================================

    /// Price scale: prices are 0-100 with 6 decimals (0-100_000_000)
    const PRICE_SCALE: u64 = 1_000_000;

    /// Maximum number of outcomes per condition
    const MAX_OUTCOMES: u64 = 100;

    /// Minimum number of outcomes (binary market)
    const MIN_OUTCOMES: u64 = 2;

    // ============================================================================
    // Error Codes
    // ============================================================================

    const E_INVALID_OUTCOME_COUNT: u64 = 1;
    const E_INVALID_CONDITION_ID: u64 = 2;
    const E_CONDITION_NOT_FOUND: u64 = 3;
    const E_CONDITION_ALREADY_RESOLVED: u64 = 4;
    const E_CONDITION_NOT_RESOLVED: u64 = 5;
    const E_INVALID_OUTCOME_INDEX: u64 = 6;
    const E_MARKET_NOT_ACTIVE: u64 = 7;
    const E_INSUFFICIENT_COLLATERAL: u64 = 8;
    const E_INSUFFICIENT_TOKENS: u64 = 9;
    const E_INVALID_PRICE: u64 = 10;
    const E_NOT_AUTHORIZED: u64 = 11;
    const E_RESOLUTION_TIME_NOT_REACHED: u64 = 12;

    // ============================================================================
    // CORE TYPE DEFINITIONS
    // ============================================================================

    /// Unique identifier for a condition (prediction market question)
    /// Wraps a u64 for type safety
    struct ConditionId has copy, drop, store {
        value: u64,
    }

    /// Resolution state of a condition
    enum ResolutionState has copy, drop, store {
        /// Market is open for trading
        Open,
        /// Market has been resolved to a specific outcome
        Resolved { winning_outcome: u64 },
        /// Market was voided (all positions refunded)
        Voided,
    }

    /// How the condition will be resolved
    enum ResolutionSource has copy, drop, store {
        /// Resolved by market creator
        Creator,
        /// Resolved by specific oracle address
        Oracle { oracle_address: address },
        /// Resolved by multi-sig committee
        Committee {
            members: vector<address>,
            required_signatures: u64
        },
        /// UMA-style optimistic resolution with dispute period
        Optimistic {
            bond_amount: u64,
            dispute_period_seconds: u64
        },
    }

    // ============================================================================
    // ORDER METADATA - Attached to every Econia order
    // ============================================================================

    /// Order metadata attached to every order in Econia's order book
    /// This is the type parameter T in Market<T>
    enum PMOrderMetadata has copy, drop, store {
        /// Standard order
        V1 {
            /// Which condition (prediction market) this order is for
            condition_id: ConditionId,
            /// Which outcome (0=YES, 1=NO for binary)
            outcome_index: u64,
            /// Can only reduce position (sell tokens user already owns)
            is_reduce_only: bool,
            /// Optional client-assigned order ID for tracking
            client_order_id: Option<String>,
        }
    }

    // ============================================================================
    // ORDER ACTIONS - Collected during matching, executed afterwards
    // ============================================================================

    /// Container for a batch of order actions
    struct OrderActions has copy, drop, store {
        actions: vector<SingleOrderAction>,
    }

    /// Individual order action
    enum SingleOrderAction has copy, drop, store {
        /// Cancel an order
        CancelOrder {
            account: address,
            order_id: u128,
        },
        /// Reduce order size by delta
        ReduceOrderSize {
            account: address,
            order_id: u128,
            size_delta: u64,
        },
        /// Mint complete set for user (when seller doesn't have tokens)
        MintCompleteSet {
            account: address,
            condition_id: ConditionId,
            amount: u64,
        },
        /// Burn complete set for user (when user has all outcomes)
        BurnCompleteSet {
            account: address,
            condition_id: ConditionId,
            amount: u64,
        },
    }

    /// Wrapper for matching engine action results
    /// Distinguishes between settle trade and maker order placement contexts
    enum OrderMatchingActions has copy, drop, store {
        /// Actions generated during trade settlement
        SettleTradeMatchingActions {
            actions: OrderActions,
        },
        /// Actions generated when placing maker order
        PlaceMakerOrderActions {
            actions: OrderActions,
        },
    }

    // ============================================================================
    // CONDITION ID FUNCTIONS
    // ============================================================================

    /// Create a new ConditionId
    public fun new_condition_id(value: u64): ConditionId {
        ConditionId { value }
    }

    /// Get the raw value of a ConditionId
    public fun condition_id_value(id: &ConditionId): u64 {
        id.value
    }

    /// Check if two ConditionIds are equal
    public fun condition_id_equals(a: &ConditionId, b: &ConditionId): bool {
        a.value == b.value
    }

    // ============================================================================
    // RESOLUTION STATE FUNCTIONS
    // ============================================================================

    /// Check if condition is open for trading
    public fun is_open(state: &ResolutionState): bool {
        match (state) {
            ResolutionState::Open => true,
            _ => false,
        }
    }

    /// Check if condition is resolved
    public fun is_resolved(state: &ResolutionState): bool {
        match (state) {
            ResolutionState::Resolved { .. } => true,
            _ => false,
        }
    }

    /// Check if condition is voided
    public fun is_voided(state: &ResolutionState): bool {
        match (state) {
            ResolutionState::Voided => true,
            _ => false,
        }
    }

    /// Get winning outcome (panics if not resolved)
    public fun get_winning_outcome(state: &ResolutionState): u64 {
        match (state) {
            ResolutionState::Resolved { winning_outcome } => *winning_outcome,
            _ => abort E_CONDITION_NOT_RESOLVED,
        }
    }

    /// Create Open state
    public fun resolution_state_open(): ResolutionState {
        ResolutionState::Open
    }

    /// Create Resolved state
    public fun resolution_state_resolved(winning_outcome: u64): ResolutionState {
        ResolutionState::Resolved { winning_outcome }
    }

    /// Create Voided state
    public fun resolution_state_voided(): ResolutionState {
        ResolutionState::Voided
    }

    // ============================================================================
    // ORDER METADATA FUNCTIONS
    // ============================================================================

    /// Create new order metadata
    public fun new_order_metadata(
        condition_id: ConditionId,
        outcome_index: u64,
        is_reduce_only: bool,
        client_order_id: Option<String>,
    ): PMOrderMetadata {
        PMOrderMetadata::V1 {
            condition_id,
            outcome_index,
            is_reduce_only,
            client_order_id,
        }
    }

    /// Get condition ID from metadata
    public fun get_condition_id(metadata: &PMOrderMetadata): ConditionId {
        match (metadata) {
            PMOrderMetadata::V1 { condition_id, .. } => *condition_id,
        }
    }

    /// Get outcome index from metadata
    public fun get_outcome_index(metadata: &PMOrderMetadata): u64 {
        match (metadata) {
            PMOrderMetadata::V1 { outcome_index, .. } => *outcome_index,
        }
    }

    /// Check if order is reduce-only
    public fun is_reduce_only(metadata: &PMOrderMetadata): bool {
        match (metadata) {
            PMOrderMetadata::V1 { is_reduce_only, .. } => *is_reduce_only,
        }
    }

    /// Get client order ID
    public fun get_client_order_id(metadata: &PMOrderMetadata): Option<String> {
        match (metadata) {
            PMOrderMetadata::V1 { client_order_id, .. } => *client_order_id,
        }
    }

    /// Serialize metadata to bytes (for Econia callback)
    public fun serialize_metadata(metadata: &PMOrderMetadata): vector<u8> {
        bcs::to_bytes(metadata)
    }

    // ============================================================================
    // ORDER ACTIONS FUNCTIONS
    // ============================================================================

    /// Create empty order actions
    public fun empty_order_actions(): OrderActions {
        OrderActions { actions: vector::empty() }
    }

    /// Add action to order actions
    public fun add_action(actions: &mut OrderActions, action: SingleOrderAction) {
        vector::push_back(&mut actions.actions, action);
    }

    /// Get actions vector
    public fun get_actions(actions: &OrderActions): &vector<SingleOrderAction> {
        &actions.actions
    }

    /// Check if actions is empty
    public fun is_empty(actions: &OrderActions): bool {
        vector::is_empty(&actions.actions)
    }

    /// Create cancel order action
    public fun cancel_order_action(account: address, order_id: u128): SingleOrderAction {
        SingleOrderAction::CancelOrder { account, order_id }
    }

    /// Create reduce order size action
    public fun reduce_order_size_action(
        account: address,
        order_id: u128,
        size_delta: u64
    ): SingleOrderAction {
        SingleOrderAction::ReduceOrderSize { account, order_id, size_delta }
    }

    /// Create mint complete set action
    public fun mint_complete_set_action(
        account: address,
        condition_id: ConditionId,
        amount: u64,
    ): SingleOrderAction {
        SingleOrderAction::MintCompleteSet { account, condition_id, amount }
    }

    /// Create burn complete set action
    public fun burn_complete_set_action(
        account: address,
        condition_id: ConditionId,
        amount: u64,
    ): SingleOrderAction {
        SingleOrderAction::BurnCompleteSet { account, condition_id, amount }
    }

    /// Wrap actions for settle trade context
    public fun settle_trade_actions(actions: OrderActions): OrderMatchingActions {
        OrderMatchingActions::SettleTradeMatchingActions { actions }
    }

    /// Wrap actions for place maker context
    public fun place_maker_actions(actions: OrderActions): OrderMatchingActions {
        OrderMatchingActions::PlaceMakerOrderActions { actions }
    }

    // ============================================================================
    // RESOLUTION SOURCE FUNCTIONS
    // ============================================================================

    /// Create Creator resolution source
    public fun resolution_source_creator(): ResolutionSource {
        ResolutionSource::Creator
    }

    /// Create Oracle resolution source
    public fun resolution_source_oracle(oracle_address: address): ResolutionSource {
        ResolutionSource::Oracle { oracle_address }
    }

    /// Create Committee resolution source
    public fun resolution_source_committee(
        members: vector<address>,
        required_signatures: u64,
    ): ResolutionSource {
        ResolutionSource::Committee { members, required_signatures }
    }

    /// Create Optimistic resolution source
    public fun resolution_source_optimistic(
        bond_amount: u64,
        dispute_period_seconds: u64,
    ): ResolutionSource {
        ResolutionSource::Optimistic { bond_amount, dispute_period_seconds }
    }

    // ============================================================================
    // RESOLUTION SOURCE AUTHORIZATION
    // ============================================================================

    /// Check if resolver is authorized for a given resolution source
    public fun is_authorized_resolver(
        resolver: address,
        creator: address,
        source: &ResolutionSource,
    ): bool {
        match (source) {
            ResolutionSource::Creator => resolver == creator,
            ResolutionSource::Oracle { oracle_address } => resolver == *oracle_address,
            ResolutionSource::Committee { members, .. } => vector::contains(members, &resolver),
            ResolutionSource::Optimistic { .. } => {
                // For optimistic, anyone can propose but disputes follow different logic
                resolver == creator
            },
        }
    }

    // ============================================================================
    // CONSTANTS ACCESSORS
    // ============================================================================

    /// Get price scale constant
    public fun price_scale(): u64 {
        PRICE_SCALE
    }

    /// Get max outcomes constant
    public fun max_outcomes(): u64 {
        MAX_OUTCOMES
    }

    /// Get min outcomes constant
    public fun min_outcomes(): u64 {
        MIN_OUTCOMES
    }

    // ============================================================================
    // ERROR CODE ACCESSORS
    // ============================================================================

    public fun e_invalid_outcome_count(): u64 { E_INVALID_OUTCOME_COUNT }
    public fun e_invalid_condition_id(): u64 { E_INVALID_CONDITION_ID }
    public fun e_condition_not_found(): u64 { E_CONDITION_NOT_FOUND }
    public fun e_condition_already_resolved(): u64 { E_CONDITION_ALREADY_RESOLVED }
    public fun e_condition_not_resolved(): u64 { E_CONDITION_NOT_RESOLVED }
    public fun e_invalid_outcome_index(): u64 { E_INVALID_OUTCOME_INDEX }
    public fun e_market_not_active(): u64 { E_MARKET_NOT_ACTIVE }
    public fun e_insufficient_collateral(): u64 { E_INSUFFICIENT_COLLATERAL }
    public fun e_insufficient_tokens(): u64 { E_INSUFFICIENT_TOKENS }
    public fun e_invalid_price(): u64 { E_INVALID_PRICE }
    public fun e_not_authorized(): u64 { E_NOT_AUTHORIZED }
    public fun e_resolution_time_not_reached(): u64 { E_RESOLUTION_TIME_NOT_REACHED }
}
