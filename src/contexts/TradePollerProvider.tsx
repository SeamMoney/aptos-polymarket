/**
 * TradePollerProvider - Wraps the app and polls trades for all markets in background
 *
 * This ensures trades are captured for all markets regardless of which page
 * the user is viewing. When they navigate to a market, trades are already there.
 */

import type { ReactNode } from 'react';
import { useMultiMarkets } from '../hooks/useMultiMarkets';
import { BackgroundTradePoller } from '../components/BackgroundTradePoller';

interface TradePollerProviderProps {
  children: ReactNode;
}

export function TradePollerProvider({ children }: TradePollerProviderProps) {
  // Get all market addresses
  const { markets } = useMultiMarkets();

  // Extract just the addresses
  const marketAddresses = markets.map(m => m.address);

  return (
    <>
      {/* Background poller runs silently */}
      <BackgroundTradePoller
        marketAddresses={marketAddresses}
        enabled={marketAddresses.length > 0}
      />
      {children}
    </>
  );
}
