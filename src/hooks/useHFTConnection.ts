import { useState, useEffect, useCallback, useRef } from 'react';

// Configurable URLs - use environment variables for production (VM connection)
const HFT_WS_URL = import.meta.env.VITE_HFT_WS_URL || 'ws://localhost:3001';
const HFT_SERVER_URL = HFT_WS_URL.replace('ws://', 'http://').replace('wss://', 'https://');

// Trade batching config - batch updates every 100ms to handle high TPS
const TRADE_BATCH_INTERVAL_MS = 100;

export interface Trade {
  id: string;
  bot: string;
  action: string;
  actionDisplay: string;
  amount: number;
  latency: number;
  success: boolean;
  txHash?: string;
  error?: string;
  timestamp: number;
  explorerUrl?: string;
  outcome?: number; // For multi-outcome markets
}

export interface Stats {
  totalTrades: number;
  successfulTrades: number;
  failedTrades: number;
  successRate: number;
  avgLatency: number;
  currentDelay?: number;
  currentTps?: number;
  peakTps?: number;
}

export interface MarketInfo {
  address: string;
  question: string;
  yesPrice: number;
  noPrice: number;
  isMultiOutcome?: boolean;
  outcomeCount?: number;
  outcomePrices?: number[];
  outcomeLabels?: string[];
}

export interface Position {
  yesTokens: number;
  noTokens: number;
  totalInvested: number;
  realizedPnl: number;
  outcomePositions?: number[];
}

export interface MarketReserves {
  yesReserve: number;
  noReserve: number;
  tvl: number;
}

export interface HFTConnectionState {
  isConnected: boolean;
  isRunning: boolean;
  stats: Stats;
  marketInfo: MarketInfo | null;
  marketReserves: MarketReserves;
  trades: Trade[];
  position: Position;
  botBalance: number;
  error: string | null;
  tpsHistory: number[];
}

export interface HFTConnectionOptions {
  autoConnect?: boolean; // Only connect if true (default: false)
}

