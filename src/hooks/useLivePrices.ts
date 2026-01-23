import { useState, useEffect, useCallback, useRef } from 'react';
import { Aptos, AptosConfig, Network } from '@aptos-labs/ts-sdk';

const CONTRACT_ADDRESS = import.meta.env.VITE_CONTRACT_ADDRESS || "0xca4d40eae9f07fb28a121862d649203fb4335ece9536ee51790e19f812ff7aea";
// Default market address (first from VITE_MULTI_MARKETS) - used only as fallback
const DEFAULT_MARKET_ADDRESS = import.meta.env.VITE_MULTI_MARKETS?.split(',')[0] || "0x3e690f317df664c413e12b15eaa6e5565606fbd46628464f84f93e0674a3c052";

// RPC endpoints in priority order (custom fullnode first, Aptos Labs fallback)
const RPC_ENDPOINTS = [
  'https://aptos.cash.trading/v1',      // Custom fullnode - no rate limits
  'https://api.testnet.aptoslabs.com/v1', // Aptos Labs fallback
];

// Create Aptos clients for failover
const aptosClients = RPC_ENDPOINTS.map(url => new Aptos(new AptosConfig({
  network: Network.TESTNET,
  fullnode: url,
})));

// Helper to fetch with failover
async function fetchWithFailover<T>(
  fn: (client: Aptos) => Promise<T>
): Promise<T> {
  for (let i = 0; i < aptosClients.length; i++) {
    try {
      return await fn(aptosClients[i]);
    } catch (err) {
      if (i === aptosClients.length - 1) throw err;
      // Continue to next endpoint
    }
  }
  throw new Error('All RPC endpoints failed');
}

export interface PricePoint {
  timestamp: number;
  prices: number[]; // Normalized prices (0-1) for each outcome
}

interface UseLivePricesReturn {
  currentPrices: number[];           // Current normalized prices
  priceHistory: PricePoint[];        // Historical price points
  isConnected: boolean;
  lastUpdate: number | null;
}

// Max history points to keep (about 2 hours at 3s intervals)
const MAX_HISTORY_POINTS = 2400;

export function useLivePrices(marketAddress?: string, pollInterval: number = 3000): UseLivePricesReturn {
  // Use provided market address or fall back to default
  const effectiveMarketAddress = marketAddress || DEFAULT_MARKET_ADDRESS;

  const [currentPrices, setCurrentPrices] = useState<number[]>([]);
  const [priceHistory, setPriceHistory] = useState<PricePoint[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<number | null>(null);
  const historyRef = useRef<PricePoint[]>([]);
  const lastMarketRef = useRef<string>(effectiveMarketAddress);

  // Clear history when market address changes
  useEffect(() => {
    if (lastMarketRef.current !== effectiveMarketAddress) {
      historyRef.current = [];
      setPriceHistory([]);
      setCurrentPrices([]);
      lastMarketRef.current = effectiveMarketAddress;
    }
  }, [effectiveMarketAddress]);

  const fetchPrices = useCallback(async () => {
    if (!effectiveMarketAddress) return;

    try {
      const result = await fetchWithFailover(client => client.view({
        payload: {
          function: `${CONTRACT_ADDRESS}::multi_outcome_market::get_all_prices`,
          typeArguments: [],
          functionArguments: [effectiveMarketAddress],
        },
      }));

      const rawPrices = (result[0] as string[]).map(p => parseInt(p));
      const priceSum = rawPrices.reduce((a, b) => a + b, 0);
      const normalizedPrices = rawPrices.map(p => priceSum > 0 ? p / priceSum : 1 / rawPrices.length);

      const now = Date.now();

      // Check if prices actually changed (compare with last entry in history)
      const lastPoint = historyRef.current[historyRef.current.length - 1];
      const pricesChanged = !lastPoint || normalizedPrices.some(
        (p, i) => Math.abs(p - (lastPoint.prices[i] || 0)) > 0.0001
      );

      // Update current prices
      setCurrentPrices(normalizedPrices);
      setLastUpdate(now);
      setIsConnected(true);

      // Only add to history if prices actually changed
      if (pricesChanged) {
        const newPoint: PricePoint = {
          timestamp: now,
          prices: normalizedPrices,
        };

        historyRef.current = [...historyRef.current, newPoint].slice(-MAX_HISTORY_POINTS);
        setPriceHistory(historyRef.current);
      }

    } catch (error) {
      console.error('Error fetching prices:', error);
      setIsConnected(false);
    }
  }, [effectiveMarketAddress]);

  // Poll for prices
  useEffect(() => {
    // Initial fetch
    fetchPrices();

    // Set up polling
    const interval = setInterval(fetchPrices, pollInterval);

    return () => clearInterval(interval);
  }, [fetchPrices, pollInterval]);

  return {
    currentPrices,
    priceHistory,
    isConnected,
    lastUpdate,
  };
}

// Get price history for a specific timeframe
export function getTimeframePrices(
  history: PricePoint[],
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

// Timeframe durations in milliseconds
export const TIMEFRAMES = {
  '1H': 60 * 60 * 1000,
  '6H': 6 * 60 * 60 * 1000,
  '1D': 24 * 60 * 60 * 1000,
  '1W': 7 * 24 * 60 * 60 * 1000,
  '1M': 30 * 24 * 60 * 60 * 1000,
  'ALL': Infinity,
};
