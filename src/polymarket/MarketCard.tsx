import { useState } from "react";
import { Bookmark, Gift, X } from "lucide-react";
import type { Market, Outcome } from "./types";
import { LATEST_REAL_PRICES } from "./realPriceData";
import { isMarketClosed } from "./marketStatus";

// Semi-circle gauge component for percentage display (exact Polymarket style)
function PercentageGauge({
  percentage,
}: {
  percentage: number;
}) {
  const radius = 28;
  const strokeWidth = 4.5;

  // Arc spans ~200 degrees for a more bulbous dome shape
  const startDeg = 190;
  const endDeg = -10;
  const totalDeg = startDeg - endDeg; // 200 degrees

  // Where the split occurs (in degrees)
  const splitDeg = startDeg - (percentage / 100) * totalDeg;

  // Visible gap in degrees (needs to be larger due to round linecaps)
  const gapDeg = 12;

  // Convert degrees to radians
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  // Convert polar to cartesian
  const toXY = (deg: number) => ({
    x: radius * Math.cos(toRad(deg)),
    y: -radius * Math.sin(toRad(deg)),
  });

  const start = toXY(startDeg);
  const end = toXY(endDeg);
  const filledEnd = toXY(splitDeg + gapDeg / 2);
  const unfilledStart = toXY(splitDeg - gapDeg / 2);

  // Large arc flag: 1 if arc > 180°
  const filledDeg = startDeg - (splitDeg + gapDeg / 2);
  const unfilledDeg = (splitDeg - gapDeg / 2) - endDeg;

  // Color based on percentage
  const color = percentage >= 65 ? "#43c773" : "#e9b308";

  return (
    <div className="relative flex flex-col items-center" style={{ width: 66, height: 48 }}>
      <svg
        width={66}
        height={36}
        viewBox="-33 -33 66 36"
        style={{ overflow: 'visible' }}
      >
        {/* Filled arc (colored) */}
        {percentage > 3 && (
          <path
            d={`M ${start.x.toFixed(1)} ${start.y.toFixed(1)} A ${radius} ${radius} 0 ${filledDeg > 180 ? 1 : 0} 1 ${filledEnd.x.toFixed(1)} ${filledEnd.y.toFixed(1)}`}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
          />
        )}
        {/* Unfilled arc (gray) */}
        {percentage < 97 && (
          <path
            d={`M ${unfilledStart.x.toFixed(1)} ${unfilledStart.y.toFixed(1)} A ${radius} ${radius} 0 ${unfilledDeg > 180 ? 1 : 0} 1 ${end.x.toFixed(1)} ${end.y.toFixed(1)}`}
            fill="none"
            stroke="#3d5266"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
          />
        )}
      </svg>
      {/* Percentage centered inside the arc */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 flex flex-col items-center">
        <span className="text-white leading-tight" style={{ fontSize: '13px', fontWeight: 600, fontFamily: '"Open Sauce One", sans-serif' }}>{percentage}%</span>
      </div>
      {/* "chance" right below the arc */}
      <span className="text-[#899cb2] mt-0.5" style={{ fontSize: '9px', fontWeight: 500, fontFamily: '"Open Sauce One", sans-serif' }}>chance</span>
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

// Outcome row for multi-outcome markets (Polymarket style - muted colors)
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
    <div className="flex items-center py-1.5">
      {/* Outcome name */}
      <div className="flex-1 min-w-0">
        <span className="text-white" style={{ fontSize: '13px', fontWeight: 500, fontFamily: '"Open Sauce One", sans-serif' }}>
          {outcome.name}
        </span>
      </div>

      {/* Percentage */}
      <span className="text-white mr-2.5" style={{ fontSize: '14px', fontWeight: 600, fontFamily: '"Open Sauce One", sans-serif' }}>
        {yesPrice}%
      </span>

      {/* Yes/No buttons - exact Polymarket colors */}
      <div className="flex gap-1">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onYesPress();
          }}
          className="px-2.5 py-1 rounded text-[#43c773] bg-[#43c773]/15 hover:bg-[#43c773]/25 transition-colors"
          style={{ fontSize: '12px', fontWeight: 500, fontFamily: '"Open Sauce One", sans-serif' }}
        >
          Yes
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onNoPress();
          }}
          className="px-2.5 py-1 rounded text-[#e13737] bg-[#e13737]/15 hover:bg-[#e13737]/25 transition-colors"
          style={{ fontSize: '12px', fontWeight: 500, fontFamily: '"Open Sauce One", sans-serif' }}
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
  const isClosed = isMarketClosed(market);

  // Detect binary Yes/No markets (should show gauge + large buttons like Polymarket)
  const isBinaryYesNo = market.outcomes?.length === 2 &&
    market.outcomes.some(o => o.name.toLowerCase() === 'yes') &&
    market.outcomes.some(o => o.name.toLowerCase() === 'no');

  // Single outcome = no outcomes array OR binary Yes/No market
  const isSingleOutcome = !market.isMultiOutcome || !market.outcomes || isBinaryYesNo;

  // For multi-outcome markets (like Federal Reserve Chair), use the highest real price from outcomes
  // For single outcome / binary markets, use market.yesPrice or Yes outcome price
  const yesPercent = (() => {
    if (isBinaryYesNo && market.outcomes) {
      const yesOutcome = market.outcomes.find(o => o.name.toLowerCase() === 'yes');
      if (yesOutcome) {
        const realPrice = (LATEST_REAL_PRICES as Record<string, number>)[yesOutcome.name] || yesOutcome.price;
        return Math.round(realPrice * 100);
      }
    }
    if (market.isMultiOutcome && market.outcomes && !isBinaryYesNo) {
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
      <div className="px-3 mb-2">
        <TradeExpansion
          market={market}
          tradeType={expandedTrade}
          onClose={() => setExpandedTrade(null)}
        />
      </div>
    );
  }

  return (
    <div className="px-3 mb-2">
      <div
        onClick={onPress}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onPress(); }}
        className="w-full bg-[#2f3f50] rounded-[7.6px] overflow-hidden text-left hover:bg-[#364858] transition-colors border border-[#3d5266] cursor-pointer h-[180px]"
      >
        <div className="p-3 h-full flex flex-col">
          {/* Header with image and title */}
          <div className="flex items-center gap-2.5 mb-2.5">
            <img
              src={market.image}
              alt=""
              className="w-10 h-10 rounded-md object-cover bg-poly-surface shrink-0"
            />
            <div className="flex-1 min-w-0">
              <h3 className="text-white pr-2 line-clamp-2" style={{ fontSize: '14px', fontWeight: 600, lineHeight: '20px', fontFamily: '"Open Sauce One", sans-serif' }}>
                {market.question}
              </h3>
              {isClosed && (
                <span className="inline-flex mt-1 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide bg-[#1b2a36] text-[#f59e0b] border border-[#f59e0b]/40">
                  Ended
                </span>
              )}
            </div>
            {/* Show gauge for binary Yes/No markets */}
            {isSingleOutcome && (
              <PercentageGauge percentage={yesPercent} />
            )}
          </div>

          {/* Multi-outcome list (not for binary Yes/No) */}
          {market.isMultiOutcome && market.outcomes && !isBinaryYesNo && (
            <div className="mb-2">
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

          {/* Binary Yes/No - large buttons (Polymarket style) */}
          {isSingleOutcome && (
            <div className="flex gap-2 mb-2 mt-1">
              <button
                onClick={handleYesClick}
                className="flex-1 py-2 rounded text-[#43c773] bg-[#43c773]/15 hover:bg-[#43c773]/25 transition-colors"
                style={{ fontSize: '14px', fontWeight: 600, fontFamily: '"Open Sauce One", sans-serif' }}
              >
                Yes
              </button>
              <button
                onClick={handleNoClick}
                className="flex-1 py-2 rounded text-[#e13737] bg-[#e13737]/15 hover:bg-[#e13737]/25 transition-colors"
                style={{ fontSize: '14px', fontWeight: 600, fontFamily: '"Open Sauce One", sans-serif' }}
              >
                No
              </button>
            </div>
          )}

          {/* Spacer to push footer down */}
          <div className="flex-grow" />

          {/* Footer with volume and icons - Polymarket style */}
          <div className="flex items-center justify-between mt-auto">
            <span className="text-[#8297a3]" style={{ fontSize: '12px', fontWeight: 400, fontFamily: '"Open Sauce One", sans-serif' }}>{market.volume} Vol.</span>
            <div className="flex items-center gap-0.5">
              <button
                onClick={(e) => e.stopPropagation()}
                className="p-1 hover:bg-[#3d5266] rounded transition-colors"
              >
                <Gift size={16} color="#8297a3" strokeWidth={2} />
              </button>
              <button
                onClick={(e) => e.stopPropagation()}
                className="p-1 hover:bg-[#3d5266] rounded transition-colors"
              >
                <Bookmark size={16} color="#8297a3" strokeWidth={2} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