export function useHFTConnection(options: HFTConnectionOptions = {}) {
  const { autoConnect = false } = options;
  const [isConnected, setIsConnected] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [stats, setStats] = useState<Stats>({
    totalTrades: 0,
    successfulTrades: 0,
    failedTrades: 0,
    successRate: 0,
    avgLatency: 0,
  });
  const [marketInfo, setMarketInfo] = useState<MarketInfo | null>(null);
  const [marketReserves, setMarketReserves] = useState<MarketReserves>({
    yesReserve: 0,
    noReserve: 0,
    tvl: 0,
  });
  const [position, setPosition] = useState<Position>({
    yesTokens: 0,
    noTokens: 0,
    totalInvested: 0,
    realizedPnl: 0,
  });
  const [botBalance, setBotBalance] = useState(0);
  const [tpsHistory, setTpsHistory] = useState<number[]>([]);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectDelayRef = useRef(500);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTpsRef = useRef(0);
  const tpsIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Trade batching for high TPS - buffer trades and flush every 100ms
  const tradeBufferRef = useRef<Trade[]>([]);
  const batchIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const serverAvailableRef = useRef(false);

  // Check if HFT server is available via HTTP (silent, no console errors)
  const checkServerAvailable = useCallback(async (): Promise<boolean> => {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3000);
      const response = await fetch(`${HFT_SERVER_URL}/health`, {
        signal: controller.signal,
        mode: 'no-cors', // Allows checking without CORS errors
      });
      clearTimeout(timeout);
      // With no-cors, we get an opaque response, but if it doesn't throw, server is up
      return response.type === 'opaque' || response.ok;
    } catch {
      return false;
    }
  }, []);

  // Connect to WebSocket (only called after HTTP check succeeds)
  const connectWebSocket = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN ||
        wsRef.current?.readyState === WebSocket.CONNECTING) {
      return;
    }

    const ws = new WebSocket(HFT_WS_URL);

    ws.onopen = () => {
      setIsConnected(true);
      setError(null);
      serverAvailableRef.current = true;
      reconnectDelayRef.current = 5000; // Start at 5s for reconnects
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);

        if (message.type === 'trade') {
          const trade = message.data as Trade;
          tradeBufferRef.current.push(trade);
          setStats(message.stats);
          if (message.market) setMarketInfo(message.market);
          if (message.position) setPosition(message.position);
          if (message.botBalance !== undefined) setBotBalance(message.botBalance);
          if (message.marketReserves) setMarketReserves(message.marketReserves);
        } else if (message.type === 'state') {
          setIsRunning(message.data.isRunning);
          setStats(message.data.stats);
          if (message.data.market) setMarketInfo(message.data.market);
          if (message.data.position) setPosition(message.data.position);
          if (message.data.botBalance !== undefined) setBotBalance(message.data.botBalance);
          if (message.data.marketReserves) setMarketReserves(message.data.marketReserves);
        } else if (message.type === 'started') {
          setIsRunning(true);
          if (message.market) setMarketInfo(message.market);
          if (message.botBalance !== undefined) setBotBalance(message.botBalance);
          if (message.marketReserves) setMarketReserves(message.marketReserves);
        } else if (message.type === 'stopped') {
          setIsRunning(false);
          if (message.position) setPosition(message.position);
        } else if (message.type === 'rate_limited') {
          setError(message.message || 'Rate limited - waiting...');
        } else if (message.type === 'low_balance') {
          setIsRunning(false);
          setError(`${message.message || 'Low balance - trading stopped'}`);
          if (message.botBalance !== undefined) setBotBalance(message.botBalance);
        }
      } catch {
        // Silently ignore parse errors
      }
    };

    ws.onclose = () => {
      setIsConnected(false);
      wsRef.current = null;
      // Schedule reconnect check (not immediate WebSocket attempt)
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = setTimeout(tryConnect, reconnectDelayRef.current);
      reconnectDelayRef.current = Math.min(reconnectDelayRef.current * 1.5, 60000);
    };

    ws.onerror = () => {
      // Don't set error - server just isn't available
      serverAvailableRef.current = false;
    };

    wsRef.current = ws;
  }, []);

  // Try to connect: first check HTTP, then WebSocket
  const tryConnect = useCallback(async () => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const available = await checkServerAvailable();
    if (available) {
      connectWebSocket();
    } else {
      // Server not available, schedule next check
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = setTimeout(tryConnect, reconnectDelayRef.current);
      reconnectDelayRef.current = Math.min(reconnectDelayRef.current * 1.5, 60000);
    }
  }, [checkServerAvailable, connectWebSocket]);

  // Connect on mount ONLY if autoConnect is enabled
  // This prevents console errors when HFT server is offline
  useEffect(() => {
    if (!autoConnect) return; // Skip if not auto-connecting

    let mounted = true;

    // Initial connection attempt after short delay
    const initTimeout = setTimeout(() => {
      if (mounted) connectWebSocket(); // Direct WebSocket, skip HTTP check
    }, 500);

    return () => {
      mounted = false;
      clearTimeout(initTimeout);
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [autoConnect, connectWebSocket]);

  // Trade batching - flush buffer every 100ms (10 updates/sec max for smooth UI at high TPS)
  useEffect(() => {
    batchIntervalRef.current = setInterval(() => {
      if (tradeBufferRef.current.length > 0) {
        const bufferedTrades = tradeBufferRef.current;
        tradeBufferRef.current = [];
        setTrades(prev => [...bufferedTrades, ...prev].slice(0, 100));
      }
    }, TRADE_BATCH_INTERVAL_MS);

    return () => {
      if (batchIntervalRef.current) {
        clearInterval(batchIntervalRef.current);
        batchIntervalRef.current = null;
      }
    };
  }, []);

  // Track TPS history
  useEffect(() => {
    lastTpsRef.current = stats.currentTps || 0;
  }, [stats.currentTps]);

  // Sample TPS every 500ms for chart
  useEffect(() => {
    if (isRunning) {
      tpsIntervalRef.current = setInterval(() => {
        setTpsHistory(prev => [...prev.slice(-59), lastTpsRef.current]);
      }, 500);
    } else {
      if (tpsIntervalRef.current) {
        clearInterval(tpsIntervalRef.current);
        tpsIntervalRef.current = null;
      }
    }
    return () => {
      if (tpsIntervalRef.current) {
        clearInterval(tpsIntervalRef.current);
        tpsIntervalRef.current = null;
      }
    };
  }, [isRunning]);

  // Start trading
  const startTrading = useCallback(async () => {
    try {
      setError(null);
      const response = await fetch(`${HFT_SERVER_URL}/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to start');
      }

      setIsRunning(true);
      setTrades([]);
    } catch (e: unknown) {
      const errorMessage = e instanceof Error ? e.message : 'Unknown error';
      setError(errorMessage);
    }
  }, []);

  // Stop trading
  const stopTrading = useCallback(async () => {
    try {
      await fetch(`${HFT_SERVER_URL}/stop`, { method: 'POST' });
      setIsRunning(false);
    } catch (e: unknown) {
      const errorMessage = e instanceof Error ? e.message : 'Unknown error';
      setError(errorMessage);
    }
  }, []);

  // Manual connect function for lazy connection
  const connect = useCallback(() => {
    connectWebSocket();
  }, [connectWebSocket]);

  return {
    isConnected,
    isRunning,
    stats,
    marketInfo,
    marketReserves,
    trades,
    position,
    botBalance,
    error,
    tpsHistory,
    startTrading,
    stopTrading,
    connect, // For manual connection
  };
}
