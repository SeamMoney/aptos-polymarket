import { useState } from 'react';
import { motion } from 'framer-motion';

interface VisualizerEmbedProps {
  txHash?: string;
}

export function VisualizerEmbed({ txHash: _txHash }: VisualizerEmbedProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const visualizerUrl = 'https://aptos-consensus-visualizer.vercel.app/';

  return (
    <div className="relative">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-2xl font-bold text-white">
            Aptos Consensus Visualizer
          </h2>
          <p className="text-gray-400">
            Watch your transaction journey through the Aptos network in real-time
          </p>
        </div>
        <button
          onClick={() => setIsFullscreen(!isFullscreen)}
          className="px-4 py-2 bg-poly-card border border-poly-border rounded-lg text-gray-400 hover:text-white transition-colors"
        >
          {isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
        </button>
      </div>

      {/* Embedded Visualizer */}
      <motion.div
        animate={{
          position: isFullscreen ? 'fixed' : 'relative',
          inset: isFullscreen ? 0 : 'auto',
          zIndex: isFullscreen ? 50 : 0,
        }}
        className="bg-poly-dark rounded-xl overflow-hidden border border-poly-border"
      >
        {isFullscreen && (
          <button
            onClick={() => setIsFullscreen(false)}
            className="absolute top-4 right-4 z-10 px-4 py-2 bg-poly-card border border-poly-border rounded-lg text-white hover:bg-poly-border transition-colors"
          >
            Close
          </button>
        )}

        <iframe
          src={visualizerUrl}
          className="w-full"
          style={{ height: isFullscreen ? '100vh' : '500px' }}
          title="Aptos Consensus Visualizer"
        />
      </motion.div>

      {/* Legend */}
      <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-poly-card p-4 rounded-xl border border-poly-border">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-3 h-3 rounded-full bg-blue-500" />
            <span className="text-sm text-gray-400">Mempool</span>
          </div>
          <p className="text-xs text-gray-500">Transaction enters the network</p>
        </div>

        <div className="bg-poly-card p-4 rounded-xl border border-poly-border">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-3 h-3 rounded-full bg-yellow-500" />
            <span className="text-sm text-gray-400">Consensus</span>
          </div>
          <p className="text-xs text-gray-500">Raptr/AptosBFT ordering</p>
        </div>

        <div className="bg-poly-card p-4 rounded-xl border border-poly-border">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-3 h-3 rounded-full bg-poly-green" />
            <span className="text-sm text-gray-400">Block-STM</span>
          </div>
          <p className="text-xs text-gray-500">Parallel execution</p>
        </div>

        <div className="bg-poly-card p-4 rounded-xl border border-poly-border">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-3 h-3 rounded-full bg-purple-500" />
            <span className="text-sm text-gray-400">Committed</span>
          </div>
          <p className="text-xs text-gray-500">Finalized on-chain</p>
        </div>
      </div>

      {/* Key Stats */}
      <div className="mt-6 grid grid-cols-3 gap-4">
        <div className="bg-poly-card p-4 rounded-xl border border-poly-border text-center">
          <div className="text-3xl font-bold text-poly-green">~470ms</div>
          <div className="text-sm text-gray-400">Time to Finality</div>
        </div>
        <div className="bg-poly-card p-4 rounded-xl border border-poly-border text-center">
          <div className="text-3xl font-bold text-poly-green">160k+</div>
          <div className="text-sm text-gray-400">Peak TPS</div>
        </div>
        <div className="bg-poly-card p-4 rounded-xl border border-poly-border text-center">
          <div className="text-3xl font-bold text-poly-green">&lt;$0.001</div>
          <div className="text-sm text-gray-400">Avg Transaction Fee</div>
        </div>
      </div>
    </div>
  );
}
