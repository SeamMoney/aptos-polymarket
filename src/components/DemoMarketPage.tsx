import { HFTVisualizer } from './HFTVisualizer';

export function DemoMarketPage() {
  return (
    <div className="poly-bg-primary" style={{ minHeight: '100vh' }}>
      {/* Header */}
      <header className="poly-header poly-flex-between" style={{ maxWidth: '1400px', margin: '0 auto' }}>
        <div className="poly-flex-center poly-gap-3">
          <a href="/" className="poly-flex-center poly-gap-2" style={{ textDecoration: 'none' }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                backgroundColor: 'var(--poly-green)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                color: 'var(--poly-black)',
                fontSize: 16
              }}
            >
              P
            </div>
            <span className="poly-text-xl poly-font-bold poly-text-primary">Polymarket</span>
          </a>
          <span className="poly-text-muted poly-text-sm">on Aptos</span>
        </div>

        <div className="poly-pill poly-pill-gray">
          Testnet Demo
        </div>
      </header>

      <main style={{ maxWidth: '1400px', margin: '0 auto', padding: '24px 16px' }}>
        {/* HFT Visualizer */}
        <div className="poly-mb-6">
          <HFTVisualizer />
        </div>

        {/* Block River */}
        <div className="poly-card-xl" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="poly-flex-between poly-p-4 poly-border-b">
            <div>
              <h3 className="poly-text-lg poly-font-bold poly-text-primary" style={{ margin: 0 }}>
                Aptos Block River
              </h3>
              <p className="poly-text-sm poly-text-muted" style={{ margin: '4px 0 0 0' }}>
                Live block production visualization
              </p>
            </div>
            <a
              href="https://aptos-consensus-visualizer.vercel.app/"
              target="_blank"
              rel="noopener noreferrer"
              className="poly-text-green poly-text-sm"
              style={{ textDecoration: 'none' }}
            >
              Open Full View
            </a>
          </div>
          <iframe
            src="https://aptos-consensus-visualizer.vercel.app/"
            style={{ width: '100%', height: 400, border: 'none' }}
            title="Aptos Block River"
          />
        </div>
      </main>
    </div>
  );
}
