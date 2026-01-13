import { useState, useEffect, useCallback, useRef } from 'react';

// Configurable URLs - use environment variables for production (VM connection)
const HFT_WS_URL = import.meta.env.VITE_HFT_WS_URL || 'ws://localhost:3001';
const HFT_SERVER_URL = HFT_WS_URL.replace('ws://', 'http://').replace('wss://', 'https://');

// Trade batching config - batch updates every 100ms to handle high TPS
const TRADE_BATCH_INTERVAL_MS = 100;

// TPS-based sampling thresholds
// At high TPS, we sample trades to prevent UI lag
const TPS_THRESHOLDS = {
  LOW: 100,      // Show all trades
  MEDIUM: 1000,  // Show every 5th trade
  HIGH: 5000,    // Show every 20th trade
  ULTRA: 10000,  // Show every 50th trade
};

function getSampleRate(tps: number): number {
  if (tps < TPS_THRESHOLDS.LOW) return 1;
  if (tps < TPS_THRESHOLDS.MEDIUM) return 5;
  if (tps < TPS_THRESHOLDS.HIGH) return 20;
  return 50;
}

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

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'reconnecting';

export interface HFTConnectionOptions {
  autoConnect?: boolean; // Only connect if true (default: false)
  maxReconnectAttempts?: number; // Max reconnect attempts (default: unlimited)
}

export function useHFTConnection(options: HFTConnectionOptions = {}) {
  const { autoConnect = false, maxReconnectAttempts = Infinity } = options;
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
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
  const [sampleRate, setSampleRate] = useState(1); // Current sampling rate (1 = show all)

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectDelayRef = useRef(500);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTpsRef = useRef(0);
  const tpsIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const tradeCounterRef = useRef(0); // Counter for sampling

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

    setConnectionStatus('connecting');
    const ws = new WebSocket(HFT_WS_URL);

    ws.onopen = () => {
      setIsConnected(true);
      setConnectionStatus('connected');
      setReconnectAttempts(0);
      setError(null);
      serverAvailableRef.current = true;
      reconnectDelayRef.current = 500; // Reset to fast reconnect on success
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

      // Check if we should reconnect
      setReconnectAttempts(prev => {
        const newAttempts = prev + 1;
        if (newAttempts <= maxReconnectAttempts) {
          setConnectionStatus('reconnecting');
          // Schedule reconnect check (not immediate WebSocket attempt)
          if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
          reconnectTimeoutRef.current = setTimeout(tryConnect, reconnectDelayRef.current);
          reconnectDelayRef.current = Math.min(reconnectDelayRef.current * 1.5, 60000);
        } else {
          setConnectionStatus('disconnected');
          setError(`Max reconnect attempts (${maxReconnectAttempts}) exceeded`);
        }
        return newAttempts;
      });
    };

    ws.onerror = () => {
      // Don't set error - server just isn't available
      serverAvailableRef.current = false;
      setConnectionStatus('disconnected');
    };

    wsRef.current = ws;
  }, [maxReconnectAttempts]);

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

  // Trade batching - flush buffer every 100ms with TPS-based sampling
  useEffect(() => {
    batchIntervalRef.current = setInterval(() => {
      if (tradeBufferRef.current.length > 0) {
        const bufferedTrades = tradeBufferRef.current;
        tradeBufferRef.current = [];

        // Calculate sample rate based on current TPS
        const currentTps = lastTpsRef.current;
        const rate = getSampleRate(currentTps);
        setSampleRate(rate);

        // Sample trades if rate > 1
        let tradesToShow: Trade[];
        if (rate === 1) {
          // Show all trades at low TPS
          tradesToShow = bufferedTrades;
        } else {
          // Sample: show every Nth trade
          tradesToShow = bufferedTrades.filter(() => {
            tradeCounterRef.current++;
            return tradeCounterRef.current % rate === 0;
          });
        }

        if (tradesToShow.length > 0) {
          setTrades(prev => [...tradesToShow, ...prev].slice(0, 100));
        }
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

  // Reset reconnection state (for manual reconnect)
  const resetReconnect = useCallback(() => {
    setReconnectAttempts(0);
    reconnectDelayRef.current = 500;
    setError(null);
  }, []);

  return {
    isConnected,
    connectionStatus,
    reconnectAttempts,
    isRunning,
    stats,
    marketInfo,
    marketReserves,
    trades,
    position,
    botBalance,
    error,
    tpsHistory,
    sampleRate, // Current sampling rate (1 = all, 5 = 1 in 5, etc.)
    startTrading,
    stopTrading,
    connect,
    resetReconnect,
  };
}
