import { useMemo } from 'react';

interface TPSChartProps {
  currentTps: number;
  peakTps: number;
  tpsHistory: number[];
  isRunning?: boolean;
  compact?: boolean;
}

export function TPSChart({
  currentTps,
  peakTps,
  tpsHistory,
  isRunning = false,
  compact = false,
}: TPSChartProps) {
  // Generate SVG path for TPS history
  const chartPath = useMemo(() => {
    if (tpsHistory.length < 2) return '';
    const max = Math.max(...tpsHistory, 100);
    const points = tpsHistory.map((tps, i) => {
      const x = (i / (tpsHistory.length - 1)) * 100;
      const y = 100 - (tps / max) * 100;
      return `${x},${y}`;
    });
    return `M ${points.join(' L ')}`;
  }, [tpsHistory]);

  // Get TPS color based on value
  const getTpsColor = (tps: number) => {
    if (tps > 50) return 'text-[#22c55e]';
    if (tps > 20) return 'text-[#2c9cdb]';
    if (tps > 5) return 'text-yellow-400';
    return 'text-[#8297a3]';
  };

  if (compact) {
    // Compact version for header
    return (
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          {isRunning && (
            <span className="w-2 h-2 rounded-full bg-[#22c55e] animate-pulse" />
          )}
          <span className={`text-lg font-bold tabular-nums ${getTpsColor(currentTps)}`}>
            {currentTps}
          </span>
          <span className="text-xs text-[#8297a3]">TPS</span>
        </div>
        <div className="text-xs text-[#6b7a8a]">
          Peak: <span className="text-white font-medium">{peakTps}</span>
        </div>
        {/* Mini sparkline */}
        {tpsHistory.length > 1 && (
          <div className="w-16 h-6 bg-[#2a3d4e] rounded overflow-hidden">
            <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
              <path
                d={chartPath}
                fill="none"
                stroke="#2c9cdb"
                strokeWidth="3"
                vectorEffect="non-scaling-stroke"
              />
            </svg>
          </div>
        )}
      </div>
    );
  }

  // Full version with chart
  return (
    <div className="bg-[#2a3d4e] rounded-xl p-4 border border-[#3a4f60]">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-sm text-[#8297a3]">Throughput</span>
          {isRunning && (
            <span className="flex items-center gap-1.5 text-xs text-[#22c55e]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#22c55e] animate-pulse" />
              LIVE
            </span>
          )}
        </div>
        <span className="text-xs text-[#6b7a8a]">Peak: {peakTps}</span>
      </div>

      {/* TPS Value */}
      <div className="mb-4">
        <span className={`text-5xl font-bold tabular-nums ${getTpsColor(currentTps)}`}>
          {currentTps}
        </span>
        <span className="text-lg text-[#8297a3] ml-2">TPS</span>
      </div>

      {/* Chart */}
      <div className="h-20 bg-[#1c2b3a] rounded-lg overflow-hidden relative">
        {tpsHistory.length > 1 ? (
          <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
            <defs>
              <linearGradient id="tpsGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#2c9cdb" stopOpacity="0.3" />
                <stop offset="100%" stopColor="#2c9cdb" stopOpacity="0" />
              </linearGradient>
            </defs>
            {/* Grid lines */}
            <line x1="0" y1="25" x2="100" y2="25" stroke="#3a4f60" strokeWidth="0.5" />
            <line x1="0" y1="50" x2="100" y2="50" stroke="#3a4f60" strokeWidth="0.5" />
            <line x1="0" y1="75" x2="100" y2="75" stroke="#3a4f60" strokeWidth="0.5" />
            {/* Fill area */}
            <path
              d={`${chartPath} L 100,100 L 0,100 Z`}
              fill="url(#tpsGradient)"
            />
            {/* Line */}
            <path
              d={chartPath}
              fill="none"
              stroke="#2c9cdb"
              strokeWidth="2"
              vectorEffect="non-scaling-stroke"
            />
          </svg>
        ) : (
          <div className="flex items-center justify-center h-full text-[#6b7a8a] text-xs">
            {isRunning ? 'Collecting data...' : 'Start demo to see chart'}
          </div>
        )}
      </div>

      {/* Stats Row */}
      <div className="flex items-center justify-between mt-3 pt-3 border-t border-[#3a4f60]">
        <div className="text-center">
          <div className="text-xs text-[#6b7a8a]">Aptos Finality</div>
          <div className="text-sm font-bold text-[#22c55e]">~400ms</div>
        </div>
        <div className="text-center">
          <div className="text-xs text-[#6b7a8a]">vs Polygon</div>
          <div className="text-sm font-bold text-red-400">2-5s</div>
        </div>
        <div className="text-center">
          <div className="text-xs text-[#6b7a8a]">Speed</div>
          <div className="text-sm font-bold text-[#2c9cdb]">10-50x faster</div>
        </div>
      </div>
    </div>
  );
}
