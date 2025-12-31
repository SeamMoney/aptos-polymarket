import { useState, useEffect, useCallback, useRef } from 'react';

const HFT_SERVER_URL = 'http://localhost:3001';
const HFT_WS_URL = 'ws://localhost:3001';

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

export function useHFTConnection() {
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

  // Connect to WebSocket with exponential backoff
  const connectWebSocket = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN ||
        wsRef.current?.readyState === WebSocket.CONNECTING) {
      return;
    }

    try {
      const ws = new WebSocket(HFT_WS_URL);

      ws.onopen = () => {
        console.log('🔌 Connected to HFT server');
        setIsConnected(true);
        setError(null);
        reconnectDelayRef.current = 500;
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);

          if (message.type === 'trade') {
            const trade = message.data as Trade;
            setTrades(prev => [trade, ...prev].slice(0, 100));
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
        } catch (e) {
          console.error('Failed to parse message:', e);
        }
      };

      ws.onclose = () => {
        console.log('🔌 Disconnected from HFT server');
        setIsConnected(false);
        wsRef.current = null;

        if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = setTimeout(() => {
          connectWebSocket();
        }, reconnectDelayRef.current);
        reconnectDelayRef.current = Math.min(reconnectDelayRef.current * 1.5, 30000);
      };

      ws.onerror = () => {
        setError('Cannot connect to HFT server');
      };

      wsRef.current = ws;
    } catch {
      setError('WebSocket connection failed');
    }
  }, []);

  // Connect on mount
  useEffect(() => {
    let mounted = true;
    const initTimeout = setTimeout(() => {
      if (mounted) connectWebSocket();
    }, 100);

    return () => {
      mounted = false;
      clearTimeout(initTimeout);
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [connectWebSocket]);

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
  };
}
