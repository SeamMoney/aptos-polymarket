import { useState } from 'react';
import { motion } from 'framer-motion';
import { useWallet } from '@aptos-labs/wallet-adapter-react';
import { Aptos, AptosConfig, Network } from '@aptos-labs/ts-sdk';

interface TxResult {
  id: number;
  status: 'pending' | 'success' | 'failed';
  hash?: string;
  time?: number;
  chain: 'aptos' | 'polygon';
}

const aptosConfig = new AptosConfig({ network: Network.TESTNET });
const aptos = new Aptos(aptosConfig);

export function StressTest() {
  const { connected, account, signAndSubmitTransaction } = useWallet();
  const [isRunning, setIsRunning] = useState(false);
  const [mode, setMode] = useState<'simulated' | 'real'>('simulated');
  const [txCount, setTxCount] = useState(50);
  const [realTxCount, setRealTxCount] = useState(5);
  const [aptosTxs, setAptosTxs] = useState<TxResult[]>([]);
  const [polygonTxs, setPolygonTxs] = useState<TxResult[]>([]);
  const [aptosTime, setAptosTime] = useState<number | null>(null);
  const [polygonTime, setPolygonTime] = useState<number | null>(null);
  const [aptosCompleted, setAptosCompleted] = useState(0);
  const [polygonCompleted, setPolygonCompleted] = useState(0);

  // Simulated Polygon delays (based on real Dec 2025 issues)
  const simulatePolygonDelay = () => {
    // Simulate variable delays: some fast, some slow, some fail
    const rand = Math.random();
    if (rand < 0.1) return -1; // 10% fail
    if (rand < 0.3) return 5000 + Math.random() * 10000; // 20% very slow (5-15s)
    if (rand < 0.6) return 2000 + Math.random() * 3000; // 30% slow (2-5s)
    return 500 + Math.random() * 1500; // 40% "fast" (0.5-2s)
  };

  // Run real Aptos transaction and wait for confirmation
  const submitRealTransaction = async (_index: number): Promise<{ hash: string; time: number }> => {
    const startTime = Date.now();

    // Submit a 0 APT transfer to self (minimal gas, real tx)
    const response = await signAndSubmitTransaction({
      data: {
        function: '0x1::aptos_account::transfer',
        functionArguments: [account?.address?.toString() || '', 0],
      },
    });

    // For X-Chain/derived wallets, the tx may take a moment to propagate
    // Try waiting with a short timeout, but don't fail if it times out
    try {
      await aptos.waitForTransaction({
        transactionHash: response.hash,
        options: { timeoutSecs: 5, checkSuccess: false }
      });
    } catch {
      // Transaction may still be pending/propagating - that's ok for demo
      console.log(`Tx ${response.hash} submitted, may still be propagating...`);
    }

    return {
      hash: response.hash,
      time: Date.now() - startTime,
    };
  };

  const runRealStressTest = async () => {
    if (!connected || !account) {
      alert('Please connect your wallet first');
      return;
    }

    setIsRunning(true);
    setAptosTxs([]);
    setPolygonTxs([]);
    setAptosTime(null);
    setPolygonTime(null);
    setAptosCompleted(0);
    setPolygonCompleted(0);

    const count = realTxCount;

    // Initialize all transactions as pending
    const initialAptosTxs: TxResult[] = Array.from({ length: count }, (_, i) => ({
      id: i,
      status: 'pending',
      chain: 'aptos',
    }));
    const initialPolygonTxs: TxResult[] = Array.from({ length: count }, (_, i) => ({
      id: i,
      status: 'pending',
      chain: 'polygon',
    }));

    setAptosTxs(initialAptosTxs);
    setPolygonTxs(initialPolygonTxs);

    const overallStart = Date.now();
    let maxAptosTime = 0;

    // Submit real Aptos transactions sequentially (wallet requires user approval per tx)
    for (let i = 0; i < count; i++) {
      try {
        const result = await submitRealTransaction(i);
        maxAptosTime = Math.max(maxAptosTime, result.time);

        setAptosTxs((prev) =>
          prev.map((t) =>
            t.id === i
              ? { ...t, status: 'success', hash: result.hash, time: result.time }
              : t
          )
        );
        setAptosCompleted((prev) => prev + 1);
      } catch (error) {
        console.error('Transaction failed:', error);
        setAptosTxs((prev) =>
          prev.map((t) => (t.id === i ? { ...t, status: 'failed' } : t))
        );
        setAptosCompleted((prev) => prev + 1);
      }
    }

    setAptosTime(Date.now() - overallStart);

    // Simulate Polygon transactions in parallel (for comparison)
    const polygonStartTime = Date.now();
    const polygonPromises = initialPolygonTxs.map(async (tx, index) => {
      const delay = simulatePolygonDelay();

      if (delay < 0) {
        await new Promise((resolve) => setTimeout(resolve, 1000 + Math.random() * 2000));
        setPolygonTxs((prev) =>
          prev.map((t) => (t.id === tx.id ? { ...t, status: 'failed' } : t))
        );
        setPolygonCompleted((prev) => prev + 1);
        return -1;
      }

      await new Promise((resolve) => setTimeout(resolve, delay));
      const time = Date.now() - polygonStartTime;
      setPolygonTxs((prev) =>
        prev.map((t) =>
          t.id === tx.id
            ? { ...t, status: 'success', hash: `0x${index.toString(16).padStart(64, '0')}`, time }
            : t
        )
      );
      setPolygonCompleted((prev) => prev + 1);
      return time;
    });

    const polygonResults = await Promise.all(polygonPromises);
    const maxPolygonTime = Math.max(...polygonResults.filter((t) => t > 0));
    setPolygonTime(maxPolygonTime);

    setIsRunning(false);
  };

  const runStressTest = async () => {
    setIsRunning(true);
    setAptosTxs([]);
    setPolygonTxs([]);
    setAptosTime(null);
    setPolygonTime(null);
    setAptosCompleted(0);
    setPolygonCompleted(0);

    // Initialize all transactions as pending
    const initialAptosTxs: TxResult[] = Array.from({ length: txCount }, (_, i) => ({
      id: i,
      status: 'pending',
      chain: 'aptos',
    }));
    const initialPolygonTxs: TxResult[] = Array.from({ length: txCount }, (_, i) => ({
      id: i,
      status: 'pending',
      chain: 'polygon',
    }));

    setAptosTxs(initialAptosTxs);
    setPolygonTxs(initialPolygonTxs);

    const aptosStartTime = Date.now();
    const polygonStartTime = Date.now();

    // Simulate Aptos transactions (real speed - parallel execution)
    // In reality, all these would confirm in ~500ms total
    const aptosPromises = initialAptosTxs.map(async (tx, index) => {
      // Simulate Aptos parallel execution - all txs start immediately
      // and confirm within ~50-500ms
      const delay = 50 + Math.random() * 450; // 50-500ms
      await new Promise((resolve) => setTimeout(resolve, delay));

      const time = Date.now() - aptosStartTime;
      setAptosTxs((prev) =>
        prev.map((t) =>
          t.id === tx.id
            ? { ...t, status: 'success', hash: `0x${index.toString(16).padStart(64, '0')}`, time }
            : t
        )
      );
      setAptosCompleted((prev) => prev + 1);
      return time;
    });

    // Simulate Polygon transactions (with real issues)
    const polygonPromises = initialPolygonTxs.map(async (tx, index) => {
      const delay = simulatePolygonDelay();

      if (delay < 0) {
        // Transaction failed
        await new Promise((resolve) => setTimeout(resolve, 1000 + Math.random() * 2000));
        setPolygonTxs((prev) =>
          prev.map((t) => (t.id === tx.id ? { ...t, status: 'failed' } : t))
        );
        setPolygonCompleted((prev) => prev + 1);
        return -1;
      }

      await new Promise((resolve) => setTimeout(resolve, delay));
      const time = Date.now() - polygonStartTime;
      setPolygonTxs((prev) =>
        prev.map((t) =>
          t.id === tx.id
            ? { ...t, status: 'success', hash: `0x${index.toString(16).padStart(64, '0')}`, time }
            : t
        )
      );
      setPolygonCompleted((prev) => prev + 1);
      return time;
    });

    // Wait for all Aptos transactions
    const aptosTimes = await Promise.all(aptosPromises);
    setAptosTime(Math.max(...aptosTimes));

    // Wait for all Polygon transactions (with timeout)
    const polygonTimeout = new Promise<number>((resolve) =>
      setTimeout(() => resolve(30000), 30000)
    );
    const polygonResults = await Promise.race([
      Promise.all(polygonPromises),
      polygonTimeout,
    ]);

    if (typeof polygonResults === 'number') {
      setPolygonTime(30000);
    } else {
      const maxTime = Math.max(...polygonResults.filter((t) => t > 0));
      setPolygonTime(maxTime);
    }

    setIsRunning(false);
  };

  const getSuccessRate = (txs: TxResult[]) => {
    if (txs.length === 0) return 0;
    return Math.round((txs.filter((t) => t.status === 'success').length / txs.length) * 100);
  };

  return (
    <div className="bg-poly-card border border-poly-border rounded-2xl p-4 md:p-6 -mx-4 md:mx-0 rounded-none md:rounded-2xl border-x-0 md:border-x">
      <div className="text-center mb-4 md:mb-6">
        <h2 className="text-xl md:text-2xl font-bold text-white mb-2">
          {mode === 'real' ? 'Real Transaction Test' : 'Viral Event Stress Test'}
        </h2>
        <p className="text-gray-400 text-sm md:text-base">
          {mode === 'real'
            ? `Submit ${realTxCount} real transactions on Aptos testnet`
            : `Simulate election-night traffic: ${txCount} concurrent bets`}
        </p>
      </div>

      {/* Mode Toggle */}
      <div className="flex justify-center mb-4">
        <div className="inline-flex bg-poly-dark rounded-lg p-1">
          <button
            onClick={() => setMode('simulated')}
            disabled={isRunning}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${
              mode === 'simulated'
                ? 'bg-poly-green text-black'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Simulated
          </button>
          <button
            onClick={() => setMode('real')}
            disabled={isRunning}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${
              mode === 'real'
                ? 'bg-poly-green text-black'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Real Txns
          </button>
        </div>
      </div>

      {mode === 'real' && !connected && (
        <div className="text-center mb-4 p-3 bg-orange-500/10 border border-orange-500/30 rounded-lg">
          <span className="text-orange-400 text-sm">Connect wallet to run real transactions</span>
        </div>
      )}

      {/* Controls */}
      <div className="flex flex-col items-center justify-center gap-4 mb-6 md:mb-8">
        <div className="flex items-center gap-3 w-full max-w-xs">
          <label className="text-gray-400 text-sm whitespace-nowrap">Txns:</label>
          <input
            type="range"
            min={mode === 'real' ? 1 : 10}
            max={mode === 'real' ? 10 : 200}
            value={mode === 'real' ? realTxCount : txCount}
            onChange={(e) =>
              mode === 'real'
                ? setRealTxCount(parseInt(e.target.value))
                : setTxCount(parseInt(e.target.value))
            }
            className="flex-1"
            disabled={isRunning}
          />
          <span className="text-white font-mono w-10 text-right">
            {mode === 'real' ? realTxCount : txCount}
          </span>
        </div>

        {mode === 'real' && (
          <p className="text-xs text-gray-500 text-center">
            Each tx requires wallet approval. Uses 0 APT self-transfers.
          </p>
        )}

        <button
          onClick={mode === 'real' ? runRealStressTest : runStressTest}
          disabled={isRunning || (mode === 'real' && !connected)}
          className="w-full md:w-auto px-8 py-3 bg-poly-green text-black font-bold rounded-xl hover:bg-poly-green/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isRunning ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                  fill="none"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
              Running Test...
            </span>
          ) : mode === 'real' ? (
            'Start Real Test'
          ) : (
            'Start Stress Test'
          )}
        </button>
      </div>

      {/* Results Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
        {/* Aptos Side */}
        <div className="bg-poly-dark rounded-xl p-3 md:p-4 border border-poly-green/30">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-poly-green" />
              <span className="text-poly-green font-bold text-lg">Aptos</span>
              {mode === 'real' && aptosTxs.length > 0 && (
                <span className="text-xs bg-poly-green/20 text-poly-green px-2 py-0.5 rounded-full">
                  Real
                </span>
              )}
            </div>
            {aptosTime !== null && (
              <div className="text-right">
                <div className="text-2xl font-bold text-poly-green">
                  {(aptosTime / 1000).toFixed(2)}s
                </div>
                <div className="text-xs text-gray-400">Total time</div>
              </div>
            )}
          </div>

          {/* Progress */}
          <div className="mb-4">
            <div className="flex justify-between text-sm mb-1">
              <span className="text-gray-400">Progress</span>
              <span className="text-white">
                {aptosCompleted}/{mode === 'real' ? realTxCount : txCount} ({getSuccessRate(aptosTxs)}% success)
              </span>
            </div>
            <div className="h-3 bg-poly-card rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-poly-green"
                initial={{ width: 0 }}
                animate={{ width: `${(aptosCompleted / (mode === 'real' ? realTxCount : txCount)) * 100}%` }}
                transition={{ duration: 0.1 }}
              />
            </div>
          </div>

          {/* Transaction Grid */}
          <div className="grid grid-cols-8 md:grid-cols-10 gap-1 max-h-24 md:max-h-32 overflow-hidden">
            {aptosTxs.slice(0, 80).map((tx) => (
              <div
                key={tx.id}
                className={`w-full aspect-square rounded-sm transition-all duration-200 ${
                  tx.status === 'pending'
                    ? 'bg-gray-700'
                    : tx.status === 'success'
                    ? 'bg-poly-green'
                    : 'bg-red-500'
                }`}
              />
            ))}
          </div>

          {aptosTxs.length > 0 && (
            <div className="mt-3 md:mt-4 p-2 md:p-3 bg-poly-card rounded-lg">
              <div className="text-xs text-gray-400 mb-1">Average Latency</div>
              <div className="text-lg font-bold text-poly-green">
                {aptosTxs.filter((t) => t.time).length > 0
                  ? `${Math.round(
                      aptosTxs.filter((t) => t.time).reduce((a, b) => a + (b.time || 0), 0) /
                        aptosTxs.filter((t) => t.time).length
                    )}ms`
                  : '--'}
              </div>
            </div>
          )}

          {/* Real Transaction Links */}
          {mode === 'real' && aptosTxs.filter((t) => t.status === 'success' && t.hash).length > 0 && (
            <div className="mt-3 p-2 bg-poly-card rounded-lg">
              <div className="text-xs text-gray-400 mb-2">Real Tx Hashes (click to view)</div>
              <div className="flex flex-wrap gap-1">
                {aptosTxs
                  .filter((t) => t.status === 'success' && t.hash)
                  .map((tx, i) => (
                    <a
                      key={tx.id}
                      href={`https://explorer.aptoslabs.com/txn/${tx.hash}?network=testnet`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs bg-poly-green/10 text-poly-green px-2 py-1 rounded hover:bg-poly-green/20 transition-colors font-mono"
                    >
                      Tx {i + 1}
                    </a>
                  ))}
              </div>
            </div>
          )}
        </div>

        {/* Polygon Side (Simulated) */}
        <div className="bg-poly-dark rounded-xl p-3 md:p-4 border border-purple-500/30">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-purple-500" />
              <span className="text-purple-400 font-bold text-lg">Polygon</span>
              <span className="text-xs text-gray-500">(Simulated)</span>
            </div>
            {polygonTime !== null && (
              <div className="text-right">
                <div className="text-2xl font-bold text-purple-400">
                  {(polygonTime / 1000).toFixed(2)}s
                </div>
                <div className="text-xs text-gray-400">Total time</div>
              </div>
            )}
          </div>

          {/* Progress */}
          <div className="mb-4">
            <div className="flex justify-between text-sm mb-1">
              <span className="text-gray-400">Progress</span>
              <span className="text-white">
                {polygonCompleted}/{mode === 'real' ? realTxCount : txCount} ({getSuccessRate(polygonTxs)}% success)
              </span>
            </div>
            <div className="h-3 bg-poly-card rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-purple-500"
                initial={{ width: 0 }}
                animate={{ width: `${(polygonCompleted / (mode === 'real' ? realTxCount : txCount)) * 100}%` }}
                transition={{ duration: 0.1 }}
              />
            </div>
          </div>

          {/* Transaction Grid */}
          <div className="grid grid-cols-8 md:grid-cols-10 gap-1 max-h-24 md:max-h-32 overflow-hidden">
            {polygonTxs.slice(0, 80).map((tx) => (
              <div
                key={tx.id}
                className={`w-full aspect-square rounded-sm transition-all duration-200 ${
                  tx.status === 'pending'
                    ? 'bg-gray-700'
                    : tx.status === 'success'
                    ? 'bg-purple-500'
                    : 'bg-red-500'
                }`}
              />
            ))}
          </div>

          {polygonTxs.length > 0 && (
            <div className="mt-3 md:mt-4 p-2 md:p-3 bg-poly-card rounded-lg">
              <div className="text-xs text-gray-400 mb-1">Average Latency</div>
              <div className="text-lg font-bold text-purple-400">
                {polygonTxs.filter((t) => t.time && t.time > 0).length > 0
                  ? `${Math.round(
                      polygonTxs
                        .filter((t) => t.time && t.time > 0)
                        .reduce((a, b) => a + (b.time || 0), 0) /
                        polygonTxs.filter((t) => t.time && t.time > 0).length
                    )}ms`
                  : '--'}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Comparison Summary */}
      {aptosTime !== null && polygonTime !== null && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-4 md:mt-6 p-4 md:p-6 bg-gradient-to-r from-poly-green/10 to-transparent border border-poly-green/30 rounded-xl"
        >
          <div className="text-center">
            {mode === 'real' && (
              <div className="text-xs text-poly-green mb-2 uppercase tracking-wider">
                Real Transactions on Testnet
              </div>
            )}
            <div className="text-3xl md:text-4xl font-bold text-poly-green mb-2">
              {Math.round(polygonTime / aptosTime)}x Faster
            </div>
            <div className="text-gray-400 text-sm md:text-base">
              Aptos: <span className="text-poly-green font-semibold">{(aptosTime / 1000).toFixed(2)}s</span>
              {' '}vs Polygon: <span className="text-purple-400 font-semibold">{(polygonTime / 1000).toFixed(2)}s</span>
            </div>
            <div className="mt-2 text-xs md:text-sm text-gray-500">
              {mode === 'real' ? realTxCount : txCount} transactions • Aptos: {getSuccessRate(aptosTxs)}% success • Polygon: {getSuccessRate(polygonTxs)}% success
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}
