import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ChevronLeft,
  Link2,
  Bookmark,
  Code2,
  Settings,
} from "lucide-react";
import { TradingSheet } from "./TradingSheet";
import { LiveOrderBook } from "./LiveOrderBook";
import { mockMarkets } from "./mockData";
import { usePolymarkets } from "../hooks/usePolymarkets";
import { LATEST_REAL_PRICES } from "./realPriceData";

const CHART_HEIGHT = 220;
const CHART_PADDING_RIGHT = 50;

// Seeded random for consistent data
const seededRandom = (seed: number) => {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
};

// Generate realistic step-like price history (like actual trading data)
const generatePriceHistory = (
  outcomeId: string,
  currentPrice: number,  // Chart must end here
  numPoints: number
) => {
  const seed = outcomeId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const prices: number[] = [];

  const endPrice = Math.max(0.05, Math.min(0.95, currentPrice));

  // Determine starting price based on pattern
  const patternType = seed % 6;
  let startPrice: number;

  switch (patternType) {
    case 0: startPrice = Math.max(0.08, endPrice - 0.12 - seededRandom(seed) * 0.15); break;
    case 1: startPrice = Math.min(0.92, endPrice + 0.12 + seededRandom(seed) * 0.15); break;
    case 2: startPrice = endPrice + (seededRandom(seed) - 0.5) * 0.2; break;
    case 3: startPrice = endPrice * 0.6; break;
    case 4: startPrice = Math.min(0.9, endPrice * 1.4); break;
    default: startPrice = endPrice + (seededRandom(seed) - 0.5) * 0.1;
  }
  startPrice = Math.max(0.05, Math.min(0.95, startPrice));

  // Generate step changes like real trading
  const numSteps = 15 + Math.floor(seededRandom(seed * 7) * 20);
  const stepPoints: { t: number; price: number }[] = [];

  stepPoints.push({ t: 0, price: startPrice });

  let currentStepPrice = startPrice;
  for (let s = 1; s < numSteps; s++) {
    const t = s / numSteps;
    const targetAtT = startPrice + (endPrice - startPrice) * t;

    const jumpSize = (seededRandom(seed * 100 + s) - 0.5) * 0.15;
    const drift = (targetAtT - currentStepPrice) * 0.3;

    const spikeChance = seededRandom(seed * 200 + s);
    let spike = 0;
    if (spikeChance > 0.92) spike = 0.1 + seededRandom(seed * 300 + s) * 0.15;
    else if (spikeChance < 0.08) spike = -(0.1 + seededRandom(seed * 300 + s) * 0.15);

    currentStepPrice = currentStepPrice + jumpSize + drift + spike;
    currentStepPrice = Math.max(0.03, Math.min(0.97, currentStepPrice));

    const stepT = t + (seededRandom(seed * 400 + s) - 0.5) * 0.05;
    stepPoints.push({ t: Math.max(0.01, Math.min(0.99, stepT)), price: currentStepPrice });
  }

  stepPoints.push({ t: 1, price: endPrice });
  stepPoints.sort((a, b) => a.t - b.t);

  // Generate price array with step-like behavior
  let stepIndex = 0;
  for (let i = 0; i < numPoints; i++) {
    const t = i / (numPoints - 1);

    while (stepIndex < stepPoints.length - 1 && stepPoints[stepIndex + 1].t <= t) {
      stepIndex++;
    }

    let price = stepPoints[stepIndex].price;
    const microNoise = (seededRandom(seed * 5000 + i) - 0.5) * 0.008;
    price += microNoise;
    price = Math.max(0.03, Math.min(0.97, price));

    if (i === numPoints - 1) price = endPrice;
    prices.push(price);
  }

  return prices;
};

// Generate path with straight lines (matches PolyChart)
const generatePath = (points: { x: number; y: number }[]): string => {
  if (points.length < 2) return "";

  let path = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    path += ` L ${points[i].x} ${points[i].y}`;
  }
  return path;
};

