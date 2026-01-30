import { useState, useEffect, useCallback, useRef } from 'react';
import { useGeomiTrades } from './useGeomiTrades';
import { isGeomiConfigured } from '../config/geomi';

const CONTRACT_ADDRESS = import.meta.env.VITE_CONTRACT_ADDRESS || "0xca4d40eae9f07fb28a121862d649203fb4335ece9536ee51790e19f812ff7aea";
const TRADES_STORAGE_KEY = 'polymarket_live_trades';
const MAX_STORED_TRADES = 100;
const TRADE_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

// RPC endpoints in priority order
const RPC_ENDPOINTS = [
  import.meta.env.VITE_RPC_URL || "https://api.testnet.aptoslabs.com/v1",
  "https://api.testnet.aptoslabs.com/v1",  // Aptos Labs fallback
].filter((v, i, a) => a.indexOf(v) === i); // Dedupe

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
  amount: number;      // In APT/USD1
  price: number;       // Price at time of trade (0-1)
  timestamp: number;
  txHash: string;
  trader: string;
  marketAddress?: string;  // Market address for filtering
}

// LocalStorage helpers for trade persistence
function loadStoredTrades(): LiveTrade[] {
  try {
    const stored = localStorage.getItem(TRADES_STORAGE_KEY);
    if (!stored) return [];
    const trades: LiveTrade[] = JSON.parse(stored);
    // Filter out expired trades (older than 24 hours)
    // Also filter out trades without marketAddress (old format - can't be filtered properly)
    const now = Date.now();
    return trades.filter(t => now - t.timestamp < TRADE_EXPIRY_MS && t.marketAddress);
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

interface UseLiveTradesOptions {
  marketAddress?: string;   // Filter trades by market (enables Geomi)
  pollInterval?: number;    // Polling interval in ms (default: 5000)
  maxTrades?: number;       // Max trades to keep (default: 100)
  enabled?: boolean;        // Whether to fetch trades (default: true)
}

interface UseLiveTradesReturn {
  trades: LiveTrade[];
  isPolling: boolean;
  isLoading: boolean;       // New: loading state from Geomi
  lastUpdate: number | null;
  loadMore: () => void;
  hasMore: boolean;
  addTrade: (trade: LiveTrade) => void;
  addTradeFromTx: (txHash: string) => Promise<void>;
  source: 'geomi' | 'local' | 'hybrid';  // New: where trades are coming from
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
    let marketAddress = '';

    const tradeEvent = tx.events?.find((e: { type: string }) =>
      e.type === BUY_EVENT_TYPE || e.type === SELL_EVENT_TYPE
    );

    if (tradeEvent?.data) {
      outcomeIndex = parseInt(tradeEvent.data.outcome_index) || 0;
      const collateral = tradeEvent.data.collateral_in || tradeEvent.data.collateral_out || '0';
      amountAPT = parseInt(collateral) / 100_000_000;
      trader = tradeEvent.data.buyer || tradeEvent.data.seller || trader;
      marketAddress = tradeEvent.data.market || '';
    }

    // Also try to extract market address from function arguments (first arg is market address)
    if (!marketAddress && tx.payload?.arguments?.length >= 1) {
      marketAddress = tx.payload.arguments[0] || '';
    }

    if (tx.payload?.arguments) {
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
      marketAddress,
    };
  } catch (error) {
    console.error('Error fetching trade from tx:', error);
    return null;
  }
}

/**
 * useLiveTrades - Unified hook for live trade data
 *
 * Data sources (in priority order):
 * 1. Geomi indexer (if configured and marketAddress provided)
 * 2. HFT WebSocket (via event bus)
 * 3. localStorage (for persistence/offline)
 *
 * @param optionsOrPollInterval - Configuration options object OR pollInterval for legacy support
 * @param legacyMaxTrades - Max trades (legacy positional arg)
 * @param legacyEnabled - Whether to fetch (legacy positional arg)
 */
export function useLiveTrades(
  optionsOrPollInterval: UseLiveTradesOptions | number = {},
  legacyMaxTrades?: number,
  legacyEnabled?: boolean
): UseLiveTradesReturn {
  // Support both object-based and legacy positional arguments
  const options: UseLiveTradesOptions = typeof optionsOrPollInterval === 'number'
    ? {
        pollInterval: optionsOrPollInterval,
        maxTrades: legacyMaxTrades ?? 100,
        enabled: legacyEnabled ?? true,
      }
    : optionsOrPollInterval;

  const {
    marketAddress,
    pollInterval = 5000,
    maxTrades = 100,
    enabled = true,
  } = options;

  // Geomi trades (primary source when configured)
  const useGeomi = isGeomiConfigured() && !!marketAddress;
  const {
    trades: geomiTrades,
    isLoading: geomiLoading,
  } = useGeomiTrades(marketAddress, {
    pollInterval,
    limit: maxTrades,
    enabled: enabled && useGeomi,
  });

  // Local trades from localStorage and HFT WebSocket
  const [localTrades, setLocalTrades] = useState<LiveTrade[]>(() => loadStoredTrades());
  const [isPolling, _setIsPolling] = useState(false);
  void _setIsPolling; // Suppress unused warning - kept for future use
  const [lastUpdate, setLastUpdate] = useState<number | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const seenIdsRef = useRef<Set<string>>(new Set());

  // Populate seenIds from loaded trades
  useEffect(() => {
    localTrades.forEach(t => seenIdsRef.current.add(t.id));
  }, []); // Only on mount

  // Persist local trades to localStorage whenever they change
  useEffect(() => {
    if (localTrades.length > 0) {
      saveStoredTrades(localTrades);
    }
  }, [localTrades]);

  // Persist Geomi/API trades to localStorage for offline access
  useEffect(() => {
    if (geomiTrades.length > 0) {
      // Merge with existing localStorage trades
      const existingTrades = loadStoredTrades();
      const allTrades = [...geomiTrades, ...existingTrades];

      // Deduplicate by id
      const seen = new Set<string>();
      const unique: LiveTrade[] = [];
      for (const trade of allTrades) {
        if (!seen.has(trade.id)) {
          seen.add(trade.id);
          unique.push(trade);
        }
      }

      // Sort and limit
      const sorted = unique
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, MAX_STORED_TRADES);

      saveStoredTrades(sorted);
    }
  }, [geomiTrades]);

  // Add a trade directly (used when UI executes a trade or HFT broadcasts)
  const addTrade = useCallback((trade: LiveTrade) => {
    console.log('[useLiveTrades] addTrade called:', {
      tradeMarketAddress: trade.marketAddress,
      hookMarketAddress: marketAddress,
      tradeId: trade.id
    });
    if (seenIdsRef.current.has(trade.id)) {
      console.log('[useLiveTrades] Trade already seen, skipping:', trade.id);
      return;
    }
    seenIdsRef.current.add(trade.id);

    setLocalTrades(prev => {
      const combined = [trade, ...prev];
      const unique = combined.filter((t, idx, arr) =>
        arr.findIndex(x => x.id === t.id) === idx
      );
      console.log('[useLiveTrades] Local trades updated, count:', unique.length);
      return unique.sort((a, b) => b.timestamp - a.timestamp).slice(0, maxTrades);
    });
    setLastUpdate(Date.now());
  }, [maxTrades, marketAddress]);

  // Add trade by fetching from transaction hash
  const addTradeFromTx = useCallback(async (txHash: string) => {
    const trade = await fetchTradeFromTx(txHash);
    if (trade) {
      addTrade(trade);
    }
  }, [addTrade]);

  // Subscribe to global trade events (HFT WebSocket, UI trades)
  useEffect(() => {
    const unsubscribe = subscribeToTrades(addTrade);
    return unsubscribe;
  }, [addTrade]);

  const loadMore = useCallback(() => {
    // TODO: Implement cursor-based pagination with Geomi
    setHasMore(false);
  }, []);

  // Merge trades from all sources with deduplication and market filtering
  const mergedTrades = useCallback((): LiveTrade[] => {
    const allTrades = [...geomiTrades, ...localTrades];

    // Deduplicate by id
    const seen = new Set<string>();
    const unique: LiveTrade[] = [];
    for (const trade of allTrades) {
      if (!seen.has(trade.id)) {
        seen.add(trade.id);
        unique.push(trade);
      }
    }

    // Filter by market address if specified
    // This ensures trades only show on the correct market's trade stream
    let filtered = unique;
    if (marketAddress) {
      const normalizedMarket = marketAddress.toLowerCase();
      filtered = unique.filter(trade => {
        // If trade has no market address, don't show it (can't verify it belongs here)
        if (!trade.marketAddress) return false;
        const matches = trade.marketAddress.toLowerCase() === normalizedMarket;
        if (!matches && unique.length > 0) {
          console.log('[useLiveTrades] Trade filtered out:', {
            tradeMarketAddress: trade.marketAddress,
            hookMarketAddress: marketAddress,
            matches
          });
        }
        return matches;
      });
      if (unique.length > 0 && filtered.length !== unique.length) {
        console.log('[useLiveTrades] Filtering result:', {
          before: unique.length,
          after: filtered.length,
          marketAddress
        });
      }
    }

    // Sort by timestamp descending and limit
    return filtered
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, maxTrades);
  }, [geomiTrades, localTrades, maxTrades, marketAddress]);

  // Determine source for debugging/UI
  const source: 'geomi' | 'local' | 'hybrid' = useGeomi
    ? geomiTrades.length > 0 && localTrades.length > 0
      ? 'hybrid'
      : geomiTrades.length > 0
        ? 'geomi'
        : 'local'
    : 'local';

  return {
    trades: mergedTrades(),
    isPolling,
    isLoading: geomiLoading,
    lastUpdate,
    loadMore,
    hasMore,
    addTrade,
    addTradeFromTx,
    source,
  };
}

