import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Search as SearchIcon } from "lucide-react";
import { PolyHeader } from "./PolyHeader";
import { mockMarkets } from "./mockData";

// Browse category icons
const SparklesIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 3v5m0 8v5M5.5 8.5l3.5 3.5-3.5 3.5M18.5 8.5l-3.5 3.5 3.5 3.5M8.5 5.5l3.5 3.5 3.5-3.5M8.5 18.5l3.5-3.5 3.5 3.5"/>
  </svg>
);

const TrendingIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/>
    <polyline points="16 7 22 7 22 13"/>
  </svg>
);

const FireIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>
  </svg>
);

const DropletIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/>
  </svg>
);

const ClockIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/>
    <polyline points="12 6 12 12 16 14"/>
  </svg>
);

const TrophyIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/>
    <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/>
    <path d="M4 22h16"/>
    <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/>
    <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/>
    <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/>
  </svg>
);

const BROWSE_CATEGORIES = [
  { id: "new", label: "New", icon: SparklesIcon },
  { id: "trending", label: "Trending", icon: TrendingIcon },
  { id: "popular", label: "Popular", icon: FireIcon },
  { id: "liquid", label: "Liquid", icon: DropletIcon },
  { id: "ending-soon", label: "Ending Soon", icon: ClockIcon },
  { id: "competitive", label: "Competitive", icon: TrophyIcon },
];

// Get recent markets - show all markets
function getRecentMarkets() {
  return mockMarkets;
}

export function SearchPage() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [recentMarkets, setRecentMarkets] = useState(getRecentMarkets);

  useEffect(() => {
    setRecentMarkets(getRecentMarkets());
  }, []);

  const filteredMarkets = query.trim()
    ? mockMarkets.filter((m) =>
        m.question.toLowerCase().includes(query.toLowerCase())
      )
    : [];

  const handleMarketClick = (marketId: string) => {
    // Save to recent markets
    try {
      const stored = localStorage.getItem("recentMarkets");
      const ids = stored ? (JSON.parse(stored) as string[]) : [];
      const newIds = [marketId, ...ids.filter((id) => id !== marketId)].slice(0, 10);
      localStorage.setItem("recentMarkets", JSON.stringify(newIds));
    } catch {
      // ignore
    }
    navigate(`/market/${marketId}`);
  };

  const handleCategoryClick = (categoryId: string) => {
    // Navigate to category or filter
    navigate(`/?category=${categoryId}`);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      className="min-h-screen bg-poly-bg"
    >
      <PolyHeader />

      <div className="px-4 pt-2 pb-6">
        {/* Search Input - Polymarket style */}
        <div
          className="flex items-center gap-3 rounded-lg px-4 py-3"
          style={{
            backgroundColor: "#1c2936",
          }}
        >
          <SearchIcon size={20} color="#6b7280" strokeWidth={2} />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search polymarket"
            className="flex-1 bg-transparent text-white text-base outline-none placeholder-[#6b7280]"
            style={{
              fontFamily: '"Open Sauce One", sans-serif',
            }}
            autoFocus
          />
        </div>

        {/* Show search results if query exists */}
        {query.trim() !== "" ? (
          <div className="mt-4">
            {filteredMarkets.length === 0 ? (
              <p className="text-[#6b7280] text-sm text-center py-8">
                No results found for "{query}"
              </p>
            ) : (
              <div className="space-y-1">
                {filteredMarkets.map((market) => (
                  <button
                    key={market.id}
                    onClick={() => handleMarketClick(market.id)}
                    className="flex items-center w-full py-2.5 hover:bg-[#1c2936] transition-colors text-left rounded-lg px-2"
                  >
                    <img
                      src={market.image}
                      alt=""
                      className="w-10 h-10 rounded-full mr-3 object-cover bg-poly-surface shrink-0"
                    />
                    <span
                      className="text-white text-sm font-medium flex-1 line-clamp-2"
                      style={{ fontFamily: '"Open Sauce One", sans-serif' }}
                    >
                      {market.question}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <>
            {/* BROWSE Section */}
            <div className="mt-6">
              <p
                className="text-[#6b7280] text-xs font-semibold tracking-wider mb-3"
                style={{ fontFamily: '"Open Sauce One", sans-serif' }}
              >
                BROWSE
              </p>
              <div className="flex flex-wrap gap-2">
                {BROWSE_CATEGORIES.map((category) => {
                  const IconComponent = category.icon;
                  return (
                    <button
                      key={category.id}
                      onClick={() => handleCategoryClick(category.id)}
                      className="flex items-center gap-2 transition-all hover:opacity-80"
                      style={{
                        padding: "8px 16px",
                        borderRadius: "9999px",
                        backgroundColor: "#2f3f50",
                        border: "none",
                      }}
                    >
                      <IconComponent />
                      <span
                        className="text-white text-sm font-semibold"
                        style={{ fontFamily: '"Open Sauce One", sans-serif' }}
                      >
                        {category.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* RECENT Section */}
            {recentMarkets.length > 0 && (
              <div className="mt-6">
                <p
                  className="text-[#6b7280] text-xs font-semibold tracking-wider mb-3"
                  style={{ fontFamily: '"Open Sauce One", sans-serif' }}
                >
                  RECENT
                </p>
                <div className="space-y-1">
                  {recentMarkets.map((market) => (
                    <button
                      key={market!.id}
                      onClick={() => handleMarketClick(market!.id)}
                      className="flex items-center w-full py-2.5 hover:bg-[#1c2936] transition-colors text-left rounded-lg px-2 -mx-2"
                    >
                      <img
                        src={market!.image}
                        alt=""
                        className="w-10 h-10 rounded-full mr-3 object-cover bg-poly-surface shrink-0"
                      />
                      <span
                        className="text-white text-sm font-medium flex-1 line-clamp-2"
                        style={{ fontFamily: '"Open Sauce One", sans-serif' }}
                      >
                        {market!.question}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </motion.div>
  );
}
