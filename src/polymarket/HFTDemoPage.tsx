/**
 * HFT Demo Page - TPS Graph + Trade Feed + Block River
 * Clean, focused demo page for showcasing 30k TPS
 */

// React hooks not currently needed but may be used later
import { motion } from 'framer-motion';
import { Zap, TrendingUp, Activity, BarChart3, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { PolyHeader } from './PolyHeader';
import { TradeFeed } from './TradeFeed';
import { BlockRiver } from './BlockRiver';
import { HFTLaunchControl } from './HFTLaunchControl';
import { useHFTConnection } from '../hooks/useHFTConnection';

// Market outcomes for the demo
const OUTCOMES = ["Trump Jr", "Vance", "DeSantis", "Haley", "Ramaswamy", "Other"];

export function HFTDemoPage() {
  // Use environment variable for production, fallback to localhost for dev
  const wsUrl = import.meta.env.VITE_HFT_WS_URL || 'ws://localhost:3001';
  const serverUrl = wsUrl.replace('ws://', 'http://').replace('wss://', 'https://');
  const {
    isConnected,
    isRunning,
    stats,
    trades,
    tpsHistory,
    startTrading,
    stopTrading,
    error,
  } = useHFTConnection({ autoConnect: true }); // Auto-connect on this page

  // Format numbers
  const formatNumber = (n: number) => {
    if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
    if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
    return n.toLocaleString();
  };

  // TPS color based on level
  const getTpsColor = (tps: number) => {
    if (tps > 20000) return '#22c55e';
    if (tps > 10000) return '#60a5fa';
    if (tps > 1000) return '#fbbf24';
    return '#8297a3';
  };

  const currentTps = stats.currentTps || 0;
  const peakTps = stats.peakTps || 0;

  return (
    <div className="min-h-screen bg-poly-bg">
      <PolyHeader />

      <div className="max-w-6xl mx-auto px-4 py-6">
        {/* Back link */}
        <Link
          to="/polymarket"
          className="inline-flex items-center gap-2 text-[#6b7a8a] hover:text-white mb-6 transition-colors"
        >
          <ArrowLeft size={16} />
          <span className="text-sm">Back to Markets</span>
        </Link>

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <div className="flex items-center justify-center gap-3 mb-2">
            <Zap className="text-yellow-400" size={28} />
            <h1 className="text-2xl font-bold text-white">
              Aptos HFT Demo
            </h1>
            <Zap className="text-yellow-400" size={28} />
          </div>
          <p className="text-pm-text-muted text-sm">
            30,000+ TPS on Aptos Testnet
          </p>
        </motion.div>

        {/* Big TPS Display */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center mb-8"
        >
          <div
            className="text-7xl md:text-8xl font-bold tabular-nums"
            style={{
              color: getTpsColor(currentTps),
              textShadow: `0 0 40px ${getTpsColor(currentTps)}60`,
            }}
          >
            {formatNumber(currentTps)}
          </div>
          <div className="text-xl text-pm-text-muted mt-2">
            Transactions Per Second
          </div>

          {/* Peak TPS */}
          {peakTps > 0 && (
            <div className="flex items-center justify-center gap-2 mt-3 text-sm">
              <TrendingUp size={16} className="text-[#22c55e]" />
              <span className="text-[#22c55e]">Peak: {formatNumber(peakTps)} TPS</span>
            </div>
          )}
        </motion.div>

        {/* Launch Control - Safety-locked with pre-flight checks */}
        <div className="mb-8">
          <HFTLaunchControl
            isConnected={isConnected}
            isRunning={isRunning}
            onStart={startTrading}
            onStop={stopTrading}
            serverUrl={serverUrl}
          />
        </div>

        {/* Error display */}
        {error && (
          <div className="max-w-md mx-auto mb-6 p-4 bg-red-500/20 border border-red-500/50 rounded-xl text-red-400 text-center text-sm">
            {error}
          </div>
        )}

        {/* Stats Row */}
        <div className="grid grid-cols-3 gap-4 max-w-2xl mx-auto mb-8">
          <div className="bg-poly-card rounded-xl p-4 text-center border border-poly-border">
            <Activity size={20} className="mx-auto mb-2 text-[#60a5fa]" />
            <div className="text-2xl font-bold text-white">{formatNumber(stats.totalTrades)}</div>
            <div className="text-xs text-pm-text-muted">Total Trades</div>
          </div>
          <div className="bg-poly-card rounded-xl p-4 text-center border border-poly-border">
            <BarChart3 size={20} className="mx-auto mb-2 text-poly-green" />
            <div className="text-2xl font-bold text-white">{(stats.successRate || 0).toFixed(1)}%</div>
            <div className="text-xs text-pm-text-muted">Success Rate</div>
          </div>
          <div className="bg-poly-card rounded-xl p-4 text-center border border-poly-border">
            <Zap size={20} className="mx-auto mb-2 text-[#fbbf24]" />
            <div className="text-2xl font-bold text-white">{stats.avgLatency?.toFixed(0) || 0}ms</div>
            <div className="text-xs text-pm-text-muted">Avg Latency</div>
          </div>
        </div>

        {/* TPS Chart */}
        {tpsHistory.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
          >
            <div className="bg-poly-card rounded-xl p-4 border border-poly-border">
              <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                <BarChart3 size={16} className="text-pm-secondary" />
                TPS History
              </h3>
              <TPSGraph history={tpsHistory} height={120} />
            </div>
          </motion.div>
        )}

        {/* Main Content Grid */}
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          {/* Trade Feed */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
          >
            <TradeFeed
              trades={trades}
              maxItems={15}
              outcomes={OUTCOMES}
            />
          </motion.div>

          {/* Block River */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
          >
            <div className="bg-poly-card rounded-xl border border-poly-border overflow-hidden">
              <div className="px-4 py-3 border-b border-poly-border">
                <span className="text-sm font-semibold text-white">Block River</span>
                <span className="text-xs text-pm-text-muted ml-2">Live Visualization</span>
              </div>
              <BlockRiver height={300} />
            </div>
          </motion.div>
        </div>

        {/* Server Instructions */}
        {!isConnected && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="max-w-2xl mx-auto p-6 bg-poly-card rounded-xl border border-poly-border"
          >
            <h3 className="text-white font-semibold mb-3">Start the HFT Server</h3>
            <p className="text-pm-text-muted text-sm mb-3">
              Run one of these commands, then return here to ARM and LAUNCH:
            </p>
            <div className="space-y-3">
              <div>
                <div className="text-xs text-[#60a5fa] mb-1">Standby Mode (UI Control)</div>
                <code className="block bg-poly-bg p-3 rounded-lg text-poly-green font-mono text-xs overflow-x-auto">
                  ULTRA_PRIVATE_KEYS="..." npx tsx server/hft-ultra-server.ts
                </code>
              </div>
              <div>
                <div className="text-xs text-[#fbbf24] mb-1">Auto-Start Turbo (3K TPS)</div>
                <code className="block bg-poly-bg p-3 rounded-lg text-poly-green font-mono text-xs overflow-x-auto">
                  ULTRA_PRIVATE_KEYS="..." npx tsx server/hft-ultra-server.ts turbo 60
                </code>
              </div>
              <div>
                <div className="text-xs text-[#22c55e] mb-1">Auto-Start Quantum (30K TPS)</div>
                <code className="block bg-poly-bg p-3 rounded-lg text-poly-green font-mono text-xs overflow-x-auto">
                  ULTRA_PRIVATE_KEYS="..." npx tsx server/hft-ultra-server.ts quantum 60
                </code>
              </div>
            </div>
            <p className="text-pm-text-muted text-xs mt-3">
              See DEMO_GUIDE.md for full private keys and instructions.
            </p>
          </motion.div>
        )}
      </div>
    </div>
  );
}

/**
 * Simple TPS Graph using SVG
 */
function TPSGraph({ history, height }: { history: number[]; height: number }) {
  const width = 800;
  const max = Math.max(...history, 1000);
  const padding = 20;

  const points = history.map((tps, i) => {
    const x = padding + (i / (history.length - 1)) * (width - padding * 2);
    const y = height - padding - (tps / max) * (height - padding * 2);
    return `${x},${y}`;
  }).join(' ');

  const areaPoints = `${padding},${height - padding} ${points} ${width - padding},${height - padding}`;

  return (
    <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
      <defs>
        <linearGradient id="tpsGradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#60a5fa" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#60a5fa" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Grid lines */}
      {[0.25, 0.5, 0.75].map((ratio) => (
        <line
          key={ratio}
          x1={padding}
          y1={height - padding - ratio * (height - padding * 2)}
          x2={width - padding}
          y2={height - padding - ratio * (height - padding * 2)}
          stroke="#2c3f4f"
          strokeWidth="1"
        />
      ))}

      {history.length > 1 && (
        <>
          {/* Area fill */}
          <polygon
            points={areaPoints}
            fill="url(#tpsGradient)"
          />
          {/* Line */}
          <polyline
            points={points}
            fill="none"
            stroke="#60a5fa"
            strokeWidth="2"
          />
        </>
      )}

      {/* Labels */}
      <text x={padding} y={height - 5} fill="#6b7a8a" fontSize="10">0</text>
      <text x={width - padding} y={height - 5} fill="#6b7a8a" fontSize="10" textAnchor="end">
        {history.length}s
      </text>
      <text x={5} y={padding + 5} fill="#6b7a8a" fontSize="10">
        {(max / 1000).toFixed(0)}K
      </text>
    </svg>
  );
}

export default HFTDemoPage;
