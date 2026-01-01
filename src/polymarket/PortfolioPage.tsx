import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { motion } from "framer-motion";
import { ArrowUp, Search, Eye, EyeOff, RefreshCw, ExternalLink, TrendingUp, TrendingDown, Loader2 } from "lucide-react";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { Aptos, AptosConfig, Network } from "@aptos-labs/ts-sdk";
import { PolyHeader } from "./PolyHeader";

// Initialize Aptos client
const aptos = new Aptos(new AptosConfig({ network: Network.TESTNET }));

// Contract addresses (moved outside component to prevent re-renders)
const CONTRACT_ADDRESS = "0xa2e5e47aab07fed78a3bcf95135ee2dad20c547499c94cb16a3e047859ffa7e1";
const MARKET_ADDRESS = "0xfefd1b67818ee4ef12a7953852c83f0efb411a9b92c518a52ba92555e4abdd96";
const MARKET_CONTRACTS = [
  "0x3f13249e31a1fbdb886741f7945cccc40307311abc08ba188894bd1a050e19b4", // binary market
  CONTRACT_ADDRESS, // multi-outcome market
];

// Trade history item type
interface TradeHistoryItem {
  hash: string;
  type: 'buy' | 'sell';
  outcome: string;
  amount: number;
  timestamp: number;
  success: boolean;
}

// Position item type with full PNL tracking
interface PositionItem {
  outcomeIndex: number;
  outcomeName: string;
  tokens: number;
  currentPrice: number;      // Current price (0-100)
  entryPrice: number;        // Average entry price (0-100)
  costBasis: number;         // Total APT spent
  currentValue: number;      // Current value in APT
  pnl: number;               // Profit/Loss in APT
  pnlPercent: number;        // PNL as percentage
  priceHistory: number[];    // Price history for sparkline
}

// Trade record for cost basis tracking
interface TradeRecord {
  timestamp: number;
  outcomeIndex: number;
  outcomeName: string;
  type: 'buy' | 'sell';
  tokens: number;
  pricePerToken: number;     // Price at time of trade (0-100)
  totalCost: number;         // APT spent/received
  txHash: string;
}

// Position snapshot for history
interface PositionSnapshot {
  timestamp: number;
  outcomeIndex: number;
  tokens: number;
  price: number;
  value: number;
}

// Balance history entry type
interface BalanceHistoryEntry {
  timestamp: number;
  balance: number;
}

// Storage keys
const BALANCE_HISTORY_KEY = 'portfolio_balance_history';
const TRADE_RECORDS_KEY = 'portfolio_trade_records';
const POSITION_HISTORY_KEY = 'portfolio_position_history';

