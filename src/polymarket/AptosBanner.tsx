import { motion } from 'framer-motion';
import { Zap, Clock, DollarSign } from 'lucide-react';

interface AptosBannerProps {
  compact?: boolean;
}

export function AptosBanner({ compact = false }: AptosBannerProps) {
  if (compact) {
    // Minimal inline version for headers
    return (
      <div className="flex items-center gap-2 px-2 py-1 bg-[#1e3a5f]/50 rounded-full">
        <div className="w-4 h-4 rounded-full bg-gradient-to-br from-[#00d4aa] to-[#00a0ff] flex items-center justify-center">
          <span className="text-[8px] font-bold text-black">A</span>
        </div>
        <span className="text-[10px] text-[#8297a3] font-medium">Aptos Testnet</span>
        <span className="w-1 h-1 rounded-full bg-[#22c55e] animate-pulse" />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="mx-4 mb-3 bg-gradient-to-r from-[#1e3a5f]/80 via-[#1c2b3a] to-[#1e3a5f]/80 border border-[#3a5f8f]/50 rounded-xl p-3"
    >
      <div className="flex items-center justify-between">
        {/* Aptos Branding */}
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#00d4aa] to-[#00a0ff] flex items-center justify-center">
            <span className="text-xs font-bold text-black">A</span>
          </div>
          <div>
            <div className="text-xs text-white font-medium">Powered by Aptos</div>
            <div className="text-[10px] text-[#6b7a8a]">Testnet Demo</div>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <Clock size={12} className="text-[#22c55e]" />
            <span className="text-xs text-[#22c55e] font-medium">470ms</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Zap size={12} className="text-[#60a5fa]" />
            <span className="text-xs text-[#60a5fa] font-medium">160k TPS</span>
          </div>
          <div className="flex items-center gap-1.5">
            <DollarSign size={12} className="text-[#fbbf24]" />
            <span className="text-xs text-[#fbbf24] font-medium">&lt;$0.001</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
