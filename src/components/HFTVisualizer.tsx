import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { OrderBook } from './OrderBook';

const HFT_SERVER_URL = 'http://localhost:3001';
const HFT_WS_URL = 'ws://localhost:3001';

interface Trade {
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

interface Stats {
  totalTrades: number;
  successfulTrades: number;
  failedTrades: number;
  successRate: number;
  avgLatency: number;
  currentDelay?: number;
  currentTps?: number;
  peakTps?: number;
}

interface MarketInfo {
  address: string;
  question: string;
  yesPrice: number;
  noPrice: number;
  // Multi-outcome data
  isMultiOutcome?: boolean;
  outcomeCount?: number;
  outcomePrices?: number[];
  outcomeLabels?: string[];
}

interface Position {
  yesTokens: number;
  noTokens: number;
  totalInvested: number;
  realizedPnl: number;
  outcomePositions?: number[];
}

const BOT_COLORS: Record<string, string> = {
  Alpha: 'text-blue-400',
  Beta: 'text-purple-400',
  Gamma: 'text-cyan-400',
  Delta: 'text-pink-400',
  Epsilon: 'text-orange-400',
  Zeta: 'text-green-400',
  Omega: 'text-yellow-400',
  Sigma: 'text-red-400',
};

export function HFTVisualizer() {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [stats, setStats] = useState<Stats>({
    totalTrades: 0,
    successfulTrades: 0,
    failedTrades: 0,
    successRate: 0,
    avgLatency: 0,
  });
  const [marketInfo, setMarketInfo] = useState<MarketInfo | null>(null);
  const [position, setPosition] = useState<Position>({
    yesTokens: 0,
    noTokens: 0,
    totalInvested: 0,
    realizedPnl: 0,
  });
  const [isRunning, setIsRunning] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [botBalance, setBotBalance] = useState(0);
  const [marketReserves, setMarketReserves] = useState({ yesReserve: 0, noReserve: 0, tvl: 0 });
  const [tpsHistory, setTpsHistory] = useState<number[]>([]);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectDelayRef = useRef(500);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTpsRef = useRef(0);
  const tpsIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Connect to WebSocket with exponential backoff
  const connectWebSocket = useCallback(() => {
    // Prevent multiple connections
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
        reconnectDelayRef.current = 500; // Reset on successful connection
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
            setError(`💸 ${message.message || 'Low balance - trading stopped'}`);
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

        // Exponential backoff reconnection
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

  // Connect on mount - with cleanup to prevent duplicate connections
  useEffect(() => {
    let mounted = true;

    // Small delay to let React Strict Mode settle
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

  // Track TPS history for chart
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

  // Memoize chart path for performance
  const chartPath = useMemo(() => {
    if (tpsHistory.length < 2) return '';
    const max = Math.max(...tpsHistory, 100);
    const points = tpsHistory.map((tps, i) => {
      const x = (i / (tpsHistory.length - 1)) * 100;
      const y = 100 - (tps / max) * 100;
      return `${x},${y}`;
    });
    return `M ${points.join(' L ')}`;
  }, [tpsHistory]);

  // Start trading
  const startTrading = async () => {
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
  };

  // Stop trading
  const stopTrading = async () => {
    try {
      await fetch(`${HFT_SERVER_URL}/stop`, { method: 'POST' });
      setIsRunning(false);
    } catch (e: unknown) {
      const errorMessage = e instanceof Error ? e.message : 'Unknown error';
      setError(errorMessage);
    }
  };

  const getActionColor = (action: string) => {
    if (action.includes('YES')) return action.includes('BUY') ? 'text-poly-green' : 'text-orange-400';
    return action.includes('BUY') ? 'text-poly-red' : 'text-yellow-400';
  };

  const getActionIcon = (action: string) => {
    return action.includes('BUY') ? '↗' : '↘';
  };

  const formatAmount = (amount: number) => {
    if (amount >= 1) return amount.toFixed(3);
    if (amount >= 0.1) return amount.toFixed(4);
    return amount.toFixed(4);
  };

  // Calculate unrealized PNL
  const unrealizedPnl = marketInfo
    ? (position.yesTokens * (marketInfo.yesPrice / 100)) +
      (position.noTokens * (marketInfo.noPrice / 100)) -
      position.totalInvested
    : 0;

  // Total PNL is just unrealized since we don't track realized
  const totalPnl = unrealizedPnl;

  return (
    <div className="bg-poly-card border border-poly-border rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-poly-border bg-gradient-to-r from-poly-green/10 to-transparent">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <span className="text-2xl">⚡</span>
              HFT Bots - Real On-Chain Transactions
            </h2>
            {marketInfo && (
              <div className="mt-2">
                <div className="text-lg font-semibold text-white">{marketInfo.question}</div>
                <div className="text-xs text-gray-500 font-mono">{marketInfo.address}</div>
              </div>
            )}
            <p className="text-sm text-gray-400 mt-1 flex items-center gap-2">
              {isConnected ? (
                <>
                  <span className="w-2 h-2 bg-poly-green rounded-full animate-pulse" />
                  Connected • Click tx hash to verify
                </>
              ) : (
                <>
                  <span className="w-2 h-2 bg-red-500 rounded-full" />
                  Server disconnected
                </>
              )}
            </p>
          </div>
          <div className="flex gap-2">
            {!isRunning ? (
              <button
                onClick={startTrading}
                disabled={!isConnected}
                className="px-4 py-2 bg-poly-green text-black font-bold rounded-lg hover:bg-poly-green/90 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span>▶</span> Start Bots
              </button>
            ) : (
              <button
                onClick={stopTrading}
                className="px-4 py-2 bg-red-500 text-white font-bold rounded-lg hover:bg-red-600 transition-all flex items-center gap-2"
              >
                <span>⏹</span> Stop
              </button>
            )}
          </div>
        </div>

        {error && (
          <div className="mt-3 p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-400 text-sm">
            {error}
          </div>
        )}
      </div>

      <div className="grid lg:grid-cols-4 gap-4 p-4">
        {/* Left Column - Prices & Position */}
        <div className="lg:col-span-1 space-y-4">
          {/* Current Price - Multi-outcome or Binary */}
          <div className="bg-poly-dark rounded-xl p-4">
            <div className="text-sm text-gray-400 mb-2">Outcome Prices</div>
            {marketInfo?.isMultiOutcome && marketInfo.outcomePrices && marketInfo.outcomeLabels ? (
              <div className="space-y-2">
                {marketInfo.outcomePrices.map((price, i) => {
                  const label = marketInfo.outcomeLabels?.[i] || `Outcome ${i + 1}`;
                  const isTopOutcome = price === Math.max(...(marketInfo.outcomePrices || []));
                  return (
                    <div
                      key={i}
                      className={`flex justify-between items-center p-2 rounded-lg ${
                        isTopOutcome ? 'bg-poly-green/20' : 'bg-poly-card'
                      }`}
                    >
                      <span className={`text-sm truncate ${isTopOutcome ? 'text-poly-green font-semibold' : 'text-gray-300'}`}>
                        {label}
                      </span>
                      <span className={`font-mono font-bold ${isTopOutcome ? 'text-poly-green' : 'text-white'}`}>
                        {price.toFixed(2)}¢
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <div className="text-center p-3 bg-poly-green/10 rounded-lg">
                  <div className="text-3xl font-bold text-poly-green">
                    {marketInfo?.yesPrice.toFixed(2) || '50.00'}¢
                  </div>
                  <div className="text-xs text-poly-green">YES</div>
                </div>
                <div className="text-center p-3 bg-poly-red/10 rounded-lg">
                  <div className="text-3xl font-bold text-poly-red">
                    {marketInfo?.noPrice.toFixed(2) || '50.00'}¢
                  </div>
                  <div className="text-xs text-poly-red">NO</div>
                </div>
              </div>
            )}
          </div>

          {/* Position & PNL */}
          <div className="bg-poly-dark rounded-xl p-4">
            <div className="text-sm text-gray-400 mb-3">Position & PNL</div>
            <div className="space-y-2">
              {/* Multi-outcome positions */}
              {marketInfo?.isMultiOutcome && position.outcomePositions && marketInfo.outcomeLabels ? (
                position.outcomePositions.map((tokens, i) => (
                  <div key={i} className="flex justify-between">
                    <span className="text-gray-400 text-sm truncate max-w-[120px]">
                      {marketInfo.outcomeLabels?.[i] || `Outcome ${i + 1}`}
                    </span>
                    <span className={`font-mono ${tokens > 0 ? 'text-poly-green' : 'text-gray-500'}`}>
                      {tokens.toFixed(2)}
                    </span>
                  </div>
                ))
              ) : (
                <>
                  <div className="flex justify-between">
                    <span className="text-gray-400">YES Tokens</span>
                    <span className="text-poly-green font-mono">{position.yesTokens.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">NO Tokens</span>
                    <span className="text-poly-red font-mono">{position.noTokens.toFixed(2)}</span>
                  </div>
                </>
              )}
              <div className="border-t border-poly-border my-2" />
              <div className="flex justify-between">
                <span className="text-gray-400">Invested</span>
                <span className="text-white font-mono">{position.totalInvested.toFixed(4)} APT</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Realized PNL</span>
                <span className="text-gray-500 font-mono text-xs" title="Cost-basis tracking not implemented">
                  N/A
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Unrealized PNL</span>
                <span className={`font-mono ${unrealizedPnl >= 0 ? 'text-poly-green' : 'text-red-400'}`}>
                  {unrealizedPnl >= 0 ? '+' : ''}{unrealizedPnl.toFixed(4)} APT
                </span>
              </div>
              <div className="border-t border-poly-border my-2" />
              <div className="flex justify-between">
                <span className="text-white font-semibold">Total PNL</span>
                <span className={`font-mono font-bold text-lg ${totalPnl >= 0 ? 'text-poly-green' : 'text-red-400'}`}>
                  {totalPnl >= 0 ? '+' : ''}{totalPnl.toFixed(4)} APT
                </span>
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="bg-poly-dark rounded-xl p-4">
            <div className="text-sm text-gray-400 mb-3">Performance</div>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-400">Avg Latency</span>
                <span className="text-poly-green font-bold">{stats.avgLatency}ms</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Success Rate</span>
                <span className={`font-bold ${stats.successRate >= 90 ? 'text-poly-green' : stats.successRate >= 70 ? 'text-yellow-400' : 'text-red-400'}`}>
                  {stats.successRate}%
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Total Trades</span>
                <span className="text-white font-bold">{stats.totalTrades}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Current Delay</span>
                <span className="text-gray-300 font-mono">{stats.currentDelay || 150}ms</span>
              </div>
            </div>
          </div>

          {/* TPS Display with Chart */}
          <div className="bg-poly-dark rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-400">Throughput</span>
              <span className="text-xs text-gray-500">Peak: {stats.peakTps || 0}</span>
            </div>
            <div className="text-4xl font-bold text-poly-green mb-3">
              {stats.currentTps || 0} <span className="text-lg font-normal text-gray-400">TPS</span>
            </div>
            {/* TPS History Chart */}
            <div className="h-16 bg-[#0d0d0d] rounded-lg overflow-hidden relative">
              {tpsHistory.length > 1 ? (
                <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                  <defs>
                    <linearGradient id="tpsGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#00d26a" stopOpacity="0.3" />
                      <stop offset="100%" stopColor="#00d26a" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  {/* Fill area */}
                  <path
                    d={`${chartPath} L 100,100 L 0,100 Z`}
                    fill="url(#tpsGradient)"
                  />
                  {/* Line */}
                  <path
                    d={chartPath}
                    fill="none"
                    stroke="#00d26a"
                    strokeWidth="2"
                    vectorEffect="non-scaling-stroke"
                  />
                </svg>
              ) : (
                <div className="flex items-center justify-center h-full text-gray-600 text-xs">
                  {isRunning ? 'Collecting data...' : 'Start bots to see chart'}
                </div>
              )}
            </div>
          </div>

          {/* Visibility - Bot Balance & Market Reserves */}
          <div className={`bg-poly-dark rounded-xl p-4 ${botBalance < 1 ? 'border border-red-500/50' : ''}`}>
            <div className="text-sm text-gray-400 mb-3">Funds Visibility</div>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Bot Balance</span>
                <div className="flex items-center gap-2">
                  {botBalance < 1 && (
                    <span className="text-xs text-red-400 animate-pulse">LOW</span>
                  )}
                  <span className={`font-mono font-bold ${botBalance < 1 ? 'text-red-400' : botBalance < 5 ? 'text-yellow-400' : 'text-white'}`}>
                    {botBalance.toFixed(2)} APT
                  </span>
                </div>
              </div>
              {botBalance < 1 && (
                <div className="text-xs text-red-400 bg-red-500/10 p-2 rounded">
                  Add funds to continue trading. Min 0.5 APT required.
                </div>
              )}
              <div className="border-t border-poly-border my-2" />
              <div className="text-xs text-gray-500 mb-2">Market Reserves (TVL)</div>
              <div className="flex justify-between">
                <span className="text-gray-400">YES Pool</span>
                <span className="text-poly-green font-mono">{marketReserves.yesReserve.toFixed(4)} APT</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">NO Pool</span>
                <span className="text-poly-red font-mono">{marketReserves.noReserve.toFixed(4)} APT</span>
              </div>
              <div className="border-t border-poly-border my-2" />
              <div className="flex justify-between">
                <span className="text-white font-semibold">Total TVL</span>
                <span className="text-yellow-400 font-mono font-bold">{marketReserves.tvl.toFixed(4)} APT</span>
              </div>
            </div>
          </div>
        </div>

        {/* Order Book */}
        <div className="lg:col-span-1">
          <OrderBook
            trades={trades}
            yesPrice={marketInfo?.yesPrice || 50}
            noPrice={marketInfo?.noPrice || 50}
            yesReserve={marketReserves.yesReserve}
            noReserve={marketReserves.noReserve}
          />
        </div>

        {/* Trade Stream */}
        <div className="lg:col-span-2 bg-poly-dark rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm text-gray-400">Live Trade Stream</div>
            {isRunning && (
              <div className="flex items-center gap-2 text-xs text-poly-green">
                <span className="w-2 h-2 bg-poly-green rounded-full animate-pulse" />
                LIVE - REAL TXS
              </div>
            )}
          </div>

          <div className="h-[450px] overflow-y-auto relative scrollbar-thin scrollbar-thumb-poly-border scrollbar-track-transparent">
            <AnimatePresence mode="popLayout">
              {trades.slice(0, 50).map((trade) => (
                <motion.div
                  key={trade.id}
                  initial={{ opacity: 0, x: 100 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -100 }}
                  transition={{ duration: 0.06 }}
                  className={`flex items-center justify-between py-1.5 px-3 mb-1 rounded-lg ${
                    trade.success ? 'bg-poly-card/50' : 'bg-red-500/10 border border-red-500/30'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className={`font-mono font-bold text-sm ${BOT_COLORS[trade.bot] || 'text-white'}`}>
                      {trade.bot}
                    </span>
                    <span className={`font-medium text-sm ${getActionColor(trade.actionDisplay)}`}>
                      {getActionIcon(trade.actionDisplay)} {trade.actionDisplay}
                    </span>
                    <span className="text-white font-mono text-sm font-bold">
                      {formatAmount(trade.amount)} APT
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-gray-400 text-xs font-mono">[{trade.latency}ms]</span>
                    {trade.success && trade.explorerUrl ? (
                      <a
                        href={trade.explorerUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-poly-green hover:underline text-xs font-mono flex items-center gap-1"
                      >
                        {trade.txHash?.slice(0, 10)}...
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                      </a>
                    ) : (
                      <span className="text-red-400 text-xs">FAILED</span>
                    )}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>

            {trades.length === 0 && (
              <div className="absolute inset-0 flex items-center justify-center text-gray-500">
                <div className="text-center">
                  <div className="text-4xl mb-2">🤖</div>
                  {isConnected ? (
                    <>
                      <div>Click "Start Bots" to begin</div>
                      <div className="text-xs mt-2 text-gray-600">
                        Real on-chain transactions on Aptos testnet
                      </div>
                    </>
                  ) : (
                    <>
                      <div>Start the HFT server first:</div>
                      <code className="text-xs mt-2 bg-poly-dark px-2 py-1 rounded block">
                        npx tsx server/hft-server.ts
                      </code>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Comparison Footer */}
      <div className="p-4 border-t border-[#1e1e1e] bg-[#0d0d0d]">
        <div className="flex items-center justify-center gap-6 md:gap-10 text-sm flex-wrap">
          <div className="text-center">
            <div className="text-2xl font-bold text-white">{stats.avgLatency || '~180'}<span className="text-base text-gray-500">ms</span></div>
            <div className="text-xs text-gray-500">Aptos</div>
          </div>
          <div className="text-gray-600 text-xs">vs</div>
          <div className="text-center">
            <div className="text-2xl font-bold text-red-400">2-5<span className="text-base text-gray-500">sec</span></div>
            <div className="text-xs text-gray-500">Polygon</div>
          </div>
          <div className="hidden md:block w-px h-8 bg-[#1e1e1e]" />
          <div className="text-center">
            <div className="text-2xl font-bold text-poly-green">{stats.currentTps || 0}</div>
            <div className="text-xs text-gray-500">TPS</div>
          </div>
          <div className="hidden md:block w-px h-8 bg-[#1e1e1e]" />
          <div className="text-center">
            <div className={`text-2xl font-bold ${totalPnl >= 0 ? 'text-poly-green' : 'text-red-400'}`}>
              {totalPnl >= 0 ? '+' : ''}{totalPnl.toFixed(2)}
            </div>
            <div className="text-xs text-gray-500">PNL (APT)</div>
          </div>
        </div>
      </div>

      {/* Server Instructions */}
      {!isConnected && (
        <div className="p-3 bg-yellow-500/10 border-t border-yellow-500/30 text-center text-sm text-yellow-400">
          <strong>Server Required:</strong> Run <code className="bg-poly-dark px-2 py-1 rounded mx-1">APTOS_PRIVATE_KEY=0x... npx tsx server/hft-server.ts</code> in terminal
        </div>
      )}
    </div>
  );
}
