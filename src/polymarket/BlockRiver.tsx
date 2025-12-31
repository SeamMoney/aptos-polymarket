/**
 * Block River - Embedded iframe showing only the block river visualization
 * From aptos-consensus-visualizer.vercel.app
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Maximize2, X, Loader2 } from 'lucide-react';

interface BlockRiverProps {
  height?: number;
  showFullscreen?: boolean;
}

export function BlockRiver({ height = 200, showFullscreen = true }: BlockRiverProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // The visualizer URL - shows the block river
  const visualizerUrl = 'https://aptos-consensus-visualizer.vercel.app/';

  return (
    <>
      <div className="relative rounded-xl border border-[#2c3f4f] overflow-hidden bg-[#0d1117]">
        {/* Loading indicator */}
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-[#0d1117] z-10">
            <div className="flex items-center gap-2 text-[#6b7a8a]">
              <Loader2 size={20} className="animate-spin" />
              <span className="text-sm">Loading Block River...</span>
            </div>
          </div>
        )}

        {/* Fullscreen button */}
        {showFullscreen && (
          <button
            onClick={() => setIsFullscreen(true)}
            className="absolute top-2 right-2 z-20 p-2 bg-[#1c2b3a]/80 rounded-lg hover:bg-[#2a3d4e] transition-colors"
          >
            <Maximize2 size={14} color="#8297a3" />
          </button>
        )}

        {/* Iframe */}
        <iframe
          src={visualizerUrl}
          className="w-full"
          style={{ height }}
          title="Block River"
          onLoad={() => setIsLoading(false)}
        />
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
              title="Block River Fullscreen"
            />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
