import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { motion } from "framer-motion";
import { ArrowUp, Search, Eye, EyeOff, RefreshCw, ExternalLink, TrendingUp, TrendingDown, Loader2 } from "lucide-react";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { Aptos, AptosConfig, Network } from "@aptos-labs/ts-sdk";
import { PolyHeader } from "./PolyHeader";
import { CategoryTabs } from "./CategoryTabs";
import { categories } from "./mockData";
import type { Category } from "./types";

// Initialize Aptos client
const aptos = new Aptos(new AptosConfig({ network: Network.TESTNET }));

// Trade history item type
interface TradeHistoryItem {
  hash: string;
  type: 'buy' | 'sell';
  outcome: string;
  amount: number;
  timestamp: number;
  success: boolean;
}

// Balance history entry type
interface BalanceHistoryEntry {
  timestamp: number;
  balance: number;
}

// Storage key for balance history
const BALANCE_HISTORY_KEY = 'portfolio_balance_history';

// Get balance history from localStorage
function getBalanceHistory(): BalanceHistoryEntry[] {
  try {
    const stored = localStorage.getItem(BALANCE_HISTORY_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.error('Error reading balance history:', e);
  }
  return [];
}

// Save balance to history
function saveBalanceToHistory(balance: number) {
  try {
    const history = getBalanceHistory();
    const now = Date.now();

    // Only save if balance changed or hasn't been saved in last 30 seconds
    const lastEntry = history[history.length - 1];
    if (!lastEntry || lastEntry.balance !== balance || now - lastEntry.timestamp > 30000) {
      history.push({ timestamp: now, balance });

      // Keep only last 500 entries (roughly 4 hours of data at 30s intervals)
      const trimmed = history.slice(-500);
      localStorage.setItem(BALANCE_HISTORY_KEY, JSON.stringify(trimmed));
    }
  } catch (e) {
    console.error('Error saving balance history:', e);
  }
}

// Polymarket Logo for branding (using official logo)
function PolymarketBrand() {
  return (
    <div className="flex items-center gap-2 text-[#5a6a7a]">
      <img src="/images/icon-white.svg" alt="Polymarket" className="w-6 h-6 opacity-60" />
      <span className="text-base font-medium">Polymarket</span>
    </div>
  );
}

const CHART_HEIGHT = 120;
const CHART_PADDING_RIGHT = 10;

// Interactive Profit/Loss Chart with hover states
function ProfitChart({
  timeRange,
  balance,
  onHoverValue,
}: {
  timeRange: string;
  balance: number;
  onHoverValue?: (value: { balance: number; pnl: number; timestamp: number } | null) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [cursorX, setCursorX] = useState<number>(0);
  const [isTouching, setIsTouching] = useState(false);
  const [chartWidth, setChartWidth] = useState(300);

  // Get balance history and filter by time range
  const chartData = useMemo(() => {
    const history = getBalanceHistory();
    const now = Date.now();

    // Filter by time range
    let cutoffTime = 0;
    switch (timeRange) {
      case '1D': cutoffTime = now - 24 * 60 * 60 * 1000; break;
      case '1W': cutoffTime = now - 7 * 24 * 60 * 60 * 1000; break;
      case '1M': cutoffTime = now - 30 * 24 * 60 * 60 * 1000; break;
      default: cutoffTime = 0; // ALL
    }

    let filtered = history.filter(h => h.timestamp >= cutoffTime);

    // If no history, create synthetic data based on current balance
    if (filtered.length < 2 && balance > 0) {
      const startTime = cutoffTime || now - 30 * 24 * 60 * 60 * 1000;
      filtered = [
        { timestamp: startTime, balance: 0 },
        { timestamp: now, balance },
      ];
    } else if (filtered.length < 2) {
      // No balance, show flat line
      filtered = [
        { timestamp: now - 1000, balance: 0 },
        { timestamp: now, balance: 0 },
      ];
    }

    return filtered;
  }, [timeRange, balance]);

  // Calculate PNL
  const { startBalance, isPositive } = useMemo(() => {
    const start = chartData[0]?.balance || 0;
    const end = chartData[chartData.length - 1]?.balance || balance;
    const pnlValue = end - start;
    return {
      startBalance: start,
      isPositive: pnlValue >= 0,
    };
  }, [chartData, balance]);

  // Chart sizing
  useEffect(() => {
    const updateWidth = () => {
      if (containerRef.current) {
        setChartWidth(containerRef.current.offsetWidth);
      }
    };
    updateWidth();
    window.addEventListener('resize', updateWidth);
    return () => window.removeEventListener('resize', updateWidth);
  }, []);

  const innerWidth = chartWidth - CHART_PADDING_RIGHT;

  // Calculate Y-axis range
  const { yMin, yMax } = useMemo(() => {
    const balances = chartData.map(d => d.balance);
    const dataMin = Math.min(...balances);
    const dataMax = Math.max(...balances);
    const range = dataMax - dataMin;
    const padding = Math.max(range * 0.1, 5); // At least $5 padding

    return {
      yMin: Math.max(0, dataMin - padding),
      yMax: dataMax + padding,
    };
  }, [chartData]);

  // Generate SVG path
  const { path, fillPath, points } = useMemo(() => {
    if (chartData.length < 2) return { path: '', fillPath: '', points: [] };

    const points: { x: number; y: number; data: BalanceHistoryEntry }[] = [];

    for (let i = 0; i < chartData.length; i++) {
      const d = chartData[i];
      const x = (i / (chartData.length - 1)) * innerWidth;
      const yRange = yMax - yMin || 1;
      const y = CHART_HEIGHT - ((d.balance - yMin) / yRange) * CHART_HEIGHT;
      points.push({ x, y, data: d });
    }

    // Line path
    let path = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
      path += ` L ${points[i].x} ${points[i].y}`;
    }

    // Fill path (for gradient area)
    let fillPath = path;
    fillPath += ` L ${points[points.length - 1].x} ${CHART_HEIGHT}`;
    fillPath += ` L ${points[0].x} ${CHART_HEIGHT}`;
    fillPath += ' Z';

    return { path, fillPath, points };
  }, [chartData, innerWidth, yMin, yMax]);

  // Calculate position from x coordinate
  const updatePosition = useCallback(
    (clientX: number) => {
      if (!containerRef.current || points.length === 0) return;
      const rect = containerRef.current.getBoundingClientRect();
      const x = Math.max(0, Math.min(innerWidth, clientX - rect.left));
      setCursorX(x);

      // Find closest point
      let closestIdx = 0;
      let closestDist = Infinity;
      for (let i = 0; i < points.length; i++) {
        const dist = Math.abs(points[i].x - x);
        if (dist < closestDist) {
          closestDist = dist;
          closestIdx = i;
        }
      }

      setActiveIndex(closestIdx);

      if (onHoverValue && points[closestIdx]) {
        const point = points[closestIdx];
        onHoverValue({
          balance: point.data.balance,
          pnl: point.data.balance - startBalance,
          timestamp: point.data.timestamp,
        });
      }
    },
    [innerWidth, points, onHoverValue, startBalance]
  );

  // Event handlers
  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (isTouching) return;
      updatePosition(e.clientX);
    },
    [updatePosition, isTouching]
  );

  const handleMouseLeave = useCallback(() => {
    if (isTouching) return;
    setActiveIndex(null);
    onHoverValue?.(null);
  }, [onHoverValue, isTouching]);

  const handleTouchStart = useCallback(
    (e: React.TouchEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsTouching(true);
      if (e.touches.length > 0) {
        updatePosition(e.touches[0].clientX);
      }
    },
    [updatePosition]
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent<HTMLDivElement>) => {
      e.preventDefault();
      if (e.touches.length > 0) {
        updatePosition(e.touches[0].clientX);
      }
    },
    [updatePosition]
  );

  const handleTouchEnd = useCallback(() => {
    setIsTouching(false);
    setActiveIndex(null);
    onHoverValue?.(null);
  }, [onHoverValue]);

  // Line/fill colors based on PNL
  const lineColor = isPositive ? '#22c55e' : '#ef4444';
  const gradientId = `pnl-gradient-${isPositive ? 'up' : 'down'}`;

  return (
    <div
      ref={containerRef}
      className="relative cursor-crosshair select-none"
      style={{
        height: CHART_HEIGHT,
        touchAction: 'none',
        WebkitUserSelect: 'none',
        WebkitTouchCallout: 'none',
      }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
    >
      <svg width="100%" height={CHART_HEIGHT}>
        {/* Gradient definition */}
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={lineColor} stopOpacity="0.3" />
            <stop offset="100%" stopColor={lineColor} stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Grid lines */}
        {[0, 0.5, 1].map((pct) => (
          <line
            key={pct}
            x1={0}
            y1={CHART_HEIGHT * (1 - pct)}
            x2={chartWidth}
            y2={CHART_HEIGHT * (1 - pct)}
            stroke="#3d5060"
            strokeWidth={1}
            strokeDasharray="4,6"
            opacity={0.3}
          />
        ))}

        {/* Fill area */}
        <path d={fillPath} fill={`url(#${gradientId})`} />

        {/* Main line */}
        <path
          d={path}
          stroke={lineColor}
          strokeWidth={2.5}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* End point with pulse */}
        {points.length > 0 && (
          <g>
            <circle
              cx={points[points.length - 1].x}
              cy={points[points.length - 1].y}
              r={8}
              fill={lineColor}
              opacity={0.3}
            >
              <animate attributeName="r" values="5;12;5" dur="1.5s" repeatCount="indefinite" />
              <animate attributeName="opacity" values="0.4;0;0.4" dur="1.5s" repeatCount="indefinite" />
            </circle>
            <circle
              cx={points[points.length - 1].x}
              cy={points[points.length - 1].y}
              r={5}
              fill={lineColor}
              stroke="#1c2b3a"
              strokeWidth={2}
            />
          </g>
        )}

        {/* Hover point */}
        {activeIndex !== null && points[activeIndex] && (
          <circle
            cx={points[activeIndex].x}
            cy={points[activeIndex].y}
            r={6}
            fill={lineColor}
            stroke="white"
            strokeWidth={2}
          />
        )}
      </svg>

      {/* Cursor line */}
      {activeIndex !== null && (
        <div
          className="absolute top-0 pointer-events-none"
          style={{
            left: cursorX,
            height: CHART_HEIGHT,
            width: 1,
            backgroundColor: 'rgba(255, 255, 255, 0.6)',
          }}
        />
      )}
    </div>
  );
}

