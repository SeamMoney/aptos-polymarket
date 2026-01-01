import { useState, useEffect, useCallback } from 'react';
import { Aptos, AptosConfig, Network } from '@aptos-labs/ts-sdk';
import { useWallet } from '@aptos-labs/wallet-adapter-react';

const CONTRACT_ADDRESS = '0xa2e5e47aab07fed78a3bcf95135ee2dad20c547499c94cb16a3e047859ffa7e1';
const MODULE = `${CONTRACT_ADDRESS}::multi_outcome_market`;

// Use QuickNode RPC to avoid Aptos Labs rate limiting
const QUICKNODE_RPC = 'https://polished-evocative-borough.aptos-testnet.quiknode.pro/a0b08bae2dc34e4a8774d91414948d02a5ce2975/v1';
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
  const [markets, setMarkets] = useState<MultiMarket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMarkets = useCallback(async () => {
    try {
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
        setLoading(false);
        return;
      }

      // Fetch details for each market
      const marketPromises = marketAddresses.map(async (addr) => {
        try {
          // Get market info
          const infoResult = await aptos.view({
            payload: {
              function: `${MODULE}::get_multi_market_info`,
              functionArguments: [addr],
            },
          });

          const [question, description, category, outcomeCount, endTime, resolved, winningOutcome, totalCollateral] =
            infoResult as [string, string, string, string, string, boolean, { vec: string[] }, string];

          // Get outcome labels
          const labelsResult = await aptos.view({
            payload: {
              function: `${MODULE}::get_outcome_labels`,
              functionArguments: [addr],
            },
          });
          const labels = labelsResult[0] as string[];

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

          // Get user positions if wallet connected
          let userBalances: number[] = new Array(parseInt(outcomeCount)).fill(0);
          if (walletAddress) {
            try {
              const positionsResult = await aptos.view({
                payload: {
                  function: `${MODULE}::get_user_multi_positions`,
                  functionArguments: [addr, walletAddress],
                },
              });
              userBalances = (positionsResult[0] as string[]).map(b => parseInt(b) / 100_000_000);
            } catch {
              // User might not have positions
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
          };
        } catch (err) {
          console.error(`Error fetching market ${addr}:`, err);
          return null;
        }
      });

      const fetchedMarkets = (await Promise.all(marketPromises)).filter(
        (m): m is MultiMarket => m !== null
      );

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
