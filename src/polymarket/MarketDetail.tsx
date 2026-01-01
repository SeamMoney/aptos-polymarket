import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { Aptos, AptosConfig, Network } from "@aptos-labs/ts-sdk";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Link2, Bookmark, BarChart3, Sliders, Settings, Clock, ChevronUp, Wallet } from "lucide-react";
import { PolyHeader } from "./PolyHeader";
import { CategoryTabs } from "./CategoryTabs";
import { PolyChart } from "./PolyChart";
import { PRICE_HISTORY, TOP_CANDIDATES, CANDIDATE_COLORS, getCandidatePrices } from "./priceData";
import { TradingSheet } from "./TradingSheet";
import { LiveOrderBook } from "./LiveOrderBook";
import { TradeFeed } from "./TradeFeed";
import { TPSChart } from "./TPSChart";
import { AptosComparison } from "./AptosComparison";
import { ConsensusVisualizer } from "./ConsensusVisualizer";
import { SpeedComparison } from "./SpeedComparison";
import { mockMarkets, categories } from "./mockData";
import { usePolymarkets } from "../hooks/usePolymarkets";
import { useHFTConnection } from "../hooks/useHFTConnection";
import { useLivePrices, TIMEFRAMES } from "../hooks/useLivePrices";
import type { Category, Outcome } from "./types";

// Initialize Aptos client for TVL fetching
const aptos = new Aptos(new AptosConfig({ network: Network.TESTNET }));

// Contract addresses
const CONTRACT_ADDRESS = "0xa2e5e47aab07fed78a3bcf95135ee2dad20c547499c94cb16a3e047859ffa7e1";
const MARKET_ADDRESS = "0xfefd1b67818ee4ef12a7953852c83f0efb411a9b92c518a52ba92555e4abdd96";

const timeRanges = ["1H", "6H", "1D", "1W", "1M", "ALL"];

