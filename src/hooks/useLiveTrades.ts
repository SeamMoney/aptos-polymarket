import { useState, useEffect, useCallback, useRef } from 'react';

const CONTRACT_ADDRESS = "0xa2e5e47aab07fed78a3bcf95135ee2dad20c547499c94cb16a3e047859ffa7e1";
const TRADES_STORAGE_KEY = 'polymarket_live_trades';
const MAX_STORED_TRADES = 100;
const TRADE_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

// RPC endpoints in priority order (your fullnode first, then QuickNode fallback)
const RPC_ENDPOINTS = [
  "https://aptos.cash.trading/v1",  // Your fullnode - no rate limits
  "https://polished-evocative-borough.aptos-testnet.quiknode.pro/a0b08bae2dc34e4a8774d91414948d02a5ce2975/v1",  // QuickNode fallback
];

// Indexer endpoint (for GraphQL queries - may be rate limited)
const INDEXER_URL = "https://api.testnet.aptoslabs.com/v1/graphql";

// Helper to fetch from RPC with failover
async function fetchFromRpc(path: string): Promise<Response> {
  for (const baseUrl of RPC_ENDPOINTS) {
    try {
      const res = await fetch(`${baseUrl}${path}`);
      if (res.ok) return res;
      if (res.status === 429) continue; // Rate limited, try next
    } catch {
      continue; // Network error, try next
    }
  }
  throw new Error('All RPC endpoints failed');
}

export interface LiveTrade {
  id: string;
  type: 'buy' | 'sell';
  outcomeIndex: number;
  amount: number;      // In APT
  price: number;       // Price at time of trade (0-1)
  timestamp: number;
  txHash: string;
  trader: string;
}

// LocalStorage helpers for trade persistence
function loadStoredTrades(): LiveTrade[] {
  try {
    const stored = localStorage.getItem(TRADES_STORAGE_KEY);
    if (!stored) return [];
    const trades: LiveTrade[] = JSON.parse(stored);
    // Filter out expired trades (older than 24 hours)
    const now = Date.now();
    return trades.filter(t => now - t.timestamp < TRADE_EXPIRY_MS);
  } catch {
    return [];
  }
}

function saveStoredTrades(trades: LiveTrade[]): void {
  try {
    // Keep only recent trades up to max limit
    const toStore = trades.slice(0, MAX_STORED_TRADES);
    localStorage.setItem(TRADES_STORAGE_KEY, JSON.stringify(toStore));
  } catch {
    // localStorage might be full or disabled
  }
}

interface UseLiveTradesReturn {
  trades: LiveTrade[];
  isPolling: boolean;
  lastUpdate: number | null;
  loadMore: () => void;
  hasMore: boolean;
  addTrade: (trade: LiveTrade) => void;
  addTradeFromTx: (txHash: string) => Promise<void>;
}

// Event types for buy/sell
const BUY_EVENT_TYPE = `${CONTRACT_ADDRESS}::multi_outcome_market::OutcomeTokenBought`;
const SELL_EVENT_TYPE = `${CONTRACT_ADDRESS}::multi_outcome_market::OutcomeTokenSold`;

// Global event bus for trades - allows TradingSheet to notify this hook
type TradeListener = (trade: LiveTrade) => void;
const tradeListeners = new Set<TradeListener>();

export function subscribeToTrades(listener: TradeListener): () => void {
  tradeListeners.add(listener);
  return () => { tradeListeners.delete(listener); };
}

export function emitTrade(trade: LiveTrade) {
  tradeListeners.forEach(listener => listener(trade));
}

// Helper to fetch and parse a trade from transaction hash
export async function fetchTradeFromTx(txHash: string): Promise<LiveTrade | null> {
  try {
    const response = await fetchFromRpc(`/transactions/by_hash/${txHash}`);
    if (!response.ok) return null;

    const tx = await response.json();
    if (!tx.success) return null;

    const functionName = tx.payload?.function || '';
    if (!functionName.includes('buy_outcome') && !functionName.includes('sell_outcome')) {
      return null;
    }

    const isBuy = functionName.includes('buy_outcome');

    // Extract data from events
    let outcomeIndex = 0;
    let amountAPT = 0;
    let trader = tx.sender || '';

    const tradeEvent = tx.events?.find((e: { type: string }) =>
      e.type === BUY_EVENT_TYPE || e.type === SELL_EVENT_TYPE
    );

    if (tradeEvent?.data) {
      outcomeIndex = parseInt(tradeEvent.data.outcome_index) || 0;
      const collateral = tradeEvent.data.collateral_in || tradeEvent.data.collateral_out || '0';
      amountAPT = parseInt(collateral) / 100_000_000;
      trader = tradeEvent.data.buyer || tradeEvent.data.seller || trader;
    } else if (tx.payload?.arguments) {
      const args = tx.payload.arguments;
      if (args.length >= 3) {
        outcomeIndex = parseInt(args[1]) || 0;
        amountAPT = parseInt(args[2]) / 100_000_000;
      }
    }

    const timestamp = tx.timestamp ? parseInt(tx.timestamp) / 1000 : Date.now();

    return {
      id: `${tx.version}-${txHash}`,
      type: isBuy ? 'buy' : 'sell',
      outcomeIndex,
      amount: amountAPT,
      price: 0,
      timestamp,
      txHash,
      trader,
    };
  } catch (error) {
    console.error('Error fetching trade from tx:', error);
    return null;
  }
}

