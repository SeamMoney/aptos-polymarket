import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Zap, Shield, User, Vote } from 'lucide-react';

export type OracleType = 'chainlink' | 'poly' | 'optimistic' | 'admin';

interface OracleStatusPanelProps {
  marketType: OracleType;
  lastUpdate?: number;
  price?: number;
  targetPrice?: number;
  confidence?: number;
}

const oracleInfo: Record<OracleType, {
  name: string;
  speed: string;
  icon: typeof Zap;
  color: string;
  bgColor: string;
  description: string;
}> = {
  chainlink: {
    name: 'Chainlink Data Feeds',
    speed: '~1s',
    icon: Zap,
    color: 'text-green-400',
    bgColor: 'bg-green-500/10',
    description: 'Chainlink Data Feeds for objective markets (crypto prices, sports, weather). Resolution via keeper or AIP-125 auto-trigger at market end time.'
  },
  poly: {
    name: 'POLY Oracle',
    speed: '15 min - 4 hr',
    icon: Vote,
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/10',
    description: 'Internal oracle for subjective markets (UMA replacement). Quadratic voting with POLY token staking. Max 4-hour resolution vs UMA\'s 2+ hours that often never resolve.'
  },
  optimistic: {
    name: 'Fast Optimistic',
    speed: '15 min',
    icon: Shield,
    color: 'text-yellow-400',
    bgColor: 'bg-yellow-500/10',
    description: '15-minute challenge period. Legacy oracle deployed on testnet.'
  },
  admin: {
    name: 'Admin Resolution',
    speed: 'Manual',
    icon: User,
    color: 'text-gray-400',
    bgColor: 'bg-gray-500/10',
    description: 'Market creator resolves manually. Used for demo markets and special cases.'
  }
};

export function OracleStatusPanel({
  marketType,
  lastUpdate: _lastUpdate,
  price,
  targetPrice,
  confidence
}: OracleStatusPanelProps) {
  const [expanded, setExpanded] = useState(false);

  const info = oracleInfo[marketType];
  const Icon = info.icon;

  const formatPrice = (p: number) => {
    if (p >= 1000000000) return `$${(p / 100000000).toLocaleString()}`;
    if (p >= 100000000) return `$${(p / 100000000).toFixed(2)}`;
    return `$${p.toLocaleString()}`;
  };

  return (
    <div className="rounded-2xl border-2 border-[#2c3f4f] overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-4 flex items-center justify-between hover:bg-[#2a3d4e]/30 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${info.bgColor}`}>
            <Icon size={18} className={info.color} />
          </div>
          <div className="text-left">
            <span className="text-white font-bold">Oracle: {info.name}</span>
            <span className={`ml-2 text-sm ${info.color}`}>({info.speed})</span>
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
              <p className="text-gray-400 text-sm mb-4">{info.description}</p>

              {marketType === 'chainlink' && (
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div className="bg-[#1a2634] rounded-lg p-3">
                    <div className="text-gray-500 text-xs mb-1">Current Price</div>
                    <div className="text-white font-mono text-lg">
                      {price ? formatPrice(price) : 'Loading...'}
                    </div>
                  </div>
                  <div className="bg-[#1a2634] rounded-lg p-3">
                    <div className="text-gray-500 text-xs mb-1">Target Price</div>
                    <div className="text-yellow-400 font-mono text-lg">
                      {targetPrice ? formatPrice(targetPrice) : 'N/A'}
                    </div>
                  </div>
                  <div className="bg-[#1a2634] rounded-lg p-3">
                    <div className="text-gray-500 text-xs mb-1">Confidence</div>
                    <div className="text-green-400 font-mono text-lg">
                      {confidence !== undefined ? `$${confidence.toFixed(2)}` : 'N/A'}
                    </div>
                  </div>
                </div>
              )}

              {marketType === 'poly' && (
                <div className="bg-[#1a2634] rounded-lg p-3 text-sm space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Voting Model</span>
                    <span className="text-blue-400 font-bold">Quadratic (sqrt(stake) x reputation)</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Proposer Bond</span>
                    <span className="text-white">5,000 POLY</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Challenge Period</span>
                    <span className="text-yellow-400">15 minutes</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Max Resolution Time</span>
                    <span className="text-green-400">4 hours</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Conflict Check</span>
                    <span className="text-white">Voters must hold zero outcome tokens</span>
                  </div>
                </div>
              )}

              {marketType === 'optimistic' && (
                <div className="bg-[#1a2634] rounded-lg p-3 text-sm space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Challenge Period</span>
                    <span className="text-yellow-400 font-bold">15 minutes</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Status</span>
                    <span className="text-gray-500">Legacy (use POLY oracle for new markets)</span>
                  </div>
                </div>
              )}

              {/* Speed comparison badge */}
              <div className="mt-4 flex items-center gap-2">
                <div className={`px-3 py-1.5 rounded-full ${info.bgColor} ${info.color} text-xs font-bold`}>
                  {marketType === 'chainlink' && 'Instant resolution for objective markets'}
                  {marketType === 'poly' && 'Max 4hr vs UMA\'s 57% never-resolve rate'}
                  {marketType === 'optimistic' && 'Legacy: 15-min challenge period'}
                  {marketType === 'admin' && 'Manual resolution'}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
