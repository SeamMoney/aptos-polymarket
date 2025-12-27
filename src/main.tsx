import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';
import { NetworkProvider } from './contexts/NetworkContext';
import { WalletProvider } from './contexts/WalletContext';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <NetworkProvider>
      <WalletProvider>
        <App />
      </WalletProvider>
    </NetworkProvider>
  </StrictMode>
);
