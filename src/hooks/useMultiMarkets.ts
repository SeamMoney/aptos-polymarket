import { useState, useEffect, useCallback } from 'react';
import { Aptos, AptosConfig, Network } from '@aptos-labs/ts-sdk';
import { useWallet } from '@aptos-labs/wallet-adapter-react';

const CONTRACT_ADDRESS = import.meta.env.VITE_CONTRACT_ADDRESS || '0xbdea15f5b0f5449ae8f3a6ae95a5e090bdeeec91be1fcac8375b2f5f37f1c134';
const MODULE = `${CONTRACT_ADDRESS}::multi_outcome_market` as const;

type MoveFn = `${string}::${string}::${string}`;

// Explicit market addresses (SmartTable registry doesn't support enumeration)
// Format: comma-separated addresses
const EXPLICIT_MARKETS = import.meta.env.VITE_MULTI_MARKETS?.split(',').filter(Boolean) || [];

// Use QuickNode RPC to avoid Aptos Labs rate limiting
const QUICKNODE_RPC = import.meta.env.VITE_RPC_URL || 'https://polished-evocative-borough.aptos-testnet.quiknode.pro/a0b08bae2dc34e4a8774d91414948d02a5ce2975/v1';
const aptos = new Aptos(new AptosConfig({
  network: Network.TESTNET,
  fullnode: QUICKNODE_RPC,
}));

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

export function useMultiMarkets() {
  const { account } = useWallet();
  const walletAddress = account?.address?.toString();
  const [markets, setMarkets] = useState<MultiMarket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMarkets = useCallback(async () => {
    try {
      // Use explicit market addresses if configured, otherwise try registry
      let marketAddresses: string[] = [];

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

      // Fetch all markets in PARALLEL for speed
      const fetchSingleMarket = async (addr: string): Promise<MultiMarket | null> => {
        try {
          // Make all RPC calls for this market in parallel
          const [infoResult, labelsResult, pricesResult, positionsResult, oracleResult] = await Promise.all([
            aptos.view({
              payload: {
                function: `${MODULE}::get_multi_market_info` as MoveFn,
                functionArguments: [addr],
              },
            }),
            aptos.view({
              payload: {
                function: `${MODULE}::get_outcome_labels` as MoveFn,
                functionArguments: [addr],
              },
            }),
            aptos.view({
              payload: {
                function: `${MODULE}::get_all_prices` as MoveFn,
                functionArguments: [addr],
              },
            }),
            walletAddress
              ? aptos.view({
                  payload: {
                    function: `${MODULE}::get_user_multi_positions` as MoveFn,
                    functionArguments: [addr, walletAddress],
                  },
                }).catch(() => [new Array(10).fill('0')])
              : Promise.resolve([new Array(10).fill('0')]),
            // Fetch oracle info (may fail on old contracts without this function)
            aptos.view({
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
          console.error(`Error fetching market ${addr}:`, err);
          return null;
        }
      };

      // Fetch markets in batches to avoid QuickNode rate limit (50 req/sec)
      // Each market makes 4 RPC calls, so batch size of 4 = 16 calls per batch
      const BATCH_SIZE = 4;
      const BATCH_DELAY_MS = 250; // 250ms delay between batches

      const fetchedMarkets: MultiMarket[] = [];
      for (let i = 0; i < marketAddresses.length; i += BATCH_SIZE) {
        const batch = marketAddresses.slice(i, i + BATCH_SIZE);
        const batchResults = await Promise.all(batch.map(fetchSingleMarket));
        fetchedMarkets.push(...batchResults.filter((m): m is MultiMarket => m !== null));

        // Update state incrementally so UI shows markets as they load
        setMarkets([...fetchedMarkets]);

        // Add delay between batches to stay under rate limit
        if (i + BATCH_SIZE < marketAddresses.length) {
          await new Promise(resolve => setTimeout(resolve, BATCH_DELAY_MS));
        }
      }

      setMarkets(fetchedMarkets);
      setError(null);
    } catch (err) {
      console.error('Error fetching multi-outcome markets:', err);
      setError('Failed to fetch markets');
    } finally {
      setLoading(false);
    }
  }, [walletAddress]);

  // Initial fetch
  useEffect(() => {
    fetchMarkets();
  }, [fetchMarkets]);

  // Refresh every 10 seconds
  useEffect(() => {
    const interval = setInterval(fetchMarkets, 10000);
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