export function OutcomeDetail() {
  const { marketId, outcomeId } = useParams<{ marketId: string; outcomeId: string }>();
  const navigate = useNavigate();

  const [timeRange, setTimeRange] = useState("ALL");
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [showTradingSheet, setShowTradingSheet] = useState(false);
  const [tradeType, setTradeType] = useState<"yes" | "no">("yes");
  const [_isTouching, setIsTouching] = useState(false);
  const chartRef = useRef<HTMLDivElement>(null);

  // Get trading functions from hook
  const {
    getMarket,
    buyYes,
    buyNo,
    sellYes,
    sellNo,
    buyOutcome,
    sellOutcome,
    loading: marketsLoading,
  } = usePolymarkets();

  useEffect(() => {
    const timer = setTimeout(() => setIsLoaded(true), 100);
    return () => clearTimeout(timer);
  }, []);

  // Try to find market from on-chain data first, then fall back to mock data
  const market = useMemo(() => {
    const onChainMarket = getMarket(marketId || "");
    if (onChainMarket) return onChainMarket;
    return mockMarkets.find((m) => m.id === marketId);
  }, [marketId, getMarket]);

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

  // Use REAL Polymarket prices for this outcome - map "Other" to "Donald Trump Jr."
  const realPrice = useMemo(() => {
    if (!outcome) return 0;
    const lookupName = outcome.name === "Other" ? "Donald Trump Jr." : outcome.name;
    return LATEST_REAL_PRICES[lookupName] || LATEST_REAL_PRICES[outcome.name] || outcome.price;
  }, [outcome]);

  const priceHistory = useMemo(() => {
    if (!outcome) return [];
    return generatePriceHistory(outcome.id, realPrice, numPoints);
  }, [outcome, realPrice, numPoints]);

  const innerWidth = chartWidth - CHART_PADDING_RIGHT;

  // Calculate dynamic Y-axis range based on price data
  const { yMin, yMax, yLabels } = useMemo(() => {
    if (priceHistory.length === 0) return { yMin: 0, yMax: 1, yLabels: ['100%', '75%', '50%', '25%', '0%'] };

    const prices = priceHistory;
    const dataMin = Math.min(...prices);
    const dataMax = Math.max(...prices);
    const range = dataMax - dataMin;
    const padding = Math.max(0.05, range * 0.15); // At least 5% padding, or 15% of range

    let yMin = Math.max(0, dataMin - padding);
    let yMax = Math.min(1, dataMax + padding);

    // Round to nice values (multiples of 5%)
    yMin = Math.floor(yMin * 20) / 20;
    yMax = Math.ceil(yMax * 20) / 20;

    // Ensure minimum range of 20%
    if (yMax - yMin < 0.2) {
      const center = (yMin + yMax) / 2;
      yMin = Math.max(0, center - 0.1);
      yMax = Math.min(1, center + 0.1);
    }

    // Generate 5 labels evenly spaced
    const yLabels = [];
    for (let i = 0; i < 5; i++) {
      const val = yMax - (i / 4) * (yMax - yMin);
      yLabels.push(`${Math.round(val * 100)}%`);
    }

    return { yMin, yMax, yLabels };
  }, [priceHistory]);

  const chartPath = useMemo(() => {
    if (priceHistory.length === 0) return { pathD: "", points: [], lastPoint: null };

    const points = priceHistory.map((price, i) => {
      const x = (i / Math.max(1, priceHistory.length - 1)) * innerWidth;
      // Map price to Y coordinate using dynamic range
      const normalizedPrice = (price - yMin) / (yMax - yMin);
      const y = CHART_HEIGHT - normalizedPrice * CHART_HEIGHT;
      return { x, y, price };
    });

    const pathD = generatePath(points);
    const lastPoint = points[points.length - 1];

    return { pathD, points, lastPoint };
  }, [priceHistory, innerWidth, yMin, yMax]);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const x = Math.max(0, Math.min(chartWidth, e.clientX - rect.left));
      const idx = Math.round((x / chartWidth) * (numPoints - 1));
      setActiveIndex(Math.max(0, Math.min(numPoints - 1, idx)));
    },
    [numPoints, chartWidth]
  );

  // Touch handlers for mobile
  const updatePositionFromX = useCallback(
    (clientX: number) => {
      if (!chartRef.current) return;
      const rect = chartRef.current.getBoundingClientRect();
      const x = Math.max(0, Math.min(chartWidth, clientX - rect.left));
      const idx = Math.round((x / chartWidth) * (numPoints - 1));
      setActiveIndex(Math.max(0, Math.min(numPoints - 1, idx)));
    },
    [chartWidth, numPoints]
  );

  const handleTouchStart = useCallback(
    (e: React.TouchEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsTouching(true);
      if (e.touches.length > 0) {
        updatePositionFromX(e.touches[0].clientX);
      }
    },
    [updatePositionFromX]
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent<HTMLDivElement>) => {
      e.preventDefault();
      if (e.touches.length > 0) {
        updatePositionFromX(e.touches[0].clientX);
      }
    },
    [updatePositionFromX]
  );

  const handleTouchEnd = useCallback(() => {
    setIsTouching(false);
    setActiveIndex(null);
  }, []);

  // Prevent text selection and context menu on chart
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;

    const preventContextMenu = (e: Event) => e.preventDefault();
    const preventSelect = (e: Event) => e.preventDefault();

    chart.addEventListener("contextmenu", preventContextMenu);
    chart.addEventListener("selectstart", preventSelect);

    return () => {
      chart.removeEventListener("contextmenu", preventContextMenu);
      chart.removeEventListener("selectstart", preventSelect);
    };
  }, []);

  // Show loading skeleton while markets are loading
  if (!market || !outcome) {
    if (marketsLoading) {
      return (
        <div className="min-h-screen bg-poly-bg">
          <div className="px-4 py-3 flex items-center justify-between">
            <div className="w-10 h-10 rounded-full bg-poly-surface animate-pulse" />
            <div className="flex items-center gap-3">
              <div className="w-20 h-4 bg-poly-surface rounded animate-pulse" />
              <div className="w-6 h-6 bg-poly-surface rounded animate-pulse" />
            </div>
          </div>
          <div className="px-4 py-8">
            <div className="animate-pulse space-y-6">
              {/* Title skeleton */}
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-poly-surface" />
                <div className="h-5 bg-poly-surface rounded w-1/3" />
              </div>
              {/* Price skeleton */}
              <div className="h-8 bg-poly-surface rounded w-1/2" />
              {/* Chart skeleton */}
              <div className="h-[220px] bg-poly-surface rounded-lg" />
              {/* Time range skeleton */}
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div key={i} className="w-12 h-8 bg-poly-surface rounded" />
                ))}
              </div>
            </div>
          </div>
        </div>
      );
    }
    return (
      <div className="min-h-screen bg-poly-bg flex items-center justify-center">
        <p className="text-white">Outcome not found</p>
      </div>
    );
  }

  const timeRanges = ["1H", "6H", "1D", "1W", "1M", "ALL"];
  // Use real Polymarket prices for display
  const yesPrice = Math.round(realPrice * 100);
  const noPrice = 100 - yesPrice;
  const yesPriceDisplay = yesPrice < 10 ? `${(realPrice * 100).toFixed(1)}` : yesPrice.toString();
  const noPriceDisplay = noPrice < 10 ? `${(100 - realPrice * 100).toFixed(1)}` : noPrice.toString();

  // Map "Other" to "Donald Trump Jr." for display
  const displayName = outcome.name === "Other" ? "Donald Trump Jr." : outcome.name;

  // Calculate proportional volume based on outcome's share of market
  const parseVolume = (vol: string): number => {
    const num = parseFloat(vol.replace(/[$,]/g, ''));
    if (vol.includes('M')) return num * 1_000_000;
    if (vol.includes('K')) return num * 1_000;
    return num;
  };
  const totalVol = parseVolume(market?.volume || "0");
  const outcomeVol = totalVol * realPrice;
  const volumeDisplay = outcomeVol >= 1_000_000
    ? `$${(outcomeVol / 1_000_000).toFixed(1)}M`
    : outcomeVol >= 1_000
      ? `$${(outcomeVol / 1_000).toFixed(1)}K`
      : `$${Math.round(outcomeVol)}`;

  const firstPrice = priceHistory[0] || outcome.price;
  const currentPrice = priceHistory[priceHistory.length - 1] || outcome.price;
  const priceChange = currentPrice - firstPrice;
  const priceChangePercent = Math.round((priceChange / firstPrice) * 100);
  const isUp = priceChange >= 0;

  const displayPrice = activeIndex !== null && priceHistory[activeIndex] ? priceHistory[activeIndex] : currentPrice;
  const formatPrice = (price: number) => `${Math.round(price * 100)}%`;

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
          <span className="text-[#8297a3] text-sm">{volumeDisplay} Vol.</span>
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
            <span className="text-white text-base">{displayName}</span>
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
          <div className="flex items-center gap-2 opacity-30">
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
              ref={chartRef}
              className="relative cursor-crosshair flex-1 select-none"
              style={{
                height: CHART_HEIGHT,
                touchAction: 'none',
                WebkitUserSelect: 'none',
                WebkitTouchCallout: 'none',
                userSelect: 'none',
              } as React.CSSProperties}
              onMouseMove={handleMouseMove}
              onMouseLeave={() => setActiveIndex(null)}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
              onTouchCancel={handleTouchEnd}
            >
              <svg
                width={chartWidth}
                height={CHART_HEIGHT}
                style={{ touchAction: 'none', userSelect: 'none' }}
              >
                {/* Grid lines - more visible */}
                {[0, 0.25, 0.5, 0.75, 1].map((pct) => (
                  <line
                    key={pct}
                    x1={0}
                    y1={CHART_HEIGHT * (1 - pct)}
                    x2={chartWidth}
                    y2={CHART_HEIGHT * (1 - pct)}
                    stroke="#4a5568"
                    strokeWidth={1}
                    strokeDasharray="4,6"
                    opacity={0.5}
                  />
                ))}

                {/* Polymarket watermark - top right corner away from chart data */}
                <g opacity={0.15}>
                  <image
                    href="/images/icon-white.svg"
                    x={chartWidth - 120}
                    y={8}
                    width={20}
                    height={20}
                  />
                  <text
                    x={chartWidth - 96}
                    y={22}
                    fill="#ffffff"
                    fontSize={11}
                    fontWeight={500}
                    fontFamily="system-ui, -apple-system, sans-serif"
                  >
                    Polymarket
                  </text>
                </g>

                {/* Chart line - thicker stroke like PolyChart */}
                {chartPath.pathD && (
                  <path
                    d={chartPath.pathD}
                    stroke="#60a5fa"
                    strokeWidth={2.5}
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                )}

                {/* End point with pulsating animation - matches PolyChart */}
                {chartPath.lastPoint && (
                  <g>
                    {/* Pulsating outer ring */}
                    <circle cx={chartPath.lastPoint.x} cy={chartPath.lastPoint.y} r={8} fill="#60a5fa" opacity={0.3}>
                      <animate attributeName="r" values="5;12;5" dur="1.5s" repeatCount="indefinite" />
                      <animate attributeName="opacity" values="0.4;0;0.4" dur="1.5s" repeatCount="indefinite" />
                    </circle>
                    {/* Solid end point */}
                    <circle
                      cx={chartPath.lastPoint.x}
                      cy={chartPath.lastPoint.y}
                      r={5}
                      fill="#60a5fa"
                      stroke="#1c2b3a"
                      strokeWidth={2}
                    />
                  </g>
                )}
              </svg>

              {/* Cursor line - matches PolyChart */}
              {activeIndex !== null && chartPath.points[activeIndex] && (
                <div
                  className="absolute top-0 pointer-events-none"
                  style={{
                    left: chartPath.points[activeIndex].x,
                    height: CHART_HEIGHT,
                    width: 1,
                    backgroundColor: 'rgba(255, 255, 255, 0.6)',
                  }}
                />
              )}

              {/* Hover label - colored pill like PolyChart */}
              {activeIndex !== null && chartPath.points[activeIndex] && (
                <div
                  className="absolute px-2 py-1 rounded text-xs font-semibold pointer-events-none select-none"
                  style={{
                    top: chartPath.points[activeIndex].y - 12,
                    left: Math.min(chartPath.points[activeIndex].x + 12, chartWidth - 100),
                    backgroundColor: '#60a5fa',
                    color: '#fff',
                  }}
                >
                  {outcome?.name} {formatPrice(chartPath.points[activeIndex].price)}
                </div>
              )}
            </div>

            {/* Y-axis labels - dynamic based on data range */}
            <div className="ml-2 flex flex-col justify-between shrink-0" style={{ height: CHART_HEIGHT }}>
              {yLabels.map((label, i) => (
                <span key={i} className="text-[#6b7a8a] text-xs">{label}</span>
              ))}
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
        <div
          className={`px-4 mb-4 transition-all duration-300 delay-400 ${
            isLoaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
          }`}
        >
          <LiveOrderBook
            yesPrice={yesPrice}
            noPrice={noPrice}
            yesReserve={1000}
            noReserve={1000}
            trades={[]}
            isConnected={false}
          />
        </div>

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

      {/* Buy Yes / Buy No buttons - Fixed at very bottom */}
      <div
        className="fixed bottom-0 left-0 right-0 z-40 px-4 py-3 pb-safe"
        style={{ backgroundColor: '#1c2b3a', borderTop: '2px solid #2c3f4f' }}
      >
        <div className="max-w-lg mx-auto flex gap-3">
          <button
            onClick={() => {
              setTradeType("yes");
              setShowTradingSheet(true);
            }}
            className="flex-1 bg-[#3dac67] rounded-lg py-3.5 text-white text-base font-semibold hover:bg-[#359b5c] transition-colors"
          >
            Buy Yes {yesPriceDisplay}¢
          </button>
          <button
            onClick={() => {
              setTradeType("no");
              setShowTradingSheet(true);
            }}
            className="flex-1 bg-[#e13836] rounded-lg py-3.5 text-white text-base font-semibold hover:bg-[#c9312f] transition-colors"
          >
            Buy No {noPriceDisplay}¢
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
          onBuyYes={buyYes}
          onBuyNo={buyNo}
          onSellYes={sellYes}
          onSellNo={sellNo}
          onBuyOutcome={buyOutcome}
          onSellOutcome={sellOutcome}
        />
      )}
    </motion.div>
  );
}
