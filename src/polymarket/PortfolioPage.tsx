import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { ArrowUp, Search, Eye, EyeOff } from "lucide-react";
import { PolyHeader } from "./PolyHeader";
import { CategoryTabs } from "./CategoryTabs";
import { categories } from "./mockData";
import type { Category } from "./types";

// Polymarket Logo for branding (using official logo)
function PolymarketBrand() {
  return (
    <div className="flex items-center gap-2 text-[#5a6a7a]">
      <img src="/images/icon-white.svg" alt="Polymarket" className="w-6 h-6 opacity-60" />
      <span className="text-base font-medium">Polymarket</span>
    </div>
  );
}

// Profit/Loss Chart
function ProfitChart({ timeRange }: { timeRange: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    // Draw flat line at $0
    ctx.strokeStyle = "#3d5060";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, rect.height / 2);
    ctx.lineTo(rect.width, rect.height / 2);
    ctx.stroke();
  }, [timeRange]);

  return (
    <canvas ref={canvasRef} className="w-full h-16" />
  );
}

// Main Portfolio Page Component
export function PortfolioPage() {
  const [selectedCategory, setSelectedCategory] = useState<Category>("All");
  const [activeTab, setActiveTab] = useState<"positions" | "orders" | "history">("positions");
  const [timeRange, setTimeRange] = useState("1M");
  const [showBalance, setShowBalance] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  const timeRanges = ["1D", "1W", "1M", "ALL"];

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.2 }}
      className="min-h-screen bg-poly-bg pb-24"
    >
      <PolyHeader />

      <CategoryTabs
        categories={categories}
        selectedCategory={selectedCategory}
        onSelectCategory={setSelectedCategory}
      />

      <div className="px-4 py-4">
        {/* Portfolio Card */}
        <div className="bg-poly-card rounded-xl p-5 mb-4">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-2">
              <span className="text-[#8297a3] text-base">Portfolio</span>
              <button
                onClick={() => setShowBalance(!showBalance)}
                className="p-1 hover:opacity-70 transition-opacity"
              >
                {showBalance ? (
                  <Eye size={18} color="#8297a3" strokeWidth={2.5} />
                ) : (
                  <EyeOff size={18} color="#8297a3" strokeWidth={2.5} />
                )}
              </button>
            </div>
            {/* Cash Badge */}
            <div className="flex items-center gap-2 bg-[#2a3d52] px-3 py-1.5 rounded-full">
              <span className="text-lg">💵</span>
              <span className="text-[#22c55e] text-base font-semibold">
                {showBalance ? "$0.00" : "••••"}
              </span>
            </div>
          </div>

          {/* Portfolio Value */}
          <div className="mb-1">
            <span className="text-white text-4xl font-bold">
              {showBalance ? "$0.00" : "••••••"}
            </span>
          </div>
          <span className="text-[#8297a3] text-base">Today</span>

          {/* Withdraw Button */}
          <button className="w-full mt-5 py-3.5 bg-[#3d5060] rounded-lg flex items-center justify-center gap-2 text-[#8297a3] text-base font-medium hover:bg-[#4a6070] transition-colors">
            <ArrowUp size={18} strokeWidth={2.5} />
            Withdraw
          </button>
        </div>

        {/* Profit/Loss Card */}
        <div className="bg-poly-card rounded-xl p-5 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <span className="text-[#22c55e]">▲</span>
              <span className="text-[#8297a3] text-base">Profit/Loss</span>
            </div>
            <div className="flex items-center gap-1">
              {timeRanges.map((range) => (
                <button
                  key={range}
                  onClick={() => setTimeRange(range)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    timeRange === range
                      ? "bg-poly-blue text-white"
                      : "text-[#8297a3] hover:text-white"
                  }`}
                >
                  {range}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-start justify-between mb-4">
            <div>
              <span className="text-white text-3xl font-bold">$0.00</span>
              <p className="text-[#8297a3] text-base mt-1">Past Month</p>
            </div>
            <PolymarketBrand />
          </div>

          <ProfitChart timeRange={timeRange} />
        </div>

        {/* Positions / Open orders / History Tabs */}
        <div className="flex gap-6 border-b border-[#2c3f4f] mb-4">
          <button
            onClick={() => setActiveTab("positions")}
            className={`pb-3 text-base font-medium transition-colors ${
              activeTab === "positions"
                ? "text-white border-b-2 border-poly-blue"
                : "text-[#8297a3]"
            }`}
          >
            Positions
          </button>
          <button
            onClick={() => setActiveTab("orders")}
            className={`pb-3 text-base font-medium transition-colors ${
              activeTab === "orders"
                ? "text-white border-b-2 border-poly-blue"
                : "text-[#8297a3]"
            }`}
          >
            Open orders
          </button>
          <button
            onClick={() => setActiveTab("history")}
            className={`pb-3 text-base font-medium transition-colors ${
              activeTab === "history"
                ? "text-white border-b-2 border-poly-blue"
                : "text-[#8297a3]"
            }`}
          >
            History
          </button>
        </div>

        {/* Search and Filter */}
        <div className="flex gap-3 mb-6">
          <div className="flex-1 flex items-center bg-poly-card rounded-lg px-4 py-3 border border-[#2c3f4f]">
            <Search size={18} color="#8297a3" strokeWidth={2.5} />
            <input
              type="text"
              placeholder="Search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 bg-transparent text-white text-base ml-3 outline-none placeholder-[#8297a3]"
            />
          </div>
          <button className="flex items-center gap-2 bg-poly-card border border-[#2c3f4f] rounded-lg px-4 py-3">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8297a3" strokeWidth="2.5">
              <path d="M4 6h16M4 12h16M4 18h7" strokeLinecap="round" />
            </svg>
            <span className="text-white text-base">Current value</span>
          </button>
        </div>

        {/* Empty State */}
        <div className="text-center py-12">
          <p className="text-[#8297a3] text-base">No positions found.</p>
        </div>
      </div>
    </motion.div>
  );
}
