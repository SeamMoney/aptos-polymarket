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
    console.error(`[geomiClient] Request failed (${response.status}):`, text.slice(0, 300));
    throw new Error(`Geomi request failed (${response.status}): ${text.slice(0, 200)}`);
  }

  const result: GraphQLResponse<T> = await response.json();

  if (result.errors?.length) {
    const errorMsg = result.errors[0].message;
    const errorCode = (result.errors[0].extensions as { code?: string })?.code;
    console.error('[geomiClient] GraphQL error:', { message: errorMsg, code: errorCode });

    // Surface budget cap errors more prominently
    if (errorMsg.includes('DailyBudget') || errorCode === '429') {
      console.warn('⚠️ GEOMI DAILY BUDGET EXCEEDED - Trade data may be stale!');
    }

    throw new Error(`Geomi GraphQL error: ${errorMsg}`);
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
  console.log('[geomiClient] Fetching trades for market:', marketAddress.slice(0, 20) + '...');
  const result = await queryGeomi<TradesQueryResult>(LATEST_TRADES_QUERY, {
    market: marketAddress,
    limit,
  });
  console.log('[geomiClient] Got', result.trades.length, 'trades from Geomi');
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

// ============================================
// Aptos Events API Fallback
// ============================================

const CONTRACT_ADDRESS = import.meta.env.VITE_CONTRACT_ADDRESS || "0xbdea15f5b0f5449ae8f3a6ae95a5e090bdeeec91be1fcac8375b2f5f37f1c134";
const BUY_EVENT_TYPE = `${CONTRACT_ADDRESS}::multi_outcome_market::OutcomeTokenBought`;
const SELL_EVENT_TYPE = `${CONTRACT_ADDRESS}::multi_outcome_market::OutcomeTokenSold`;

/**
 * Fetch recent trades from Aptos Indexer GraphQL API (fallback when Geomi unavailable)
 * Uses the public indexer to query events by type
 */
export async function fetchTradesFromAptosApi(
  marketAddress?: string,
  limit: number = 50
): Promise<GeomiTrade[]> {
  const INDEXER_URL = 'https://api.testnet.aptoslabs.com/v1/graphql';

  // Query for both buy and sell events
  const query = `
    query GetTradeEvents($buyType: String!, $sellType: String!, $limit: Int!) {
      events(
        where: {
          _or: [
            { type: { _eq: $buyType } },
            { type: { _eq: $sellType } }
          ]
        }
        order_by: { transaction_block_height: desc }
        limit: $limit
      ) {
        type
        data
        transaction_version
        event_index
        transaction_block_height
      }
    }
  `;

  try {
    console.log('[geomiClient] Trying Aptos Indexer fallback...');
    const response = await fetch(INDEXER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query,
        variables: {
          buyType: BUY_EVENT_TYPE,
          sellType: SELL_EVENT_TYPE,
          limit: limit * 2, // Fetch extra to account for filtering
        },
      }),
    });

    if (!response.ok) {
      console.error('[geomiClient] Indexer request failed:', response.status);
      return [];
    }

    const result = await response.json();
    if (result.errors) {
      console.error('[geomiClient] Indexer GraphQL error:', result.errors);
      return [];
    }

    const events = result.data?.events || [];
    console.log('[geomiClient] Indexer returned', events.length, 'events');

    const trades: GeomiTrade[] = [];

    for (const event of events) {
      // Parse the data field (it's JSON stringified)
      let eventData;
      try {
        eventData = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
      } catch {
        continue;
      }

      // Filter by market if specified
      if (marketAddress && eventData.market_address !== marketAddress) {
        continue;
      }

      const isBuy = event.type.includes('OutcomeTokenBought');
      trades.push({
        tx_hash: `v${event.transaction_version}`,
        event_index: event.event_index || 0,
        sequence_number: String(event.transaction_version),
        event_type: event.type,
        market_address: eventData.market_address || '',
        trader: isBuy ? (eventData.buyer || '') : (eventData.seller || ''),
        outcome_index: parseInt(eventData.outcome_index) || 0,
        collateral_amount: isBuy ? (eventData.collateral_in || '0') : (eventData.collateral_out || '0'),
        token_amount: isBuy ? (eventData.tokens_out || '0') : (eventData.tokens_in || '0'),
        new_price: parseInt(eventData.new_price) || 50,
        timestamp: new Date().toISOString(), // Indexer doesn't include timestamp directly
      });
    }

    console.log('[geomiClient] Filtered to', trades.length, 'trades for market');
    return trades.slice(0, limit);
  } catch (err) {
    console.error('[geomiClient] Error fetching from Aptos Indexer:', err);
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
      console.log('[geomiClient] Geomi returned 0 trades, falling back to Aptos API');
    } catch (err) {
      // Fall back to Aptos API - Geomi may not have trades table indexed
      console.log('[geomiClient] Geomi failed, falling back to Aptos API:', err);
    }
  } else {
    console.log('[geomiClient] Geomi not configured, using Aptos API');
  }

  // Fallback to Aptos Events API
  try {
    const trades = await fetchTradesFromAptosApi(marketAddress, limit);
    return { trades, source: trades.length > 0 ? 'aptos_api' : 'none' };
  } catch {
    return { trades: [], source: 'none' };
  }
}
