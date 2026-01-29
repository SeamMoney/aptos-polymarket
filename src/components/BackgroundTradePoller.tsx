/**
 * BackgroundTradePoller - Polls Geomi for trades across all markets
 *
 * This component runs in the background and ensures trades are captured
 * for all markets, not just the currently viewed one. This way, when
 * the user navigates to a different market, trades are already in localStorage.
 *
 * Minimal and safe:
 * - No changes to existing hooks
 * - Uses same localStorage format as useLiveTrades
 * - Gracefully handles errors without affecting the rest of the app
 */

import { useEffect, useRef } from 'react';
import { fetchTradesWithFallback, geomiTradeToLiveTrade } from '../utils/geomiClient';
import type { LiveTrade } from '../hooks/useLiveTrades';

const TRADES_STORAGE_KEY = 'polymarket_live_trades';
const MAX_STORED_TRADES = 500; // Store more since we're tracking multiple markets
const POLL_INTERVAL_MS = 5000; // 5 seconds
const TRADES_PER_MARKET = 50;

interface BackgroundTradePollerProps {
  marketAddresses: string[];
  enabled?: boolean;
}

/**
 * Load existing trades from localStorage
 */
function loadStoredTrades(): LiveTrade[] {
  try {
    const stored = localStorage.getItem(TRADES_STORAGE_KEY);
    if (!stored) return [];
    return JSON.parse(stored);
  } catch {
    return [];
  }
}

/**
 * Save trades to localStorage (same format as useLiveTrades)
 */
function saveStoredTrades(trades: LiveTrade[]): void {
  try {
    const toStore = trades.slice(0, MAX_STORED_TRADES);
    localStorage.setItem(TRADES_STORAGE_KEY, JSON.stringify(toStore));
  } catch {
    // localStorage might be full or disabled - silently ignore
  }
}

/**
 * Merge new trades with existing, deduplicate, and sort
 */
function mergeAndDedupe(existing: LiveTrade[], newTrades: LiveTrade[]): LiveTrade[] {
  const all = [...newTrades, ...existing];

  // Deduplicate by id
  const seen = new Set<string>();
  const unique: LiveTrade[] = [];
  for (const trade of all) {
    if (!seen.has(trade.id)) {
      seen.add(trade.id);
      unique.push(trade);
    }
  }

  // Sort by timestamp descending
  return unique.sort((a, b) => b.timestamp - a.timestamp);
}

export function BackgroundTradePoller({
  marketAddresses,
  enabled = true
}: BackgroundTradePollerProps) {
  const isPollingRef = useRef(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    if (!enabled || marketAddresses.length === 0) {
      return;
    }

    async function pollAllMarkets() {
      // Prevent overlapping polls
      if (isPollingRef.current || !mountedRef.current) return;
      isPollingRef.current = true;

      try {
        const existingTrades = loadStoredTrades();
        const allNewTrades: LiveTrade[] = [];

        // Poll each market (in parallel for speed, but limit concurrency)
        const batchSize = 5; // Poll 5 markets at a time
        for (let i = 0; i < marketAddresses.length; i += batchSize) {
          if (!mountedRef.current) break;

          const batch = marketAddresses.slice(i, i + batchSize);
          const results = await Promise.allSettled(
            batch.map(async (marketAddress) => {
              const { trades } = await fetchTradesWithFallback(marketAddress, TRADES_PER_MARKET);
              return trades.map(t => {
                const converted = geomiTradeToLiveTrade(t);
                return {
                  ...converted,
                  marketAddress: t.market_address,
                } as LiveTrade;
              });
            })
          );

          // Collect successful results
          for (const result of results) {
            if (result.status === 'fulfilled') {
              allNewTrades.push(...result.value);
            }
          }
        }

        // Merge with existing and save
        if (allNewTrades.length > 0 && mountedRef.current) {
          const merged = mergeAndDedupe(existingTrades, allNewTrades);
          saveStoredTrades(merged);
        }
      } catch (error) {
        // Silently handle errors - don't disrupt the app
        console.debug('[BackgroundTradePoller] Poll error:', error);
      } finally {
        isPollingRef.current = false;
      }
    }

    // Initial poll
    pollAllMarkets();

    // Set up interval
    const interval = setInterval(pollAllMarkets, POLL_INTERVAL_MS);

    return () => {
      clearInterval(interval);
    };
  }, [marketAddresses, enabled]);

  // This component renders nothing
  return null;
}
