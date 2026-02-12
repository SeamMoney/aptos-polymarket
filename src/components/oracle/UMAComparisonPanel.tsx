import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, AlertTriangle, CheckCircle, XCircle, Shield, Zap, Clock } from 'lucide-react';

interface ComparisonRow {
  metric: string;
  uma: string;
  aptos: string;
  improvement: string;
  icon?: typeof Zap;
}

const comparisons: ComparisonRow[] = [
  {
    metric: 'Objective Markets',
    uma: '2+ hours',
    aptos: '~1s (Chainlink)',
    improvement: '7,200x faster',
    icon: Zap,
  },
  {
    metric: 'Subjective Markets',
    uma: '2-72 hours',
    aptos: '15 min - 4 hr',
    improvement: '8-18x faster',
    icon: Shield,
  },
  {
    metric: 'Manipulation Risk',
    uma: 'HIGH ($7M attack)',
    aptos: 'None (no token voting)',
    improvement: 'Eliminated',
  },
  {
    metric: 'Wrong Resolutions',
    uma: 'Multiple documented',
    aptos: 'Emergency override',
    improvement: 'Recoverable',
  },
  {
    metric: 'Proposer Bond',
    uma: '$750',
    aptos: '$5,000',
    improvement: '6.7x higher',
  },
];

const umaIncidents = [
  {
    date: 'March 2025',
    incident: 'Governance Attack',
    impact: '$7M stolen',
    detail: 'Single whale (25% voting power) manipulated Ukraine mineral deal market',
  },
  {
    date: '2024-2025',
    incident: 'Wrong Resolutions',
    impact: 'Millions lost',
    detail: 'Polymarket confirmed UMA resolved multiple markets incorrectly',
  },
  {
    date: 'Every Resolution',
    incident: '2+ Hour Delays',
    impact: 'User friction',
    detail: 'Minimum 2-hour optimistic challenge period even for obvious outcomes',
  },
  {
    date: 'Disputes',
    incident: '48-72 Hour Delays',
    impact: 'Trading frozen',
    detail: 'DVM voting process takes days to resolve disputed markets',
  },
];

export function UMAComparisonPanel() {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-2xl border-2 border-[#2c3f4f] overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-4 flex items-center justify-between hover:bg-[#2a3d4e]/30 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-red-500/10">
            <AlertTriangle size={18} className="text-red-400" />
          </div>
          <div className="text-left">
            <span className="text-white font-bold">Why Not UMA?</span>
            <span className="text-gray-400 text-sm ml-2">(Polymarket's Oracle)</span>
          </div>
        </div>
        <motion.div
          animate={{ rotate: expanded ? 180 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <ChevronDown className="text-gray-400" size={20} />
        </motion.div>
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4">
              {/* Comparison Table */}
              <div className="mb-4">
                {/* Header */}
                <div className="grid grid-cols-4 gap-2 text-xs font-bold text-gray-400 mb-2 pb-2 border-b border-gray-700">
                  <div>Metric</div>
                  <div className="text-red-400">UMA (Polymarket)</div>
                  <div className="text-green-400">Aptos Oracle</div>
                  <div>Improvement</div>
                </div>

                {/* Rows */}
                {comparisons.map((row, i) => (
                  <div
                    key={i}
                    className="grid grid-cols-4 gap-2 text-sm py-2 border-b border-gray-800 items-center"
                  >
                    <div className="text-white flex items-center gap-1.5">
                      {row.icon && <row.icon size={14} className="text-gray-500" />}
                      <span className="text-xs">{row.metric}</span>
                    </div>
                    <div className="text-red-400 flex items-center gap-1 text-xs">
                      <XCircle size={12} className="flex-shrink-0" />
                      <span>{row.uma}</span>
                    </div>
                    <div className="text-green-400 flex items-center gap-1 text-xs">
                      <CheckCircle size={12} className="flex-shrink-0" />
                      <span>{row.aptos}</span>
                    </div>
                    <div className="text-yellow-400 font-mono text-xs">{row.improvement}</div>
                  </div>
                ))}
              </div>

              {/* UMA Incidents */}
              <div className="bg-red-900/20 rounded-lg p-3 border border-red-800/50">
                <div className="text-red-400 font-bold text-sm mb-3 flex items-center gap-2">
                  <AlertTriangle size={16} />
                  UMA Documented Failures
                </div>
                <div className="space-y-2">
                  {umaIncidents.map((incident, i) => (
                    <div key={i} className="text-xs">
                      <div className="flex items-center gap-2">
                        <span className="text-gray-500 w-20">{incident.date}</span>
                        <span className="text-red-400 font-medium">{incident.impact}</span>
                      </div>
                      <div className="text-gray-400 ml-[88px] mt-0.5">{incident.detail}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Key Insight */}
              <div className="mt-4 bg-yellow-900/20 rounded-lg p-3 border border-yellow-800/50">
                <div className="text-yellow-400 text-sm font-medium mb-1">Key Insight</div>
                <p className="text-gray-300 text-xs">
                  UMA's token-weighted voting system enabled a whale with 25% voting power
                  to steal $7M by manipulating market outcomes. Our committee-based system
                  (1 member = 1 vote) eliminates this attack vector entirely.
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