export function MarketDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const titleRef = useRef<HTMLDivElement>(null);

  const [selectedCategory, setSelectedCategory] = useState<Category>("All");
  const [timeRange, setTimeRange] = useState("ALL");
  const [selectedOutcome, setSelectedOutcome] = useState<Outcome | null>(null);
  const [showTradingSheet, setShowTradingSheet] = useState(false);
  const [tradeType, setTradeType] = useState<"yes" | "no">("yes");
  const [_activeIndex, setActiveIndex] = useState<number | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [showStickyTitle, setShowStickyTitle] = useState(false);
  const [highlightedOutcomeId, setHighlightedOutcomeId] = useState<string | null>(null);
  const [tvl, setTvl] = useState<number | null>(null);

  // Fetch TVL from contract
  const fetchTVL = useCallback(async () => {
    try {
      const result = await aptos.view({
        payload: {
          function: `${CONTRACT_ADDRESS}::multi_outcome_market::get_multi_market_info`,
          typeArguments: [],
          functionArguments: [MARKET_ADDRESS],
        },
      });
      // Result: [question, description, category, outcome_count, end_time, resolved, winning_outcome, total_collateral]
      const totalCollateral = parseInt(result[7] as string);
      setTvl(totalCollateral / 100_000_000); // Convert from octas to APT
    } catch (error) {
      console.error("Error fetching TVL:", error);
    }
  }, []);

  // Fetch TVL on mount and periodically
  useEffect(() => {
    fetchTVL();
    const interval = setInterval(fetchTVL, 10000); // Refresh every 10 seconds
    return () => clearInterval(interval);
  }, [fetchTVL]);

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

  // HFT connection for live demo
  const {
    isConnected: hftConnected,
    isRunning: hftRunning,
    stats: hftStats,
    marketInfo: hftMarketInfo,
    marketReserves: hftReserves,
    trades: hftTrades,
    tpsHistory,
  } = useHFTConnection();

  // Live price tracking for real-time chart updates
  const {
    currentPrices: _livePrices,
    priceHistory: livePriceHistory,
    isConnected: _pricesConnected,
  } = useLivePrices(3000); // Poll every 3 seconds

  // Try to find market from on-chain data first, then fall back to mock data
  const market = useMemo(() => {
    const onChainMarket = getMarket(id || "");
    if (onChainMarket) return onChainMarket;
    return mockMarkets.find((m) => m.id === id);
  }, [id, getMarket]);

  // Animate in on mount
  useEffect(() => {
    const timer = setTimeout(() => setIsLoaded(true), 50);
    return () => clearTimeout(timer);
  }, []);

  // Handle scroll for sticky header
  useEffect(() => {
    const handleScroll = () => {
      if (titleRef.current) {
        const rect = titleRef.current.getBoundingClientRect();
        setShowStickyTitle(rect.bottom < 100);
      }
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Use real Polymarket price data for chart
  const chartOutcomes = useMemo(() => {
    // Check if this is the VP nominee market (has matching candidates)
    const isVPMarket = market?.outcomes?.some(o =>
      TOP_CANDIDATES.includes(o.name)
    );

    // For shorter timeframes with live data, use live price history
    const useLiveData = timeRange !== 'ALL' && livePriceHistory.length > 10;

    if (isVPMarket && market?.outcomes) {
      if (useLiveData) {
        // Use live price data for shorter timeframes
        const timeframeMs = TIMEFRAMES[timeRange as keyof typeof TIMEFRAMES] || Infinity;
        const cutoff = Date.now() - timeframeMs;
        const relevantHistory = livePriceHistory.filter(p => p.timestamp >= cutoff);

        // Need at least a few points
        if (relevantHistory.length >= 5) {
          return TOP_CANDIDATES.map((candidateName, idx) => {
            const outcome = market.outcomes?.find(o => o.name === candidateName);
            const prices = relevantHistory.map(p => p.prices[idx] || 0);

            return {
              id: candidateName.toLowerCase().replace(/\s+/g, '-'),
              name: candidateName,
              color: CANDIDATE_COLORS[candidateName] || outcome?.color || "#666",
              prices,
            };
          });
        }
      }

      // Use historical data with volatility for ALL timeframe
      return TOP_CANDIDATES.map((candidateName) => {
        const outcome = market.outcomes?.find(o => o.name === candidateName);
        const prices = getCandidatePrices(candidateName); // Uses volatility function

        return {
          id: candidateName.toLowerCase().replace(/\s+/g, '-'),
          name: candidateName,
          color: CANDIDATE_COLORS[candidateName] || outcome?.color || "#666",
          prices,
        };
      });
    }

    // Fallback for other markets - use synthetic data with aggressive volatility
    if (market?.outcomes && market.outcomes.length > 0) {
      // Seeded random for consistent charts
      const seededRandom = (seed: number) => {
        const x = Math.sin(seed * 12345.6789) * 43758.5453;
        return x - Math.floor(x);
      };

      return market.outcomes.map((outcome, outcomeIdx) => {
        const numPoints = 100;
        const prices: number[] = [];
        const endPrice = outcome.price;
        const seed = outcome.id.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0) + outcomeIdx;

        // Start with variance from end price
        let currentPrice = endPrice + (seededRandom(seed) - 0.5) * 0.2;

        // More aggressive volatility - bigger swings for smaller prices
        const baseVolatility = Math.min(0.12, Math.max(0.04, endPrice * 0.25));
        const volatilityBoost = endPrice < 0.1 ? 2.5 : endPrice < 0.3 ? 1.5 : 1.0;
        const volatility = baseVolatility * volatilityBoost;

        // Pre-generate news events for this outcome
        const newsIndices = new Set<number>();
        for (let n = 0; n < 15; n++) {
          newsIndices.add(Math.floor(seededRandom(seed * 500 + n) * numPoints));
        }

        for (let i = 0; i < numPoints; i++) {
          const targetAtT = currentPrice + (endPrice - currentPrice) * 0.05;

          // More dramatic random jumps
          const jump = (seededRandom(seed * 1000 + i) - 0.5) * volatility * 1.5;

          // More frequent spikes with bigger magnitude
          let spike = 0;
          if (newsIndices.has(i)) {
            // Big news event spike
            const spikeDir = seededRandom(seed * 17 + i) > 0.5 ? 1 : -1;
            spike = spikeDir * volatility * (2.0 + seededRandom(seed * 19 + i) * 2.0);
          } else {
            const spikeRoll = seededRandom(seed * 2000 + i);
            if (spikeRoll > 0.85) spike = volatility * 1.2;
            else if (spikeRoll < 0.15) spike = -volatility * 1.2;
          }

          // Higher step probability (80%)
          if (seededRandom(seed * 3000 + i) > 0.2) {
            currentPrice = currentPrice + jump + (targetAtT - currentPrice) * 0.05 + spike;
          }

          // Allow wider price range
          const minBound = Math.max(0.01, endPrice * 0.4);
          const maxBound = Math.min(0.99, endPrice * 2.0);
          currentPrice = Math.max(minBound, Math.min(maxBound, currentPrice));

          // Gently blend to end price
          if (i >= numPoints - 5) {
            const blend = (i - (numPoints - 5)) / 4;
            currentPrice = currentPrice * (1 - blend * 0.5) + endPrice * (blend * 0.5);
          }

          prices.push(currentPrice);
        }
        prices[numPoints - 1] = endPrice;

        return {
          id: outcome.id,
          name: outcome.name,
          color: outcome.color,
          prices,
        };
      });
    }

    // Handle binary markets with aggressive volatility
    if (market?.yesPrice !== undefined) {
      const seededRandom = (seed: number) => {
        const x = Math.sin(seed * 12345.6789) * 43758.5453;
        return x - Math.floor(x);
      };

      const generateVolatilePrices = (endPrice: number, seed: number) => {
        const numPoints = 100;
        const prices: number[] = [];
        let currentPrice = endPrice + (seededRandom(seed) - 0.5) * 0.2;

        // Aggressive volatility
        const baseVolatility = Math.min(0.12, Math.max(0.04, endPrice * 0.25));
        const volatilityBoost = endPrice < 0.1 ? 2.5 : endPrice < 0.3 ? 1.5 : 1.0;
        const volatility = baseVolatility * volatilityBoost;

        // News events
        const newsIndices = new Set<number>();
        for (let n = 0; n < 15; n++) {
          newsIndices.add(Math.floor(seededRandom(seed * 500 + n) * numPoints));
        }

        for (let i = 0; i < numPoints; i++) {
          const jump = (seededRandom(seed * 1000 + i) - 0.5) * volatility * 1.5;
          let spike = 0;

          if (newsIndices.has(i)) {
            const spikeDir = seededRandom(seed * 17 + i) > 0.5 ? 1 : -1;
            spike = spikeDir * volatility * (2.0 + seededRandom(seed * 19 + i) * 2.0);
          } else {
            const spikeRoll = seededRandom(seed * 2000 + i);
            if (spikeRoll > 0.85) spike = volatility * 1.2;
            else if (spikeRoll < 0.15) spike = -volatility * 1.2;
          }

          if (seededRandom(seed * 3000 + i) > 0.2) {
            currentPrice = currentPrice + jump + (endPrice - currentPrice) * 0.05 + spike;
          }

          const minBound = Math.max(0.01, endPrice * 0.4);
          const maxBound = Math.min(0.99, endPrice * 2.0);
          currentPrice = Math.max(minBound, Math.min(maxBound, currentPrice));

          if (i >= numPoints - 5) {
            const blend = (i - (numPoints - 5)) / 4;
            currentPrice = currentPrice * (1 - blend * 0.5) + endPrice * (blend * 0.5);
          }
          prices.push(currentPrice);
        }
        prices[numPoints - 1] = endPrice;
        return prices;
      };

      return [
        {
          id: "yes",
          name: "Yes",
          color: "#4abe7a",
          prices: generateVolatilePrices(market.yesPrice, 12345),
        },
        {
          id: "no",
          name: "No",
          color: "#e5534b",
          prices: generateVolatilePrices(market.noPrice || (1 - market.yesPrice), 67890),
        },
      ];
    }

    return [];
  }, [market?.outcomes, market?.yesPrice, market?.noPrice, timeRange, livePriceHistory]);

  const handleBuyYes = (outcome: Outcome) => {
    setSelectedOutcome(outcome);
    setTradeType("yes");
    setShowTradingSheet(true);
  };

  const handleBuyNo = (outcome: Outcome) => {
    setSelectedOutcome(outcome);
    setTradeType("no");
    setShowTradingSheet(true);
  };

  // Show loading skeleton while markets are loading
  if (!market) {
    if (marketsLoading) {
      return (
        <div className="min-h-screen bg-poly-bg">
          <PolyHeader />
          <div className="max-w-4xl mx-auto px-4 py-8">
            <div className="animate-pulse space-y-6">
              {/* Title skeleton */}
              <div className="flex items-start gap-4">
                <div className="w-14 h-14 rounded-lg bg-poly-surface" />
                <div className="flex-1 space-y-2">
                  <div className="h-6 bg-poly-surface rounded w-3/4" />
                  <div className="h-4 bg-poly-surface rounded w-1/2" />
                </div>
              </div>
              {/* Chart skeleton */}
              <div className="h-[220px] bg-poly-surface rounded-lg" />
              {/* Outcomes skeleton */}
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="bg-poly-card rounded-xl p-4">
                    <div className="flex gap-3">
                      <div className="w-14 h-14 bg-poly-surface rounded-lg" />
                      <div className="flex-1 space-y-2">
                        <div className="h-5 bg-poly-surface rounded w-1/2" />
                        <div className="h-4 bg-poly-surface rounded w-1/3" />
                      </div>
                      <div className="w-16 h-8 bg-poly-surface rounded" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      );
    }
    return (
      <div className="min-h-screen bg-poly-bg flex items-center justify-center">
        <p className="text-white">Market not found</p>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.2 }}
      className="min-h-screen bg-poly-bg"
    >
      <PolyHeader />

      <CategoryTabs
        categories={categories}
        selectedCategory={selectedCategory}
        onSelectCategory={setSelectedCategory}
      />

      {/* Sticky Header - shows market title when scrolling (positioned below main header) */}
      <div
        className={`fixed top-[52px] left-0 right-0 z-40 border-b-2 border-[#2c3f4f] transition-all duration-300 ${
          showStickyTitle ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-full pointer-events-none"
        }`}
        style={{ backgroundColor: '#1c2b3a' }}
      >
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-3">
          <img
            src={market.image}
            alt=""
            className="w-8 h-8 rounded-lg object-cover bg-poly-surface shrink-0"
          />
          <h2 className="text-white text-sm font-medium flex-1 line-clamp-1">
            {market.question}
          </h2>
          <div className="flex items-center gap-2">
            <button className="p-1.5 hover:bg-poly-surface rounded-lg transition-colors">
              <Link2 size={16} color="#8297a3" strokeWidth={2.5} />
            </button>
            <button className="p-1.5 hover:bg-poly-surface rounded-lg transition-colors">
              <Bookmark size={16} color="#8297a3" strokeWidth={2.5} />
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto pb-32">
        {/* Volume Header with TPS */}
        <div
          className={`px-4 py-3 flex items-center justify-between transition-all duration-300 delay-100 ${
            isLoaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
          }`}
        >
          <div className="flex items-center gap-4">
            <span className="text-[#8297a3] text-sm">{market.volume} Vol.</span>
            {hftConnected && (
              <TPSChart
                currentTps={hftStats.currentTps || 0}
                peakTps={hftStats.peakTps || 0}
                tpsHistory={tpsHistory}
                isRunning={hftRunning}
                compact
              />
            )}
          </div>
          <div className="flex items-center gap-2">
            <button className="p-2 hover:bg-poly-surface rounded-lg transition-colors">
              <Link2 size={18} color="#8297a3" strokeWidth={2.5} />
            </button>
            <button className="p-2 hover:bg-poly-surface rounded-lg transition-colors">
              <Bookmark size={18} color="#8297a3" strokeWidth={2.5} />
            </button>
          </div>
        </div>

        {/* Market Title with Icon */}
        <div
          ref={titleRef}
          className={`px-4 pb-5 flex items-start gap-4 transition-all duration-300 delay-150 ${
            isLoaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
          }`}
        >
          <img
            src={market.image}
            alt=""
            className="w-14 h-14 rounded-lg object-cover bg-poly-surface shrink-0"
          />
          <h1 className="flex-1 text-white text-xl font-semibold leading-snug pt-1">
            {market.question}
          </h1>
        </div>

        {/* Outcome Legend - Clickable to highlight */}
        {chartOutcomes.length > 0 && (
          <div
            className={`px-4 pb-4 flex flex-wrap gap-3 transition-all duration-300 delay-200 ${
              isLoaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
            }`}
          >
            {chartOutcomes.map((chartOutcome) => {
              const outcomeId = chartOutcome.id;
              const isHighlighted = highlightedOutcomeId === outcomeId;
              const isDimmed = highlightedOutcomeId && !isHighlighted;
              // Get the REAL on-chain price from market.outcomes, not the static chart data
              const realOutcome = market?.outcomes?.find(o =>
                o.name.toLowerCase() === chartOutcome.name.toLowerCase() ||
                o.name.toLowerCase().includes(chartOutcome.name.toLowerCase().split(' ')[0])
              );
              const currentPrice = realOutcome?.price ?? chartOutcome.prices[chartOutcome.prices.length - 1];

              return (
                <button
                  key={outcomeId}
                  onClick={() => setHighlightedOutcomeId(isHighlighted ? null : outcomeId)}
                  className={`flex items-center gap-1.5 px-2 py-1 rounded-md transition-all ${
                    isHighlighted
                      ? "bg-poly-surface ring-1 ring-poly-blue"
                      : isDimmed
                      ? "opacity-50 hover:opacity-75"
                      : "hover:bg-poly-surface/50"
                  }`}
                >
                  <div
                    className="w-2 h-2 rounded-full transition-colors"
                    style={{ backgroundColor: isDimmed ? "#4a5568" : chartOutcome.color }}
                  />
                  <span className={`text-xs transition-colors ${
                    isDimmed ? "text-poly-textMuted" : "text-poly-textSecondary"
                  }`}>
                    {chartOutcome.name} {Math.round(currentPrice * 100)}%
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {/* Chart Section */}
        <div
          className={`relative mb-3 transition-all duration-500 delay-300 ${
            isLoaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
          }`}
        >
          <PolyChart
            outcomes={chartOutcomes}
            onIndexChange={setActiveIndex}
            width={Math.min(800, window.innerWidth - 80)}
            highlightedOutcomeId={highlightedOutcomeId}
            timestamps={PRICE_HISTORY.map(row => row[0])}
          />
        </div>

        {/* Time Range Selector */}
        <div
          className={`px-4 pb-4 transition-all duration-300 delay-400 ${
            isLoaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-0.5 bg-poly-surface/50 rounded-lg p-0.5">
              {timeRanges.map((range) => (
                <button
                  key={range}
                  onClick={() => setTimeRange(range)}
                  className={`px-2.5 py-1 rounded-md text-xs transition-colors ${
                    timeRange === range
                      ? "bg-poly-card text-white font-medium"
                      : "text-poly-textSecondary hover:text-white"
                  }`}
                >
                  {range}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-1">
              <button className="p-1.5 hover:bg-poly-surface rounded-lg transition-colors">
                <BarChart3 size={14} color="#6E7681" strokeWidth={2.5} />
              </button>
              <button className="p-1.5 hover:bg-poly-surface rounded-lg transition-colors">
                <Sliders size={14} color="#6E7681" strokeWidth={2.5} />
              </button>
              <button className="p-1.5 hover:bg-poly-surface rounded-lg transition-colors">
                <Settings size={14} color="#6E7681" strokeWidth={2.5} />
              </button>
            </div>
          </div>
        </div>

        {/* Order Book - RIGHT BELOW CHART */}
        <div
          className={`px-4 pb-6 transition-all duration-300 delay-450 ${
            isLoaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
          }`}
        >
          <LiveOrderBook
            yesPrice={
              // For multi-outcome, use first outcome's price
              market?.outcomes?.[0]?.price
                ? market.outcomes[0].price * 100
                : hftMarketInfo?.yesPrice || market.yesPrice * 100
            }
            noPrice={
              market?.outcomes?.[0]?.price
                ? (1 - market.outcomes[0].price) * 100
                : hftMarketInfo?.noPrice || market.noPrice * 100
            }
            yesReserve={hftReserves.yesReserve}
            noReserve={hftReserves.noReserve}
            trades={hftTrades}
            isConnected={hftConnected}
            isMultiOutcome={!!market?.outcomes}
            tvl={tvl || 0}
            outcomes={market?.outcomes?.map(o => o.name) || []}
          />
        </div>

        {/* Trade Feed - Under orderbook */}
        {hftTrades.length > 0 && (
          <div
            className={`px-4 pb-6 transition-all duration-300 ${
              isLoaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
            }`}
          >
            <TradeFeed
              trades={hftTrades}
              maxItems={10}
              outcomes={market.outcomes?.map(o => o.name) || []}
              compact
            />
          </div>
        )}

        {/* Full TPS Chart when running */}
        {hftRunning && (
          <div
            className={`px-4 pb-6 transition-all duration-300 ${
              isLoaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
            }`}
          >
            <TPSChart
              currentTps={hftStats.currentTps || 0}
              peakTps={hftStats.peakTps || 0}
              tpsHistory={tpsHistory}
              isRunning={hftRunning}
            />
          </div>
        )}

        {/* Outcomes List with Buy Buttons */}
        {market.outcomes && (
          <div
            className={`px-4 pb-4 transition-all duration-300 delay-500 ${
              isLoaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
            }`}
          >
            {/* Header row */}
            <div className="flex items-center justify-between py-3 border-b border-[#2c3f4f]">
              <span className="text-[#8297a3] text-xs uppercase tracking-[0.1em]">Outcome</span>
              <span className="text-[#8297a3] text-xs uppercase tracking-[0.1em]">% Chance</span>
            </div>

            {market.outcomes.map((outcome, index) => {
              const yesPrice = Math.round(outcome.price * 100);
              const noPrice = 100 - yesPrice;
              const yesPriceDisplay = yesPrice < 10 ? `${(outcome.price * 100).toFixed(1)}` : yesPrice.toString();
              const noPriceDisplay = noPrice < 10 ? `${(100 - outcome.price * 100).toFixed(1)}` : noPrice.toString();

              return (
                <div
                  key={outcome.id}
                  className={`py-5 border-b border-[#2c3f4f] last:border-b-0 transition-all duration-300`}
                  style={{ transitionDelay: `${550 + index * 100}ms` }}
                >
                  {/* Outcome info row */}
                  <button
                    onClick={() => navigate(`/outcome/${market.id}/${outcome.id}`)}
                    className="flex items-start justify-between mb-4 w-full text-left hover:opacity-80 transition-opacity"
                  >
                    <div className="flex items-start gap-3">
                      <img
                        src={outcome.image || market.image}
                        alt=""
                        className="w-14 h-14 rounded-lg object-cover bg-poly-surface shrink-0"
                      />
                      <div className="pt-1">
                        <p className="text-white text-lg font-semibold leading-tight">
                          {outcome.name}
                        </p>
                        <p className="text-[#8297a3] text-sm mt-0.5">
                          {outcome.volume} Vol.
                        </p>
                      </div>
                    </div>
                    <span className="text-white text-3xl font-bold pt-1">{yesPrice}%</span>
                  </button>

                  {/* Buy Yes / Buy No buttons */}
                  <div className="flex gap-3">
                    <button
                      onClick={() => handleBuyYes(outcome)}
                      className="flex-1 bg-[#3dac67] rounded-lg py-3.5 text-white text-base font-semibold hover:bg-[#359b5c] transition-colors"
                    >
                      Buy Yes {yesPriceDisplay}¢
                    </button>
                    <button
                      onClick={() => handleBuyNo(outcome)}
                      className="flex-1 bg-[#e13836] rounded-lg py-3.5 text-white text-base font-semibold hover:bg-[#c9312f] transition-colors"
                    >
                      Buy No {noPriceDisplay}¢
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Market Context Card */}
        <div
          className={`px-4 pb-4 transition-all duration-300 delay-600 ${
            isLoaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
          }`}
        >
          <div className="bg-[#2a3d4e] border-2 border-[#3a4f60] rounded-2xl p-4">
            <div className="flex items-center justify-between">
              <span className="text-white text-base font-semibold">Market Context</span>
              <button className="text-[#5BA3D9] text-base font-medium hover:text-[#7BBDE8] transition-colors">
                Generate
              </button>
            </div>
          </div>
        </div>

        {/* About Section */}
        <div
          className={`px-4 pb-6 transition-all duration-300 delay-650 ${
            isLoaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
          }`}
        >
          <h2 className="text-white text-xl font-bold mb-4">About</h2>

          {/* Volume Row */}
          <div className="flex items-center gap-3 py-4 border-b border-[#2c3f4f]">
            <BarChart3 size={20} color="#8297a3" strokeWidth={2.5} />
            <span className="text-[#8297a3] text-base flex-1">Volume</span>
            <span className="text-white text-base font-semibold">{market.volume}</span>
          </div>

          {/* TVL Row */}
          <div className="flex items-center gap-3 py-4 border-b border-[#2c3f4f]">
            <Wallet size={20} color="#8297a3" strokeWidth={2.5} />
            <span className="text-[#8297a3] text-base flex-1">Total Liquidity (TVL)</span>
            <span className="text-white text-base font-semibold">
              {tvl !== null ? `${tvl.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} APT` : 'Loading...'}
            </span>
          </div>

          {/* End Date Row */}
          <div className="flex items-center gap-3 py-4 border-b border-[#2c3f4f]">
            <Clock size={20} color="#8297a3" strokeWidth={2.5} />
            <span className="text-[#8297a3] text-base flex-1">End Date</span>
            <span className="text-white text-base font-semibold">{market.endDate}</span>
          </div>

          {/* Created At Row */}
          <div className="flex items-center gap-3 py-4 border-b border-[#2c3f4f]">
            <Clock size={20} color="#8297a3" strokeWidth={2.5} />
            <span className="text-[#8297a3] text-base flex-1">Created At</span>
            <span className="text-white text-base font-semibold">{market.createdAt || "Aug 5, 2025"}</span>
          </div>

          {/* Resolver Card */}
          <div className="mt-4 bg-[#2a3d4e] border border-[#3a4f60] rounded-2xl p-4">
            <div className="flex items-center gap-3">
              {/* UMA Logo placeholder */}
              <div className="w-10 h-10 rounded-full bg-[#FF4D4D] flex items-center justify-center shrink-0">
                <span className="text-white text-sm font-bold">UMA</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[#8297a3] text-sm mb-0.5">Resolver</p>
                <p className="text-[#5BA3D9] text-base font-mono truncate">
                  {market.resolver || "0x2F5e3684c9A118f5..."}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Aptos Comparison */}
        <div
          className={`px-4 pb-6 transition-all duration-300 delay-680 ${
            isLoaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
          }`}
        >
          <AptosComparison />
        </div>

        {/* Consensus Visualizer */}
        <div
          className={`px-4 pb-6 transition-all duration-300 delay-690 ${
            isLoaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
          }`}
        >
          <ConsensusVisualizer />
        </div>

        {/* Speed Comparison */}
        <div
          className={`px-4 pb-6 transition-all duration-300 delay-700 ${
            isLoaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
          }`}
        >
          <SpeedComparison />
        </div>

        {/* Related Section */}
        <div
          className={`px-4 pb-4 transition-all duration-300 delay-700 ${
            isLoaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
          }`}
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-white text-xl font-bold">Related</h2>
            <button
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
              className="flex items-center gap-1 text-[#5BA3D9] text-sm font-medium hover:opacity-80 transition-opacity"
            >
              Back to top
              <ChevronUp size={16} strokeWidth={2.5} />
            </button>
          </div>
          {/* Tag Pills */}
          <div className="flex flex-wrap gap-2 mb-4">
            {["Politics", "Elections", "2025", market.category].filter(Boolean).map((tag) => (
              <button
                key={tag}
                className="px-3 py-1.5 bg-[#2a3d4e] border border-[#3a4f60] rounded-full text-[#8297a3] text-sm hover:text-white hover:border-[#5a6f80] transition-colors"
              >
                {tag}
              </button>
            ))}
          </div>
          <p className="text-[#8297a3] text-sm">No related markets found.</p>
        </div>

        {/* Comments/Holders/Activity Tabs */}
        <div
          className={`px-4 pb-6 transition-all duration-300 delay-700 ${
            isLoaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
          }`}
        >
          <div className="flex border-b border-[#2c3f4f] mb-4">
            <button className="flex-1 py-3 text-center text-white text-base font-medium border-b-2 border-poly-blue">
              Comments
            </button>
            <button className="flex-1 py-3 text-center text-[#8297a3] text-base font-medium">
              Holders
            </button>
            <button className="flex-1 py-3 text-center text-[#8297a3] text-base font-medium">
              Activity
            </button>
          </div>

          {/* Beware Banner */}
          <div className="bg-[#2a3441] border border-[#3a4f60] rounded-lg px-4 py-3 mb-4 flex items-center gap-2">
            <span className="text-[#f59e0b]">⚠️</span>
            <span className="text-[#8297a3] text-sm">Beware of external links.</span>
          </div>

          {/* Filter Row */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <button className="flex items-center gap-1.5 text-white text-sm font-medium">
                Newest
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M3 4.5L6 7.5L9 4.5" stroke="#8297a3" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" className="w-4 h-4 rounded border-[#3a4f60] bg-[#2a3d4e] text-poly-blue focus:ring-0 focus:ring-offset-0" />
              <span className="text-[#8297a3] text-sm">Holders</span>
            </label>
          </div>

          {/* Comment Input */}
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 via-green-500 to-pink-500 shrink-0" />
            <input
              type="text"
              placeholder="Add a comment"
              className="flex-1 bg-[#2a3d4e] border border-[#3a4f60] rounded-xl px-4 py-3 text-white text-base placeholder-[#8297a3] outline-none focus:border-poly-blue transition-colors"
            />
            <button className="px-4 py-3 bg-poly-blue rounded-xl text-white text-base font-medium hover:bg-poly-blueHover transition-colors">
              Post
            </button>
          </div>

          {/* Sample Comments */}
          <div className="space-y-4">
            <div className="flex gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 shrink-0" />
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-white text-sm font-medium">trader123</span>
                  <span className="text-[#6E7681] text-xs">2h ago</span>
                </div>
                <p className="text-white text-sm leading-relaxed">Interesting market dynamics here. The volume has been picking up lately.</p>
                <div className="flex items-center gap-4 mt-2">
                  <button className="text-[#6E7681] text-xs hover:text-white transition-colors">Reply</button>
                  <button className="flex items-center gap-1 text-[#6E7681] text-xs hover:text-white transition-colors">
                    <span>👍</span> <span>12</span>
                  </button>
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-500 to-red-500 shrink-0" />
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-white text-sm font-medium">polywhale</span>
                  <span className="text-[#6E7681] text-xs">5h ago</span>
                </div>
                <p className="text-white text-sm leading-relaxed">Been following this market closely. Great liquidity.</p>
                <div className="flex items-center gap-4 mt-2">
                  <button className="text-[#6E7681] text-xs hover:text-white transition-colors">Reply</button>
                  <button className="flex items-center gap-1 text-[#6E7681] text-xs hover:text-white transition-colors">
                    <span>👍</span> <span>8</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Trading Sheet */}
      <TradingSheet
        market={market}
        selectedOutcome={selectedOutcome || undefined}
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
    </motion.div>
  );
}
