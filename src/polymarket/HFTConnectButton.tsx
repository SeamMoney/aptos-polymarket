/**
 * HFT Connect Button - Button to connect and start HFT demo
 * Shows animation when connecting and ready state
 */

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Zap, Play, Square, Wifi, WifiOff, Rocket } from 'lucide-react';

interface HFTConnectButtonProps {
  isConnected: boolean;
  isRunning: boolean;
  onStart: () => void;
  onStop: () => void;
  disabled?: boolean;
}

export function HFTConnectButton({
  isConnected,
  isRunning,
  onStart,
  onStop,
  disabled = false,
}: HFTConnectButtonProps) {
  const [showReadyAnimation, setShowReadyAnimation] = useState(false);

  const handleStart = () => {
    // Show "ready" animation before starting
    setShowReadyAnimation(true);
    setTimeout(() => {
      setShowReadyAnimation(false);
      onStart();
    }, 1500);
  };

  // Ready animation overlay
  if (showReadyAnimation) {
    return (
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="relative"
      >
        <motion.div
          className="px-8 py-4 rounded-2xl bg-gradient-to-r from-green-500 to-emerald-500 text-white font-bold text-lg flex items-center gap-3"
          animate={{
            boxShadow: [
              '0 0 20px rgba(34, 197, 94, 0.3)',
              '0 0 40px rgba(34, 197, 94, 0.6)',
              '0 0 20px rgba(34, 197, 94, 0.3)',
            ],
          }}
          transition={{ duration: 0.5, repeat: Infinity }}
        >
          <Rocket className="animate-bounce" size={24} />
          <span>30K TPS Demo Ready!</span>
          <motion.div
            className="flex gap-1"
            animate={{ opacity: [1, 0.5, 1] }}
            transition={{ duration: 0.3, repeat: Infinity }}
          >
            <span>.</span>
            <span>.</span>
            <span>.</span>
          </motion.div>
        </motion.div>

        {/* Pulse rings */}
        <motion.div
          className="absolute inset-0 rounded-2xl border-2 border-green-400"
          initial={{ scale: 1, opacity: 1 }}
          animate={{ scale: 1.5, opacity: 0 }}
          transition={{ duration: 1, repeat: Infinity }}
        />
        <motion.div
          className="absolute inset-0 rounded-2xl border-2 border-green-400"
          initial={{ scale: 1, opacity: 1 }}
          animate={{ scale: 1.5, opacity: 0 }}
          transition={{ duration: 1, repeat: Infinity, delay: 0.5 }}
        />
      </motion.div>
    );
  }

  // Not connected state - show connecting message
  if (!isConnected) {
    return (
      <motion.button
        onClick={onStart}
        className="px-6 py-3 rounded-xl bg-[#3b82f6] hover:bg-[#2563eb] text-white font-semibold flex items-center gap-2"
        whileHover={{ scale: 1.02 }}
      >
        <Zap size={18} />
        <span>Start 30K TPS Demo</span>
      </motion.button>
    );
  }

  // Running state - show stop button
  if (isRunning) {
    return (
      <motion.button
        onClick={onStop}
        className="px-6 py-3 rounded-xl bg-gradient-to-r from-red-500 to-red-600 text-white font-bold flex items-center gap-2 shadow-lg shadow-red-500/30"
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
      >
        <Square size={18} fill="white" />
        <span>Stop Demo</span>
        <motion.div
          className="w-2 h-2 bg-white rounded-full"
          animate={{ opacity: [1, 0.3, 1] }}
          transition={{ duration: 0.5, repeat: Infinity }}
        />
      </motion.button>
    );
  }

  // Ready to start state
  return (
    <motion.button
      onClick={handleStart}
      disabled={disabled}
      className={`px-6 py-3 rounded-xl font-bold flex items-center gap-2 transition-all ${
        disabled
          ? 'bg-[#2a3d4e] text-[#6b7a8a] cursor-not-allowed'
          : 'bg-gradient-to-r from-blue-500 to-purple-500 text-white shadow-lg shadow-blue-500/30 hover:shadow-blue-500/50'
      }`}
      whileHover={disabled ? {} : { scale: 1.02 }}
      whileTap={disabled ? {} : { scale: 0.98 }}
    >
      <Wifi size={18} className="text-green-400" />
      <span>Connect to HFT Server</span>
      <Zap size={18} className="text-yellow-400" />
    </motion.button>
  );
}

/**
 * Compact version for inline use
 */
export function HFTConnectButtonCompact({
  isConnected,
  isRunning,
  onStart,
  onStop,
}: HFTConnectButtonProps) {
  if (!isConnected) {
    return (
      <motion.div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/30">
        <WifiOff size={14} className="text-red-400" />
        <span className="text-xs text-red-400">Offline</span>
      </motion.div>
    );
  }

  if (isRunning) {
    return (
      <motion.button
        onClick={onStop}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-red-500/20 border border-red-500/50 hover:bg-red-500/30 transition-colors"
        whileTap={{ scale: 0.95 }}
      >
        <Square size={12} className="text-red-400" fill="#ef4444" />
        <span className="text-xs text-red-400 font-medium">Stop</span>
      </motion.button>
    );
  }

  return (
    <motion.button
      onClick={onStart}
      className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-green-500/20 border border-green-500/50 hover:bg-green-500/30 transition-colors"
      whileTap={{ scale: 0.95 }}
    >
      <Play size={12} className="text-green-400" fill="#22c55e" />
      <span className="text-xs text-green-400 font-medium">Start HFT</span>
    </motion.button>
  );
}
