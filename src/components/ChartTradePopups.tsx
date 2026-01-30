/**
 * ChartTradePopups - Floating trade amount popups on the chart
 *
 * Shows +$X or -$X amounts. New trades appear at bottom and push existing up.
 * Only shows for NEW trades (after component mounts).
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
  tpsThreshold?: number;
}

interface PopupItem {
  id: string;
  amount: number;
  isBuy: boolean;
  createdAt: number;
}

const POPUP_LIFETIME_MS = 1500;
const SAMPLE_WINDOW_MS = 1000;
const POPUP_HEIGHT = 22;

export function ChartTradePopups({
  trades,
  maxVisible = 4,
  tpsThreshold = 100,
}: ChartTradePopupsProps) {
  const [popups, setPopups] = useState<PopupItem[]>([]);
  const seenTradeIdsRef = useRef<Set<string>>(new Set());
  const tradeTimestampsRef = useRef<number[]>([]);
  const sampleCounterRef = useRef(0);
  // Only show popups for trades that arrive AFTER this timestamp
  const mountTimeRef = useRef(Date.now());

  const getCurrentTps = useCallback(() => {
    const now = Date.now();
    tradeTimestampsRef.current = tradeTimestampsRef.current.filter(
      t => now - t < SAMPLE_WINDOW_MS
    );
    return tradeTimestampsRef.current.length;
  }, []);

  const getSampleRate = useCallback((tps: number): number => {
    if (tps < tpsThreshold) return 1;
    if (tps < tpsThreshold * 3) return 3;
    if (tps < tpsThreshold * 10) return 10;
    return 25;
  }, [tpsThreshold]);

  // Process new trades - only show popups for trades that arrived after mount
  useEffect(() => {
    if (!trades || trades.length === 0) return;

    const now = Date.now();

    for (const trade of trades) {
      // Skip trades we've already seen
      if (seenTradeIdsRef.current.has(trade.id)) continue;

      // Mark as seen regardless of whether we show popup
      seenTradeIdsRef.current.add(trade.id);

      // Skip trades that existed before this component mounted
      // (trade timestamp is in ms, mountTimeRef is in ms)
      if (trade.timestamp < mountTimeRef.current) {
        continue;
      }

      tradeTimestampsRef.current.push(now);

      const currentTps = getCurrentTps();
      const sampleRate = getSampleRate(currentTps);
      sampleCounterRef.current++;

      if (sampleRate > 1 && sampleCounterRef.current % sampleRate !== 0) {
        continue;
      }

      const isBuy = trade.action.includes('buy');

      setPopups(prev => {
        const newPopup: PopupItem = {
          id: `${trade.id}-${now}`,
          amount: trade.amount,
          isBuy,
          createdAt: now,
        };
        // New popup at start, pushes others up
        return [newPopup, ...prev].slice(0, maxVisible);
      });

      break;
    }
  }, [trades, maxVisible, getCurrentTps, getSampleRate]);

  // Cleanup expired popups
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setPopups(prev => prev.filter(p => now - p.createdAt < POPUP_LIFETIME_MS));
    }, 100);
    return () => clearInterval(interval);
  }, []);

  // Cleanup seen IDs
  useEffect(() => {
    const interval = setInterval(() => {
      if (seenTradeIdsRef.current.size > 500) {
        const arr = Array.from(seenTradeIdsRef.current);
        seenTradeIdsRef.current = new Set(arr.slice(-250));
      }
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  const formatAmount = (amount: number): string => {
    if (amount >= 1000) return `$${(amount / 1000).toFixed(1)}K`;
    if (amount >= 100) return `$${Math.round(amount)}`;
    if (amount >= 1) return `$${amount.toFixed(0)}`;
    return `$${amount.toFixed(2)}`;
  };

  if (popups.length === 0) return null;

  return (
    <div className="absolute bottom-8 left-4 pointer-events-none z-10">
      {popups.map((popup, index) => {
        const age = Date.now() - popup.createdAt;
        const progress = age / POPUP_LIFETIME_MS;

        // Fade out in last 40% of life
        const opacity = progress < 0.6 ? 1 : 1 - ((progress - 0.6) / 0.4);

        // Position: index 0 at bottom, higher indices above
        const bottomOffset = index * POPUP_HEIGHT;

        return (
          <div
            key={popup.id}
            className="absolute whitespace-nowrap"
            style={{
              bottom: `${bottomOffset}px`,
              left: 0,
              color: popup.isBuy ? '#22c55e' : '#ef4444',
              opacity: Math.max(0, opacity),
              fontSize: '14px',
              fontWeight: 600,
              fontFamily: '"Open Sauce One", system-ui, sans-serif',
              textShadow: '0 1px 2px rgba(0,0,0,0.5)',
              // Smooth transition when pushed up by new popup
              transition: 'bottom 0.2s ease-out, opacity 0.2s ease-out',
            }}
          >
            {popup.isBuy ? '+' : '-'} {formatAmount(popup.amount)}
          </div>
        );
      })}
    </div>
  );
}
