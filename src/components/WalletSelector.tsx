import { useState, useEffect, useMemo } from 'react';
import { useWallet, WalletItem, isInstallRequired } from '@aptos-labs/wallet-adapter-react';
import {
  groupAndSortWallets,
  type AdapterWallet,
  type AdapterNotDetectedWallet,
} from '@aptos-labs/wallet-adapter-core';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ExternalLink } from 'lucide-react';

// Custom wallet icons (override outdated icons from adapters)
const WALLET_ICONS: Record<string, string> = {
  'Petra': 'data:image/png;base64,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',
  'Phantom': 'data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0idXRmLTgiPz4KPHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMjgiIGhlaWdodD0iMTI4IiB2aWV3Qm94PSIwIDAgMTI4IDEyOCIgZmlsbD0ibm9uZSI+CjxyZWN0IHdpZHRoPSIxMjgiIGhlaWdodD0iMTI4IiByeD0iMjYiIGZpbGw9IiNBQjlGRjIiLz4KPHBhdGggZmlsbC1ydWxlPSJldmVub2RkIiBjbGlwLXJ1bGU9ImV2ZW5vZGQiIGQ9Ik01NS42NDE2IDgyLjE0NzdDNTAuODc0NCA4OS40NTI1IDQyLjg4NjIgOTguNjk2NiAzMi4yNTY4IDk4LjY5NjZDMjcuMjMyIDk4LjY5NjYgMjIuNDAwNCA5Ni42MjggMjIuNDAwNCA4Ny42NDI0QzIyLjQwMDQgNjQuNzU4NCA1My42NDQ1IDI5LjMzMzUgODIuNjMzOSAyOS4zMzM1Qzk5LjEyNTcgMjkuMzMzNSAxMDUuNjk3IDQwLjc3NTUgMTA1LjY5NyA1My43Njg5QzEwNS42OTcgNzAuNDQ3MSA5NC44NzM5IDg5LjUxNzEgODQuMTE1NiA4OS41MTcxQzgwLjcwMTMgODkuNTE3MSA3OS4wMjY0IDg3LjY0MjQgNzkuMDI2NCA4NC42Njg4Qzc5LjAyNjQgODMuODkzMSA3OS4xNTUyIDgzLjA1MjcgNzkuNDEyOSA4Mi4xNDc3Qzc1Ljc0MDkgODguNDE4MiA2OC42NTQ2IDk0LjIzNjEgNjIuMDE5MiA5NC4yMzYxQzU3LjE4NzcgOTQuMjM2MSA1NC43Mzk3IDkxLjE5NzkgNTQuNzM5NyA4Ni45MzE0QzU0LjczOTcgODUuMzc5OSA1NS4wNjE4IDgzLjc2MzggNTUuNjQxNiA4Mi4xNDc3Wk04MC42MTMzIDUzLjMxODJDODAuNjEzMyA1Ny4xMDQ0IDc4LjM3OTUgNTguOTk3NSA3NS44ODA2IDU4Ljk5NzVDNzMuMzQzOCA1OC45OTc1IDcxLjE0NzkgNTcuMTA0NCA3MS4xNDc5IDUzLjMxODJDNzEuMTQ3OSA0OS41MzIgNzMuMzQzOCA0Ny42Mzg5IDc1Ljg4MDYgNDcuNjM4OUM3OC4zNzk1IDQ3LjYzODkgODAuNjEzMyA0OS41MzIgODAuNjEzMyA1My4zMTgyWk05NC44MTAyIDUzLjMxODRDOTQuODEwMiA1Ny4xMDQ2IDkyLjU3NjMgNTguOTk3NyA5MC4wNzc1IDU4Ljk5NzdDODcuNTQwNyA1OC45OTc3IDg1LjM0NDcgNTcuMTA0NiA4NS4zNDQ3IDUzLjMxODRDODUuMzQ0NyA0OS41MzIzIDg3LjU0MDcgNDcuNjM5MiA5MC4wNzc1IDQ3LjYzOTJDOTIuNTc2MyA0Ny42MzkyIDk0LjgxMDIgNDkuNTMyMyA5NC44MTAyIDUzLjMxODRaIiBmaWxsPSIjRkZGREY4Ii8+Cjwvc3ZnPg==',
  'MetaMask': 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMjgiIGhlaWdodD0iMTI4IiB2aWV3Qm94PSIwIDAgMjEyIDIxMiI+PHJlY3Qgd2lkdGg9IjIxMiIgaGVpZ2h0PSIyMTIiIHJ4PSI0MCIgZmlsbD0iI2ZmZiIvPjxwYXRoIGZpbGw9IiNFMTc3MjYiIHN0cm9rZT0iI0UxNzcyNiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIiBkPSJtMTY3LjggMzQuMi03Mi4zIDUzLjggMTMuNC0zMS42eiIvPjxwYXRoIGZpbGw9IiNFMjc2MjUiIHN0cm9rZT0iI0UyNzYyNSIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIiBkPSJNNDQgMzQuMmw3MS43IDU0LjMtMTIuNy0zMi4xem0xMDUuNyA5OS41LTE5LjMgMjkuNSA0MS4zIDExLjQgMTEuOC00MHptLTE0Mi4yLjkgMTEuNyA0MCA0MS4zLTExLjQtMTkuMi0yOS41eiIvPjxwYXRoIGZpbGw9IiNFMjc2MjUiIHN0cm9rZT0iI0UyNzYyNSIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIiBkPSJNNTguNiA5Mi4xbC0xMS41IDE3LjQgNDEgMS45LTEuNC00NC40em05NC42IDBMMTIyIDY2LjRsLTEgNDUgNDEtMS45em0tOTIuOCA3MS4xIDE0LjctMjMuNS0yNSAzMy0yLjQtMTguOHptMTAzLTkuNS0yLjQgMTguOSAyNS0zMy0xNC42LTIzLjZ6Ii8+PHBhdGggZmlsbD0iI0Q1QkZCMiIgc3Ryb2tlPSIjRDVCRkIyIiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiIGQ9Im0xNjMuMiAxNjMuMi0yNC44LTcuMiA0IDEyLjEtLjQgNS4xem0tMTE0LjYgMCAyMC45IDEwIDQtNS0yNS0xMi4xeiIvPjxwYXRoIGZpbGw9IiMyMzM0NDciIHN0cm9rZT0iIzIzMzQ0NyIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIiBkPSJNNjkuMiAxNDMuOS05LTI2LjkgNDAuMSAxLjl6bTczLjcgMGwtMzEuMi0yNSA0MC4xLTEuOXptLTgyLjUtMzQuNCAzMS41IDE3IDEuMi0zNS42em04Ni43LTE4LjQgMS4yIDM1LjYgMzEuNS0xN3oiLz48cGF0aCBmaWxsPSIjQ0M2MjI4IiBzdHJva2U9IiNDQzYyMjgiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCIgZD0ibTYwLjQgMTA5LjUtMS4yIDM1LjYgMzEuNi0yNC4xek0xNTEuNyA5MWwtMS4yIDM1LjYtMzAuNS0xMS41eiIvPjxwYXRoIGZpbGw9IiNFMjc1MjUiIHN0cm9rZT0iI0UyNzUyNSIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIiBkPSJtOTEgMTIxLTMxLjQgMjQuMSAyNC42IDcuMyAzMS4yLTcuMy0yNC40LTI0LjF6bTU5LjQgMjQuMSAyNC42LTcuMy0zMS40LTI0LjEtMjQuNCwyNC4xIDMxLjIgNy4zeiIvPjxwYXRoIGZpbGw9IiNGNTg0MUIiIHN0cm9rZT0iI0Y1ODQxQiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIiBkPSJtNDguNiAxNjMuMiAyMC45IDEwLTI0LjgtMzMtMTkuMyAyMy4xem0xMTQuOCAwIDE5LjMtMjMuMS0xOS4yIDIzLjEgMjAuOS0xMHoiLz48cGF0aCBmaWxsPSIjQzAyOTJFIiBzdHJva2U9IiNDMDI5MkUiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCIgZD0ibTg0LjMgMTUyLjQtMjQuNyA3LjMgOC43IDQuMiA2LjIgMTUuMy0xLjctMjYuOHptNDMuNC4xLTExLjUgMjYuNy0xLjctMTUuMiA2LjItMTUuNCA4LjctNC4yeiIvPjxwYXRoIGZpbGw9IiMxNjE2MTYiIHN0cm9rZT0iIzE2MTYxNiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIiBkPSJNNTkuNiAxNjMuN2wyNS04LjEtMjQuNyA3LjN6bTkyLjgtLjgtMjQuNyA3LjMgMjUtOC4xeiIvPjwvc3ZnPg==',
  'Backpack': 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMjgiIGhlaWdodD0iMTI4IiB2aWV3Qm94PSIwIDAgMTI4IDEyOCI+PHJlY3Qgd2lkdGg9IjEyOCIgaGVpZ2h0PSIxMjgiIHJ4PSIyNiIgZmlsbD0iI2UzMzIzMiIvPjxwYXRoIGZpbGw9IiNmZmYiIGQ9Ik02NCAyNGMtMjIgMC00MCAyMi00MCA0NHY0MGg4MFY2OGMwLTIyLTE4LTQ0LTQwLTQ0em0wIDE2YzEzLjMgMCAyNCAxMy40IDI0IDMwdjI0SDQwVjcwYzAtMTYuNiAxMC43LTMwIDI0LTMweiIvPjwvc3ZnPg==',
  'Coinbase Wallet': 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMjgiIGhlaWdodD0iMTI4IiB2aWV3Qm94PSIwIDAgMTI4IDEyOCI+PHJlY3Qgd2lkdGg9IjEyOCIgaGVpZ2h0PSIxMjgiIHJ4PSIyNiIgZmlsbD0iIzAwNTJGRiIvPjxwYXRoIGZpbGw9IiNmZmYiIGQ9Ik02NCAyNGMtMjIuMSAwLTQwIDE3LjktNDAgNDBzMTcuOSA0MCA0MCA0MCA0MC0xNy45IDQwLTQwLTE3LjktNDAtNDAtNDB6bTAgNjRjLTEzLjMgMC0yNC0xMC43LTI0LTI0czEwLjctMjQgMjQtMjQgMjQgMTAuNyAyNCAyNC0xMC43IDI0LTI0IDI0eiIvPjxyZWN0IHg9IjUyIiB5PSI1MiIgd2lkdGg9IjI0IiBoZWlnaHQ9IjI0IiByeD0iNCIgZmlsbD0iI2ZmZiIvPjwvc3ZnPg==',
};

