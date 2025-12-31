import { useState, useMemo, memo } from "react";
import { HelpCircle, Gift, RefreshCw, ChevronUp, SlidersHorizontal } from "lucide-react";

interface OrderBookEntry {
  price: number;
  shares: number;
  total: number;
}

interface ExpandedOrderBookProps {
  marketId: string;
  basePrice: number;
  onClose?: () => void;
}

// Seeded random for consistent data
const seededRandom = (seed: number) => {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
};

// Generate order book data with more rows
const generateOrderBook = (
  marketId: string,
  basePrice: number,
  isYes: boolean
) => {
  const seed = (parseInt(marketId) || 1) + (isYes ? 0 : 1000);
  const asks: OrderBookEntry[] = [];
  const bids: OrderBookEntry[] = [];

  const centerPrice = Math.round(basePrice * 100);

  // Generate 8 asks (sell orders) - prices above center
  for (let i = 0; i < 8; i++) {
    const rand = seededRandom(seed * 100 + i);
    const price = centerPrice + i + 1;
    const shares = Math.floor(1000 + rand * 80000);
    const total = Math.round(shares * (price / 100) * 100) / 100;

    asks.push({ price, shares, total });
  }

  // Generate 8 bids (buy orders) - prices at and below center
  for (let i = 0; i < 8; i++) {
    const rand = seededRandom(seed * 200 + i);
    const price = centerPrice - i;
    const shares = Math.floor(5000 + rand * 20000);
    const total = Math.round(shares * (price / 100) * 100) / 100;

    bids.push({ price, shares, total });
  }

  return {
    asks: asks.reverse(), // Show highest ask first
    bids,
    lastPrice: centerPrice - 1,
    spread: 1,
  };
};

