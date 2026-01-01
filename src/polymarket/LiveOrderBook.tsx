import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { ChevronDown, HelpCircle, ArrowUp, ArrowDown, ExternalLink } from 'lucide-react';
import type { Trade } from '../hooks/useHFTConnection';


interface LiveOrderBookProps {
  yesPrice: number; // Price in percent (e.g., 55 for 55%)
  noPrice: number;
  yesReserve: number;
  noReserve: number;
  trades?: Trade[];
  isConnected?: boolean;
  isMultiOutcome?: boolean;
  tvl?: number;
  outcomes?: string[];
  onLoadMore?: () => void;
  hasMore?: boolean;
}

interface OrderLevel {
  price: number;      // Price in cents
  size: number;       // Size in APT
  total: number;      // Cumulative size
  slippage: number;   // Slippage percentage
}

const OUTCOME_COLORS = [
  '#2E5CFF', // Blue - JD Vance
  '#00C389', // Green - Marco Rubio
  '#FF6B35', // Orange - Donald Trump
  '#9747FF', // Purple - Ron DeSantis
  '#F5A623', // Yellow - Tucker Carlson
  '#E5534B', // Red - Other
];

export function LiveOrderBook({
  yesPrice,
  noPrice: _noPrice,
  yesReserve,
  noReserve,
  trades = [],
  isConnected = false,
  isMultiOutcome: _isMultiOutcome = false,
  tvl = 0,
  outcomes = [],
  onLoadMore,
  hasMore = true,
}: LiveOrderBookProps) {
  const tradeListRef = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState(true);
  const [activeTab, setActiveTab] = useState<'book' | 'trades'>('book');
  const [animatedTrades, setAnimatedTrades] = useState<Set<string>>(new Set());

  // Infinite scroll handler
  const handleScroll = useCallback(() => {
    if (!tradeListRef.current || !onLoadMore || !hasMore) return;
    const { scrollTop, scrollHeight, clientHeight } = tradeListRef.current;
    // Load more when within 100px of bottom
    if (scrollHeight - scrollTop - clientHeight < 100) {
      onLoadMore();
    }
  }, [onLoadMore, hasMore]);

  // Calculate order book levels - FIXED CALCULATIONS
  const { asks, bids, midPrice, spread } = useMemo(() => {
    // The yesPrice is the probability in percent (e.g., 49 for 49%)
    // In a prediction market, price = probability
    const spotPriceCents = yesPrice; // 49 means 49¢

    // Estimate reserves for slippage calculations
    const estimatedTvl = tvl > 0 ? tvl : 5000;
    const baseReserve = yesReserve > 0 ? yesReserve : estimatedTvl / 2;
    const outcomeReserve = noReserve > 0 ? noReserve : estimatedTvl / 2;

    // Trade sizes for the book
    const sizes = [0.1, 0.25, 0.5, 1, 2, 5, 10, 25, 50, 100];

    // Calculate slippage for each size
    // Slippage = how much worse the price gets for larger orders
    const calculateSlippage = (size: number, _isBuy: boolean) => {
      // Simple model: slippage increases with order size relative to liquidity
      const impactRatio = size / (baseReserve + outcomeReserve);
      const baseSlippage = impactRatio * 100 * 2; // 2x multiplier for visibility
      return Math.min(baseSlippage, 50); // Cap at 50%
    };

    // BIDS (buy orders) - slightly below spot, green side
    let cumBidSize = 0;
    const bids: OrderLevel[] = sizes.map(size => {
      const slippage = calculateSlippage(size, true);
      // Price worsens (goes up) for buyers as size increases
      const price = spotPriceCents * (1 + slippage / 100);
      cumBidSize += size;
      return {
        price: Math.min(99, price),
        size,
        total: cumBidSize,
        slippage,
      };
    });

    // ASKS (sell orders) - slightly above spot, red side
    let cumAskSize = 0;
    const asks: OrderLevel[] = sizes.map(size => {
      const slippage = calculateSlippage(size, false);
      // Price worsens (goes down) for sellers as size increases
      const price = spotPriceCents * (1 - slippage / 100);
      cumAskSize += size;
      return {
        price: Math.max(1, price),
        size,
        total: cumAskSize,
        slippage,
      };
    });

    // Calculate spread
    const bestBid = bids[0]?.price || spotPriceCents;
    const bestAsk = asks[0]?.price || spotPriceCents;
    const spread = Math.abs(bestBid - bestAsk);

    return { asks: asks.reverse(), bids, midPrice: spotPriceCents, spread };
  }, [yesPrice, yesReserve, noReserve, tvl]);

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

  const formatPrice = (price: number) => price.toFixed(1);
  const formatSize = (size: number) => size >= 10 ? size.toFixed(0) : size >= 1 ? size.toFixed(1) : size.toFixed(2);
  const displayTvl = tvl > 0 ? tvl : yesReserve + noReserve;

  // Max total for depth visualization
  const maxTotal = Math.max(
    ...asks.map(a => a.total),
    ...bids.map(b => b.total),
    1
  );

  // Format trade amount
  const formatTradeAmount = (amount: number) => {
    if (amount >= 1) return amount.toFixed(2);
    return amount.toFixed(4);
  };

  // Format trade time
  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', {
      hour12: true,
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  // Get outcome color
  const getOutcomeColor = (outcomeIndex: number | undefined) => {
    if (outcomeIndex === undefined) return '#8297a3';
    return OUTCOME_COLORS[outcomeIndex % OUTCOME_COLORS.length];
  };

  // Get outcome name
  const getOutcomeName = (outcomeIndex: number | undefined) => {
    if (outcomeIndex === undefined) return 'Unknown';
    return outcomes[outcomeIndex] || `Outcome ${outcomeIndex + 1}`;
  };

  return (
    <div className="rounded-2xl border-2 border-[#2c3f4f] overflow-hidden bg-[#1c2b3a]">
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
          {/* Tabs */}
          <div className="flex items-center px-4 pb-3 border-b-2 border-[#2c3f4f]">
            <div className="flex gap-6 flex-1">
              <button
                onClick={() => setActiveTab('book')}
                className={`relative pb-2 transition-colors ${activeTab === 'book' ? 'text-white' : 'text-[#6b7a8a]'}`}
              >
                <span className={`text-base ${activeTab === 'book' ? 'font-bold' : 'font-medium'}`}>Order Book</span>
                {activeTab === 'book' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white rounded-full" />}
              </button>
              <button
                onClick={() => setActiveTab('trades')}
                className={`relative pb-2 transition-colors ${activeTab === 'trades' ? 'text-white' : 'text-[#6b7a8a]'}`}
              >
                <span className={`text-base ${activeTab === 'trades' ? 'font-bold' : 'font-medium'}`}>Trade Stream</span>
                {activeTab === 'trades' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white rounded-full" />}
                {trades.length > 0 && (
                  <span className="absolute -top-1 -right-2 w-2 h-2 bg-[#22c55e] rounded-full animate-pulse" />
                )}
              </button>
            </div>
          </div>

          {activeTab === 'book' ? (
            <>
              {/* Column headers */}
              <div className="grid grid-cols-4 text-xs text-[#6b7a8a] px-4 py-2 border-b border-[#2c3f4f]/50 bg-[#1c2b3a]">
                <span className="font-semibold uppercase tracking-wider">Price</span>
                <span className="text-right font-semibold uppercase tracking-wider">Size</span>
                <span className="text-right font-semibold uppercase tracking-wider">Total</span>
                <span className="text-right font-semibold uppercase tracking-wider">Slip</span>
              </div>

              {/* Single scrollable order book */}
              <div className="max-h-[400px] overflow-y-auto">
                {/* Asks (Sell side) - red, sorted high to low */}
                <div className="bg-[#1c2b3a]/80 px-2 py-1">
                  <span className="text-[10px] text-red-400/80 font-semibold px-2 uppercase tracking-wider">Asks (Sell)</span>
                </div>
                {asks.map((level, idx) => {
                  const depthPercent = (level.total / maxTotal) * 100;
                  const slippageColor = level.slippage < 1 ? 'text-[#6b7a8a]' : level.slippage < 5 ? 'text-yellow-400' : 'text-red-400';
                  return (
                    <div
                      key={`ask-${idx}`}
                      className="relative grid grid-cols-4 text-sm py-1.5 px-4 hover:bg-red-500/10 transition-colors cursor-pointer"
                    >
                      <div
                        className="absolute right-0 top-0 bottom-0 bg-red-500/15 pointer-events-none transition-all duration-300"
                        style={{ width: `${Math.min(depthPercent, 100)}%` }}
                      />
                      <span className="relative z-10 text-red-400 font-medium tabular-nums">{formatPrice(level.price)}¢</span>
                      <span className="relative z-10 text-right text-[#8b98a5] tabular-nums">{formatSize(level.size)}</span>
                      <span className="relative z-10 text-right text-[#8b98a5] tabular-nums">{formatSize(level.total)}</span>
                      <span className={`relative z-10 text-right font-mono text-xs ${slippageColor} tabular-nums`}>
                        {level.slippage < 0.1 ? '—' : `${level.slippage.toFixed(1)}%`}
                      </span>
                    </div>
                  );
                })}

                {/* Spread / Mid Price - sticky in middle */}
                <div className="flex items-center justify-between px-4 py-3 border-y-2 border-[#2c3f4f] bg-[#2a3d4e]/60">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl font-bold text-white tabular-nums">{midPrice.toFixed(1)}¢</span>
                    <div className="flex flex-col">
                      <span className="text-xs text-[#22c55e]">Best Bid</span>
                      <span className="text-xs text-red-400">Best Ask</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-[#6b7a8a]">Spread: {spread.toFixed(1)}¢</div>
                    <div className="text-sm font-medium text-white">{displayTvl.toLocaleString('en-US', { maximumFractionDigits: 0 })} APT</div>
                  </div>
                </div>

                {/* Bids (Buy side) - green */}
                <div className="bg-[#1c2b3a]/80 px-2 py-1">
                  <span className="text-[10px] text-[#22c55e]/80 font-semibold px-2 uppercase tracking-wider">Bids (Buy)</span>
                </div>
                {bids.map((level, idx) => {
                  const depthPercent = (level.total / maxTotal) * 100;
                  const slippageColor = level.slippage < 1 ? 'text-[#6b7a8a]' : level.slippage < 5 ? 'text-yellow-400' : 'text-red-400';
                  return (
                    <div
                      key={`bid-${idx}`}
                      className="relative grid grid-cols-4 text-sm py-1.5 px-4 hover:bg-green-500/10 transition-colors cursor-pointer"
                    >
                      <div
                        className="absolute left-0 top-0 bottom-0 bg-[#22c55e]/15 pointer-events-none transition-all duration-300"
                        style={{ width: `${Math.min(depthPercent, 100)}%` }}
                      />
                      <span className="relative z-10 text-[#22c55e] font-medium tabular-nums">{formatPrice(level.price)}¢</span>
                      <span className="relative z-10 text-right text-[#8b98a5] tabular-nums">{formatSize(level.size)}</span>
                      <span className="relative z-10 text-right text-[#8b98a5] tabular-nums">{formatSize(level.total)}</span>
                      <span className={`relative z-10 text-right font-mono text-xs ${slippageColor} tabular-nums`}>
                        {level.slippage < 0.1 ? '—' : `${level.slippage.toFixed(1)}%`}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Footer */}
              <div className="px-4 py-2 border-t-2 border-[#2c3f4f] flex items-center justify-between text-xs text-[#6b7a8a]">
                <span>CPMM: x × y = k</span>
                <span>Fee: 0.3%</span>
              </div>
            </>
          ) : (
            /* Trade Stream Tab */
            <>
              {/* Trade stream header */}
              <div className="grid grid-cols-5 text-xs text-[#6b7a8a] px-4 py-2 border-b border-[#2c3f4f]/50 bg-[#1c2b3a]">
                <span className="font-semibold uppercase tracking-wider">Time</span>
                <span className="font-semibold uppercase tracking-wider">Side</span>
                <span className="font-semibold uppercase tracking-wider">Outcome</span>
                <span className="text-right font-semibold uppercase tracking-wider">Amount</span>
                <span className="text-right font-semibold uppercase tracking-wider">Tx</span>
              </div>

              {/* Trade stream list - infinite scroll */}
              <div
                ref={tradeListRef}
                onScroll={handleScroll}
                className="max-h-[400px] overflow-y-auto"
              >
                {trades.length === 0 ? (
                  <div className="px-4 py-12 text-center text-[#6b7a8a]">
                    <div className="text-lg mb-2">No trades yet</div>
                    <div className="text-xs">Trades will appear here in real-time</div>
                  </div>
                ) : (
                  trades.map((trade) => {
                    const isBuy = trade.action?.includes('buy') || trade.actionDisplay?.includes('BUY');
                    const isAnimated = animatedTrades.has(trade.id);

                    return (
                      <div
                        key={trade.id}
                        className={`grid grid-cols-5 text-sm py-2 px-4 border-b border-[#2c3f4f]/30
                          hover:bg-[#2a3d4e]/30 transition-all duration-200
                          ${isAnimated ? (isBuy ? 'bg-[#22c55e]/20' : 'bg-red-500/20') : 'bg-transparent'}
                          animate-fade-in`}
                        style={{
                          animation: 'fadeSlideIn 0.2s ease-out',
                        }}
                      >
                        {/* Time */}
                        <span className="text-[#8b98a5] tabular-nums text-xs">
                          {formatTime(trade.timestamp)}
                        </span>

                        {/* Side indicator */}
                        <div className="flex items-center gap-1">
                          <div className={`w-5 h-5 rounded flex items-center justify-center ${
                            isBuy ? 'bg-[#22c55e]/20' : 'bg-red-500/20'
                          }`}>
                            {isBuy ? (
                              <ArrowUp size={12} className="text-[#22c55e]" />
                            ) : (
                              <ArrowDown size={12} className="text-red-400" />
                            )}
                          </div>
                          <span className={`text-xs font-medium ${isBuy ? 'text-[#22c55e]' : 'text-red-400'}`}>
                            {isBuy ? 'BUY' : 'SELL'}
                          </span>
                        </div>

                        {/* Outcome */}
                        <span
                          className="font-medium text-xs truncate"
                          style={{ color: getOutcomeColor(trade.outcome) }}
                        >
                          {getOutcomeName(trade.outcome)}
                        </span>

                        {/* Amount */}
                        <span className="text-right text-white font-medium tabular-nums">
                          {formatTradeAmount(trade.amount)} APT
                        </span>

                        {/* Tx link */}
                        <div className="text-right">
                          {trade.txHash ? (
                            <a
                              href={`https://explorer.aptoslabs.com/txn/${trade.txHash}?network=testnet`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[#5BA3D9] hover:underline text-xs inline-flex items-center gap-1"
                            >
                              {trade.txHash.slice(0, 6)}...
                              <ExternalLink size={10} />
                            </a>
                          ) : (
                            <span className="text-[#6b7a8a] text-xs">—</span>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
                {/* Load more indicator */}
                {trades.length > 0 && hasMore && (
                  <div className="px-4 py-3 text-center text-[#6b7a8a] text-xs">
                    <div className="animate-pulse">Loading more trades...</div>
                  </div>
                )}
                {trades.length > 0 && !hasMore && (
                  <div className="px-4 py-3 text-center text-[#6b7a8a] text-xs">
                    End of trade history
                  </div>
                )}
              </div>

              {/* Trade stream footer */}
              <div className="px-4 py-2 border-t-2 border-[#2c3f4f] flex items-center justify-between text-xs text-[#6b7a8a]">
                <span>{trades.length} total trades</span>
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 bg-[#22c55e] rounded-full animate-pulse" />
                  <span>Live</span>
                </div>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