// Main Portfolio Page Component
export function PortfolioPage() {
  const { account, connected } = useWallet();
  const [selectedCategory, setSelectedCategory] = useState<Category>("All");
  const [activeTab, setActiveTab] = useState<"positions" | "orders" | "history">("positions");
  const [timeRange, setTimeRange] = useState("1M");
  const [showBalance, setShowBalance] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [balance, setBalance] = useState<number>(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [trades, setTrades] = useState<TradeHistoryItem[]>([]);
  const [isLoadingTrades, setIsLoadingTrades] = useState(false);
  const [hoverValue, setHoverValue] = useState<{ balance: number; pnl: number; timestamp: number } | null>(null);

  const timeRanges = ["1D", "1W", "1M", "ALL"];

  // Save balance to history when it changes
  useEffect(() => {
    if (balance > 0) {
      saveBalanceToHistory(balance);
    }
  }, [balance]);

  // Contract addresses for filtering trades
  const MARKET_CONTRACTS = [
    "0x3f13249e31a1fbdb886741f7945cccc40307311abc08ba188894bd1a050e19b4", // binary market
    "0xa2e5e47aab07fed78a3bcf95135ee2dad20c547499c94cb16a3e047859ffa7e1", // multi-outcome market
  ];

  // Fetch wallet balance (supports both legacy CoinStore and new Fungible Assets)
  const fetchBalance = useCallback(async () => {
    if (!connected || !account?.address) {
      setBalance(0);
      return;
    }

    try {
      setIsRefreshing(true);
      const address = account.address.toString();

      // Try new Fungible Asset balance first (APT metadata is at 0xa)
      try {
        const faBalance = await aptos.getAccountAPTAmount({ accountAddress: address });
        setBalance(faBalance / 100_000_000);
        return;
      } catch {
        // Fall back to legacy CoinStore
      }

      // Legacy CoinStore fallback
      try {
        const resources = await aptos.getAccountResource({
          accountAddress: address,
          resourceType: "0x1::coin::CoinStore<0x1::aptos_coin::AptosCoin>",
        });
        const balanceOctas = (resources as any).coin?.value || 0;
        setBalance(Number(balanceOctas) / 100_000_000);
      } catch {
        setBalance(0);
      }
    } catch (error) {
      console.error("Error fetching balance:", error);
      setBalance(0);
    } finally {
      setIsRefreshing(false);
    }
  }, [connected, account?.address]);

  // Fetch balance on mount and when account changes
  useEffect(() => {
    fetchBalance();
    // Also set up interval to refresh every 10 seconds
    const interval = setInterval(fetchBalance, 10000);
    return () => clearInterval(interval);
  }, [fetchBalance]);

  // Listen for wallet funded events to refresh immediately
  useEffect(() => {
    const handleWalletFunded = () => {
      // Small delay to allow blockchain to update
      setTimeout(fetchBalance, 1000);
    };

    window.addEventListener('wallet-funded', handleWalletFunded);
    return () => window.removeEventListener('wallet-funded', handleWalletFunded);
  }, [fetchBalance]);

  // Fetch trade history
  const fetchTrades = useCallback(async () => {
    if (!connected || !account?.address) {
      setTrades([]);
      return;
    }

    try {
      setIsLoadingTrades(true);
      const address = account.address.toString();

      // Fetch recent transactions for this account
      const transactions = await aptos.getAccountTransactions({
        accountAddress: address,
        options: { limit: 50 },
      });

      // Filter for market contract interactions
      const marketTrades: TradeHistoryItem[] = [];

      for (const tx of transactions) {
        if (tx.type !== 'user_transaction') continue;

        const userTx = tx as any;
        const payload = userTx.payload;

        if (payload?.type !== 'entry_function_payload') continue;

        const func = payload.function || '';
        const isMarketTx = MARKET_CONTRACTS.some(addr => func.includes(addr));

        if (isMarketTx) {
          // Parse the function name to determine trade type
          const funcName = func.split('::').pop() || '';
          let tradeType: 'buy' | 'sell' = 'buy';
          let outcome = '';

          if (funcName.includes('buy_yes') || funcName.includes('buy_outcome')) {
            tradeType = 'buy';
            outcome = funcName.includes('yes') ? 'Yes' : `Outcome ${payload.arguments?.[1] || 0}`;
          } else if (funcName.includes('buy_no')) {
            tradeType = 'buy';
            outcome = 'No';
          } else if (funcName.includes('sell_yes') || funcName.includes('sell_outcome')) {
            tradeType = 'sell';
            outcome = funcName.includes('yes') ? 'Yes' : `Outcome ${payload.arguments?.[1] || 0}`;
          } else if (funcName.includes('sell_no')) {
            tradeType = 'sell';
            outcome = 'No';
          } else {
            continue; // Not a buy/sell transaction
          }

          // Parse amount from arguments (usually in octas)
          const amountArg = payload.arguments?.[1] || payload.arguments?.[2] || '0';
          const amountOctas = parseInt(amountArg, 10);
          const amountAPT = amountOctas / 100_000_000;

          marketTrades.push({
            hash: userTx.hash,
            type: tradeType,
            outcome,
            amount: amountAPT,
            timestamp: parseInt(userTx.timestamp, 10) / 1000, // Convert to seconds
            success: userTx.success,
          });
        }
      }

      setTrades(marketTrades);
    } catch (error) {
      console.error("Error fetching trades:", error);
      setTrades([]);
    } finally {
      setIsLoadingTrades(false);
    }
  }, [connected, account?.address, MARKET_CONTRACTS]);

  // Fetch trades when tab changes to history
  useEffect(() => {
    if (activeTab === 'history') {
      fetchTrades();
    }
  }, [activeTab, fetchTrades]);

  // Format balance for display
  const formatBalance = (val: number) => {
    if (val >= 1000) {
      return `$${val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
    return `$${val.toFixed(2)}`;
  };

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
            {/* Cash Badge with Refresh */}
            <div className="flex items-center gap-2">
              <button
                onClick={fetchBalance}
                disabled={isRefreshing}
                className="p-1.5 hover:bg-[#2a3d52] rounded-lg transition-colors"
              >
                <RefreshCw
                  size={16}
                  className={`text-[#8297a3] ${isRefreshing ? 'animate-spin' : ''}`}
                />
              </button>
              <div className="flex items-center gap-2 bg-[#2a3d52] px-3 py-1.5 rounded-full">
                <span className="text-lg">💵</span>
                <span className="text-[#22c55e] text-base font-semibold">
                  {showBalance ? formatBalance(balance) : "••••"}
                </span>
              </div>
            </div>
          </div>

          {/* Portfolio Value */}
          <div className="mb-1">
            <span className="text-white text-4xl font-bold">
              {showBalance ? formatBalance(balance) : "••••••"}
            </span>
          </div>
          <span className="text-[#8297a3] text-base">{connected ? "APT Balance" : "Connect wallet"}</span>

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
              {/* Dynamic arrow based on PNL */}
              <span className={hoverValue ? (hoverValue.pnl >= 0 ? "text-[#22c55e]" : "text-[#ef4444]") : "text-[#22c55e]"}>
                {hoverValue ? (hoverValue.pnl >= 0 ? "▲" : "▼") : "▲"}
              </span>
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
              {/* Show hover value or current balance */}
              <span className="text-white text-3xl font-bold">
                {hoverValue ? formatBalance(hoverValue.balance) : formatBalance(balance)}
              </span>
              {/* Show PNL change when hovering */}
              {hoverValue && (
                <span className={`ml-2 text-lg font-semibold ${hoverValue.pnl >= 0 ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>
                  {hoverValue.pnl >= 0 ? '+' : ''}{formatBalance(hoverValue.pnl)}
                </span>
              )}
              {/* Show date/time when hovering, otherwise show time period */}
              <p className="text-[#8297a3] text-base mt-1">
                {hoverValue
                  ? new Date(hoverValue.timestamp).toLocaleString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      hour: 'numeric',
                      minute: '2-digit',
                    })
                  : timeRange === '1D' ? 'Past Day' : timeRange === '1W' ? 'Past Week' : timeRange === '1M' ? 'Past Month' : 'All Time'
                }
              </p>
            </div>
            <PolymarketBrand />
          </div>

          <ProfitChart
            timeRange={timeRange}
            balance={balance}
            onHoverValue={setHoverValue}
          />
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

        {/* Content based on active tab */}
        {activeTab === "history" ? (
          <div className="space-y-3">
            {isLoadingTrades ? (
              <div className="text-center py-12">
                <Loader2 size={24} className="animate-spin text-[#8297a3] mx-auto" />
                <p className="text-[#8297a3] text-base mt-2">Loading trades...</p>
              </div>
            ) : trades.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-[#8297a3] text-base">No trades found.</p>
                <p className="text-[#6b7a8a] text-sm mt-1">Your market trades will appear here.</p>
              </div>
            ) : (
              trades.map((trade) => (
                <div
                  key={trade.hash}
                  className="bg-poly-card rounded-lg p-4 border border-[#2c3f4f]"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${
                        trade.type === 'buy' ? 'bg-green-500/20' : 'bg-red-500/20'
                      }`}>
                        {trade.type === 'buy' ? (
                          <TrendingUp size={18} className="text-green-500" />
                        ) : (
                          <TrendingDown size={18} className="text-red-500" />
                        )}
                      </div>
                      <div>
                        <p className="text-white font-medium">
                          {trade.type === 'buy' ? 'Bought' : 'Sold'} {trade.outcome}
                        </p>
                        <p className="text-[#6b7a8a] text-sm">
                          {new Date(trade.timestamp * 1000).toLocaleString()}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`font-semibold ${
                        trade.type === 'buy' ? 'text-green-500' : 'text-red-500'
                      }`}>
                        {trade.type === 'buy' ? '-' : '+'}{trade.amount.toFixed(2)} APT
                      </p>
                      <a
                        href={`https://explorer.aptoslabs.com/txn/${trade.hash}?network=testnet`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[#3b82f6] text-xs flex items-center gap-1 justify-end hover:text-[#60a5fa]"
                      >
                        View <ExternalLink size={10} />
                      </a>
                    </div>
                  </div>
                  {!trade.success && (
                    <div className="mt-2 text-red-400 text-xs">Transaction failed</div>
                  )}
                </div>
              ))
            )}
          </div>
        ) : (
          <div className="text-center py-12">
            <p className="text-[#8297a3] text-base">
              {activeTab === "positions" ? "No positions found." : "No open orders."}
            </p>
          </div>
        )}
      </div>
    </motion.div>
  );
}
