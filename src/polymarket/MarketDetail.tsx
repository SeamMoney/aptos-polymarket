import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { Aptos, AptosConfig, Network } from "@aptos-labs/ts-sdk";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Link2, Bookmark, BarChart3, Sliders, Settings, Clock, ChevronUp, Wallet } from "lucide-react";
import { PolyHeader } from "./PolyHeader";
import { CategoryTabs } from "./CategoryTabs";
import { PolyChart } from "./PolyChart";
import { TOP_CANDIDATES, CANDIDATE_COLORS } from "./priceData";
import { REAL_PRICE_HISTORY, KHAMENEI_PRICE_HISTORY, LATEST_REAL_PRICES } from "./realPriceData";
import { TradingSheet } from "./TradingSheet";
import { LiveOrderBook } from "./LiveOrderBook";
import { TPSChart } from "./TPSChart";
import { AptosComparison } from "./AptosComparison";
import { ConsensusVisualizer } from "./ConsensusVisualizer";
import { SpeedComparison } from "./SpeedComparison";
import { OracleStatusPanel, UMAComparisonPanel, FailureMetricsPanel } from "../components/oracle";
import { mockMarkets, categories } from "./mockData";
import { usePolymarkets } from "../hooks/usePolymarkets";
import { useHFTConnection } from "../hooks/useHFTConnection";
import { useLivePrices } from "../hooks/useLivePrices";
import { useLiveTrades, emitTrade, type LiveTrade } from "../hooks/useLiveTrades";
import type { Category, Outcome } from "./types";
import type { Trade } from "../hooks/useHFTConnection";

// Initialize Aptos client for TVL fetching
const aptos = new Aptos(new AptosConfig({ network: Network.TESTNET }));

// Contract address (from env vars)
const CONTRACT_ADDRESS = import.meta.env.VITE_CONTRACT_ADDRESS || "0x1bd17a9cb5a55a414de956128e332f7744ef260bbdc49303a08105c986adbda3";

