import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { TrendingUp, TrendingDown, Bell } from "lucide-react";
import { PolyHeader } from "./PolyHeader";
import { mockMarkets } from "./mockData";

const breakingFilters = ["All", "Politics", "World", "Sports", "Crypto"];

export function BreakingPage() {
  const navigate = useNavigate();
  const [selectedFilter, setSelectedFilter] = useState("All");

  // Simulate breaking news items from markets
  const breakingItems = mockMarkets
    .filter((m) => m.isTrending || m.isNew)
    .filter((m) => selectedFilter === "All" || m.category === selectedFilter)
    .map((market, idx) => ({
      ...market,
      rank: idx + 1,
      change: Math.random() > 0.5 ? Math.random() * 15 : -Math.random() * 10,
    }));

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.2 }}
      className="min-h-screen bg-poly-bg pb-20"
    >
      <PolyHeader />

      {/* Hero Banner */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="mx-4 mt-2 mb-4 rounded-xl overflow-hidden"
        style={{
          background: "linear-gradient(135deg, #FF6B6B 0%, #FF8E53 50%, #FFA726 100%)",
        }}
      >
        <div className="px-4 py-5">
          <h1 className="text-white text-xl font-bold mb-1">Breaking News</h1>
          <p className="text-white/80 text-xs mb-3">
            Real-time updates on trending markets
          </p>
          <button className="flex items-center gap-1.5 bg-white/20 backdrop-blur-sm rounded-lg px-3 py-1.5 text-white text-xs font-medium hover:bg-white/30 transition-colors">
            <Bell size={14} />
            Get updates
          </button>
        </div>
      </motion.div>

      {/* Filter Pills */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="px-4 mb-3"
      >
        <div className="flex gap-2 overflow-x-auto">
          {breakingFilters.map((filter) => (
            <button
              key={filter}
              onClick={() => setSelectedFilter(filter)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors border ${
                selectedFilter === filter
                  ? "bg-poly-blue/15 border-poly-blue/30 text-poly-blue"
                  : "bg-poly-surface/50 border-poly-border/30 text-poly-textSecondary hover:text-white"
              }`}
            >
              {filter}
            </button>
          ))}
        </div>
      </motion.div>

      {/* Breaking News List */}
      <div className="px-4">
        {breakingItems.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-12"
          >
            <p className="text-poly-textMuted text-sm">No breaking news in this category</p>
          </motion.div>
        ) : (
          breakingItems.map((item, index) => (
            <motion.button
              key={item.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 + index * 0.03 }}
              onClick={() => navigate(`/market/${item.id}`)}
              className="flex items-center w-full py-3 border-b border-poly-border/30 last:border-b-0 hover:bg-poly-surface/30 transition-colors text-left rounded-lg -mx-2 px-2"
            >
              {/* Rank */}
              <span className="text-poly-textMuted text-sm font-bold w-6 shrink-0">{item.rank}</span>

              {/* Image */}
              <img
                src={item.image}
                alt=""
                className="w-10 h-10 rounded-xl mr-3 object-cover bg-poly-surface shrink-0 border border-poly-border/30"
              />

              {/* Content */}
              <div className="flex-1 min-w-0 mr-3">
                <p className="text-white text-sm font-medium leading-5 mb-0.5 line-clamp-2">
                  {item.question}
                </p>
                <div className="flex items-center gap-2">
                  <span className="text-poly-textMuted text-xs">
                    {Math.round(item.yesPrice * 100)}%
                  </span>
                  <span
                    className={`flex items-center text-xs ${
                      item.change >= 0 ? "text-poly-green" : "text-poly-red"
                    }`}
                  >
                    {item.change >= 0 ? (
                      <TrendingUp size={12} className="mr-0.5" />
                    ) : (
                      <TrendingDown size={12} className="mr-0.5" />
                    )}
                    {Math.abs(item.change).toFixed(1)}%
                  </span>
                </div>
              </div>

              {/* Breaking Badge */}
              {item.isTrending && (
                <span className="px-1.5 py-0.5 bg-poly-red/15 border border-poly-red/30 text-poly-red text-[10px] font-medium rounded shrink-0">
                  HOT
                </span>
              )}
            </motion.button>
          ))
        )}
      </div>
    </motion.div>
  );
}
