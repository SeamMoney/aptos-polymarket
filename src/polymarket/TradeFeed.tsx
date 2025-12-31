/**
 * Trade Feed - Polymarket-style live trade feed
 * Shows real-time trades with animations
 */

import { useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowUp, ArrowDown, ExternalLink } from 'lucide-react';
import type { Trade } from '../hooks/useHFTConnection';

interface TradeFeedProps {
  trades: Trade[];
  maxItems?: number;
  compact?: boolean;
  showHeader?: boolean;
  outcomes?: string[];
}

const OUTCOME_COLORS = [
  '#22c55e', // Green
  '#60a5fa', // Blue
  '#fbbf24', // Yellow
  '#06b6d4', // Cyan
  '#ef4444', // Red
  '#a855f7', // Purple
];

export function TradeFeed({
  trades,
  maxItems = 10,
  compact = false,
  showHeader = true,
  outcomes = [],
}: TradeFeedProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Format amount
  const formatAmount = (amount: number) => {
    const apt = amount / 100_000_000;
    if (apt >= 1000) return `${(apt / 1000).toFixed(1)}K`;
    if (apt >= 1) return apt.toFixed(2);
    return apt.toFixed(4);
  };

  // Format time
  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  // Get outcome name
  const getOutcomeName = (outcomeIndex: number | undefined) => {
    if (outcomeIndex === undefined) return 'Unknown';
    return outcomes[outcomeIndex] || `Outcome ${outcomeIndex + 1}`;
  };

  // Get color for outcome
  const getOutcomeColor = (outcomeIndex: number | undefined) => {
    if (outcomeIndex === undefined) return '#8297a3';
    return OUTCOME_COLORS[outcomeIndex % OUTCOME_COLORS.length];
  };

  const displayTrades = trades.slice(0, maxItems);

  if (compact) {
    return (
      <div className="space-y-1">
        <AnimatePresence mode="popLayout">
          {displayTrades.map((trade) => (
            <motion.div
              key={trade.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.15 }}
              className="flex items-center justify-between px-2 py-1 text-xs rounded bg-[#1c2b3a]/50"
            >
              <div className="flex items-center gap-2">
                {trade.action.includes('buy') ? (
                  <ArrowUp size={10} className="text-green-400" />
                ) : (
                  <ArrowDown size={10} className="text-red-400" />
                )}
                <span
                  className="font-medium truncate max-w-[60px]"
                  style={{ color: getOutcomeColor(trade.outcome) }}
                >
                  {getOutcomeName(trade.outcome)}
                </span>
              </div>
              <span className="text-[#8297a3] tabular-nums">
                {formatAmount(trade.amount)} APT
              </span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    );
  }

  return (
    <div className="bg-[#1c2b3a] rounded-xl border border-[#2c3f4f] overflow-hidden">
      {showHeader && (
        <div className="px-4 py-3 border-b border-[#2c3f4f] flex items-center justify-between">
          <span className="text-sm font-semibold text-white">Live Trades</span>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
            <span className="text-xs text-[#6b7a8a]">{trades.length} trades</span>
          </div>
        </div>
      )}

      <div
        ref={containerRef}
        className="max-h-[300px] overflow-y-auto scrollbar-thin scrollbar-thumb-[#2c3f4f] scrollbar-track-transparent"
      >
        <AnimatePresence mode="popLayout">
          {displayTrades.map((trade, index) => (
            <motion.div
              key={trade.id}
              initial={{ opacity: 0, y: -20, backgroundColor: 'rgba(34, 197, 94, 0.2)' }}
              animate={{ opacity: 1, y: 0, backgroundColor: 'transparent' }}
              exit={{ opacity: 0, y: 20 }}
              transition={{ duration: 0.2, delay: index * 0.02 }}
              className="px-4 py-2 border-b border-[#2c3f4f]/50 hover:bg-[#2a3d4e]/30 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {/* Buy/Sell indicator */}
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center ${
                      trade.action.includes('buy')
                        ? 'bg-green-500/20'
                        : 'bg-red-500/20'
                    }`}
                  >
                    {trade.action.includes('buy') ? (
                      <ArrowUp size={14} className="text-green-400" />
                    ) : (
                      <ArrowDown size={14} className="text-red-400" />
                    )}
                  </div>

                  {/* Trade details */}
                  <div>
                    <div className="flex items-center gap-2">
                      <span
                        className="font-medium text-sm"
                        style={{ color: getOutcomeColor(trade.outcome) }}
                      >
                        {getOutcomeName(trade.outcome)}
                      </span>
                      <span className="text-xs text-[#6b7a8a]">
                        {trade.action.includes('buy') ? 'bought' : 'sold'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-[#6b7a8a]">
                      <span className="tabular-nums">{formatTime(trade.timestamp)}</span>
                      {trade.latency && (
                        <span className="text-[#4ade80]">{trade.latency}ms</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Amount and link */}
                <div className="text-right">
                  <div className="text-sm font-medium text-white tabular-nums">
                    {formatAmount(trade.amount)} APT
                  </div>
                  {trade.txHash && (
                    <a
                      href={`https://explorer.aptoslabs.com/txn/${trade.txHash}?network=testnet`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-[#60a5fa] hover:underline flex items-center gap-1 justify-end"
                    >
                      <span className="truncate max-w-[60px]">
                        {trade.txHash.slice(0, 8)}...
                      </span>
                      <ExternalLink size={10} />
                    </a>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {displayTrades.length === 0 && (
          <div className="px-4 py-8 text-center text-[#6b7a8a] text-sm">
            No trades yet. Start the HFT demo to see live trades.
          </div>
        )}
      </div>
    </div>
  );
}
