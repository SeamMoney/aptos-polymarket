import { motion } from 'framer-motion';

const features = [
  {
    icon: '⚡',
    title: 'Sub-Second Finality',
    stat: '~470ms',
    color: '#22c55e',
  },
  {
    icon: '🚀',
    title: 'Parallel Execution',
    stat: '160k+ TPS',
    color: '#2c9cdb',
  },
  {
    icon: '💰',
    title: 'Micro Fees',
    stat: '<$0.001',
    color: '#fbbf24',
  },
  {
    icon: '🔗',
    title: 'X-Chain Wallets',
    stat: 'MetaMask',
    color: '#f97316',
  },
];

export function AptosFeatures() {
  return (
    <div className="px-4 py-4">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-5 h-5 rounded bg-gradient-to-br from-[#00d4aa] to-[#00a0ff] flex items-center justify-center">
          <span className="text-[9px] font-bold text-black">A</span>
        </div>
        <span className="text-xs text-[#8297a3] font-medium">Aptos Advantages</span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {features.map((feature, index) => (
          <motion.div
            key={feature.title}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: index * 0.05 }}
            className="bg-[#2a3d4e]/50 border border-[#3a4f60] rounded-xl p-3 hover:bg-[#2a3d4e]/70 transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-2 mb-1">
              <span className="text-base">{feature.icon}</span>
              <span
                className="text-sm font-bold tabular-nums"
                style={{ color: feature.color }}
              >
                {feature.stat}
              </span>
            </div>
            <div className="text-[11px] text-[#8297a3] leading-tight">
              {feature.title}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
