import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Maximize2, X } from 'lucide-react';

interface ConsensusVisualizerProps {
  defaultExpanded?: boolean;
}

export function ConsensusVisualizer({ defaultExpanded = false }: ConsensusVisualizerProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const visualizerUrl = 'https://aptos-consensus-visualizer.vercel.app/';

  return (
    <>
      <div className="rounded-2xl border-2 border-[#2c3f4f] overflow-hidden">
        {/* Header */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full px-4 py-4 flex items-center justify-between hover:bg-[#2a3d4e]/30 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center">
              <span className="text-white text-sm">⚡</span>
            </div>
            <div className="text-left">
              <span className="text-white text-base font-bold">How Aptos Works</span>
              <span className="text-[#6b7a8a] text-xs ml-2">Live Visualizer</span>
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
              {/* Visualizer Iframe */}
              <div className="relative border-t-2 border-[#2c3f4f]">
                <button
                  onClick={() => setIsFullscreen(true)}
                  className="absolute top-2 right-2 z-10 p-2 bg-[#1c2b3a]/80 rounded-lg hover:bg-[#2a3d4e] transition-colors"
                >
                  <Maximize2 size={16} color="#8297a3" />
                </button>
                <iframe
                  src={visualizerUrl}
                  className="w-full"
                  style={{ height: '300px' }}
                  title="Aptos Consensus Visualizer"
                />
              </div>

              {/* Legend - Compact */}
              <div className="grid grid-cols-4 gap-2 p-3 border-t-2 border-[#2c3f4f] bg-[#1c2b3a]/50">
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                  <span className="text-[10px] text-[#8297a3]">Mempool</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-yellow-500" />
                  <span className="text-[10px] text-[#8297a3]">Consensus</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-[#22c55e]" />
                  <span className="text-[10px] text-[#8297a3]">Block-STM</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-purple-500" />
                  <span className="text-[10px] text-[#8297a3]">Committed</span>
                </div>
              </div>

              {/* Quick Stats */}
              <div className="grid grid-cols-3 gap-2 p-3 border-t border-[#2c3f4f]">
                <div className="text-center p-2 bg-[#2a3d4e]/50 rounded-lg">
                  <div className="text-lg font-bold text-[#22c55e]">~470ms</div>
                  <div className="text-[10px] text-[#6b7a8a]">Finality</div>
                </div>
                <div className="text-center p-2 bg-[#2a3d4e]/50 rounded-lg">
                  <div className="text-lg font-bold text-[#60a5fa]">160k+</div>
                  <div className="text-[10px] text-[#6b7a8a]">Peak TPS</div>
                </div>
                <div className="text-center p-2 bg-[#2a3d4e]/50 rounded-lg">
                  <div className="text-lg font-bold text-[#fbbf24]">&lt;$0.001</div>
                  <div className="text-[10px] text-[#6b7a8a]">Avg Fee</div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Fullscreen Modal */}
      <AnimatePresence>
        {isFullscreen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-[#0d1117]"
          >
            <button
              onClick={() => setIsFullscreen(false)}
              className="absolute top-4 right-4 z-10 p-3 bg-[#2a3d4e] rounded-lg hover:bg-[#3a4f60] transition-colors"
            >
              <X size={20} color="white" />
            </button>
            <iframe
              src={visualizerUrl}
              className="w-full h-full"
              title="Aptos Consensus Visualizer"
            />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
