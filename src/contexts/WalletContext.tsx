import { type ReactNode, useEffect } from 'react';
import { AptosWalletAdapterProvider, type DappConfig } from '@aptos-labs/wallet-adapter-react';
import { Network } from '@aptos-labs/ts-sdk';
import { setupAutomaticEthereumWalletDerivation } from '@aptos-labs/derived-wallet-ethereum';
import { setupAutomaticSolanaWalletDerivation } from '@aptos-labs/derived-wallet-solana';

// Initialize X-Chain wallet derivation at module level
// This allows Phantom, MetaMask, Rainbow, etc. to derive Aptos accounts
setupAutomaticEthereumWalletDerivation({ defaultNetwork: Network.TESTNET });
setupAutomaticSolanaWalletDerivation({ defaultNetwork: Network.TESTNET });

// Detect iOS Safari
const isIOSSafari = () => {
  if (typeof window === 'undefined') return false;
  const ua = navigator.userAgent;
  const isIOS = /iPad|iPhone|iPod/.test(ua);
  const isWebkit = /WebKit/.test(ua);
  const isChrome = /CriOS/.test(ua);
  const isFirefox = /FxiOS/.test(ua);
  return isIOS && isWebkit && !isChrome && !isFirefox;
};

// Open Petra URL in popup with controlled height
const openPetraPopup = (url: string): boolean => {
  // Calculate popup dimensions - shorter height to avoid Safari toolbar cutoff
  const width = Math.min(420, window.screen.width - 40);
  const height = Math.min(600, window.screen.height - 200); // Shorter height for Safari
  const left = (window.screen.width - width) / 2;
  const top = 50; // Start from top to maximize visible area

  const popup = window.open(
    url,
    'petra_wallet',
    `width=${width},height=${height},left=${left},top=${top},scrollbars=yes,resizable=yes,toolbar=no,menubar=no`
  );

  if (popup) {
    popup.focus();
    return true;
  }
  return false;
};

// Check if URL is a Petra/AptosConnect URL
const isPetraUrl = (url: string): boolean => {
  return url.includes('web.petra.app') || url.includes('aptosconnect.app');
};

// Setup redirect interceptor for iOS Safari to open Petra in popup with controlled height
const setupPetraRedirectInterceptor = () => {
  if (typeof window === 'undefined' || !isIOSSafari()) return;

  const originalAssign = window.location.assign.bind(window.location);
  const originalReplace = window.location.replace.bind(window.location);

  // Override location.assign
  window.location.assign = function(url: string) {
    if (isPetraUrl(url) && openPetraPopup(url)) {
      return; // Intercepted, don't navigate
    }
    originalAssign(url);
  };

  // Override location.replace
  window.location.replace = function(url: string) {
    if (isPetraUrl(url) && openPetraPopup(url)) {
      return; // Intercepted, don't navigate
    }
    originalReplace(url);
  };

  // Intercept link clicks to Petra URLs
  document.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    const link = target.closest('a');
    if (link && link.href && isPetraUrl(link.href)) {
      e.preventDefault();
      e.stopPropagation();
      openPetraPopup(link.href);
    }
  }, true); // Use capture phase

  // Intercept form submissions to Petra URLs
  document.addEventListener('submit', (e) => {
    const form = e.target as HTMLFormElement;
    if (form.action && isPetraUrl(form.action)) {
      e.preventDefault();
      e.stopPropagation();
      // For form submissions, construct URL with form data
      const formData = new FormData(form);
      const params = new URLSearchParams(formData as unknown as Record<string, string>);
      const url = `${form.action}?${params.toString()}`;
      openPetraPopup(url);
    }
  }, true);

  // Also try to intercept programmatic navigation by patching history
  const originalPushState = history.pushState.bind(history);
  const originalReplaceState = history.replaceState.bind(history);

  history.pushState = function(...args) {
    const url = args[2];
    if (typeof url === 'string' && isPetraUrl(url)) {
      openPetraPopup(url);
      return;
    }
    return originalPushState(...args);
  };

  history.replaceState = function(...args) {
    const url = args[2];
    if (typeof url === 'string' && isPetraUrl(url)) {
      openPetraPopup(url);
      return;
    }
    return originalReplaceState(...args);
  };

  console.log('[WalletContext] iOS Safari Petra popup interceptor enabled');
};

// Get dapp image URI for Aptos Connect
const getDappImageURI = () => {
  if (typeof window !== 'undefined') {
    return `${window.location.origin}/favicon.ico`;
  }
  return undefined;
};

interface WalletProviderProps {
  children: ReactNode;
}

export function WalletProvider({ children }: WalletProviderProps) {
  // Setup iOS Safari redirect interceptor on mount
  useEffect(() => {
    setupPetraRedirectInterceptor();
  }, []);

  const dappConfig: DappConfig = {
    network: Network.TESTNET,
    aptosApiKeys: {
      testnet: import.meta.env.VITE_APTOS_API_KEY_TESTNET,
      devnet: import.meta.env.VITE_APTOS_API_KEY_DEVNET,
      mainnet: import.meta.env.VITE_APTOS_API_KEY_MAINNET,
    },
    // Enable cross-chain wallets (Phantom Solana, MetaMask Ethereum, etc.)
    crossChainWallets: true,
    // Aptos Connect configuration for keyless wallets (Google/Apple login)
    // Using the official example dappId that is confirmed working
    aptosConnect: {
      dappId: '57fa42a9-29c6-4f1e-939c-4eefa36d9ff5',
      dappImageURI: getDappImageURI(),
    },
  };

  return (
    <AptosWalletAdapterProvider
      autoConnect={true}
      dappConfig={dappConfig}
      onError={(error: unknown) => {
        console.error('Wallet adapter error:', error);
        if (error instanceof Error) {
          console.error('Error details:', error.message, error.stack);
        }
      }}
    >
      {children}
    </AptosWalletAdapterProvider>
  );
}
