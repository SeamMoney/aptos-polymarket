import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Play, Loader2 } from 'lucide-react';

interface TxResult {
  id: number;
  status: 'pending' | 'success' | 'failed';
  time?: number;
}

export function SpeedComparison() {
  const [expanded, setExpanded] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [txCount, setTxCount] = useState(30);
  const [aptosTxs, setAptosTxs] = useState<TxResult[]>([]);
  const [polygonTxs, setPolygonTxs] = useState<TxResult[]>([]);
  const [aptosTime, setAptosTime] = useState<number | null>(null);
  const [polygonTime, setPolygonTime] = useState<number | null>(null);
  const [aptosCompleted, setAptosCompleted] = useState(0);
  const [polygonCompleted, setPolygonCompleted] = useState(0);

  // Simulated Polygon delays
  const simulatePolygonDelay = () => {
    const rand = Math.random();
    if (rand < 0.1) return -1; // 10% fail
    if (rand < 0.3) return 5000 + Math.random() * 10000; // 20% very slow
    if (rand < 0.6) return 2000 + Math.random() * 3000; // 30% slow
    return 500 + Math.random() * 1500; // 40% "fast"
  };

  const runTest = async () => {
    setIsRunning(true);
    setAptosTxs([]);
    setPolygonTxs([]);
    setAptosTime(null);
    setPolygonTime(null);
    setAptosCompleted(0);
    setPolygonCompleted(0);

    // Initialize
    const initialAptos: TxResult[] = Array.from({ length: txCount }, (_, i) => ({
      id: i, status: 'pending'
    }));
    const initialPolygon: TxResult[] = Array.from({ length: txCount }, (_, i) => ({
      id: i, status: 'pending'
    }));

    setAptosTxs(initialAptos);
    setPolygonTxs(initialPolygon);

    const aptosStart = Date.now();
    const polygonStart = Date.now();

    // Aptos - fast parallel execution
    const aptosPromises = initialAptos.map(async (tx) => {
      const delay = 50 + Math.random() * 450;
      await new Promise(resolve => setTimeout(resolve, delay));
      const time = Date.now() - aptosStart;
      setAptosTxs(prev => prev.map(t =>
        t.id === tx.id ? { ...t, status: 'success', time } : t
      ));
      setAptosCompleted(prev => prev + 1);
      return time;
    });

    // Polygon - slow with failures
    const polygonPromises = initialPolygon.map(async (tx) => {
      const delay = simulatePolygonDelay();
      if (delay < 0) {
        await new Promise(resolve => setTimeout(resolve, 1500));
        setPolygonTxs(prev => prev.map(t =>
          t.id === tx.id ? { ...t, status: 'failed' } : t
        ));
        setPolygonCompleted(prev => prev + 1);
        return -1;
      }
      await new Promise(resolve => setTimeout(resolve, delay));
      const time = Date.now() - polygonStart;
      setPolygonTxs(prev => prev.map(t =>
        t.id === tx.id ? { ...t, status: 'success', time } : t
      ));
      setPolygonCompleted(prev => prev + 1);
      return time;
    });

    const aptosTimes = await Promise.all(aptosPromises);
    setAptosTime(Math.max(...aptosTimes));

    const polygonResults = await Promise.all(polygonPromises);
    const maxPolygon = Math.max(...polygonResults.filter(t => t > 0));
    setPolygonTime(maxPolygon);

    setIsRunning(false);
  };

  const getSuccessRate = (txs: TxResult[]) => {
    if (txs.length === 0) return 0;
    return Math.round((txs.filter(t => t.status === 'success').length / txs.length) * 100);
  };

  return (
    <div className="rounded-2xl border-2 border-[#2c3f4f] overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-4 flex items-center justify-between hover:bg-[#2a3d4e]/30 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#22c55e] to-[#60a5fa] flex items-center justify-center">
            <span className="text-white text-sm">🏎️</span>
          </div>
          <div className="text-left">
            <span className="text-white text-base font-bold">Speed Test</span>
            <span className="text-[#6b7a8a] text-xs ml-2">Aptos vs Polygon</span>
          </div>
        </div>
        <ChevronDown
          size={20}
          color="#8297a3"
          strokeWidth={2.5}
          className={`transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
        />
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="border-t-2 border-[#2c3f4f]"
          >
            {/* Controls */}
            <div className="p-4 border-b border-[#2c3f4f]">
              <div className="flex items-center gap-4 mb-3">
                <span className="text-[#8297a3] text-sm">Transactions:</span>
                <input
                  type="range"
                  min={10}
                  max={100}
                  value={txCount}
                  onChange={(e) => setTxCount(parseInt(e.target.value))}
                  className="flex-1 accent-[#60a5fa]"
                  disabled={isRunning}
                />
                <span className="text-white font-mono w-8 text-right">{txCount}</span>
              </div>
              <button
                onClick={runTest}
                disabled={isRunning}
                className="w-full py-3 bg-[#22c55e] hover:bg-[#1ea54d] disabled:bg-[#22c55e]/50 rounded-xl text-white font-bold transition-colors flex items-center justify-center gap-2"
              >
                {isRunning ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    Running...
                  </>
                ) : (
                  <>
                    <Play size={18} fill="white" />
                    Run Speed Test
                  </>
                )}
              </button>
            </div>

            {/* Results */}
            <div className="grid grid-cols-2 gap-3 p-4">
              {/* Aptos */}
              <div className="bg-[#1c2b3a] rounded-xl p-3 border border-[#22c55e]/30">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-2 h-2 rounded-full bg-[#22c55e]" />
                  <span className="text-[#22c55e] font-bold text-sm">Aptos</span>
                </div>
                {aptosTime !== null && (
                  <div className="text-xl font-bold text-[#22c55e] mb-1">
                    {(aptosTime / 1000).toFixed(2)}s
                  </div>
                )}
                <div className="text-[10px] text-[#8297a3] mb-2">
                  {aptosCompleted}/{txCount} • {getSuccessRate(aptosTxs)}% success
                </div>
                {/* Mini grid */}
                <div className="grid grid-cols-6 gap-0.5">
                  {aptosTxs.slice(0, 30).map(tx => (
                    <div
                      key={tx.id}
                      className={`aspect-square rounded-sm ${
                        tx.status === 'pending' ? 'bg-[#3a4f60]' :
                        tx.status === 'success' ? 'bg-[#22c55e]' : 'bg-red-500'
                      }`}
                    />
                  ))}
                </div>
              </div>

              {/* Polygon */}
              <div className="bg-[#1c2b3a] rounded-xl p-3 border border-purple-500/30">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-2 h-2 rounded-full bg-purple-500" />
                  <span className="text-purple-400 font-bold text-sm">Polygon</span>
                </div>
                {polygonTime !== null && (
                  <div className="text-xl font-bold text-purple-400 mb-1">
                    {(polygonTime / 1000).toFixed(2)}s
                  </div>
                )}
                <div className="text-[10px] text-[#8297a3] mb-2">
                  {polygonCompleted}/{txCount} • {getSuccessRate(polygonTxs)}% success
                </div>
                {/* Mini grid */}
                <div className="grid grid-cols-6 gap-0.5">
                  {polygonTxs.slice(0, 30).map(tx => (
                    <div
                      key={tx.id}
                      className={`aspect-square rounded-sm ${
                        tx.status === 'pending' ? 'bg-[#3a4f60]' :
                        tx.status === 'success' ? 'bg-purple-500' : 'bg-red-500'
                      }`}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Comparison Result */}
            {aptosTime !== null && polygonTime !== null && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mx-4 mb-4 p-4 bg-gradient-to-r from-[#22c55e]/10 to-[#60a5fa]/10 border border-[#22c55e]/30 rounded-xl text-center"
              >
                <div className="text-3xl font-bold text-[#22c55e] mb-1">
                  {Math.round(polygonTime / aptosTime)}x Faster
                </div>
                <div className="text-xs text-[#8297a3]">
                  {txCount} transactions • Aptos {getSuccessRate(aptosTxs)}% vs Polygon {getSuccessRate(polygonTxs)}%
                </div>
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
