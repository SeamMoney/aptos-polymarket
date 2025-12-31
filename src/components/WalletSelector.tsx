import { useState, useEffect, useCallback } from 'react';
import { useWallet } from '@aptos-labs/wallet-adapter-react';
import type { AdapterWallet } from '@aptos-labs/wallet-adapter-core';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Loader2, ExternalLink } from 'lucide-react';

// Custom check to verify if a wallet extension is actually installed
// This overrides the wallet adapter's detection which may incorrectly report web versions as "installed"
const isWalletActuallyInstalled = (walletName: string): boolean => {
  if (typeof window === 'undefined') return false;

  const w = window as any;
  const lowerName = walletName.toLowerCase();

  // Petra - check for actual extension, not web version
  if (lowerName === 'petra') {
    // The Petra extension injects window.petra or window.aptos
    return !!(w.petra?.isConnected !== undefined || w.aptos?.isAptosWallet);
  }

  // Phantom - check for Solana extension
  if (lowerName.includes('phantom')) {
    return !!(w.phantom?.solana?.isPhantom || w.solana?.isPhantom);
  }

  // MetaMask - check for Ethereum extension
  if (lowerName.includes('metamask') || lowerName.includes('ethereum')) {
    return !!(w.ethereum?.isMetaMask);
  }

  // Rainbow - check for Ethereum provider
  if (lowerName.includes('rainbow')) {
    return !!(w.ethereum?.isRainbow || w.rainbow);
  }

  // For other wallets, trust the adapter's detection
  return true;
};

// Wallet category type
type WalletCategory = 'aptos' | 'solana' | 'ethereum';

