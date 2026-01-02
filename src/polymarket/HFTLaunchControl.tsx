/**
 * HFT Launch Control - Safety-locked demo launcher with pre-flight checks
 * Requires two-step confirmation: ARM → LAUNCH
 */

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Shield,
  ShieldCheck,
  Rocket,
  Square,
  Wifi,
  WifiOff,
  Zap,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Lock,
  Unlock,
} from 'lucide-react';

interface PreflightCheck {
  id: string;
  label: string;
  status: 'pending' | 'checking' | 'pass' | 'fail' | 'warning';
  message?: string;
}

interface HFTLaunchControlProps {
  isConnected: boolean;
  isRunning: boolean;
  onStart: () => void;
  onStop: () => void;
  serverUrl?: string;
}

interface StatusResponse {
  status: string;
  isRunning: boolean;
  mode?: string;
  accounts?: { active: number; total: number };
  marketAddress?: string | null;
  market?: { question?: string };
  botBalance?: number;
}

export function HFTLaunchControl({
  isConnected,
  isRunning,
  onStart,
  onStop,
  serverUrl = 'http://localhost:3001',
}: HFTLaunchControlProps) {
  const [isArmed, setIsArmed] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [checks, setChecks] = useState<PreflightCheck[]>([
    { id: 'server', label: 'HFT Server Connection', status: 'pending' },
    { id: 'accounts', label: 'Trading Accounts Ready', status: 'pending' },
    { id: 'market', label: 'Market Contract Active', status: 'pending' },
    { id: 'funds', label: 'Sufficient Gas Funds', status: 'pending' },
  ]);

  // Update server check based on connection status
  useEffect(() => {
    setChecks(prev => prev.map(check => {
      if (check.id === 'server') {
        return {
          ...check,
          status: isConnected ? 'pass' : 'fail',
          message: isConnected ? 'Connected' : 'Not connected',
        };
      }
      return check;
    }));
  }, [isConnected]);

  const fetchStatus = async (): Promise<StatusResponse | null> => {
    try {
      const response = await fetch(`${serverUrl}/status`);
      if (!response.ok) return null;
      return await response.json();
    } catch {
      return null;
    }
  };

  // Run pre-flight checks when arming
  const runPreflightChecks = async (): Promise<boolean> => {
    // Reset all checks to checking
    setChecks(prev => prev.map(c => ({ ...c, status: 'checking' as const })));

    const status = await fetchStatus();
    const active = status?.accounts?.active ?? 0;
    const total = status?.accounts?.total ?? 0;
    const hasMarket = Boolean(status?.marketAddress);
    const hasWs = isConnected;
    const allowArm = Boolean(status) && hasWs && active > 0 && hasMarket;

    setChecks(prev => prev.map((check) => {
      if (check.id === 'server') {
        if (!status) {
          return { ...check, status: 'fail', message: 'Server unreachable' };
        }
        if (!isConnected) {
          return { ...check, status: 'warning', message: 'HTTP OK, WS disconnected' };
        }
        return { ...check, status: 'pass', message: 'HTTP + WS OK' };
      }

      if (!status) {
        return { ...check, status: 'fail', message: 'No status' };
      }

      if (check.id === 'accounts') {
        return {
          ...check,
          status: active > 0 ? 'pass' : 'fail',
          message: `${active}/${total} active`,
        };
      }

      if (check.id === 'market') {
        const address = status.marketAddress;
        const label = status.market?.question ? `Market: ${status.market.question}` : 'Market set';
        return {
          ...check,
          status: address ? 'pass' : 'fail',
          message: address ? label : 'Market not set',
        };
      }

      if (check.id === 'funds') {
        const balance = status.botBalance ?? 0;
        const minNeeded = Math.max(1, active * 0.5);
        return {
          ...check,
          status: balance >= minNeeded ? 'pass' : 'warning',
          message: `${balance.toFixed(2)} APT available`,
        };
      }

      return check;
    }));

    return allowArm;
  };

  // Handle ARM button
  const handleArm = async () => {
    const canArm = await runPreflightChecks();
    if (canArm) setIsArmed(true);
  };

  // Handle LAUNCH button
  const handleLaunch = () => {
    setCountdown(3);
  };

  // Countdown effect
  useEffect(() => {
    if (countdown === null) return;

    if (countdown === 0) {
      setCountdown(null);
      setIsArmed(false);
      onStart();
      return;
    }

    const timer = setTimeout(() => {
      setCountdown(countdown - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [countdown, onStart]);

  // Handle DISARM
  const handleDisarm = () => {
    setIsArmed(false);
    setCountdown(null);
  };

  // Handle STOP
  const handleStop = () => {
    onStop();
    setIsArmed(false);
    setCountdown(null);
  };

  // Get status icon
  const getStatusIcon = (status: PreflightCheck['status']) => {
    switch (status) {
      case 'pass':
        return <CheckCircle2 size={16} className="text-green-400" />;
      case 'fail':
        return <XCircle size={16} className="text-red-400" />;
      case 'warning':
        return <AlertTriangle size={16} className="text-yellow-400" />;
      case 'checking':
        return (
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          >
            <Zap size={16} className="text-blue-400" />
          </motion.div>
        );
      default:
        return <div className="w-4 h-4 rounded-full bg-[#3a4f60]" />;
    }
  };

  // RUNNING STATE
  if (isRunning) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-gradient-to-br from-[#1a2a3a] to-[#0d1a24] rounded-2xl border-2 border-green-500/50 p-6 max-w-md mx-auto"
      >
        {/* Active Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <motion.div
              animate={{
                boxShadow: ['0 0 20px rgba(34, 197, 94, 0.5)', '0 0 40px rgba(34, 197, 94, 0.8)', '0 0 20px rgba(34, 197, 94, 0.5)']
              }}
              transition={{ duration: 1, repeat: Infinity }}
              className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center"
            >
              <Zap size={24} className="text-green-400" />
            </motion.div>
            <div>
              <h3 className="text-white font-bold text-lg">DEMO ACTIVE</h3>
              <p className="text-green-400 text-sm">30K TPS Mode Running</p>
            </div>
          </div>
          <motion.div
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ duration: 0.5, repeat: Infinity }}
            className="w-3 h-3 rounded-full bg-green-500"
          />
        </div>

        {/* Stop Button */}
        <motion.button
          onClick={handleStop}
          className="w-full py-4 rounded-xl bg-red-500 hover:bg-red-600 text-white font-bold text-lg flex items-center justify-center gap-3 transition-colors"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          <Square size={20} fill="white" />
          STOP DEMO
        </motion.button>
      </motion.div>
    );
  }

  // COUNTDOWN STATE
  if (countdown !== null) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-gradient-to-br from-[#1a2a3a] to-[#0d1a24] rounded-2xl border-2 border-yellow-500/50 p-6 max-w-md mx-auto text-center"
      >
        <motion.div
          key={countdown}
          initial={{ scale: 2, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="text-8xl font-bold text-yellow-400 mb-4"
        >
          {countdown}
        </motion.div>
        <p className="text-yellow-400 text-lg font-semibold mb-6">LAUNCHING IN...</p>

        <button
          onClick={handleDisarm}
          className="px-6 py-2 rounded-lg bg-[#2a3d4e] hover:bg-[#3a4f60] text-[#8297a3] font-medium transition-colors"
        >
          ABORT
        </button>
      </motion.div>
    );
  }

  // ARMED STATE
  if (isArmed) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-gradient-to-br from-[#1a2a3a] to-[#0d1a24] rounded-2xl border-2 border-yellow-500/50 p-6 max-w-md mx-auto"
      >
        {/* Armed Header */}
        <div className="flex items-center justify-center gap-3 mb-6">
          <motion.div
            animate={{ rotate: [0, 10, -10, 0] }}
            transition={{ duration: 0.5, repeat: Infinity }}
          >
            <ShieldCheck size={32} className="text-yellow-400" />
          </motion.div>
          <div className="text-center">
            <h3 className="text-yellow-400 font-bold text-xl">SYSTEM ARMED</h3>
            <p className="text-[#8297a3] text-sm">Ready for launch</p>
          </div>
        </div>

        {/* Pre-flight Summary */}
        <div className="bg-[#0d1a24] rounded-xl p-4 mb-6">
          <div className="flex items-center justify-between text-sm">
            <span className="text-[#8297a3]">All systems:</span>
            <span className="text-green-400 font-semibold flex items-center gap-1">
              <CheckCircle2 size={14} />
              GO
            </span>
          </div>
        </div>

        {/* Launch Button */}
        <motion.button
          onClick={handleLaunch}
          className="w-full py-4 rounded-xl bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white font-bold text-lg flex items-center justify-center gap-3 shadow-lg shadow-green-500/30 mb-3"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          <Rocket size={24} />
          LAUNCH DEMO
        </motion.button>

        {/* Disarm Button */}
        <button
          onClick={handleDisarm}
          className="w-full py-3 rounded-xl bg-[#2a3d4e] hover:bg-[#3a4f60] text-[#8297a3] font-medium flex items-center justify-center gap-2 transition-colors"
        >
          <Lock size={16} />
          DISARM
        </button>
      </motion.div>
    );
  }

  // DEFAULT STATE - Pre-flight checks
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-gradient-to-br from-[#1a2a3a] to-[#0d1a24] rounded-2xl border border-[#2c3f4f] p-6 max-w-md mx-auto"
    >
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 rounded-full bg-[#2a3d4e] flex items-center justify-center">
          <Shield size={24} className="text-[#60a5fa]" />
        </div>
        <div>
          <h3 className="text-white font-bold text-lg">HFT Launch Control</h3>
          <p className="text-[#8297a3] text-sm">Pre-flight system check</p>
        </div>
      </div>

      {/* Server Status */}
      <div className={`flex items-center gap-3 p-3 rounded-xl mb-4 ${
        isConnected ? 'bg-green-500/10 border border-green-500/30' : 'bg-red-500/10 border border-red-500/30'
      }`}>
        {isConnected ? (
          <Wifi size={20} className="text-green-400" />
        ) : (
          <WifiOff size={20} className="text-red-400" />
        )}
        <div className="flex-1">
          <p className={`text-sm font-medium ${isConnected ? 'text-green-400' : 'text-red-400'}`}>
            {isConnected ? 'Server Connected' : 'Server Offline'}
          </p>
          <p className="text-xs text-[#6b7a8a]">{serverUrl}</p>
        </div>
        <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-400' : 'bg-red-400'}`} />
      </div>

      {/* Pre-flight Checklist */}
      <div className="space-y-2 mb-6">
        {checks.map((check) => (
          <motion.div
            key={check.id}
            className="flex items-center gap-3 p-2 rounded-lg bg-[#0d1a24]"
            initial={false}
            animate={{
              backgroundColor: check.status === 'pass' ? 'rgba(34, 197, 94, 0.1)' :
                              check.status === 'fail' ? 'rgba(239, 68, 68, 0.1)' :
                              'rgba(13, 26, 36, 1)'
            }}
          >
            {getStatusIcon(check.status)}
            <span className="flex-1 text-sm text-[#c9d1d9]">{check.label}</span>
            {check.message && (
              <span className={`text-xs ${
                check.status === 'pass' ? 'text-green-400' :
                check.status === 'fail' ? 'text-red-400' :
                check.status === 'warning' ? 'text-yellow-400' :
                'text-[#6b7a8a]'
              }`}>
                {check.message}
              </span>
            )}
          </motion.div>
        ))}
      </div>

      {/* ARM Button */}
      <motion.button
        onClick={handleArm}
        disabled={!isConnected}
        className={`w-full py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-3 transition-all ${
          isConnected
            ? 'bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white shadow-lg shadow-blue-500/30'
            : 'bg-[#2a3d4e] text-[#6b7a8a] cursor-not-allowed'
        }`}
        whileHover={isConnected ? { scale: 1.02 } : {}}
        whileTap={isConnected ? { scale: 0.98 } : {}}
      >
        <Unlock size={20} />
        ARM SYSTEM
      </motion.button>

      {!isConnected && (
        <p className="text-center text-[#6b7a8a] text-xs mt-3">
          Start the HFT server to enable launch control
        </p>
      )}
    </motion.div>
  );
}
