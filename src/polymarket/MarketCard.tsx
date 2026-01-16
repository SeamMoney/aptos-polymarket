import { useState } from "react";
import { Bookmark, Gift, RefreshCw, MoreHorizontal, X } from "lucide-react";
import type { Market, Outcome } from "./types";
import { LATEST_REAL_PRICES } from "./realPriceData";
import { isMarketClosed } from "./marketStatus";

// Semi-circle gauge component for percentage display (Polymarket style)
function PercentageGauge({
  percentage,
  size = 70,
}: {
  percentage: number;
  size?: number;
}) {
  const strokeWidth = 6;
  const radius = (size - strokeWidth) / 2;
  const centerX = size / 2;
  const centerY = size / 2 + 4; // Shifted down slightly

  // Semi-circle arc from left to right (180 degrees)
  const startAngle = Math.PI; // Start from left (180 degrees)
  const endAngle = 0; // End at right (0 degrees)

  // Calculate the filled arc based on percentage
  const fillAngle = startAngle - (percentage / 100) * Math.PI;

  // Convert angles to coordinates
  const startX = centerX + radius * Math.cos(startAngle);
  const startY = centerY - radius * Math.sin(startAngle);
  const endX = centerX + radius * Math.cos(endAngle);
  const endY = centerY - radius * Math.sin(endAngle);
  const fillX = centerX + radius * Math.cos(fillAngle);
  const fillY = centerY - radius * Math.sin(fillAngle);

  // Determine color based on percentage
  const getColor = (pct: number) => {
    if (pct >= 70) return "#22c55e"; // Green
    if (pct >= 40) return "#eab308"; // Yellow/gold
    return "#6b7280"; // Gray for low percentages
  };

  const color = getColor(percentage);

  return (
    <div className="flex flex-col items-center" style={{ width: size }}>
      <svg width={size} height={size / 2 + 8} className="overflow-visible">
        {/* Background arc (gray) */}
        <path
          d={`M ${startX} ${startY} A ${radius} ${radius} 0 0 1 ${endX} ${endY}`}
          fill="none"
          stroke="#3d4f5f"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />
        {/* Filled arc (colored) */}
        {percentage > 0 && (
          <path
            d={`M ${startX} ${startY} A ${radius} ${radius} 0 0 1 ${fillX} ${fillY}`}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
          />
        )}
        {/* Dot at end of filled arc */}
        <circle
          cx={fillX}
          cy={fillY}
          r={4}
          fill={color}
        />
      </svg>
      {/* Percentage text below the gauge */}
      <div className="flex flex-col items-center -mt-1">
        <span className="text-white text-base font-bold">{percentage}%</span>
        <span className="text-[#8297a3] text-[10px] -mt-0.5">chance</span>
      </div>
    </div>
  );
}

// Trade expansion panel with slider
function TradeExpansion({
  market,
  onClose,
}: {
  market: Market;
  tradeType: "yes" | "no";
  onClose: () => void;
}) {
  const [amount, setAmount] = useState(0);
  const [sliderValue, setSliderValue] = useState(50);

  const handleAddAmount = (delta: number) => {
    setAmount((prev) => Math.max(0, prev + delta));
  };

  return (
    <div className="bg-[#2a3d4e] rounded-2xl border-2 border-[#3a4f60] p-4">
      {/* Header with market info and close button */}
      <div className="flex items-start gap-3 mb-4">
        <img
          src={market.image}
          alt=""
          className="w-10 h-10 rounded-lg object-cover bg-poly-surface shrink-0"
        />
        <div className="flex-1 min-w-0">
          <h3 className="text-white text-base font-bold leading-snug pr-8">
            {market.question}
          </h3>
        </div>
        <button
          onClick={onClose}
          className="p-1 hover:bg-poly-surface rounded-lg transition-colors shrink-0"
        >
          <X size={20} color="#8297a3" strokeWidth={2.5} />
        </button>
      </div>

      {/* Amount input row */}
      <div className="flex items-center gap-3 mb-4">
        <div className="flex items-center bg-[#1c2b3a] rounded-lg px-3 py-2 border-2 border-[#3a4f60]">
          <span className="text-white text-lg font-bold">${amount.toFixed(1)}</span>
        </div>
        <button
          onClick={() => handleAddAmount(1)}
          className="px-4 py-2 bg-[#1c2b3a] border-2 border-[#3a4f60] rounded-lg text-white text-sm font-medium hover:bg-[#2a3d4e] transition-colors"
        >
          +1
        </button>
        <button
          onClick={() => handleAddAmount(10)}
          className="px-4 py-2 bg-[#1c2b3a] border-2 border-[#3a4f60] rounded-lg text-white text-sm font-medium hover:bg-[#2a3d4e] transition-colors"
        >
          +10
        </button>

        {/* Slider */}
        <div className="flex-1 relative h-2">
          <div className="absolute inset-0 rounded-full bg-gradient-to-r from-[#3b82f6] to-[#a855f7]" />
          <div
            className="absolute right-0 top-1/2 -translate-y-1/2 w-6 h-6 bg-white rounded-full shadow-lg border-2 border-[#3a4f60] cursor-pointer"
            style={{
              left: `calc(${sliderValue}% - 12px)`,
              right: 'auto',
            }}
          />
          <input
            type="range"
            min="0"
            max="100"
            value={sliderValue}
            onChange={(e) => {
              setSliderValue(Number(e.target.value));
              setAmount(Number(e.target.value) / 10);
            }}
            className="absolute inset-0 w-full opacity-0 cursor-pointer"
          />
        </div>
      </div>

      {/* Trade button */}
      <button
        className="w-full py-4 bg-[#2E5CFF] hover:bg-[#2451E0] rounded-xl flex items-center justify-center gap-2 transition-colors"
      >
        <span className="text-white text-base font-semibold">Trade</span>
      </button>
    </div>
  );
}