// Helper to extract market address from route id (e.g., "multi-0x3e690f..." -> "0x3e690f...")
function extractMarketAddress(id: string | undefined): string {
  if (!id) return "";
  if (id.startsWith('multi-')) return id.replace('multi-', '');
  if (id.startsWith('binary-')) return id.replace('binary-', '');
  return id;
}

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

  // Extract market address from route id
  const marketAddress = useMemo(() => extractMarketAddress(id), [id]);

  // Fetch TVL from contract
  const fetchTVL = useCallback(async () => {
    if (!marketAddress) return;
    try {
      const result = await aptos.view({
        payload: {
          function: `${CONTRACT_ADDRESS}::multi_outcome_market::get_multi_market_info`,
          typeArguments: [],
          functionArguments: [marketAddress],
        },
      });
      // Result: [question, description, category, outcome_count, end_time, resolved, winning_outcome, total_collateral]
      const totalCollateral = parseInt(result[7] as string);
      setTvl(totalCollateral / 100_000_000); // Convert from octas to USD1
    } catch (error) {
      console.error("Error fetching TVL:", error);
    }
  }, [marketAddress]);

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

  // HFT connection for live demo - auto-connect to show live trades
  // HFT connection - only enable when:
  // 1. VITE_HFT_WS_URL is set, AND
  // 2. Either we're on HTTP, OR the HFT URL supports WSS
  const hftWsUrl = import.meta.env.VITE_HFT_WS_URL || '';
  const isPageHttps = typeof window !== 'undefined' && window.location.protocol === 'https:';
  const hftSupportsHttps = hftWsUrl.startsWith('wss://');
  const hftEnabled = !!hftWsUrl && (!isPageHttps || hftSupportsHttps);
  const {
    isConnected: hftConnected,
    isRunning: hftRunning,
    stats: hftStats,
    marketInfo: hftMarketInfo,
    marketReserves: hftReserves,
    trades: hftTrades,
    tpsHistory,
  } = useHFTConnection({ autoConnect: hftEnabled });

  // Live price tracking for real-time chart updates
  const {
    currentPrices: _livePrices,
    priceHistory: livePriceHistory,
    isConnected: _pricesConnected,
  } = useLivePrices(3000); // Poll every 3 seconds

  // Live trades from blockchain polling - always enabled to show all trades
  // Pass marketAddress to enable Geomi indexer for accurate trade data
  const { trades: blockchainTrades, loadMore, hasMore } = useLiveTrades({
    marketAddress: marketAddress,  // Use actual market being viewed
    pollInterval: 5000,
    maxTrades: 100,
    enabled: !!marketAddress,  // Only fetch when we have a market address
  });

  // Persist HFT trades to localStorage so they survive page navigation
  const lastHftTradeCountRef = useRef(0);
  useEffect(() => {
    if (hftTrades.length > lastHftTradeCountRef.current) {
      // New trades came in - save them
      const newTrades = hftTrades.slice(0, hftTrades.length - lastHftTradeCountRef.current);
      newTrades.forEach(t => {
        const liveTrade: LiveTrade = {
          id: t.id,
          type: t.action.includes('buy') ? 'buy' : 'sell',
          outcomeIndex: t.outcome || 0,
          amount: t.amount,
          price: 0,
          timestamp: t.timestamp,
          txHash: t.txHash || '',
          trader: t.bot || '',
          marketAddress: marketAddress,  // Include market address for filtering
        };
        emitTrade(liveTrade);
      });
      lastHftTradeCountRef.current = hftTrades.length;
    }
  }, [hftTrades, marketAddress]);

  // Combine HFT trades with blockchain trades - show ALL trades from both sources
  const combinedTrades: Trade[] = useMemo(() => {
    // Convert blockchain trades to Trade format
    const convertedBlockchainTrades: Trade[] = blockchainTrades.map((bt) => ({
      id: bt.id,
      bot: bt.trader.slice(0, 8) + '...',
      action: bt.type === 'buy' ? 'buy_outcome' : 'sell_outcome',
      actionDisplay: bt.type === 'buy' ? 'Buy' : 'Sell',
      amount: bt.amount,
      latency: 0,
      success: true,
      txHash: bt.txHash,
      timestamp: bt.timestamp,
      outcome: bt.outcomeIndex,
    }));

    // Merge HFT trades and blockchain trades, deduplicating by txHash
    const allTrades = [...hftTrades, ...convertedBlockchainTrades];
    const seenHashes = new Set<string>();
    const uniqueTrades = allTrades.filter(t => {
      if (!t.txHash || seenHashes.has(t.txHash)) return false;
      seenHashes.add(t.txHash);
      return true;
    });

    // Sort by timestamp descending (newest first)
    return uniqueTrades.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0)).slice(0, 100);
  }, [hftTrades, blockchainTrades]);

  // Try to find market from on-chain data first, then fall back to mock data
  const market = useMemo(() => {
    const onChainMarket = getMarket(id || "");
    if (onChainMarket) return onChainMarket;
    return mockMarkets.find((m) => m.id === id);
  }, [id, getMarket]);

  // Detect if this is the Khamenei Iran market (for special chart handling)
  const isKhameneiMarket = useMemo(() => {
    return market?.question?.toLowerCase().includes('khamenei') ||
           market?.question?.toLowerCase().includes('iran supreme leader');
  }, [market?.question]);

  // Reset scroll position when navigating to this page
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [id]);

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

  // Use REAL Polymarket price data for the chart + LIVE price updates during HFT demo
  // IMPORTANT: All prices in 0-1 decimal format
  const chartOutcomes = useMemo(() => {
    // Early exit if no market
    if (!market) {
      return [];
    }

    // Check if this is the VP nominee market (has matching candidates)
    const isVPMarket = market?.outcomes?.some(o =>
      TOP_CANDIDATES.includes(o.name)
    );

    // Number of points to show based on timeframe
    const TIMEFRAME_POINTS: Record<string, number> = {
      '1H': 60,
      '6H': 72,
      '1D': 96,
      '1W': 168,
      '1M': 180,
      'ALL': 220, // Use all real data points
    };
    const pointsToShow = TIMEFRAME_POINTS[timeRange] || 220;

    // Seeded random for consistent volatility patterns
    const seededRandom = (seed: number) => {
      const x = Math.sin(seed * 12345.6789) * 43758.5453;
      return x - Math.floor(x);
    };

    // DEMO MODE: Don't use live on-chain prices for chart display
    // The HFT trading equalizes all prices which looks unrealistic
    // Instead, use static Polymarket data which shows Vance leading at ~50%
    const hasLivePrices = false; // Disabled - livePriceHistory.length > 5;
    const isShortTimeframe = ['1H', '6H', '1D'].includes(timeRange);

    if (isVPMarket && market?.outcomes) {
      // Use REAL Polymarket historical data + LIVE price updates
      return TOP_CANDIDATES.map((candidateName, candIdx) => {
        const outcome = market.outcomes?.find(o => o.name === candidateName);
        const seed = candidateName.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);

        // Get real prices from the Polymarket CSV data
        const realPrices = REAL_PRICE_HISTORY.map(point => point.prices[candidateName] || 0);

        // Use LIVE price as current price when available, otherwise use static
        const liveCurrentPrice = livePriceHistory.length > 0
          ? livePriceHistory[livePriceHistory.length - 1].prices[candIdx]
          : null;
        const currentPrice = liveCurrentPrice ?? LATEST_REAL_PRICES[candidateName] ?? 0.05;

        // For short timeframes during HFT demo, use live prices for the recent portion
        let basePrices: number[];

        if (hasLivePrices && isShortTimeframe) {
          // Use live price history for recent data (makes chart animate!)
          const livePricesForCandidate = livePriceHistory.map(p => p.prices[candIdx] || currentPrice);

          // Take the most recent live prices
          const livePointsToUse = Math.min(livePricesForCandidate.length, Math.floor(pointsToShow * 0.8));
          const staticPointsNeeded = pointsToShow - livePointsToUse;

          // Get static prices for the beginning
          const staticPortion = realPrices.slice(-staticPointsNeeded);
          while (staticPortion.length < staticPointsNeeded) {
            staticPortion.unshift(staticPortion[0] || currentPrice);
          }

          // Combine static + live
          basePrices = [...staticPortion, ...livePricesForCandidate.slice(-livePointsToUse)];
        } else {
          // Default behavior: use real Polymarket data
          if (timeRange === 'ALL') {
            basePrices = [...realPrices];
          } else {
            const startIdx = Math.max(0, realPrices.length - pointsToShow);
            basePrices = realPrices.slice(startIdx);
          }
        }

        // Pad with the last price if needed
        while (basePrices.length < pointsToShow) {
          basePrices.push(basePrices[basePrices.length - 1] || currentPrice);
        }
        basePrices = basePrices.slice(-pointsToShow);

        // Add volatility for visual distinction - more for lower-priced candidates
        // Skip volatility noise when using live data (it's already moving!)
        const volatilityScale = hasLivePrices && isShortTimeframe
          ? 0 // No noise needed - live data moves on its own!
          : (currentPrice < 0.1 ? 0.03 : currentPrice < 0.2 ? 0.02 : 0.015);

        const prices = basePrices.map((basePrice, i) => {
          // Skip noise when using live data
          if (volatilityScale === 0) {
            // Just ensure end matches current price
            if (i === basePrices.length - 1) return currentPrice;
            return Math.max(0.005, Math.min(0.99, basePrice));
          }

          // Deterministic noise based on position and candidate
          const noise1 = seededRandom(seed * 1000 + i * 7 + candIdx * 100);
          const noise2 = seededRandom(seed * 2000 + i * 13 + candIdx * 200);

          // Wave pattern for visual interest (different phase for each candidate)
          const wavePhase = (i / pointsToShow) * Math.PI * 4 + candIdx * 1.5;
          const wave = Math.sin(wavePhase) * volatilityScale * 0.4;

          // Random walk component
          const randomWalk = (noise1 - 0.5) * volatilityScale;

          // Occasional spikes (news events)
          let spike = 0;
          if (noise2 > 0.95) spike = volatilityScale * 1.5;
          else if (noise2 < 0.05) spike = -volatilityScale * 1.5;

          // Apply more volatility for short timeframes (only when not live)
          const timeMultiplier = isShortTimeframe ? 2.5 : 1.0;

          let price = basePrice + (wave + randomWalk + spike) * timeMultiplier;

          // Keep price realistic
          price = Math.max(0.005, Math.min(0.99, price));

          // Force end to current price
          if (i === basePrices.length - 1) {
            price = currentPrice;
          }

          return price;
        });

        return {
          id: candidateName.toLowerCase().replace(/\s+/g, '-'),
          name: candidateName,
          color: CANDIDATE_COLORS[candidateName] || outcome?.color || "#666",
          prices,
        };
      });
    }

    // Check if this is the Khamenei Iran market (by question text)
    // Our on-chain market may have Yes/No outcomes, but we want to show real Polymarket data
    const isKhamenei = market?.question?.toLowerCase().includes('khamenei') ||
                       market?.question?.toLowerCase().includes('iran supreme leader');

    if (isKhamenei) {

      // Use the "Jan 31" outcome data as the primary "Yes" price since it's the most likely outcome
      // This matches what Polymarket shows - the probability of Khamenei being out by a certain date
      const realPrices = KHAMENEI_PRICE_HISTORY.map((point: { prices: Record<string, number> }) => point.prices["Jan 31"] || 0.35);
      const currentPrice = LATEST_REAL_PRICES["Jan 31"] ?? 0.615;

      // Select price range based on timeframe
      let basePrices: number[];
      if (timeRange === 'ALL') {
        basePrices = [...realPrices];
      } else {
        const startIdx = Math.max(0, realPrices.length - pointsToShow);
        basePrices = realPrices.slice(startIdx);
      }

      // Pad if needed to match pointsToShow
      while (basePrices.length < pointsToShow) {
        basePrices.push(basePrices[basePrices.length - 1] || currentPrice);
      }
      basePrices = basePrices.slice(-pointsToShow);

      // Use the real data directly - NO added volatility (Polymarket charts are clean)
      const yesPrices = basePrices.map((p, i) => {
        // Force end to current price
        if (i === basePrices.length - 1) return currentPrice;
        return p;
      });

      // No price is complement of Yes
      const noPrices = yesPrices.map(p => 1 - p);

      return [
        {
          id: "yes",
          name: "Yes",
          color: "#22c55e",  // Green for Yes
          prices: yesPrices,
        },
        {
          id: "no",
          name: "No",
          color: "#5b9cf6",  // Blue for No
          prices: noPrices,
        },
      ];
    }

    // Handle markets with outcomes array
    if (market?.outcomes && market.outcomes.length > 0) {
      const numPoints = pointsToShow;
      const outcomeNames = market.outcomes.map(o => o.name.toLowerCase());

      // Check if this is a binary Yes/No market - prices MUST be mirrors
      const isBinaryYesNo = market.outcomes.length === 2 &&
        outcomeNames.includes('yes') && outcomeNames.includes('no');

      if (isBinaryYesNo) {
        // Binary market: Yes + No = 100% at all times
        const yesOutcome = market.outcomes.find(o => o.name.toLowerCase() === 'yes')!;
        const noOutcome = market.outcomes.find(o => o.name.toLowerCase() === 'no')!;
        const yesEndPrice = yesOutcome.price;

        // Seeded random for consistent chart
        const seed = market.question.length * 7 + market.id.length;
        const seededRandom = (s: number) => {
          const x = Math.sin(s * 12345.6789) * 43758.5453;
          return x - Math.floor(x);
        };

        // Generate step-like Yes prices (like real trading)
        const yesPrices: number[] = [];
        let currentPrice = 0.5; // Start at 50%

        // Create random step points where price jumps (more steps = more granular)
        const numSteps = 25 + Math.floor(seededRandom(seed) * 15); // 25-40 steps
        const stepIndices: number[] = [];
        for (let s = 0; s < numSteps; s++) {
          stepIndices.push(Math.floor(seededRandom(seed * 100 + s) * numPoints));
        }
        stepIndices.sort((a, b) => a - b);

        // Pre-calculate step prices trending toward end
        const stepPrices: number[] = [0.5];
        let stepPrice = 0.5;
        for (let s = 0; s < numSteps; s++) {
          const progress = (s + 1) / numSteps;
          const targetAtStep = 0.5 + (yesEndPrice - 0.5) * progress;
          // Random jump toward target with more variance
          const jump = (seededRandom(seed * 200 + s) - 0.4) * 0.04;
          stepPrice = stepPrice + (targetAtStep - stepPrice) * 0.3 + jump;
          stepPrice = Math.max(0.30, Math.min(0.70, stepPrice)); // Allow wider swings
          stepPrices.push(stepPrice);
        }
        stepPrices.push(yesEndPrice);

        // Generate prices with step behavior
        let stepIdx = 0;
        for (let i = 0; i < numPoints; i++) {
          // Check if we hit a step
          while (stepIdx < stepIndices.length && i >= stepIndices[stepIdx]) {
            currentPrice = stepPrices[stepIdx + 1];
            stepIdx++;
          }
          yesPrices.push(currentPrice);
        }
        yesPrices[numPoints - 1] = yesEndPrice;

        // No is EXACTLY 1 - Yes (perfect mirror)
        const noPrices = yesPrices.map(p => 1 - p);

        return [
          { id: yesOutcome.id || 'yes', name: 'Yes', color: '#4abe7a', prices: yesPrices },
          { id: noOutcome.id || 'no', name: 'No', color: '#5b9cf6', prices: noPrices },
        ];
      }

      // Multi-outcome market (3+ options) - generate independent prices
      const genericResult = market.outcomes.map((outcome, outcomeIdx) => {
        const prices: number[] = [];
        const endPrice = outcome.price;

        // Smooth trend from a starting point to end price
        const startPrice = Math.max(0.05, Math.min(0.95, endPrice + (Math.random() - 0.5) * 0.1));

        for (let i = 0; i < numPoints; i++) {
          const t = i / (numPoints - 1);
          const smoothT = t * t * (3 - 2 * t);
          const price = startPrice + (endPrice - startPrice) * smoothT;
          prices.push(Math.max(0.01, Math.min(0.99, price)));
        }
        prices[numPoints - 1] = endPrice;

        return {
          id: outcome.id || `outcome-${outcomeIdx}`,
          name: outcome.name || `Outcome ${outcomeIdx}`,
          color: outcome.color || ['#4abe7a', '#5b9cf6', '#f5a623', '#00bcd4', '#ef4444'][outcomeIdx % 5],
          prices,
        };
      });

      return genericResult;
    }

    // Handle binary markets - Yes and No MUST be mirrors (sum to 100%)
    if (market?.yesPrice !== undefined) {
      const numPoints = pointsToShow;
      const yesPrices: number[] = [];

      // Smooth trend from 50% to current Yes price
      const startPrice = 0.5;
      const endPrice = market.yesPrice;

      for (let i = 0; i < numPoints; i++) {
        const t = i / (numPoints - 1);
        // Smooth S-curve interpolation
        const smoothT = t * t * (3 - 2 * t);
        const price = startPrice + (endPrice - startPrice) * smoothT;
        yesPrices.push(Math.max(0.01, Math.min(0.99, price)));
      }
      yesPrices[numPoints - 1] = endPrice;

      // No prices are EXACTLY 1 - Yes prices (perfect mirror)
      const noPrices = yesPrices.map(p => 1 - p);

      return [
        { id: "yes", name: "Yes", color: "#4abe7a", prices: yesPrices },
        { id: "no", name: "No", color: "#5b9cf6", prices: noPrices },
      ];
    }

    // Final fallback - ALWAYS generate chart data if we have a market
    // This ensures the chart is never empty

    const numPoints = 220;
    const yPrice = market?.yesPrice ?? 0.5;
    const nPrice = market?.noPrice ?? (1 - yPrice);

    const generateSimplePrices = (endPrice: number, seed: number) => {
      const prices: number[] = [];
      let price = Math.max(0.05, Math.min(0.95, endPrice + (Math.sin(seed) * 0.1)));
      for (let i = 0; i < numPoints; i++) {
        price += (Math.sin(seed * 1000 + i * 0.1) * 0.005);
        price = Math.max(0.01, Math.min(0.99, price));
        prices.push(price);
      }
      prices[prices.length - 1] = Math.max(0.01, Math.min(0.99, endPrice));
      return prices;
    };

    const fallbackResult = [
      { id: "yes", name: "Yes", color: "#4abe7a", prices: generateSimplePrices(yPrice, 12345) },
      { id: "no", name: "No", color: "#e5534b", prices: generateSimplePrices(nPrice, 54321) },
    ];

    return fallbackResult;
  }, [market?.outcomes, market?.yesPrice, market?.noPrice, market?.question, timeRange, livePriceHistory,
      // Force recalculation when outcome prices change (shallow comparison of outcomes array isn't enough)
      // eslint-disable-next-line react-hooks/exhaustive-deps
      JSON.stringify(market?.outcomes?.map(o => o.price))]);

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
              // Only use hardcoded Polymarket prices for specific markets (GOP nominee, Khamenei, Fed Chair)
              // For generic Yes/No markets like BTC $100K, use actual chart end price (from on-chain data)
              const isSpecialMarket = market?.question?.toLowerCase().includes('republican') ||
                                     market?.question?.toLowerCase().includes('nominee') ||
                                     market?.question?.toLowerCase().includes('khamenei') ||
                                     market?.question?.toLowerCase().includes('fed chair') ||
                                     market?.question?.toLowerCase().includes('trump nominate');
              const realPolymarketPrice = isSpecialMarket
                ? ((LATEST_REAL_PRICES as Record<string, number>)[chartOutcome.name] || 0)
                : 0;
              // Use on-chain price (chart end price) for generic markets
              const currentPrice = realPolymarketPrice > 0 ? realPolymarketPrice : chartOutcome.prices[chartOutcome.prices.length - 1];

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
            timestamps={isKhameneiMarket ? KHAMENEI_PRICE_HISTORY.map((p: { timestamp: number }) => p.timestamp) : REAL_PRICE_HISTORY.map((p: { timestamp: number }) => p.timestamp)}
            autoScale={true}
            timeRange={timeRange}
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
            trades={combinedTrades}
            isConnected={hftConnected || combinedTrades.length > 0}
            isMultiOutcome={!!market?.outcomes}
            tvl={tvl || 0}
            outcomes={market?.outcomes?.map(o => o.name) || []}
            onLoadMore={loadMore}
            hasMore={hasMore}
          />
        </div>


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
              // Map "Other" to "Donald Trump Jr." for display
              const displayName = outcome.name === "Other" ? "Donald Trump Jr." : outcome.name;

              // Only use hardcoded Polymarket prices for specific markets (GOP nominee, Khamenei, Fed Chair)
              // For generic Yes/No markets like BTC $100K, use actual on-chain prices
              const isSpecialMarket = market.question.toLowerCase().includes('republican') ||
                                     market.question.toLowerCase().includes('nominee') ||
                                     market.question.toLowerCase().includes('khamenei') ||
                                     market.question.toLowerCase().includes('fed chair') ||
                                     market.question.toLowerCase().includes('trump nominate');

              // Use hardcoded prices only for special markets, otherwise use on-chain price
              const realPrice = isSpecialMarket
                ? (LATEST_REAL_PRICES[displayName] || LATEST_REAL_PRICES[outcome.name] || outcome.price)
                : outcome.price;
              const yesPrice = Math.round(realPrice * 100);
              const noPrice = 100 - yesPrice;
              const yesPriceDisplay = yesPrice < 10 ? `${(realPrice * 100).toFixed(1)}` : yesPrice.toString();
              const noPriceDisplay = noPrice < 10 ? `${(100 - realPrice * 100).toFixed(1)}` : noPrice.toString();

              // Calculate proportional volume based on outcome's share of market
              // Parse market.volume (e.g., "$7.2K" -> 7200)
              const parseVolume = (vol: string): number => {
                const num = parseFloat(vol.replace(/[$,]/g, ''));
                if (vol.includes('M')) return num * 1_000_000;
                if (vol.includes('K')) return num * 1_000;
                return num;
              };
              const totalVol = parseVolume(market.volume || "0");
              const outcomeVol = totalVol * realPrice; // Proportional to price
              const volumeDisplay = outcomeVol >= 1_000_000
                ? `$${(outcomeVol / 1_000_000).toFixed(1)}M`
                : outcomeVol >= 1_000
                  ? `$${(outcomeVol / 1_000).toFixed(1)}K`
                  : `$${Math.round(outcomeVol)}`;

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
                          {displayName}
                        </p>
                        <p className="text-[#8297a3] text-sm mt-0.5">
                          {volumeDisplay} Vol.
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
              {tvl !== null ? `${tvl.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD1` : 'Loading...'}
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

        {/* Oracle Status Panel */}
        <div
          className={`px-4 pb-4 transition-all duration-300 delay-700 ${
            isLoaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
          }`}
        >
          <OracleStatusPanel
            marketType={market?.oracleInfo?.type || 'admin'}
            price={market?.oracleInfo?.resolutionPrice ? market.oracleInfo.resolutionPrice * 100_000_000 : undefined}
            targetPrice={market?.oracleInfo?.type === 'pyth' ? 100000_00000000 : undefined}
            confidence={market?.oracleInfo?.type === 'pyth' ? 12.50 : undefined}
          />
        </div>

        {/* UMA Comparison Panel */}
        <div
          className={`px-4 pb-4 transition-all duration-300 delay-700 ${
            isLoaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
          }`}
        >
          <UMAComparisonPanel />
        </div>

        {/* Polymarket Failure Metrics Panel */}
        <div
          className={`px-4 pb-6 transition-all duration-300 delay-700 ${
            isLoaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
          }`}
        >
          <FailureMetricsPanel />
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
            {[...new Set(["Politics", "Elections", "2025", market.category].filter(Boolean))].map((tag) => (
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