// Helper to get wallet icon
export const getWalletIcon = (walletName: string, fallbackIcon?: string): string => {
  const baseName = walletName.replace(' (Solana)', '').replace(' (Ethereum)', '');
  return WALLET_ICONS[walletName] || WALLET_ICONS[baseName] || fallbackIcon || '';
};

interface WalletSelectorProps {
  isOpen: boolean;
  onClose: () => void;
}

// Google icon SVG
const GoogleIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
  </svg>
);

// Apple icon SVG
const AppleIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="#000000">
    <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
  </svg>
);

type ChainTab = 'aptos' | 'solana' | 'ethereum';

// Aptos Connect Button for social login
function AptosConnectButton({
  wallet,
  onConnect,
  variant = 'full',
}: {
  wallet: AdapterWallet;
  onConnect: () => void;
  variant?: 'full' | 'half';
}) {
  const isGoogle = wallet.name.toLowerCase().includes('google');
  const isApple = wallet.name.toLowerCase().includes('apple');

  return (
    <WalletItem wallet={wallet} onConnect={onConnect}>
      <WalletItem.ConnectButton asChild>
        <button
          className={`${variant === 'half' ? 'flex-1' : 'w-full'} flex items-center justify-center gap-2 p-3 bg-white hover:bg-gray-100 rounded-xl transition-colors border border-gray-200`}
        >
          {isGoogle && <GoogleIcon />}
          {isApple && <AppleIcon />}
          <span className="text-gray-900 font-medium text-sm">
            {isGoogle ? 'Google' : isApple ? 'Apple' : wallet.name}
          </span>
        </button>
      </WalletItem.ConnectButton>
    </WalletItem>
  );
}

