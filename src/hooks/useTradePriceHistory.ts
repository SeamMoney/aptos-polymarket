/**
 * useTradePriceHistory - Build price history by replaying trades from Geomi
 *
 * Since trade events only store new_price for ONE outcome, we replay all trades
 * to reconstruct the full price history for all outcomes.
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Aptos, AptosConfig, Network } from '@aptos-labs/ts-sdk';
import { fetchLatestTrades, type GeomiTrade } from '../utils/geomiClient';
import { subscribeToTrades, type LiveTrade } from './useLiveTrades';

const CONTRACT_ADDRESS = import.meta.env.VITE_CONTRACT_ADDRESS || '0xca4d40eae9f07fb28a121862d649203fb4335ece9536ee51790e19f812ff7aea';

// RPC client for fetching current prices
const RPC_URL = import.meta.env.VITE_RPC_URL || 'https://api.testnet.aptoslabs.com/v1';
const aptos = new Aptos(new AptosConfig({
  network: Network.TESTNET,
  fullnode: RPC_URL,
}));

// LocalStorage cache for trade history
const LS_TRADE_HISTORY_PREFIX = 'trade_history_';
const LS_CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

interface TradeHistoryCache {
  priceHistory: TradePricePoint[];
  currentPrices: number[];
  tradesProcessed: number;
  timestamp: number;
}

function loadTradeHistoryFromLS(marketAddress: string): TradeHistoryCache | null {
  try {
    const key = LS_TRADE_HISTORY_PREFIX + marketAddress.slice(0, 16);
    const cached = localStorage.getItem(key);
    if (!cached) return null;
    const parsed = JSON.parse(cached) as TradeHistoryCache;
    if (Date.now() - parsed.timestamp > LS_CACHE_TTL_MS) {
      localStorage.removeItem(key);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function saveTradeHistoryToLS(marketAddress: string, cache: TradeHistoryCache): void {
  try {
    const key = LS_TRADE_HISTORY_PREFIX + marketAddress.slice(0, 16);
    localStorage.setItem(key, JSON.stringify(cache));
  } catch {
    // Storage full or disabled
  }
}

export interface TradePricePoint {
  timestamp: number;
  prices: number[]; // Normalized prices (0-1 range) for each outcome
}

interface UseTradePriceHistoryReturn {
  priceHistory: TradePricePoint[];
  currentPrices: number[];
  isLoading: boolean;
  error: string | null;
  tradesProcessed: number;
}

const MAX_HISTORY_POINTS = 500;

/**
 * Fetch current normalized prices from contract
 */
async function fetchCurrentPrices(marketAddress: string): Promise<number[]> {
  try {
    const result = await aptos.view({
      payload: {
        function: `${CONTRACT_ADDRESS}::multi_outcome_market::get_all_prices`,
        typeArguments: [],
        functionArguments: [marketAddress],
      },
    });

    const rawPrices = (result[0] as string[]).map(p => parseInt(p));
    const priceSum = rawPrices.reduce((a, b) => a + b, 0);
    return rawPrices.map(p => priceSum > 0 ? p / priceSum : 1 / rawPrices.length);
  } catch (err) {
    console.error('Error fetching prices:', err);
    return [];
  }
}

/**
 * Replay trades to build price history
 *
 * Strategy:
 * 1. Start with equal prices (1/n for n outcomes)
 * 2. For each trade, we know the traded outcome's new_price
 * 3. Adjust that outcome's price, redistribute others proportionally
 * 4. Always normalize so sum = 1.0
 */
