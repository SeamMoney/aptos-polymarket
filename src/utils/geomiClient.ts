/**
 * Geomi GraphQL Client
 *
 * Provides typed queries to the Geomi No-Code Indexer for trade data.
 * Uses the `trades` table which indexes OutcomeTokenBought and OutcomeTokenSold events.
 */

import { GEOMI_CONFIG, isGeomiConfigured } from '../config/geomi';

// ============================================
// Types
// ============================================

export interface GeomiTrade {
  tx_hash: string;            // transaction hash (primary key)
  event_index: number;        // event index within transaction (primary key)
  sequence_number: string;    // event sequence number
  event_type: string;
  market_address: string;
  trader: string;
  outcome_index: number;
  collateral_amount: string;  // octas (string for bigint safety)
  token_amount: string;       // octas (string for bigint safety)
  new_price: number;          // 0-100
  timestamp: string;          // ISO timestamp from transaction
}

interface GraphQLResponse<T> {
  data?: T;
  errors?: Array<{ message: string; extensions?: unknown }>;
}

interface TradesQueryResult {
  trades: GeomiTrade[];
}

// ============================================
// GraphQL Queries
// ============================================

const LATEST_TRADES_QUERY = `
  query LatestTrades($market: String!, $limit: Int!) {
    trades(
      where: { market_address: { _eq: $market } }
      order_by: [{ timestamp: desc }, { event_index: desc }]
      limit: $limit
    ) {
      tx_hash
      event_index
      sequence_number
      event_type
      market_address
      trader
      outcome_index
      collateral_amount
      token_amount
      new_price
      timestamp
    }
  }
`;

const USER_TRADES_QUERY = `
  query UserTrades($user: String!, $limit: Int!) {
    trades(
      where: { trader: { _eq: $user } }
      order_by: [{ timestamp: desc }, { event_index: desc }]
      limit: $limit
    ) {
      tx_hash
      event_index
      sequence_number
      event_type
      market_address
      trader
      outcome_index
      collateral_amount
      token_amount
      new_price
      timestamp
    }
  }
`;

const USER_MARKET_TRADES_QUERY = `
  query UserMarketTrades($user: String!, $market: String!, $limit: Int!) {
    trades(
      where: {
        trader: { _eq: $user }
        market_address: { _eq: $market }
      }
      order_by: [{ timestamp: desc }, { event_index: desc }]
      limit: $limit
    ) {
      tx_hash
      event_index
      sequence_number
      event_type
      market_address
      trader
      outcome_index
      collateral_amount
      token_amount
      new_price
      timestamp
    }
  }
`;

const ALL_TRADES_QUERY = `
  query AllTrades($limit: Int!) {
    trades(
      order_by: [{ timestamp: desc }, { event_index: desc }]
      limit: $limit
    ) {
      tx_hash
      event_index
      sequence_number
      event_type
      market_address
      trader
      outcome_index
      collateral_amount
      token_amount
      new_price
      timestamp
    }
  }
`;

// ============================================
// Client Functions
// ============================================

/**
 * Execute a GraphQL query against Geomi
 */
export async function queryGeomi<T>(
  query: string,
  variables: Record<string, unknown> = {}
): Promise<T> {
  if (!isGeomiConfigured()) {
    throw new Error('Geomi is not configured. Set VITE_GEOMI_GRAPHQL_URL and VITE_GEOMI_API_KEY.');
  }

  const response = await fetch(GEOMI_CONFIG.graphqlUrl!, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${GEOMI_CONFIG.apiKey}`,
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Geomi request failed (${response.status}): ${text.slice(0, 200)}`);
  }

  const result: GraphQLResponse<T> = await response.json();

  if (result.errors?.length) {
    throw new Error(`Geomi GraphQL error: ${result.errors[0].message}`);
  }

  if (!result.data) {
    throw new Error('Geomi returned no data');
  }

  return result.data;
}

/**
 * Fetch latest trades for a specific market
 */
export async function fetchLatestTrades(
  marketAddress: string,
  limit: number = 50
): Promise<GeomiTrade[]> {
  const result = await queryGeomi<TradesQueryResult>(LATEST_TRADES_QUERY, {
    market: marketAddress,
    limit,
  });
  return result.trades;
}

/**
 * Fetch all trades for a specific user
 */
export async function fetchUserTrades(
  userAddress: string,
  limit: number = 100
): Promise<GeomiTrade[]> {
  const result = await queryGeomi<TradesQueryResult>(USER_TRADES_QUERY, {
    user: userAddress,
    limit,
  });
  return result.trades;
}

/**
 * Fetch trades for a specific user in a specific market
 */
export async function fetchUserMarketTrades(
  userAddress: string,
  marketAddress: string,
  limit: number = 100
): Promise<GeomiTrade[]> {
  const result = await queryGeomi<TradesQueryResult>(USER_MARKET_TRADES_QUERY, {
    user: userAddress,
    market: marketAddress,
    limit,
  });
  return result.trades;
}

/**
 * Fetch all recent trades (across all markets)
 */
export async function fetchAllTrades(limit: number = 50): Promise<GeomiTrade[]> {
  const result = await queryGeomi<TradesQueryResult>(ALL_TRADES_QUERY, { limit });
  return result.trades;
}

// ============================================
// Utility Functions
// ============================================

/**
 * Convert a GeomiTrade to the LiveTrade format used by useLiveTrades
 */
export function geomiTradeToLiveTrade(trade: GeomiTrade): {
  id: string;
  type: 'buy' | 'sell';
  outcomeIndex: number;
  amount: number;
  tokenAmount: number;
  price: number;
  timestamp: number;
  txHash: string;
  trader: string;
} {
  const isBuy = trade.event_type.includes('OutcomeTokenBought');
  const collateralOctas = BigInt(trade.collateral_amount);
  const tokenOctas = BigInt(trade.token_amount);

  // Parse ISO timestamp from Geomi (e.g., "2026-01-10T08:33:55")
  const timestamp = trade.timestamp ? new Date(trade.timestamp).getTime() : Date.now();

  return {
    id: `${trade.tx_hash}-${trade.event_index}`,
    type: isBuy ? 'buy' : 'sell',
    outcomeIndex: trade.outcome_index,
    amount: Number(collateralOctas) / 100_000_000,  // APT
    tokenAmount: Number(tokenOctas) / 100_000_000,  // tokens
    price: trade.new_price / 100,  // 0-1 range
    timestamp,
    txHash: trade.tx_hash,
    trader: trade.trader,
  };
}

/**
 * Check if Geomi is available and working
 */
export async function checkGeomiHealth(): Promise<boolean> {
  if (!isGeomiConfigured()) {
    return false;
  }

  try {
    await queryGeomi<{ __typename: string }>('query { __typename }');
    return true;
  } catch {
    return false;
  }
}