// Custom wallet icons (override outdated icons from adapters)
const WALLET_ICONS: Record<string, string> = {
  // New Petra purple logo
  'Petra': 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgdmlld0JveD0iMCAwIDEwMCAxMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIxMDAiIGhlaWdodD0iMTAwIiByeD0iMjAiIGZpbGw9IiM2MzQzRUMiLz4KPHBhdGggZD0iTTI1IDMyLjVDMjUgMjguMzU3OSAyOC4zNTc5IDI1IDMyLjUgMjVINTBWNTBIMzIuNUMyOC4zNTc5IDUwIDI1IDQ2LjY0MjEgMjUgNDIuNVYzMi41WiIgZmlsbD0id2hpdGUiLz4KPHBhdGggZD0iTTUwIDI1SDY3LjVDNzEuNjQyMSAyNSA3NSAyOC4zNTc5IDc1IDMyLjVWNDIuNUM3NSA0Ni42NDIxIDcxLjY0MjEgNTAgNjcuNSA1MEg1MFYyNVoiIGZpbGw9IndoaXRlIi8+CjxwYXRoIGQ9Ik01MCA1MEg2Ny41Qzc1IDUwIDc1IDU3LjUgNzUgNjIuNUM3NSA2Ny41IDc1IDc1IDY3LjUgNzVINTBWNTBaIiBmaWxsPSJ3aGl0ZSIgZmlsbC1vcGFjaXR5PSIwLjYiLz4KPHBhdGggZD0iTTI1IDYyLjVDMjUgNTcuNSAyNSA1MCAzMi41IDUwSDUwVjc1SDMyLjVDMjguMzU3OSA3NSAyNSA3MS42NDIxIDI1IDY3LjVWNjIuNVoiIGZpbGw9IndoaXRlIiBmaWxsLW9wYWNpdHk9IjAuNiIvPgo8L3N2Zz4=',
  // Phantom - embedded purple ghost logo
  'Phantom': 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTI4IiBoZWlnaHQ9IjEyOCIgdmlld0JveD0iMCAwIDEyOCAxMjgiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIxMjgiIGhlaWdodD0iMTI4IiByeD0iMjYiIGZpbGw9IiNBQjlGRjIiLz4KPHBhdGggZD0iTTExMC40MjkgNjUuMjg1N0MxMTAuNDI5IDkxLjAxNjEgOTAuNDQ1MSAxMTEgNjQuNzE0MyAxMTFDNTAuMDg3NCAxMTEgMzYuOTk1NCAxMDQuMzk2IDI4LjMyMTEgOTQuMDQ0NEMyNi41MTQ2IDkxLjg0MTggMjkuMTAzOSA4OC43MTQzIDMxLjkzNjQgODguNzE0M0g0NS42NDI5QzQ4LjQwNDEgODguNzE0MyA1MC42NDI5IDg2LjQ3NTUgNTAuNjQyOSA4My43MTQzVjU1LjcxNDNDNTAuNjQyOSA1Mi45NTMxIDUyLjg4MTcgNTAuNzE0MyA1NS42NDI5IDUwLjcxNDNINTkuMzU3MUM2Mi4xMTgzIDUwLjcxNDMgNjQuMzU3MSA1Mi45NTMxIDY0LjM1NzEgNTUuNzE0M1Y4My43MTQzQzY0LjM1NzEgODYuNDc1NSA2Ni41OTYgODguNzE0MyA2OS4zNTcxIDg4LjcxNDNINzMuMDcxNEM3NS44MzI2IDg4LjcxNDMgNzguMDcxNCA4Ni40NzU1IDc4LjA3MTQgODMuNzE0M1Y0MC43MTQzQzc4LjA3MTQgMzcuOTUzMSA4MC4zMTAzIDM1LjcxNDMgODMuMDcxNCAzNS43MTQzSDg2Ljc4NTdDODkuNTQ2OSAzNS43MTQzIDkxLjc4NTcgMzcuOTUzMSA5MS43ODU3IDQwLjcxNDNWNTkuMjg1N0M5MS43ODU3IDU5LjI4NTcgOTYuNTYyNSA1MS4zNTcxIDEwNC4yMTQgNTEuMzU3MUMxMDcuNDI5IDUxLjM1NzEgMTEwLjQyOSA1NC4yNDEzIDExMC40MjkgNTguNjA3MlY2NS4yODU3WiIgZmlsbD0id2hpdGUiLz4KPGNpcmNsZSBjeD0iNDAiIGN5PSI1MCIgcj0iNiIgZmlsbD0iIzRCNDY1QyIvPgo8Y2lyY2xlIGN4PSI3MCIgY3k9IjM1IiByPSI2IiBmaWxsPSIjNEI0NjVDIi8+Cjwvc3ZnPg==',
  'Phantom (Solana)': 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTI4IiBoZWlnaHQ9IjEyOCIgdmlld0JveD0iMCAwIDEyOCAxMjgiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIxMjgiIGhlaWdodD0iMTI4IiByeD0iMjYiIGZpbGw9IiNBQjlGRjIiLz4KPHBhdGggZD0iTTExMC40MjkgNjUuMjg1N0MxMTAuNDI5IDkxLjAxNjEgOTAuNDQ1MSAxMTEgNjQuNzE0MyAxMTFDNTAuMDg3NCAxMTEgMzYuOTk1NCAxMDQuMzk2IDI4LjMyMTEgOTQuMDQ0NEMyNi41MTQ2IDkxLjg0MTggMjkuMTAzOSA4OC43MTQzIDMxLjkzNjQgODguNzE0M0g0NS42NDI5QzQ4LjQwNDEgODguNzE0MyA1MC42NDI5IDg2LjQ3NTUgNTAuNjQyOSA4My43MTQzVjU1LjcxNDNDNTAuNjQyOSA1Mi45NTMxIDUyLjg4MTcgNTAuNzE0MyA1NS42NDI5IDUwLjcxNDNINTkuMzU3MUM2Mi4xMTgzIDUwLjcxNDMgNjQuMzU3MSA1Mi45NTMxIDY0LjM1NzEgNTUuNzE0M1Y4My43MTQzQzY0LjM1NzEgODYuNDc1NSA2Ni41OTYgODguNzE0MyA2OS4zNTcxIDg4LjcxNDNINzMuMDcxNEM3NS44MzI2IDg4LjcxNDMgNzguMDcxNCA4Ni40NzU1IDc4LjA3MTQgODMuNzE0M1Y0MC43MTQzQzc4LjA3MTQgMzcuOTUzMSA4MC4zMTAzIDM1LjcxNDMgODMuMDcxNCAzNS43MTQzSDg2Ljc4NTdDODkuNTQ2OSAzNS43MTQzIDkxLjc4NTcgMzcuOTUzMSA5MS43ODU3IDQwLjcxNDNWNTkuMjg1N0M5MS43ODU3IDU5LjI4NTcgOTYuNTYyNSA1MS4zNTcxIDEwNC4yMTQgNTEuMzU3MUMxMDcuNDI5IDUxLjM1NzEgMTEwLjQyOSA1NC4yNDEzIDExMC40MjkgNTguNjA3MlY2NS4yODU3WiIgZmlsbD0id2hpdGUiLz4KPGNpcmNsZSBjeD0iNDAiIGN5PSI1MCIgcj0iNiIgZmlsbD0iIzRCNDY1QyIvPgo8Y2lyY2xlIGN4PSI3MCIgY3k9IjM1IiByPSI2IiBmaWxsPSIjNEI0NjVDIi8+Cjwvc3ZnPg==',
  // MetaMask
  'MetaMask (Ethereum)': 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTI4IiBoZWlnaHQ9IjEyOCIgdmlld0JveD0iMCAwIDEyOCAxMjgiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIxMjgiIGhlaWdodD0iMTI4IiByeD0iMjYiIGZpbGw9IndoaXRlIi8+CjxwYXRoIGQ9Ik0xMDkuMjc0IDE5LjU4NThMNzAuNTIgNDguNDI5N0w3OC4yNDIgMzEuMjcxOEwxMDkuMjc0IDE5LjU4NThaIiBmaWxsPSIjRTI3NjFCIiBzdHJva2U9IiNFMjc2MUIiIHN0cm9rZS13aWR0aD0iMC41Ii8+CjxwYXRoIGQ9Ik0xOC43MjU5IDE5LjU4NThMNTcuMTY1IDQ4LjcxMTdMNDkuNzU4MSAzMS4yNzE4TDE4LjcyNTkgMTkuNTg1OFoiIGZpbGw9IiNFNDc2MUIiIHN0cm9rZT0iI0U0NzYxQiIgc3Ryb2tlLXdpZHRoPSIwLjUiLz4KPHBhdGggZD0iTTk1LjAyMTkgODIuNDM1TDg0LjQzMjkgOTguMzExNkwxMDYuNzk5IDEwNC43MjVMMTEzLjQ5OCA4Mi43MTdMOTUuMDIxOSA4Mi40MzVaIiBmaWxsPSIjRTQ3NjFCIiBzdHJva2U9IiNFNDc2MUIiIHN0cm9rZS13aWR0aD0iMC41Ii8+CjxwYXRoIGQ9Ik0xNC41MDE5IDgyLjcxN0wyMS4yMDEgMTA0LjcyNUw0My41NjcgOTguMzExNkwzMi45NzggODIuNDM1TDE0LjUwMTkgODIuNzE3WiIgZmlsbD0iI0U0NzYxQiIgc3Ryb2tlPSIjRTQ3NjFCIiBzdHJva2Utd2lkdGg9IjAuNSIvPgo8cGF0aCBkPSJNNDIuMTY0OSA1Ni4yNDQ0TDM1LjY1MTkgNjYuMjM3Mkw1Ny43MzQgNjcuMjQyOUw1Ni45NTM5IDQzLjUyMTVMNDIuMTY0OSA1Ni4yNDQ0WiIgZmlsbD0iI0U0NzYxQiIgc3Ryb2tlPSIjRTQ3NjFCIiBzdHJva2Utd2lkdGg9IjAuNSIvPgo8cGF0aCBkPSJNODUuODM1IDU2LjI0NDRMNzAuNzY0IDQzLjI0MDFMNzAuMjY2IDY3LjI0MjlMOTIuMzQ4IDY2LjIzNzJMODUuODM1IDU2LjI0NDRaIiBmaWxsPSIjRTQ3NjFCIiBzdHJva2U9IiNFNDc2MUIiIHN0cm9rZS13aWR0aD0iMC41Ii8+CjxwYXRoIGQ9Ik00My41NjcgOTguMzExNkw1Ni4zODkgOTEuOTY5M0w0NS4yMzc5IDgyLjg1ODdMNDMuNTY3IDk4LjMxMTZaIiBmaWxsPSIjRTQ3NjFCIiBzdHJva2U9IiNFNDc2MUIiIHN0cm9rZS13aWR0aD0iMC41Ii8+CjxwYXRoIGQ9Ik03MS42MTEgOTEuOTY5M0w4NC40MzI5IDk4LjMxMTZMODIuNzYyIDgyLjg1ODdMNzEuNjExIDkxLjk2OTNaIiBmaWxsPSIjRTQ3NjFCIiBzdHJva2U9IiNFNDc2MUIiIHN0cm9rZS13aWR0aD0iMC41Ii8+Cjwvc3ZnPg==',
  // Rainbow
  'Rainbow (Ethereum)': 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTIwIiBoZWlnaHQ9IjEyMCIgdmlld0JveD0iMCAwIDEyMCAxMjAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIxMjAiIGhlaWdodD0iMTIwIiByeD0iMjQiIGZpbGw9IiMwMDFGQjIiLz4KPHBhdGggZD0iTTIwIDM4QzIwIDI3LjUwNjYgMjguNTA2NiAxOSAzOSAxOUg4MUM5MS40OTM0IDE5IDEwMCAyNy41MDY2IDEwMCAzOFY4MkMxMDAgOTIuNDkzNCA5MS40OTM0IDEwMSA4MSAxMDFIMzlDMjguNTA2NiAxMDEgMjAgOTIuNDkzNCAyMCA4MlYzOFoiIGZpbGw9InVybCgjcGFpbnQwX2xpbmVhcl8xMDVfMTApIi8+CjxwYXRoIGQ9Ik0yNSA1MEMyNSAzNi4xOTI5IDM2LjE5MjkgMjUgNTAgMjVINzBDODMuODA3MSAyNSA5NSAzNi4xOTI5IDk1IDUwVjcwQzk1IDgzLjgwNzEgODMuODA3MSA5NSA3MCA5NUg1MEMzNi4xOTI5IDk1IDI1IDgzLjgwNzEgMjUgNzBWNTBaIiBmaWxsPSJ1cmwoI3BhaW50MV9saW5lYXJfMTA1XzEwKSIvPgo8cGF0aCBkPSJNMzUgNTVDMzUgNDYuNzE1NyA0MS43MTU3IDQwIDUwIDQwSDcwQzc4LjI4NDMgNDAgODUgNDYuNzE1NyA4NSA1NVY2NUM4NSA3My4yODQzIDc4LjI4NDMgODAgNzAgODBINTBDNDEuNzE1NyA4MCAzNSA3My4yODQzIDM1IDY1VjU1WiIgZmlsbD0idXJsKCNwYWludDJfbGluZWFyXzEwNV8xMCkiLz4KPHBhdGggZD0iTTQ1IDYwQzQ1IDU0LjQ3NzIgNDkuNDc3MiA1MCA1NSA1MEg2NUM3MC41MjI4IDUwIDc1IDU0LjQ3NzIgNzUgNjBDNzUgNjUuNTIyOCA3MC41MjI4IDcwIDY1IDcwSDU1QzQ5LjQ3NzIgNzAgNDUgNjUuNTIyOCA0NSA2MFoiIGZpbGw9IiMwMDFGQjIiLz4KPGRlZnM+CjxsaW5lYXJHcmFkaWVudCBpZD0icGFpbnQwX2xpbmVhcl8xMDVfMTAiIHgxPSI2MCIgeTE9IjE5IiB4Mj0iNjAiIHkyPSIxMDEiIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIj4KPHN0b3Agc3RvcC1jb2xvcj0iI0ZGNTMwMCIvPgo8c3RvcCBvZmZzZXQ9IjEiIHN0b3AtY29sb3I9IiNGRjk5MDAiLz4KPC9saW5lYXJHcmFkaWVudD4KPGxpbmVhckdyYWRpZW50IGlkPSJwYWludDFfbGluZWFyXzEwNV8xMCIgeDE9IjYwIiB5MT0iMjUiIHgyPSI2MCIgeTI9Ijk1IiBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+CjxzdG9wIHN0b3AtY29sb3I9IiNGRjAwRkYiLz4KPHN0b3Agb2Zmc2V0PSIxIiBzdG9wLWNvbG9yPSIjMDBCRkZGIi8+CjwvbGluZWFyR3JhZGllbnQ+CjxsaW5lYXJHcmFkaWVudCBpZD0icGFpbnQyX2xpbmVhcl8xMDVfMTAiIHgxPSI2MCIgeTE9IjQwIiB4Mj0iNjAiIHkyPSI4MCIgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiPgo8c3RvcCBzdG9wLWNvbG9yPSIjMDBGRjk0Ii8+CjxzdG9wIG9mZnNldD0iMSIgc3RvcC1jb2xvcj0iIzAwRkZGRiIvPgo8L2xpbmVhckdyYWRpZW50Pgo8L2RlZnM+Cjwvc3ZnPg==',
};

