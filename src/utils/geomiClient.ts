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
  // Geomi returns UTC timestamps without 'Z' suffix, so append it for correct parsing
  const timestamp = trade.timestamp
    ? new Date(trade.timestamp.endsWith('Z') ? trade.timestamp : trade.timestamp + 'Z').getTime()
    : Date.now();

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

// ============================================
// Aptos Events API Fallback
// ============================================

const CONTRACT_ADDRESS = import.meta.env.VITE_CONTRACT_ADDRESS || "0xbdea15f5b0f5449ae8f3a6ae95a5e090bdeeec91be1fcac8375b2f5f37f1c134";
const BUY_EVENT_TYPE = `${CONTRACT_ADDRESS}::multi_outcome_market::OutcomeTokenBought`;
const SELL_EVENT_TYPE = `${CONTRACT_ADDRESS}::multi_outcome_market::OutcomeTokenSold`;

const RPC_ENDPOINTS = [
  import.meta.env.VITE_RPC_URL || "https://api.testnet.aptoslabs.com/v1",
  "https://api.testnet.aptoslabs.com/v1",
];

/**
 * Fetch from RPC with failover
 */
async function fetchRpcWithFailover(path: string): Promise<Response> {
  for (const baseUrl of RPC_ENDPOINTS) {
    try {
      const res = await fetch(`${baseUrl}${path}`);
      if (res.ok) return res;
      if (res.status === 429) continue;
    } catch {
      continue;
    }
  }
  throw new Error('All RPC endpoints failed');
}

/**
 * Convert Aptos event to GeomiTrade format
 */
function aptosEventToGeomiTrade(event: {
  type: string;
  data: {
    buyer?: string;
    seller?: string;
    market_address: string;
    outcome_index: string;
    collateral_in?: string;
    collateral_out?: string;
    tokens_out?: string;
    tokens_in?: string;
    new_price: string;
  };
  sequence_number: string;
  guid: { account_address: string };
}, txHash: string, eventIndex: number, timestamp: string): GeomiTrade {
  const isBuy = event.type.includes('OutcomeTokenBought');
  return {
    tx_hash: txHash,
    event_index: eventIndex,
    sequence_number: event.sequence_number,
    event_type: event.type,
    market_address: event.data.market_address,
    trader: isBuy ? (event.data.buyer || '') : (event.data.seller || ''),
    outcome_index: parseInt(event.data.outcome_index) || 0,
    collateral_amount: isBuy ? (event.data.collateral_in || '0') : (event.data.collateral_out || '0'),
    token_amount: isBuy ? (event.data.tokens_out || '0') : (event.data.tokens_in || '0'),
    new_price: parseInt(event.data.new_price) || 50,
    timestamp,
  };
}

/**
 * Fetch recent trades from Aptos Events API (fallback when Geomi unavailable)
 * Queries account events for the contract module
 */
export async function fetchTradesFromAptosApi(
  marketAddress?: string,
  limit: number = 50
): Promise<GeomiTrade[]> {
  try {
    // Fetch recent transactions that might contain trade events
    // We query the account's transactions and look for trade events
    const response = await fetchRpcWithFailover(
      `/accounts/${CONTRACT_ADDRESS}/transactions?limit=${Math.min(limit * 2, 100)}`
    );

    if (!response.ok) {
      return [];
    }

    const txns = await response.json();
    const trades: GeomiTrade[] = [];

    for (const tx of txns) {
      if (!tx.success) continue;

      // Check if this transaction has trade events
      const tradeEvents = (tx.events || []).filter((e: { type: string }) =>
        e.type === BUY_EVENT_TYPE || e.type === SELL_EVENT_TYPE
      );

      for (let i = 0; i < tradeEvents.length; i++) {
        const event = tradeEvents[i];

        // Filter by market if specified
        if (marketAddress && event.data.market_address !== marketAddress) {
          continue;
        }

        // Convert timestamp from microseconds to ISO
        const timestamp = tx.timestamp
          ? new Date(parseInt(tx.timestamp) / 1000).toISOString()
          : new Date().toISOString();

        trades.push(aptosEventToGeomiTrade(event, tx.hash, i, timestamp));
      }
    }

    // Sort by timestamp descending and limit
    return trades
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, limit);
  } catch (err) {
    console.error('Error fetching trades from Aptos API:', err);
    return [];
  }
}

/**
 * Fetch trades with automatic fallback
 * 1. Try Geomi first
 * 2. Fall back to Aptos Events API if Geomi fails
 */
export async function fetchTradesWithFallback(
  marketAddress?: string,
  limit: number = 50
): Promise<{ trades: GeomiTrade[]; source: 'geomi' | 'aptos_api' | 'none' }> {
  // Try Geomi first if configured
  if (isGeomiConfigured()) {
    try {
      const trades = marketAddress
        ? await fetchLatestTrades(marketAddress, limit)
        : await fetchAllTrades(limit);

      if (trades.length > 0) {
        return { trades, source: 'geomi' };
      }
    } catch {
      // Silently fall back to Aptos API - Geomi may not have trades table indexed
    }
  }

  // Fallback to Aptos Events API
  try {
    const trades = await fetchTradesFromAptosApi(marketAddress, limit);
    return { trades, source: trades.length > 0 ? 'aptos_api' : 'none' };
  } catch {
    return { trades: [], source: 'none' };
  }
}
