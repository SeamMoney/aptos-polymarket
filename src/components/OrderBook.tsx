import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface Trade {
  id: string;
  action: string;
  actionDisplay: string;
  amount: number;
  timestamp: number;
  success: boolean;
}

interface OrderBookProps {
  trades: Trade[];
  yesPrice: number;
  noPrice: number;
  yesReserve: number;
  noReserve: number;
}

interface LiquidityLevel {
  amount: number;      // APT input
  tokensOut: number;   // Tokens received
  avgPrice: number;    // Average execution price (in cents)
  slippage: number;    // Slippage percentage
  side: 'buy' | 'sell';
}

// CPMM formula: tokens_out = reserve_out * amount_in / (reserve_in + amount_in)
function calculateBuyOutput(baseReserve: number, outcomeReserve: number, amountIn: number): number {
  if (baseReserve <= 0 || outcomeReserve <= 0) return 0;
  return (outcomeReserve * amountIn) / (baseReserve + amountIn);
}

// Calculate spot price (price for infinitesimal trade)
function calculateSpotPrice(baseReserve: number, outcomeReserve: number): number {
  if (baseReserve <= 0 || outcomeReserve <= 0) return 50;
  const total = baseReserve + outcomeReserve;
  return (baseReserve / total) * 100;
}

export function OrderBook({ trades, yesPrice, noPrice, yesReserve, noReserve }: OrderBookProps) {
  const [showSlippage, setShowSlippage] = useState(true);
  const [animatedTrades, setAnimatedTrades] = useState<Set<string>>(new Set());

  // Calculate REAL liquidity depth from AMM reserves
  const { buyLevels, sellLevels, maxAmount } = useMemo(() => {
    // Use actual reserves if available, otherwise estimate from price
    const baseReserve = yesReserve > 0 ? yesReserve : 1000;
    const outcomeReserve = noReserve > 0 ? noReserve : 1000;

    const spotPrice = calculateSpotPrice(baseReserve, outcomeReserve);

    // Trade sizes to show (in APT)
    const tradeSizes = [0.1, 0.5, 1, 2, 5, 10, 25, 50];

    // Calculate buy levels (buying YES tokens)
    const buyLevels: LiquidityLevel[] = tradeSizes.map(amount => {
      const tokensOut = calculateBuyOutput(baseReserve, outcomeReserve, amount);
      const avgPrice = tokensOut > 0 ? (amount / tokensOut) * 100 : spotPrice;
      const slippage = spotPrice > 0 ? ((avgPrice - spotPrice) / spotPrice) * 100 : 0;

      return {
        amount,
        tokensOut,
        avgPrice,
        slippage: Math.abs(slippage),
        side: 'buy' as const,
      };
    }).filter(l => l.tokensOut > 0);

    // Calculate sell levels (selling YES tokens = buying NO)
    // Reverse the reserves for selling
    const sellLevels: LiquidityLevel[] = tradeSizes.map(amount => {
      const tokensOut = calculateBuyOutput(outcomeReserve, baseReserve, amount);
      const avgPrice = tokensOut > 0 ? (amount / tokensOut) * 100 : (100 - spotPrice);
      const basePrice = 100 - spotPrice;
      const slippage = basePrice > 0 ? ((avgPrice - basePrice) / basePrice) * 100 : 0;

      return {
        amount,
        tokensOut,
        avgPrice,
        slippage: Math.abs(slippage),
        side: 'sell' as const,
      };
    }).filter(l => l.tokensOut > 0);

    const maxAmount = Math.max(
      ...buyLevels.map(l => l.amount),
      ...sellLevels.map(l => l.amount)
    );

    return { buyLevels, sellLevels, maxAmount };
  }, [yesReserve, noReserve]);

  // Track recently animated trades
  useEffect(() => {
    if (trades.length > 0) {
      const latestTrade = trades[0];
      if (latestTrade.success) {
        setAnimatedTrades(prev => new Set([...prev, latestTrade.id]));
        setTimeout(() => {
          setAnimatedTrades(prev => {
            const next = new Set(prev);
            next.delete(latestTrade.id);
            return next;
          });
        }, 500);
      }
    }
  }, [trades]);

  const formatAmount = (amount: number) => {
    if (amount >= 10) return amount.toFixed(0);
    if (amount >= 1) return amount.toFixed(1);
    return amount.toFixed(2);
  };

  const formatTokens = (tokens: number) => {
    if (tokens >= 100) return tokens.toFixed(0);
    if (tokens >= 10) return tokens.toFixed(1);
    return tokens.toFixed(2);
  };

  // TVL (Total Value Locked)
  const tvl = yesReserve + noReserve;

  return (
    <div className="bg-poly-dark rounded-xl p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="text-sm text-gray-400 font-semibold">Liquidity Depth</div>
          <span className="text-[10px] text-poly-green bg-poly-green/10 px-1.5 py-0.5 rounded font-medium">AMM</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowSlippage(!showSlippage)}
            className={`text-xs px-2 py-1 rounded transition-colors ${showSlippage ? 'bg-poly-green/20 text-poly-green' : 'bg-poly-card text-gray-400'}`}
          >
            Slippage
          </button>
          <span className="text-xs text-gray-500">
            TVL: {tvl.toFixed(0)} APT
          </span>
        </div>
      </div>

      {/* Column Headers */}
      <div className="grid grid-cols-4 text-xs text-gray-500 mb-2 px-2">
        <span>Trade Size</span>
        <span className="text-right">Tokens</span>
        <span className="text-right">Avg Price</span>
        <span className="text-right">Slippage</span>
      </div>

      {/* Sell Side (asks) - selling YES tokens */}
      <div className="space-y-0.5 mb-2">
        <div className="text-[10px] text-red-400/70 px-2 mb-1 font-medium">SELL YES →</div>
        <AnimatePresence mode="popLayout">
          {sellLevels.slice().reverse().map((level) => {
            const depthPercent = (level.amount / maxAmount) * 100;
            const slippageColor = level.slippage < 1 ? 'text-gray-400' :
                                  level.slippage < 5 ? 'text-yellow-400' : 'text-red-400';

            return (
              <motion.div
                key={`sell-${level.amount}`}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="relative grid grid-cols-4 text-xs py-1.5 px-2 rounded hover:bg-red-500/10 transition-colors cursor-pointer"
                title={`Sell ${level.amount} APT worth of YES → Get ${level.tokensOut.toFixed(2)} NO tokens`}
              >
                {/* Depth bar */}
                {showSlippage && (
                  <div
                    className="absolute right-0 top-0 bottom-0 bg-red-500/15 rounded-r transition-all"
                    style={{ width: `${Math.min(depthPercent, 100)}%` }}
                  />
                )}
                <span className="relative z-10 text-red-400 font-medium">
                  {formatAmount(level.amount)} APT
                </span>
                <span className="relative z-10 text-right text-gray-300">
                  {formatTokens(level.tokensOut)}
                </span>
                <span className="relative z-10 text-right text-gray-300">
                  {level.avgPrice.toFixed(1)}¢
                </span>
                <span className={`relative z-10 text-right font-mono ${slippageColor}`}>
                  {level.slippage < 0.1 ? '<0.1%' : `${level.slippage.toFixed(1)}%`}
                </span>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Mid Price / Current Price */}
      <div className="py-3 px-3 bg-poly-card rounded-lg mb-2 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex flex-col">
            <span className="text-lg font-bold text-poly-green">{yesPrice.toFixed(1)}¢</span>
            <span className="text-[10px] text-gray-500">YES</span>
          </div>
        </div>
        <div className="text-center">
          <div className="text-xs text-gray-500">Spot Price</div>
          <div className="text-sm text-gray-400">0% slippage</div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex flex-col items-end">
            <span className="text-lg font-bold text-red-400">{noPrice.toFixed(1)}¢</span>
            <span className="text-[10px] text-gray-500">NO</span>
          </div>
        </div>
      </div>

      {/* Buy Side (bids) - buying YES tokens */}
      <div className="space-y-0.5">
        <div className="text-[10px] text-poly-green/70 px-2 mb-1 font-medium">← BUY YES</div>
        <AnimatePresence mode="popLayout">
          {buyLevels.map((level) => {
            const depthPercent = (level.amount / maxAmount) * 100;
            const slippageColor = level.slippage < 1 ? 'text-gray-400' :
                                  level.slippage < 5 ? 'text-yellow-400' : 'text-red-400';

            return (
              <motion.div
                key={`buy-${level.amount}`}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="relative grid grid-cols-4 text-xs py-1.5 px-2 rounded hover:bg-green-500/10 transition-colors cursor-pointer"
                title={`Buy ${level.amount} APT worth of YES → Get ${level.tokensOut.toFixed(2)} YES tokens`}
              >
                {/* Depth bar */}
                {showSlippage && (
                  <div
                    className="absolute left-0 top-0 bottom-0 bg-poly-green/15 rounded-l transition-all"
                    style={{ width: `${Math.min(depthPercent, 100)}%` }}
                  />
                )}
                <span className="relative z-10 text-poly-green font-medium">
                  {formatAmount(level.amount)} APT
                </span>
                <span className="relative z-10 text-right text-gray-300">
                  {formatTokens(level.tokensOut)}
                </span>
                <span className="relative z-10 text-right text-gray-300">
                  {level.avgPrice.toFixed(1)}¢
                </span>
                <span className={`relative z-10 text-right font-mono ${slippageColor}`}>
                  {level.slippage < 0.1 ? '<0.1%' : `${level.slippage.toFixed(1)}%`}
                </span>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Trade Tape - Last 5 trades */}
      <div className="mt-4 pt-3 border-t border-poly-border">
        <div className="text-xs text-gray-500 mb-2">Recent Trades</div>
        <div className="space-y-1">
          <AnimatePresence mode="popLayout">
            {trades.slice(0, 5).map((trade) => (
              <motion.div
                key={trade.id}
                initial={{ opacity: 0, y: -10 }}
                animate={{
                  opacity: 1,
                  y: 0,
                  backgroundColor: animatedTrades.has(trade.id)
                    ? trade.actionDisplay.includes('BUY') ? 'rgba(0, 199, 135, 0.3)' : 'rgba(239, 68, 68, 0.3)'
                    : 'transparent'
                }}
                exit={{ opacity: 0 }}
                className="flex items-center justify-between text-xs py-1 px-2 rounded"
              >
                <div className="flex items-center gap-2">
                  <span className={trade.actionDisplay.includes('BUY') ? 'text-poly-green' : 'text-red-400'}>
                    {trade.actionDisplay.includes('BUY') ? '↑' : '↓'}
                  </span>
                  <span className={trade.actionDisplay.includes('BUY') ? 'text-poly-green' : 'text-red-400'}>
                    {trade.actionDisplay}
                  </span>
                </div>
                <span className="text-white font-mono">{trade.amount.toFixed(4)} APT</span>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>

      {/* AMM Info */}
      <div className="mt-3 pt-3 border-t border-poly-border">
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>CPMM Formula: x × y = k</span>
          <span>Fee: 0.3%</span>
        </div>
      </div>
    </div>
  );
}
