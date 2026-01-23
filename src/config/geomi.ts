/**
 * Geomi No-Code Indexer Configuration
 *
 * Geomi indexes on-chain events into queryable tables.
 * Our processor indexes OutcomeTokenBought and OutcomeTokenSold events
 * from the multi_outcome_market contract.
 *
 * Table schema (trades):
 * - tx_hash (PK) - transaction hash
 * - event_index (PK) - event index within transaction
 * - timestamp (indexed) - transaction timestamp
 * - market_address (indexed) - market contract address
 * - event_type (indexed) - OutcomeTokenBought or OutcomeTokenSold
 * - trader - buyer/seller address
 * - outcome_index - which outcome was traded
 * - collateral_amount - APT amount in octas
 * - token_amount - tokens received/spent in octas (ACTUAL, not estimated!)
 * - new_price - price after trade (0-100)
 * - sequence_number - event sequence number
 */

export const GEOMI_CONFIG = {
  graphqlUrl: import.meta.env.VITE_GEOMI_GRAPHQL_URL as string | undefined,
  apiKey: import.meta.env.VITE_GEOMI_API_KEY as string | undefined,

  // Processor instance ID (aptos-polymarket-processor-04 for AMM-fixed contract)
  // Note: Using tx_hash + event_index as primary keys (Move v2 events have sequence_number=0)
  processorId: 'cmkq6sewc000ds601nla1ba6r',

  // Default query settings
  defaults: {
    pollInterval: 5000,  // 5 seconds
    maxTrades: 50,
  },
};

/**
 * Check if Geomi is properly configured
 */
export function isGeomiConfigured(): boolean {
  return !!(GEOMI_CONFIG.graphqlUrl && GEOMI_CONFIG.apiKey);
}
