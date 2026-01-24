import { useState, useMemo, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Search, Bookmark, X } from "lucide-react";
import { PolyHeader } from "./PolyHeader";
import { CategoryTabs } from "./CategoryTabs";
import { MarketCard } from "./MarketCard";
import { mockMarkets, categories } from "./mockData";
import { usePolymarkets } from "../hooks/usePolymarkets";
import { prefetchTradeHistory } from "../hooks/useTradePriceHistory";
import { LATEST_REAL_PRICES } from "./realPriceData";
import type { Category, Market } from "./types";

const topicFilters = ["All", "Trump", "WLFI", "Geopolitics", "Crypto", "Fed"];

export function PolymarketHome() {
  const navigate = useNavigate();
  const [selectedCategory, setSelectedCategory] = useState<Category>("All");
  const [selectedTopic, setSelectedTopic] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [showRealMarkets, setShowRealMarkets] = useState(true);
  const [initialLoadDone, setInitialLoadDone] = useState(false);

  // Fetch real on-chain markets
  const { markets: onChainMarkets, loading, error } = usePolymarkets();

  // Mark initial load as done once loading completes for the first time
  useEffect(() => {
    if (!loading && !initialLoadDone) {
      setInitialLoadDone(true);
    }
  }, [loading, initialLoadDone]);

  // Combine on-chain markets with mock markets (on-chain first, deduplicated)
  // Wait for initial load to prevent visual swap
  const allMarkets: Market[] = useMemo(() => {
    // During initial load, show nothing or minimal skeleton
    if (!initialLoadDone && loading) {
      return [];
    }
    if (showRealMarkets) {
      // In Live mode, ONLY show on-chain markets (no mock mixing to prevent flickering)
      // This prevents showing mock data that gets replaced by on-chain data
      if (onChainMarkets.length > 0) {
        return onChainMarkets;
      }
      // If no on-chain markets loaded yet, show empty (will show skeleton if still loading)
      return [];
    }
    // In Demo mode, show mock markets
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

    // Category filtering
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

    // Topic filtering
    if (selectedTopic !== "All") {
      const topicKeywords: Record<string, string[]> = {
        "Trump": ["trump", "greenland", "fed chair", "nominate"],
        "WLFI": ["wlfi", "world liberty", "banking charter", "usd1"],
        "Geopolitics": ["iran", "taiwan", "china", "russia", "ukraine", "venezuela", "ceasefire", "invade", "khamenei"],
        "Crypto": ["bitcoin", "btc", "$150k", "$90k", "$100k", "$120k", "ethereum", "crypto"],
        "Fed": ["fed", "fomc", "rate", "25bps", "50bps", "powell", "warsh", "hassett"],
      };
      const keywords = topicKeywords[selectedTopic] || [];
      if (keywords.length > 0) {
        filtered = filtered.filter((market) =>
          keywords.some((kw) => market.question.toLowerCase().includes(kw))
        );
      }
    }

    return filtered;
  }, [selectedCategory, selectedTopic, allMarkets]);

  const isSearching = searchQuery.trim().length > 0;

  const handleMarketPress = (marketId: string, isMultiOutcome?: boolean) => {
    if (isMultiOutcome) {
      navigate(`/market/${marketId}`);
    } else {
      navigate(`/market/${marketId}`);
    }
  };

  // Prefetch trade history on hover for instant market detail load
  const handleMarketHover = useCallback((market: Market) => {
    if (market.isMultiOutcome && market.id) {
      // Extract market address from id (format: "multi-0x..." -> "0x...")
      const address = market.id.startsWith('multi-') ? market.id.slice(6) : market.id;
      if (address.startsWith('0x')) {
        prefetchTradeHistory(address, market.outcomes?.length || 4);
      }
    }
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      transition={{ duration: 0.2 }}
      className="min-h-screen bg-poly-bg pb-20"
    >
      <div className="sticky top-0 z-50" style={{ backgroundColor: '#1c2b3a' }}>
        <PolyHeader />

        <CategoryTabs
          categories={categories}
          selectedCategory={selectedCategory}
          onSelectCategory={setSelectedCategory}
        />
      </div>

      {/* Search Bar Row */}
      <div className="px-4 py-3 flex items-center gap-2">
        <div className="flex-1 flex items-center rounded-[7.6px]" style={{ border: '0.8px solid #3d5266', padding: '8px 12px' }}>
          <Search size={18} color="#6E7681" strokeWidth={1.5} />
          <input
            type="text"
            className="flex-1 bg-transparent text-white ml-3 outline-none placeholder-[#899cb2]"
            style={{ fontSize: '16px', fontWeight: 400, fontFamily: '"Open Sauce One", sans-serif' }}
            placeholder="Search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery.length > 0 && (
            <button onClick={() => setSearchQuery("")} className="p-1 hover:bg-poly-surface rounded-full transition-colors">
              <X size={16} color="#6E7681" strokeWidth={2} />
            </button>
          )}
        </div>
        <button
          className="p-2 rounded-lg hover:bg-[#2f3f50] transition-colors"
          title="Filters"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="4" y1="8" x2="20" y2="8" />
            <circle cx="16" cy="8" r="3" fill="#1c2b3a" />
            <line x1="4" y1="16" x2="20" y2="16" />
            <circle cx="8" cy="16" r="3" fill="#1c2b3a" />
          </svg>
        </button>
        <button className="p-2 rounded-lg hover:bg-[#2f3f50] transition-colors">
          <Bookmark size={20} color="#ffffff" strokeWidth={1.5} />
        </button>
      </div>

      {/* On-chain markets indicator */}
      {onChainMarkets.length > 0 && (
        <div className="px-4 py-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-[#8297a3]" style={{ fontSize: '12px', fontWeight: 400, fontFamily: '"Open Sauce One", sans-serif' }}>
              {onChainMarkets.length} live on Aptos Testnet
            </span>
          </div>
          <button
            onClick={() => setShowRealMarkets(!showRealMarkets)}
            className={`px-2 py-1 rounded ${
              showRealMarkets
                ? 'bg-[#1e3a5f] text-[#5BA3D9]'
                : 'bg-poly-surface text-[#8297a3]'
            }`}
            style={{ fontSize: '12px', fontWeight: 500, fontFamily: '"Open Sauce One", sans-serif' }}
          >
            {showRealMarkets ? 'Live' : 'Demo'}
          </button>
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
              <p className="text-[#6E7681] text-center" style={{ fontSize: '14px', fontWeight: 400, fontFamily: '"Open Sauce One", sans-serif' }}>
                No results found for "{searchQuery}"
              </p>
            </motion.div>
          ) : (
            <div>
              <p className="text-[#8297a3] mb-3" style={{ fontSize: '14px', fontWeight: 400, fontFamily: '"Open Sauce One", sans-serif' }}>{searchResults.length} results</p>
              {searchResults.map((market, index) => (
                <motion.button
                  key={market.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.03 }}
                  onClick={() => navigate(`/market/${market.id}`)}
                  onMouseEnter={() => handleMarketHover(market)}
                  className="flex items-center w-full py-3 border-b border-[#2c3f4f] last:border-b-0 hover:bg-poly-surface/30 transition-colors text-left rounded-lg -mx-2 px-2"
                >
                  <img
                    src={market.image}
                    alt=""
                    className="w-10 h-10 rounded-xl mr-3 object-cover bg-poly-surface shrink-0 border border-[#2c3f4f]"
                  />
                  <div className="flex-1 min-w-0 mr-3">
                    <p className="text-white mb-0.5 line-clamp-2" style={{ fontSize: '14px', fontWeight: 500, lineHeight: '20px', fontFamily: '"Open Sauce One", sans-serif' }}>
                      {market.question}
                    </p>
                    <p className="text-[#6E7681]" style={{ fontSize: '12px', fontWeight: 400, fontFamily: '"Open Sauce One", sans-serif' }}>
                      {market.volume} Vol.
                    </p>
                  </div>
                  <span className="text-white shrink-0" style={{ fontSize: '16px', fontWeight: 600, fontFamily: '"Open Sauce One", sans-serif' }}>
                    {(() => {
                      // Use real Polymarket prices for multi-outcome markets
                      if (market.isMultiOutcome && market.outcomes) {
                        const highestPrice = Math.max(...market.outcomes.map(o =>
                          (LATEST_REAL_PRICES as Record<string, number>)[o.name] || o.price
                        ));
                        return Math.round(highestPrice * 100);
                      }
                      return Math.round(market.yesPrice * 100);
                    })()}%
                  </span>
                </motion.button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <>
          {/* Topic Filter Pills */}
          <div className="flex overflow-x-auto" style={{ padding: '4px 16px', gap: '4px' }}>
            {topicFilters.map((topic) => {
              const isSelected = selectedTopic === topic;
              return (
                <button
                  key={topic}
                  onClick={() => setSelectedTopic(topic)}
                  className="shrink-0 transition-colors"
                  style={{
                    padding: '6px 14px',
                    fontSize: '13px',
                    fontWeight: 500,
                    fontFamily: '"Open Sauce One", sans-serif',
                    borderRadius: '7.6px',
                    color: isSelected ? '#2c9cdb' : '#899cb2',
                    backgroundColor: isSelected ? '#1e3a5f' : 'transparent',
                  }}
                >
                  {topic}
                </button>
              );
            })}
          </div>

          {/* Markets List */}
          <div className="pt-4 pb-6">
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
                onMouseEnter={() => handleMarketHover(market)}
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
