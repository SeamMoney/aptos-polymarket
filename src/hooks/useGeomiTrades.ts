/**
 * useGeomiTrades - Fetch trades from Geomi No-Code Indexer
 *
 * Provides real-time trade data by polling the Geomi GraphQL API.
 * Returns trades in the LiveTrade format for compatibility with existing UI.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  fetchUserTrades,
  fetchTradesWithFallback,
  type GeomiTrade,
  geomiTradeToLiveTrade,
} from '../utils/geomiClient';
import { isGeomiConfigured } from '../config/geomi';
import type { LiveTrade } from './useLiveTrades';

interface UseGeomiTradesOptions {
  pollInterval?: number;  // ms between polls (default: 5000)
  limit?: number;         // max trades to fetch (default: 50)
  enabled?: boolean;      // whether to poll (default: true)
}

interface UseGeomiTradesReturn {
  trades: LiveTrade[];
  rawTrades: GeomiTrade[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  isConfigured: boolean;
  dataSource: 'geomi' | 'aptos_api' | 'none';  // Where trades are coming from
}

/**
 * Fetch trades for a specific market
 */
export function useGeomiTrades(
  marketAddress?: string,
  options: UseGeomiTradesOptions = {}
): UseGeomiTradesReturn {
  const {
    pollInterval = 5000,
    limit = 50,
    enabled = true,
  } = options;

  const [rawTrades, setRawTrades] = useState<GeomiTrade[]>([]);
  const [trades, setTrades] = useState<LiveTrade[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [dataSource, setDataSource] = useState<'geomi' | 'aptos_api' | 'none'>('none');

  const isConfigured = isGeomiConfigured();
  const lastFetchRef = useRef<number>(0);

  const fetchTrades = useCallback(async () => {
    // Always try to fetch (Aptos API fallback doesn't require Geomi config)
    if (!enabled) {
      return;
    }

    // Debounce rapid calls
    const now = Date.now();
    if (now - lastFetchRef.current < 1000) {
      return;
    }
    lastFetchRef.current = now;

    setIsLoading(true);
    setError(null);

    try {
      // Use fallback function that tries Geomi first, then Aptos API
      const result = await fetchTradesWithFallback(marketAddress, limit);

      console.log('[useGeomiTrades] Fetched trades:', {
        marketAddress,
        source: result.source,
        count: result.trades.length,
        firstTrade: result.trades[0] ? {
          tx_hash: result.trades[0].tx_hash,
          market_address: result.trades[0].market_address,
          timestamp: result.trades[0].timestamp,
        } : null,
      });

      setRawTrades(result.trades);
      setDataSource(result.source);

      // Convert to LiveTrade format
      const liveTrades: LiveTrade[] = result.trades.map(t => {
        const converted = geomiTradeToLiveTrade(t);
        return {
          id: converted.id,
          type: converted.type,
          outcomeIndex: converted.outcomeIndex,
          amount: converted.amount,
          price: converted.price,
          timestamp: converted.timestamp,
          txHash: converted.txHash,
          trader: converted.trader,
          marketAddress: t.market_address,  // Include market address for filtering
        };
      });

      setTrades(liveTrades);
    } catch (err) {
      console.error('Error fetching trades:', err);
      setError(err instanceof Error ? err : new Error(String(err)));
      setDataSource('none');
    } finally {
      setIsLoading(false);
    }
  }, [enabled, marketAddress, limit]);

  // Initial fetch and polling
  useEffect(() => {
    if (!enabled) {
      return;
    }

    // Initial fetch
    fetchTrades();

    // Set up polling
    const interval = setInterval(fetchTrades, pollInterval);

    return () => clearInterval(interval);
  }, [enabled, pollInterval, fetchTrades]);

  return {
    trades,
    rawTrades,
    isLoading,
    error,
    refetch: fetchTrades,
    isConfigured,
    dataSource,
  };
}

/**
 * Fetch trades for a specific user
 */
export function useGeomiUserTrades(
  userAddress?: string,
  options: UseGeomiTradesOptions = {}
): UseGeomiTradesReturn {
  const {
    pollInterval = 10000,  // Less frequent for user trades
    limit = 100,
    enabled = true,
  } = options;

  const [rawTrades, setRawTrades] = useState<GeomiTrade[]>([]);
  const [trades, setTrades] = useState<LiveTrade[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [dataSource, setDataSource] = useState<'geomi' | 'aptos_api' | 'none'>('none');

  const isConfigured = isGeomiConfigured();

  const fetchTrades = useCallback(async () => {
    if (!isConfigured || !enabled || !userAddress) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const geomiTrades = await fetchUserTrades(userAddress, limit);

      setRawTrades(geomiTrades);
      setDataSource(geomiTrades.length > 0 ? 'geomi' : 'none');

      // Convert to LiveTrade format
      const liveTrades: LiveTrade[] = geomiTrades.map(t => {
        const converted = geomiTradeToLiveTrade(t);
        return {
          id: converted.id,
          type: converted.type,
          outcomeIndex: converted.outcomeIndex,
          amount: converted.amount,
          price: converted.price,
          timestamp: converted.timestamp,
          txHash: converted.txHash,
          trader: converted.trader,
          marketAddress: t.market_address,
        };
      });

      setTrades(liveTrades);
    } catch (err) {
      console.error('Error fetching user trades from Geomi:', err);
      setError(err instanceof Error ? err : new Error(String(err)));
      setDataSource('none');
    } finally {
      setIsLoading(false);
    }
  }, [isConfigured, enabled, userAddress, limit]);

  // Initial fetch and polling
  useEffect(() => {
    if (!enabled || !isConfigured || !userAddress) {
      return;
    }

    // Initial fetch
    fetchTrades();

    // Set up polling
    const interval = setInterval(fetchTrades, pollInterval);

    return () => clearInterval(interval);
  }, [enabled, isConfigured, userAddress, pollInterval, fetchTrades]);

  return {
    trades,
    rawTrades,
    isLoading,
    error,
    refetch: fetchTrades,
    isConfigured,
    dataSource,
  };
}

export type { GeomiTrade };
