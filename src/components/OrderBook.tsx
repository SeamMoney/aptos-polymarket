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

interface OrderLevel {
  price: number;
  size: number;
  total: number;
  orders: number;
  side: 'bid' | 'ask';
}

export function OrderBook({ trades, yesPrice, noPrice, yesReserve, noReserve }: OrderBookProps) {
  const [showDepth, setShowDepth] = useState(true);
  const [animatedTrades, setAnimatedTrades] = useState<Set<string>>(new Set());

  // Update counter to force recalculation
  const [updateCounter, setUpdateCounter] = useState(0);

  // Force update on new trades
  useEffect(() => {
    if (trades.length > 0) {
      setUpdateCounter(c => c + 1);
    }
  }, [trades.length]);

  // Generate synthetic order book from AMM curve with trade-reactive sizing
  const { bids, asks, maxTotal } = useMemo(() => {
    const bidLevels: OrderLevel[] = [];
    const askLevels: OrderLevel[] = [];

    const currentMidPrice = yesPrice;

    // Calculate recent trade pressure to bias order sizes
    const recentTrades = trades.slice(0, 20);
    let buyPressure = 0;
    let sellPressure = 0;
    recentTrades.forEach(t => {
      if (t.actionDisplay.includes('BUY')) buyPressure += t.amount;
      else sellPressure += t.amount;
    });
    const pressureRatio = buyPressure / (buyPressure + sellPressure + 0.001);

    // Seeded random for consistent but varying values
    const seededRandom = (seed: number) => {
      const x = Math.sin(seed * 9999 + updateCounter * 0.1) * 10000;
      return x - Math.floor(x);
    };

    // Generate bid levels - scale to realistic trade sizes (0.01-0.5 APT range)
    let bidTotal = 0;
    for (let i = 0; i <= 8; i += 1) {
      const priceOffset = i * 2;
      const price = Math.max(1, currentMidPrice - priceOffset);
      const distanceFactor = Math.exp(-priceOffset / 12);

      // Realistic trade sizes based on actual bot activity
      const pressureAdjust = 0.7 + (1 - pressureRatio) * 0.6;
      const baseSize = 0.15 * distanceFactor * pressureAdjust; // ~0.15 APT base
      const variance = 0.5 + seededRandom(price + i) * 1.0;
      const size = baseSize * variance;
      bidTotal += size;

      if (size > 0.01) {
        bidLevels.push({
          price,
          size,
          total: bidTotal,
          orders: Math.floor(1 + seededRandom(price * 2 + i) * 4),
          side: 'bid',
        });
      }
    }

    // Generate ask levels - scale to realistic trade sizes
    let askTotal = 0;
    for (let i = 0; i <= 8; i += 1) {
      const priceOffset = i * 2;
      const price = Math.min(99, currentMidPrice + priceOffset);
      const distanceFactor = Math.exp(-priceOffset / 12);

      const pressureAdjust = 0.7 + pressureRatio * 0.6;
      const baseSize = 0.15 * distanceFactor * pressureAdjust;
      const variance = 0.5 + seededRandom(price + i + 100) * 1.0;
      const size = baseSize * variance;
      askTotal += size;

      if (size > 0.01) {
        askLevels.push({
          price,
          size,
          total: askTotal,
          orders: Math.floor(1 + seededRandom(price * 2 + i + 100) * 4),
          side: 'ask',
        });
      }
    }

    const maxTotal = Math.max(bidTotal, askTotal);

    return {
      bids: bidLevels.slice(0, 8),
      asks: askLevels.slice(0, 8).reverse(),
      maxTotal
    };
  }, [yesPrice, yesReserve, noReserve, trades, updateCounter]);

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

  // Recent trades aggregated by price level
  const recentTradesByPrice = useMemo(() => {
    const priceMap = new Map<number, { buys: number; sells: number; volume: number }>();

    trades.slice(0, 50).forEach(trade => {
      if (!trade.success) return;

      // Estimate execution price based on action and current price
      let execPrice: number;
      if (trade.actionDisplay.includes('YES')) {
        execPrice = Math.round(yesPrice);
      } else {
        execPrice = Math.round(100 - yesPrice);
      }

      // Round to nearest 2
      execPrice = Math.round(execPrice / 2) * 2;

      const existing = priceMap.get(execPrice) || { buys: 0, sells: 0, volume: 0 };
      if (trade.actionDisplay.includes('BUY')) {
        existing.buys += trade.amount;
      } else {
        existing.sells += trade.amount;
      }
      existing.volume += trade.amount;
      priceMap.set(execPrice, existing);
    });

    return priceMap;
  }, [trades, yesPrice]);

  const formatSize = (size: number) => {
    if (size >= 1) return size.toFixed(2);
    if (size >= 0.1) return size.toFixed(3);
    return size.toFixed(4);
  };

  const spread = asks.length > 0 && bids.length > 0
    ? (asks[asks.length - 1]?.price || 0) - (bids[0]?.price || 0)
    : 0;

  return (
    <div className="bg-poly-dark rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="text-sm text-gray-400 font-semibold">AMM Liquidity</div>
          <span className="text-[10px] text-gray-600 bg-poly-card px-1.5 py-0.5 rounded">Synthetic</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowDepth(!showDepth)}
            className={`text-xs px-2 py-1 rounded ${showDepth ? 'bg-poly-green/20 text-poly-green' : 'bg-poly-card text-gray-400'}`}
          >
            Depth
          </button>
          <span className="text-xs text-gray-500">
            Spread: {spread.toFixed(1)}%
          </span>
        </div>
      </div>

      {/* Header */}
      <div className="grid grid-cols-4 text-xs text-gray-500 mb-2 px-2">
        <span>Price</span>
        <span className="text-right">Size</span>
        <span className="text-right">Total</span>
        <span className="text-right">Orders</span>
      </div>

      {/* Asks (sell orders) - shown in reverse so lowest ask is at bottom */}
      <div className="space-y-0.5 mb-2">
        <AnimatePresence mode="popLayout">
          {asks.map((level, i) => {
            const depthPercent = (level.total / maxTotal) * 100;
            const isNearMid = Math.abs(level.price - yesPrice) < 3;

            return (
              <motion.div
                key={`ask-${level.price}`}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="relative grid grid-cols-4 text-xs py-1 px-2 rounded hover:bg-red-500/10 transition-colors"
              >
                {/* Depth visualization */}
                {showDepth && (
                  <div
                    className="absolute right-0 top-0 bottom-0 bg-red-500/20 rounded-r"
                    style={{ width: `${depthPercent}%` }}
                  />
                )}
                <span className={`relative z-10 ${isNearMid ? 'text-red-400 font-bold' : 'text-red-400/70'}`}>
                  {level.price.toFixed(1)}
                </span>
                <span className="relative z-10 text-right text-gray-300">
                  {formatSize(level.size)}
                </span>
                <span className="relative z-10 text-right text-gray-400">
                  {formatSize(level.total)}
                </span>
                <span className="relative z-10 text-right text-gray-500">
                  {level.orders}
                </span>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Spread / Mid Price */}
      <div className="py-2 px-2 bg-poly-card rounded-lg mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg font-bold text-white">{yesPrice.toFixed(1)}</span>
          <span className="text-xs text-gray-500">YES</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">NO</span>
          <span className="text-lg font-bold text-white">{noPrice.toFixed(1)}</span>
        </div>
      </div>

      {/* Bids (buy orders) */}
      <div className="space-y-0.5">
        <AnimatePresence mode="popLayout">
          {bids.map((level, i) => {
            const depthPercent = (level.total / maxTotal) * 100;
            const isNearMid = Math.abs(level.price - yesPrice) < 3;

            return (
              <motion.div
                key={`bid-${level.price}`}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="relative grid grid-cols-4 text-xs py-1 px-2 rounded hover:bg-green-500/10 transition-colors"
              >
                {/* Depth visualization */}
                {showDepth && (
                  <div
                    className="absolute left-0 top-0 bottom-0 bg-poly-green/20 rounded-l"
                    style={{ width: `${depthPercent}%` }}
                  />
                )}
                <span className={`relative z-10 ${isNearMid ? 'text-poly-green font-bold' : 'text-poly-green/70'}`}>
                  {level.price.toFixed(1)}
                </span>
                <span className="relative z-10 text-right text-gray-300">
                  {formatSize(level.size)}
                </span>
                <span className="relative z-10 text-right text-gray-400">
                  {formatSize(level.total)}
                </span>
                <span className="relative z-10 text-right text-gray-500">
                  {level.orders}
                </span>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Recent Trades Summary */}
      <div className="mt-4 pt-3 border-t border-poly-border">
        <div className="text-xs text-gray-500 mb-2">Recent Trade Volume by Price</div>
        <div className="flex flex-wrap gap-1">
          {Array.from(recentTradesByPrice.entries())
            .sort((a, b) => b[0] - a[0])
            .slice(0, 10)
            .map(([price, data]) => (
              <div
                key={price}
                className="px-2 py-1 rounded text-xs bg-poly-card"
                title={`Buys: ${data.buys.toFixed(4)} | Sells: ${data.sells.toFixed(4)}`}
              >
                <span className="text-gray-400">{price}:</span>
                <span className={`ml-1 font-mono ${data.buys > data.sells ? 'text-poly-green' : 'text-red-400'}`}>
                  {data.volume.toFixed(2)}
                </span>
              </div>
            ))}
        </div>
      </div>

      {/* Trade Tape - Last 5 trades */}
      <div className="mt-3 pt-3 border-t border-poly-border">
        <div className="text-xs text-gray-500 mb-2">Trade Tape</div>
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
                  <span className={trade.actionDisplay.includes('YES') ? 'text-poly-green' : 'text-red-400'}>
                    {trade.actionDisplay}
                  </span>
                </div>
                <span className="text-white font-mono">{trade.amount.toFixed(4)} APT</span>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
