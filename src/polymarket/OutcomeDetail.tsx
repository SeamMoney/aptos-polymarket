import { useState, useMemo, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ChevronLeft,
  ChevronDown,
  Link2,
  Bookmark,
  Code2,
  HelpCircle,
  Settings,
  Trash2,
  RefreshCw,
  MoreHorizontal,
} from "lucide-react";
import { TradingSheet } from "./TradingSheet";
import { mockMarkets } from "./mockData";

const CHART_HEIGHT = 280;
const CHART_PADDING_RIGHT = 60;

// Seeded random for consistent data
const seededRandom = (seed: number) => {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
};

// Generate price history for the outcome
const generatePriceHistory = (
  outcomeId: string,
  basePrice: number,
  numPoints: number
) => {
  const seed = outcomeId.charCodeAt(0) * 100 + (outcomeId.charCodeAt(1) || 0);
  const points: number[] = [];

  for (let i = 0; i < numPoints; i++) {
    const rand = seededRandom(seed * 1000 + i);
    const t = i / numPoints;
    let price: number;

    if (t < 0.55) {
      price = 0.28 + (rand - 0.5) * 0.08;
    } else if (t < 0.65) {
      const spikeProgress = (t - 0.55) / 0.1;
      price = 0.3 + spikeProgress * 0.45 + (rand - 0.5) * 0.05;
    } else if (t < 0.75) {
      price = 0.7 + (rand - 0.5) * 0.1;
    } else if (t < 0.85) {
      const dropProgress = (t - 0.75) / 0.1;
      price = 0.7 - dropProgress * 0.25 + (rand - 0.5) * 0.08;
    } else {
      price = basePrice + (rand - 0.5) * 0.08;
    }

    price = Math.max(0.01, Math.min(0.99, price));
    points.push(price);
  }

  return points;
};

// Generate smooth curved path using quadratic bezier curves
const generateSmoothPath = (points: { x: number; y: number }[]): string => {
  if (points.length < 2) return "";

  let path = `M ${points[0].x} ${points[0].y}`;

  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const midX = (prev.x + curr.x) / 2;
    const midY = (prev.y + curr.y) / 2;

    // Use quadratic bezier for smooth curves
    path += ` Q ${prev.x} ${prev.y}, ${midX} ${midY}`;
  }

  // Final line to last point
  const last = points[points.length - 1];
  path += ` L ${last.x} ${last.y}`;

  return path;
};

// Generate order book
const generateOrderBook = (outcomeId: string, basePrice: number) => {
  const seed = outcomeId.charCodeAt(0) * 100 + (outcomeId.charCodeAt(1) || 0);
  const asks: { price: number; shares: number; total: number }[] = [];
  const bids: { price: number; shares: number; total: number }[] = [];

  const basePriceCents = Math.round(basePrice * 100);

  for (let i = 0; i < 8; i++) {
    const rand = seededRandom(seed * 200 + i);
    const price = basePriceCents + 1 + i;
    const shares = Math.round(800 + rand * 84000);
    asks.push({ price, shares, total: Math.round(shares * (price / 100) * 100) });
  }

  for (let i = 0; i < 8; i++) {
    const rand = seededRandom(seed * 300 + i);
    const price = basePriceCents - 1 - i;
    const shares = Math.round(6000 + rand * 14000);
    bids.push({ price, shares, total: Math.round(shares * (price / 100) * 100) });
  }

  return {
    asks: asks.reverse(),
    bids,
    lastPrice: basePriceCents - 1,
    spread: 1,
  };
};

