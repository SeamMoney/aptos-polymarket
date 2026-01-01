import { type ReactNode } from 'react';
import { AptosWalletAdapterProvider } from '@aptos-labs/wallet-adapter-react';
import { Network } from '@aptos-labs/ts-sdk';
import { setupAutomaticEthereumWalletDerivation } from '@aptos-labs/derived-wallet-ethereum';
import { setupAutomaticSolanaWalletDerivation } from '@aptos-labs/derived-wallet-solana';

// Initialize X-Chain wallet derivation at module level
// This allows Phantom, MetaMask, Rainbow, etc. to derive Aptos accounts
setupAutomaticEthereumWalletDerivation({ defaultNetwork: Network.TESTNET });
setupAutomaticSolanaWalletDerivation({ defaultNetwork: Network.TESTNET });

interface WalletProviderProps {
  children: ReactNode;
}

export function WalletProvider({ children }: WalletProviderProps) {
  return (
    <AptosWalletAdapterProvider
      autoConnect={true}
      dappConfig={{
        network: Network.TESTNET,
        aptosApiKeys: {
          testnet: import.meta.env.VITE_APTOS_API_KEY_TESTNET,
          devnet: import.meta.env.VITE_APTOS_API_KEY_DEVNET,
          mainnet: import.meta.env.VITE_APTOS_API_KEY_MAINNET,
        },
        crossChainWallets: true,
        // Aptos Connect configuration for keyless wallets (Google/Apple login)
        aptosConnect: {
          dappId: 'aptos-polymarket',
          dappName: 'Polymarket',
        },
      }}
      onError={(error: unknown) => {
        console.error('Wallet adapter error:', error);
      }}
    >
      {children}
    </AptosWalletAdapterProvider>
  );
}