// Helper to get wallet icon
export const getWalletIcon = (walletName: string, fallbackIcon?: string): string => {
  return WALLET_ICONS[walletName] || WALLET_ICONS[walletName.replace(' (Solana)', '').replace(' (Ethereum)', '')] || fallbackIcon || '';
};

interface WalletSelectorProps {
  isOpen: boolean;
  onClose: () => void;
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
  wallet: AdapterWallet;
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

  // Use custom icon if available, otherwise fall back to wallet's icon
  const walletIcon = WALLET_ICONS[wallet.name] || WALLET_ICONS[displayName] || wallet.icon;

  return (
    <button
      onClick={handleClick}
      disabled={connecting}
      className="w-full flex items-center gap-3 p-3 bg-[#1c2b3a] hover:bg-[#2a3d4e] rounded-xl transition-colors disabled:opacity-50"
    >
      {walletIcon ? (
        <img
          src={walletIcon}
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
  const [connectingWallet, setConnectingWallet] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Close modal when connected
  useEffect(() => {
    if (connected && isOpen) {
      onClose();
    }
  }, [connected, isOpen, onClose]);

  // Categorize wallets
  const categorizeWallets = (walletList: readonly AdapterWallet[]) => {
    return walletList.reduce<{
      aptos: AdapterWallet[];
      solana: AdapterWallet[];
      ethereum: AdapterWallet[];
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

  // Use custom check to determine if wallet is actually installed
  // This prevents web.petra.app black screen and other issues
  const checkActuallyInstalled = useCallback((wallet: AdapterWallet): boolean => {
    // First check if adapter says it's installed
    if (wallet.readyState !== 'Installed') return false;
    // Then verify with our custom check
    return isWalletActuallyInstalled(wallet.name);
  }, []);

  const installedWallets = wallets?.filter(w => checkActuallyInstalled(w)) || [];
  const notInstalledWallets = wallets?.filter(w => !checkActuallyInstalled(w)) || [];

  const categorizedInstalled = categorizeWallets(installedWallets);
  const categorizedNotInstalled = categorizeWallets(notInstalledWallets);

  const currentInstalled = categorizedInstalled[selectedCategory];
  const currentNotInstalled = categorizedNotInstalled[selectedCategory];

  const handleConnect = async (walletName: string) => {
    try {
      setError(null);
      setConnectingWallet(walletName);

      // Double-check the extension is actually available before connecting
      // This prevents web.petra.app black screen and similar issues
      if (!isWalletActuallyInstalled(walletName)) {
        const lowerName = walletName.toLowerCase();
        let installUrl = '';
        let walletDisplayName = walletName;

        if (lowerName === 'petra') {
          installUrl = 'https://petra.app';
          walletDisplayName = 'Petra';
        } else if (lowerName.includes('phantom')) {
          installUrl = 'https://phantom.app';
          walletDisplayName = 'Phantom';
        } else if (lowerName.includes('metamask')) {
          installUrl = 'https://metamask.io';
          walletDisplayName = 'MetaMask';
        } else if (lowerName.includes('rainbow')) {
          installUrl = 'https://rainbow.me';
          walletDisplayName = 'Rainbow';
        }

        setError(`${walletDisplayName} extension not found. Please install the browser extension.`);
        if (installUrl) {
          window.open(installUrl, '_blank');
        }
        return;
      }

      await connect(walletName);
    } catch (err) {
      console.error('Failed to connect:', err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      // Check for common error patterns
      if (errorMessage.includes('User rejected') || errorMessage.includes('rejected')) {
        setError('Connection cancelled by user.');
      } else if (errorMessage.includes('origins don\'t match') || errorMessage.includes('CORS')) {
        setError('Connection blocked. Please use the browser extension, not the web version.');
      } else {
        setError(`Failed to connect to ${walletName}. Make sure the extension is installed and unlocked.`);
      }
    } finally {
      setConnectingWallet(null);
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

          {/* Category Tabs */}
          <div className="px-6 mb-4">
            <div className="flex gap-1 p-1 bg-[#2a3d4e] rounded-xl">
              <TabButton
                category="aptos"
                selected={selectedCategory === 'aptos'}
                onClick={() => { setSelectedCategory('aptos'); setError(null); }}
                count={categorizedInstalled.aptos.length + categorizedNotInstalled.aptos.length}
              />
              <TabButton
                category="solana"
                selected={selectedCategory === 'solana'}
                onClick={() => { setSelectedCategory('solana'); setError(null); }}
                count={categorizedInstalled.solana.length + categorizedNotInstalled.solana.length}
              />
              <TabButton
                category="ethereum"
                selected={selectedCategory === 'ethereum'}
                onClick={() => { setSelectedCategory('ethereum'); setError(null); }}
                count={categorizedInstalled.ethereum.length + categorizedNotInstalled.ethereum.length}
              />
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="px-6 mb-4">
              <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                <p className="text-red-400 text-sm">{error}</p>
              </div>
            </div>
          )}

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
                className="inline-flex items-center gap-2 px-4 py-2 bg-[#6343EC] hover:bg-[#5333DC] text-white text-sm font-medium rounded-lg transition-colors"
              >
                <img src={WALLET_ICONS['Petra']} alt="Petra" className="w-5 h-5 rounded" />
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
