import { useState, useEffect, useMemo, useRef } from 'react';
import { useWallet } from '@aptos-labs/wallet-adapter-react';
import {
  groupAndSortWallets,
  type AdapterWallet,
  type AdapterNotDetectedWallet,
  APTOS_CONNECT_ACCOUNT_URL
} from '@aptos-labs/wallet-adapter-core';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Loader2, ExternalLink, Smartphone } from 'lucide-react';

// Detect if user is on mobile device
const isMobileDevice = () => {
  if (typeof window === 'undefined') return false;
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
};

// Generate Petra deep link to open this dApp in Petra mobile browser
const getPetraDeepLink = () => {
  if (typeof window === 'undefined') return '';
  const currentUrl = encodeURIComponent(window.location.href);
  return `https://petra.app/explore?link=${currentUrl}`;
};

// Custom wallet icons (override outdated icons from adapters)
// All icons have consistent rounded corners (rx="24-26") for sleek appearance
const WALLET_ICONS: Record<string, string> = {
  // Petra - official logo from wallet-adapter-core registry
  'Petra': 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAIAAAACACAYAAADDPmHLAAAACXBIWXMAAAsTAAALEwEAmpwYAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAeMSURBVHgB7Z09bFNXFMfPtQKVUgZXAomJGokFFlK1Iw1mKkyFlqENVKRTOyARNqRWIkhU6ghSl051pZZ26EeYyoZBjK1wF7og1emEVIYMEKkBcnv+tl9iHMf2s9+979x3z0+K7Dh2JL///3zcj/eeoQyYr9ryGtFJQ3TYWqrwSzP8vGz5h5SsaPIxbZKhxjrRnVeIGrW6adKEGBoTiP6MH8jSuyx0lZQ8aLCC13cS1cc1Q2oDtKJ9nS4YQwsa4XJgIWs7DF1Ja4RUBpibtZdVeOFYWrxx11wZ9e0jGYCjvrJm6Vd+OkNKCDR3Gjo2SjYoDXvDmVl77pml+6TihwQC9v6HVXty2BsHGgAp3xqqacoPkrLhrA0NB71p2xLQ+qChRVLCZ0Bf0NcASB2mXfOVgsB6zn9/13y75fXeF9DwoeZr2i8cK9wYvtHbGG7pAbh5uK3iF5LyWp+s/pIBOg1DhZSiMjNXtYvdL2yUgM5Y/29Sig5KwX4uBSv4ZSMD8Lz+ZVJiAAt3C8kvrQyg0R8dG1mglQHWdDUvNsr/YSWXOiWAx4gXSImKEi/j49Fo+o8XLgOvlZ7rIk+0YBdXaV3rf8zMlLj+HyYlVipTvNxb4dWiaNm9l+jVXUTT/LNn79a///to8/HxIyoWHPxTZOOY+oXI+w4Qvd71A8EhfBqWH7aN8KDRfv5Xg0KmbOaO2sLG/0Fubw/NtB8POmp1V58Q/X6vbYS7tyg4CmeARPTjp9NH96QkZviltlk6pFMYA7x5hOjEaXeRnhZkhJ9r8ktE0AZAXUekv328fwMnAZQFyRkhWAPMsujvzcsVvheYABlBGsEZACn+/Xk5qT4NyAJfLMjKBsEYAOkeEY+UHzrffUX0208kgikKAIzZL14NJ90P4+z59ghFQkkQbwBE/EfnqXAgm8HYX39J9PQJ5cbQU8PyAin/00vFFD8BQ9fPrrW/a16INABSPQ4MhndFB1kA3zUvxBkgER8HJhbwXT+5RLkgygCJ+EVp9tKAeQ0Mb30jxgAxi5+AxvCtI+QVEQZQ8TdBKfB5HHI3ADrgIo3xJwXzAz77gdwNkIyHlU0wzX3C04xnrgZA01OEqV0XIDB8zA/kZgCkfHxJpT/Tu/wcn1wMAGfnOfkRCsiOrnujXAwQ0jp+3rjOAt4NAOG17o8O5gVc9gLeDaCpPx3oBd5xGDBeDTAreO+eZE4UxQDa9Y8HsoCrLXDeDKDRPxmu1gi8GUCjfzJmHe2N8GIAjf7JcVUGvOwJ9BX9ODWr+ZBEUjkw+alqWDPJ+kwj5waAa31FP87LwyZLaSADHspghQ/nPN7KeDu58xIwG8G+vkFkud1rn4NVU+cGCPEMnqyA+J9nOPG1Z2/2s4JODeAz/UsjET/rU9R3Z3w8nRog1vTvSnyQdRlwaoB9Ee70cSk+CKYEIPVXIjOAa/HBdCgGiC36fYjvAmcGiKn7D1V84MwAsaT/kMUHzgwQw1bv0MUHTgwwvSvsgzIKRRAfODFA0Sd/8hQ/6+sLOcsARSXvyH8cggGKmgEkpP3VjC8noxlgRKSIv5zxfgc1wAhIafhcbHYRe5EoKUjq9v9RA/hF2lAPO56yRg2wDRLH+ZoBPCFR/D/uubmgpBqgB6kzfC7SP1ADdCFVfEz+uLodjRqgg+S5/QcO7zqiBiD5Czu42YQrojeAdPGR+l3eYCJqA4SwpOsy+kG0BghBfNfRD6I0QAjio/N3Hf0gOgOEspMHt5PxcXOp6AyAJdXVHG/RMgpI/b5uQxudARBVVxfk3gncV+pPiLIHkGoCZKarnu8rGO0oQKIJfNX9bqKeB5BkAoif9dU/RiH6mUAJJoD4Put+N7oWQPmaIE/xgRqgQx4myFt8oAbowqcJJIgP1AA9+DCBFPGBGqAPLk0gSXygBtgGFyaQJj5QAwwgSxNIFB+oAYaQhQmkig/UACMwiQkkiw/UACMyjgmkiw/UAClIY4IQxAdqgJSMYoJQxAdqgDEYZIKQxAdqgDHpZ4LQxAdm7qi1lDHYeJnHdQIhSta3VBkGroeETaZ3boUnPnBigNjAFbyfCt9ouh1aAjIgVPFByRCtkBItJWvUABHTRAnw3DYpUjCmbYBlUqKEu/8/NQNEDItfL+0kWiIlSp5z8JdqdbPCI4E6KVHBmjd+rJtmqfPbTVKigkd/1/HYMsAOoprOB8TFeifrtwyAMpA4QomCGtI/nmxMBXMzeE2zQBysG7qSPN8wgGaBSGDxk+hv/9rDmaP2Pk8QzJBSRJo37pj93S9sWQ18YeiUloLiAU059R/rfX2LAZAeuBRcJKVQsPgfd6f+hL77AW7UTY26GgUlcFjLH+pmqf+fBjBXtYu8YnCZlHBh8TmgF7f/8xDOVu1Ja+kbbgzLpAQDaj5KeSubD37fcD6o2krJ0m1+WiElBBpc80/1q/m9jGSABC0JsulE/fVBKb/PZ9KBbMAfWjSWzpEigkT4VZ7NXeIJvZSfHY9WWSCq8j+4wD2CThzlgDGtBZ2bT3kiN63wG/+DMgBmmOLZwxdsCDbFYYtewWq/kBWdCIfADT62y1jL52hfGlf0bv4H4emQh2jTz1sAAAAASUVORK5CYII=',
  // Phantom - official logo with rounded corners
  'Phantom': 'data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0idXRmLTgiPz4KPHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMjgiIGhlaWdodD0iMTI4IiB2aWV3Qm94PSIwIDAgMTI4IDEyOCIgZmlsbD0ibm9uZSI+CjxyZWN0IHdpZHRoPSIxMjgiIGhlaWdodD0iMTI4IiByeD0iMjYiIGZpbGw9IiNBQjlGRjIiLz4KPHBhdGggZmlsbC1ydWxlPSJldmVub2RkIiBjbGlwLXJ1bGU9ImV2ZW5vZGQiIGQ9Ik01NS42NDE2IDgyLjE0NzdDNTAuODc0NCA4OS40NTI1IDQyLjg4NjIgOTguNjk2NiAzMi4yNTY4IDk4LjY5NjZDMjcuMjMyIDk4LjY5NjYgMjIuNDAwNCA5Ni42MjggMjIuNDAwNCA4Ny42NDI0QzIyLjQwMDQgNjQuNzU4NCA1My42NDQ1IDI5LjMzMzUgODIuNjMzOSAyOS4zMzM1Qzk5LjEyNTcgMjkuMzMzNSAxMDUuNjk3IDQwLjc3NTUgMTA1LjY5NyA1My43Njg5QzEwNS42OTcgNzAuNDQ3MSA5NC44NzM5IDg5LjUxNzEgODQuMTE1NiA4OS41MTcxQzgwLjcwMTMgODkuNTE3MSA3OS4wMjY0IDg3LjY0MjQgNzkuMDI2NCA4NC42Njg4Qzc5LjAyNjQgODMuODkzMSA3OS4xNTUyIDgzLjA1MjcgNzkuNDEyOSA4Mi4xNDc3Qzc1Ljc0MDkgODguNDE4MiA2OC42NTQ2IDk0LjIzNjEgNjIuMDE5MiA5NC4yMzYxQzU3LjE4NzcgOTQuMjM2MSA1NC43Mzk3IDkxLjE5NzkgNTQuNzM5NyA4Ni45MzE0QzU0LjczOTcgODUuMzc5OSA1NS4wNjE4IDgzLjc2MzggNTUuNjQxNiA4Mi4xNDc3Wk04MC42MTMzIDUzLjMxODJDODAuNjEzMyA1Ny4xMDQ0IDc4LjM3OTUgNTguOTk3NSA3NS44ODA2IDU4Ljk5NzVDNzMuMzQzOCA1OC45OTc1IDcxLjE0NzkgNTcuMTA0NCA3MS4xNDc5IDUzLjMxODJDNzEuMTQ3OSA0OS41MzIgNzMuMzQzOCA0Ny42Mzg5IDc1Ljg4MDYgNDcuNjM4OUM3OC4zNzk1IDQ3LjYzODkgODAuNjEzMyA0OS41MzIgODAuNjEzMyA1My4zMTgyWk05NC44MTAyIDUzLjMxODRDOTQuODEwMiA1Ny4xMDQ2IDkyLjU3NjMgNTguOTk3NyA5MC4wNzc1IDU4Ljk5NzdDODcuNTQwNyA1OC45OTc3IDg1LjM0NDcgNTcuMTA0NiA4NS4zNDQ3IDUzLjMxODRDODUuMzQ0NyA0OS41MzIzIDg3LjU0MDcgNDcuNjM5MiA5MC4wNzc1IDQ3LjYzOTJDOTIuNTc2MyA0Ny42MzkyIDk0LjgxMDIgNDkuNTMyMyA5NC44MTAyIDUzLjMxODRaIiBmaWxsPSIjRkZGREY4Ii8+Cjwvc3ZnPg==',
  'Phantom (Solana)': 'data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0idXRmLTgiPz4KPHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMjgiIGhlaWdodD0iMTI4IiB2aWV3Qm94PSIwIDAgMTI4IDEyOCIgZmlsbD0ibm9uZSI+CjxyZWN0IHdpZHRoPSIxMjgiIGhlaWdodD0iMTI4IiByeD0iMjYiIGZpbGw9IiNBQjlGRjIiLz4KPHBhdGggZmlsbC1ydWxlPSJldmVub2RkIiBjbGlwLXJ1bGU9ImV2ZW5vZGQiIGQ9Ik01NS42NDE2IDgyLjE0NzdDNTAuODc0NCA4OS40NTI1IDQyLjg4NjIgOTguNjk2NiAzMi4yNTY4IDk4LjY5NjZDMjcuMjMyIDk4LjY5NjYgMjIuNDAwNCA5Ni42MjggMjIuNDAwNCA4Ny42NDI0QzIyLjQwMDQgNjQuNzU4NCA1My42NDQ1IDI5LjMzMzUgODIuNjMzOSAyOS4zMzM1Qzk5LjEyNTcgMjkuMzMzNSAxMDUuNjk3IDQwLjc3NTUgMTA1LjY5NyA1My43Njg5QzEwNS42OTcgNzAuNDQ3MSA5NC44NzM5IDg5LjUxNzEgODQuMTE1NiA4OS41MTcxQzgwLjcwMTMgODkuNTE3MSA3OS4wMjY0IDg3LjY0MjQgNzkuMDI2NCA4NC42Njg4Qzc5LjAyNjQgODMuODkzMSA3OS4xNTUyIDgzLjA1MjcgNzkuNDEyOSA4Mi4xNDc3Qzc1Ljc0MDkgODguNDE4MiA2OC42NTQ2IDk0LjIzNjEgNjIuMDE5MiA5NC4yMzYxQzU3LjE4NzcgOTQuMjM2MSA1NC43Mzk3IDkxLjE5NzkgNTQuNzM5NyA4Ni45MzE0QzU0LjczOTcgODUuMzc5OSA1NS4wNjE4IDgzLjc2MzggNTUuNjQxNiA4Mi4xNDc3Wk04MC42MTMzIDUzLjMxODJDODAuNjEzMyA1Ny4xMDQ0IDc4LjM3OTUgNTguOTk3NSA3NS44ODA2IDU4Ljk5NzVDNzMuMzQzOCA1OC45OTc1IDcxLjE0NzkgNTcuMTA0NCA3MS4xNDc5IDUzLjMxODJDNzEuMTQ3OSA0OS41MzIgNzMuMzQzOCA0Ny42Mzg5IDc1Ljg4MDYgNDcuNjM4OUM3OC4zNzk1IDQ3LjYzODkgODAuNjEzMyA0OS41MzIgODAuNjEzMyA1My4zMTgyWk05NC44MTAyIDUzLjMxODRDOTQuODEwMiA1Ny4xMDQ2IDkyLjU3NjMgNTguOTk3NyA5MC4wNzc1IDU4Ljk5NzdDODcuNTQwNyA1OC45OTc3IDg1LjM0NDcgNTcuMTA0NiA4NS4zNDQ3IDUzLjMxODRDODUuMzQ0NyA0OS41MzIzIDg3LjU0MDcgNDcuNjM5MiA5MC4wNzc1IDQ3LjYzOTJDOTIuNTc2MyA0Ny42MzkyIDk0LjgxMDIgNDkuNTMyMyA5NC44MTAyIDUzLjMxODRaIiBmaWxsPSIjRkZGREY4Ii8+Cjwvc3ZnPg==',
};

