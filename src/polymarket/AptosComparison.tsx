import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Zap, Clock, Shield, DollarSign, Cpu, Link } from 'lucide-react';

interface ComparisonRow {
  label: string;
  aptos: string;
  polygon: string;
  aptosWins: boolean;
  icon: React.ReactNode;
}

const comparisons: ComparisonRow[] = [
  {
    label: 'Finality',
    aptos: '~470ms',
    polygon: '2-5 seconds',
    aptosWins: true,
    icon: <Clock size={14} />,
  },
  {
    label: 'Peak TPS',
    aptos: '160,000+',
    polygon: '~65',
    aptosWins: true,
    icon: <Zap size={14} />,
  },
  {
    label: 'Avg Fee',
    aptos: '<$0.001',
    polygon: '$0.01-0.10',
    aptosWins: true,
    icon: <DollarSign size={14} />,
  },
  {
    label: 'Execution',
    aptos: 'Parallel (Block-STM)',
    polygon: 'Sequential',
    aptosWins: true,
    icon: <Cpu size={14} />,
  },
  {
    label: 'Network Outages',
    aptos: '0 (since launch)',
    polygon: 'Multiple',
    aptosWins: true,
    icon: <Shield size={14} />,
  },
  {
    label: 'X-Chain Wallets',
    aptos: 'MetaMask, Phantom',
    polygon: 'Native only',
    aptosWins: true,
    icon: <Link size={14} />,
  },
];

interface AptosComparisonProps {
  defaultExpanded?: boolean;
}

export function AptosComparison({ defaultExpanded = false }: AptosComparisonProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <div className="rounded-2xl border-2 border-[#2c3f4f] overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-4 flex items-center justify-between hover:bg-[#2a3d4e]/30 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#00d4aa] to-[#00a0ff] flex items-center justify-center">
            <span className="text-sm font-bold text-black">A</span>
          </div>
          <div className="text-left">
            <span className="text-white text-base font-bold">Why Aptos?</span>
            <span className="text-[#6b7a8a] text-xs ml-2">vs Polygon</span>
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
          >
            {/* Comparison Table */}
            <div className="border-t-2 border-[#2c3f4f]">
              {/* Column Headers */}
              <div className="grid grid-cols-3 px-4 py-2 border-b border-[#2c3f4f] bg-[#2a3d4e]/30">
                <div className="text-[#6b7a8a] text-xs font-semibold uppercase">Metric</div>
                <div className="text-[#22c55e] text-xs font-semibold uppercase text-center">Aptos</div>
                <div className="text-[#8297a3] text-xs font-semibold uppercase text-center">Polygon</div>
              </div>

              {/* Rows */}
              {comparisons.map((row, index) => (
                <motion.div
                  key={row.label}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="grid grid-cols-3 px-4 py-3 border-b border-[#2c3f4f] last:border-b-0 hover:bg-[#2a3d4e]/20 transition-colors"
                >
                  <div className="flex items-center gap-2 text-[#8297a3] text-sm">
                    <span className="text-[#6b7a8a]">{row.icon}</span>
                    {row.label}
                  </div>
                  <div className={`text-center text-sm font-medium ${row.aptosWins ? 'text-[#22c55e]' : 'text-white'}`}>
                    {row.aptos}
                  </div>
                  <div className="text-center text-sm text-[#6b7a8a]">
                    {row.polygon}
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Bottom Summary */}
            <div className="px-4 py-3 bg-[#1e3a5f]/30 border-t border-[#3a5f8f]/30">
              <div className="flex items-center justify-between">
                <div className="text-xs text-[#8297a3]">
                  <span className="text-[#22c55e] font-bold">10-50x faster</span> than Polygon
                </div>
                <a
                  href="https://aptos.dev"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-[#5BA3D9] hover:underline"
                >
                  Learn more →
                </a>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
