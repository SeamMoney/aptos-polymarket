import { HFTVisualizer } from './HFTVisualizer';

export function DemoMarketPage() {
  return (
    <div className="min-h-screen bg-poly-dark">
      {/* Simple Header */}
      <header className="border-b border-poly-border px-4 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <a href="/" className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-poly-green flex items-center justify-center font-bold text-black">
                P
              </div>
              <span className="text-xl font-bold text-white">Polymarket</span>
            </a>
            <span className="text-gray-500 text-sm">on Aptos</span>
          </div>
          <div className="px-3 py-1 bg-poly-card border border-poly-border rounded-lg text-sm text-gray-400">
            Testnet Demo
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* HFT Visualizer - includes orderbook, TPS, trade stream */}
        <div className="mb-6">
          <HFTVisualizer />
        </div>

        {/* Block River */}
        <div className="bg-poly-card border border-poly-border rounded-2xl overflow-hidden">
          <div className="p-4 border-b border-poly-border flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-white">Aptos Block River</h3>
              <p className="text-sm text-gray-500">Live block production visualization</p>
            </div>
            <a
              href="https://aptos-consensus-visualizer.vercel.app/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-poly-green text-sm hover:underline"
            >
              Open Full View
            </a>
          </div>
          <iframe
            src="https://aptos-consensus-visualizer.vercel.app/"
            className="w-full h-[400px] border-0"
            title="Aptos Block River"
          />
        </div>
      </main>
    </div>
  );
}
