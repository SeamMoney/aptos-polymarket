import { useState, useCallback, useEffect } from "react";
import { ChevronDown, Minus, Plus, Loader2, CheckCircle, AlertCircle, ArrowLeftRight, ExternalLink, X } from "lucide-react";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { motion, AnimatePresence } from "framer-motion";
import type { PanInfo } from "framer-motion";
import { Aptos, AptosConfig, Network } from "@aptos-labs/ts-sdk";
import type { Market, Outcome } from "./types";
import { saveTradeRecord, type TradeRecord } from "./PortfolioPage";

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

// Estimated gas fee in dollars (conservative estimate for testnet)
const ESTIMATED_GAS_FEE = 0.5;

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
  const { connected, account } = useWallet();
  const [direction, setDirection] = useState<TradeDirection>("buy");
  const [tradeType, setTradeType] = useState<"yes" | "no">(initialType);
  const [amount, setAmount] = useState(0);
  const [showDirectionDropdown, setShowDirectionDropdown] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [txStatus, setTxStatus] = useState<"idle" | "success" | "error">("idle");
  const [txMessage, setTxMessage] = useState("");
  const [txHash, setTxHash] = useState<string | null>(null);
  const [balance, setBalance] = useState<number>(0);

  // Fetch wallet balance
  useEffect(() => {
    const fetchBalance = async () => {
      if (!connected || !account?.address) {
        setBalance(0);
        return;
      }
      try {
        const aptos = new Aptos(new AptosConfig({ network: Network.TESTNET }));
        const address = account.address.toString();

        try {
          const faBalance = await aptos.getAccountAPTAmount({ accountAddress: address });
          setBalance(faBalance / 100_000_000);
        } catch {
          // Fallback to legacy CoinStore
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
        }
      } catch {
        setBalance(0);
      }
    };

    if (isVisible) {
      fetchBalance();
    }
  }, [isVisible, connected, account?.address]);

  // Reset state when sheet opens
  useEffect(() => {
    if (isVisible) {
      setAmount(0);
      setTxStatus("idle");
      setTxHash(null);
      setTradeType(initialType);
    }
  }, [isVisible, initialType]);

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
      setTxHash("demo-" + Date.now());
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
      // Don't auto-close - let user click "Done" or drag down
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

  const handleClearAmount = () => {
    setAmount(0);
  };

  const handleSetMax = () => {
    // Set max to balance minus gas fee (in dollars, rounded down)
    const maxAmount = Math.max(0, Math.floor(balance - ESTIMATED_GAS_FEE));
    setAmount(maxAmount);
  };

  const toggleTradeType = () => {
    setTradeType(prev => prev === "yes" ? "no" : "yes");
  };

  const handleDragEnd = (_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    // If dragged down more than 50px or with velocity, close the sheet
    if (info.offset.y > 50 || info.velocity.y > 500) {
      onClose();
    }
  };

  const handleDone = () => {
    setAmount(0);
    setTxStatus("idle");
    setTxHash(null);
    onClose();
  };

  const outcomeName =
    selectedOutcome?.name || (tradeType === "yes" ? "Yes" : "No");

  // Max balance available for trading (in dollars)
  const maxAvailable = Math.max(0, balance - ESTIMATED_GAS_FEE);

  return (
    <AnimatePresence>
      {isVisible && (
        <div className="fixed inset-0 z-[70] flex items-end justify-center">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="absolute inset-0 bg-black/70"
            onClick={onClose}
          />

          {/* Sheet - draggable */}
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "tween", duration: 0.15, ease: [0.32, 0.72, 0, 1] }}
            drag="y"
            dragDirectionLock
            dragConstraints={{ top: 0 }}
            dragElastic={{ top: 0, bottom: 0.5 }}
            onDragEnd={handleDragEnd}
            className="relative bg-[#1c2b3a] rounded-t-2xl w-full max-w-lg overflow-hidden touch-pan-y"
          >
            {/* Drag Handle */}
            <div className="flex justify-center pt-3 pb-2 cursor-grab active:cursor-grabbing">
              <div className="w-10 h-1 rounded-full bg-[#4a5f70]" />
            </div>

            {/* Header - Buy/Sell dropdown and Market label */}
            <div className="flex items-center justify-between px-4 py-2 border-b border-[#2c3f4f]">
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
                  onClick={handleSetMax}
                  className="bg-[#2a3d4e] hover:bg-[#324858] px-3.5 py-1.5 rounded-md transition-colors text-white text-xs font-medium"
                  title={`Max: $${maxAvailable.toFixed(2)} (minus ~$${ESTIMATED_GAS_FEE} gas)`}
                >
                  Max
                </button>
                {amount > 0 && (
                  <button
                    onClick={handleClearAmount}
                    className="bg-[#2a3d4e] hover:bg-[#324858] px-2.5 py-1.5 rounded-md transition-colors text-[#8297a3] hover:text-white text-xs font-medium"
                    title="Clear amount"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              {/* Balance Display */}
              <div className="text-center mt-3">
                <span className="text-[#6b7a8a] text-xs">
                  Balance: ${balance.toFixed(2)} (Max: ${maxAvailable.toFixed(2)})
                </span>
              </div>
            </div>

            {/* Transaction Status */}
            {txStatus !== "idle" && (
              <div className={`mx-4 mb-3 p-3 rounded-lg ${
                txStatus === "success" ? "bg-green-900/30 border border-green-700" : "bg-red-900/30 border border-red-700"
              }`}>
                <div className="flex items-start gap-2">
                  {txStatus === "success" ? (
                    <CheckCircle size={18} className="text-green-500 shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle size={18} className="text-red-500 shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1 min-w-0">
                    <span className={`text-sm font-medium ${txStatus === "success" ? "text-green-400" : "text-red-400"}`}>
                      {txMessage}
                    </span>
                    {txStatus === "success" && txHash && !txHash.startsWith("demo-") && (
                      <a
                        href={`https://explorer.aptoslabs.com/txn/${txHash}?network=testnet`}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="flex items-center gap-1.5 text-sm text-blue-400 hover:text-blue-300 mt-2 p-2 bg-blue-500/10 rounded-lg border border-blue-500/30"
                      >
                        <ExternalLink size={14} className="shrink-0" />
                        <span>View on Aptos Explorer</span>
                      </a>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Trade Button or Done Button */}
            <div className="px-4 pb-6">
              {txStatus === "success" ? (
                <button
                  onClick={handleDone}
                  className="w-full py-3.5 rounded-lg bg-[#27ae60] hover:bg-[#219a52] transition-colors flex items-center justify-center gap-2"
                >
                  <CheckCircle size={18} className="text-white" />
                  <span className="text-white text-sm font-semibold">Done</span>
                </button>
              ) : (
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
              )}
              <p className="text-[#6b7a8a] text-[11px] text-center mt-3">
                By trading, you agree to the <span className="text-[#8297a3] underline">Terms of Use</span>.
              </p>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