// Get trade records from localStorage
function getTradeRecords(): TradeRecord[] {
  try {
    const stored = localStorage.getItem(TRADE_RECORDS_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.error('Error reading trade records:', e);
  }
  return [];
}

// Save trade record
function saveTradeRecord(trade: TradeRecord) {
  try {
    const records = getTradeRecords();
    // Check if trade already exists (by txHash)
    if (!records.find(r => r.txHash === trade.txHash)) {
      records.push(trade);
      // Keep last 1000 trades
      const trimmed = records.slice(-1000);
      localStorage.setItem(TRADE_RECORDS_KEY, JSON.stringify(trimmed));
    }
  } catch (e) {
    console.error('Error saving trade record:', e);
  }
}

// Get position history for sparklines
function getPositionHistory(outcomeIndex: number): PositionSnapshot[] {
  try {
    const stored = localStorage.getItem(POSITION_HISTORY_KEY);
    if (stored) {
      const all: PositionSnapshot[] = JSON.parse(stored);
      return all.filter(p => p.outcomeIndex === outcomeIndex);
    }
  } catch (e) {
    console.error('Error reading position history:', e);
  }
  return [];
}

// Save position snapshot (called periodically)
function savePositionSnapshot(snapshot: PositionSnapshot) {
  try {
    const stored = localStorage.getItem(POSITION_HISTORY_KEY);
    const all: PositionSnapshot[] = stored ? JSON.parse(stored) : [];

    // Only save if value changed or hasn't been saved in last minute
    const lastForOutcome = all.filter(p => p.outcomeIndex === snapshot.outcomeIndex).pop();
    const now = Date.now();
    if (!lastForOutcome ||
        Math.abs(lastForOutcome.value - snapshot.value) > 0.01 ||
        now - lastForOutcome.timestamp > 60000) {
      all.push(snapshot);
      // Keep last 2000 snapshots across all positions
      const trimmed = all.slice(-2000);
      localStorage.setItem(POSITION_HISTORY_KEY, JSON.stringify(trimmed));
    }
  } catch (e) {
    console.error('Error saving position snapshot:', e);
  }
}

// Calculate cost basis and average entry price for an outcome
function calculateCostBasis(outcomeIndex: number): { costBasis: number; avgEntryPrice: number; totalTokensBought: number } {
  const trades = getTradeRecords().filter(t => t.outcomeIndex === outcomeIndex);

  let totalCost = 0;
  let totalTokensBought = 0;
  let totalTokensSold = 0;

  for (const trade of trades) {
    if (trade.type === 'buy') {
      totalCost += trade.totalCost;
      totalTokensBought += trade.tokens;
    } else {
      // For sells, reduce proportionally
      totalTokensSold += trade.tokens;
    }
  }

  const netTokens = totalTokensBought - totalTokensSold;
  const avgEntryPrice = netTokens > 0 ? (totalCost / totalTokensBought) * 100 : 0;
  const adjustedCostBasis = netTokens > 0 ? (totalCost * (netTokens / totalTokensBought)) : 0;

  return {
    costBasis: adjustedCostBasis,
    avgEntryPrice,
    totalTokensBought: netTokens,
  };
}

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

// Export saveTradeRecord for use in TradingSheet
export { saveTradeRecord };
export type { TradeRecord };

// Mini Sparkline chart for position PNL
function PositionSparkline({ data, isPositive }: { data: number[]; isPositive: boolean }) {
  if (data.length < 2) {
    // Show flat line if not enough data
    return (
      <svg width="60" height="24" className="flex-shrink-0">
        <line x1="0" y1="12" x2="60" y2="12" stroke="#4a5568" strokeWidth="1.5" />
      </svg>
    );
  }

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  const points = data.map((value, i) => {
    const x = (i / (data.length - 1)) * 60;
    const y = 22 - ((value - min) / range) * 20;
    return `${x},${y}`;
  }).join(' ');

  const color = isPositive ? '#22c55e' : '#ef4444';

  return (
    <svg width="60" height="24" className="flex-shrink-0">
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* End dot */}
      <circle
        cx={(data.length - 1) / (data.length - 1) * 60}
        cy={22 - ((data[data.length - 1] - min) / range) * 20}
        r="2.5"
        fill={color}
      />
    </svg>
  );
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
  const [activeTab, setActiveTab] = useState<"positions" | "orders" | "history">("positions");
  const [timeRange, setTimeRange] = useState("1M");
  const [showBalance, setShowBalance] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [balance, setBalance] = useState<number>(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [trades, setTrades] = useState<TradeHistoryItem[]>([]);
  const [isLoadingTrades, setIsLoadingTrades] = useState(false);
  const [hoverValue, setHoverValue] = useState<{ balance: number; pnl: number; timestamp: number } | null>(null);
  const [positions, setPositions] = useState<PositionItem[]>([]);
  const [isLoadingPositions, setIsLoadingPositions] = useState(false);

  const timeRanges = ["1D", "1W", "1M", "ALL"];

  // Calculate total portfolio value (wallet + positions)
  const totalPortfolioValue = useMemo(() => {
    const positionValue = positions.reduce((sum, p) => sum + p.currentValue, 0);
    return balance + positionValue;
  }, [balance, positions]);

  // Save total portfolio value to history when it changes
  useEffect(() => {
    if (totalPortfolioValue > 0) {
      saveBalanceToHistory(totalPortfolioValue);
    }
  }, [totalPortfolioValue]);

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

  // Fetch user positions from the market contract
  const fetchPositions = useCallback(async () => {
    if (!connected || !account?.address) {
      setPositions([]);
      return;
    }

    try {
      setIsLoadingPositions(true);
      const userAddress = account.address.toString();

      // Get outcome labels
      const labelsResult = await aptos.view({
        payload: {
          function: `${CONTRACT_ADDRESS}::multi_outcome_market::get_outcome_labels`,
          typeArguments: [],
          functionArguments: [MARKET_ADDRESS],
        },
      });
      const labels = labelsResult[0] as string[];

      // Get user positions (token balances for each outcome)
      const positionsResult = await aptos.view({
        payload: {
          function: `${CONTRACT_ADDRESS}::multi_outcome_market::get_user_multi_positions`,
          typeArguments: [],
          functionArguments: [MARKET_ADDRESS, userAddress],
        },
      });
      const tokenBalances = (positionsResult[0] as string[]).map(b => parseInt(b));

      // Get current prices and normalize them (must sum to 100%)
      const pricesResult = await aptos.view({
        payload: {
          function: `${CONTRACT_ADDRESS}::multi_outcome_market::get_all_prices`,
          typeArguments: [],
          functionArguments: [MARKET_ADDRESS],
        },
      });
      const rawPrices = (pricesResult[0] as string[]).map(p => parseInt(p));
      // Normalize prices to sum to 100% (same as useMultiMarkets)
      const priceSum = rawPrices.reduce((acc, p) => acc + p, 0);
      const prices = rawPrices.map(p =>
        priceSum > 0 ? (p / priceSum) * 100 : 100 / rawPrices.length
      );

      // Build positions array (only include outcomes with tokens)
      const userPositions: PositionItem[] = [];
      for (let i = 0; i < labels.length; i++) {
        const tokens = tokenBalances[i] / 100_000_000; // Convert from octas
        if (tokens > 0.0001) { // Only show non-zero positions
          const currentPrice = prices[i]; // Keep as 0-100
          const currentValue = tokens * (currentPrice / 100); // Value in APT

          // Get cost basis from trade history
          const { costBasis, avgEntryPrice } = calculateCostBasis(i);

          // Calculate PNL
          const pnl = currentValue - costBasis;
          const pnlPercent = costBasis > 0 ? (pnl / costBasis) * 100 : 0;

          // Get position history for sparkline
          const history = getPositionHistory(i);
          const priceHistory = history.length > 0
            ? history.slice(-20).map(h => h.value)
            : [costBasis, currentValue]; // Default to straight line

          // Save current snapshot for future sparklines
          savePositionSnapshot({
            timestamp: Date.now(),
            outcomeIndex: i,
            tokens,
            price: currentPrice,
            value: currentValue,
          });

          userPositions.push({
            outcomeIndex: i,
            outcomeName: labels[i],
            tokens,
            currentPrice,
            entryPrice: avgEntryPrice || currentPrice, // Use current if no history
            costBasis,
            currentValue,
            pnl,
            pnlPercent,
            priceHistory,
          });
        }
      }

      setPositions(userPositions);
    } catch (error) {
      console.error("Error fetching positions:", error);
      setPositions([]);
    } finally {
      setIsLoadingPositions(false);
    }
  }, [connected, account?.address]);

  // Fetch positions when tab changes to positions (not on initial mount - handled by trades effect)
  useEffect(() => {
    if (activeTab === 'positions') {
      fetchPositions();
    }
  }, [activeTab, fetchPositions]);

  // Fetch trade history and reconstruct trade records for cost basis
  const fetchTrades = useCallback(async () => {
    if (!connected || !account?.address) {
      setTrades([]);
      return;
    }

    try {
      setIsLoadingTrades(true);
      const address = account.address.toString();

      // First, get outcome labels and current prices for mapping
      let outcomeLabels: string[] = [];
      let outcomePrices: number[] = [];
      try {
        const labelsResult = await aptos.view({
          payload: {
            function: `${CONTRACT_ADDRESS}::multi_outcome_market::get_outcome_labels`,
            typeArguments: [],
            functionArguments: [MARKET_ADDRESS],
          },
        });
        outcomeLabels = labelsResult[0] as string[];

        const pricesResult = await aptos.view({
          payload: {
            function: `${CONTRACT_ADDRESS}::multi_outcome_market::get_all_prices`,
            typeArguments: [],
            functionArguments: [MARKET_ADDRESS],
          },
        });
        outcomePrices = (pricesResult[0] as string[]).map(p => parseInt(p));
      } catch (e) {
        console.error("Could not fetch outcome labels/prices:", e);
      }

      // Fetch recent transactions for this account
      const transactions = await aptos.getAccountTransactions({
        accountAddress: address,
        options: { limit: 100 },
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

        if (isMarketTx && userTx.success) {
          // Parse the function name to determine trade type
          const funcName = func.split('::').pop() || '';
          let tradeType: 'buy' | 'sell' = 'buy';
          let outcome = '';
          let outcomeIndex = 0;

          if (funcName.includes('buy_outcome')) {
            tradeType = 'buy';
            outcomeIndex = parseInt(payload.arguments?.[1] || '0', 10);
            outcome = outcomeLabels[outcomeIndex] || `Outcome ${outcomeIndex}`;
          } else if (funcName.includes('sell_outcome')) {
            tradeType = 'sell';
            outcomeIndex = parseInt(payload.arguments?.[1] || '0', 10);
            outcome = outcomeLabels[outcomeIndex] || `Outcome ${outcomeIndex}`;
          } else if (funcName.includes('buy_yes')) {
            tradeType = 'buy';
            outcomeIndex = 0;
            outcome = 'Yes';
          } else if (funcName.includes('buy_no')) {
            tradeType = 'buy';
            outcomeIndex = 1;
            outcome = 'No';
          } else if (funcName.includes('sell_yes')) {
            tradeType = 'sell';
            outcomeIndex = 0;
            outcome = 'Yes';
          } else if (funcName.includes('sell_no')) {
            tradeType = 'sell';
            outcomeIndex = 1;
            outcome = 'No';
          } else {
            continue; // Not a buy/sell transaction
          }

          // Parse amount from arguments
          // For buy_outcome: args are [market_addr, outcome_index, amount, min_tokens]
          // For sell_outcome: args are [market_addr, outcome_index, tokens, min_collateral]
          const amountArgIndex = funcName.includes('outcome') ? 2 : 1;
          const amountArg = payload.arguments?.[amountArgIndex] || '0';
          const amountOctas = parseInt(amountArg, 10);
          const amountAPT = amountOctas / 100_000_000;

          const timestamp = parseInt(userTx.timestamp, 10) / 1000;

          marketTrades.push({
            hash: userTx.hash,
            type: tradeType,
            outcome,
            amount: amountAPT,
            timestamp,
            success: userTx.success,
          });

          // Also save as TradeRecord for cost basis tracking
          // Use current price as estimate (best we can do without historical data)
          const estimatedPrice = outcomePrices[outcomeIndex] || 20; // Default 20% if unknown
          const estimatedTokens = estimatedPrice > 0 ? amountAPT / (estimatedPrice / 100) : amountAPT;

          const tradeRecord: TradeRecord = {
            timestamp: timestamp * 1000, // Convert back to ms
            outcomeIndex,
            outcomeName: outcome,
            type: tradeType,
            tokens: estimatedTokens,
            pricePerToken: estimatedPrice,
            totalCost: amountAPT,
            txHash: userTx.hash,
          };
          saveTradeRecord(tradeRecord);
        }
      }

      setTrades(marketTrades);
    } catch (error) {
      console.error("Error fetching trades:", error);
      setTrades([]);
    } finally {
      setIsLoadingTrades(false);
    }
  }, [connected, account?.address]);

  // Fetch trades when tab changes to history
  useEffect(() => {
    if (activeTab === 'history') {
      fetchTrades();
    }
  }, [activeTab, fetchTrades]);

  // Fetch trades first on initial connect to populate trade records for cost basis
  // Then refetch positions to get accurate cost basis data
  useEffect(() => {
    if (connected) {
      // Fetch trades first, then positions with updated cost basis
      fetchTrades().then(() => {
        // After trades are saved, refetch positions to get accurate cost basis
        fetchPositions();
      });
    }
  }, [connected]); // Intentionally not including fetchTrades and fetchPositions to prevent loops

  // Format balance for display (in APT, not USD)
  const formatBalance = (val: number) => {
    if (val >= 1000) {
      return `${val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} APT`;
    }
    return `${val.toFixed(2)} APT`;
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
              {showBalance ? formatBalance(totalPortfolioValue) : "••••••"}
            </span>
          </div>
          <span className="text-[#8297a3] text-base">{connected ? "Total Portfolio Value" : "Connect wallet"}</span>

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
              {/* Show hover value or current total portfolio value */}
              <span className="text-white text-3xl font-bold">
                {hoverValue ? formatBalance(hoverValue.balance) : formatBalance(totalPortfolioValue)}
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
            balance={totalPortfolioValue}
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
        ) : activeTab === "positions" ? (
          <div className="space-y-3">
            {isLoadingPositions ? (
              <div className="text-center py-12">
                <Loader2 size={24} className="animate-spin text-[#8297a3] mx-auto" />
                <p className="text-[#8297a3] text-base mt-2">Loading positions...</p>
              </div>
            ) : positions.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-[#8297a3] text-base">No positions found.</p>
                <p className="text-[#6b7a8a] text-sm mt-1">Buy outcome tokens to see them here.</p>
              </div>
            ) : (
              <>
                {/* Total PNL Summary */}
                <div className="bg-poly-card rounded-lg p-4 border border-[#2c3f4f] mb-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[#8297a3] text-sm">Total Position Value</p>
                      <p className="text-white text-2xl font-bold">
                        {positions.reduce((sum, p) => sum + p.currentValue, 0).toFixed(2)} APT
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[#8297a3] text-sm">Total P&L</p>
                      {(() => {
                        const totalPnl = positions.reduce((sum, p) => sum + p.pnl, 0);
                        const totalCost = positions.reduce((sum, p) => sum + p.costBasis, 0);
                        const totalPnlPercent = totalCost > 0 ? (totalPnl / totalCost) * 100 : 0;
                        return (
                          <p className={`text-xl font-bold ${totalPnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {totalPnl >= 0 ? '+' : ''}{totalPnl.toFixed(2)} APT
                            <span className="text-sm ml-1">({totalPnlPercent >= 0 ? '+' : ''}{totalPnlPercent.toFixed(1)}%)</span>
                          </p>
                        );
                      })()}
                    </div>
                  </div>
                </div>

                {/* Position Cards */}
                {positions.map((position) => (
                  <div
                    key={position.outcomeIndex}
                    className="bg-poly-card rounded-lg p-4 border border-[#2c3f4f]"
                  >
                    {/* Row 1: Name, Sparkline, Current Value */}
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-bold text-sm">
                          {position.outcomeName.slice(0, 2)}
                        </div>
                        <div>
                          <p className="text-white font-medium">{position.outcomeName}</p>
                          <p className="text-[#6b7a8a] text-xs">
                            {position.tokens.toFixed(2)} tokens
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <PositionSparkline data={position.priceHistory} isPositive={position.pnl >= 0} />
                        <div className="text-right">
                          <p className="text-white font-semibold">
                            {position.currentValue.toFixed(2)} APT
                          </p>
                          <p className={`text-sm font-medium ${position.pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {position.pnl >= 0 ? '+' : ''}{position.pnl.toFixed(2)} APT
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Row 2: Entry/Current Price, Cost Basis, PNL % */}
                    <div className="grid grid-cols-4 gap-2 pt-3 border-t border-[#2c3f4f]">
                      <div>
                        <p className="text-[#6b7a8a] text-xs">Entry</p>
                        <p className="text-white text-sm font-medium">{position.entryPrice.toFixed(1)}%</p>
                      </div>
                      <div>
                        <p className="text-[#6b7a8a] text-xs">Current</p>
                        <p className={`text-sm font-medium ${position.currentPrice >= position.entryPrice ? 'text-green-400' : 'text-red-400'}`}>
                          {position.currentPrice.toFixed(1)}%
                        </p>
                      </div>
                      <div>
                        <p className="text-[#6b7a8a] text-xs">Cost</p>
                        <p className="text-white text-sm font-medium">{position.costBasis.toFixed(2)} APT</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[#6b7a8a] text-xs">Return</p>
                        <p className={`text-sm font-medium ${position.pnlPercent >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {position.pnlPercent >= 0 ? '+' : ''}{position.pnlPercent.toFixed(1)}%
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        ) : (
          <div className="text-center py-12">
            <p className="text-[#8297a3] text-base">No open orders.</p>
            <p className="text-[#6b7a8a] text-sm mt-1">Limit orders will appear here.</p>
          </div>
        )}
      </div>
    </motion.div>
  );
}