// Regular wallet button
function WalletButton({
  wallet,
  onConnect,
}: {
  wallet: AdapterWallet | AdapterNotDetectedWallet;
  onConnect: () => void;
}) {
  const baseName = wallet.name.replace(' (Solana)', '').replace(' (Ethereum)', '');
  const walletIcon = getWalletIcon(wallet.name, wallet.icon);
  const needsInstall = isInstallRequired(wallet);

  return (
    <WalletItem wallet={wallet} onConnect={onConnect}>
      {needsInstall ? (
        <a
          href={wallet.url}
          target="_blank"
          rel="noopener noreferrer"
          className="w-full flex items-center gap-3 p-3 bg-[#1c2b3a] hover:bg-[#2a3d4e] rounded-xl transition-colors"
        >
          {walletIcon ? (
            <div className="w-9 h-9 rounded-lg overflow-hidden flex items-center justify-center bg-white/5 opacity-50 shrink-0">
              <img
                src={walletIcon}
                alt={baseName}
                className="w-8 h-8 object-contain"
              />
            </div>
          ) : (
            <div className="w-9 h-9 rounded-lg bg-[#3a4f60] flex items-center justify-center opacity-50 shrink-0">
              <span className="text-white font-bold text-sm">{baseName[0]}</span>
            </div>
          )}
          <span className="flex-1 text-white/50 font-medium text-left">{baseName}</span>
          <span className="px-2 py-1 text-xs text-[#6b7a8a]">Install</span>
          <ExternalLink size={14} className="text-[#6b7a8a]" />
        </a>
      ) : (
        <WalletItem.ConnectButton asChild>
          <button
            className="w-full flex items-center gap-3 p-3 bg-[#1c2b3a] hover:bg-[#2a3d4e] rounded-xl transition-colors"
          >
            {walletIcon ? (
              <div className="w-9 h-9 rounded-lg overflow-hidden flex items-center justify-center bg-white/5 shrink-0">
                <img
                  src={walletIcon}
                  alt={baseName}
                  className="w-8 h-8 object-contain"
                />
              </div>
            ) : (
              <div className="w-9 h-9 rounded-lg bg-[#3a4f60] flex items-center justify-center shrink-0">
                <span className="text-white font-bold text-sm">{baseName[0]}</span>
              </div>
            )}
            <span className="flex-1 text-white font-medium text-left">{baseName}</span>
            <span className="px-3 py-1.5 bg-[#60a5fa] hover:bg-[#3b82f6] text-white text-sm font-medium rounded-lg">
              Connect
            </span>
          </button>
        </WalletItem.ConnectButton>
      )}
    </WalletItem>
  );
}