export function OutcomeDetail() {
  const { marketId, outcomeId } = useParams<{ marketId: string; outcomeId: string }>();
  const navigate = useNavigate();

  const [timeRange, setTimeRange] = useState("ALL");
  const [orderBookExpanded, setOrderBookExpanded] = useState(true);
  const [tradeTab, setTradeTab] = useState<"yes" | "no">("yes");
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [showTradingSheet, setShowTradingSheet] = useState(false);
  const [tradeType, setTradeType] = useState<"yes" | "no">("yes");

  useEffect(() => {
    const timer = setTimeout(() => setIsLoaded(true), 100);
    return () => clearTimeout(timer);
  }, []);

  const market = useMemo(() => mockMarkets.find((m) => m.id === marketId), [marketId]);
  const outcome = useMemo(
    () => market?.outcomes?.find((o) => o.id === outcomeId),
    [market, outcomeId]
  );

  // More data points for choppier/more detailed chart
  const numPoints = timeRange === "ALL" ? 200 : timeRange === "1M" ? 120 : timeRange === "1W" ? 80 : 60;

  // Track chart container width for responsive sizing
  const [chartWidth, setChartWidth] = useState(window.innerWidth - 80);

  useEffect(() => {
    const handleResize = () => {
      setChartWidth(Math.min(window.innerWidth - 80, 800));
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const priceHistory = useMemo(() => {
    if (!outcome) return [];
    return generatePriceHistory(outcome.id, outcome.price, numPoints);
  }, [outcome, numPoints]);

  const orderBook = useMemo(() => {
    if (!outcome) return null;
    return generateOrderBook(outcome.id, outcome.price);
  }, [outcome]);

  const innerWidth = chartWidth - CHART_PADDING_RIGHT;

  const chartPath = useMemo(() => {
    if (priceHistory.length === 0) return { pathD: "", points: [], lastPoint: null };

    const points = priceHistory.map((price, i) => {
      const x = (i / Math.max(1, priceHistory.length - 1)) * innerWidth;
      const y = CHART_HEIGHT - price * CHART_HEIGHT;
      return { x, y, price };
    });

    const pathD = generateSmoothPath(points);
    const lastPoint = points[points.length - 1];

    return { pathD, points, lastPoint };
  }, [priceHistory, innerWidth]);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const x = Math.max(0, Math.min(chartWidth, e.clientX - rect.left));
      const idx = Math.round((x / chartWidth) * (numPoints - 1));
      setActiveIndex(Math.max(0, Math.min(numPoints - 1, idx)));
    },
    [numPoints, chartWidth]
  );

  if (!market || !outcome) {
    return (
      <div className="min-h-screen bg-poly-bg flex items-center justify-center">
        <p className="text-white">Outcome not found</p>
      </div>
    );
  }

  const yesPrice = Math.round(outcome.price * 100);
  const noPrice = 100 - yesPrice;
  const timeRanges = ["1H", "6H", "1D", "1W", "1M", "ALL"];

  const firstPrice = priceHistory[0] || outcome.price;
  const currentPrice = priceHistory[priceHistory.length - 1] || outcome.price;
  const priceChange = currentPrice - firstPrice;
  const priceChangePercent = Math.round((priceChange / firstPrice) * 100);
  const isUp = priceChange >= 0;

  const displayPrice = activeIndex !== null && priceHistory[activeIndex] ? priceHistory[activeIndex] : currentPrice;
  const formatPrice = (price: number) => `${Math.round(price * 100)}%`;
  const formatMoney = (amount: number) =>
    `$${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.2 }}
      className="min-h-screen bg-poly-bg pb-24"
    >
      {/* Top Header - Polymarket style: back button left, volume + icons right */}
      <div
        className={`px-4 py-3 flex items-center justify-between transition-all duration-300 ${
          isLoaded ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-4"
        }`}
      >
        <button
          onClick={() => navigate(-1)}
          className="w-10 h-10 flex items-center justify-center rounded-full border border-[#3a4f60] hover:bg-poly-surface transition-colors"
        >
          <ChevronLeft size={22} color="#e8ecf0" strokeWidth={2} />
        </button>

        <div className="flex items-center gap-3">
          <span className="text-[#8297a3] text-sm">{outcome.volume} Vol.</span>
          <button className="p-1.5 hover:opacity-70 transition-opacity">
            <Bookmark size={20} color="#8297a3" strokeWidth={2} />
          </button>
          <button className="p-1.5 hover:opacity-70 transition-opacity">
            <Link2 size={20} color="#8297a3" strokeWidth={2} />
          </button>
        </div>
      </div>

      <div className="overflow-y-auto">
        {/* Outcome Title */}
        <div
          className={`px-4 pb-1 flex items-center transition-all duration-300 delay-100 ${
            isLoaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
          }`}
        >
          <img
            src="https://upload.wikimedia.org/wikipedia/commons/thumb/1/1a/Seal_of_the_United_States_Federal_Reserve_System.svg/200px-Seal_of_the_United_States_Federal_Reserve_System.svg.png"
            alt=""
            className="w-10 h-10 rounded-full mr-3 object-cover bg-poly-surface"
          />
          <div className="flex-1 flex items-center justify-between">
            <span className="text-white text-base">{outcome.name}</span>
            <button className="hover:opacity-70">
              <Code2 size={16} color="#5c6b7a" strokeWidth={2.5} />
            </button>
          </div>
        </div>

        {/* Price with Change + Polymarket watermark */}
        <div
          className={`px-4 pb-4 flex items-center justify-between transition-all duration-300 delay-150 ${
            isLoaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
          }`}
        >
          <div className="flex items-baseline">
            <span className="text-2xl text-[#60a5fa] font-medium">{formatPrice(displayPrice)} chance</span>
            <span className={`text-sm ml-2 font-medium ${isUp ? "text-[#3dac67]" : "text-[#e13836]"}`}>
              {isUp ? "▲" : "▼"}{Math.abs(priceChangePercent)}%
            </span>
          </div>
          {/* Polymarket watermark */}
          <div className="flex items-center gap-2 opacity-60">
            <svg width="24" height="24" viewBox="0 0 512 512" fill="none">
              <path d="M375.84 389.422C375.84 403.572 375.84 410.647 371.212 414.154C366.585 417.662 359.773 415.75 346.15 411.927L127.22 350.493C119.012 348.19 114.907 347.038 112.534 343.907C110.161 340.776 110.161 336.513 110.161 327.988V184.012C110.161 175.487 110.161 171.224 112.534 168.093C114.907 164.962 119.012 163.81 127.22 161.507L346.15 100.072C359.773 96.2495 366.585 94.338 371.212 97.8455C375.84 101.353 375.84 108.428 375.84 122.578V389.422ZM164.761 330.463L346.035 381.337V279.595L164.761 330.463ZM139.963 306.862L321.201 256L139.963 205.138V306.862ZM164.759 181.537L346.035 232.406V130.663L164.759 181.537Z" fill="white"/>
            </svg>
            <span className="text-white text-lg font-medium">Polymarket</span>
          </div>
        </div>

        {/* Chart */}
        <div
          className={`px-4 mb-4 transition-all duration-500 delay-200 ${
            isLoaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
          }`}
        >
          <div className="flex items-start">
            <div
              className="relative cursor-crosshair flex-1"
              style={{ height: CHART_HEIGHT }}
              onMouseMove={handleMouseMove}
              onMouseLeave={() => setActiveIndex(null)}
            >
              <svg width="100%" height={CHART_HEIGHT} viewBox={`0 0 ${chartWidth} ${CHART_HEIGHT}`} preserveAspectRatio="none">
                {/* Horizontal dotted grid lines - tiny dots with large gaps */}
                {[0, 0.25, 0.5, 0.75, 1].map((pct) => (
                  <line
                    key={pct}
                    x1={0}
                    y1={CHART_HEIGHT * (1 - pct)}
                    x2={chartWidth}
                    y2={CHART_HEIGHT * (1 - pct)}
                    stroke="#3d4f5f"
                    strokeWidth={2}
                    strokeDasharray="1,12"
                    strokeLinecap="round"
                  />
                ))}
                {/* Chart line - smooth curves, light blue */}
                {chartPath.pathD && (
                  <path
                    d={chartPath.pathD}
                    stroke="#60a5fa"
                    strokeWidth={1.5}
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    vectorEffect="non-scaling-stroke"
                  />
                )}
                {/* Pulsating end point */}
                {chartPath.lastPoint && (
                  <>
                    {/* Outer pulsating ring */}
                    <circle
                      cx={chartPath.lastPoint.x}
                      cy={chartPath.lastPoint.y}
                      r={8}
                      fill="#60a5fa"
                    >
                      <animate
                        attributeName="r"
                        values="5;12;5"
                        dur="1.5s"
                        repeatCount="indefinite"
                      />
                      <animate
                        attributeName="opacity"
                        values="0.5;0;0.5"
                        dur="1.5s"
                        repeatCount="indefinite"
                      />
                    </circle>
                    {/* Inner solid dot */}
                    <circle
                      cx={chartPath.lastPoint.x}
                      cy={chartPath.lastPoint.y}
                      r={4}
                      fill="#60a5fa"
                    />
                  </>
                )}
                {/* Hover point */}
                {activeIndex !== null && chartPath.points[activeIndex] && (
                  <circle
                    cx={chartPath.points[activeIndex].x}
                    cy={chartPath.points[activeIndex].y}
                    r={4}
                    fill="#60a5fa"
                    stroke="#1c2b3a"
                    strokeWidth={2}
                  />
                )}
              </svg>

              {/* Hover tooltip */}
              {activeIndex !== null && chartPath.points[activeIndex] && (
                <>
                  <div
                    className="absolute top-0 w-px bg-[#5c6b7a] pointer-events-none"
                    style={{ left: `${(chartPath.points[activeIndex].x / chartWidth) * 100}%`, height: CHART_HEIGHT }}
                  />
                  <div
                    className="absolute bg-[#2a3d4e] border border-[#3a4f60] rounded-lg px-3 py-2 pointer-events-none"
                    style={{
                      left: `${Math.min(Math.max((chartPath.points[activeIndex].x / chartWidth) * 100 - 10, 0), 80)}%`,
                      top: Math.max(chartPath.points[activeIndex].y - 50, 0),
                    }}
                  >
                    <span className="text-white text-xs font-medium">
                      {formatPrice(chartPath.points[activeIndex].price)}
                    </span>
                  </div>
                </>
              )}
            </div>

            {/* Y-axis labels */}
            <div className="ml-2 flex flex-col justify-between shrink-0" style={{ height: CHART_HEIGHT }}>
              <span className="text-[#6b7a8a] text-xs">100%</span>
              <span className="text-[#6b7a8a] text-xs">75%</span>
              <span className="text-[#6b7a8a] text-xs">50%</span>
              <span className="text-[#6b7a8a] text-xs">25%</span>
              <span className="text-[#6b7a8a] text-xs">0%</span>
            </div>
          </div>

          {/* X-axis labels */}
          <div className="flex justify-between mt-2 pr-12">
            <span className="text-[#6b7a8a] text-xs">Sep</span>
            <span className="text-[#6b7a8a] text-xs">Oct</span>
            <span className="text-[#6b7a8a] text-xs">Nov</span>
            <span className="text-[#6b7a8a] text-xs">Dec</span>
          </div>
        </div>

        {/* Time Range Selector */}
        <div
          className={`px-4 pb-5 transition-all duration-300 delay-300 ${
            isLoaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {timeRanges.map((range) => (
                <button
                  key={range}
                  onClick={() => setTimeRange(range)}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    timeRange === range
                      ? "bg-[#3d4f5f] text-white"
                      : "text-[#6b7a8a] hover:text-white"
                  }`}
                >
                  {range}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-3">
              {/* Expand icon */}
              <button className="p-1.5 hover:opacity-70">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6b7a8a" strokeWidth={2}>
                  <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
              {/* Settings icon */}
              <button className="p-1.5 hover:opacity-70">
                <Settings size={20} color="#6b7a8a" strokeWidth={2} />
              </button>
            </div>
          </div>
        </div>

        {/* Order Book */}
        {orderBook && (
          <div
            className={`px-4 mb-4 transition-all duration-300 delay-400 ${
              isLoaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
            }`}
          >
            <div className="rounded-2xl border-2 border-[#2c3f4f]">
              {/* Header */}
              <button
                onClick={() => setOrderBookExpanded(!orderBookExpanded)}
                className="w-full px-4 py-4 flex items-center justify-between hover:opacity-80 transition-opacity"
              >
                <div className="flex items-center gap-2">
                  <span className="text-white text-xl font-bold">Order Book</span>
                  <HelpCircle size={18} color="#6E7681" strokeWidth={2.5} />
                </div>
                <ChevronDown
                  size={22}
                  color="#8297a3"
                  strokeWidth={2.5}
                  className={`transition-transform duration-200 ${orderBookExpanded ? "rotate-180" : ""}`}
                />
              </button>

              {orderBookExpanded && (
                <>
                  {/* Trade tabs */}
                  <div className="flex items-center px-4 pb-3 border-b-2 border-[#2c3f4f]">
                    <div className="flex gap-6 flex-1">
                      <button
                        onClick={() => setTradeTab("yes")}
                        className={`relative pb-2 transition-colors ${tradeTab === "yes" ? "text-white" : "text-[#6b7a8a]"}`}
                      >
                        <span className={`text-base ${tradeTab === "yes" ? "font-bold" : "font-medium"}`}>Trade Yes</span>
                        {tradeTab === "yes" && (
                          <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white rounded-full" />
                        )}
                      </button>
                      <button
                        onClick={() => setTradeTab("no")}
                        className={`relative pb-2 transition-colors ${tradeTab === "no" ? "text-white" : "text-[#6b7a8a]"}`}
                      >
                        <span className={`text-base ${tradeTab === "no" ? "font-bold" : "font-medium"}`}>Trade No</span>
                        {tradeTab === "no" && (
                          <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white rounded-full" />
                        )}
                      </button>
                    </div>
                    <div className="flex items-center gap-3">
                      <button className="p-1.5 hover:bg-poly-surface rounded-lg transition-colors">
                        <Trash2 size={20} color="#6b7a8a" strokeWidth={2.5} />
                      </button>
                      <button className="p-1.5 hover:bg-poly-surface rounded-lg transition-colors">
                        <RefreshCw size={20} color="#6b7a8a" strokeWidth={2.5} />
                      </button>
                    </div>
                  </div>

                  {/* Order book header */}
                  <div className="flex items-center px-4 py-3 border-b-2 border-[#2c3f4f]">
                    <div className="w-[140px]">
                      <span className="text-[#6b7a8a] text-xs font-semibold uppercase tracking-wider">
                        Trade {tradeTab === "yes" ? "Yes" : "No"}
                      </span>
                    </div>
                    <span className="text-[#6b7a8a] text-xs font-semibold uppercase tracking-wider w-20 text-center">Price</span>
                    <span className="text-[#6b7a8a] text-xs font-semibold uppercase tracking-wider flex-1 text-right">Shares</span>
                    <span className="text-[#6b7a8a] text-xs font-semibold uppercase tracking-wider w-28 text-right">Total</span>
                  </div>

                  {/* Asks */}
                  <div className="relative max-h-[240px] overflow-y-auto">
                    {orderBook.asks.map((ask, i) => {
                      const maxShares = Math.max(...orderBook.asks.map((a) => a.shares));
                      const barWidth = (ask.shares / maxShares) * 100;
                      const showLabel = i === orderBook.asks.length - 1;
                      return (
                        <div
                          key={`ask-${i}`}
                          className="flex items-center px-4 py-2 relative cursor-pointer hover:bg-[rgba(239,68,68,0.1)] transition-colors"
                        >
                          <div
                            className="absolute left-0 top-0 bottom-0 bg-[rgba(239,68,68,0.2)] pointer-events-none"
                            style={{ width: `${Math.min(barWidth * 0.5, 50)}%` }}
                          />
                          {showLabel && (
                            <div className="absolute left-3 top-1/2 -translate-y-1/2 z-20">
                              <span className="px-2.5 py-1 rounded text-xs font-semibold bg-[#ef4444] text-white">Asks</span>
                            </div>
                          )}
                          <div className="w-[140px]" />
                          <span className="text-[#ef4444] text-sm w-20 text-center font-semibold relative z-10 tabular-nums">{ask.price}¢</span>
                          <span className="text-[#8b98a5] text-sm flex-1 text-right relative z-10 tabular-nums">
                            {ask.shares.toLocaleString()}
                          </span>
                          <span className="text-[#8b98a5] text-sm w-28 text-right relative z-10 tabular-nums">
                            {formatMoney(ask.total)}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  {/* Spread */}
                  <div className="flex items-center px-4 py-3 border-y-2 border-[#2c3f4f]">
                    <span className="text-[#8b98a5] text-sm font-medium tabular-nums">Last: {orderBook.lastPrice}¢</span>
                    <span className="text-[#8b98a5] text-sm font-medium ml-auto tabular-nums">Spread: {orderBook.spread}¢</span>
                  </div>

                  {/* Bids */}
                  <div className="relative max-h-[240px] overflow-y-auto">
                    {orderBook.bids.map((bid, i) => {
                      const maxShares = Math.max(...orderBook.bids.map((b) => b.shares));
                      const barWidth = (bid.shares / maxShares) * 100;
                      const showLabel = i === 0;
                      return (
                        <div
                          key={`bid-${i}`}
                          className="flex items-center px-4 py-2 relative cursor-pointer hover:bg-[rgba(34,197,94,0.1)] transition-colors"
                        >
                          <div
                            className="absolute left-0 top-0 bottom-0 bg-[rgba(34,197,94,0.2)] pointer-events-none"
                            style={{ width: `${Math.min(barWidth * 0.5, 50)}%` }}
                          />
                          {showLabel && (
                            <div className="absolute left-3 top-1/2 -translate-y-1/2 z-20">
                              <span className="px-2.5 py-1 rounded text-xs font-semibold bg-[#22c55e] text-black">Bids</span>
                            </div>
                          )}
                          <div className="w-[140px]" />
                          <span className="text-[#22c55e] text-sm w-20 text-center font-semibold relative z-10 tabular-nums">{bid.price}¢</span>
                          <span className="text-[#8b98a5] text-sm flex-1 text-right relative z-10 tabular-nums">
                            {bid.shares.toLocaleString()}
                          </span>
                          <span className="text-[#8b98a5] text-sm w-28 text-right relative z-10 tabular-nums">
                            {formatMoney(bid.total)}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  {/* Bottom padding */}
                  <div className="h-2" />
                </>
              )}
            </div>
          </div>
        )}

        {/* Rules */}
        <div
          className={`px-4 mb-6 transition-all duration-300 delay-500 ${
            isLoaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
          }`}
        >
          <h3 className="text-white text-base mb-2">Rules</h3>
          <p className="text-poly-textSecondary text-sm leading-5">
            This market will resolve according to the next individual appointed to be Chair of the Federal Reserve by
            the President of the United States.
          </p>
        </div>
      </div>

      {/* Bottom Buy Buttons - Polymarket style with more button */}
      <div
        className={`fixed bottom-0 left-0 right-0 px-4 py-4 z-40 transition-all duration-300 delay-600 ${
          isLoaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
        }`}
        style={{ backgroundColor: '#1c2b3a' }}
      >
        <div className="flex gap-2 max-w-lg mx-auto">
          <button
            onClick={() => {
              setTradeType("yes");
              setShowTradingSheet(true);
            }}
            className="flex-1 bg-[#4abe7a] rounded-lg py-4 text-white text-base font-bold hover:bg-[#3dac67] transition-colors"
          >
            Buy Yes {yesPrice}¢
          </button>
          <button
            onClick={() => {
              setTradeType("no");
              setShowTradingSheet(true);
            }}
            className="flex-1 bg-[#e5534b] rounded-lg py-4 text-white text-base font-bold hover:bg-[#d9453d] transition-colors"
          >
            Buy No {noPrice}¢
          </button>
          <button className="w-14 bg-[#3d4f5f] rounded-lg py-4 flex items-center justify-center hover:bg-[#4d5f6f] transition-colors">
            <MoreHorizontal size={24} color="white" strokeWidth={2} />
          </button>
        </div>
      </div>

      {/* Trading Sheet */}
      {market && (
        <TradingSheet
          market={market}
          selectedOutcome={outcome}
          isVisible={showTradingSheet}
          onClose={() => setShowTradingSheet(false)}
          initialType={tradeType}
        />
      )}
    </motion.div>
  );
}
