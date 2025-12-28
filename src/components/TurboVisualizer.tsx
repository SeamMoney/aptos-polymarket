import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const TURBO_SERVER_URL = 'http://localhost:3002';
const TURBO_WS_URL = 'ws://localhost:3002';

interface Trade {
  id: string;
  bot: string;
  action: string;
  amount: number;
  latency: number;
  success: boolean;
  txHash?: string;
  timestamp: number;
}

interface Stats {
  totalTxns: number;
  successfulTxns: number;
  failedTxns: number;
  successRate: number;
  currentTPS: string;
  peakTPS: string;
  avgLatency: number;
  batchSize: number;
  mode: string;
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
  Theta: 'text-indigo-400',
  Kappa: 'text-teal-400',
};

export function TurboVisualizer() {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [stats, setStats] = useState<Stats>({
    totalTxns: 0,
    successfulTxns: 0,
    failedTxns: 0,
    successRate: 0,
    currentTPS: '0.0',
    peakTPS: '0.0',
    avgLatency: 0,
    batchSize: 5,
    mode: 'turbo',
  });
  const [isRunning, setIsRunning] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [mode, setMode] = useState<'normal' | 'turbo' | 'burst'>('turbo');
  const wsRef = useRef<WebSocket | null>(null);

  const connectWebSocket = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const ws = new WebSocket(TURBO_WS_URL);

    ws.onopen = () => {
      console.log('🔥 Connected to Turbo server');
      setIsConnected(true);
    };

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);

      if (msg.type === 'batch') {
        setTrades(prev => [...msg.trades.slice(-5), ...prev].slice(0, 30));
        setStats(msg.stats);
        setIsRunning(true);
      } else if (msg.type === 'started') {
        setIsRunning(true);
      } else if (msg.type === 'stopped') {
        setIsRunning(false);
      } else if (msg.type === 'state') {
        if (msg.data?.stats) setStats(msg.data.stats);
      } else if (msg.type === 'modeChanged') {
        setMode(msg.mode);
      }
    };

    ws.onclose = () => {
      setIsConnected(false);
      setTimeout(connectWebSocket, 2000);
    };

    wsRef.current = ws;
  }, []);

  useEffect(() => {
    connectWebSocket();
    return () => wsRef.current?.close();
  }, [connectWebSocket]);

  const handleStart = async () => {
    try {
      await fetch(`${TURBO_SERVER_URL}/start`, { method: 'POST' });
    } catch (e) {
      console.error('Failed to start:', e);
    }
  };

  const handleStop = async () => {
    try {
      await fetch(`${TURBO_SERVER_URL}/stop`, { method: 'POST' });
    } catch (e) {
      console.error('Failed to stop:', e);
    }
  };

  const handleModeChange = async (newMode: 'normal' | 'turbo' | 'burst') => {
    try {
      await fetch(`${TURBO_SERVER_URL}/mode/${newMode}`, { method: 'POST' });
      setMode(newMode);
    } catch (e) {
      console.error('Failed to change mode:', e);
    }
  };

  const tpsValue = parseFloat(stats.currentTPS);

  return (
    <div className="bg-poly-card border border-poly-border rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-poly-border bg-gradient-to-r from-orange-500/10 to-red-500/10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🔥</span>
            <div>
              <h3 className="text-xl font-bold text-white">TURBO MODE</h3>
              <p className="text-sm text-gray-400">Parallel Transaction Bursts</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isConnected ? (
              <span className="flex items-center gap-2 text-sm text-poly-green">
                <span className="w-2 h-2 bg-poly-green rounded-full animate-pulse" />
                Connected
              </span>
            ) : (
              <span className="text-sm text-gray-500">Connecting...</span>
            )}
          </div>
        </div>
      </div>

      {/* Giant TPS Display */}
      <div className="p-8 bg-gradient-to-br from-poly-dark to-black text-center">
        <div className="mb-2 text-sm text-gray-500 uppercase tracking-widest">
          Real-Time Throughput
        </div>
        <motion.div
          key={stats.currentTPS}
          initial={{ scale: 1.1, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="relative"
        >
          <span className={`text-8xl md:text-9xl font-black tabular-nums ${
            tpsValue > 10 ? 'text-poly-green' :
            tpsValue > 5 ? 'text-yellow-400' :
            tpsValue > 0 ? 'text-orange-400' : 'text-gray-600'
          }`}>
            {stats.currentTPS}
          </span>
          <span className="text-3xl md:text-4xl font-bold text-gray-500 ml-2">TPS</span>
        </motion.div>
        <div className="mt-4 text-sm text-gray-500">
          Peak: <span className="text-white font-bold">{stats.peakTPS} TPS</span>
        </div>
      </div>

      {/* Mode Selector */}
      <div className="p-4 border-t border-poly-border">
        <div className="flex items-center justify-center gap-2 mb-4">
          {(['normal', 'turbo', 'burst'] as const).map((m) => (
            <button
              key={m}
              onClick={() => handleModeChange(m)}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                mode === m
                  ? m === 'burst'
                    ? 'bg-red-500 text-white'
                    : m === 'turbo'
                    ? 'bg-orange-500 text-white'
                    : 'bg-blue-500 text-white'
                  : 'bg-poly-dark text-gray-400 hover:text-white'
              }`}
            >
              {m === 'normal' && '🐢 Normal (~2 TPS)'}
              {m === 'turbo' && '⚡ Turbo (~10 TPS)'}
              {m === 'burst' && '🔥 BURST (~20+ TPS)'}
            </button>
          ))}
        </div>

        {/* Start/Stop */}
        <div className="flex justify-center">
          {!isRunning ? (
            <button
              onClick={handleStart}
              disabled={!isConnected}
              className="px-8 py-3 bg-poly-green text-black font-bold rounded-xl hover:bg-poly-green/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              🚀 START TURBO
            </button>
          ) : (
            <button
              onClick={handleStop}
              className="px-8 py-3 bg-red-500 text-white font-bold rounded-xl hover:bg-red-600 transition-all"
            >
              ⏹ STOP
            </button>
          )}
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-4 gap-4 p-4 border-t border-poly-border">
        <div className="text-center">
          <div className="text-2xl font-bold text-white">{stats.totalTxns}</div>
          <div className="text-xs text-gray-500">Total Txns</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-poly-green">{stats.successRate}%</div>
          <div className="text-xs text-gray-500">Success Rate</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-yellow-400">{stats.avgLatency}ms</div>
          <div className="text-xs text-gray-500">Avg Latency</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-orange-400">{stats.batchSize}</div>
          <div className="text-xs text-gray-500">Batch Size</div>
        </div>
      </div>

      {/* Live Trade Stream */}
      <div className="border-t border-poly-border">
        <div className="p-3 bg-poly-dark/50 border-b border-poly-border">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-400">Live Parallel Batches</span>
            {isRunning && (
              <span className="flex items-center gap-2 text-xs text-orange-400">
                <span className="w-2 h-2 bg-orange-400 rounded-full animate-pulse" />
                FIRING
              </span>
            )}
          </div>
        </div>

        <div className="max-h-48 overflow-y-auto">
          <AnimatePresence mode="popLayout">
            {trades.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <div className="text-3xl mb-2">🔥</div>
                <p>Click "START TURBO" to begin</p>
                <p className="text-xs mt-1">Parallel on-chain transactions on Aptos testnet</p>
              </div>
            ) : (
              trades.map((trade) => (
                <motion.div
                  key={trade.id}
                  initial={{ opacity: 0, x: -20, height: 0 }}
                  animate={{ opacity: 1, x: 0, height: 'auto' }}
                  exit={{ opacity: 0, x: 20, height: 0 }}
                  className={`px-4 py-2 border-b border-poly-border/50 flex items-center justify-between text-sm ${
                    trade.success ? '' : 'bg-red-500/5'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className={`font-medium ${BOT_COLORS[trade.bot] || 'text-gray-400'}`}>
                      {trade.bot}
                    </span>
                    <span className={`${trade.action.includes('YES') ? 'text-poly-green' : 'text-red-400'}`}>
                      {trade.action.includes('BUY') ? '↗' : '↘'} {trade.action}
                    </span>
                    <span className="text-gray-500 font-mono">{trade.amount.toFixed(3)} APT</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-gray-500 font-mono text-xs">[{trade.latency}ms]</span>
                    {trade.success ? (
                      <a
                        href={`https://explorer.aptoslabs.com/txn/${trade.txHash}?network=testnet`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-poly-green hover:underline font-mono text-xs"
                      >
                        {trade.txHash?.slice(0, 10)}...
                      </a>
                    ) : (
                      <span className="text-red-400 text-xs">FAILED</span>
                    )}
                  </div>
                </motion.div>
              ))
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Footer */}
      <div className="p-3 bg-poly-dark/30 border-t border-poly-border text-center">
        <div className="flex items-center justify-center gap-6 text-xs text-gray-500">
          <span>
            <span className="text-yellow-400 font-bold">{stats.avgLatency}ms</span> Aptos Latency
          </span>
          <span className="text-gray-600">vs</span>
          <span className="text-gray-400">2-5 sec Polygon Latency</span>
          <span className="text-gray-600">|</span>
          <span className="text-orange-400 font-bold">~{stats.currentTPS} TPS</span>
        </div>
      </div>
    </div>
  );
}
