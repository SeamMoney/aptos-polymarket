/**
 * useRealtimePrices - High-frequency price updates for order book
 *
 * Polls the contract every 300ms for real-time price updates.
 * Also subscribes to trade events for immediate updates.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { Aptos, AptosConfig, Network } from '@aptos-labs/ts-sdk';
import { subscribeToTrades, type LiveTrade } from './useLiveTrades';

const CONTRACT_ADDRESS = import.meta.env.VITE_CONTRACT_ADDRESS || '0xca4d40eae9f07fb28a121862d649203fb4335ece9536ee51790e19f812ff7aea';

// Fast RPC client
const RPC_URL = import.meta.env.VITE_RPC_URL || 'https://api.testnet.aptoslabs.com/v1';
const aptos = new Aptos(new AptosConfig({
  network: Network.TESTNET,
  fullnode: RPC_URL,
}));

interface RealtimePricesReturn {
  prices: number[];           // Normalized prices (0-1) for each outcome
  rawPrices: number[];        // Raw prices from contract
  totalCollateral: number;    // TVL in USD1
  lastUpdate: number;         // Timestamp of last update
  isPolling: boolean;         // Whether actively polling
  updateCount: number;        // Number of updates received
}

/**
 * High-frequency price polling for order book visualization
 *
 * @param marketAddress - The market to track
 * @param pollInterval - Polling interval in ms (default: 300ms for ~3 updates/sec)
 * @param enabled - Whether to poll
 */
export function useRealtimePrices(
  marketAddress: string | undefined,
  pollInterval: number = 300,
  enabled: boolean = true
): RealtimePricesReturn {
  const [prices, setPrices] = useState<number[]>([]);
  const [rawPrices, setRawPrices] = useState<number[]>([]);
  const [totalCollateral, setTotalCollateral] = useState<number>(0);
  const [lastUpdate, setLastUpdate] = useState<number>(0);
  const [isPolling, setIsPolling] = useState(false);
  const [updateCount, setUpdateCount] = useState(0);

  const mountedRef = useRef(true);
  const lastPricesRef = useRef<string>('');

  // Fetch current prices from contract
  const fetchPrices = useCallback(async () => {
    if (!marketAddress || !enabled) return;

    try {
      // Fetch both prices and market info in parallel
      const [pricesResult, infoResult] = await Promise.all([
        aptos.view({
          payload: {
            function: `${CONTRACT_ADDRESS}::multi_outcome_market::get_all_prices`,
            typeArguments: [],
            functionArguments: [marketAddress],
          },
        }),
        aptos.view({
          payload: {
            function: `${CONTRACT_ADDRESS}::multi_outcome_market::get_multi_market_info`,
            typeArguments: [],
            functionArguments: [marketAddress],
          },
        }),
      ]);

      if (!mountedRef.current) return;

      // Parse prices
      const rawPricesArray = (pricesResult[0] as string[]).map(p => parseInt(p));
      const priceSum = rawPricesArray.reduce((a, b) => a + b, 0);
      const normalizedPrices = rawPricesArray.map(p => priceSum > 0 ? p / priceSum : 1 / rawPricesArray.length);

      // Check if prices actually changed (to avoid unnecessary re-renders)
      const pricesKey = normalizedPrices.map(p => p.toFixed(6)).join(',');
      if (pricesKey !== lastPricesRef.current) {
        lastPricesRef.current = pricesKey;

        setPrices(normalizedPrices);
        setRawPrices(rawPricesArray);
        setLastUpdate(Date.now());
        setUpdateCount(prev => prev + 1);
      }

      // Parse total collateral (TVL)
      // Result: [question, description, category, outcome_count, end_time, resolved, winning_outcome, total_collateral]
      const collateral = parseInt(infoResult[7] as string) / 100_000_000;
      setTotalCollateral(collateral);

      setIsPolling(true);
    } catch (err) {
      console.warn('[RealtimePrices] Fetch error:', err);
    }
  }, [marketAddress, enabled]);

  // High-frequency polling
  useEffect(() => {
    if (!marketAddress || !enabled) {
      setIsPolling(false);
      return;
    }

    mountedRef.current = true;

    // Initial fetch
    fetchPrices();

    // Poll at high frequency
    const interval = setInterval(fetchPrices, pollInterval);

    return () => {
      mountedRef.current = false;
      clearInterval(interval);
      setIsPolling(false);
    };
  }, [marketAddress, enabled, pollInterval, fetchPrices]);

  // Subscribe to trade events for immediate updates
  useEffect(() => {
    if (!marketAddress || !enabled) return;

    const unsubscribe = subscribeToTrades((trade: LiveTrade) => {
      // Only react to trades on this market
      if (trade.marketAddress?.toLowerCase() !== marketAddress.toLowerCase()) return;

      // Immediately fetch new prices when a trade occurs
      fetchPrices();
    });

    return unsubscribe;
  }, [marketAddress, enabled, fetchPrices]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  return {
    prices,
    rawPrices,
    totalCollateral,
    lastUpdate,
    isPolling,
    updateCount,
  };
}
