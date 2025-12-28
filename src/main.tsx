import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import './index.css';
import App from './App';
import { DemoMode } from './components';
import { NetworkProvider } from './contexts/NetworkContext';
import { WalletProvider } from './contexts/WalletContext';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <NetworkProvider>
        <WalletProvider>
          <Routes>
            <Route path="/" element={<App />} />
            <Route path="/demo" element={<DemoMode />} />
          </Routes>
        </WalletProvider>
      </NetworkProvider>
    </BrowserRouter>
  </StrictMode>
);
