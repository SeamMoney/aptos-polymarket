import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import './index.css';
import App from './App';
import { DemoMode, DemoMarketPage } from './components';
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
            <Route path="/demo-day" element={<DemoMarketPage />} />
          </Routes>
        </WalletProvider>
      </NetworkProvider>
    </BrowserRouter>
  </StrictMode>
);