// Helper to get wallet icon
export const getWalletIcon = (walletName: string, fallbackIcon?: string): string => {
  return WALLET_ICONS[walletName] || WALLET_ICONS[walletName.replace(' (Solana)', '').replace(' (Ethereum)', '')] || fallbackIcon || '';
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

// Aptos Connect Button for social login
function AptosConnectButton({
  wallet,
  onConnect,
  connecting,
}: {
  wallet: AdapterWallet;
  onConnect: () => void;
  connecting: boolean;
}) {
  const isGoogle = wallet.name.toLowerCase().includes('google');
  const isApple = wallet.name.toLowerCase().includes('apple');

  return (
    <button
      onClick={onConnect}
      disabled={connecting}
      className="w-full flex items-center justify-center gap-3 p-3 bg-white hover:bg-gray-100 rounded-xl transition-colors disabled:opacity-50 border border-gray-200"
    >
      {isGoogle && <GoogleIcon />}
      {isApple && <AppleIcon />}
      <span className="text-gray-900 font-medium">
        {isGoogle ? 'Continue with Google' : isApple ? 'Continue with Apple' : wallet.name}
      </span>
      {connecting && <Loader2 size={18} className="text-gray-500 animate-spin" />}
    </button>
  );
}

// Regular wallet button
function WalletButton({
  wallet,
  onConnect,
  connecting,
  isInstalled,
}: {
  wallet: AdapterWallet | AdapterNotDetectedWallet;
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
        <span className="px-3 py-1.5 bg-[#60a5fa] hover:bg-[#3b82f6] text-white text-sm font-medium rounded-lg">
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

// Clear Aptos Connect cached state (useful when having auth issues)
const clearAptosConnectCache = () => {
  const keysToRemove = [
    '@aptos-connect/connectedAccount',
    '@aptos-connect/dapp-local-state',
    '@aptos-connect/client-identity-key',
  ];
  keysToRemove.forEach(key => {
    try {
      localStorage.removeItem(key);
    } catch (e) {
      console.warn(`Failed to remove ${key}:`, e);
    }
  });
  console.log('[WalletSelector] Cleared Aptos Connect cache');
};

export function WalletSelector({ isOpen, onClose }: WalletSelectorProps) {
  const { wallets, notDetectedWallets = [], connect, connected } = useWallet();
  const [connectingWallet, setConnectingWallet] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showTroubleshooting, setShowTroubleshooting] = useState(false);
  const connectingWalletRef = useRef<string | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Check if on mobile
  const isMobile = useMemo(() => isMobileDevice(), []);
  const petraDeepLink = useMemo(() => getPetraDeepLink(), []);

  // Close modal when connected and clear timeout
  useEffect(() => {
    if (connected && isOpen) {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      connectingWalletRef.current = null;
      onClose();
    }
  }, [connected, isOpen, onClose]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  // Use the official groupAndSortWallets function from wallet adapter
  // Important: Pass both wallets and notDetectedWallets for proper grouping
  const { petraWebWallets, availableWallets, installableWallets } = groupAndSortWallets(
    [...(wallets || []), ...notDetectedWallets]
  );

  // Debug: Log available wallets with full details
  console.log('[WalletSelector] petraWebWallets:', petraWebWallets.map(w => ({ name: w.name, url: w.url })));
  console.log('[WalletSelector] availableWallets:', availableWallets.map(w => ({ name: w.name, url: w.url })));
  console.log('[WalletSelector] installableWallets:', installableWallets.map(w => w.name));
  console.log('[WalletSelector] raw wallets from useWallet:', wallets?.map(w => ({ name: w.name, url: w.url })));
  console.log('[WalletSelector] notDetectedWallets:', notDetectedWallets?.map(w => ({ name: w.name, url: w.url })));

  // Separate cross-chain wallets (Solana/Ethereum) from Aptos wallets
  const aptosWallets = availableWallets.filter(w =>
    !w.name.includes('Solana') && !w.name.includes('Ethereum')
  );
  const solanaWallets = availableWallets.filter(w => w.name.includes('Solana'));
  const ethereumWallets = availableWallets.filter(w => w.name.includes('Ethereum'));

  const aptosInstallable = installableWallets.filter(w =>
    !w.name.includes('Solana') && !w.name.includes('Ethereum')
  );
  const solanaInstallable = installableWallets.filter(w => w.name.includes('Solana'));
  const ethereumInstallable = installableWallets.filter(w => w.name.includes('Ethereum'));

  // IMPORTANT: Safari blocks popups if there's ANY async operation between
  // the user click and window.open(). We must call connect() IMMEDIATELY
  // without any state updates first to prevent popup blocking.
  // The connect() function returns void - async handling is internal.
  // Errors are handled via the onError callback in the provider.
  const handleConnect = (walletName: string) => {
    // Clear any previous error
    setError(null);
    setShowTroubleshooting(false);

    // Find the wallet object for more detailed logging
    const targetWallet = [...petraWebWallets, ...availableWallets].find(w => w.name === walletName);
    console.log('[WalletSelector] Attempting to connect:', walletName);
    console.log('[WalletSelector] Wallet details:', targetWallet ? { name: targetWallet.name, url: targetWallet.url, readyState: targetWallet.readyState } : 'NOT FOUND');

    // Call connect IMMEDIATELY - this must be the first thing that happens
    // after the user click to prevent Safari popup blocking
    try {
      connect(walletName);
      console.log('[WalletSelector] connect() called successfully');
    } catch (err) {
      console.error('[WalletSelector] connect() threw:', err);
      setError(err instanceof Error ? err.message : 'Connection failed');
      return;
    }

    // Now we can safely update UI state
    setConnectingWallet(walletName);
    connectingWalletRef.current = walletName;

    // Clear any existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // For Aptos Connect (Google/Apple), show a helpful message after timeout
    // since blank screen issues are common with rate limiting
    const isAptosConnect = walletName.toLowerCase().includes('google') ||
                           walletName.toLowerCase().includes('apple');

    timeoutRef.current = setTimeout(() => {
      // Use ref to get current connecting wallet (avoids stale closure)
      if (connectingWalletRef.current === walletName) {
        setConnectingWallet(null);
        connectingWalletRef.current = null;
        if (isAptosConnect) {
          setError('Login timed out. If you see a blank popup, the service may be temporarily rate-limited. Try again in a few minutes or use a different wallet.');
          setShowTroubleshooting(true);
        }
      }
    }, isAptosConnect ? 30000 : 15000); // 30s for Aptos Connect, 15s for others
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
            <div className="absolute inset-0 overflow-hidden">
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[300px] h-[150px] bg-gradient-to-b from-[#60a5fa]/20 via-[#22c55e]/10 to-transparent rounded-full blur-3xl" />
            </div>

            <button
              onClick={onClose}
              className="absolute top-4 right-4 p-2 hover:bg-[#2a3d4e] rounded-lg transition-colors"
            >
              <X size={20} color="#8297a3" />
            </button>

            <div className="relative text-center mb-2">
              <h2 className="text-xl font-bold text-white">Connect to Polymarket</h2>
              <p className="text-[#8297a3] text-sm mt-2">
                Sign in with your social account or connect a wallet
              </p>
            </div>
          </div>

          {/* Error Message with Troubleshooting */}
          {error && (
            <div className="px-6 mb-4">
              <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                <p className="text-red-400 text-sm">{error}</p>
                <button
                  onClick={() => setShowTroubleshooting(!showTroubleshooting)}
                  className="text-xs text-red-300 underline mt-2"
                >
                  {showTroubleshooting ? 'Hide troubleshooting' : 'Having issues? Click here'}
                </button>
                {showTroubleshooting && (
                  <div className="mt-3 space-y-2">
                    <p className="text-xs text-gray-400">Try these steps:</p>
                    <ol className="text-xs text-gray-400 list-decimal ml-4 space-y-1">
                      <li>Make sure popups are allowed for this site</li>
                      <li>Clear the connection cache below and try again</li>
                      <li>Try a different browser or incognito mode</li>
                    </ol>
                    <button
                      onClick={() => {
                        clearAptosConnectCache();
                        setError(null);
                        setConnectingWallet(null);
                      }}
                      className="mt-2 px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-300 text-xs rounded-lg transition-colors"
                    >
                      Clear Cache & Retry
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Wallet List */}
          <div className="px-6 pb-6 max-h-[400px] overflow-y-auto">
            <div className="space-y-3">
              {/* Social Login (Aptos Connect) */}
              {petraWebWallets.length > 0 && (
                <div className="space-y-2">
                  <div className="text-[10px] text-[#6b7a8a] uppercase tracking-wider mb-2">
                    Quick Sign In
                  </div>
                  {petraWebWallets.map(wallet => (
                    <AptosConnectButton
                      key={wallet.name}
                      wallet={wallet}
                      onConnect={() => handleConnect(wallet.name)}
                      connecting={connectingWallet === wallet.name}
                    />
                  ))}

                  <div className="flex items-center gap-3 py-2">
                    <div className="flex-1 h-px bg-[#3a4f60]" />
                    <span className="text-xs text-[#6b7a8a]">or connect wallet</span>
                    <div className="flex-1 h-px bg-[#3a4f60]" />
                  </div>
                </div>
              )}

              {/* Petra Mobile Deep Link - Show on mobile or always as option */}
              {isMobile && (
                <div className="space-y-2">
                  <div className="text-[10px] text-[#6b7a8a] uppercase tracking-wider mb-2">
                    Mobile Wallet
                  </div>
                  <a
                    href={petraDeepLink}
                    className="w-full flex items-center gap-3 p-3 bg-[#6C5CE7] hover:bg-[#5B4ED6] rounded-xl transition-colors"
                  >
                    <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                      <Smartphone size={20} className="text-white" />
                    </div>
                    <div className="flex-1 text-left">
                      <span className="text-white font-medium">Open in Petra App</span>
                      <p className="text-white/70 text-xs">Continue in Petra mobile wallet</p>
                    </div>
                    <ExternalLink size={16} className="text-white/70" />
                  </a>

                  <div className="flex items-center gap-3 py-2">
                    <div className="flex-1 h-px bg-[#3a4f60]" />
                    <span className="text-xs text-[#6b7a8a]">or use browser wallet</span>
                    <div className="flex-1 h-px bg-[#3a4f60]" />
                  </div>
                </div>
              )}

              {/* Aptos Wallets */}
              {aptosWallets.length > 0 && (
                <div className="space-y-2">
                  <div className="text-[10px] text-[#6b7a8a] uppercase tracking-wider">
                    Aptos Wallets
                  </div>
                  {aptosWallets.map(wallet => (
                    <WalletButton
                      key={wallet.name}
                      wallet={wallet}
                      onConnect={() => handleConnect(wallet.name)}
                      connecting={connectingWallet === wallet.name}
                      isInstalled={true}
                    />
                  ))}
                </div>
              )}

              {/* Solana Wallets (X-Chain) */}
              {solanaWallets.length > 0 && (
                <div className="space-y-2">
                  <div className="text-[10px] text-[#6b7a8a] uppercase tracking-wider flex items-center gap-2">
                    Solana Wallets
                    <span className="px-1.5 py-0.5 bg-orange-500/20 text-orange-400 text-[8px] rounded">X-CHAIN</span>
                  </div>
                  {solanaWallets.map(wallet => (
                    <WalletButton
                      key={wallet.name}
                      wallet={wallet}
                      onConnect={() => handleConnect(wallet.name)}
                      connecting={connectingWallet === wallet.name}
                      isInstalled={true}
                    />
                  ))}
                </div>
              )}

              {/* Ethereum Wallets (X-Chain) */}
              {ethereumWallets.length > 0 && (
                <div className="space-y-2">
                  <div className="text-[10px] text-[#6b7a8a] uppercase tracking-wider flex items-center gap-2">
                    Ethereum Wallets
                    <span className="px-1.5 py-0.5 bg-orange-500/20 text-orange-400 text-[8px] rounded">X-CHAIN</span>
                  </div>
                  {ethereumWallets.map(wallet => (
                    <WalletButton
                      key={wallet.name}
                      wallet={wallet}
                      onConnect={() => handleConnect(wallet.name)}
                      connecting={connectingWallet === wallet.name}
                      isInstalled={true}
                    />
                  ))}
                </div>
              )}

              {/* Installable Wallets */}
              {(aptosInstallable.length > 0 || solanaInstallable.length > 0 || ethereumInstallable.length > 0) && (
                <div className="space-y-2 pt-2">
                  <div className="text-[10px] text-[#6b7a8a] uppercase tracking-wider">
                    Available to Install
                  </div>
                  {[...aptosInstallable, ...solanaInstallable, ...ethereumInstallable].slice(0, 4).map(wallet => (
                    <WalletButton
                      key={wallet.name}
                      wallet={wallet}
                      onConnect={() => handleConnect(wallet.name)}
                      connecting={connectingWallet === wallet.name}
                      isInstalled={false}
                    />
                  ))}
                </div>
              )}

              {/* Empty state */}
              {petraWebWallets.length === 0 && availableWallets.length === 0 && installableWallets.length === 0 && (
                <div className="text-center py-8 text-[#6b7a8a]">
                  No wallets available
                </div>
              )}
            </div>
          </div>

          {/* Footer with Aptos Connect link */}
          {petraWebWallets.length > 0 && (
            <div className="px-6 py-3 border-t border-[#3a4f60] bg-[#1c2b3a]/50">
              <a
                href={APTOS_CONNECT_ACCOUNT_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-[#60a5fa] hover:text-[#3b82f6] flex items-center justify-center gap-1"
              >
                Learn more about Aptos Connect
                <ExternalLink size={10} />
              </a>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

export default WalletSelector;