function replayTrades(trades: GeomiTrade[], outcomeCount: number): TradePricePoint[] {
  if (trades.length === 0 || outcomeCount === 0) return [];

  // Sort trades by timestamp ascending (oldest first)
  // Geomi timestamps come without 'Z' suffix - append it for proper UTC parsing
  const sortedTrades = [...trades].sort((a, b) => {
    const tsA = a.timestamp.endsWith('Z') ? a.timestamp : a.timestamp + 'Z';
    const tsB = b.timestamp.endsWith('Z') ? b.timestamp : b.timestamp + 'Z';
    return new Date(tsA).getTime() - new Date(tsB).getTime();
  });

  const history: TradePricePoint[] = [];

  // Initialize with equal prices
  const equalPrice = 1 / outcomeCount;
  let currentPrices = new Array(outcomeCount).fill(equalPrice);

  // Add initial point (before any trades)
  const firstTs = sortedTrades[0].timestamp;
  const firstTsFixed = firstTs.endsWith('Z') ? firstTs : firstTs + 'Z';
  const firstTradeTime = new Date(firstTsFixed).getTime();
  history.push({
    timestamp: firstTradeTime - 1000, // 1 second before first trade
    prices: [...currentPrices],
  });

  console.log(`[TradeReplay] Starting with equal prices, first trade at ${new Date(firstTradeTime).toISOString()}`);

  // Process each trade
  for (const trade of sortedTrades) {
    // Geomi timestamps come without 'Z' suffix - they are UTC but JS parses as local
    // Append 'Z' to force UTC parsing
    const timestampStr = trade.timestamp.endsWith('Z') ? trade.timestamp : trade.timestamp + 'Z';
    const timestamp = new Date(timestampStr).getTime();
    // Parse outcome_index as number (Geomi may return it as string)
    const outcomeIndex = typeof trade.outcome_index === 'string'
      ? parseInt(trade.outcome_index)
      : trade.outcome_index;
    const isBuy = trade.event_type.includes('Bought');

    // The new_price from contract is on a 0-100 scale
    // But it represents the raw price, not normalized percentage
    // We need to infer the price change from the trade direction and size

    // Approximate price impact based on trade size relative to typical market
    // collateral_amount is in octas (1e-8)
    const tradeSize = parseInt(trade.collateral_amount) / 100_000_000;

    // Estimate price impact (larger trades = larger impact)
    // This is a rough approximation - real AMM math would be more accurate
    const baseImpact = Math.min(0.15, tradeSize / 1000); // Cap at 15% impact
    const priceImpact = isBuy ? baseImpact : -baseImpact;

    if (outcomeIndex >= 0 && outcomeIndex < outcomeCount) {
      // Update the traded outcome's price
      const oldPrice = currentPrices[outcomeIndex];
      let newPrice = oldPrice + priceImpact;
      newPrice = Math.max(0.05, Math.min(0.90, newPrice)); // Clamp to reasonable range

      // Calculate how much to redistribute to other outcomes
      const priceDiff = newPrice - oldPrice;

      // Redistribute the difference proportionally among other outcomes
      const otherSum = currentPrices.reduce((sum, p, i) =>
        i === outcomeIndex ? sum : sum + p, 0
      );

      for (let i = 0; i < outcomeCount; i++) {
        if (i === outcomeIndex) {
          currentPrices[i] = newPrice;
        } else if (otherSum > 0) {
          // Subtract proportionally from others
          const proportion = currentPrices[i] / otherSum;
          currentPrices[i] = Math.max(0.05, currentPrices[i] - priceDiff * proportion);
        }
      }

      // Normalize to ensure sum = 1.0
      const sum = currentPrices.reduce((a, b) => a + b, 0);
      if (sum > 0) {
        currentPrices = currentPrices.map(p => p / sum);
      }
    }

    // Add price point at this trade's timestamp
    history.push({
      timestamp,
      prices: [...currentPrices],
    });
  }

  return history;
}

/**
 * Build price history from trade data
 */
