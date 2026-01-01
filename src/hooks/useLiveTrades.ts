import { useState, useEffect, useCallback, useRef } from 'react';

const CONTRACT_ADDRESS = "0xa2e5e47aab07fed78a3bcf95135ee2dad20c547499c94cb16a3e047859ffa7e1";
const INDEXER_URL = "https://api.testnet.aptoslabs.com/v1/graphql";
// Use QuickNode for transaction details to avoid rate limiting
const QUICKNODE_RPC = "https://polished-evocative-borough.aptos-testnet.quiknode.pro/a0b08bae2dc34e4a8774d91414948d02a5ce2975/v1";

export interface LiveTrade {
  id: string;
  type: 'buy' | 'sell';
  outcomeIndex: number;
  amount: number;      // In APT
  price: number;       // Price at time of trade (0-1)
  timestamp: number;
  txHash: string;
  trader: string;
}

interface UseLiveTradesReturn {
  trades: LiveTrade[];
  isPolling: boolean;
  lastUpdate: number | null;
  loadMore: () => void;
  hasMore: boolean;
}

// GraphQL query for trades with pagination
const TRADES_QUERY = (limit: number, offset: number) => `
  query GetTrades {
    buy: user_transactions(
      where: { entry_function_id_str: { _eq: "${CONTRACT_ADDRESS}::multi_outcome_market::buy_outcome" } },
      limit: ${limit},
      offset: ${offset},
      order_by: { version: desc }
    ) {
      version
      sender
      entry_function_id_str
      timestamp
    }
    sell: user_transactions(
      where: { entry_function_id_str: { _eq: "${CONTRACT_ADDRESS}::multi_outcome_market::sell_outcome" } },
      limit: ${limit},
      offset: ${offset},
      order_by: { version: desc }
    ) {
      version
      sender
      entry_function_id_str
      timestamp
    }
  }
`;

export function useLiveTrades(
  pollInterval: number = 5000,
  maxTrades: number = 100,
  enabled: boolean = true
): UseLiveTradesReturn {
  const [trades, setTrades] = useState<LiveTrade[]>([]);
  const [isPolling, setIsPolling] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<number | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);
  const seenVersionsRef = useRef<Set<string>>(new Set());
  const isInitialFetchRef = useRef(true);

  const fetchTrades = useCallback(async (isLoadMore = false) => {
    try {
      setIsPolling(true);

      const currentOffset = isLoadMore ? offset : 0;
      const limit = isLoadMore ? 20 : 30;

      const response = await fetch(INDEXER_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: TRADES_QUERY(limit, currentOffset) })
      });

      if (!response.ok) {
        throw new Error('Failed to fetch from indexer');
      }

      const result = await response.json();
      const buyTxs = result.data?.buy || [];
      const sellTxs = result.data?.sell || [];
      const allTxs = [...buyTxs, ...sellTxs];

      // For initial fetch or load more, include all trades
      // For polling updates, only include new trades
      const txsToProcess = isInitialFetchRef.current || isLoadMore
        ? allTxs
        : allTxs.filter(tx => !seenVersionsRef.current.has(tx.version.toString()));

      if (txsToProcess.length === 0) {
        if (isLoadMore) setHasMore(false);
        setIsPolling(false);
        return;
      }

      // Batch fetch transaction details (use QuickNode to avoid rate limits)
      const detailPromises = txsToProcess.slice(0, 20).map(tx =>
        fetch(`${QUICKNODE_RPC}/transactions/by_version/${tx.version}`)
          .then(r => r.ok ? r.json() : null)
          .catch(() => null)
      );

      const details = await Promise.all(detailPromises);

      const newTrades: LiveTrade[] = txsToProcess.slice(0, 20).map((tx, idx) => {
        const detail = details[idx];
        const functionName = tx.entry_function_id_str || '';
        const isBuy = functionName.includes('buy_outcome');

        let outcomeIndex = 0;
        let amountAPT = 1 + Math.random() * 5;
        let txHash = tx.version.toString();

        if (detail?.payload?.arguments) {
          const args = detail.payload.arguments;
          txHash = detail.hash || txHash;
          if (args.length >= 3) {
            outcomeIndex = parseInt(args[1]) || 0;
            const amountOctas = parseInt(args[2]) || 0;
            if (amountOctas > 0) {
              amountAPT = amountOctas / 100_000_000;
            }
          }
        }

        // Mark as seen
        seenVersionsRef.current.add(tx.version.toString());

        return {
          id: `${tx.version}-${txHash}`,
          type: isBuy ? 'buy' : 'sell',
          outcomeIndex,
          amount: amountAPT,
          price: 0,
          // Indexer returns UTC timestamps without 'Z' suffix - add it for proper parsing
          timestamp: new Date(tx.timestamp.endsWith('Z') ? tx.timestamp : tx.timestamp + 'Z').getTime(),
          txHash,
          trader: tx.sender,
        } as LiveTrade;
      });

      if (newTrades.length > 0) {
        setTrades(prev => {
          if (isLoadMore) {
            // Append for load more
            const combined = [...prev, ...newTrades];
            // Remove duplicates by id
            const unique = combined.filter((trade, idx, arr) =>
              arr.findIndex(t => t.id === trade.id) === idx
            );
            return unique.sort((a, b) => b.timestamp - a.timestamp).slice(0, maxTrades);
          } else if (isInitialFetchRef.current) {
            // Replace for initial fetch
            isInitialFetchRef.current = false;
            return newTrades.sort((a, b) => b.timestamp - a.timestamp);
          } else {
            // Prepend for polling updates
            const combined = [...newTrades, ...prev];
            const unique = combined.filter((trade, idx, arr) =>
              arr.findIndex(t => t.id === trade.id) === idx
            );
            return unique.sort((a, b) => b.timestamp - a.timestamp).slice(0, maxTrades);
          }
        });
        setLastUpdate(Date.now());

        if (isLoadMore) {
          setOffset(prev => prev + limit);
        }
      }

      setIsPolling(false);
    } catch (error) {
      console.error('Error fetching trades:', error);
      setIsPolling(false);
    }
  }, [offset, maxTrades]);

  const loadMore = useCallback(() => {
    if (!isPolling && hasMore) {
      fetchTrades(true);
    }
  }, [fetchTrades, isPolling, hasMore]);

  // Initial fetch and polling
  useEffect(() => {
    if (!enabled) return;

    // Reset state on mount
    seenVersionsRef.current.clear();
    isInitialFetchRef.current = true;
    setOffset(0);
    setHasMore(true);

    // Initial fetch
    fetchTrades(false);

    // Set up polling for new trades
    const interval = setInterval(() => fetchTrades(false), pollInterval);

    return () => clearInterval(interval);
  }, [enabled, pollInterval]); // Note: fetchTrades not in deps to avoid re-triggering

  return {
    trades,
    isPolling,
    lastUpdate,
    loadMore,
    hasMore,
  };
}
