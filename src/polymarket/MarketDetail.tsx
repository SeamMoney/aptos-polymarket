import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { Aptos, AptosConfig, Network } from "@aptos-labs/ts-sdk";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Link2, Bookmark, BarChart3, Settings, Clock, ChevronUp, Wallet } from "lucide-react";
import { PolyHeader } from "./PolyHeader";
import { CategoryTabs } from "./CategoryTabs";
import { PolyChart } from "./PolyChart";
import { TOP_CANDIDATES, CANDIDATE_COLORS } from "./priceData";
import { REAL_PRICE_HISTORY, KHAMENEI_PRICE_HISTORY, LATEST_REAL_PRICES, FED_CHAIR_PRICE_HISTORY, FED_CHAIR_CANDIDATES, FED_CHAIR_COLORS } from "./realPriceData";
import { TradingSheet } from "./TradingSheet";
import { LiveOrderBook } from "./LiveOrderBook";
import { TPSChart } from "./TPSChart";
import { AptosComparison } from "./AptosComparison";
import { ConsensusVisualizer } from "./ConsensusVisualizer";
import { SpeedComparison } from "./SpeedComparison";
import { OracleStatusPanel, UMAComparisonPanel, FailureMetricsPanel } from "../components/oracle";
import { ChartTradePopups } from "../components/ChartTradePopups";
import { mockMarkets, categories } from "./mockData";
import { usePolymarkets } from "../hooks/usePolymarkets";
import { useHFTConnection } from "../hooks/useHFTConnection";
import { useLivePrices } from "../hooks/useLivePrices";
import { useTradePriceHistory } from "../hooks/useTradePriceHistory";
import { useRealtimePrices } from "../hooks/useRealtimePrices";
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
  // Map mock IDs to real on-chain addresses
  const mockToRealAddress = getMockToRealAddress(id);
  if (mockToRealAddress) return mockToRealAddress;
  return id;
}

// Mapping from mock market IDs to real on-chain market addresses
// This allows mock UI markets to trade on real contracts
const MOCK_TO_REAL_ADDRESS: Record<string, string> = {
  // Khamenei "When will Khamenei no longer be Iran's Supreme Leader?"
  "iran-khamenei": "0xcbdddcf6206d2b5956b6c7c6a10d4ac1d6253a2c1c151e8b3af113d8e940f01f",
  "iran-khamenei-binary": "0xcbdddcf6206d2b5956b6c7c6a10d4ac1d6253a2c1c151e8b3af113d8e940f01f",
};

function getMockToRealAddress(id: string): string | null {
  return MOCK_TO_REAL_ADDRESS[id] || null;
}

const timeRanges = ["1H", "1D", "1W", "1M", "MAX"];

// Countdown Timer Component - shows time remaining until market resolution
function CountdownTimer({ endTime }: { endTime: number }) {
  const [timeLeft, setTimeLeft] = useState({ hours: 0, mins: 0, secs: 0 });

  useEffect(() => {
    const calculateTimeLeft = () => {
      const now = Math.floor(Date.now() / 1000);
      const diff = endTime - now;

      if (diff <= 0) {
        return { hours: 0, mins: 0, secs: 0 };
      }

      const hours = Math.floor(diff / 3600);
      const mins = Math.floor((diff % 3600) / 60);
      const secs = diff % 60;

      return { hours, mins, secs };
    };

    setTimeLeft(calculateTimeLeft());
    const timer = setInterval(() => {
      setTimeLeft(calculateTimeLeft());
    }, 1000);

    return () => clearInterval(timer);
  }, [endTime]);

  // Don't show if time has passed or more than 365 days away
  if (timeLeft.hours === 0 && timeLeft.mins === 0 && timeLeft.secs === 0) {
    return null;
  }
  if (timeLeft.hours > 8760) {
    return null; // More than a year away
  }

  return (
    <div className="flex items-center gap-1 shrink-0">
      <div className="text-center">
        <span className="text-[#ef4444] text-lg font-semibold">{timeLeft.hours}</span>
        <span className="text-[#8297a3] text-[10px] block uppercase">HRS</span>
      </div>
      <div className="text-center">
        <span className="text-[#ef4444] text-lg font-semibold">{String(timeLeft.mins).padStart(2, '0')}</span>
        <span className="text-[#8297a3] text-[10px] block uppercase">MINS</span>
      </div>
      <div className="text-center">
        <span className="text-[#ef4444] text-lg font-semibold">{String(timeLeft.secs).padStart(2, '0')}</span>
        <span className="text-[#8297a3] text-[10px] block uppercase">SECS</span>
      </div>
    </div>
  );
}

