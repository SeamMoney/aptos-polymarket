import { useState, useRef, useEffect, useCallback } from "react";
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

// Polymarket Logo for branding (using official logo)
function PolymarketBrand() {
  return (
    <div className="flex items-center gap-2 text-[#5a6a7a]">
      <img src="/images/icon-white.svg" alt="Polymarket" className="w-6 h-6 opacity-60" />
      <span className="text-base font-medium">Polymarket</span>
    </div>
  );
}

// Profit/Loss Chart - shows balance over time
function ProfitChart({ timeRange, balance }: { timeRange: string; balance: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    // If we have a balance, show a line that goes up to current value
    if (balance > 0) {
      // Draw gradient fill
      const gradient = ctx.createLinearGradient(0, 0, 0, rect.height);
      gradient.addColorStop(0, 'rgba(34, 197, 94, 0.3)');
      gradient.addColorStop(1, 'rgba(34, 197, 94, 0)');

      ctx.beginPath();
      ctx.moveTo(0, rect.height * 0.8);
      ctx.lineTo(rect.width * 0.3, rect.height * 0.6);
      ctx.lineTo(rect.width * 0.7, rect.height * 0.4);
      ctx.lineTo(rect.width, rect.height * 0.2);
      ctx.lineTo(rect.width, rect.height);
      ctx.lineTo(0, rect.height);
      ctx.closePath();
      ctx.fillStyle = gradient;
      ctx.fill();

      // Draw line
      ctx.strokeStyle = "#22c55e";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, rect.height * 0.8);
      ctx.lineTo(rect.width * 0.3, rect.height * 0.6);
      ctx.lineTo(rect.width * 0.7, rect.height * 0.4);
      ctx.lineTo(rect.width, rect.height * 0.2);
      ctx.stroke();
    } else {
      // Draw flat line at center
      ctx.strokeStyle = "#3d5060";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, rect.height / 2);
      ctx.lineTo(rect.width, rect.height / 2);
      ctx.stroke();
    }
  }, [timeRange, balance]);

  return (
    <canvas ref={canvasRef} className="w-full h-16" />
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

  const timeRanges = ["1D", "1W", "1M", "ALL"];

  // Contract addresses for filtering trades
  const MARKET_CONTRACTS = [
    "0x3f13249e31a1fbdb886741f7945cccc40307311abc08ba188894bd1a050e19b4", // binary market
    "0xa2e5e47aab07fed78a3bcf95135ee2dad20c547499c94cb16a3e047859ffa7e1", // multi-outcome market
  ];

  // Fetch wallet balance
  const fetchBalance = useCallback(async () => {
    if (!connected || !account?.address) {
      setBalance(0);
      return;
    }

    try {
      setIsRefreshing(true);
      const resources = await aptos.getAccountResource({
        accountAddress: account.address.toString(),
        resourceType: "0x1::coin::CoinStore<0x1::aptos_coin::AptosCoin>",
      });
      // Balance is in octas (10^-8 APT)
      const balanceOctas = (resources as any).coin?.value || 0;
      const balanceAPT = Number(balanceOctas) / 100_000_000;
      setBalance(balanceAPT);
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
              <span className="text-[#22c55e]">▲</span>
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
              <span className="text-white text-3xl font-bold">{formatBalance(balance)}</span>
              <p className="text-[#8297a3] text-base mt-1">Past Month</p>
            </div>
            <PolymarketBrand />
          </div>

          <ProfitChart timeRange={timeRange} balance={balance} />
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
