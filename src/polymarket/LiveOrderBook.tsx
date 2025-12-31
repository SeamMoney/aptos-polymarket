import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, HelpCircle, RefreshCw, Trash2 } from 'lucide-react';
import type { Trade } from '../hooks/useHFTConnection';

interface LiveOrderBookProps {
  yesPrice: number;
  noPrice: number;
  yesReserve: number;
  noReserve: number;
  trades?: Trade[];
  isConnected?: boolean;
}

interface LiquidityLevel {
  amount: number;
  tokensOut: number;
  avgPrice: number;
  slippage: number;
  side: 'buy' | 'sell';
}

// CPMM formula: tokens_out = reserve_out * amount_in / (reserve_in + amount_in)
function calculateBuyOutput(baseReserve: number, outcomeReserve: number, amountIn: number): number {
  if (baseReserve <= 0 || outcomeReserve <= 0) return 0;
  return (outcomeReserve * amountIn) / (baseReserve + amountIn);
}

function calculateSpotPrice(baseReserve: number, outcomeReserve: number): number {
  if (baseReserve <= 0 || outcomeReserve <= 0) return 50;
  const total = baseReserve + outcomeReserve;
  return (baseReserve / total) * 100;
}

export function LiveOrderBook({
  yesPrice,
  noPrice,
  yesReserve,
  noReserve,
  trades = [],
  isConnected = false,
}: LiveOrderBookProps) {
  const [expanded, setExpanded] = useState(true);
  const [tradeTab, setTradeTab] = useState<'yes' | 'no'>('yes');
  const [animatedTrades, setAnimatedTrades] = useState<Set<string>>(new Set());

  // Calculate liquidity depth from AMM reserves
  const { buyLevels, sellLevels, maxAmount } = useMemo(() => {
    const baseReserve = yesReserve > 0 ? yesReserve : 1000;
    const outcomeReserve = noReserve > 0 ? noReserve : 1000;
    const spotPrice = calculateSpotPrice(baseReserve, outcomeReserve);

    const tradeSizes = [0.1, 0.5, 1, 2, 5, 10, 25, 50];

    const buyLevels: LiquidityLevel[] = tradeSizes.map(amount => {
      const tokensOut = calculateBuyOutput(baseReserve, outcomeReserve, amount);
      const avgPrice = tokensOut > 0 ? (amount / tokensOut) * 100 : spotPrice;
      const slippage = spotPrice > 0 ? ((avgPrice - spotPrice) / spotPrice) * 100 : 0;
      return { amount, tokensOut, avgPrice, slippage: Math.abs(slippage), side: 'buy' as const };
    }).filter(l => l.tokensOut > 0);

    const sellLevels: LiquidityLevel[] = tradeSizes.map(amount => {
      const tokensOut = calculateBuyOutput(outcomeReserve, baseReserve, amount);
      const avgPrice = tokensOut > 0 ? (amount / tokensOut) * 100 : (100 - spotPrice);
      const basePrice = 100 - spotPrice;
      const slippage = basePrice > 0 ? ((avgPrice - basePrice) / basePrice) * 100 : 0;
      return { amount, tokensOut, avgPrice, slippage: Math.abs(slippage), side: 'sell' as const };
    }).filter(l => l.tokensOut > 0);

    const maxAmount = Math.max(...buyLevels.map(l => l.amount), ...sellLevels.map(l => l.amount));
    return { buyLevels, sellLevels, maxAmount };
  }, [yesReserve, noReserve]);

  // Animate recent trades
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

  const formatAmount = (amount: number) => amount >= 10 ? amount.toFixed(0) : amount >= 1 ? amount.toFixed(1) : amount.toFixed(2);
  const formatTokens = (tokens: number) => tokens >= 100 ? tokens.toFixed(0) : tokens >= 10 ? tokens.toFixed(1) : tokens.toFixed(2);
  const tvl = yesReserve + noReserve;

  return (
    <div className="rounded-2xl border-2 border-[#2c3f4f] overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-4 flex items-center justify-between hover:bg-[#2a3d4e]/30 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-white text-xl font-bold">Order Book</span>
          <HelpCircle size={18} color="#6E7681" strokeWidth={2.5} />
          {isConnected && (
            <span className="flex items-center gap-1.5 text-xs text-[#5BA3D9] bg-[#1e3a5f] px-2 py-0.5 rounded">
              <span className="w-1.5 h-1.5 rounded-full bg-[#5BA3D9] animate-pulse" />
              LIVE
            </span>
          )}
        </div>
        <ChevronDown
          size={22}
          color="#8297a3"
          strokeWidth={2.5}
          className={`transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
        />
      </button>

      {expanded && (
        <>
          {/* Trade tabs */}
          <div className="flex items-center px-4 pb-3 border-b-2 border-[#2c3f4f]">
            <div className="flex gap-6 flex-1">
              <button
                onClick={() => setTradeTab('yes')}
                className={`relative pb-2 transition-colors ${tradeTab === 'yes' ? 'text-white' : 'text-[#6b7a8a]'}`}
              >
                <span className={`text-base ${tradeTab === 'yes' ? 'font-bold' : 'font-medium'}`}>Trade Yes</span>
                {tradeTab === 'yes' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white rounded-full" />}
              </button>
              <button
                onClick={() => setTradeTab('no')}
                className={`relative pb-2 transition-colors ${tradeTab === 'no' ? 'text-white' : 'text-[#6b7a8a]'}`}
              >
                <span className={`text-base ${tradeTab === 'no' ? 'font-bold' : 'font-medium'}`}>Trade No</span>
                {tradeTab === 'no' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white rounded-full" />}
              </button>
            </div>
            <div className="flex items-center gap-3">
              <button className="p-1.5 hover:bg-[#2a3d4e] rounded-lg transition-colors">
                <Trash2 size={20} color="#6b7a8a" strokeWidth={2.5} />
              </button>
              <button className="p-1.5 hover:bg-[#2a3d4e] rounded-lg transition-colors">
                <RefreshCw size={20} color="#6b7a8a" strokeWidth={2.5} />
              </button>
            </div>
          </div>

          {/* Column headers */}
          <div className="grid grid-cols-4 text-xs text-[#6b7a8a] px-4 py-3 border-b-2 border-[#2c3f4f]">
            <span className="font-semibold uppercase tracking-wider">Size (APT)</span>
            <span className="text-right font-semibold uppercase tracking-wider">Tokens</span>
            <span className="text-right font-semibold uppercase tracking-wider">Price</span>
            <span className="text-right font-semibold uppercase tracking-wider">Slippage</span>
          </div>

          {/* Asks (Sells) */}
          <div className="max-h-[200px] overflow-y-auto">
            <div className="px-2 py-1">
              <span className="text-[10px] text-red-400/70 font-medium px-2">SELL {tradeTab.toUpperCase()}</span>
            </div>
            <AnimatePresence mode="popLayout">
              {sellLevels.slice().reverse().map((level) => {
                const depthPercent = (level.amount / maxAmount) * 100;
                const slippageColor = level.slippage < 1 ? 'text-[#8b98a5]' : level.slippage < 5 ? 'text-yellow-400' : 'text-red-400';
                return (
                  <motion.div
                    key={`sell-${level.amount}`}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="relative grid grid-cols-4 text-sm py-2 px-4 hover:bg-red-500/10 transition-colors cursor-pointer"
                  >
                    <div
                      className="absolute right-0 top-0 bottom-0 bg-red-500/15 pointer-events-none"
                      style={{ width: `${Math.min(depthPercent, 100)}%` }}
                    />
                    <span className="relative z-10 text-[#ef4444] font-medium tabular-nums">{formatAmount(level.amount)}</span>
                    <span className="relative z-10 text-right text-[#8b98a5] tabular-nums">{formatTokens(level.tokensOut)}</span>
                    <span className="relative z-10 text-right text-[#8b98a5] tabular-nums">{level.avgPrice.toFixed(1)}¢</span>
                    <span className={`relative z-10 text-right font-mono ${slippageColor} tabular-nums`}>
                      {level.slippage < 0.1 ? '<0.1%' : `${level.slippage.toFixed(1)}%`}
                    </span>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>

          {/* Spread / Mid Price */}
          <div className="flex items-center justify-between px-4 py-3 border-y-2 border-[#2c3f4f] bg-[#2a3d4e]/30">
            <div className="flex flex-col">
              <span className="text-xl font-bold text-[#22c55e] tabular-nums">{yesPrice.toFixed(1)}¢</span>
              <span className="text-[10px] text-[#6b7a8a]">YES</span>
            </div>
            <div className="text-center">
              <span className="text-xs text-[#6b7a8a]">Spread: 1¢</span>
              <div className="text-[10px] text-[#6b7a8a]">TVL: {tvl.toFixed(2)} APT</div>
            </div>
            <div className="flex flex-col items-end">
              <span className="text-xl font-bold text-[#ef4444] tabular-nums">{noPrice.toFixed(1)}¢</span>
              <span className="text-[10px] text-[#6b7a8a]">NO</span>
            </div>
          </div>

          {/* Bids (Buys) */}
          <div className="max-h-[200px] overflow-y-auto">
            <div className="px-2 py-1">
              <span className="text-[10px] text-[#22c55e]/70 font-medium px-2">BUY {tradeTab.toUpperCase()}</span>
            </div>
            <AnimatePresence mode="popLayout">
              {buyLevels.map((level) => {
                const depthPercent = (level.amount / maxAmount) * 100;
                const slippageColor = level.slippage < 1 ? 'text-[#8b98a5]' : level.slippage < 5 ? 'text-yellow-400' : 'text-red-400';
                return (
                  <motion.div
                    key={`buy-${level.amount}`}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="relative grid grid-cols-4 text-sm py-2 px-4 hover:bg-green-500/10 transition-colors cursor-pointer"
                  >
                    <div
                      className="absolute left-0 top-0 bottom-0 bg-[#22c55e]/15 pointer-events-none"
                      style={{ width: `${Math.min(depthPercent, 100)}%` }}
                    />
                    <span className="relative z-10 text-[#22c55e] font-medium tabular-nums">{formatAmount(level.amount)}</span>
                    <span className="relative z-10 text-right text-[#8b98a5] tabular-nums">{formatTokens(level.tokensOut)}</span>
                    <span className="relative z-10 text-right text-[#8b98a5] tabular-nums">{level.avgPrice.toFixed(1)}¢</span>
                    <span className={`relative z-10 text-right font-mono ${slippageColor} tabular-nums`}>
                      {level.slippage < 0.1 ? '<0.1%' : `${level.slippage.toFixed(1)}%`}
                    </span>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>

          {/* Recent Trades */}
          {trades.length > 0 && (
            <div className="border-t-2 border-[#2c3f4f] px-4 py-3">
              <div className="text-xs text-[#6b7a8a] mb-2">Recent Trades</div>
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
                          ? trade.actionDisplay.includes('BUY') ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)'
                          : 'transparent'
                      }}
                      exit={{ opacity: 0 }}
                      className="flex items-center justify-between text-xs py-1.5 px-2 rounded"
                    >
                      <div className="flex items-center gap-2">
                        <span className={trade.actionDisplay.includes('BUY') ? 'text-[#22c55e]' : 'text-[#ef4444]'}>
                          {trade.actionDisplay.includes('BUY') ? '↑' : '↓'}
                        </span>
                        <span className="text-[#8297a3] font-medium">{trade.bot}</span>
                        <span className={trade.actionDisplay.includes('BUY') ? 'text-[#22c55e]' : 'text-[#ef4444]'}>
                          {trade.actionDisplay}
                        </span>
                      </div>
                      <span className="text-white font-mono tabular-nums">{trade.amount.toFixed(4)} APT</span>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </div>
          )}

          {/* AMM Info Footer */}
          <div className="px-4 py-2 border-t-2 border-[#2c3f4f] flex items-center justify-between text-xs text-[#6b7a8a]">
            <span>CPMM: x × y = k</span>
            <span>Fee: 0.3%</span>
          </div>
        </>
      )}
    </div>
  );
}
