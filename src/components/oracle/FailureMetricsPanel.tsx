import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, AlertOctagon, Clock, DollarSign, CheckCircle, Server } from 'lucide-react';

interface Incident {
  date: string;
  duration: string;
  cause: string;
}

const polymarketIncidents: Incident[] = [
  { date: 'Dec 18, 2024', duration: 'Multi-hour', cause: 'Polygon consensus bug' },
  { date: 'Jul 30, 2025', duration: '~1 hour', cause: 'Polygon Heimdall consensus' },
  { date: 'Nov 2025', duration: 'Hours', cause: 'Cloudflare disruption (86% affected)' },
  { date: 'Dec 5, 2025', duration: '20 min', cause: 'Site outage' },
  { date: 'Dec 18-19, 2025', duration: 'Hours', cause: 'Polygon network disruption' },
  { date: 'Dec 30, 2025', duration: 'Multiple', cause: 'Markets API issues' },
];

export function FailureMetricsPanel() {
  const [expanded, setExpanded] = useState(false);

  const totalDowntimeHours = 10; // Estimated from documented incidents
  const umaLosses = 7_000_000; // $7M documented attack
  const aptosOutages = 0;

  return (
    <div className="rounded-2xl border-2 border-[#2c3f4f] overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-4 flex items-center justify-between hover:bg-[#2a3d4e]/30 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-red-500/10">
            <AlertOctagon size={18} className="text-red-500" />
          </div>
          <div className="text-left flex items-center gap-2">
            <span className="text-white font-bold">Polymarket Reliability</span>
            <span className="bg-red-500/20 text-red-400 text-xs px-2 py-0.5 rounded-full font-medium">
              6+ Outages
            </span>
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
              {/* Stats Cards */}
              <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="bg-red-900/20 rounded-lg p-3 text-center border border-red-800/30">
                  <Clock className="mx-auto text-red-400 mb-1" size={20} />
                  <div className="text-2xl font-bold text-red-400">{totalDowntimeHours}+</div>
                  <div className="text-xs text-gray-400">Hours Downtime</div>
                </div>
                <div className="bg-red-900/20 rounded-lg p-3 text-center border border-red-800/30">
                  <DollarSign className="mx-auto text-red-400 mb-1" size={20} />
                  <div className="text-2xl font-bold text-red-400">${(umaLosses / 1_000_000).toFixed(0)}M</div>
                  <div className="text-xs text-gray-400">UMA Attack Loss</div>
                </div>
                <div className="bg-green-900/20 rounded-lg p-3 text-center border border-green-800/30">
                  <CheckCircle className="mx-auto text-green-400 mb-1" size={20} />
                  <div className="text-2xl font-bold text-green-400">{aptosOutages}</div>
                  <div className="text-xs text-gray-400">Aptos Outages</div>
                </div>
              </div>

              {/* Incident Table */}
              <div className="bg-[#1a2634] rounded-lg overflow-hidden">
                <div className="grid grid-cols-3 gap-2 text-xs font-bold text-gray-400 p-2 bg-[#0f1a24] border-b border-gray-700">
                  <div>Date</div>
                  <div>Duration</div>
                  <div>Root Cause</div>
                </div>
                {polymarketIncidents.map((incident, i) => (
                  <div
                    key={i}
                    className="grid grid-cols-3 gap-2 text-xs py-2 px-2 border-b border-gray-800 text-gray-300"
                  >
                    <div className="text-gray-400">{incident.date}</div>
                    <div className="text-red-400 font-medium">{incident.duration}</div>
                    <div className="truncate" title={incident.cause}>{incident.cause}</div>
                  </div>
                ))}
              </div>

              {/* Root Cause Analysis */}
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="bg-red-900/10 rounded-lg p-3 border border-red-800/30">
                  <div className="flex items-center gap-2 text-red-400 text-xs font-bold mb-2">
                    <Server size={14} />
                    Polygon Issues
                  </div>
                  <ul className="text-xs text-gray-400 space-y-1">
                    <li>Consensus bugs (Bor/Heimdall)</li>
                    <li>RPC node failures</li>
                    <li>Gas spikes (2,359 Gwei)</li>
                    <li>Network congestion</li>
                  </ul>
                </div>
                <div className="bg-green-900/10 rounded-lg p-3 border border-green-800/30">
                  <div className="flex items-center gap-2 text-green-400 text-xs font-bold mb-2">
                    <CheckCircle size={14} />
                    Aptos Advantages
                  </div>
                  <ul className="text-xs text-gray-400 space-y-1">
                    <li>Instant finality (~125ms)</li>
                    <li>No reorganizations</li>
                    <li>Stable low fees</li>
                    <li>Parallel execution</li>
                  </ul>
                </div>
              </div>

              {/* Quote */}
              <div className="mt-4 bg-yellow-900/20 rounded-lg p-3 border border-yellow-800/50">
                <div className="text-yellow-400 text-xs italic leading-relaxed">
                  "The platform is about to take its own Layer 2 (L2) seriously...
                  It's the #1 priority."
                </div>
                <div className="text-gray-500 text-xs mt-1">
                  Polymarket team member (Discord, Dec 2024)
                </div>
              </div>

              {/* Call to Action */}
              <div className="mt-4 bg-green-900/20 rounded-lg p-3 border border-green-800/50">
                <div className="text-green-400 font-bold text-sm mb-1">
                  Why Build Your Own L2?
                </div>
                <p className="text-gray-300 text-xs">
                  Instead of spending engineering resources building a custom L2,
                  migrate to Aptos L1 with instant finality, 160K+ TPS capacity,
                  and proven reliability.
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
