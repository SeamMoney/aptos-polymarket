import { useState, useEffect, useCallback, useRef } from 'react';
import { Aptos, AptosConfig, Network } from '@aptos-labs/ts-sdk';
import { useWallet } from '@aptos-labs/wallet-adapter-react';

const CONTRACT_ADDRESS = '0xa2e5e47aab07fed78a3bcf95135ee2dad20c547499c94cb16a3e047859ffa7e1';
const MODULE = `${CONTRACT_ADDRESS}::multi_outcome_market`;

// Use API key to bypass rate limits (safe for testnet demo)
const API_KEY = 'AG-3JMDT54EN4DCLULDWAUXCYGQ56JJQCYHH';
const aptos = new Aptos(new AptosConfig({
  network: Network.TESTNET,
  clientConfig: { API_KEY },
}));

// Global cache for multi markets
let marketsCache: MultiMarket[] | null = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 60_000; // Cache for 60 seconds

// Helper to delay between API calls
const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

interface Outcome {
  index: number;
  label: string;
  price: number;  // Normalized 0-100
  rawPrice: number;  // Raw price from contract
  userBalance: number;
}

interface MultiMarket {
  address: string;
  question: string;
  description: string;
  category: string;
  outcomes: Outcome[];
  outcomeCount: number;
  endTime: number;
  resolved: boolean;
  winningOutcome: number | null;
  totalCollateral: number;
}