// Outcome row for multi-outcome markets
function OutcomeRow({
  outcome,
  onYesPress,
  onNoPress,
}: {
  outcome: Outcome;
  onYesPress: () => void;
  onNoPress: () => void;
}) {
  // Use REAL Polymarket prices for display if available, otherwise use outcome.price
  const realPrice = (LATEST_REAL_PRICES as Record<string, number>)[outcome.name] || outcome.price;
  const yesPrice = Math.round(realPrice * 100);

  return (
    <div className="flex items-center py-2.5">
      {/* Outcome name */}
      <div className="flex-1 min-w-0">
        <span className="text-white text-sm">
          {outcome.name}
        </span>
      </div>

      {/* Percentage */}
      <span className="text-white text-base font-bold mx-4">
        {yesPrice}%
      </span>

      {/* Yes/No buttons */}
      <div className="flex gap-2">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onYesPress();
          }}
          className="px-4 py-1.5 rounded-lg text-white text-sm font-semibold bg-[#3dac67] hover:bg-[#359b5c] transition-colors"
        >
          Yes
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onNoPress();
          }}
          className="px-4 py-1.5 rounded-lg text-white text-sm font-semibold bg-[#e13836] hover:bg-[#c9312f] transition-colors"
        >
          No
        </button>
      </div>
    </div>
  );
}

interface MarketCardProps {
  market: Market;
  onPress: () => void;
}

export function MarketCard({ market, onPress }: MarketCardProps) {
  const [expandedTrade, setExpandedTrade] = useState<"yes" | "no" | null>(null);
  const isSingleOutcome = !market.isMultiOutcome || !market.outcomes;
  const isClosed = isMarketClosed(market);

  // For multi-outcome markets (like Federal Reserve Chair), use the highest real price from outcomes
  // For single outcome markets, use market.yesPrice
  const yesPercent = (() => {
    if (market.isMultiOutcome && market.outcomes) {
      // Get highest price from outcomes using real Polymarket prices
      const highestPrice = Math.max(...market.outcomes.map(o =>
        (LATEST_REAL_PRICES as Record<string, number>)[o.name] || o.price
      ));
      return Math.round(highestPrice * 100);
    }
    return Math.round(market.yesPrice * 100);
  })();

  const handleYesClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedTrade(expandedTrade === "yes" ? null : "yes");
  };

  const handleNoClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedTrade(expandedTrade === "no" ? null : "no");
  };

  // If expanded, show the trade expansion panel
  if (expandedTrade) {
    return (
      <div className="px-4 mb-3">
        <TradeExpansion
          market={market}
          tradeType={expandedTrade}
          onClose={() => setExpandedTrade(null)}
        />
      </div>
    );
  }

  return (
    <div className="px-4 mb-4">
      <div
        onClick={onPress}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onPress(); }}
        className="w-full bg-[#2a3d4e] rounded-xl overflow-hidden text-left hover:bg-[#324858] transition-colors border border-[#3a4f60] cursor-pointer"
      >
        <div className="p-3">
          {/* Header with image and title */}
          <div className="flex items-start gap-3 mb-2">
            <img
              src={market.image}
              alt=""
              className="w-12 h-12 rounded-lg object-cover bg-poly-surface shrink-0"
            />
            <div className="flex-1 min-w-0">
              <h3 className="text-white text-sm font-bold leading-snug pr-2 line-clamp-2">
                {market.question}
              </h3>
              {isClosed && (
                <span className="inline-flex mt-1 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide bg-[#1b2a36] text-[#f59e0b] border border-[#f59e0b]/40">
                  Ended
                </span>
              )}
            </div>
            {/* Show gauge for single outcome markets */}
            {isSingleOutcome && (
              <PercentageGauge percentage={yesPercent} size={60} />
            )}
          </div>

          {/* Multi-outcome list */}
          {market.isMultiOutcome && market.outcomes && (
            <div className="mb-3">
              {market.outcomes.slice(0, 2).map((outcome) => (
                <OutcomeRow
                  key={outcome.id}
                  outcome={outcome}
                  onYesPress={() => {}}
                  onNoPress={() => {}}
                />
              ))}
            </div>
          )}

          {/* Single outcome Yes/No buttons */}
          {isSingleOutcome && (
            <div className="flex gap-2 mb-2">
              <button
                onClick={handleYesClick}
                className="flex-1 py-2.5 rounded-lg text-white text-base font-bold bg-[#3dac67] hover:bg-[#359b5c] transition-colors"
              >
                Yes
              </button>
              <button
                onClick={handleNoClick}
                className="flex-1 py-2.5 rounded-lg text-white text-base font-bold bg-[#e13836] hover:bg-[#c9312f] transition-colors"
              >
                No
              </button>
            </div>
          )}

          {/* Footer with volume and icons */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="text-[#8297a3] text-sm font-medium">{market.volume} Vol.</span>
              <RefreshCw size={14} color="#8297a3" strokeWidth={2.5} />
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={(e) => e.stopPropagation()}
                className="p-1 hover:opacity-70 transition-opacity"
              >
                <Gift size={18} color="#6b7a8a" strokeWidth={2.5} />
              </button>
              <button
                onClick={(e) => e.stopPropagation()}
                className="p-1 hover:opacity-70 transition-opacity"
              >
                <Bookmark size={18} color="#6b7a8a" strokeWidth={2.5} />
              </button>
              <button
                onClick={(e) => e.stopPropagation()}
                className="p-1 hover:opacity-70 transition-opacity"
              >
                <MoreHorizontal size={18} color="#6b7a8a" strokeWidth={2.5} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
