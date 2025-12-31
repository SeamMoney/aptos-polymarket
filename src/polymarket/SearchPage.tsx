import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Search as SearchIcon, X } from "lucide-react";
import { PolyHeader } from "./PolyHeader";
import { mockMarkets } from "./mockData";

export function SearchPage() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");

  const filteredMarkets = query.trim()
    ? mockMarkets.filter((m) =>
        m.question.toLowerCase().includes(query.toLowerCase())
      )
    : [];

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.2 }}
      className="min-h-screen bg-poly-bg pb-20"
    >
      <PolyHeader />

      {/* Search Header */}
      <div className="px-4 py-3">
        <div className="flex items-center gap-3 bg-poly-surface/50 rounded-xl px-4 py-2.5 border border-poly-border/30">
          <SearchIcon size={18} color="#6E7681" strokeWidth={2.5} />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search markets"
            className="flex-1 bg-transparent text-white text-sm outline-none placeholder-poly-textMuted"
            autoFocus
          />
          {query.length > 0 && (
            <button onClick={() => setQuery("")} className="p-1 hover:bg-poly-surface rounded-full transition-colors">
              <X size={16} color="#6E7681" strokeWidth={2.5} />
            </button>
          )}
        </div>
      </div>

      <div className="flex-1">
        {query.trim() === "" ? (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="px-4 pt-12"
          >
            <p className="text-poly-textMuted text-sm text-center">
              Search for markets, events, or topics
            </p>
          </motion.div>
        ) : filteredMarkets.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="px-4 pt-12"
          >
            <p className="text-poly-textMuted text-sm text-center">
              No results found for "{query}"
            </p>
          </motion.div>
        ) : (
          <div className="px-4">
            {filteredMarkets.map((market, index) => (
              <motion.button
                key={market.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.03 }}
                onClick={() => navigate(`/market/${market.id}`)}
                className="flex items-center w-full py-3 border-b border-poly-border/30 last:border-b-0 hover:bg-poly-surface/30 transition-colors text-left rounded-lg -mx-2 px-2"
              >
                <img
                  src={market.image}
                  alt=""
                  className="w-10 h-10 rounded-xl mr-3 object-cover bg-poly-surface shrink-0 border border-poly-border/30"
                />
                <div className="flex-1 min-w-0 mr-3">
                  <p className="text-white text-sm font-medium leading-5 mb-0.5 line-clamp-2">
                    {market.question}
                  </p>
                  <p className="text-poly-textMuted text-xs">
                    {market.volume} Vol.
                  </p>
                </div>
                <span className="text-white text-base font-bold shrink-0">
                  {Math.round(market.yesPrice * 100)}%
                </span>
              </motion.button>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}
