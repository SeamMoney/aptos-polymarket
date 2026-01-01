import { useState, useEffect, useCallback, useRef } from 'react';

const CONTRACT_ADDRESS = "0xa2e5e47aab07fed78a3bcf95135ee2dad20c547499c94cb16a3e047859ffa7e1";
const MARKET_ADDRESS = "0xfefd1b67818ee4ef12a7953852c83f0efb411a9b92c518a52ba92555e4abdd96";

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

      // Fetch recent transactions to the contract
      const response = await fetch(
        `https://fullnode.testnet.aptoslabs.com/v1/accounts/${CONTRACT_ADDRESS}/transactions?limit=25`
      );

      if (!response.ok) {
        throw new Error('Failed to fetch transactions');
      }

      const transactions = await response.json();
      const newTrades: LiveTrade[] = [];

      for (const tx of transactions) {
        // Skip if we've already seen this transaction
        if (seenVersions.has(tx.version)) continue;

        // Only process successful transactions
        if (!tx.success) continue;

        // Check if this is a buy or sell transaction
        const payload = tx.payload;
        if (!payload || payload.type !== 'entry_function_payload') continue;

        const functionName = payload.function;
        if (!functionName) continue;

        const isBuy = functionName.includes('buy_outcome');
        const isSell = functionName.includes('sell_outcome');

        if (!isBuy && !isSell) continue;

        // Check if it's for our market
        const args = payload.arguments || [];
        if (args.length < 2) continue;

        const marketArg = args[0];
        if (!marketArg || !marketArg.toString().includes(MARKET_ADDRESS.slice(2, 10))) continue;

        // Parse trade details
        const outcomeIndex = parseInt(args[1]) || 0;
        const amountOctas = parseInt(args[2]) || 0;
        const amountAPT = amountOctas / 100_000_000;

        // Mark as seen
        seenVersions.add(tx.version);

        // Create trade object
        const trade: LiveTrade = {
          id: `${tx.version}-${tx.hash}`,
          type: isBuy ? 'buy' : 'sell',
          outcomeIndex,
          amount: amountAPT,
          price: 0, // Will be filled from current prices
          timestamp: Math.floor(parseInt(tx.timestamp) / 1000), // Convert microseconds to ms
          txHash: tx.hash,
          trader: tx.sender,
        };

        newTrades.push(trade);
      }

      if (newTrades.length > 0) {
        // Add new trades to the beginning
        tradesRef.current = [...newTrades, ...tradesRef.current].slice(0, maxTrades);
        setTrades(tradesRef.current);
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
