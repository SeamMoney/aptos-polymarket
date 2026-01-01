import { useState, useEffect, useCallback, useRef } from 'react';
import { Aptos, AptosConfig, Network } from '@aptos-labs/ts-sdk';

const CONTRACT_ADDRESS = "0xa2e5e47aab07fed78a3bcf95135ee2dad20c547499c94cb16a3e047859ffa7e1";
const MARKET_ADDRESS = "0xfefd1b67818ee4ef12a7953852c83f0efb411a9b92c518a52ba92555e4abdd96";

const aptos = new Aptos(new AptosConfig({ network: Network.TESTNET }));

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

export function useLivePrices(pollInterval: number = 3000): UseLivePricesReturn {
  const [currentPrices, setCurrentPrices] = useState<number[]>([]);
  const [priceHistory, setPriceHistory] = useState<PricePoint[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<number | null>(null);
  const historyRef = useRef<PricePoint[]>([]);

  const fetchPrices = useCallback(async () => {
    try {
      const result = await aptos.view({
        payload: {
          function: `${CONTRACT_ADDRESS}::multi_outcome_market::get_all_prices`,
          typeArguments: [],
          functionArguments: [MARKET_ADDRESS],
        },
      });

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
  }, []);

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