export function useLiveTrades(
  pollInterval: number = 5000,
  maxTrades: number = 100,
  enabled: boolean = true
): UseLiveTradesReturn {
  // Initialize trades from localStorage
  const [trades, setTrades] = useState<LiveTrade[]>(() => loadStoredTrades());
  const [isPolling, setIsPolling] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<number | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const seenIdsRef = useRef<Set<string>>(new Set());

  // Populate seenIds from loaded trades
  useEffect(() => {
    trades.forEach(t => seenIdsRef.current.add(t.id));
  }, []); // Only on mount

  // Persist trades to localStorage whenever they change
  useEffect(() => {
    if (trades.length > 0) {
      saveStoredTrades(trades);
    }
  }, [trades]);

  // Add a trade directly (used when UI executes a trade)
  const addTrade = useCallback((trade: LiveTrade) => {
    if (seenIdsRef.current.has(trade.id)) return;
    seenIdsRef.current.add(trade.id);

    setTrades(prev => {
      const combined = [trade, ...prev];
      const unique = combined.filter((t, idx, arr) =>
        arr.findIndex(x => x.id === t.id) === idx
      );
      return unique.sort((a, b) => b.timestamp - a.timestamp).slice(0, maxTrades);
    });
    setLastUpdate(Date.now());
  }, [maxTrades]);

  // Add trade by fetching from transaction hash
  const addTradeFromTx = useCallback(async (txHash: string) => {
    const trade = await fetchTradeFromTx(txHash);
    if (trade) {
      addTrade(trade);
    }
  }, [addTrade]);

  // Subscribe to global trade events
  useEffect(() => {
    const unsubscribe = subscribeToTrades(addTrade);
    return unsubscribe;
  }, [addTrade]);

  // Try to fetch recent trades from known sources
  const fetchTrades = useCallback(async () => {
    if (!enabled) return;

    try {
      setIsPolling(true);

      // Try the Aptos indexer (may be rate limited)
      const query = `
        query GetTrades {
          events(
            where: {
              type: { _in: [
                "${BUY_EVENT_TYPE}",
                "${SELL_EVENT_TYPE}"
              ]}
            },
            limit: 50,
            order_by: { transaction_version: desc }
          ) {
            transaction_version
            data
            type
          }
        }
      `;

      const response = await fetch(INDEXER_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query })
      });

      if (response.ok) {
        const result = await response.json();
        if (result.data?.events) {
          const events = result.data.events;

          const newTrades: LiveTrade[] = await Promise.all(
            events
              .filter((e: { transaction_version: string }) =>
                !seenIdsRef.current.has(e.transaction_version.toString())
              )
              .slice(0, 20)
              .map(async (event: { transaction_version: string; data: Record<string, string>; type: string }) => {
                const isBuy = event.type === BUY_EVENT_TYPE;
                const data = event.data;

                // Fetch full transaction for hash using our RPC with failover
                let txHash = event.transaction_version.toString();
                try {
                  const txResp = await fetchFromRpc(`/transactions/by_version/${event.transaction_version}`);
                  if (txResp.ok) {
                    const tx = await txResp.json();
                    txHash = tx.hash || txHash;
                  }
                } catch {
                  // Use version as fallback
                }

                seenIdsRef.current.add(event.transaction_version.toString());

                return {
                  id: `${event.transaction_version}-${txHash}`,
                  type: isBuy ? 'buy' : 'sell',
                  outcomeIndex: parseInt(data.outcome_index) || 0,
                  amount: parseInt(data.collateral_in || data.collateral_out || '0') / 100_000_000,
                  price: 0,
                  timestamp: Date.now(), // Events don't have timestamp, use now
                  txHash,
                  trader: data.buyer || data.seller || '',
                } as LiveTrade;
              })
          );

          if (newTrades.length > 0) {
            setTrades(prev => {
              const combined = [...newTrades, ...prev];
              const unique = combined.filter((t, idx, arr) =>
                arr.findIndex(x => x.id === t.id) === idx
              );
              return unique.sort((a, b) => b.timestamp - a.timestamp).slice(0, maxTrades);
            });
            setLastUpdate(Date.now());
          }
        }
      }
    } catch (error) {
      // Silently fail - indexer may be rate limited
      console.debug('Trade fetch failed (may be rate limited):', error);
    } finally {
      setIsPolling(false);
    }
  }, [enabled, maxTrades]);

  const loadMore = useCallback(() => {
    setHasMore(false); // For now, disable load more since we can't paginate without indexer
  }, []);

  // Initial fetch and polling
  useEffect(() => {
    if (!enabled) return;

    // Initial fetch
    fetchTrades();

    // Set up polling
    const interval = setInterval(fetchTrades, pollInterval);

    return () => clearInterval(interval);
  }, [enabled, pollInterval, fetchTrades]);

  return {
    trades,
    isPolling,
    lastUpdate,
    loadMore,
    hasMore,
    addTrade,
    addTradeFromTx,
  };
}
