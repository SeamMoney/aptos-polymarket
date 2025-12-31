import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const HFT_WS_URL = 'ws://localhost:3001';
const HFT_SERVER_URL = 'http://localhost:3001';

// Market configuration
const MARKET_ADDRESS = '0xfefd1b67818ee4ef12a7953852c83f0efb411a9b92c518a52ba92555e4abdd96';

interface Trade {
  id: string;
  bot: string;
  actionDisplay: string;
  amount: number;
  latency: number;
  success: boolean;
  txHash?: string;
  explorerUrl?: string;
}

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
  isMultiOutcome?: boolean;
  outcomePrices?: number[];
  outcomeLabels?: string[];
}

const BOT_COLORS: Record<string, string> = {
  Alpha: '#2d9cdb',
  Beta: '#9b51e0',
  Gamma: '#00b7d7',
  Delta: '#f9452c',
  Epsilon: '#fe6e00',
  Zeta: '#27ae60',
  Omega: '#f99c00',
  Sigma: '#eb5757',
};

export function DemoMarketPage() {
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
  const [trades, setTrades] = useState<Trade[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [tpsHistory, setTpsHistory] = useState<number[]>([]);
  const wsRef = useRef<WebSocket | null>(null);
  const tpsIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastTpsRef = useRef(0);

  // Sample TPS every 500ms
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
          setTrades(prev => [msg.data, ...prev].slice(0, 20));
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
        // Ignore parse errors
      }
    };

    ws.onclose = () => {
      setIsConnected(false);
      wsRef.current = null;
      // Reconnect after delay
      setTimeout(connectWebSocket, 2000);
    };

    wsRef.current = ws;
  }, []);

  useEffect(() => {
    connectWebSocket();
    return () => wsRef.current?.close();
  }, [connectWebSocket]);

  const startHFT = async () => {
    try {
      await fetch(`${HFT_SERVER_URL}/start`, { method: 'POST' });
      setTpsHistory([]);
    } catch (e) {
      console.error('Failed to start HFT:', e);
    }
  };

  const stopHFT = async () => {
    try {
      await fetch(`${HFT_SERVER_URL}/stop`, { method: 'POST' });
    } catch (e) {
      console.error('Failed to stop HFT:', e);
    }
  };

  // TPS graph path
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

  // Default market data if not connected
  const displayMarket = marketInfo || {
    question: 'Who will be the Republican Presidential Nominee in 2028?',
    outcomePrices: [50, 50, 50, 50, 50, 50],
    outcomeLabels: ['J.D. Vance', 'Marco Rubio', 'Donald Trump', 'Ron DeSantis', 'Tucker Carlson', 'Other'],
  };

  return (
    <div className="min-h-screen bg-pm-dark-bg text-white">
      {/* Header */}
      <header className="border-b border-pm-dark-border px-4 lg:px-8 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-pm-blue flex items-center justify-center font-bold text-white">
              P
            </div>
            <span className="text-xl font-semibold">Polymarket</span>
            <span className="text-pm-text-muted text-sm hidden sm:inline">on Aptos</span>
          </div>

          <div className="flex items-center gap-4">
            {isConnected ? (
              <div className="flex items-center gap-2 text-pm-yes text-sm">
                <span className="w-2 h-2 bg-pm-yes rounded-full animate-pulse" />
                <span className="hidden sm:inline">Server Connected</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-pm-no text-sm">
                <span className="w-2 h-2 bg-pm-no rounded-full" />
                <span className="hidden sm:inline">Connecting...</span>
              </div>
            )}
            <div className="px-3 py-1.5 bg-pm-dark-surface rounded-lg text-sm text-pm-text-muted">
              Testnet
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 lg:px-8 py-8">
        {/* Market Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-pm-dark-surface border border-pm-dark-border rounded-2xl overflow-hidden mb-8"
        >
          {/* Market Header */}
          <div className="p-6 border-b border-pm-dark-border">
            <div className="flex items-center gap-2 mb-3">
              <span className="px-2 py-1 text-xs bg-pm-blue/20 text-pm-accent rounded-full font-medium">
                Politics
              </span>
              <span className="px-2 py-1 text-xs bg-pm-yes/20 text-pm-yes rounded-full font-medium">
                Multi-Outcome
              </span>
              <span className="px-2 py-1 text-xs bg-pm-no/20 text-pm-no rounded-full font-medium animate-pulse">
                LIVE
              </span>
            </div>
            <h1 className="text-2xl lg:text-3xl font-bold mb-2">
              {displayMarket.question}
            </h1>
            <p className="text-pm-text-muted text-sm">
              Market on Aptos Testnet • Contract: {MARKET_ADDRESS.slice(0, 10)}...
            </p>
          </div>

          {/* Outcomes Grid */}
          <div className="p-6">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
              {displayMarket.outcomeLabels?.map((label, i) => {
                const price = displayMarket.outcomePrices?.[i] || 50;
                const isLeading = price === Math.max(...(displayMarket.outcomePrices || []));
                return (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: i * 0.05 }}
                    className={`p-4 rounded-xl border transition-all ${
                      isLeading
                        ? 'bg-pm-yes/10 border-pm-yes/50'
                        : 'bg-pm-dark-surface-2 border-pm-dark-border hover:border-pm-dark-surface-4'
                    }`}
                  >
                    <div className="text-sm text-pm-text-secondary mb-1 truncate">{label}</div>
                    <motion.div
                      key={price}
                      initial={{ scale: 1.1 }}
                      animate={{ scale: 1 }}
                      className={`text-2xl font-bold tabular-nums ${
                        isLeading ? 'text-pm-yes' : 'text-white'
                      }`}
                    >
                      {price.toFixed(1)}¢
                    </motion.div>
                  </motion.div>
                );
              })}
            </div>

            {/* Start HFT Button */}
            <AnimatePresence mode="wait">
              {!isRunning ? (
                <motion.button
                  key="start"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={startHFT}
                  disabled={!isConnected}
                  className="w-full py-4 bg-gradient-to-r from-pm-blue to-pm-secondary text-white font-bold text-lg rounded-xl
                           hover:from-pm-blue-hover hover:to-pm-blue transition-all
                           disabled:opacity-50 disabled:cursor-not-allowed
                           shadow-lg shadow-pm-blue/20"
                >
                  <span className="flex items-center justify-center gap-3">
                    <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" />
                    </svg>
                    START HFT MODE
                  </span>
                  <span className="text-sm font-normal opacity-80 block mt-1">
                    {isConnected
                      ? 'Watch 20 bots trade at 10,000+ TPS on Aptos'
                      : 'Start HFT server first: ./scripts/run-demo.sh normal 60'}
                  </span>
                </motion.button>
              ) : (
                <motion.button
                  key="stop"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={stopHFT}
                  className="w-full py-4 bg-pm-no text-white font-bold text-lg rounded-xl hover:bg-pm-no-bright transition-all"
                >
                  STOP HFT MODE
                </motion.button>
              )}
            </AnimatePresence>
          </div>

          {/* Volume Footer */}
          <div className="px-6 py-4 border-t border-pm-dark-border bg-pm-dark-surface-2/50 flex items-center justify-between text-sm">
            <span className="text-pm-text-muted">
              Volume: <span className="text-white font-semibold">5,000 APT</span>
            </span>
            <span className="text-pm-text-muted">
              Bot Funds: <span className="text-pm-yes font-semibold">139,800 APT</span>
            </span>
          </div>
        </motion.div>

        {/* HFT Dashboard - Only shows when running */}
        <AnimatePresence>
          {(isRunning || trades.length > 0) && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="space-y-6"
            >
              {/* TPS + Block River Row */}
              <div className="grid lg:grid-cols-2 gap-6">
                {/* TPS Panel */}
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="bg-pm-dark-surface border border-pm-dark-border rounded-2xl p-6"
                >
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-pm-text-secondary text-sm uppercase tracking-wide">
                      Transactions Per Second
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 bg-pm-yes rounded-full animate-pulse" />
                      <span className="text-pm-yes text-xs font-medium">LIVE</span>
                    </div>
                  </div>

                  <div className="flex items-baseline gap-3 mb-2">
                    <motion.span
                      key={stats.currentTps}
                      initial={{ scale: 1.1, color: '#00b955' }}
                      animate={{ scale: 1, color: '#27ae60' }}
                      className="text-6xl font-bold tabular-nums"
                    >
                      {(stats.currentTps || 0).toLocaleString()}
                    </motion.span>
                    <span className="text-pm-text-muted text-xl">TPS</span>
                  </div>

                  <div className="text-sm text-pm-text-muted mb-4">
                    Peak: <span className="text-white font-semibold">{(stats.peakTps || 0).toLocaleString()}</span> TPS
                  </div>

                  {/* TPS Graph */}
                  <div className="h-24 relative bg-pm-dark-surface-2 rounded-lg overflow-hidden">
                    <svg
                      width="100%"
                      height="100%"
                      viewBox="0 0 100 100"
                      preserveAspectRatio="none"
                      className="overflow-visible"
                    >
                      <defs>
                        <linearGradient id="tpsGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#27ae60" stopOpacity="0.4" />
                          <stop offset="100%" stopColor="#27ae60" stopOpacity="0" />
                        </linearGradient>
                      </defs>
                      {/* Grid lines */}
                      <line x1="0" y1="25" x2="100" y2="25" stroke="#2c3f50" strokeWidth="0.3" vectorEffect="non-scaling-stroke" />
                      <line x1="0" y1="50" x2="100" y2="50" stroke="#2c3f50" strokeWidth="0.3" vectorEffect="non-scaling-stroke" />
                      <line x1="0" y1="75" x2="100" y2="75" stroke="#2c3f50" strokeWidth="0.3" vectorEffect="non-scaling-stroke" />
                      {/* Fill */}
                      <motion.path
                        d={fillPath}
                        fill="url(#tpsGradient)"
                        initial={false}
                        animate={{ d: fillPath }}
                        transition={{ duration: 0.3 }}
                      />
                      {/* Line */}
                      <motion.path
                        d={graphPath}
                        fill="none"
                        stroke="#27ae60"
                        strokeWidth="2"
                        vectorEffect="non-scaling-stroke"
                        strokeLinecap="round"
                        initial={false}
                        animate={{ d: graphPath }}
                        transition={{ duration: 0.3 }}
                      />
                    </svg>
                  </div>
                </motion.div>

                {/* Block River */}
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="bg-pm-dark-surface border border-pm-dark-border rounded-2xl overflow-hidden"
                >
                  <div className="p-4 border-b border-pm-dark-border flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold">Aptos Block River</h3>
                      <p className="text-pm-text-muted text-xs">Live block production on testnet</p>
                    </div>
                    <a
                      href="https://aptos-consensus-visualizer.vercel.app/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-pm-accent text-xs hover:underline"
                    >
                      Open Full View
                    </a>
                  </div>
                  <iframe
                    src="https://aptos-consensus-visualizer.vercel.app/"
                    className="w-full h-64 border-0"
                    title="Aptos Block River"
                  />
                </motion.div>
              </div>

              {/* Stats Row */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[
                  { label: 'Total Trades', value: stats.totalTrades.toLocaleString(), color: 'text-white' },
                  { label: 'Success Rate', value: `${stats.successRate}%`, color: 'text-pm-yes' },
                  { label: 'Avg Latency', value: `${stats.avgLatency}ms`, color: 'text-pm-secondary' },
                  { label: 'Failed', value: stats.failedTrades.toLocaleString(), color: 'text-pm-no' },
                ].map((stat, i) => (
                  <motion.div
                    key={stat.label}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.1 }}
                    className="bg-pm-dark-surface border border-pm-dark-border rounded-xl p-4"
                  >
                    <div className={`text-2xl font-bold ${stat.color}`}>{stat.value}</div>
                    <div className="text-pm-text-muted text-sm">{stat.label}</div>
                  </motion.div>
                ))}
              </div>

              {/* Trade Stream */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-pm-dark-surface border border-pm-dark-border rounded-2xl overflow-hidden"
              >
                <div className="p-4 border-b border-pm-dark-border flex items-center justify-between">
                  <h3 className="font-semibold">Live Trade Stream</h3>
                  <div className="flex items-center gap-2 text-pm-yes text-xs">
                    <span className="w-2 h-2 bg-pm-yes rounded-full animate-pulse" />
                    REAL ON-CHAIN TXS
                  </div>
                </div>

                <div className="divide-y divide-pm-dark-border max-h-80 overflow-y-auto">
                  <AnimatePresence initial={false}>
                    {trades.map((trade) => (
                      <motion.div
                        key={trade.id}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        className="px-4 py-3 flex items-center justify-between hover:bg-pm-dark-surface-2 transition-colors"
                      >
                        <div className="flex items-center gap-4">
                          <span
                            className="font-mono font-bold text-sm"
                            style={{ color: BOT_COLORS[trade.bot] || '#777e90' }}
                          >
                            {trade.bot}
                          </span>
                          <span className={`text-sm ${
                            trade.actionDisplay?.includes('BUY') ? 'text-pm-yes' : 'text-pm-no'
                          }`}>
                            {trade.actionDisplay}
                          </span>
                          <span className="text-white text-sm font-mono">
                            {trade.amount?.toFixed(3)} APT
                          </span>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className="text-pm-text-muted text-xs tabular-nums">
                            {trade.latency}ms
                          </span>
                          {trade.success && trade.explorerUrl ? (
                            <a
                              href={trade.explorerUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-pm-accent text-xs font-mono hover:underline"
                            >
                              {trade.txHash?.slice(0, 8)}...
                            </a>
                          ) : (
                            <span className="text-pm-no text-xs">Failed</span>
                          )}
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>

                  {trades.length === 0 && (
                    <div className="p-8 text-center text-pm-text-muted">
                      {isConnected ? 'Click Start HFT Mode to begin' : 'Waiting for server connection...'}
                    </div>
                  )}
                </div>
              </motion.div>

              {/* Comparison Footer */}
              <div className="bg-pm-dark-surface border border-pm-dark-border rounded-xl p-4">
                <div className="flex items-center justify-center gap-8 text-sm flex-wrap">
                  <div className="text-center">
                    <div className="text-pm-yes font-bold text-lg">~400ms</div>
                    <div className="text-pm-text-muted text-xs">Aptos Finality</div>
                  </div>
                  <div className="text-pm-text-muted">vs</div>
                  <div className="text-center">
                    <div className="text-pm-no font-bold text-lg">2-5 sec</div>
                    <div className="text-pm-text-muted text-xs">Polygon Finality</div>
                  </div>
                  <div className="w-px h-8 bg-pm-dark-border hidden sm:block" />
                  <div className="text-center">
                    <div className="text-pm-yes font-bold text-lg">160k+</div>
                    <div className="text-pm-text-muted text-xs">Aptos Peak TPS</div>
                  </div>
                  <div className="text-pm-text-muted">vs</div>
                  <div className="text-center">
                    <div className="text-pm-no font-bold text-lg">~65</div>
                    <div className="text-pm-text-muted text-xs">Polygon TPS</div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

      </main>

      {/* Footer */}
      <footer className="border-t border-pm-dark-border py-6 mt-12">
        <div className="max-w-7xl mx-auto px-4 lg:px-8 text-center">
          <p className="text-pm-text-muted text-sm">
            Demo powered by{' '}
            <a href="https://aptos.dev" className="text-pm-accent hover:underline">Aptos</a>
            {' '}• Built for demo day
          </p>
        </div>
      </footer>
    </div>
  );
}
