/**
 * Floating TPS Meter - Always visible sticky component
 * Shows real-time TPS from HFT server
 */

import { motion, AnimatePresence } from 'framer-motion';
import { Zap, TrendingUp, Wifi, WifiOff } from 'lucide-react';

interface FloatingTPSMeterProps {
  tps: number;
  peakTps: number;
  isConnected: boolean;
  isRunning: boolean;
  onClick?: () => void;
}

export function FloatingTPSMeter({
  tps,
  peakTps,
  isConnected,
  isRunning,
  onClick,
}: FloatingTPSMeterProps) {
  const formatTPS = (n: number) => {
    if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
    return n.toLocaleString();
  };

  // Color based on TPS level
  const tpsColor = tps > 20000 ? '#22c55e' : tps > 10000 ? '#60a5fa' : tps > 1000 ? '#fbbf24' : '#8297a3';

  return (
    <motion.div
      initial={{ y: 100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="fixed bottom-20 right-4 z-40"
    >
      <motion.button
        onClick={onClick}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        className="bg-[#1c2b3a] border-2 border-[#2c3f4f] rounded-2xl px-4 py-3 shadow-xl backdrop-blur-sm"
        style={{
          boxShadow: isRunning ? `0 0 20px ${tpsColor}40` : undefined,
        }}
      >
        <div className="flex items-center gap-3">
          {/* Connection Status */}
          <div className="flex items-center gap-1.5">
            {isConnected ? (
              <Wifi size={14} className="text-green-400" />
            ) : (
              <WifiOff size={14} className="text-red-400" />
            )}
          </div>

          {/* TPS Display */}
          <div className="flex items-center gap-2">
            <Zap
              size={18}
              style={{ color: tpsColor }}
              className={isRunning ? 'animate-pulse' : ''}
            />
            <div className="text-right">
              <div
                className="text-xl font-bold tabular-nums"
                style={{ color: tpsColor }}
              >
                {formatTPS(tps)}
              </div>
              <div className="text-[10px] text-[#6b7a8a] -mt-1">TPS</div>
            </div>
          </div>

          {/* Peak TPS (when running) */}
          <AnimatePresence>
            {isRunning && peakTps > 0 && (
              <motion.div
                initial={{ width: 0, opacity: 0 }}
                animate={{ width: 'auto', opacity: 1 }}
                exit={{ width: 0, opacity: 0 }}
                className="flex items-center gap-1 pl-2 border-l border-[#2c3f4f] overflow-hidden"
              >
                <TrendingUp size={12} className="text-[#22c55e]" />
                <span className="text-xs text-[#22c55e] font-medium tabular-nums">
                  {formatTPS(peakTps)}
                </span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Live indicator */}
          {isRunning && (
            <div className="flex items-center gap-1 ml-1">
              <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
              <span className="text-[10px] text-red-400 font-bold">LIVE</span>
            </div>
          )}
        </div>
      </motion.button>
    </motion.div>
  );
}