export function useTradePriceHistory(
  marketAddress: string | undefined,
  outcomeCount: number = 4,
  pollInterval: number = 5000
): UseTradePriceHistoryReturn {
  // Initialize from localStorage cache for instant load
  const getInitialState = () => {
    if (!marketAddress) return { priceHistory: [], currentPrices: [], tradesProcessed: 0 };
    const cached = loadTradeHistoryFromLS(marketAddress);
    if (cached) {
      return {
        priceHistory: cached.priceHistory,
        currentPrices: cached.currentPrices,
        tradesProcessed: cached.tradesProcessed,
      };
    }
    return { priceHistory: [], currentPrices: [], tradesProcessed: 0 };
  };

  const initial = getInitialState();
  const [priceHistory, setPriceHistory] = useState<TradePricePoint[]>(initial.priceHistory);
  const [currentPrices, setCurrentPrices] = useState<number[]>(initial.currentPrices);
  const [isLoading, setIsLoading] = useState(initial.priceHistory.length === 0);
  const [error, setError] = useState<string | null>(null);
  const [tradesProcessed, setTradesProcessed] = useState(initial.tradesProcessed);

  const lastMarketRef = useRef<string | undefined>(marketAddress);
  const lastTradeCountRef = useRef<number>(initial.tradesProcessed);

  // Reset when market changes - but try to load from cache first
  useEffect(() => {
    if (lastMarketRef.current !== marketAddress) {
      const cached = marketAddress ? loadTradeHistoryFromLS(marketAddress) : null;
      if (cached) {
        setPriceHistory(cached.priceHistory);
        setCurrentPrices(cached.currentPrices);
        setTradesProcessed(cached.tradesProcessed);
        setIsLoading(false);
        lastTradeCountRef.current = cached.tradesProcessed;
      } else {
        setPriceHistory([]);
        setCurrentPrices([]);
        setIsLoading(true);
        setTradesProcessed(0);
        lastTradeCountRef.current = 0;
      }
      setError(null);
      lastMarketRef.current = marketAddress;
    }
  }, [marketAddress]);

  // Fetch trades and build history
  const fetchAndBuildHistory = useCallback(async () => {
    if (!marketAddress) return;

    try {
      // 1. Fetch all trades from Geomi
      const trades = await fetchLatestTrades(marketAddress, 200);
      console.log(`[TradePriceHistory] Fetched ${trades.length} trades for market ${marketAddress.slice(0, 10)}...`);

      // 2. Fetch current prices from contract (ground truth for final state)
      const currentNormalizedPrices = await fetchCurrentPrices(marketAddress);

      if (currentNormalizedPrices.length > 0) {
        setCurrentPrices(currentNormalizedPrices);
      }

      // 3. Only rebuild if we have new trades
      if (trades.length !== lastTradeCountRef.current) {
        lastTradeCountRef.current = trades.length;

        if (trades.length > 0) {
          // Replay trades to build history
          const oc = currentNormalizedPrices.length || outcomeCount;
          let history = replayTrades(trades, oc);
          console.log(`[TradePriceHistory] Replayed ${trades.length} trades -> ${history.length} price points`);

          // Adjust final prices to match current on-chain prices (ground truth)
          if (history.length > 0 && currentNormalizedPrices.length > 0) {
            // Add current time point with actual on-chain prices
            history.push({
              timestamp: Date.now(),
              prices: [...currentNormalizedPrices],
            });
          }

          // Log the last few price points for debugging
          if (history.length > 0) {
            const last = history[history.length - 1];
            console.log(`[TradePriceHistory] Latest prices: ${last.prices.map(p => (p * 100).toFixed(1) + '%').join(', ')}`);
          }

          const trimmedHistory = history.slice(-MAX_HISTORY_POINTS);
          setPriceHistory(trimmedHistory);
          setTradesProcessed(trades.length);

          // Cache to localStorage for instant load on return
          saveTradeHistoryToLS(marketAddress, {
            priceHistory: trimmedHistory,
            currentPrices: currentNormalizedPrices,
            tradesProcessed: trades.length,
            timestamp: Date.now(),
          });
        }
      }

      setError(null);
      setIsLoading(false);
    } catch (err) {
      console.error('Error building price history:', err);
      setError(err instanceof Error ? err.message : 'Failed to build price history');
      setIsLoading(false);
    }
  }, [marketAddress, outcomeCount]);

  // Initial fetch and polling
  useEffect(() => {
    if (!marketAddress) return;

    fetchAndBuildHistory();
    const interval = setInterval(fetchAndBuildHistory, pollInterval);

    return () => clearInterval(interval);
  }, [fetchAndBuildHistory, pollInterval, marketAddress]);

  // Subscribe to real-time trade events
  useEffect(() => {
    if (!marketAddress) return;

    const unsubscribe = subscribeToTrades((trade: LiveTrade) => {
      if (trade.marketAddress !== marketAddress) return;
      // Trigger rebuild on new trade
      fetchAndBuildHistory();
    });

    return unsubscribe;
  }, [marketAddress, fetchAndBuildHistory]);

  return useMemo(() => ({
    priceHistory,
    currentPrices,
    isLoading,
    error,
    tradesProcessed,
  }), [priceHistory, currentPrices, isLoading, error, tradesProcessed]);
}

// In-flight prefetch promises to avoid duplicate requests
const prefetchPromises = new Map<string, Promise<void>>();

/**
 * Pre-fetch trade history for a market (call on hover/visibility)
 * This warms up the cache so the market detail page loads instantly
 */
export async function prefetchTradeHistory(marketAddress: string, outcomeCount: number = 4): Promise<void> {
  // Check if already cached
  const cached = loadTradeHistoryFromLS(marketAddress);
  if (cached) return;

  // Check if already fetching
  const existing = prefetchPromises.get(marketAddress);
  if (existing) return existing;

  const fetchPromise = (async () => {
    try {
      const trades = await fetchLatestTrades(marketAddress, 200);
      const currentPrices = await fetchCurrentPrices(marketAddress);

      if (trades.length > 0) {
        const oc = currentPrices.length || outcomeCount;
        let history = replayTrades(trades, oc);

        if (history.length > 0 && currentPrices.length > 0) {
          history.push({ timestamp: Date.now(), prices: [...currentPrices] });
        }

        saveTradeHistoryToLS(marketAddress, {
          priceHistory: history.slice(-MAX_HISTORY_POINTS),
          currentPrices,
          tradesProcessed: trades.length,
          timestamp: Date.now(),
        });
      }
    } catch (err) {
      console.warn('[Prefetch] Failed to prefetch trade history:', err);
    } finally {
      prefetchPromises.delete(marketAddress);
    }
  })();

  prefetchPromises.set(marketAddress, fetchPromise);
  return fetchPromise;
}

/**
 * Get price history for a specific timeframe
 */
export function getTimeframeTradePrices(
  history: TradePricePoint[],
  outcomeIndex: number,
  timeframeMs: number
): number[] {
  const now = Date.now();
  const cutoff = now - timeframeMs;

  const relevantPoints = history.filter(p => p.timestamp >= cutoff);

  if (relevantPoints.length === 0) {
    return [];
  }

  return relevantPoints.map(p => p.prices[outcomeIndex] || 0);
}
