import { useState, useCallback } from "react";
import { ChevronDown, Minus, Plus, X, Loader2, CheckCircle, AlertCircle } from "lucide-react";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import type { Market, Outcome } from "./types";

interface TradingSheetProps {
  market: Market;
  selectedOutcome?: Outcome;
  isVisible: boolean;
  onClose: () => void;
  initialType?: "yes" | "no";
  // Trading functions from usePolymarkets hook
  onBuyYes?: (marketId: string, amount: string) => Promise<any>;
  onBuyNo?: (marketId: string, amount: string) => Promise<any>;
  onSellYes?: (marketId: string, amount: string) => Promise<any>;
  onSellNo?: (marketId: string, amount: string) => Promise<any>;
  onBuyOutcome?: (marketId: string, outcomeIndex: number, amount: string) => Promise<any>;
  onSellOutcome?: (marketId: string, outcomeIndex: number, amount: string) => Promise<any>;
}

type OrderType = "market" | "limit";
type TradeDirection = "buy" | "sell";

export function TradingSheet({
  market,
  selectedOutcome,
  isVisible,
  onClose,
  initialType = "yes",
  onBuyYes,
  onBuyNo,
  onSellYes,
  onSellNo,
  onBuyOutcome,
  onSellOutcome,
}: TradingSheetProps) {
  const { connected } = useWallet();
  const [orderType, setOrderType] = useState<OrderType>("market");
  const [direction, setDirection] = useState<TradeDirection>("buy");
  const [tradeType, setTradeType] = useState<"yes" | "no">(initialType);
  const [amount, setAmount] = useState(0);
  const [showDirectionDropdown, setShowDirectionDropdown] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [txStatus, setTxStatus] = useState<"idle" | "success" | "error">("idle");
  const [txMessage, setTxMessage] = useState("");

  // Check if this is a real on-chain market
  const isRealMarket = market.id.startsWith("binary-") || market.id.startsWith("multi-");
  const isMultiOutcome = market.id.startsWith("multi-");

  // Get outcome index for multi-outcome markets
  const getOutcomeIndex = (): number => {
    if (!selectedOutcome || !market.outcomes) return 0;
    const index = market.outcomes.findIndex(o => o.id === selectedOutcome.id);
    return index >= 0 ? index : 0;
  };

  // Execute trade
  const executeTrade = async () => {
    if (!isRealMarket) {
      setTxStatus("success");
      setTxMessage("Demo trade executed!");
      setTimeout(() => {
        setTxStatus("idle");
        onClose();
      }, 1500);
      return;
    }

    if (!connected) {
      setTxStatus("error");
      setTxMessage("Please connect your wallet first");
      setTimeout(() => setTxStatus("idle"), 2000);
      return;
    }

    setIsLoading(true);
    setTxStatus("idle");

    try {
      // Convert amount to APT (divide by 100 to get APT from cents-based UI amount)
      const amountAPT = (amount / 100).toString();

      if (isMultiOutcome && (onBuyOutcome || onSellOutcome)) {
        // Multi-outcome market
        const outcomeIndex = getOutcomeIndex();
        if (direction === "buy" && onBuyOutcome) {
          await onBuyOutcome(market.id, outcomeIndex, amountAPT);
        } else if (direction === "sell" && onSellOutcome) {
          await onSellOutcome(market.id, outcomeIndex, amountAPT);
        }
      } else {
        // Binary market
        if (direction === "buy") {
          if (tradeType === "yes" && onBuyYes) {
            await onBuyYes(market.id, amountAPT);
          } else if (tradeType === "no" && onBuyNo) {
            await onBuyNo(market.id, amountAPT);
          }
        } else {
          if (tradeType === "yes" && onSellYes) {
            await onSellYes(market.id, amountAPT);
          } else if (tradeType === "no" && onSellNo) {
            await onSellNo(market.id, amountAPT);
          }
        }
      }

      setTxStatus("success");
      setTxMessage("Transaction submitted!");
      setTimeout(() => {
        setTxStatus("idle");
        setAmount(0);
        onClose();
      }, 2000);
    } catch (error: any) {
      console.error("Trade error:", error);
      setTxStatus("error");
      setTxMessage(error.message || "Transaction failed");
      setTimeout(() => setTxStatus("idle"), 3000);
    } finally {
      setIsLoading(false);
    }
  };

  const currentPrice = selectedOutcome
    ? Math.round(selectedOutcome.price * 100)
    : tradeType === "yes"
    ? Math.round(market.yesPrice * 100)
    : Math.round(market.noPrice * 100);

  const potentialWin =
    amount > 0
      ? (amount / (currentPrice / 100) - amount).toFixed(2)
      : "0.00";

  const handleAmountChange = useCallback((delta: number) => {
    setAmount((prev) => Math.max(0, prev + delta));
  }, []);

  const outcomeName =
    selectedOutcome?.name || (tradeType === "yes" ? "Yes" : "No");

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Sheet */}
      <div className="relative bg-[#1c2b3a] rounded-t-3xl w-full max-w-lg max-h-[85vh] overflow-hidden animate-slide-up">
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-10 h-1 bg-[#3a4f60] rounded-full" />
        </div>

        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 hover:bg-[#2a3d4e] rounded-full transition-colors"
        >
          <X size={20} color="#8297a3" strokeWidth={2.5} />
        </button>

        {/* Header with Buy/Sell dropdown and Market/Limit toggle */}
        <div className="flex items-center justify-between px-4 pt-2 pb-4">
          {/* Buy/Sell Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowDirectionDropdown(!showDirectionDropdown)}
              className="flex items-center gap-2 px-4 py-2 bg-[#2a3d4e] rounded-lg hover:bg-[#324858] transition-colors"
            >
              <span className="text-white text-base font-semibold">
                {direction === "buy" ? "Buy" : "Sell"}
              </span>
              <ChevronDown size={18} color="#8297a3" strokeWidth={2.5} />
            </button>

            {showDirectionDropdown && (
              <div className="absolute top-full left-0 mt-1 bg-[#2a3d4e] rounded-lg overflow-hidden shadow-xl z-10 border border-[#3a4f60]">
                <button
                  onClick={() => {
                    setDirection("buy");
                    setShowDirectionDropdown(false);
                  }}
                  className={`w-full px-6 py-3 text-left hover:bg-[#324858] transition-colors ${
                    direction === "buy" ? "text-white bg-[#324858]" : "text-[#8297a3]"
                  }`}
                >
                  Buy
                </button>
                <button
                  onClick={() => {
                    setDirection("sell");
                    setShowDirectionDropdown(false);
                  }}
                  className={`w-full px-6 py-3 text-left hover:bg-[#324858] transition-colors ${
                    direction === "sell" ? "text-white bg-[#324858]" : "text-[#8297a3]"
                  }`}
                >
                  Sell
                </button>
              </div>
            )}
          </div>

          {/* Market/Limit Toggle */}
          <div className="flex items-center bg-[#2a3d4e] rounded-lg p-1">
            <button
              onClick={() => setOrderType("market")}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                orderType === "market"
                  ? "bg-[#3a4f60] text-white"
                  : "text-[#8297a3] hover:text-white"
              }`}
            >
              Market
            </button>
            <button
              onClick={() => setOrderType("limit")}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                orderType === "limit"
                  ? "bg-[#3a4f60] text-white"
                  : "text-[#8297a3] hover:text-white"
              }`}
            >
              Limit
            </button>
          </div>
        </div>

        {/* Outcome Info Bar */}
        <div className="mx-4 mb-4 p-3 bg-[#2a3d4e] rounded-xl flex items-center border border-[#3a4f60]">
          <img
            src={selectedOutcome?.image || market.image}
            alt=""
            className="w-10 h-10 rounded-lg object-cover bg-[#1c2b3a] mr-3 shrink-0"
          />
          <div className="flex-1 min-w-0">
            <p className="text-white text-sm font-medium truncate">{outcomeName}</p>
            <p className="text-[#8297a3] text-xs truncate">{market.question}</p>
          </div>

          {/* Yes/No Toggle */}
          <div className="flex items-center bg-[#1c2b3a] rounded-lg p-1 ml-3">
            <button
              onClick={() => setTradeType("yes")}
              className={`px-3 py-1.5 rounded-md text-sm font-semibold transition-colors ${
                tradeType === "yes"
                  ? "bg-[#4ade80] text-white"
                  : "text-[#8297a3] hover:text-white"
              }`}
            >
              Yes
            </button>
            <button
              onClick={() => setTradeType("no")}
              className={`px-3 py-1.5 rounded-md text-sm font-semibold transition-colors ${
                tradeType === "no"
                  ? "bg-[#ef4444] text-white"
                  : "text-[#8297a3] hover:text-white"
              }`}
            >
              No
            </button>
          </div>
        </div>

        {/* Amount Section */}
        <div className="px-4">
          {/* Amount Display with +/- */}
          <div className="flex items-center justify-center py-8">
            <button
              onClick={() => handleAmountChange(-10)}
              className="w-14 h-14 flex items-center justify-center bg-[#2a3d4e] hover:bg-[#324858] rounded-full transition-colors"
            >
              <Minus size={28} color="#8297a3" strokeWidth={2.5} />
            </button>
            <div className="mx-8 text-center">
              <span className="text-white text-6xl font-bold">${amount}</span>
            </div>
            <button
              onClick={() => handleAmountChange(10)}
              className="w-14 h-14 flex items-center justify-center bg-[#2a3d4e] hover:bg-[#324858] rounded-full transition-colors"
            >
              <Plus size={28} color="#8297a3" strokeWidth={2.5} />
            </button>
          </div>

          {/* Quick Amount Buttons */}
          <div className="flex justify-center gap-3 pb-6">
            {[1, 20, 100].map((val) => (
              <button
                key={val}
                onClick={() => handleAmountChange(val)}
                className="bg-[#2a3d4e] hover:bg-[#324858] px-5 py-2.5 rounded-full transition-colors border border-[#3a4f60]"
              >
                <span className="text-white text-sm font-medium">+${val}</span>
              </button>
            ))}
            <button
              onClick={() => setAmount(1000)}
              className="bg-[#2a3d4e] hover:bg-[#324858] px-5 py-2.5 rounded-full transition-colors border border-[#3a4f60]"
            >
              <span className="text-white text-sm font-medium">Max</span>
            </button>
          </div>

          {/* Summary Stats */}
          <div className="border-t border-[#3a4f60] pt-4 pb-2">
            <div className="flex justify-between py-2.5">
              <span className="text-[#8297a3] text-base">Avg. price</span>
              <span className="text-white text-base font-medium">{currentPrice}¢</span>
            </div>
            <div className="flex justify-between py-2.5">
              <span className="text-[#8297a3] text-base">Shares</span>
              <span className="text-white text-base font-medium">
                {amount > 0 ? Math.floor(amount / (currentPrice / 100)) : 0}
              </span>
            </div>
            <div className="flex justify-between py-2.5">
              <span className="text-[#8297a3] text-base">To win</span>
              <span className="text-[#4ade80] text-lg font-bold">${potentialWin}</span>
            </div>
          </div>
        </div>

        {/* Transaction Status */}
        {txStatus !== "idle" && (
          <div className={`mx-4 mb-4 p-3 rounded-xl flex items-center gap-2 ${
            txStatus === "success" ? "bg-green-900/30 border border-green-700" : "bg-red-900/30 border border-red-700"
          }`}>
            {txStatus === "success" ? (
              <CheckCircle size={20} className="text-green-500" />
            ) : (
              <AlertCircle size={20} className="text-red-500" />
            )}
            <span className={`text-sm ${txStatus === "success" ? "text-green-400" : "text-red-400"}`}>
              {txMessage}
            </span>
          </div>
        )}

        {/* Deposit/Trade Button */}
        <div className="px-4 pt-4 pb-8">
          <button
            onClick={amount > 0 ? executeTrade : onClose}
            disabled={isLoading}
            className={`w-full py-4 rounded-xl transition-colors flex items-center justify-center gap-2 ${
              isLoading
                ? "bg-[#3b82f6]/50 cursor-not-allowed"
                : amount > 0
                  ? tradeType === "yes"
                    ? "bg-[#4abe7a] hover:bg-[#3da86a]"
                    : "bg-[#e5534b] hover:bg-[#d4443c]"
                  : "bg-[#3b82f6] hover:bg-[#2563eb]"
            }`}
          >
            {isLoading ? (
              <Loader2 size={20} className="text-white animate-spin" />
            ) : null}
            <span className="text-white text-base font-semibold">
              {isLoading
                ? "Processing..."
                : amount > 0
                  ? `${direction === "buy" ? "Buy" : "Sell"} ${selectedOutcome?.name || (tradeType === "yes" ? "Yes" : "No")}`
                  : "Enter amount"
              }
            </span>
          </button>
          <div className="flex items-center justify-center gap-2 mt-3">
            {isRealMarket && (
              <span className="inline-flex items-center gap-1.5 text-xs text-[#5BA3D9]">
                <span className="w-1.5 h-1.5 rounded-full bg-[#5BA3D9] animate-pulse" />
                Live on Aptos
              </span>
            )}
            {!isRealMarket && (
              <span className="text-xs text-[#6b7a8a]">Demo mode</span>
            )}
          </div>
          <p className="text-[#6b7a8a] text-xs text-center mt-2">
            By trading, you agree to the Terms of Use.
          </p>
        </div>
      </div>
    </div>
  );
}
