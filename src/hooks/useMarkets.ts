import { useState, useEffect, useCallback, useRef } from 'react';
import { Aptos, AptosConfig, Network } from '@aptos-labs/ts-sdk';
import { PREDICTION_MARKET_ADDRESS } from '../utils/contracts';

const aptosConfig = new AptosConfig({ network: Network.TESTNET });
const aptos = new Aptos(aptosConfig);

export interface OnChainMarket {
  address: string;
  question: string;
  description: string;
  endTime: number;
  resolved: boolean;
  outcome: boolean | null;
  yesReserve: number;
  noReserve: number;
  yesPrice: number;
  noPrice: number;
  creator: string;
}

// Global cache for markets (persists across component remounts)
let marketsCache: OnChainMarket[] | null = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 60_000; // Cache for 60 seconds

// Helper to delay between API calls - MUCH longer delays to preserve rate limit
const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

export function useMarkets() {
  const [markets, setMarkets] = useState<OnChainMarket[]>(marketsCache || []);
  const [loading, setLoading] = useState(!marketsCache);
  const [error, setError] = useState<string | null>(null);
  const fetchedRef = useRef(false);

  const fetchMarkets = useCallback(async (force = false) => {
    // Use cache if valid
    const now = Date.now();
    if (!force && marketsCache && (now - cacheTimestamp) < CACHE_TTL_MS) {
      setMarkets(marketsCache);
      setLoading(false);
      return;
    }

    // Prevent double fetch in React Strict Mode
    if (fetchedRef.current && !force) return;
    fetchedRef.current = true;

    try {
      setLoading(true);
      setError(null);

      // Wait before making the first call
      await delay(1000);

      // Get all market addresses
      const addressesResult = await aptos.view({
        payload: {
          function: `${PREDICTION_MARKET_ADDRESS}::market::get_all_markets`,
          functionArguments: [],
        },
      });

      const addresses = (addressesResult[0] as string[]) || [];

      if (addresses.length === 0) {
        setMarkets([]);
        marketsCache = [];
        cacheTimestamp = Date.now();
        setLoading(false);
        return;
      }

      // Fetch details for each market SEQUENTIALLY with LONG delays
      const marketDetails: OnChainMarket[] = [];

      for (const address of addresses) {
        try {
          await delay(3000); // Wait 3s between market fetches to preserve rate limit

          const infoResult = await aptos.view({
            payload: {
              function: `${PREDICTION_MARKET_ADDRESS}::market::get_market_info`,
              functionArguments: [address],
            },
          });

          await delay(2000); // Wait 2s before price fetch

          const priceResult = await aptos.view({
            payload: {
              function: `${PREDICTION_MARKET_ADDRESS}::market::get_yes_price`,
              functionArguments: [address],
            },
          });

          const yesPrice = Number(priceResult[0]);
          const yesReserve = Number(infoResult[5]);
          const noReserve = Number(infoResult[6]);

          // Parse outcome option
          let outcome: boolean | null = null;
          const outcomeVec = infoResult[4] as { vec: boolean[] };
          if (outcomeVec && outcomeVec.vec && outcomeVec.vec.length > 0) {
            outcome = outcomeVec.vec[0];
          }

          marketDetails.push({
            address,
            question: infoResult[0] as string,
            description: infoResult[1] as string,
            endTime: Number(infoResult[2]),
            resolved: infoResult[3] as boolean,
            outcome,
            yesReserve,
            noReserve,
            yesPrice,
            noPrice: 100 - yesPrice,
            creator: '',
          });
        } catch (err: any) {
          // Check for rate limit error
          if (err.message?.includes('429') || err.message?.includes('rate limit')) {
            console.warn('Rate limited - using cached/fallback data for remaining markets');
            break; // Stop fetching more markets
          }
          console.error(`Error fetching market ${address}:`, err);
          // Add fallback market data
          marketDetails.push({
            address,
            question: 'Market (loading...)',
            description: 'Fetching data...',
            endTime: 0,
            resolved: false,
            outcome: null,
            yesReserve: 0,
            noReserve: 0,
            yesPrice: 50,
            noPrice: 50,
            creator: '',
          });
        }
      }

      setMarkets(marketDetails);
      marketsCache = marketDetails;
      cacheTimestamp = Date.now();
    } catch (err: any) {
      console.error('Error fetching markets:', err);
      // On rate limit, use cached data if available
      if (err.message?.includes('429') || err.message?.includes('rate limit')) {
        if (marketsCache) {
          setMarkets(marketsCache);
          setError('Rate limited - showing cached data');
          return;
        }
      }
      setError(err instanceof Error ? err.message : 'Failed to fetch markets');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMarkets();
  }, [fetchMarkets]);

  // Allow manual refetch (resets the fetchedRef and forces refresh)
  const refetch = useCallback(() => {
    fetchedRef.current = false;
    fetchMarkets(true);
  }, [fetchMarkets]);

  return { markets, loading, error, refetch };
}
