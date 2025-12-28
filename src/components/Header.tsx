import { useWallet } from '@aptos-labs/wallet-adapter-react';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export function Header() {
  const { account, connected, connect, disconnect, wallets, wallet } = useWallet();
  const [showWalletMenu, setShowWalletMenu] = useState(false);

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  // Check if connected via X-Chain (derived wallet)
  const isXChainWallet = wallet?.name?.toLowerCase().includes('ethereum') ||
                          wallet?.name?.toLowerCase().includes('metamask');

  // Get current path for mobile tab highlighting
  const currentPath = typeof window !== 'undefined' ? window.location.pathname : '/';

  return (
    <>
    <header className="fixed top-0 left-0 right-0 z-50 bg-poly-dark/80 backdrop-blur-lg border-b border-poly-border">
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-poly-green to-emerald-600 flex items-center justify-center">
            <span className="text-xl font-bold text-white">P</span>
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Polymarket</h1>
            <div className="flex items-center gap-1">
              <span className="text-xs text-gray-400">on</span>
              <span className="text-xs font-semibold text-poly-green">Aptos</span>
              <span className="px-1.5 py-0.5 text-[10px] bg-poly-green/20 text-poly-green rounded-full">
                DEMO
              </span>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="hidden md:flex items-center gap-6">
          <a href="#markets" className="text-gray-300 hover:text-white transition-colors">
            Markets
          </a>
          <a href="#hft-demo" className="text-gray-300 hover:text-white transition-colors">
            HFT
          </a>
          <a href="/demo" className="text-poly-green hover:text-poly-green/80 transition-colors font-medium">
            Demo
          </a>
          <a href="#features" className="text-gray-300 hover:text-white transition-colors">
            Why Aptos?
          </a>
        </nav>

        {/* Wallet Connection */}
        <div className="relative">
          {connected && account ? (
            <button
              onClick={() => setShowWalletMenu(!showWalletMenu)}
              className="flex items-center gap-2 px-4 py-2 bg-poly-card border border-poly-border rounded-xl hover:border-poly-green/50 transition-all"
            >
              {isXChainWallet && (
                <div className="flex items-center gap-1 px-2 py-0.5 bg-orange-500/20 rounded-full">
                  <span className="text-[10px] text-orange-400">X-CHAIN</span>
                </div>
              )}
              <div className="w-2 h-2 rounded-full bg-poly-green animate-pulse" />
              <span className="text-sm text-white font-mono">
                {formatAddress(account.address.toString())}
              </span>
            </button>
          ) : (
            <button
              onClick={() => setShowWalletMenu(!showWalletMenu)}
              className="px-4 py-2 bg-poly-green text-black font-semibold rounded-xl hover:bg-poly-green/90 transition-all"
            >
              Connect Wallet
            </button>
          )}

          {/* Wallet Menu Dropdown */}
          <AnimatePresence>
            {showWalletMenu && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="absolute right-0 top-full mt-2 w-72 bg-poly-card border border-poly-border rounded-xl shadow-2xl overflow-hidden"
              >
                {connected ? (
                  <div className="p-4">
                    <div className="text-sm text-gray-400 mb-2">Connected with</div>
                    <div className="flex items-center gap-2 mb-4">
                      {wallet?.icon && (
                        <img src={wallet.icon} alt={wallet.name} className="w-6 h-6" />
                      )}
                      <span className="text-white font-medium">{wallet?.name}</span>
                    </div>

                    {isXChainWallet && (
                      <div className="mb-4 p-3 bg-orange-500/10 border border-orange-500/30 rounded-lg">
                        <div className="text-orange-400 text-xs font-semibold mb-1">
                          X-Chain Connection
                        </div>
                        <div className="text-gray-400 text-xs">
                          Your ETH wallet is connected to Aptos via Derived Account Abstraction
                        </div>
                      </div>
                    )}

                    <a
                      href={`https://aptos.dev/en/network/faucet?address=${account?.address.toString()}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block w-full py-2 mb-3 bg-poly-green/20 text-poly-green text-center text-sm rounded-lg hover:bg-poly-green/30 transition-colors"
                    >
                      Get Testnet APT (Faucet)
                    </a>

                    <div className="text-xs text-gray-500 mb-1">Aptos Address</div>
                    <div className="font-mono text-xs text-gray-300 break-all mb-4">
                      {account?.address.toString()}
                    </div>

                    <button
                      onClick={() => {
                        disconnect();
                        setShowWalletMenu(false);
                      }}
                      className="w-full py-2 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition-colors"
                    >
                      Disconnect
                    </button>
                  </div>
                ) : (
                  <div className="p-4">
                    <div className="text-sm text-gray-400 mb-3">
                      Connect your wallet to start betting
                    </div>

                    <div className="space-y-2">
                      {wallets?.filter(w => w.readyState === 'Installed').map((w) => (
                        <button
                          key={w.name}
                          onClick={async () => {
                            try {
                              await connect(w.name);
                              setShowWalletMenu(false);
                            } catch (error) {
                              console.error('Failed to connect:', error);
                            }
                          }}
                          className="w-full flex items-center gap-3 p-3 bg-poly-dark rounded-lg hover:bg-poly-border transition-colors"
                        >
                          {w.icon && (
                            <img src={w.icon} alt={w.name} className="w-6 h-6" />
                          )}
                          <span className="text-white">{w.name}</span>
                          {w.name.toLowerCase().includes('ethereum') && (
                            <span className="ml-auto px-2 py-0.5 bg-orange-500/20 text-orange-400 text-xs rounded-full">
                              X-Chain
                            </span>
                          )}
                        </button>
                      ))}

                      {(!wallets || wallets.filter(w => w.readyState === 'Installed').length === 0) && (
                        <div className="text-center py-4 text-gray-500 text-sm">
                          No wallets detected. Install MetaMask or Petra to continue.
                        </div>
                      )}
                    </div>

                    <div className="mt-4 pt-4 border-t border-poly-border">
                      <div className="text-xs text-gray-500 text-center">
                        Use MetaMask for X-Chain demo
                      </div>
                    </div>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </header>

    {/* Mobile Bottom Tab Bar */}
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-poly-dark/95 backdrop-blur-lg border-t border-poly-border">
      <div className="flex items-center justify-around py-2">
        <a
          href="/"
          className={`flex flex-col items-center gap-1 px-4 py-2 ${
            currentPath === '/' ? 'text-poly-green' : 'text-gray-500'
          }`}
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
          </svg>
          <span className="text-xs">Home</span>
        </a>
        <a
          href="/#markets"
          className="flex flex-col items-center gap-1 px-4 py-2 text-gray-500"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <span className="text-xs">Markets</span>
        </a>
        <a
          href="/demo"
          className={`flex flex-col items-center gap-1 px-4 py-2 ${
            currentPath === '/demo' ? 'text-poly-green' : 'text-gray-500'
          }`}
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          <span className="text-xs">Demo</span>
        </a>
        <a
          href="/#hft-demo"
          className="flex flex-col items-center gap-1 px-4 py-2 text-gray-500"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
          </svg>
          <span className="text-xs">HFT</span>
        </a>
      </div>
    </nav>
    </>
  );
}
