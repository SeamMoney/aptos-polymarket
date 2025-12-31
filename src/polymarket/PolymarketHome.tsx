import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Search, Bookmark, X, RefreshCw, Loader2, Zap } from "lucide-react";
import { PolyHeader } from "./PolyHeader";
import { CategoryTabs } from "./CategoryTabs";
import { MarketCard } from "./MarketCard";
import { mockMarkets, categories } from "./mockData";
import { usePolymarkets } from "../hooks/usePolymarkets";
import { useHFTConnection } from "../hooks/useHFTConnection";
import type { Category, Market } from "./types";

const topicFilters = ["All", "Trump", "Venezuela", "New Years", "Ukraine", "Mideast"];

export function PolymarketHome() {
  const navigate = useNavigate();
  const [selectedCategory, setSelectedCategory] = useState<Category>("All");
  const [selectedTopic, setSelectedTopic] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [showRealMarkets, setShowRealMarkets] = useState(true);
  const [initialLoadDone, setInitialLoadDone] = useState(false);

  // Fetch real on-chain markets
  const { markets: onChainMarkets, loading, error, refresh } = usePolymarkets();

  // HFT connection status
  const { isConnected: hftConnected, isRunning: hftRunning, stats: hftStats } = useHFTConnection();

  // Mark initial load as done once loading completes for the first time
  useEffect(() => {
    if (!loading && !initialLoadDone) {
      setInitialLoadDone(true);
    }
  }, [loading, initialLoadDone]);

  // Combine on-chain markets with mock markets (on-chain first)
  // Wait for initial load to prevent visual swap
  const allMarkets: Market[] = useMemo(() => {
    // During initial load, show nothing or minimal skeleton
    if (!initialLoadDone && loading) {
      return [];
    }
    if (showRealMarkets && onChainMarkets.length > 0) {
      return [...onChainMarkets, ...mockMarkets];
    }
    return mockMarkets;
  }, [onChainMarkets, showRealMarkets, initialLoadDone, loading]);

  // Search results when searching
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    return allMarkets.filter((m) =>
      m.question.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [searchQuery, allMarkets]);

  const filteredMarkets = useMemo(() => {
    let filtered = allMarkets;

    if (
      selectedCategory !== "All" &&
      selectedCategory !== "Breaking" &&
      selectedCategory !== "New"
    ) {
      filtered = filtered.filter(
        (market) => market.category === selectedCategory
      );
    }

    if (selectedCategory === "New") {
      filtered = filtered.filter((market) => market.isNew);
    }

    return filtered;
  }, [selectedCategory, allMarkets]);

  const isSearching = searchQuery.trim().length > 0;

  const handleMarketPress = (marketId: string, isMultiOutcome?: boolean) => {
    if (isMultiOutcome) {
      navigate(`/market/${marketId}`);
    } else {
      navigate(`/market/${marketId}`);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      transition={{ duration: 0.2 }}
      className="min-h-screen bg-poly-bg pb-20"
    >
      <PolyHeader />

      <CategoryTabs
        categories={categories}
        selectedCategory={selectedCategory}
        onSelectCategory={setSelectedCategory}
      />

      {/* Search Bar Row */}
      <div className="px-4 py-2 flex items-center gap-3">
        <div className="flex-1 flex items-center bg-poly-card rounded-full px-4 py-2.5">
          <Search size={18} color="#6E7681" strokeWidth={2.5} />
          <input
            type="text"
            className="flex-1 bg-transparent text-white text-sm ml-3 outline-none placeholder-[#6E7681]"
            placeholder="Search markets"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery.length > 0 && (
            <button onClick={() => setSearchQuery("")} className="p-1 hover:bg-poly-surface rounded-full transition-colors">
              <X size={16} color="#6E7681" strokeWidth={2.5} />
            </button>
          )}
        </div>
        <button
          onClick={refresh}
          className={`p-2 hover:opacity-70 transition-opacity ${loading ? 'animate-spin' : ''}`}
          title="Refresh markets"
        >
          {loading ? (
            <Loader2 size={22} color="#5BA3D9" strokeWidth={2.5} />
          ) : (
            <RefreshCw size={22} color="#6E7681" strokeWidth={2.5} />
          )}
        </button>
        <button className="p-2 hover:opacity-70 transition-opacity">
          <Bookmark size={22} color="#6E7681" strokeWidth={2.5} />
        </button>
      </div>

      {/* On-chain markets indicator */}
      {onChainMarkets.length > 0 && (
        <div className="px-4 py-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-xs text-[#8297a3]">
              {onChainMarkets.length} live on Aptos Testnet
            </span>
          </div>
          <button
            onClick={() => setShowRealMarkets(!showRealMarkets)}
            className={`text-xs px-2 py-1 rounded ${
              showRealMarkets
                ? 'bg-[#1e3a5f] text-[#5BA3D9]'
                : 'bg-poly-surface text-[#8297a3]'
            }`}
          >
            {showRealMarkets ? 'Live' : 'Demo'}
          </button>
        </div>
      )}

      {/* HFT Demo Status */}
      {hftConnected && (
        <div className="px-4 py-2">
          <div className={`flex items-center justify-between rounded-lg px-3 py-2 ${
            hftRunning ? 'bg-[#1e3a5f] border border-[#3a5f8f]' : 'bg-poly-surface'
          }`}>
            <div className="flex items-center gap-2">
              <Zap size={14} className={hftRunning ? 'text-[#60a5fa]' : 'text-[#6b7a8a]'} />
              <span className={`text-xs font-medium ${hftRunning ? 'text-[#60a5fa]' : 'text-[#8297a3]'}`}>
                {hftRunning ? 'HFT Demo Active' : 'HFT Server Connected'}
              </span>
            </div>
            {hftRunning && (
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#60a5fa] animate-pulse" />
                  <span className="text-[#60a5fa] text-xs font-bold tabular-nums">
                    {hftStats.currentTps || 0} TPS
                  </span>
                </div>
                <span className="text-[#8297a3] text-xs">
                  {hftStats.totalTrades || 0} trades
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {error && (
        <div className="px-4 py-2">
          <p className="text-xs text-red-400">{error}</p>
        </div>
      )}

      {/* Show search results when searching */}
      {isSearching ? (
        <div className="px-4 py-2">
          {searchResults.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="pt-12"
            >
              <p className="text-[#6E7681] text-sm text-center">
                No results found for "{searchQuery}"
              </p>
            </motion.div>
          ) : (
            <div>
              <p className="text-[#8297a3] text-sm mb-3">{searchResults.length} results</p>
              {searchResults.map((market, index) => (
                <motion.button
                  key={market.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.03 }}
                  onClick={() => navigate(`/market/${market.id}`)}
                  className="flex items-center w-full py-3 border-b border-[#2c3f4f] last:border-b-0 hover:bg-poly-surface/30 transition-colors text-left rounded-lg -mx-2 px-2"
                >
                  <img
                    src={market.image}
                    alt=""
                    className="w-10 h-10 rounded-xl mr-3 object-cover bg-poly-surface shrink-0 border border-[#2c3f4f]"
                  />
                  <div className="flex-1 min-w-0 mr-3">
                    <p className="text-white text-sm font-medium leading-5 mb-0.5 line-clamp-2">
                      {market.question}
                    </p>
                    <p className="text-[#6E7681] text-xs">
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
      ) : (
        <>
          {/* Topic Filter Pills */}
          <div className="flex overflow-x-auto px-4 py-3 gap-2 border-b border-[#2c3f4f]">
            {topicFilters.map((topic) => {
              const isSelected = selectedTopic === topic;
              return (
                <button
                  key={topic}
                  onClick={() => setSelectedTopic(topic)}
                  className={`px-4 py-2 rounded-lg shrink-0 transition-colors ${
                    isSelected
                      ? "bg-[#1e3a5f] text-[#5BA3D9]"
                      : "bg-transparent text-[#8297a3] hover:text-white"
                  }`}
                >
                  <span className="text-base font-medium">{topic}</span>
                </button>
              );
            })}
          </div>

          {/* Markets List */}
          <div className="pb-6">
            {/* Loading skeleton during initial load */}
            {!initialLoadDone && loading && (
              <div className="px-4 space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="bg-poly-card rounded-xl p-4 animate-pulse">
                    <div className="flex gap-3">
                      <div className="w-12 h-12 bg-poly-surface rounded-lg" />
                      <div className="flex-1 space-y-2">
                        <div className="h-4 bg-poly-surface rounded w-3/4" />
                        <div className="h-3 bg-poly-surface rounded w-1/2" />
                      </div>
                      <div className="w-16 h-8 bg-poly-surface rounded" />
                    </div>
                  </div>
                ))}
              </div>
            )}
            {filteredMarkets.map((market, index) => (
              <motion.div
                key={market.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.03 }}
              >
                <MarketCard
                  market={market}
                  onPress={() => handleMarketPress(market.id, market.isMultiOutcome)}
                />
              </motion.div>
            ))}
          </div>
        </>
      )}
    </motion.div>
  );
}
