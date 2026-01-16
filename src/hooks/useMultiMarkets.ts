import { useState, useEffect, useCallback, useRef } from 'react';
import { Aptos, AptosConfig, Network } from '@aptos-labs/ts-sdk';
import { useWallet } from '@aptos-labs/wallet-adapter-react';

const CONTRACT_ADDRESS = import.meta.env.VITE_CONTRACT_ADDRESS || '0xca4d40eae9f07fb28a121862d649203fb4335ece9536ee51790e19f812ff7aea';
const MODULE = `${CONTRACT_ADDRESS}::multi_outcome_market` as const;

type MoveFn = `${string}::${string}::${string}`;

// Explicit market addresses (SmartTable registry doesn't support enumeration)
// Format: comma-separated addresses
const EXPLICIT_MARKETS = import.meta.env.VITE_MULTI_MARKETS?.split(',').filter(Boolean) || [];

// RPC endpoints in priority order (custom fullnode first, Aptos Labs fallback)
const RPC_ENDPOINTS = [
  'https://aptos.cash.trading/v1',      // Custom fullnode - no rate limits
  'https://api.testnet.aptoslabs.com/v1', // Aptos Labs fallback
];

// Create Aptos client for a specific endpoint
function createAptosClient(fullnode: string): Aptos {
  return new Aptos(new AptosConfig({
    network: Network.TESTNET,
    fullnode,
  }));
}

// Default client (primary endpoint)
let aptos = createAptosClient(RPC_ENDPOINTS[0]);

interface Outcome {
  index: number;
  label: string;
  price: number;  // Normalized 0-100
  rawPrice: number;  // Raw price from contract
  userBalance: number;
}

// Oracle types: 0=Admin, 1=Pyth, 2=Switchboard, 3=Optimistic
export type OracleType = 'admin' | 'pyth' | 'switchboard' | 'optimistic';

export interface OracleInfo {
  type: OracleType;
  hasConfig: boolean;
  oracleResolved: boolean;
  resolutionPrice: number | null;
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
  oracleInfo?: OracleInfo;
}

// Module-level cache to persist markets across page navigations
// This prevents refetching when navigating between pages
interface MarketCache {
  markets: MultiMarket[];
  timestamp: number;
  walletAddress?: string;
}
let marketCache: MarketCache | null = null;
const CACHE_TTL_MS = 10000; // Cache valid for 10 seconds

