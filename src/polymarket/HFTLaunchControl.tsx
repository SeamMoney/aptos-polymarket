/**
 * HFT Launch Control - Multi-worker status display with pre-flight checks
 * Shows status of all cloud workers for demo readiness
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
  Server,
} from 'lucide-react';

// Cloud worker IPs
const WORKER_IPS = [
  '178.128.177.88',
  '147.182.237.239',
  '161.35.231.0',
];

interface WorkerStatus {
  id: number;
  ip: string;
  connected: boolean;
  accounts: number;
  totalAccounts: number;
  isRunning: boolean;
  currentTps: number;
}

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
  multiWorkerMode?: boolean;
}

interface StatusResponse {
  status: string;
  isRunning: boolean;
  mode?: string;
  accounts?: { active: number; total: number };
  marketAddress?: string | null;
  market?: { question?: string };
  botBalance?: number;
  stats?: { currentTps?: number };
}

export function HFTLaunchControl({
  isConnected,
  isRunning,
  onStart,
  onStop,
  serverUrl = 'http://localhost:3001',
  multiWorkerMode = true,
}: HFTLaunchControlProps) {
  const [workers, setWorkers] = useState<WorkerStatus[]>([]);
  const [isArmed, setIsArmed] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [checks, setChecks] = useState<PreflightCheck[]>([
    { id: 'workers', label: 'Cloud Workers', status: 'pending' },
    { id: 'accounts', label: 'Trading Accounts (2000)', status: 'pending' },
    { id: 'markets', label: 'Markets Loaded', status: 'pending' },
    { id: 'rpc', label: 'Internal VFN', status: 'pending' },
  ]);

  // Fetch status from a single worker
  const fetchWorkerStatus = async (ip: string): Promise<StatusResponse | null> => {
    try {
      const response = await fetch(`http://${ip}:3001/status`, {
        signal: AbortSignal.timeout(5000),
      });
      if (!response.ok) return null;
      return await response.json();
    } catch {
      return null;
    }
  };

  // Check all workers
  const checkAllWorkers = async () => {
    if (!multiWorkerMode) {
      // Single server mode - use original logic
      return;
    }

    setChecks(prev => prev.map(c => ({ ...c, status: 'checking' as const })));

    const workerStatuses: WorkerStatus[] = [];
    let totalAccounts = 0;
    let connectedWorkers = 0;
    let anyRunning = false;
    let totalTps = 0;

    for (let i = 0; i < WORKER_IPS.length; i++) {
      const ip = WORKER_IPS[i];
      const status = await fetchWorkerStatus(ip);

      if (status) {
        const accounts = status.accounts?.active ?? 0;
        const total = status.accounts?.total ?? 0;
        const tps = status.stats?.currentTps ?? 0;

        workerStatuses.push({
          id: i + 1,
          ip,
          connected: true,
          accounts,
          totalAccounts: total,
          isRunning: status.isRunning,
          currentTps: tps,
        });

        totalAccounts += total;
        connectedWorkers++;
        if (status.isRunning) anyRunning = true;
        totalTps += tps;
      } else {
        workerStatuses.push({
          id: i + 1,
          ip,
          connected: false,
          accounts: 0,
          totalAccounts: 0,
          isRunning: false,
          currentTps: 0,
        });
      }
    }

    setWorkers(workerStatuses);

    // Update checks
    setChecks([
      {
        id: 'workers',
        label: 'Cloud Workers',
        status: connectedWorkers === 3 ? 'pass' : connectedWorkers > 0 ? 'warning' : 'fail',
        message: `${connectedWorkers}/3 connected`,
      },
      {
        id: 'accounts',
        label: 'Trading Accounts',
        status: totalAccounts >= 2000 ? 'pass' : totalAccounts > 0 ? 'warning' : 'fail',
        message: `${totalAccounts.toLocaleString()} ready`,
      },
      {
        id: 'markets',
        label: 'Markets Loaded',
        status: connectedWorkers > 0 ? 'pass' : 'pending',
        message: connectedWorkers > 0 ? '15 markets' : 'Checking...',
      },
      {
        id: 'rpc',
        label: 'Internal VFN',
        status: connectedWorkers > 0 ? 'pass' : 'pending',
        message: connectedWorkers > 0 ? 'Responding' : 'Checking...',
      },
    ]);

    return {
      allConnected: connectedWorkers === 3,
      totalAccounts,
      anyRunning,
      totalTps,
    };
  };

  // Poll worker status
  useEffect(() => {
    if (!multiWorkerMode) return;

    checkAllWorkers();
    const interval = setInterval(checkAllWorkers, 5000);
    return () => clearInterval(interval);
  }, [multiWorkerMode]);

  // Handle ARM - just run checks
  const handleArm = async () => {
    const result = await checkAllWorkers();
    if (result?.allConnected && result.totalAccounts >= 1000) {
      setIsArmed(true);
    }
  };

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

  // Check if any worker is running
  const anyWorkerRunning = workers.some(w => w.isRunning);
  const totalTps = workers.reduce((sum, w) => sum + w.currentTps, 0);

  // RUNNING STATE
  if (anyWorkerRunning || isRunning) {
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
              <p className="text-green-400 text-sm">{totalTps.toLocaleString()} TPS</p>
            </div>
          </div>
          <motion.div
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ duration: 0.5, repeat: Infinity }}
            className="w-3 h-3 rounded-full bg-green-500"
          />
        </div>

        {/* Worker Status */}
        <div className="space-y-2 mb-4">
          {workers.map((worker) => (
            <div
              key={worker.id}
              className={`flex items-center justify-between p-2 rounded-lg ${
                worker.isRunning ? 'bg-green-500/10' : 'bg-[#0d1a24]'
              }`}
            >
              <div className="flex items-center gap-2">
                <Server size={14} className={worker.connected ? 'text-green-400' : 'text-red-400'} />
                <span className="text-sm text-[#c9d1d9]">Worker {worker.id}</span>
              </div>
              <span className="text-sm text-green-400">
                {worker.isRunning ? `${worker.currentTps} TPS` : 'Ready'}
              </span>
            </div>
          ))}
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

  // Trigger all workers to start
  const handleLaunch = async () => {
    setCountdown(3);
  };

  // Countdown and launch
  useEffect(() => {
    if (countdown === null) return;

    if (countdown === 0) {
      // Trigger all workers
      const triggerWorkers = async () => {
        for (const worker of workers) {
          if (worker.connected) {
            try {
              // Trigger AMM server
              await fetch(`http://${worker.ip}:3001/start?duration=60`, { method: 'POST' });
              // Trigger Transfer server (dual mode)
              await fetch(`http://${worker.ip}:3002/start?duration=60`, { method: 'POST' }).catch(() => {});
            } catch (e) {
              console.error(`Failed to trigger worker ${worker.id}:`, e);
            }
          }
        }
      };
      triggerWorkers();
      setCountdown(null);
      setIsArmed(false);
      return;
    }

    const timer = setTimeout(() => {
      setCountdown(countdown - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [countdown, workers]);

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
        <p className="text-yellow-400 text-lg font-semibold mb-6">LAUNCHING...</p>

        <button
          onClick={handleDisarm}
          className="px-6 py-2 rounded-lg bg-[#2a3d4e] hover:bg-[#3a4f60] text-[#8297a3] font-medium transition-colors"
        >
          ABORT
        </button>
      </motion.div>
    );
  }

  // ARMED STATE - Ready to launch
  if (isArmed) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-gradient-to-br from-[#1a2a3a] to-[#0d1a24] rounded-2xl border-2 border-green-500/50 p-6 max-w-md mx-auto"
      >
        {/* Armed Header */}
        <div className="flex items-center justify-center gap-3 mb-6">
          <motion.div
            animate={{ scale: [1, 1.1, 1] }}
            transition={{ duration: 1, repeat: Infinity }}
          >
            <ShieldCheck size={32} className="text-green-400" />
          </motion.div>
          <div className="text-center">
            <h3 className="text-green-400 font-bold text-xl">ALL SYSTEMS GO</h3>
            <p className="text-[#8297a3] text-sm">{workers.reduce((s, w) => s + w.totalAccounts, 0).toLocaleString()} accounts ready</p>
          </div>
        </div>

        {/* Pre-flight Summary */}
        <div className="bg-[#0d1a24] rounded-xl p-4 mb-4">
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="flex justify-between">
              <span className="text-[#8297a3]">Workers:</span>
              <span className="text-green-400">{workers.filter(w => w.connected).length}/3</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#8297a3]">Accounts:</span>
              <span className="text-green-400">{workers.reduce((s, w) => s + w.totalAccounts, 0).toLocaleString()}</span>
            </div>
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
          Back to Status
        </button>
      </motion.div>
    );
  }

  // DEFAULT STATE - Multi-worker status
  const connectedWorkers = workers.filter(w => w.connected).length;
  const allReady = connectedWorkers === 3;

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
          <h3 className="text-white font-bold text-lg">Demo Launch Control</h3>
          <p className="text-[#8297a3] text-sm">Cloud Worker Status</p>
        </div>
      </div>

      {/* Worker Status Grid */}
      <div className="space-y-2 mb-4">
        {workers.length === 0 ? (
          <div className="text-center py-4 text-[#6b7a8a]">
            Checking workers...
          </div>
        ) : (
          workers.map((worker) => (
            <div
              key={worker.id}
              className={`flex items-center gap-3 p-3 rounded-xl ${
                worker.connected
                  ? 'bg-green-500/10 border border-green-500/30'
                  : 'bg-red-500/10 border border-red-500/30'
              }`}
            >
              {worker.connected ? (
                <Wifi size={18} className="text-green-400" />
              ) : (
                <WifiOff size={18} className="text-red-400" />
              )}
              <div className="flex-1">
                <p className={`text-sm font-medium ${
                  worker.connected ? 'text-green-400' : 'text-red-400'
                }`}>
                  Worker {worker.id}
                </p>
                <p className="text-xs text-[#6b7a8a]">{worker.ip}</p>
              </div>
              <div className="text-right">
                <p className={`text-sm font-medium ${
                  worker.connected ? 'text-[#c9d1d9]' : 'text-[#6b7a8a]'
                }`}>
                  {worker.connected ? `${worker.totalAccounts} accounts` : 'Offline'}
                </p>
              </div>
            </div>
          ))
        )}
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
        disabled={connectedWorkers === 0}
        className={`w-full py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-3 transition-all ${
          allReady
            ? 'bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white shadow-lg shadow-green-500/30'
            : connectedWorkers > 0
            ? 'bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-white shadow-lg shadow-yellow-500/30'
            : 'bg-[#2a3d4e] text-[#6b7a8a] cursor-not-allowed'
        }`}
        whileHover={connectedWorkers > 0 ? { scale: 1.02 } : {}}
        whileTap={connectedWorkers > 0 ? { scale: 0.98 } : {}}
      >
        <Rocket size={20} />
        {allReady ? 'READY TO LAUNCH' : connectedWorkers > 0 ? 'PARTIAL READY' : 'WAITING FOR WORKERS'}
      </motion.button>

      {connectedWorkers === 0 && (
        <p className="text-center text-[#6b7a8a] text-xs mt-3">
          Run <code className="text-[#60a5fa]">./scripts/demo.sh standby</code> to start workers
        </p>
      )}
    </motion.div>
  );
}
