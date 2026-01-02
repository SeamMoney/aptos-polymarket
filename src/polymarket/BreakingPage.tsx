import { useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { TrendingUp, Zap, Activity, Play, Users } from "lucide-react";
import { PolyHeader } from "./PolyHeader";
import { useMultiMarkets } from "../hooks/useMultiMarkets";
import { useHFTConnection } from "../hooks/useHFTConnection";
import { isClosedFromTimestamp } from "./marketStatus";

export function BreakingPage() {
  const navigate = useNavigate();
  const { markets, loading } = useMultiMarkets();
  const { isConnected, isRunning, stats } = useHFTConnection();

  // The featured HFT demo market
  const featuredMarket = markets.find(m =>
    m.question.toLowerCase().includes("republican") ||
    m.question.toLowerCase().includes("2028")
  ) || markets[0];

  const formatTPS = (n: number) => {
    if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
    return n.toLocaleString();
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.2 }}
      className="min-h-screen bg-poly-bg pb-20"
    >
      <PolyHeader />

      {/* HFT Demo Banner - Main Feature */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="mx-4 mt-2 mb-4"
      >
        <Link
          to="/demo-day"
          className="block rounded-xl overflow-hidden"
          style={{
            background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)",
            border: "2px solid #e94560",
          }}
        >
          <div className="px-4 py-5 relative">
            {/* Live indicator */}
            {isRunning && (
              <div className="absolute top-3 right-3 flex items-center gap-1.5 px-2 py-1 bg-red-500/20 border border-red-500/50 rounded-full">
                <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                <span className="text-red-400 text-xs font-bold">LIVE</span>
              </div>
            )}

            <div className="flex items-center gap-2 mb-2">
              <Zap className="text-yellow-400" size={20} />
              <span className="text-yellow-400 text-xs font-bold uppercase tracking-wider">
                Aptos HFT Demo
              </span>
            </div>

            <h1 className="text-white text-xl font-bold mb-2">
              30,000+ TPS Live Demo
            </h1>

            <p className="text-white/70 text-sm mb-4">
              Watch high-frequency trading on Aptos in real-time.
              {featuredMarket && ` Betting on: ${featuredMarket.question}`}
            </p>

            {/* Stats row */}
            <div className="flex items-center gap-4">
              {isConnected ? (
                <>
                  <div className="flex items-center gap-1.5">
                    <Activity size={14} className="text-green-400" />
                    <span className="text-green-400 text-sm font-medium">
                      {isRunning ? `${formatTPS(stats.currentTps || 0)} TPS` : "Server Ready"}
                    </span>
                  </div>
                  {isRunning && (
                    <div className="flex items-center gap-1.5">
                      <TrendingUp size={14} className="text-blue-400" />
                      <span className="text-blue-400 text-sm">
                        Peak: {formatTPS(stats.peakTps || 0)}
                      </span>
                    </div>
                  )}
                </>
              ) : (
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 bg-yellow-500 rounded-full" />
                  <span className="text-yellow-400 text-sm">Tap to start demo</span>
                </div>
              )}
            </div>

            {/* CTA */}
            <div className="mt-4 flex items-center gap-2">
              <div className="flex items-center gap-2 bg-[#e94560] rounded-lg px-4 py-2 text-white text-sm font-bold">
                <Play size={16} fill="white" />
                {isRunning ? "Watch Live" : "Start Demo"}
              </div>
              {featuredMarket && (
                <span className="text-white/50 text-xs">
                  {featuredMarket.totalCollateral.toFixed(0)} APT TVL
                </span>
              )}
            </div>
          </div>
        </Link>
      </motion.div>

      {/* TPS Stats Page Link */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="px-4 mb-4"
      >
        <Link
          to="/demo-day"
          className="flex items-center justify-between p-3 bg-[#1c2b3a] border border-[#2c3f4f] rounded-xl hover:border-[#3c5f7f] transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center">
              <Activity size={20} className="text-white" />
            </div>
            <div>
              <span className="text-white text-sm font-medium">TPS Dashboard</span>
              <p className="text-[#6b7a8a] text-xs">Live graphs & trade feed</p>
            </div>
          </div>
          <div className="text-[#6b7a8a]">→</div>
        </Link>
      </motion.div>

      {/* Section Header */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="px-4 mb-3"
      >
        <h2 className="text-white text-lg font-bold">Live Markets</h2>
        <p className="text-[#6b7a8a] text-xs">Real on-chain prediction markets on Aptos</p>
      </motion.div>

      {/* Markets List */}
      <div className="px-4">
        {loading ? (
          <div className="py-12 text-center">
            <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-white mb-2" />
            <p className="text-[#6b7a8a] text-sm">Loading markets...</p>
          </div>
        ) : markets.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-12"
          >
            <p className="text-[#6b7a8a] text-sm">No markets found</p>
          </motion.div>
        ) : (
          markets.map((market, index) => (
            <motion.button
              key={market.address}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 + index * 0.05 }}
              onClick={() => navigate(`/market/multi-${market.address}`)}
              className="flex items-start w-full py-4 border-b border-[#2c3f4f] last:border-b-0 hover:bg-[#1c2b3a]/50 transition-colors text-left rounded-lg -mx-2 px-2"
            >
              {/* Market Image */}
              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-[#e94560] to-[#0f3460] flex items-center justify-center mr-3 shrink-0">
                <span className="text-2xl">🗳️</span>
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm font-medium leading-5 mb-1">
                  {market.question}
                </p>
                {isClosedFromTimestamp(market.endTime, market.resolved) && (
                  <span className="inline-flex mb-2 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide bg-[#1b2a36] text-[#f59e0b] border border-[#f59e0b]/40">
                    Ended
                  </span>
                )}

                {/* Top outcomes */}
                <div className="flex flex-wrap gap-2 mb-2">
                  {market.outcomes.slice(0, 3).map((outcome) => (
                    <span
                      key={outcome.index}
                      className="text-xs px-2 py-0.5 rounded-full bg-[#2a3d4e] text-[#8297a3]"
                    >
                      {outcome.label} {outcome.price.toFixed(0)}%
                    </span>
                  ))}
                  {market.outcomes.length > 3 && (
                    <span className="text-xs text-[#6b7a8a]">
                      +{market.outcomes.length - 3} more
                    </span>
                  )}
                </div>

                {/* Stats */}
                <div className="flex items-center gap-3 text-xs text-[#6b7a8a]">
                  <span className="flex items-center gap-1">
                    <Users size={12} />
                    {market.totalCollateral.toFixed(0)} APT
                  </span>
                  <span>{market.category}</span>
                </div>
              </div>

              {/* Featured badge for HFT market */}
              {market.address === featuredMarket?.address && (
                <div className="ml-2 px-2 py-1 bg-[#e94560]/20 border border-[#e94560]/50 rounded text-[#e94560] text-[10px] font-bold shrink-0">
                  HFT
                </div>
              )}
            </motion.button>
          ))
        )}
      </div>
    </motion.div>
  );
}