export function WalletSelector({ isOpen, onClose }: WalletSelectorProps) {
  const { wallets, notDetectedWallets = [], connected } = useWallet();
  const [activeTab, setActiveTab] = useState<ChainTab>('aptos');

  // Close modal when connected
  useEffect(() => {
    if (connected && isOpen) {
      onClose();
    }
  }, [connected, isOpen, onClose]);

  // Memoize wallet grouping
  const { googleWallet, appleWallet, aptosWallets, solanaWallets, ethereumWallets } = useMemo(() => {
    const { petraWebWallets, availableWallets, installableWallets } = groupAndSortWallets(
      [...(wallets || []), ...notDetectedWallets]
    );

    // Find Google and Apple wallets from petraWebWallets
    const googleWallet = petraWebWallets.find(w => w.name.toLowerCase().includes('google'));
    const appleWallet = petraWebWallets.find(w => w.name.toLowerCase().includes('apple'));

    // Deduplicate wallets - keep only one per base name (case-insensitive), prefer detected over installable
    const dedupeWallets = (wallets: (AdapterWallet | AdapterNotDetectedWallet)[]) => {
      const seen = new Set<string>();
      return wallets.filter(w => {
        const baseName = w.name.replace(' (Solana)', '').replace(' (Ethereum)', '').toLowerCase();
        if (seen.has(baseName)) return false;
        seen.add(baseName);
        return true;
      });
    };

    // Combine available and installable, then dedupe
    const allAptosWallets = [
      ...availableWallets.filter(w => !w.name.includes('Solana') && !w.name.includes('Ethereum')),
      ...installableWallets.filter(w => !w.name.includes('Solana') && !w.name.includes('Ethereum')),
    ];
    const allSolanaWallets = [
      ...availableWallets.filter(w => w.name.includes('Solana')),
      ...installableWallets.filter(w => w.name.includes('Solana')),
    ];
    const allEthereumWallets = [
      ...availableWallets.filter(w => w.name.includes('Ethereum')),
      ...installableWallets.filter(w => w.name.includes('Ethereum')),
    ];

    return {
      googleWallet,
      appleWallet,
      aptosWallets: dedupeWallets(allAptosWallets),
      solanaWallets: dedupeWallets(allSolanaWallets),
      ethereumWallets: dedupeWallets(allEthereumWallets),
    };
  }, [wallets, notDetectedWallets]);

  // Get wallets for active tab
  const currentWallets = useMemo(() => {
    switch (activeTab) {
      case 'aptos': return aptosWallets;
      case 'solana': return solanaWallets;
      case 'ethereum': return ethereumWallets;
      default: return [];
    }
  }, [activeTab, aptosWallets, solanaWallets, ethereumWallets]);

  if (!isOpen) return null;

  const tabs: { id: ChainTab; label: string; count: number }[] = [
    { id: 'aptos', label: 'Aptos', count: aptosWallets.length },
    { id: 'solana', label: 'Solana', count: solanaWallets.length },
    { id: 'ethereum', label: 'Ethereum', count: ethereumWallets.length },
  ];

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
          className="w-full max-w-sm bg-[#1c2b3a] border border-[#3a4f60] rounded-2xl shadow-2xl overflow-hidden"
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="relative p-5 pb-4">
            <button
              onClick={onClose}
              className="absolute top-4 right-4 p-1.5 hover:bg-[#2a3d4e] rounded-lg transition-colors"
            >
              <X size={18} className="text-[#8297a3]" />
            </button>

            <h2 className="text-lg font-semibold text-white">Connect Wallet</h2>
          </div>

          {/* Social Login Buttons - Full Width */}
          {(googleWallet || appleWallet) && (
            <div className="px-5 pb-4 space-y-2">
              {googleWallet && (
                <AptosConnectButton
                  wallet={googleWallet}
                  onConnect={onClose}
                  variant="full"
                />
              )}
              {appleWallet && (
                <AptosConnectButton
                  wallet={appleWallet}
                  onConnect={onClose}
                  variant="full"
                />
              )}

              <div className="flex items-center gap-3 py-4">
                <div className="flex-1 h-px bg-[#3a4f60]" />
                <span className="text-xs text-[#6b7a8a]">or</span>
                <div className="flex-1 h-px bg-[#3a4f60]" />
              </div>
            </div>
          )}

          {/* Chain Tabs */}
          <div className="px-5">
            <div className="flex bg-[#0f1a24] rounded-lg p-1">
              {tabs.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex-1 py-2 px-3 text-sm font-medium rounded-md transition-colors ${
                    activeTab === tab.id
                      ? 'bg-[#2a3d4e] text-white'
                      : 'text-[#6b7a8a] hover:text-white'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Wallet List */}
          <div className="px-5 py-4 max-h-[280px] overflow-y-auto">
            <div className="space-y-2">
              {currentWallets.length > 0 ? (
                currentWallets.map(wallet => (
                  <WalletButton
                    key={wallet.name}
                    wallet={wallet}
                    onConnect={onClose}
                  />
                ))
              ) : (
                <div className="text-center py-8 text-[#6b7a8a] text-sm">
                  No {activeTab} wallets available
                </div>
              )}
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

export default WalletSelector;
