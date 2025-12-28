import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const HFT_WS_URL = 'ws://localhost:3001';
const HFT_SERVER_URL = 'http://localhost:3001';

interface Stats {
  totalTrades: number;
  successfulTrades: number;
  failedTrades: number;
  successRate: number;
  avgLatency: number;
  currentTps?: number;
  peakTps?: number;
}

interface MarketInfo {
  address: string;
  question: string;
  yesPrice: number;
  noPrice: number;
  isMultiOutcome?: boolean;
  outcomePrices?: number[];
  outcomeLabels?: string[];
}

interface Trade {
  id: string;
  actionDisplay: string;
  amount: number;
  latency: number;
  success: boolean;
}

export function DemoMode() {
  const [stats, setStats] = useState<Stats>({
    totalTrades: 0,
    successfulTrades: 0,
    failedTrades: 0,
    successRate: 0,
    avgLatency: 0,
    currentTps: 0,
    peakTps: 0,
  });
  const [marketInfo, setMarketInfo] = useState<MarketInfo | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [tpsHistory, setTpsHistory] = useState<number[]>([]);
  const wsRef = useRef<WebSocket | null>(null);
  const tpsIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastTpsRef = useRef(0);

  // Sample TPS every 500ms - use ref to avoid dependency issues
  useEffect(() => {
    if (isRunning) {
      tpsIntervalRef.current = setInterval(() => {
        setTpsHistory(prev => [...prev.slice(-59), lastTpsRef.current]);
      }, 500);
    } else {
      if (tpsIntervalRef.current) clearInterval(tpsIntervalRef.current);
    }
    return () => {
      if (tpsIntervalRef.current) clearInterval(tpsIntervalRef.current);
    };
  }, [isRunning]);

  const connectWebSocket = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const ws = new WebSocket(HFT_WS_URL);

    ws.onopen = () => setIsConnected(true);

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'trade') {
          setTrades(prev => [msg.data, ...prev].slice(0, 8));
          setStats(msg.stats);
          lastTpsRef.current = msg.stats.currentTps || 0;
          if (msg.market) setMarketInfo(msg.market);
        } else if (msg.type === 'state') {
          setIsRunning(msg.data.isRunning);
          setStats(msg.data.stats);
          lastTpsRef.current = msg.data.stats?.currentTps || 0;
          if (msg.data.market) setMarketInfo(msg.data.market);
        } else if (msg.type === 'started') {
          setIsRunning(true);
          setTpsHistory([]);
          if (msg.market) setMarketInfo(msg.market);
        } else if (msg.type === 'stopped') {
          setIsRunning(false);
        }
      } catch {
        // Ignore parse errors from malformed messages
      }
    };

    ws.onclose = () => {
      setIsConnected(false);
      wsRef.current = null;
    };

    wsRef.current = ws;
  }, []);

  // Reconnect on disconnect
  useEffect(() => {
    if (!isConnected && !wsRef.current) {
      const timeout = setTimeout(connectWebSocket, 2000);
      return () => clearTimeout(timeout);
    }
  }, [isConnected, connectWebSocket]);

  useEffect(() => {
    connectWebSocket();
    return () => wsRef.current?.close();
  }, [connectWebSocket]);

  const startTrading = async () => {
    await fetch(`${HFT_SERVER_URL}/start`, { method: 'POST' }).catch(() => {});
    setTpsHistory([]);
  };

  const stopTrading = async () => {
    await fetch(`${HFT_SERVER_URL}/stop`, { method: 'POST' }).catch(() => {});
  };

  // Memoize SVG path
  const graphPath = useMemo(() => {
    if (tpsHistory.length < 2) return '';
    const max = Math.max(...tpsHistory, 100);
    const points = tpsHistory.map((tps, i) => {
      const x = (i / (tpsHistory.length - 1)) * 100;
      const y = 100 - (tps / max) * 100;
      return `${x},${y}`;
    });
    return `M ${points.join(' L ')}`;
  }, [tpsHistory]);

  const fillPath = useMemo(() => {
    if (!graphPath) return '';
    return `${graphPath} L 100,100 L 0,100 Z`;
  }, [graphPath]);

  return (
    <div className="min-h-screen bg-[#0d0d0d] text-white">
      {/* Header */}
      <header className="border-b border-[#1e1e1e] px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <a href="/" className="flex items-center gap-2">
            <div className="w-7 h-7 rounded bg-[#00d26a] flex items-center justify-center text-sm font-bold text-black">P</div>
            <span className="font-semibold hidden sm:inline">Polymarket</span>
          </a>
          <span className="text-xs text-gray-600 hidden sm:inline">on Aptos</span>
        </div>

        <div className="flex items-center gap-3">
          <AnimatePresence>
            {isRunning && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className="flex items-center gap-2 text-[#00d26a] text-sm"
              >
                <span className="w-1.5 h-1.5 bg-[#00d26a] rounded-full animate-pulse" />
                LIVE
              </motion.div>
            )}
          </AnimatePresence>
          {!isRunning ? (
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={startTrading}
              disabled={!isConnected}
              className="px-4 py-1.5 bg-[#00d26a] text-black text-sm font-semibold rounded-lg disabled:opacity-50"
            >
              Start
            </motion.button>
          ) : (
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={stopTrading}
              className="px-4 py-1.5 bg-[#1e1e1e] text-white text-sm font-semibold rounded-lg border border-[#333]"
            >
              Stop
            </motion.button>
          )}
        </div>
      </header>

      <div className="max-w-6xl mx-auto p-4 sm:p-6">
        {/* Market Question */}
        <AnimatePresence>
          {marketInfo && (
            <motion.h1
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-xl sm:text-2xl font-semibold mb-6"
            >
              {marketInfo.question}
            </motion.h1>
          )}
        </AnimatePresence>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-4">
            {/* TPS Display */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-[#141414] border border-[#1e1e1e] rounded-xl p-6"
            >
              <div className="flex items-baseline gap-3 mb-1">
                <motion.span
                  key={stats.currentTps}
                  initial={{ scale: 1.05, color: '#00ff7f' }}
                  animate={{ scale: 1, color: '#00d26a' }}
                  transition={{ duration: 0.2 }}
                  className="text-5xl sm:text-6xl font-bold tabular-nums"
                >
                  {(stats.currentTps || 0).toLocaleString()}
                </motion.span>
                <span className="text-gray-500 text-lg">TPS</span>
              </div>
              <div className="text-sm text-gray-500">
                Peak: <span className="text-white">{(stats.peakTps || 0).toLocaleString()}</span> TPS
              </div>

              {/* TPS Graph */}
              <div className="mt-4 h-24 relative">
                <svg
                  width="100%"
                  height="100%"
                  viewBox="0 0 100 100"
                  preserveAspectRatio="none"
                  className="overflow-visible"
                >
                  <defs>
                    <linearGradient id="tpsGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#00d26a" stopOpacity="0.3" />
                      <stop offset="100%" stopColor="#00d26a" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  {/* Grid lines */}
                  <line x1="0" y1="25" x2="100" y2="25" stroke="#1e1e1e" strokeWidth="0.3" vectorEffect="non-scaling-stroke" />
                  <line x1="0" y1="50" x2="100" y2="50" stroke="#1e1e1e" strokeWidth="0.3" vectorEffect="non-scaling-stroke" />
                  <line x1="0" y1="75" x2="100" y2="75" stroke="#1e1e1e" strokeWidth="0.3" vectorEffect="non-scaling-stroke" />
                  {/* Fill */}
                  <motion.path
                    d={fillPath}
                    fill="url(#tpsGrad)"
                    initial={false}
                    animate={{ d: fillPath }}
                    transition={{ duration: 0.3, ease: 'linear' }}
                  />
                  {/* Line */}
                  <motion.path
                    d={graphPath}
                    fill="none"
                    stroke="#00d26a"
                    strokeWidth="1.5"
                    vectorEffect="non-scaling-stroke"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    initial={false}
                    animate={{ d: graphPath }}
                    transition={{ duration: 0.3, ease: 'linear' }}
                  />
                </svg>
              </div>
            </motion.div>

            {/* Stats Row */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'Trades', value: stats.totalTrades.toLocaleString(), color: 'text-white' },
                { label: 'Success', value: `${stats.successRate}%`, color: 'text-[#00d26a]' },
                { label: 'Latency', value: `${stats.avgLatency}ms`, color: 'text-white' },
              ].map((stat, i) => (
                <motion.div
                  key={stat.label}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1 }}
                  className="bg-[#141414] border border-[#1e1e1e] rounded-xl p-4"
                >
                  <motion.div
                    key={stat.value}
                    initial={{ scale: 1.02 }}
                    animate={{ scale: 1 }}
                    className={`text-2xl font-semibold ${stat.color}`}
                  >
                    {stat.value}
                  </motion.div>
                  <div className="text-xs text-gray-500">{stat.label}</div>
                </motion.div>
              ))}
            </div>

            {/* Recent Trades */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="bg-[#141414] border border-[#1e1e1e] rounded-xl p-4"
            >
              <div className="text-xs text-gray-500 uppercase mb-3">Recent Activity</div>
              <div className="space-y-0.5 overflow-hidden">
                <AnimatePresence initial={false} mode="popLayout">
                  {trades.map((t) => (
                    <motion.div
                      key={t.id}
                      layout
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.15 }}
                      className="flex items-center justify-between py-1.5 text-sm"
                    >
                      <span className={t.actionDisplay?.includes('BUY') ? 'text-[#00d26a]' : 'text-[#ff6b6b]'}>
                        {t.actionDisplay}
                      </span>
                      <span className="text-gray-500 text-xs tabular-nums">{t.latency}ms</span>
                    </motion.div>
                  ))}
                </AnimatePresence>
                {trades.length === 0 && (
                  <div className="text-gray-600 text-sm py-4 text-center">
                    {isConnected ? 'Click Start to begin' : 'Connecting...'}
                  </div>
                )}
              </div>
            </motion.div>
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            {/* Prices */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-[#141414] border border-[#1e1e1e] rounded-xl p-4"
            >
              <div className="text-xs text-gray-500 uppercase mb-3">Prices</div>
              {marketInfo?.isMultiOutcome && marketInfo.outcomePrices ? (
                <div className="space-y-2">
                  {marketInfo.outcomePrices.map((price, i) => {
                    const isTop = price === Math.max(...(marketInfo.outcomePrices || []));
                    return (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: i * 0.05 }}
                        className={`flex items-center justify-between py-2 px-3 rounded-lg ${
                          isTop ? 'bg-[#00d26a]/10' : 'bg-[#0d0d0d]'
                        }`}
                      >
                        <span className={`text-sm truncate max-w-[120px] ${isTop ? 'text-[#00d26a]' : 'text-gray-300'}`}>
                          {marketInfo.outcomeLabels?.[i] || `Outcome ${i + 1}`}
                        </span>
                        <motion.span
                          key={price}
                          initial={{ scale: 1.1 }}
                          animate={{ scale: 1 }}
                          className={`font-semibold tabular-nums ${isTop ? 'text-[#00d26a]' : 'text-white'}`}
                        >
                          {price.toFixed(1)}¢
                        </motion.span>
                      </motion.div>
                    );
                  })}
                </div>
              ) : marketInfo ? (
                <div className="grid grid-cols-2 gap-3">
                  <div className="text-center p-3 bg-[#00d26a]/10 rounded-lg">
                    <motion.div
                      key={marketInfo.yesPrice}
                      initial={{ scale: 1.05 }}
                      animate={{ scale: 1 }}
                      className="text-2xl font-bold text-[#00d26a]"
                    >
                      {marketInfo.yesPrice.toFixed(1)}¢
                    </motion.div>
                    <div className="text-xs text-gray-500">Yes</div>
                  </div>
                  <div className="text-center p-3 bg-[#ff6b6b]/10 rounded-lg">
                    <motion.div
                      key={marketInfo.noPrice}
                      initial={{ scale: 1.05 }}
                      animate={{ scale: 1 }}
                      className="text-2xl font-bold text-[#ff6b6b]"
                    >
                      {marketInfo.noPrice.toFixed(1)}¢
                    </motion.div>
                    <div className="text-xs text-gray-500">No</div>
                  </div>
                </div>
              ) : (
                <div className="text-gray-600 text-sm text-center py-4">Loading...</div>
              )}
            </motion.div>

            {/* Comparison */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 }}
              className="bg-[#141414] border border-[#1e1e1e] rounded-xl p-4"
            >
              <div className="text-xs text-gray-500 uppercase mb-3">Aptos vs Polygon</div>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-gray-500 text-sm">Finality</span>
                  <div>
                    <span className="text-[#00d26a] font-semibold">~400ms</span>
                    <span className="text-gray-600 text-xs ml-2">vs 2-5s</span>
                  </div>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-500 text-sm">Peak TPS</span>
                  <div>
                    <span className="text-[#00d26a] font-semibold">160k+</span>
                    <span className="text-gray-600 text-xs ml-2">vs ~65</span>
                  </div>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-500 text-sm">Outages</span>
                  <div>
                    <span className="text-[#00d26a] font-semibold">0</span>
                    <span className="text-gray-600 text-xs ml-2">vs frequent</span>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </div>

      {/* Connection overlay */}
      <AnimatePresence>
        {!isConnected && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/90 flex items-center justify-center z-50"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="text-center p-8 bg-[#141414] border border-[#1e1e1e] rounded-2xl"
            >
              <div className="text-xl font-semibold mb-3">Start HFT Server</div>
              <code className="block bg-[#0d0d0d] text-[#00d26a] px-4 py-2 rounded-lg text-sm">
                npm run hft
              </code>
              <p className="text-gray-500 text-sm mt-4">Then refresh this page</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
