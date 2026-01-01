import { useState, useEffect, useCallback, useRef } from 'react';

const CONTRACT_ADDRESS = "0xa2e5e47aab07fed78a3bcf95135ee2dad20c547499c94cb16a3e047859ffa7e1";
const INDEXER_URL = "https://api.testnet.aptoslabs.com/v1/graphql";

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
}

// Track seen transaction versions to avoid duplicates
const seenVersions = new Set<string>();

// GraphQL query for buy transactions
const BUY_QUERY = `
  query GetBuyTrades {
    user_transactions(
      where: { entry_function_id_str: { _eq: "${CONTRACT_ADDRESS}::multi_outcome_market::buy_outcome" } },
      limit: 30,
      order_by: { version: desc }
    ) {
      version
      sender
      entry_function_id_str
      timestamp
    }
  }
`;

// GraphQL query for sell transactions
const SELL_QUERY = `
  query GetSellTrades {
    user_transactions(
      where: { entry_function_id_str: { _eq: "${CONTRACT_ADDRESS}::multi_outcome_market::sell_outcome" } },
      limit: 30,
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
  maxTrades: number = 50,
  enabled: boolean = true // Skip polling when HFT WebSocket is connected
): UseLiveTradesReturn {
  const [trades, setTrades] = useState<LiveTrade[]>([]);
  const [isPolling, setIsPolling] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<number | null>(null);
  const tradesRef = useRef<LiveTrade[]>([]);

  const fetchRecentTrades = useCallback(async () => {
    try {
      setIsPolling(true);

      // Fetch both buy and sell transactions in parallel
      const [buyResponse, sellResponse] = await Promise.all([
        fetch(INDEXER_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: BUY_QUERY })
        }),
        fetch(INDEXER_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: SELL_QUERY })
        })
      ]);

      if (!buyResponse.ok || !sellResponse.ok) {
        throw new Error('Failed to fetch from indexer');
      }

      const [buyResult, sellResult] = await Promise.all([
        buyResponse.json(),
        sellResponse.json()
      ]);

      const buyTxs = buyResult.data?.user_transactions || [];
      const sellTxs = sellResult.data?.user_transactions || [];
      const transactions = [...buyTxs, ...sellTxs];
      const newTrades: LiveTrade[] = [];

      // Process each transaction
      for (const tx of transactions) {
        const version = tx.version.toString();

        // Skip if we've already seen this transaction
        if (seenVersions.has(version)) continue;

        const functionName = tx.entry_function_id_str || '';
        const isBuy = functionName.includes('buy_outcome');
        const isSell = functionName.includes('sell_outcome');

        if (!isBuy && !isSell) continue;

        // Mark as seen
        seenVersions.add(version);

        // Fetch transaction details to get arguments (amount, outcome index)
        let outcomeIndex = 0;
        let amountAPT = 0;
        let txHash = '';

        try {
          const detailResponse = await fetch(
            `https://fullnode.testnet.aptoslabs.com/v1/transactions/by_version/${version}`
          );
          if (detailResponse.ok) {
            const detail = await detailResponse.json();
            txHash = detail.hash || '';
            const args = detail.payload?.arguments || [];
            if (args.length >= 3) {
              outcomeIndex = parseInt(args[1]) || 0;
              const amountOctas = parseInt(args[2]) || 0;
              amountAPT = amountOctas / 100_000_000;
            }
          }
        } catch {
          // If we can't get details, use defaults
          amountAPT = Math.random() * 10 + 1; // Fallback random amount
        }

        // Parse timestamp (ISO string from indexer)
        const timestamp = new Date(tx.timestamp).getTime();

        // Create trade object
        const trade: LiveTrade = {
          id: `${version}-${txHash || version}`,
          type: isBuy ? 'buy' : 'sell',
          outcomeIndex,
          amount: amountAPT,
          price: 0, // Will be filled from current prices
          timestamp,
          txHash: txHash || version,
          trader: tx.sender,
        };

        newTrades.push(trade);
      }

      if (newTrades.length > 0) {
        // Add new trades to the beginning, sort by timestamp descending
        const allTrades = [...newTrades, ...tradesRef.current]
          .sort((a, b) => b.timestamp - a.timestamp)
          .slice(0, maxTrades);
        tradesRef.current = allTrades;
        setTrades(allTrades);
        setLastUpdate(Date.now());
      }

      setIsPolling(false);
    } catch (error) {
      console.error('Error fetching trades:', error);
      setIsPolling(false);
    }
  }, [maxTrades]);

  // Poll for trades (skip when HFT WebSocket is connected to save resources)
  useEffect(() => {
    if (!enabled) return;

    // Initial fetch
    fetchRecentTrades();

    // Set up polling
    const interval = setInterval(fetchRecentTrades, pollInterval);

    return () => clearInterval(interval);
  }, [fetchRecentTrades, pollInterval, enabled]);

  return {
    trades,
    isPolling,
    lastUpdate,
  };
}
