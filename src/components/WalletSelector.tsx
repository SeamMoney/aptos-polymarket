import { useState, useEffect } from 'react';
import { useWallet, type Wallet } from '@aptos-labs/wallet-adapter-react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Loader2, ExternalLink, ChevronDown } from 'lucide-react';

// Wallet category type
type WalletCategory = 'aptos' | 'solana' | 'ethereum';

interface WalletSelectorProps {
  isOpen: boolean;
  onClose: () => void;
}

// Google icon
function GoogleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    </svg>
  );
}

// Apple icon
function AppleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
    </svg>
  );
}

// Aptos Connect (Social login) component
function AptosConnectButton({ onClick, connecting }: { onClick: () => void; connecting: boolean }) {
  return (
    <div className="space-y-3 mb-6">
      <button
        onClick={onClick}
        disabled={connecting}
        className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-white hover:bg-gray-100 text-gray-900 font-medium rounded-xl transition-colors disabled:opacity-50"
      >
        <GoogleIcon />
        <span>Google</span>
        {connecting && <Loader2 size={16} className="animate-spin" />}
      </button>
      <button
        onClick={onClick}
        disabled={connecting}
        className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-[#2a3d4e] hover:bg-[#3a4f60] text-white font-medium rounded-xl transition-colors disabled:opacity-50"
      >
        <AppleIcon />
        <span>Apple</span>
      </button>
    </div>
  );
}

// Category tab button
function TabButton({
  category,
  selected,
  onClick,
  count
}: {
  category: WalletCategory;
  selected: boolean;
  onClick: () => void;
  count: number;
}) {
  const labels: Record<WalletCategory, string> = {
    aptos: 'Aptos',
    solana: 'Solana',
    ethereum: 'Ethereum',
  };

  return (
    <button
      onClick={onClick}
      className={`flex-1 py-2.5 px-3 text-sm font-medium rounded-lg transition-colors ${
        selected
          ? 'bg-[#3a4f60] text-white'
          : 'text-[#8297a3] hover:text-white hover:bg-[#2a3d4e]'
      }`}
    >
      {labels[category]}
      {count > 0 && (
        <span className={`ml-1.5 text-xs ${selected ? 'text-[#60a5fa]' : 'text-[#6b7a8a]'}`}>
          ({count})
        </span>
      )}
    </button>
  );
}

// Individual wallet button
function WalletButton({
  wallet,
  onConnect,
  connecting,
  isInstalled,
}: {
  wallet: Wallet;
  onConnect: () => void;
  connecting: boolean;
  isInstalled: boolean;
}) {
  const handleClick = () => {
    if (isInstalled) {
      onConnect();
    } else if (wallet.url) {
      window.open(wallet.url, '_blank');
    }
  };

  // Get chain label from wallet name
  const getChainLabel = () => {
    if (wallet.name.includes('Solana')) return 'Solana';
    if (wallet.name.includes('Ethereum')) return 'Ethereum';
    return null;
  };

  const chainLabel = getChainLabel();
  const displayName = wallet.name.replace(' (Solana)', '').replace(' (Ethereum)', '');

  return (
    <button
      onClick={handleClick}
      disabled={connecting}
      className="w-full flex items-center gap-3 p-3 bg-[#1c2b3a] hover:bg-[#2a3d4e] rounded-xl transition-colors disabled:opacity-50"
    >
      {wallet.icon ? (
        <img
          src={wallet.icon}
          alt={wallet.name}
          className={`w-10 h-10 rounded-xl ${!isInstalled ? 'opacity-50' : ''}`}
        />
      ) : (
        <div className={`w-10 h-10 rounded-xl bg-[#3a4f60] flex items-center justify-center ${!isInstalled ? 'opacity-50' : ''}`}>
          <span className="text-white font-bold">{displayName[0]}</span>
        </div>
      )}
      <div className="flex-1 text-left">
        <div className="flex items-center gap-2">
          <span className={`text-white font-medium ${!isInstalled ? 'opacity-50' : ''}`}>
            {displayName}
          </span>
          {chainLabel && (
            <span className="text-[10px] text-[#8297a3]">({chainLabel})</span>
          )}
        </div>
      </div>
      {isInstalled ? (
        <span className="px-3 py-1.5 bg-[#3a4f60] hover:bg-[#4a5f70] text-white text-sm font-medium rounded-lg">
          Connect
        </span>
      ) : (
        <span className="px-3 py-1.5 text-[#60a5fa] text-sm font-medium flex items-center gap-1">
          Install <ExternalLink size={12} />
        </span>
      )}
      {connecting && <Loader2 size={18} className="text-[#60a5fa] animate-spin" />}
    </button>
  );
}

export function WalletSelector({ isOpen, onClose }: WalletSelectorProps) {
  const { wallets, connect, connected } = useWallet();
  const [selectedCategory, setSelectedCategory] = useState<WalletCategory>('aptos');
  const [connecting, setConnecting] = useState(false);
  const [connectingWallet, setConnectingWallet] = useState<string | null>(null);

  // Close modal when connected
  useEffect(() => {
    if (connected && isOpen) {
      onClose();
    }
  }, [connected, isOpen, onClose]);

  // Categorize wallets
  const categorizeWallets = (walletList: readonly Wallet[]) => {
    return walletList.reduce<{
      aptos: Wallet[];
      solana: Wallet[];
      ethereum: Wallet[];
    }>(
      (acc, wallet) => {
        const name = wallet.name.toLowerCase();
        if (name.includes('ethereum') || name.includes('evm')) {
          acc.ethereum.push(wallet);
        } else if (name.includes('solana')) {
          acc.solana.push(wallet);
        } else {
          acc.aptos.push(wallet);
        }
        return acc;
      },
      { aptos: [], solana: [], ethereum: [] }
    );
  };

  const installedWallets = wallets?.filter(w => w.readyState === 'Installed') || [];
  const notInstalledWallets = wallets?.filter(w => w.readyState !== 'Installed') || [];

  const categorizedInstalled = categorizeWallets(installedWallets);
  const categorizedNotInstalled = categorizeWallets(notInstalledWallets);

  const currentInstalled = categorizedInstalled[selectedCategory];
  const currentNotInstalled = categorizedNotInstalled[selectedCategory];

  const handleConnect = async (walletName: string) => {
    try {
      setConnecting(true);
      setConnectingWallet(walletName);
      await connect(walletName);
    } catch (error) {
      console.error('Failed to connect:', error);
    } finally {
      setConnecting(false);
      setConnectingWallet(null);
    }
  };

  // Handle Aptos Connect (Google/Apple)
  const handleAptosConnect = async () => {
    // Find Aptos Connect wallet
    const aptosConnectWallet = wallets?.find(w =>
      w.name.toLowerCase().includes('connect') ||
      w.name.toLowerCase().includes('social')
    );
    if (aptosConnectWallet) {
      await handleConnect(aptosConnectWallet.name);
    } else {
      // Fallback - try to find any available wallet
      console.log('Aptos Connect not available');
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ duration: 0.2 }}
          className="w-full max-w-md bg-[#1c2b3a] border-2 border-[#3a4f60] rounded-2xl shadow-2xl overflow-hidden"
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="relative p-6 pb-4">
            {/* Decorative gradient */}
            <div className="absolute inset-0 overflow-hidden">
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[300px] h-[150px] bg-gradient-to-b from-[#60a5fa]/20 via-[#22c55e]/10 to-transparent rounded-full blur-3xl" />
            </div>

            {/* Close button */}
            <button
              onClick={onClose}
              className="absolute top-4 right-4 p-2 hover:bg-[#2a3d4e] rounded-lg transition-colors"
            >
              <X size={20} color="#8297a3" />
            </button>

            {/* Title */}
            <div className="relative text-center mb-2">
              <h2 className="text-xl font-bold text-white">Connect to Polymarket</h2>
              <p className="text-[#8297a3] text-sm mt-2">
                Select from a number of wallet options to connect,
                including Move, Solana, and Ethereum wallets.
              </p>
            </div>
          </div>

          {/* Social Login */}
          <div className="px-6">
            <AptosConnectButton onClick={handleAptosConnect} connecting={connecting} />
          </div>

          {/* Category Tabs */}
          <div className="px-6 mb-4">
            <div className="flex gap-1 p-1 bg-[#2a3d4e] rounded-xl">
              <TabButton
                category="aptos"
                selected={selectedCategory === 'aptos'}
                onClick={() => setSelectedCategory('aptos')}
                count={categorizedInstalled.aptos.length + categorizedNotInstalled.aptos.length}
              />
              <TabButton
                category="solana"
                selected={selectedCategory === 'solana'}
                onClick={() => setSelectedCategory('solana')}
                count={categorizedInstalled.solana.length + categorizedNotInstalled.solana.length}
              />
              <TabButton
                category="ethereum"
                selected={selectedCategory === 'ethereum'}
                onClick={() => setSelectedCategory('ethereum')}
                count={categorizedInstalled.ethereum.length + categorizedNotInstalled.ethereum.length}
              />
            </div>
          </div>

          {/* Wallet List */}
          <div className="px-6 pb-6 max-h-[300px] overflow-y-auto">
            <div className="space-y-2">
              {/* Installed wallets */}
              {currentInstalled.map(wallet => (
                <WalletButton
                  key={wallet.name}
                  wallet={wallet}
                  onConnect={() => handleConnect(wallet.name)}
                  connecting={connectingWallet === wallet.name}
                  isInstalled={true}
                />
              ))}

              {/* Not installed wallets */}
              {currentNotInstalled.length > 0 && (
                <>
                  {currentInstalled.length > 0 && (
                    <div className="py-2">
                      <div className="text-[10px] text-[#6b7a8a] uppercase tracking-wider">
                        Available to Install
                      </div>
                    </div>
                  )}
                  {currentNotInstalled.slice(0, 5).map(wallet => (
                    <WalletButton
                      key={wallet.name}
                      wallet={wallet}
                      onConnect={() => handleConnect(wallet.name)}
                      connecting={connectingWallet === wallet.name}
                      isInstalled={false}
                    />
                  ))}
                </>
              )}

              {/* Empty state */}
              {currentInstalled.length === 0 && currentNotInstalled.length === 0 && (
                <div className="text-center py-8 text-[#6b7a8a]">
                  No {selectedCategory} wallets available
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-[#3a4f60] bg-[#1c2b3a]/50">
            <div className="text-center">
              <p className="text-[10px] text-[#6b7a8a] mb-2">
                Don't have a wallet?
              </p>
              <a
                href="https://petra.app"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 bg-[#2a3d4e] hover:bg-[#3a4f60] text-white text-sm font-medium rounded-lg transition-colors"
              >
                <img src="https://petra.app/favicon.ico" alt="Petra" className="w-4 h-4" />
                Download Petra chrome extension
              </a>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

export default WalletSelector;