export function useMultiMarkets() {
  const { account } = useWallet();
  const walletAddress = account?.address?.toString();

  // Initialize from cache if valid (wallet-independent for initial render)
  const getInitialMarkets = (): MultiMarket[] => {
    if (marketCache && Date.now() - marketCache.timestamp < CACHE_TTL_MS) {
      return marketCache.markets;
    }
    return [];
  };

  const [markets, setMarkets] = useState<MultiMarket[]>(getInitialMarkets);
  const [loading, setLoading] = useState(() => getInitialMarkets().length === 0);
  const [error, setError] = useState<string | null>(null);

  // Prevent duplicate fetches from React Strict Mode double-invocation
  const fetchInProgressRef = useRef(false);

  const fetchMarkets = useCallback(async (forceRefresh = false) => {
    // Prevent duplicate fetches (React Strict Mode calls effects twice in dev)
    if (fetchInProgressRef.current) {
      return;
    }

    // Skip fetch if cache is still valid and has all markets (unless force refresh)
    const expectedMarketCount = EXPLICIT_MARKETS.length || 15;
    if (!forceRefresh && marketCache &&
        Date.now() - marketCache.timestamp < CACHE_TTL_MS &&
        marketCache.markets.length >= expectedMarketCount) {
      setMarkets(marketCache.markets);
      setLoading(false);
      return;
    }

    fetchInProgressRef.current = true;

    try {
      // Use explicit market addresses if configured, otherwise try registry
      let marketAddresses: string[] = [];
      console.log('[Markets] Starting fetch, explicit markets:', EXPLICIT_MARKETS.length);

      if (EXPLICIT_MARKETS.length > 0) {
        marketAddresses = EXPLICIT_MARKETS;
      } else {
        try {
          const result = await aptos.view({
            payload: {
              function: `${MODULE}::get_all_multi_markets` as MoveFn,
              functionArguments: [],
            },
          });
          marketAddresses = result[0] as string[];
        } catch {
          console.warn('Could not fetch markets from registry. Set VITE_MULTI_MARKETS env var.');
        }
      }

      if (marketAddresses.length === 0) {
        setMarkets([]);
        setLoading(false);
        return;
      }

      // Helper to convert oracle type number to string
      const oracleTypeMap: Record<number, OracleType> = {
        0: 'admin',
        1: 'pyth',
        2: 'switchboard',
        3: 'optimistic',
      };

      // Fetch all markets in PARALLEL for speed, with endpoint failover
      const fetchSingleMarket = async (addr: string, endpointIndex = 0): Promise<MultiMarket | null> => {
        const client = endpointIndex === 0 ? aptos : createAptosClient(RPC_ENDPOINTS[endpointIndex]);

        try {
          // Make all RPC calls for this market in parallel
          const [infoResult, labelsResult, pricesResult, positionsResult, oracleResult] = await Promise.all([
            client.view({
              payload: {
                function: `${MODULE}::get_multi_market_info` as MoveFn,
                functionArguments: [addr],
              },
            }),
            client.view({
              payload: {
                function: `${MODULE}::get_outcome_labels` as MoveFn,
                functionArguments: [addr],
              },
            }),
            client.view({
              payload: {
                function: `${MODULE}::get_all_prices` as MoveFn,
                functionArguments: [addr],
              },
            }),
            walletAddress
              ? client.view({
                  payload: {
                    function: `${MODULE}::get_user_multi_positions` as MoveFn,
                    functionArguments: [addr, walletAddress],
                  },
                }).catch(() => [new Array(10).fill('0')])
              : Promise.resolve([new Array(10).fill('0')]),
            // Fetch oracle info (may fail on old contracts without this function)
            client.view({
              payload: {
                function: `${MODULE}::get_oracle_info` as MoveFn,
                functionArguments: [addr],
              },
            }).catch(() => [0, false, false, { vec: [] }]),
          ]);

          const [question, description, category, outcomeCount, endTime, resolved, winningOutcome, totalCollateral] =
            infoResult as [string, string, string, string, string, boolean, { vec: string[] }, string];

          const labels = labelsResult[0] as string[];
          const rawPrices = (pricesResult[0] as string[]).map(p => parseInt(p));
          const userBalances = (positionsResult[0] as string[]).map(b => parseInt(b) / 100_000_000);

          // Parse oracle info
          const [oracleType, hasConfig, oracleResolved, resolutionPriceVec] = oracleResult as [
            number | string,
            boolean,
            boolean,
            { vec: string[] }
          ];
          const oracleInfo: OracleInfo = {
            type: oracleTypeMap[Number(oracleType)] || 'admin',
            hasConfig: Boolean(hasConfig),
            oracleResolved: Boolean(oracleResolved),
            resolutionPrice: resolutionPriceVec.vec.length > 0
              ? parseInt(resolutionPriceVec.vec[0]) / 100_000_000
              : null,
          };

          // Normalize prices to sum to 100%
          const priceSum = rawPrices.reduce((acc, p) => acc + p, 0);
          const normalizedPrices = rawPrices.map(p =>
            priceSum > 0 ? (p / priceSum) * 100 : 100 / rawPrices.length
          );

          const outcomes: Outcome[] = labels.map((label, i) => ({
            index: i,
            label,
            price: normalizedPrices[i],
            rawPrice: rawPrices[i],
            userBalance: userBalances[i] || 0,
          }));

          return {
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
            oracleInfo,
          };
        } catch (err) {
          // Try next endpoint on failure
          if (endpointIndex < RPC_ENDPOINTS.length - 1) {
            return fetchSingleMarket(addr, endpointIndex + 1);
          }
          console.error(`Error fetching market ${addr} (all endpoints failed):`, err);
          return null;
        }
      };

      // Fetch ALL markets in parallel - no rate limits on custom fullnode
      const results = await Promise.all(marketAddresses.map(fetchSingleMarket));
      const fetchedMarkets = results.filter((m): m is MultiMarket => m !== null);

      // Only update state if we got all markets or more than we currently have
      // This prevents rate-limited fetches from overwriting good data
      console.log('[Markets] Fetch complete:', fetchedMarkets.length, 'of', marketAddresses.length);
      setMarkets(prevMarkets => {
        let newMarkets: MultiMarket[];
        let shouldCache = false;

        if (fetchedMarkets.length >= marketAddresses.length) {
          // Got all markets, update and cache
          newMarkets = fetchedMarkets;
          shouldCache = true;
        } else if (fetchedMarkets.length > prevMarkets.length) {
          // Got more than before, update but don't cache (partial data)
          newMarkets = fetchedMarkets;
        } else if (prevMarkets.length === 0) {
          // First load, use whatever we got but don't cache (partial data)
          newMarkets = fetchedMarkets;
        } else {
          // Rate-limited fetch returned fewer markets, keep existing data
          return prevMarkets;
        }

        // Only cache when we have all markets
        if (shouldCache) {
          marketCache = {
            markets: newMarkets,
            timestamp: Date.now(),
            walletAddress,
          };
        }

        return newMarkets;
      });
      setError(null);
    } catch (err) {
      console.error('Error fetching multi-outcome markets:', err);
      setError('Failed to fetch markets');
    } finally {
      setLoading(false);
      fetchInProgressRef.current = false;
    }
  }, [walletAddress]);

  // Initial fetch
  useEffect(() => {
    fetchMarkets();
  }, [fetchMarkets]);

  // Refresh every 30 seconds (reduced from 10s to avoid rate limiting)
  useEffect(() => {
    const interval = setInterval(fetchMarkets, 30000);
    return () => clearInterval(interval);
  }, [fetchMarkets]);

  // Buy outcome tokens
  const buyOutcome = async (marketAddress: string, outcomeIndex: number, amountAPT: string) => {
    if (!walletAddress) throw new Error('Wallet not connected');

    const amountUnits = Math.floor(parseFloat(amountAPT) * 100_000_000);

    // Stringify all arguments for better Petra wallet compatibility
    // Include typeArguments: [] as required by Petra
    const payload = {
      function: `${MODULE}::buy_outcome`,
      typeArguments: [] as string[],
      functionArguments: [marketAddress, String(outcomeIndex), String(amountUnits), "0"],
    };

    return payload;
  };

  // Sell outcome tokens
  const sellOutcome = async (marketAddress: string, outcomeIndex: number, amountTokens: string) => {
    if (!walletAddress) throw new Error('Wallet not connected');

    const amountUnits = Math.floor(parseFloat(amountTokens) * 100_000_000);

    // Stringify all arguments for better Petra wallet compatibility
    // Include typeArguments: [] as required by Petra
    const payload = {
      function: `${MODULE}::sell_outcome`,
      typeArguments: [] as string[],
      functionArguments: [marketAddress, String(outcomeIndex), String(amountUnits), "0"],
    };

    return payload;
  };

  // Mint complete set
  const mintCompleteSet = async (marketAddress: string, amountAPT: string) => {
    if (!walletAddress) throw new Error('Wallet not connected');

    const amountUnits = Math.floor(parseFloat(amountAPT) * 100_000_000);

    // Stringify for Petra wallet compatibility
    // Include typeArguments: [] as required by Petra
    const payload = {
      function: `${MODULE}::mint_complete_set`,
      typeArguments: [] as string[],
      functionArguments: [marketAddress, String(amountUnits)],
    };

    return payload;
  };

  // Redeem complete set
  const redeemCompleteSet = async (marketAddress: string, amountTokens: string) => {
    if (!walletAddress) throw new Error('Wallet not connected');

    const amountUnits = Math.floor(parseFloat(amountTokens) * 100_000_000);

    // Stringify for Petra wallet compatibility
    // Include typeArguments: [] as required by Petra
    const payload = {
      function: `${MODULE}::redeem_complete_set`,
      typeArguments: [] as string[],
      functionArguments: [marketAddress, String(amountUnits)],
    };

    return payload;
  };

  return {
    markets,
    loading,
    error,
    refresh: fetchMarkets,
    buyOutcome,
    sellOutcome,
    mintCompleteSet,
    redeemCompleteSet,
  };
}