export function MarketDetail() {
  const { id } = useParams<{ id: string }>();
  useNavigate(); // Keep hook call for potential future use
  const titleRef = useRef<HTMLDivElement>(null);

  const [selectedCategory, setSelectedCategory] = useState<Category>("All");
  const [timeRange, setTimeRange] = useState("MAX");
  const [selectedOutcome, setSelectedOutcome] = useState<Outcome | null>(null);
  const [showTradingSheet, setShowTradingSheet] = useState(false);
  const [tradeType, setTradeType] = useState<"yes" | "no">("yes");
  const [_activeIndex, setActiveIndex] = useState<number | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [showStickyTitle, setShowStickyTitle] = useState(false);
  const [highlightedOutcomeId, setHighlightedOutcomeId] = useState<string | null>(null);
  const [tvl, setTvl] = useState<number | null>(null);

  // Selected outcome index for multi-outcome markets (Polymarket-style selector)
  const [selectedOutcomeIndex] = useState<number>(0);

  // Khamenei market backward compatibility
  const [selectedKhameneiDate, _setSelectedKhameneiDate] = useState<string>("Mar 31");
  const KHAMENEI_LATEST: Record<string, number> = {
    "Past": 0.08, "Jan 31": 0.12, "Feb 28": 0.18, "Mar 31": 0.495,
  };

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
  } = useLivePrices(marketAddress, 3000); // Poll every 3 seconds for specific market

  // Trade-based price history from Geomi indexer (shows actual trades as step changes)
  // Now properly normalizes all prices when a trade occurs
  const {
    priceHistory: tradePriceHistory,
    currentPrices: tradeCurrentPrices,
    isLoading: _tradeHistoryLoading,
    tradesProcessed,
  } = useTradePriceHistory(
    marketAddress,
    4,  // Support up to 4 outcomes (most common case) - hook handles dynamic
    5000  // Poll every 5 seconds
  );

  // HIGH-FREQUENCY real-time prices for order book (updates 3x per second)
  const {
    prices: realtimePrices,
    totalCollateral: realtimeTvl,
    updateCount: priceUpdateCount,
  } = useRealtimePrices(
    marketAddress,
    300,  // Poll every 300ms = ~3 updates per second
    !!marketAddress  // Only enable when we have a market address
  );

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

  // For trading: use real on-chain market address even when displaying mock data
  // This allows mock UI to trade on real contracts
  const tradingMarket = useMemo(() => {
    if (!market) return null;

    // If market already has a real on-chain ID, use it directly
    if (market.id.startsWith("multi-") || market.id.startsWith("binary-") || market.id.startsWith("0x")) {
      return market;
    }

    // Check if there's a real address mapping for this mock market
    const realAddress = MOCK_TO_REAL_ADDRESS[market.id];
    if (realAddress) {
      // Try to get the actual on-chain market data for accurate pricing
      const realOnChainMarket = getMarket(`multi-${realAddress}`) || getMarket(realAddress);
      if (realOnChainMarket) {
        return realOnChainMarket;
      }

      // Create a trading-ready version with the real address
      return {
        ...market,
        id: `multi-${realAddress}`,
        isMultiOutcome: true,
      };
    }

    return market;
  }, [market, getMarket]);

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
    // Higher resolution for short timeframes to capture rapid trades
    const TIMEFRAME_POINTS: Record<string, number> = {
      '1H': 360,   // 1 point per 10 seconds - captures rapid trading
      '6H': 360,   // 1 point per minute
      '1D': 288,   // 1 point per 5 minutes
      '1W': 168,
      '1M': 180,
      'MAX': 220,
    };
    const pointsToShow = TIMEFRAME_POINTS[timeRange] || 220;

    // Seeded random for consistent volatility patterns
    const seededRandom = (seed: number) => {
      const x = Math.sin(seed * 12345.6789) * 43758.5453;
      return x - Math.floor(x);
    };

    // Use trade-based price history from Geomi (shows actual trade steps)
    // Now properly normalizes all prices when a trade occurs
    // Falls back to livePriceHistory (polling) if no trade data
    const hasTradeHistory = tradePriceHistory.length > 0 && tradesProcessed > 0;
    const hasLivePrices = hasTradeHistory || livePriceHistory.length > 5;
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

        // For VP market, use real Polymarket CSV data
        let basePrices: number[];

        // Use real Polymarket data for all timeframes
        if (timeRange === 'MAX') {
          basePrices = [...realPrices];
        } else {
          const startIdx = Math.max(0, realPrices.length - pointsToShow);
          basePrices = realPrices.slice(startIdx);
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

    // Check if this is a Fed Chair market
    const isFedChairMarket = market?.question?.toLowerCase().includes('fed chair') ||
                             market?.question?.toLowerCase().includes('trump nominate');

    if (isFedChairMarket) {
      // Use real Polymarket Fed Chair historical data
      return FED_CHAIR_CANDIDATES.map((candidateName) => {
        // Get real prices from the Fed Chair historical data
        const realPrices = FED_CHAIR_PRICE_HISTORY.map(point => point.prices[candidateName] || 0.05);

        // Use LATEST_REAL_PRICES for current price
        const currentPrice = LATEST_REAL_PRICES[candidateName] ?? 0.05;

        // Use real historical data for all timeframes
        let basePrices: number[];

        if (timeRange === 'MAX') {
          basePrices = [...realPrices];
        } else {
          // Sample points based on timeframe
          const TIMEFRAME_POINTS: Record<string, number> = {
            '1H': 6,
            '1D': 8,
            '1W': 12,
            '1M': 15,
            'MAX': realPrices.length,
          };
          const targetPoints = TIMEFRAME_POINTS[timeRange] || realPrices.length;
          const startIdx = Math.max(0, realPrices.length - targetPoints);
          basePrices = realPrices.slice(startIdx);
        }

        // Ensure last price matches current real price
        basePrices[basePrices.length - 1] = currentPrice;

        return {
          id: candidateName.toLowerCase().replace(/\s+/g, '-'),
          name: candidateName,
          color: FED_CHAIR_COLORS[candidateName] || "#666",
          prices: basePrices,
        };
      });
    }

    // Check if this is the Khamenei Iran market (by question text)
    // Our on-chain market may have Yes/No outcomes, but we want to show real Polymarket data
    const isKhamenei = market?.question?.toLowerCase().includes('khamenei') ||
                       market?.question?.toLowerCase().includes('iran supreme leader');

    if (isKhamenei) {
      // For SHORT timeframes (1H, 1D): Use LIVE trade data from Geomi
      // For LONG timeframes (1W, 1M, MAX): Use historical CSV data
      const useLiveData = (timeRange === '1H' || timeRange === '1D') && tradePriceHistory.length > 0;

      if (useLiveData) {
        // Use live trade-based price history - outcome 1 is "Mar 31"
        const livePrices = tradePriceHistory.map(p => p.prices[1] || 0.25);
        return [
          {
            id: "yes",
            name: "Mar 31",
            color: "#5b9cf6",
            prices: livePrices.length > 3 ? livePrices : [0.25, 0.25, 0.25], // fallback if no data
          },
        ];
      }

      // For longer timeframes, use historical CSV data
      const dateKey = selectedKhameneiDate === "Past" ? "Jan 31" : selectedKhameneiDate;
      const realPrices = KHAMENEI_PRICE_HISTORY.map((point: { prices: Record<string, number> }) =>
        point.prices[dateKey] || 0.10
      );

      let basePrices: number[];
      const dataPointsAvailable = realPrices.length;

      const TIMEFRAME_DATA_POINTS: Record<string, number> = {
        '1H': 3,
        '1D': 5,
        '1W': 7,
        '1M': 30,
        'MAX': dataPointsAvailable,
      };
      const desiredPoints = TIMEFRAME_DATA_POINTS[timeRange] || dataPointsAvailable;
      const startIdx = Math.max(0, dataPointsAvailable - desiredPoints);
      basePrices = realPrices.slice(startIdx);

      return [
        {
          id: "yes",
          name: "Yes",
          color: "#5b9cf6",
          prices: basePrices,
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

        let yesPrices: number[];

        // For binary markets without historical data, show flat lines at current prices
        if (false) {
          // Placeholder - historical data handling removed for simplicity
          yesPrices = [];
        } else {
          // Fallback: Generate step-like Yes prices (like real trading)
          yesPrices = [];
          let currentPrice = 0.5; // Start at 50%

          // Seeded random for consistent chart
          const seed = market.question.length * 7 + market.id.length;
          const seededRandom = (s: number) => {
            const x = Math.sin(s * 12345.6789) * 43758.5453;
            return x - Math.floor(x);
          };

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
        }
        yesPrices[yesPrices.length - 1] = yesEndPrice;

        // No is EXACTLY 1 - Yes (perfect mirror)
        const noPrices = yesPrices.map(p => 1 - p);

        return [
          { id: yesOutcome.id || 'yes', name: 'Yes', color: '#4abe7a', prices: yesPrices },
          { id: noOutcome.id || 'no', name: 'No', color: '#5b9cf6', prices: noPrices },
        ];
      }

      // Multi-outcome market (3+ options)
      // Generate realistic-looking price history for each outcome

      // Seeded random for consistent charts
      const seed = (market.question?.length || 0) * 7 + (market.id?.length || 0) * 13;
      const seededRandom = (s: number) => {
        const x = Math.sin(s * 12345.6789) * 43758.5453;
        return x - Math.floor(x);
      };

      // Generate realistic price history with volatility (like real Polymarket data)
      const generateRealisticPrices = (
        outcomeIdx: number,
        endPrice: number,
        numOutcomes: number,
        points: number
      ): number[] => {
        const result: number[] = [];
        const outcomeSeed = seed * 100 + outcomeIdx * 17;

        // Each outcome starts at a DIFFERENT price (not all equal!)
        // Distribute starting prices with some variance around equal distribution
        const baseStart = 1 / numOutcomes;
        const startVariance = (seededRandom(outcomeSeed) - 0.5) * 0.15;
        let startPrice = Math.max(0.02, Math.min(0.50, baseStart + startVariance));

        // Generate price path with realistic volatility
        let currentPrice = startPrice;
        const volatility = 0.02 + seededRandom(outcomeSeed + 1) * 0.03; // 2-5% volatility per step

        for (let i = 0; i < points; i++) {
          const progress = i / (points - 1);

          // Trend toward end price with noise
          const targetPrice = startPrice + (endPrice - startPrice) * progress;

          // Add realistic volatility - more at the start, less at the end
          const noiseScale = (1 - progress * 0.7) * volatility;
          const noise = (seededRandom(outcomeSeed * 1000 + i) - 0.5) * noiseScale;

          // Momentum: prices tend to continue in the same direction
          const momentum = i > 0 ? (currentPrice - (result[i - 1] || currentPrice)) * 0.3 : 0;

          // Mean reversion toward target
          const reversion = (targetPrice - currentPrice) * 0.15;

          currentPrice = currentPrice + reversion + noise + momentum;
          currentPrice = Math.max(0.005, Math.min(0.95, currentPrice));

          result.push(currentPrice);
        }

        // Ensure last point matches current on-chain price exactly
        result[result.length - 1] = endPrice;

        return result;
      };

      // Generate FIXED synthetic prices for long-term charts (MAX, 1M)
      // Creates STEP-LIKE patterns that look like real Polymarket trading data
      // Key: long flat periods + clustered sharp jumps, NOT smooth curves
      const generateFixedSyntheticPrices = (
        outcomeIdx: number,
        numOutcomes: number,
        points: number
      ): number[] => {
        const result: number[] = [];
        const outcomeSeed = seed * 100 + outcomeIdx * 17;

        // Fixed starting and ending prices based on seed
        const basePrice = 1 / numOutcomes;
        const startVariance = (seededRandom(outcomeSeed) - 0.5) * 0.12;
        const startPrice = Math.max(0.08, Math.min(0.40, basePrice + startVariance));
        const endVariance = (seededRandom(outcomeSeed + 500) - 0.5) * 0.25;
        const fixedEndPrice = Math.max(0.05, Math.min(0.55, basePrice + endVariance));

        // Create "activity clusters" - periods of high trading followed by calm
        // This mimics real market behavior where news causes bursts of activity
        const numClusters = 3 + Math.floor(seededRandom(outcomeSeed + 1) * 3); // 3-5 clusters
        const clusters: { center: number; width: number; intensity: number }[] = [];

        for (let c = 0; c < numClusters; c++) {
          clusters.push({
            center: Math.floor(seededRandom(outcomeSeed + 50 + c) * points),
            width: 5 + Math.floor(seededRandom(outcomeSeed + 60 + c) * 15), // 5-20 points wide
            intensity: 0.5 + seededRandom(outcomeSeed + 70 + c) * 0.5, // 50-100% intensity
          });
        }

        // Generate events clustered around activity periods
        const events: { point: number; priceChange: number }[] = [];
        const totalEvents = 8 + Math.floor(seededRandom(outcomeSeed + 2) * 12); // 8-20 events total

        for (let e = 0; e < totalEvents; e++) {
          // 70% chance event is in a cluster, 30% random
          const inCluster = seededRandom(outcomeSeed + 100 + e) < 0.7;
          let eventPoint: number;

          if (inCluster && clusters.length > 0) {
            const cluster = clusters[Math.floor(seededRandom(outcomeSeed + 110 + e) * clusters.length)];
            const offset = (seededRandom(outcomeSeed + 120 + e) - 0.5) * cluster.width * 2;
            eventPoint = Math.floor(cluster.center + offset);
          } else {
            eventPoint = Math.floor(seededRandom(outcomeSeed + 130 + e) * points);
          }
          eventPoint = Math.max(0, Math.min(points - 1, eventPoint));

          // Price changes: mostly medium, occasionally large
          const isLargeMove = seededRandom(outcomeSeed + 200 + e) > 0.8;
          const moveSize = isLargeMove
            ? (seededRandom(outcomeSeed + 300 + e) - 0.5) * 0.12  // Large: up to ±6%
            : (seededRandom(outcomeSeed + 300 + e) - 0.5) * 0.05; // Medium: up to ±2.5%

          events.push({ point: eventPoint, priceChange: moveSize });
        }

        // Sort events by point
        events.sort((a, b) => a.point - b.point);

        // Build the step chart
        let currentPrice = startPrice;
        let eventIdx = 0;

        // Calculate trend adjustment to reach end price
        const totalRandomChange = events.reduce((sum, e) => sum + e.priceChange, 0);
        const targetChange = fixedEndPrice - startPrice;
        // Apply trend in discrete steps, not continuously
        const trendSteps = 5;
        const trendPerStep = (targetChange - totalRandomChange) / trendSteps;
        const trendPoints = Array.from({ length: trendSteps }, (_, i) =>
          Math.floor((i + 1) * points / (trendSteps + 1))
        );
        let trendIdx = 0;

        for (let i = 0; i < points; i++) {
          // Apply any events at this point
          while (eventIdx < events.length && events[eventIdx].point <= i) {
            currentPrice += events[eventIdx].priceChange;
            eventIdx++;
          }

          // Apply trend adjustments at specific points (creates discrete steps)
          while (trendIdx < trendPoints.length && trendPoints[trendIdx] <= i) {
            currentPrice += trendPerStep;
            trendIdx++;
          }

          // Clamp price
          currentPrice = Math.max(0.03, Math.min(0.80, currentPrice));
          result.push(currentPrice);
        }

        // Ensure exact end price
        result[result.length - 1] = fixedEndPrice;
        return result;
      };

      const genericResult = market.outcomes.map((outcome, outcomeIdx) => {
        const endPrice = outcome.price; // Current on-chain price
        let prices: number[];

        // MAX and 1M: Use FIXED synthetic data (doesn't change with trades)
        // This makes long-term charts look like a mature market
        if (timeRange === 'MAX' || timeRange === '1M') {
          prices = generateFixedSyntheticPrices(outcomeIdx, market.outcomes?.length || 4, numPoints);
        }
        // 1H, 1D, 1W: Use actual trade history to show real trading activity
        else if (tradePriceHistory.length >= 3) {
          const now = Date.now();
          const timeframeDurations: Record<string, number> = {
            '1H': 60 * 60 * 1000,
            '1D': 24 * 60 * 60 * 1000,
            '1W': 7 * 24 * 60 * 60 * 1000,
          };
          const timeframeDuration = timeframeDurations[timeRange] || timeframeDurations['1D'];
          const startTime = now - timeframeDuration;

          const relevantHistory = tradePriceHistory.filter(p => p.timestamp >= startTime);

          if (relevantHistory.length >= 2) {
            // Build step chart from actual trade history
            prices = [];
            const timePerPoint = timeframeDuration / numPoints;
            const tradesBeforeWindow = tradePriceHistory.filter(p => p.timestamp < startTime);
            let currentPrice = tradesBeforeWindow.length > 0
              ? tradesBeforeWindow[tradesBeforeWindow.length - 1].prices[outcomeIdx] ?? endPrice
              : (1 / (market.outcomes?.length || 4)); // Start at equal distribution

            let historyIdx = 0;
            for (let i = 0; i < numPoints; i++) {
              const pointTime = startTime + (i * timePerPoint);
              while (historyIdx < relevantHistory.length &&
                     relevantHistory[historyIdx].timestamp <= pointTime) {
                currentPrice = relevantHistory[historyIdx].prices[outcomeIdx] ?? currentPrice;
                historyIdx++;
              }
              prices.push(currentPrice);
            }
            // End at current on-chain price
            prices[prices.length - 1] = endPrice;
          } else {
            // Not enough data - show flat line from equal to current
            prices = generateRealisticPrices(outcomeIdx, endPrice, market.outcomes?.length || 4, numPoints);
          }
        } else {
          // No trade history yet - generate realistic synthetic trending to current price
          prices = generateRealisticPrices(outcomeIdx, endPrice, market.outcomes?.length || 4, numPoints);
        }

        // Only set endpoint to current price for short-term charts (not MAX/1M)
        if (timeRange !== 'MAX' && timeRange !== '1M') {
          prices[prices.length - 1] = endPrice;
        }

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
      let yesPrices: number[];
      const endPrice = market.yesPrice;

      // For binary markets without historical data, show flat lines at current prices
      if (false) {
        // Placeholder - historical data handling removed for simplicity
        yesPrices = [];
      } else {
        // Fallback: Generate smooth trend from 50% to current Yes price
        yesPrices = [];
        const startPrice = 0.5;

        for (let i = 0; i < numPoints; i++) {
          const t = i / (numPoints - 1);
          // Smooth S-curve interpolation
          const smoothT = t * t * (3 - 2 * t);
          const price = startPrice + (endPrice - startPrice) * smoothT;
          yesPrices.push(Math.max(0.01, Math.min(0.99, price)));
        }
      }
      yesPrices[yesPrices.length - 1] = endPrice;

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
  }, [market?.outcomes, market?.yesPrice, market?.noPrice, market?.question, timeRange,
      livePriceHistory, tradePriceHistory, tradesProcessed, selectedKhameneiDate,
      // Force recalculation when outcome prices change (shallow comparison of outcomes array isn't enough)
      // eslint-disable-next-line react-hooks/exhaustive-deps
      JSON.stringify(market?.outcomes?.map(o => o.price))]);

  // Sort outcomes by current price (highest probability first)
  const sortedChartOutcomes = useMemo(() => {
    if (!chartOutcomes || chartOutcomes.length === 0) return chartOutcomes;

    // Don't sort binary markets (Yes/No should stay in order)
    if (chartOutcomes.length === 2 &&
        chartOutcomes.some(o => o.name === 'Yes') &&
        chartOutcomes.some(o => o.name === 'No')) {
      return chartOutcomes;
    }

    return [...chartOutcomes].sort((a, b) => {
      const aPrice = a.prices[a.prices.length - 1] || 0;
      const bPrice = b.prices[b.prices.length - 1] || 0;
      return bPrice - aPrice; // Highest first
    });
  }, [chartOutcomes]);


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
      {/* Sticky Header + Category Tabs - same as PolymarketHome */}
      <div className="sticky top-0 z-50" style={{ backgroundColor: '#1c2b3a' }}>
        <PolyHeader />

        <CategoryTabs
          categories={categories}
          selectedCategory={selectedCategory}
          onSelectCategory={setSelectedCategory}
        />
      </div>

      {/* Sticky Header - shows market title when scrolling (positioned below sticky header+tabs ~104px) */}
      <div
        className={`fixed top-[104px] left-0 right-0 z-40 border-b-2 border-[#2c3f4f] transition-all duration-300 ${
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
            {market.isNew && (
              <span className="text-[#22c55e] text-xs font-medium flex items-center gap-1">
                <span className="text-base">✦</span> NEW
              </span>
            )}
            <span style={{ fontSize: '13px', fontWeight: 500, color: '#8297a3', fontFamily: '"Open Sauce One", sans-serif' }}>{market.volume} Vol.</span>
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

        {/* Market Title with Icon + Countdown Timer */}
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
          <div className="flex-1 pt-1">
            <h1 className="text-white" style={{ fontSize: '20px', fontWeight: 600, lineHeight: '25px', fontFamily: '"Open Sauce One", sans-serif' }}>
              {market.question}
            </h1>
          </div>
          {/* Countdown Timer - only for Bitcoin price markets with near-term resolution */}
          {market.endTime && market.question?.toLowerCase().includes('bitcoin') && (
            <CountdownTimer endTime={market.endTime} />
          )}
        </div>

        {/* Outcome Legend - colored dots with prices (shown above chart) */}
        {sortedChartOutcomes && sortedChartOutcomes.length > 0 && (
          <div
            className={`px-4 pb-3 transition-all duration-300 delay-200 ${
              isLoaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
            }`}
          >
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              {sortedChartOutcomes.map((outcome, _index) => {
                const price = outcome.prices[outcome.prices.length - 1] || 0;
                const isHighlighted = highlightedOutcomeId === outcome.id;
                const isOtherHighlighted = highlightedOutcomeId !== null && highlightedOutcomeId !== outcome.id;
                return (
                  <button
                    key={outcome.id}
                    onClick={() => setHighlightedOutcomeId(isHighlighted ? null : outcome.id)}
                    className={`flex items-center gap-1.5 px-2 py-1 rounded-md transition-all cursor-pointer hover:bg-white/10 ${
                      isOtherHighlighted ? 'opacity-40' : 'opacity-100'
                    }`}
                  >
                    <div
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: outcome.color }}
                    />
                    <span className="text-sm text-white">
                      {outcome.name} <span className="font-semibold">{Math.round(price * 100)}%</span>
                    </span>
                  </button>
                );
              })}
            </div>
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
          {/* Floating trade popups on chart */}
          <ChartTradePopups
            trades={combinedTrades}
            maxVisible={5}
            tpsThreshold={100}
          />
        </div>

        {/* Time Range Selector - Polymarket style with volume */}
        <div
          className={`px-4 pb-4 transition-all duration-300 delay-400 ${
            isLoaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
          }`}
        >
          <div className="flex items-center justify-between">
            {/* Volume display like Polymarket */}
            <span className="text-white" style={{ fontSize: '13px', fontWeight: 500, fontFamily: '"Open Sauce One", sans-serif' }}>
              ${tvl ? tvl.toLocaleString(undefined, { maximumFractionDigits: 0 }) : '0'} Vol.
            </span>

            {/* Timeframe buttons */}
            <div className="flex items-center gap-1">
              <div className="flex items-center gap-0.5 bg-transparent">
                {timeRanges.map((range) => (
                  <button
                    key={range}
                    onClick={() => setTimeRange(range)}
                    style={{
                      padding: '4px 6px',
                      fontSize: '13px',
                      fontWeight: 500,
                      fontFamily: '"Open Sauce One", sans-serif',
                      color: timeRange === range ? '#fff' : '#6E7681',
                      borderBottom: timeRange === range ? '2px solid #fff' : '2px solid transparent',
                      transition: 'color 0.15s, border-color 0.15s',
                    }}
                    className="hover:text-gray-300"
                  >
                    {range}
                  </button>
                ))}
              </div>

              {/* Settings gear icon */}
              <button className="p-1.5 ml-2 hover:bg-poly-surface rounded-lg transition-colors">
                <Settings size={16} color="#6E7681" strokeWidth={2} />
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
              // Use REAL-TIME prices (updates 3x/sec) for live order book
              realtimePrices.length > selectedOutcomeIndex
                ? realtimePrices[selectedOutcomeIndex] * 100
                : market?.outcomes?.[selectedOutcomeIndex]?.price
                  ? market.outcomes[selectedOutcomeIndex].price * 100
                  : hftMarketInfo?.yesPrice || market.yesPrice * 100
            }
            noPrice={
              realtimePrices.length > selectedOutcomeIndex
                ? (1 - realtimePrices[selectedOutcomeIndex]) * 100
                : market?.outcomes?.[selectedOutcomeIndex]?.price
                  ? (1 - market.outcomes[selectedOutcomeIndex].price) * 100
                  : hftMarketInfo?.noPrice || market.noPrice * 100
            }
            yesReserve={hftReserves.yesReserve}
            noReserve={hftReserves.noReserve}
            trades={combinedTrades}
            isConnected={hftConnected || combinedTrades.length > 0 || priceUpdateCount > 0}
            isMultiOutcome={!!market?.outcomes}
            tvl={realtimeTvl > 0 ? realtimeTvl : (tvl || 0)}
            outcomes={market?.outcomes?.map(o => o.name) || []}
            onLoadMore={loadMore}
            hasMore={hasMore}
            updateCount={priceUpdateCount}
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

        {/* Outcomes List with Buy Buttons - Polymarket style */}
        {market.outcomes && (
          <div
            className={`px-4 pb-4 transition-all duration-300 delay-500 ${
              isLoaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
            }`}
          >
            {sortedChartOutcomes.map((outcome, index) => {
              // Map "Other" to "Donald Trump Jr." for display
              const displayName = outcome.name === "Other" ? "Donald Trump Jr." : outcome.name;

              // Always use live on-chain price
              const realPrice = outcome.prices[outcome.prices.length - 1] || 0;
              const yesPrice = Math.round(realPrice * 100);
              const noPrice = 100 - yesPrice;
              const yesPriceDisplay = yesPrice < 1 ? `${(realPrice * 100).toFixed(1)}` : yesPrice.toString();
              const noPriceDisplay = noPrice < 1 ? `${((1 - realPrice) * 100).toFixed(1)}` : noPrice.toString();

              // Calculate proportional volume based on outcome's share of market
              const parseVolume = (vol: string): number => {
                const num = parseFloat(vol.replace(/[$,]/g, ''));
                if (vol.includes('M')) return num * 1_000_000;
                if (vol.includes('K')) return num * 1_000;
                return num;
              };
              const totalVol = parseVolume(market.volume || "0");
              const outcomeVol = totalVol * realPrice;
              const volumeDisplay = outcomeVol >= 1_000_000
                ? `$${(outcomeVol / 1_000_000).toFixed(0).replace(/\.0$/, '')}M`
                : outcomeVol >= 1_000
                  ? `$${Math.round(outcomeVol).toLocaleString()}`
                  : `$${Math.round(outcomeVol)}`;

              return (
                <div
                  key={outcome.id}
                  className={`py-4 border-b border-[#2c3f4f] last:border-b-0 transition-all duration-300`}
                  style={{ transitionDelay: `${550 + index * 100}ms` }}
                >
                  {/* Outcome name + volume on left, big percentage on right */}
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="text-white" style={{ fontSize: '18px', fontWeight: 600, fontFamily: '"Open Sauce One", sans-serif' }}>
                        {displayName}
                      </h3>
                      <p style={{ fontSize: '14px', fontWeight: 400, color: '#8297a3', fontFamily: '"Open Sauce One", sans-serif' }}>
                        {volumeDisplay} Vol.
                      </p>
                    </div>
                    {/* Big faded percentage on right - Polymarket style */}
                    <span style={{ fontSize: '36px', fontWeight: 300, color: '#6b7a8a', fontFamily: '"Open Sauce One", sans-serif' }}>
                      {yesPrice < 1 ? `<1%` : `${yesPrice}%`}
                    </span>
                  </div>

                  {/* Buy Yes / Buy No buttons */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        const mo = market.outcomes?.find(o => o.id === outcome.id || o.name === outcome.name); if (mo) setSelectedOutcome(mo);
                        setTradeType('yes');
                        setShowTradingSheet(true);
                      }}
                      className="flex-1"
                      style={{
                        height: '44px',
                        backgroundColor: 'rgba(59, 171, 104, 0.15)',
                        borderRadius: '6px',
                        fontSize: '15px',
                        fontWeight: 600,
                        fontFamily: '"Open Sauce One", sans-serif',
                        color: '#3dac67',
                        border: 'none',
                        cursor: 'pointer',
                      }}
                    >
                      Buy Yes {yesPriceDisplay}¢
                    </button>
                    <button
                      onClick={() => {
                        const mo = market.outcomes?.find(o => o.id === outcome.id || o.name === outcome.name); if (mo) setSelectedOutcome(mo);
                        setTradeType('no');
                        setShowTradingSheet(true);
                      }}
                      className="flex-1"
                      style={{
                        height: '44px',
                        backgroundColor: 'rgba(225, 55, 55, 0.15)',
                        borderRadius: '6px',
                        fontSize: '15px',
                        fontWeight: 600,
                        fontFamily: '"Open Sauce One", sans-serif',
                        color: '#e13836',
                        border: 'none',
                        cursor: 'pointer',
                      }}
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

      {/* Sticky Buy Yes/No buttons above bottom navbar - Polymarket exact style */}
      {isKhameneiMarket && (
        <div
          className="fixed left-0 right-0 z-50 px-4"
          style={{ backgroundColor: '#1c2b3a', bottom: '60px' }}
        >
          <div className="max-w-4xl mx-auto flex gap-2 py-2">
            {(() => {
              // Map selected date to outcome index
              const dateToOutcome: Record<string, number> = {
                "Jan 31": 0, "Mar 31": 1, "Jun 30": 2, "Dec 31": 3, "Past": 0
              };
              const outcomeIdx = dateToOutcome[selectedKhameneiDate] ?? 1;
              const outcome = market?.outcomes?.[outcomeIdx];
              const livePrice = tradeCurrentPrices[outcomeIdx];
              const displayPrice = livePrice !== undefined ? livePrice : (KHAMENEI_LATEST[selectedKhameneiDate] || 0);
              const yesPrice = Math.round(displayPrice * 100);
              const noPrice = 100 - yesPrice;

              return (
                <>
                  <button
                    onClick={() => {
                      if (outcome) { const mo = market.outcomes?.find(o => o.id === outcome.id || o.name === outcome.name); if (mo) setSelectedOutcome(mo); }
                      setTradeType('yes');
                      setShowTradingSheet(true);
                    }}
                    className="flex-1"
                    style={{
                      height: '44px',
                      backgroundColor: 'rgb(59, 171, 104)',
                      borderRadius: '7.6px',
                      fontSize: '16px',
                      fontWeight: 400,
                      fontFamily: '"Open Sauce One", sans-serif',
                      color: '#ffffff',
                      border: 'none',
                      cursor: 'pointer',
                    }}
                  >
                    Buy Yes {yesPrice}¢
                  </button>
                  <button
                    onClick={() => {
                      if (outcome) { const mo = market.outcomes?.find(o => o.id === outcome.id || o.name === outcome.name); if (mo) setSelectedOutcome(mo); }
                      setTradeType('no');
                      setShowTradingSheet(true);
                    }}
                    className="flex-1"
                    style={{
                      height: '44px',
                      backgroundColor: 'rgb(225, 55, 55)',
                      borderRadius: '7.6px',
                      fontSize: '16px',
                      fontWeight: 400,
                      fontFamily: '"Open Sauce One", sans-serif',
                      color: '#ffffff',
                      border: 'none',
                      cursor: 'pointer',
                    }}
                  >
                    Buy No {noPrice}¢
                  </button>
                </>
              );
            })()}
          </div>
        </div>
      )}

      {/* Trading Sheet - use tradingMarket for real on-chain trades */}
      <TradingSheet
        market={tradingMarket || market}
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
