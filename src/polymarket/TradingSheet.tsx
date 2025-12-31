import { useState, useCallback } from "react";
import { ChevronDown, Minus, Plus, X } from "lucide-react";
import type { Market, Outcome } from "./types";

interface TradingSheetProps {
  market: Market;
  selectedOutcome?: Outcome;
  isVisible: boolean;
  onClose: () => void;
  initialType?: "yes" | "no";
}

type OrderType = "market" | "limit";
type TradeDirection = "buy" | "sell";

export function TradingSheet({
  market,
  selectedOutcome,
  isVisible,
  onClose,
  initialType = "yes",
}: TradingSheetProps) {
  const [orderType, setOrderType] = useState<OrderType>("market");
  const [direction, setDirection] = useState<TradeDirection>("buy");
  const [tradeType, setTradeType] = useState<"yes" | "no">(initialType);
  const [amount, setAmount] = useState(0);
  const [showDirectionDropdown, setShowDirectionDropdown] = useState(false);

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

        {/* Deposit/Trade Button */}
        <div className="px-4 pt-4 pb-8">
          <button
            onClick={onClose}
            className="w-full bg-[#3b82f6] hover:bg-[#2563eb] py-4 rounded-xl transition-colors"
          >
            <span className="text-white text-base font-semibold">
              {amount > 0 ? `${direction === "buy" ? "Buy" : "Sell"} ${tradeType === "yes" ? "Yes" : "No"}` : "Deposit"}
            </span>
          </button>
          <p className="text-[#6b7a8a] text-xs text-center mt-3">
            By trading, you agree to the Terms of Use.
          </p>
        </div>
      </div>
    </div>
  );
}