// Memoized row component for performance
const OrderRow = memo(function OrderRow({
  entry,
  maxShares,
  type,
  showLabel,
}: {
  entry: OrderBookEntry;
  maxShares: number;
  type: "ask" | "bid";
  showLabel: boolean;
}) {
  const barWidth = (entry.shares / maxShares) * 100;
  const isAsk = type === "ask";
  const color = isAsk ? "#ef4444" : "#22c55e";
  const bgColor = isAsk ? "rgba(239, 68, 68, 0.2)" : "rgba(34, 197, 94, 0.2)";
  const hoverBg = isAsk ? "rgba(239, 68, 68, 0.1)" : "rgba(34, 197, 94, 0.1)";

  const formatNumber = (num: number) => {
    return num.toLocaleString(undefined, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });
  };

  const formatTotal = (num: number) => {
    return `$${num.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  return (
    <div
      className="flex items-center px-4 py-2 relative cursor-pointer transition-colors"
      style={{
        willChange: 'background-color',
      }}
      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = hoverBg}
      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
    >
      {/* Background bar - GPU accelerated with transform */}
      <div
        className="absolute left-0 top-0 bottom-0 pointer-events-none"
        style={{
          backgroundColor: bgColor,
          width: `${Math.min(barWidth * 0.5, 50)}%`,
          willChange: 'width',
          transition: 'width 150ms ease-out',
        }}
      />
      {/* Label */}
      {showLabel && (
        <div className="absolute left-3 top-1/2 -translate-y-1/2 z-20">
          <span
            className="px-2.5 py-1 rounded text-xs font-semibold"
            style={{
              backgroundColor: color,
              color: isAsk ? 'white' : 'black',
            }}
          >
            {isAsk ? 'Asks' : 'Bids'}
          </span>
        </div>
      )}
      {/* Data */}
      <div className="w-[140px]" />
      <span
        className="text-sm w-20 text-center font-semibold relative z-10 tabular-nums"
        style={{ color }}
      >
        {entry.price}¢
      </span>
      <span className="text-[#8b98a5] text-sm flex-1 text-right relative z-10 tabular-nums">
        {formatNumber(entry.shares)}
      </span>
      <span className="text-[#8b98a5] text-sm w-28 text-right relative z-10 tabular-nums">
        {formatTotal(entry.total)}
      </span>
    </div>
  );
});

export function ExpandedOrderBook({
  marketId,
  basePrice,
}: ExpandedOrderBookProps) {
  const [activeTab, setActiveTab] = useState<"yes" | "no">("yes");
  const [isExpanded, setIsExpanded] = useState(true);

  const orderBook = useMemo(
    () => generateOrderBook(marketId, basePrice, activeTab === "yes"),
    [marketId, basePrice, activeTab]
  );

  const maxAskShares = Math.max(...orderBook.asks.map((a) => a.shares));
  const maxBidShares = Math.max(...orderBook.bids.map((b) => b.shares));

  return (
    <div className="rounded-2xl border-2 border-[#2c3f4f]">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-4 py-4 hover:opacity-80 transition-opacity"
      >
        <div className="flex items-center gap-2">
          <span className="text-white text-xl font-bold">Order Book</span>
          <HelpCircle size={18} color="#6E7681" strokeWidth={2.5} />
        </div>
        <ChevronUp
          size={22}
          color="#8297a3"
          strokeWidth={2.5}
          className={`transition-transform duration-200 ${isExpanded ? "" : "rotate-180"}`}
        />
      </button>

      {!isExpanded ? null : (
        <>
          {/* Tabs Row */}
          <div className="flex items-center px-4 pb-3 border-b-2 border-[#2c3f4f]">
            <div className="flex gap-6 flex-1">
              <button
                onClick={() => setActiveTab("yes")}
                className={`relative pb-2 transition-colors ${
                  activeTab === "yes" ? "text-white" : "text-[#6b7a8a]"
                }`}
              >
                <span className={`text-base ${activeTab === "yes" ? "font-bold" : "font-medium"}`}>Trade Yes</span>
                {activeTab === "yes" && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white rounded-full" />
                )}
              </button>
              <button
                onClick={() => setActiveTab("no")}
                className={`relative pb-2 transition-colors ${
                  activeTab === "no" ? "text-white" : "text-[#6b7a8a]"
                }`}
              >
                <span className={`text-base ${activeTab === "no" ? "font-bold" : "font-medium"}`}>Trade No</span>
                {activeTab === "no" && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white rounded-full" />
                )}
              </button>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3">
              <button className="p-1.5 hover:bg-poly-surface rounded-lg transition-colors">
                <Gift size={20} color="#6b7a8a" strokeWidth={2.5} />
              </button>
              <button className="p-1.5 hover:bg-poly-surface rounded-lg transition-colors">
                <RefreshCw size={20} color="#6b7a8a" strokeWidth={2.5} />
              </button>
            </div>
          </div>

          {/* Column Headers */}
          <div className="flex items-center px-4 py-3 border-b-2 border-[#2c3f4f]">
            <div className="flex items-center gap-2 w-[140px]">
              <span className="text-[#6b7a8a] text-xs font-semibold uppercase tracking-wider">
                Trade {activeTab === "yes" ? "Yes" : "No"}
              </span>
              <SlidersHorizontal size={14} color="#6b7a8a" strokeWidth={2.5} />
            </div>
            <span className="text-[#6b7a8a] text-xs font-semibold uppercase tracking-wider w-20 text-center">
              Price
            </span>
            <span className="text-[#6b7a8a] text-xs font-semibold uppercase tracking-wider flex-1 text-right">
              Shares
            </span>
            <span className="text-[#6b7a8a] text-xs font-semibold uppercase tracking-wider w-28 text-right">
              Total
            </span>
          </div>

          {/* Asks (Sell orders) - Scrollable */}
          <div className="relative max-h-[240px] overflow-y-auto">
            {orderBook.asks.map((ask, i) => (
              <OrderRow
                key={`ask-${i}-${ask.price}`}
                entry={ask}
                maxShares={maxAskShares}
                type="ask"
                showLabel={i === orderBook.asks.length - 1}
              />
            ))}
          </div>

          {/* Spread */}
          <div className="flex items-center px-4 py-3 border-y-2 border-[#2c3f4f]">
            <span className="text-[#8b98a5] text-sm font-medium tabular-nums">
              Last: {orderBook.lastPrice}¢
            </span>
            <span className="text-[#8b98a5] text-sm font-medium ml-auto tabular-nums">
              Spread: {orderBook.spread}¢
            </span>
          </div>

          {/* Bids (Buy orders) - Scrollable */}
          <div className="relative max-h-[240px] overflow-y-auto">
            {orderBook.bids.map((bid, i) => (
              <OrderRow
                key={`bid-${i}-${bid.price}`}
                entry={bid}
                maxShares={maxBidShares}
                type="bid"
                showLabel={i === 0}
              />
            ))}
          </div>

          {/* Bottom padding */}
          <div className="h-2" />
        </>
      )}
    </div>
  );
}