export function useMultiMarkets() {
  const { account } = useWallet();
  const walletAddress = account?.address?.toString();
  const [markets, setMarkets] = useState<MultiMarket[]>(marketsCache || []);
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

      // Small delay before first call
      await delay(100);

      // Get all multi-outcome market addresses
      const result = await aptos.view({
        payload: {
          function: `${MODULE}::get_all_multi_markets`,
          functionArguments: [],
        },
      });

      const marketAddresses = result[0] as string[];

      if (marketAddresses.length === 0) {
        setMarkets([]);
        marketsCache = [];
        cacheTimestamp = Date.now();
        setLoading(false);
        return;
      }

      // Fetch details for each market SEQUENTIALLY with delays
      const fetchedMarkets: MultiMarket[] = [];

      for (const addr of marketAddresses) {
        try {
          await delay(100); // Delay between markets

          // Get market info
          const infoResult = await aptos.view({
            payload: {
              function: `${MODULE}::get_multi_market_info`,
              functionArguments: [addr],
            },
          });

          const [question, description, category, outcomeCount, endTime, resolved, winningOutcome, totalCollateral] =
            infoResult as [string, string, string, string, string, boolean, { vec: string[] }, string];

          await delay(50); // Small delay

          // Get outcome labels
          const labelsResult = await aptos.view({
            payload: {
              function: `${MODULE}::get_outcome_labels`,
              functionArguments: [addr],
            },
          });
          const labels = labelsResult[0] as string[];

          await delay(50); // Small delay

          // Get prices
          const pricesResult = await aptos.view({
            payload: {
              function: `${MODULE}::get_all_prices`,
              functionArguments: [addr],
            },
          });
          const rawPrices = (pricesResult[0] as string[]).map(p => parseInt(p));

          // Normalize prices to sum to 100%
          const priceSum = rawPrices.reduce((acc, p) => acc + p, 0);
          const normalizedPrices = rawPrices.map(p =>
            priceSum > 0 ? (p / priceSum) * 100 : 100 / rawPrices.length
          );

          // Get user positions if wallet connected (skip if rate limited)
          let userBalances: number[] = new Array(parseInt(outcomeCount)).fill(0);
          if (walletAddress) {
            try {
              await delay(50);
              const positionsResult = await aptos.view({
                payload: {
                  function: `${MODULE}::get_user_multi_positions`,
                  functionArguments: [addr, walletAddress],
                },
              });
              userBalances = (positionsResult[0] as string[]).map(b => parseInt(b) / 100_000_000);
            } catch {
              // User might not have positions or rate limited
            }
          }

          // Build outcomes array
          const outcomes: Outcome[] = labels.map((label, i) => ({
            index: i,
            label,
            price: normalizedPrices[i],
            rawPrice: rawPrices[i],
            userBalance: userBalances[i],
          }));

          fetchedMarkets.push({
            address: addr,
            question,
            description,
            category,
            outcomes,
            outcomeCount: parseInt(outcomeCount),
            endTime: parseInt(endTime),
            resolved,
            winningOutcome: winningOutcome.vec.length > 0 ? parseInt(winningOutcome.vec[0]) : null,
            totalCollateral: parseInt(totalCollateral) / 100_000_000,
          });
        } catch (err: unknown) {
          // Check for rate limit error
          const errMsg = err instanceof Error ? err.message : String(err);
          if (errMsg.includes('429') || errMsg.includes('rate') || errMsg.includes('Blocked')) {
            console.warn('Rate limited - using cached data for remaining markets');
            break; // Stop fetching more markets
          }
          console.error(`Error fetching market ${addr}:`, err);
        }
      }

      setMarkets(fetchedMarkets);
      marketsCache = fetchedMarkets;
      cacheTimestamp = Date.now();
      setError(null);
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error('Error fetching multi-outcome markets:', err);
      // On rate limit, use cached data if available
      if (errMsg.includes('429') || errMsg.includes('rate') || errMsg.includes('Blocked')) {
        if (marketsCache) {
          setMarkets(marketsCache);
          setError('Rate limited - showing cached data');
          return;
        }
      }
      setError('Failed to fetch markets');
    } finally {
      setLoading(false);
    }
  }, [walletAddress]);

  // Initial fetch
  useEffect(() => {
    fetchMarkets();
  }, [fetchMarkets]);

  // Refresh every 30 seconds (not 10)
  useEffect(() => {
    const interval = setInterval(() => {
      fetchedRef.current = false;
      fetchMarkets(true);
    }, 30000);
    return () => clearInterval(interval);
  }, [fetchMarkets]);

  // Buy outcome tokens
  const buyOutcome = async (marketAddress: string, outcomeIndex: number, amountAPT: string) => {
    if (!walletAddress) throw new Error('Wallet not connected');

    const amountUnits = Math.floor(parseFloat(amountAPT) * 100_000_000);

    const payload = {
      function: `${MODULE}::buy_outcome`,
      functionArguments: [marketAddress, outcomeIndex, amountUnits, 0],
    };

    return payload;
  };

  // Sell outcome tokens
  const sellOutcome = async (marketAddress: string, outcomeIndex: number, amountTokens: string) => {
    if (!walletAddress) throw new Error('Wallet not connected');

    const amountUnits = Math.floor(parseFloat(amountTokens) * 100_000_000);

    const payload = {
      function: `${MODULE}::sell_outcome`,
      functionArguments: [marketAddress, outcomeIndex, amountUnits, 0],
    };

    return payload;
  };

  // Mint complete set
  const mintCompleteSet = async (marketAddress: string, amountAPT: string) => {
    if (!walletAddress) throw new Error('Wallet not connected');

    const amountUnits = Math.floor(parseFloat(amountAPT) * 100_000_000);

    const payload = {
      function: `${MODULE}::mint_complete_set`,
      functionArguments: [marketAddress, amountUnits],
    };

    return payload;
  };

  // Redeem complete set
  const redeemCompleteSet = async (marketAddress: string, amountTokens: string) => {
    if (!walletAddress) throw new Error('Wallet not connected');

    const amountUnits = Math.floor(parseFloat(amountTokens) * 100_000_000);

    const payload = {
      function: `${MODULE}::redeem_complete_set`,
      functionArguments: [marketAddress, amountUnits],
    };

    return payload;
  };

  // Manual refresh (resets fetchedRef and forces refresh)
  const refresh = useCallback(() => {
    fetchedRef.current = false;
    fetchMarkets(true);
  }, [fetchMarkets]);

  return {
    markets,
    loading,
    error,
    refresh,
    buyOutcome,
    sellOutcome,
    mintCompleteSet,
    redeemCompleteSet,
  };
}
