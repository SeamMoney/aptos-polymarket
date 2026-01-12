import { useState, useEffect, useCallback, useRef } from 'react';
import { useGeomiTrades } from './useGeomiTrades';
import { isGeomiConfigured } from '../config/geomi';

const CONTRACT_ADDRESS = import.meta.env.VITE_CONTRACT_ADDRESS || "0xbdea15f5b0f5449ae8f3a6ae95a5e090bdeeec91be1fcac8375b2f5f37f1c134";
const TRADES_STORAGE_KEY = 'polymarket_live_trades';
const MAX_STORED_TRADES = 100;
const TRADE_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

// RPC endpoints in priority order (your fullnode first, then QuickNode fallback)
const RPC_ENDPOINTS = [
  "https://aptos.cash.trading/v1",  // Your fullnode - no rate limits
  "https://polished-evocative-borough.aptos-testnet.quiknode.pro/a0b08bae2dc34e4a8774d91414948d02a5ce2975/v1",  // QuickNode fallback
];

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

  // Add a trade directly (used when UI executes a trade or HFT broadcasts)
  const addTrade = useCallback((trade: LiveTrade) => {
    if (seenIdsRef.current.has(trade.id)) return;
    seenIdsRef.current.add(trade.id);

    setLocalTrades(prev => {
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

  // Subscribe to global trade events (HFT WebSocket, UI trades)
  useEffect(() => {
    const unsubscribe = subscribeToTrades(addTrade);
    return unsubscribe;
  }, [addTrade]);

  const loadMore = useCallback(() => {
    // TODO: Implement cursor-based pagination with Geomi
    setHasMore(false);
  }, []);

  // Merge trades from all sources with deduplication
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

    // Filter by market if specified (for non-Geomi sources)
    // Note: Geomi already filters by market, but local/HFT trades may not
    // This is a best-effort filter since local trades don't have market info

    // Sort by timestamp descending and limit
    return unique
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, maxTrades);
  }, [geomiTrades, localTrades, maxTrades]);

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

