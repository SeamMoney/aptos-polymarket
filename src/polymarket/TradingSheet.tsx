import { useState, useCallback } from "react";
import { ChevronDown, Minus, Plus, Loader2, CheckCircle, AlertCircle, ArrowLeftRight, ExternalLink } from "lucide-react";
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
  const [direction, setDirection] = useState<TradeDirection>("buy");
  const [tradeType, setTradeType] = useState<"yes" | "no">(initialType);
  const [amount, setAmount] = useState(0);
  const [showDirectionDropdown, setShowDirectionDropdown] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [txStatus, setTxStatus] = useState<"idle" | "success" | "error">("idle");
  const [txMessage, setTxMessage] = useState("");
  const [txHash, setTxHash] = useState<string | null>(null);

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
    setTxHash(null);

    try {
      // Convert amount to APT (divide by 100 to get APT from cents-based UI amount)
      const amountAPT = (amount / 100).toString();
      let result: any;

      if (isMultiOutcome && (onBuyOutcome || onSellOutcome)) {
        // Multi-outcome market
        const outcomeIndex = getOutcomeIndex();
        if (direction === "buy" && onBuyOutcome) {
          result = await onBuyOutcome(market.id, outcomeIndex, amountAPT);
        } else if (direction === "sell" && onSellOutcome) {
          result = await onSellOutcome(market.id, outcomeIndex, amountAPT);
        }
      } else {
        // Binary market
        if (direction === "buy") {
          if (tradeType === "yes" && onBuyYes) {
            result = await onBuyYes(market.id, amountAPT);
          } else if (tradeType === "no" && onBuyNo) {
            result = await onBuyNo(market.id, amountAPT);
          }
        } else {
          if (tradeType === "yes" && onSellYes) {
            result = await onSellYes(market.id, amountAPT);
          } else if (tradeType === "no" && onSellNo) {
            result = await onSellNo(market.id, amountAPT);
          }
        }
      }

      // Capture transaction hash
      const hash = result?.hash || result?.transaction?.hash;
      if (hash) {
        setTxHash(hash);
      }

      setTxStatus("success");
      setTxMessage("Transaction submitted!");
      setTimeout(() => {
        setTxStatus("idle");
        setTxHash(null);
        setAmount(0);
        onClose();
      }, 4000); // Extended to 4s so user can click explorer link
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
      ? (amount / (currentPrice / 100)).toFixed(2)
      : "0.00";

  const handleAmountChange = useCallback((delta: number) => {
    setAmount((prev) => Math.max(0, prev + delta));
  }, []);

  const toggleTradeType = () => {
    setTradeType(prev => prev === "yes" ? "no" : "yes");
  };

  const outcomeName =
    selectedOutcome?.name || (tradeType === "yes" ? "Yes" : "No");

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Sheet */}
      <div className="relative bg-[#1c2b3a] rounded-t-2xl w-full max-w-lg overflow-hidden animate-slide-up">
        {/* Header - Buy/Sell dropdown and Market label */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#2c3f4f]">
          {/* Buy/Sell Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowDirectionDropdown(!showDirectionDropdown)}
              className="flex items-center gap-1.5 text-white font-medium"
            >
              <span className="text-base">{direction === "buy" ? "Buy" : "Sell"}</span>
              <ChevronDown size={16} className="text-[#8297a3]" />
            </button>

            {showDirectionDropdown && (
              <div className="absolute top-full left-0 mt-1 bg-[#2a3d4e] rounded-lg overflow-hidden shadow-xl z-10 border border-[#3a4f60] min-w-[100px]">
                <button
                  onClick={() => {
                    setDirection("buy");
                    setShowDirectionDropdown(false);
                  }}
                  className={`w-full px-4 py-2.5 text-left text-sm hover:bg-[#324858] transition-colors ${
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
                  className={`w-full px-4 py-2.5 text-left text-sm hover:bg-[#324858] transition-colors ${
                    direction === "sell" ? "text-white bg-[#324858]" : "text-[#8297a3]"
                  }`}
                >
                  Sell
                </button>
              </div>
            )}
          </div>

          {/* Market label */}
          <span className="text-[#8297a3] text-sm">Market</span>
        </div>

        {/* Market & Outcome Info */}
        <div className="px-4 py-3 border-b border-[#2c3f4f]">
          <div className="flex items-start gap-3">
            <img
              src={selectedOutcome?.image || market.image}
              alt=""
              className="w-9 h-9 rounded-lg object-cover bg-[#2a3d4e] shrink-0 mt-0.5"
            />
            <div className="flex-1 min-w-0">
              <p className="text-white text-sm font-medium leading-tight">{market.question}</p>
              <div className="flex items-center gap-2 mt-1.5">
                <span className="text-[#8297a3] text-sm">{outcomeName}</span>
                <span className={`px-1.5 py-0.5 rounded text-xs font-semibold ${
                  tradeType === "yes"
                    ? "bg-[#27ae60] text-white"
                    : "bg-[#e74c3c] text-white"
                }`}>
                  {tradeType === "yes" ? "Yes" : "No"}
                </span>
                <button
                  onClick={toggleTradeType}
                  className="p-1 hover:bg-[#2a3d4e] rounded transition-colors"
                >
                  <ArrowLeftRight size={14} className="text-[#8297a3]" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Amount Section */}
        <div className="px-4 pt-6 pb-4">
          {/* Amount Display with +/- */}
          <div className="flex items-center justify-center gap-6">
            <button
              onClick={() => handleAmountChange(-10)}
              className="text-[#8297a3] hover:text-white transition-colors p-2"
            >
              <Minus size={24} strokeWidth={2} />
            </button>
            <span className="text-white text-5xl font-bold min-w-[140px] text-center">${amount}</span>
            <button
              onClick={() => handleAmountChange(10)}
              className="text-[#8297a3] hover:text-white transition-colors p-2"
            >
              <Plus size={24} strokeWidth={2} />
            </button>
          </div>

          {/* To Win & Avg Price */}
          <div className="text-center mt-4 mb-5">
            <div className="flex items-center justify-center gap-2">
              <span className="text-[#8297a3] text-sm">To win</span>
              <span className="text-[#27ae60] text-sm font-semibold">${potentialWin}</span>
            </div>
            <p className="text-[#6b7a8a] text-xs mt-1">Avg. Price {currentPrice}¢</p>
          </div>

          {/* Quick Amount Buttons */}
          <div className="flex justify-center gap-2">
            {[1, 20, 100].map((val) => (
              <button
                key={val}
                onClick={() => handleAmountChange(val)}
                className="bg-[#2a3d4e] hover:bg-[#324858] px-3.5 py-1.5 rounded-md transition-colors text-white text-xs font-medium"
              >
                +${val}
              </button>
            ))}
            <button
              onClick={() => setAmount(1000)}
              className="bg-[#2a3d4e] hover:bg-[#324858] px-3.5 py-1.5 rounded-md transition-colors text-white text-xs font-medium"
            >
              Max
            </button>
          </div>
        </div>

        {/* Transaction Status */}
        {txStatus !== "idle" && (
          <div className={`mx-4 mb-3 p-2.5 rounded-lg flex items-center gap-2 ${
            txStatus === "success" ? "bg-green-900/30 border border-green-700" : "bg-red-900/30 border border-red-700"
          }`}>
            {txStatus === "success" ? (
              <CheckCircle size={16} className="text-green-500 shrink-0" />
            ) : (
              <AlertCircle size={16} className="text-red-500 shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              <span className={`text-xs ${txStatus === "success" ? "text-green-400" : "text-red-400"}`}>
                {txMessage}
              </span>
              {txStatus === "success" && txHash && (
                <a
                  href={`https://explorer.aptoslabs.com/txn/${txHash}?network=testnet`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 mt-1"
                >
                  <span className="truncate">View on Explorer</span>
                  <ExternalLink size={12} className="shrink-0" />
                </a>
              )}
            </div>
          </div>
        )}

        {/* Trade Button */}
        <div className="px-4 pb-6">
          <button
            onClick={amount > 0 ? executeTrade : undefined}
            disabled={isLoading || amount === 0}
            className={`w-full py-3.5 rounded-lg transition-colors flex items-center justify-center gap-2 ${
              isLoading || amount === 0
                ? "bg-[#3b82f6]/50 cursor-not-allowed"
                : "bg-[#3b82f6] hover:bg-[#2563eb]"
            }`}
          >
            {isLoading && <Loader2 size={18} className="text-white animate-spin" />}
            <span className="text-white text-sm font-semibold">
              {isLoading ? "Processing..." : "Trade"}
            </span>
          </button>
          <p className="text-[#6b7a8a] text-[11px] text-center mt-3">
            By trading, you agree to the <span className="text-[#8297a3] underline">Terms of Use</span>.
          </p>
        </div>
      </div>
    </div>
  );
}
