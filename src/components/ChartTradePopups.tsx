/**
 * ChartTradePopups - Floating trade amount popups on the chart
 *
 * Shows +$X or -$X amounts that animate up and fade out.
 * Rate-limited during high TPS to prevent overwhelming the UI.
 */

import { useState, useEffect, useRef, useCallback } from 'react';

interface Trade {
  id: string;
  action: string;
  amount: number;
  timestamp: number;
}

interface ChartTradePopupsProps {
  trades: Trade[];
  maxVisible?: number;
  tpsThreshold?: number; // Above this TPS, sample trades
}

interface PopupItem {
  id: string;
  amount: number;
  isBuy: boolean;
  createdAt: number;
  index: number; // Position in stack (0 = newest at bottom)
}

const POPUP_LIFETIME_MS = 4000; // How long each popup lives
const SAMPLE_WINDOW_MS = 1000; // Window for TPS calculation
const POPUP_HEIGHT = 28; // Height of each popup row

export function ChartTradePopups({
  trades,
  maxVisible = 5,
  tpsThreshold = 100,
}: ChartTradePopupsProps) {
  const [popups, setPopups] = useState<PopupItem[]>([]);
  const seenTradeIdsRef = useRef<Set<string>>(new Set());
  const tradeTimestampsRef = useRef<number[]>([]); // For TPS calculation
  const sampleCounterRef = useRef(0);
  const popupCounterRef = useRef(0);

  // Calculate current TPS based on recent trades
  const getCurrentTps = useCallback(() => {
    const now = Date.now();
    const recentTimestamps = tradeTimestampsRef.current.filter(
      t => now - t < SAMPLE_WINDOW_MS
    );
    tradeTimestampsRef.current = recentTimestamps;
    return recentTimestamps.length;
  }, []);

  // Determine sample rate based on TPS
  const getSampleRate = useCallback((tps: number): number => {
    if (tps < tpsThreshold) return 1; // Show all
    if (tps < tpsThreshold * 3) return 3; // Show 1 in 3
    if (tps < tpsThreshold * 10) return 10; // Show 1 in 10
    return 25; // Show 1 in 25 at extreme TPS
  }, [tpsThreshold]);

  // Process new trades
  useEffect(() => {
    if (!trades || trades.length === 0) return;

    const now = Date.now();
    const newPopups: PopupItem[] = [];

    for (const trade of trades) {
      // Skip if already seen
      if (seenTradeIdsRef.current.has(trade.id)) continue;
      seenTradeIdsRef.current.add(trade.id);

      // Record timestamp for TPS calculation
      tradeTimestampsRef.current.push(now);

      // Check if we should sample this trade
      const currentTps = getCurrentTps();
      const sampleRate = getSampleRate(currentTps);
      sampleCounterRef.current++;

      if (sampleRate > 1 && sampleCounterRef.current % sampleRate !== 0) {
        continue; // Skip this trade (sampling)
      }

      const isBuy = trade.action.includes('buy');
      popupCounterRef.current++;

      newPopups.push({
        id: `${trade.id}-${popupCounterRef.current}`,
        amount: trade.amount,
        isBuy,
        createdAt: now,
        index: 0,
      });
    }

    if (newPopups.length > 0) {
      setPopups(prev => {
        // Shift existing popups up (increase their index)
        const shifted = prev.map(p => ({ ...p, index: p.index + newPopups.length }));
        // Add new popups at index 0 (bottom)
        const combined = [...newPopups, ...shifted];
        // Keep only maxVisible + buffer
        return combined.slice(0, maxVisible + 3);
      });
    }
  }, [trades, maxVisible, getCurrentTps, getSampleRate]);

  // Cleanup expired popups and update positions
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setPopups(prev => {
        const filtered = prev.filter(p => now - p.createdAt < POPUP_LIFETIME_MS);
        // Re-index to keep positions tight
        return filtered.map((p, i) => ({ ...p, index: i }));
      });
    }, 200);

    return () => clearInterval(interval);
  }, []);

  // Cleanup seen IDs periodically to prevent memory bloat
  useEffect(() => {
    const interval = setInterval(() => {
      if (seenTradeIdsRef.current.size > 1000) {
        const arr = Array.from(seenTradeIdsRef.current);
        seenTradeIdsRef.current = new Set(arr.slice(-500));
      }
    }, 10000);

    return () => clearInterval(interval);
  }, []);

  // Format amount for display
  const formatAmount = (amount: number): string => {
    if (amount >= 1000) return `$${(amount / 1000).toFixed(1)}K`;
    if (amount >= 100) return `$${Math.round(amount)}`;
    if (amount >= 1) return `$${amount.toFixed(0)}`;
    return `$${amount.toFixed(2)}`;
  };

  if (popups.length === 0) return null;

  return (
    <div
      className="absolute bottom-12 left-4 pointer-events-none z-10"
      style={{
        height: `${maxVisible * POPUP_HEIGHT + 20}px`,
        width: '120px',
      }}
    >
      {popups.slice(0, maxVisible).map((popup) => {
        const age = Date.now() - popup.createdAt;
        const lifeProgress = Math.min(age / POPUP_LIFETIME_MS, 1);

        // Opacity: full for first 60% of life, then fade out
        const opacity = lifeProgress < 0.6 ? 1 : 1 - ((lifeProgress - 0.6) / 0.4);

        // Position from bottom based on index
        const bottomOffset = popup.index * POPUP_HEIGHT;

        return (
          <div
            key={popup.id}
            className="absolute left-0 whitespace-nowrap"
            style={{
              bottom: `${bottomOffset}px`,
              color: popup.isBuy ? '#22c55e' : '#ef4444',
              opacity: Math.max(0.15, opacity),
              fontSize: '15px',
              fontWeight: 600,
              fontFamily: '"Open Sauce One", system-ui, -apple-system, sans-serif',
              textShadow: '0 1px 3px rgba(0,0,0,0.6)',
              transition: 'bottom 0.3s ease-out, opacity 0.3s ease-out',
              // Entry animation
              animation: popup.index === 0 && age < 300 ? 'slideUp 0.3s ease-out' : 'none',
            }}
          >
            {popup.isBuy ? '+' : '-'} {formatAmount(popup.amount)}
          </div>
        );
      })}

      {/* CSS animation keyframes */}
      <style>{`
        @keyframes slideUp {
          from {
            transform: translateY(20px);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}
