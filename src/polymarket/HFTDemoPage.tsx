/**
 * HFT Demo Page - High-Performance Trading Visualization
 * Showcases 30k+ TPS on Aptos with Polymarket-style UI
 */

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Play, Square, Zap, TrendingUp, Users, Activity } from 'lucide-react';
import { PixiTradeViz } from '../components/PixiTradeViz';
import { PolyHeader } from './PolyHeader';
import { useHFTConnection } from '../hooks/useHFTConnection';

// Market data
const MARKET = {
  question: "Who will be the Republican Presidential Nominee in 2028?",
  outcomes: ["Trump Jr", "Vance", "DeSantis", "Haley", "Ramaswamy", "Other"],
  image: "https://images.unsplash.com/photo-1540910419892-4a36d2c3266c?w=400",
};

export function HFTDemoPage() {
  const {
    isConnected,
    isRunning,
    stats,
    trades,
    tpsHistory,
    startTrading,
    stopTrading,
    error,
  } = useHFTConnection();

  const [showStats] = useState(true);
  const [vizSize, setVizSize] = useState({ width: 800, height: 500 });

  // Responsive sizing
  useEffect(() => {
    const updateSize = () => {
      const width = Math.min(window.innerWidth - 40, 1200);
      const height = Math.min(window.innerHeight - 300, 600);
      setVizSize({ width, height });
    };
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  // Format large numbers
  const formatNumber = (n: number) => {
    if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
    if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
    return n.toLocaleString();
  };

  return (
    <div className="min-h-screen bg-poly-bg">
      <PolyHeader />

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <div className="flex items-center justify-center gap-3 mb-2">
            <Zap className="text-yellow-400" size={32} />
            <h1 className="text-3xl font-bold text-white">
              Aptos HFT Demo
            </h1>
            <Zap className="text-yellow-400" size={32} />
          </div>
          <p className="text-poly-textSecondary text-lg">
            {MARKET.question}
          </p>
          <div className="flex items-center justify-center gap-6 mt-4 text-sm">
            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
              <span className="text-poly-textSecondary">
                {isConnected ? 'Server Connected' : 'Server Offline'}
              </span>
            </div>
            {isRunning && (
              <div className="flex items-center gap-2">
                <Activity className="text-blue-400 animate-pulse" size={16} />
                <span className="text-blue-400 font-medium">LIVE</span>
              </div>
            )}
          </div>
        </motion.div>

        {/* Main Visualization */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
          className="flex justify-center mb-6"
        >
          <PixiTradeViz
            width={vizSize.width}
            height={vizSize.height}
            tps={stats.currentTps || 0}
            peakTps={stats.peakTps || 0}
            totalTrades={stats.totalTrades}
            trades={trades}
            outcomes={MARKET.outcomes}
            prices={[50, 50, 50, 50, 50, 50]} // Would come from real data
            isRunning={isRunning}
          />
        </motion.div>

        {/* Control Panel */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="flex justify-center gap-4 mb-8"
        >
          {!isRunning ? (
            <button
              onClick={startTrading}
              disabled={!isConnected}
              className={`flex items-center gap-3 px-8 py-4 rounded-xl text-white text-lg font-bold transition-all ${
                isConnected
                  ? 'bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 shadow-lg shadow-green-500/30'
                  : 'bg-gray-600 cursor-not-allowed'
              }`}
            >
              <Play size={24} fill="white" />
              Start 30K TPS Demo
            </button>
          ) : (
            <button
              onClick={stopTrading}
              className="flex items-center gap-3 px-8 py-4 rounded-xl text-white text-lg font-bold bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 shadow-lg shadow-red-500/30 transition-all"
            >
              <Square size={24} fill="white" />
              Stop Demo
            </button>
          )}
        </motion.div>

        {error && (
          <div className="max-w-md mx-auto mb-6 p-4 bg-red-500/20 border border-red-500/50 rounded-xl text-red-400 text-center">
            {error}
          </div>
        )}

        {/* Stats Grid */}
        {showStats && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto mb-8"
          >
            <StatCard
              icon={<Zap className="text-yellow-400" />}
              label="Current TPS"
              value={formatNumber(stats.currentTps || 0)}
              highlight
            />
            <StatCard
              icon={<TrendingUp className="text-green-400" />}
              label="Peak TPS"
              value={formatNumber(stats.peakTps || 0)}
            />
            <StatCard
              icon={<Activity className="text-blue-400" />}
              label="Total Trades"
              value={formatNumber(stats.totalTrades)}
            />
            <StatCard
              icon={<Users className="text-purple-400" />}
              label="Success Rate"
              value={`${stats.successRate?.toFixed(1) || 0}%`}
            />
          </motion.div>
        )}

        {/* TPS History Chart */}
        {isRunning && tpsHistory.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="max-w-4xl mx-auto mb-8"
          >
            <div className="bg-poly-card rounded-xl p-4 border border-poly-border">
              <h3 className="text-white font-semibold mb-4">TPS History</h3>
              <TPSChart history={tpsHistory} width={800} height={120} />
            </div>
          </motion.div>
        )}

        {/* Aptos Comparison */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="max-w-4xl mx-auto"
        >
          <div className="bg-gradient-to-r from-[#2a3d4e] to-[#1f3044] rounded-xl p-6 border border-[#3a4f60]">
            <h3 className="text-white text-xl font-bold mb-4">Why Aptos?</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <ComparisonItem
                chain="Aptos"
                tps="160,000+"
                finality="~400ms"
                fees="<$0.001"
                highlight
              />
              <ComparisonItem
                chain="Polygon"
                tps="~7,000"
                finality="~2s"
                fees="~$0.01"
              />
              <ComparisonItem
                chain="Ethereum"
                tps="~15"
                finality="~12min"
                fees="~$5+"
              />
            </div>
          </div>
        </motion.div>

        {/* Instructions */}
        {!isConnected && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="max-w-2xl mx-auto mt-8 p-6 bg-poly-card rounded-xl border border-poly-border"
          >
            <h3 className="text-white font-semibold mb-3">Start the HFT Server</h3>
            <code className="block bg-black/30 p-4 rounded-lg text-green-400 font-mono text-sm">
              ./scripts/run-3-workers.sh normal 60
            </code>
            <p className="text-poly-textSecondary text-sm mt-3">
              This starts 3 distributed workers (20 accounts) for ~30k TPS using your synced fullnode.
            </p>
          </motion.div>
        )}
      </div>
    </div>
  );
}

// Stat Card Component
function StatCard({
  icon,
  label,
  value,
  highlight,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`p-4 rounded-xl border ${
        highlight
          ? 'bg-gradient-to-br from-blue-500/20 to-purple-500/20 border-blue-500/50'
          : 'bg-poly-card border-poly-border'
      }`}
    >
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className="text-poly-textSecondary text-sm">{label}</span>
      </div>
      <div className={`text-2xl font-bold ${highlight ? 'text-blue-400' : 'text-white'}`}>
        {value}
      </div>
    </div>
  );
}

// Comparison Item
function ComparisonItem({
  chain,
  tps,
  finality,
  fees,
  highlight,
}: {
  chain: string;
  tps: string;
  finality: string;
  fees: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`p-4 rounded-lg ${
        highlight ? 'bg-green-500/20 border border-green-500/50' : 'bg-black/20'
      }`}
    >
      <div className={`text-lg font-bold mb-3 ${highlight ? 'text-green-400' : 'text-white'}`}>
        {chain}
      </div>
      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-poly-textSecondary">Peak TPS</span>
          <span className="text-white font-medium">{tps}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-poly-textSecondary">Finality</span>
          <span className="text-white font-medium">{finality}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-poly-textSecondary">Fees</span>
          <span className="text-white font-medium">{fees}</span>
        </div>
      </div>
    </div>
  );
}

// Simple TPS Chart
function TPSChart({ history, width, height }: { history: number[]; width: number; height: number }) {
  const max = Math.max(...history, 1000);
  const points = history.map((tps, i) => {
    const x = (i / (history.length - 1)) * width;
    const y = height - (tps / max) * height;
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
      <defs>
        <linearGradient id="tpsGradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#60a5fa" stopOpacity="0.5" />
          <stop offset="100%" stopColor="#60a5fa" stopOpacity="0" />
        </linearGradient>
      </defs>
      {history.length > 1 && (
        <>
          <polygon
            points={`0,${height} ${points} ${width},${height}`}
            fill="url(#tpsGradient)"
          />
          <polyline
            points={points}
            fill="none"
            stroke="#60a5fa"
            strokeWidth="2"
          />
        </>
      )}
    </svg>
  );
}

export default HFTDemoPage;
