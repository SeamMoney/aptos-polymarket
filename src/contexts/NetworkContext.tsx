import { createContext, useContext, useState, useMemo, type ReactNode } from 'react';
import { Aptos, AptosConfig, Network } from '@aptos-labs/ts-sdk';

type NetworkType = 'devnet' | 'testnet' | 'mainnet';

interface NetworkContextType {
  network: NetworkType;
  setNetwork: (network: NetworkType) => void;
  aptosClient: Aptos;
  networkConfig: {
    name: string;
    network: Network;
    explorerUrl: string;
  };
}

const NETWORK_CONFIGS = {
  devnet: {
    name: 'Devnet',
    network: Network.DEVNET,
    explorerUrl: 'https://explorer.aptoslabs.com/?network=devnet',
  },
  testnet: {
    name: 'Testnet',
    network: Network.TESTNET,
    explorerUrl: 'https://explorer.aptoslabs.com/?network=testnet',
  },
  mainnet: {
    name: 'Mainnet',
    network: Network.MAINNET,
    explorerUrl: 'https://explorer.aptoslabs.com/?network=mainnet',
  },
} as const;

const NetworkContext = createContext<NetworkContextType | undefined>(undefined);

export function NetworkProvider({ children }: { children: ReactNode }) {
  const [network, setNetwork] = useState<NetworkType>('testnet');

  const networkConfig = NETWORK_CONFIGS[network];

  const aptosClient = useMemo(() => {
    const config = new AptosConfig({ network: networkConfig.network });
    return new Aptos(config);
  }, [networkConfig.network]);

  return (
    <NetworkContext.Provider
      value={{
        network,
        setNetwork,
        aptosClient,
        networkConfig,
      }}
    >
      {children}
    </NetworkContext.Provider>
  );
}

export function useNetwork() {
  const context = useContext(NetworkContext);
  if (!context) {
    throw new Error('useNetwork must be used within a NetworkProvider');
  }
  return context;
}

export function useAptosClient() {
  const { aptosClient } = useNetwork();
  return aptosClient;
}
