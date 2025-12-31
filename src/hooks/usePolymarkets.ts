import { useMemo, useCallback } from 'react';
import { useWallet } from '@aptos-labs/wallet-adapter-react';
import { useMarkets } from './useMarkets';
import type { OnChainMarket } from './useMarkets';
import { useMultiMarkets } from './useMultiMarkets';
import type { Market, Category, Outcome } from '../polymarket/types';

// Outcome colors for multi-outcome markets
const OUTCOME_COLORS = [
  '#00c853', '#5b9cf6', '#f5a623', '#00bcd4', '#ef4444',
  '#a855f7', '#ec4899', '#14b8a6', '#f97316', '#6366f1',
];

// Category images (placeholder gradients or stock images)
const CATEGORY_IMAGES: Record<string, string> = {
  Politics: 'https://images.unsplash.com/photo-1540910419892-4a36d2c3266c?w=200',
  Crypto: 'https://images.unsplash.com/photo-1518546305927-5a555bb7020d?w=200',
  Sports: 'https://images.unsplash.com/photo-1546519638-68e109498ffc?w=200',
  Business: 'https://images.unsplash.com/photo-1491933382434-500287f9b54b?w=200',
  Science: 'https://images.unsplash.com/photo-1635070041078-e363dbe005cb?w=200',
  Culture: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=200',
  World: 'https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?w=200',
  default: 'https://images.unsplash.com/photo-1526304640581-d334cdbbf45e?w=200',
};

// Format volume for display
function formatVolume(collateral: number): string {
  if (collateral >= 1_000_000) {
    return `$${(collateral).toFixed(1)}M`;
  } else if (collateral >= 1_000) {
    return `$${(collateral / 1_000).toFixed(1)}K`;
  } else {
    return `$${collateral.toFixed(2)}`;
  }
}

// Format date for display
function formatEndDate(timestamp: number): string {
  if (timestamp === 0) return 'TBD';
  const date = new Date(timestamp * 1000);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// Map on-chain category to Polymarket category
function mapCategory(category: string): Category {
  const normalized = category.toLowerCase();
  if (normalized.includes('politic')) return 'Politics';
  if (normalized.includes('crypto') || normalized.includes('bitcoin') || normalized.includes('blockchain')) return 'Crypto';
  if (normalized.includes('sport')) return 'Sports';
  if (normalized.includes('business') || normalized.includes('finance')) return 'Business';
  if (normalized.includes('science') || normalized.includes('tech')) return 'Science';
  if (normalized.includes('culture') || normalized.includes('entertainment')) return 'Culture';
  if (normalized.includes('world') || normalized.includes('global')) return 'World';
  return 'All';
}

// Get image for a category
function getCategoryImage(category: string): string {
  const mapped = mapCategory(category);
  return CATEGORY_IMAGES[mapped] || CATEGORY_IMAGES.default;
}

export interface PolymarketsHook {
  markets: Market[];
  loading: boolean;
  error: string | null;
  refresh: () => void;
  // Trading functions
  buyYes: (marketId: string, amountAPT: string) => Promise<any>;
  buyNo: (marketId: string, amountAPT: string) => Promise<any>;
  sellYes: (marketId: string, amount: string) => Promise<any>;
  sellNo: (marketId: string, amount: string) => Promise<any>;
  buyOutcome: (marketId: string, outcomeIndex: number, amountAPT: string) => Promise<any>;
  sellOutcome: (marketId: string, outcomeIndex: number, amount: string) => Promise<any>;
  // Get market by ID
  getMarket: (id: string) => Market | undefined;
  // Raw on-chain data for advanced use
  binaryMarkets: OnChainMarket[];
  multiMarkets: any[];
}

export function usePolymarkets(): PolymarketsHook {
  const { signAndSubmitTransaction, account } = useWallet();
  const walletAddress = account?.address?.toString();

  const {
    markets: binaryMarkets,
    loading: binaryLoading,
    error: binaryError,
    refetch: refetchBinary
  } = useMarkets();

  const {
    markets: multiMarkets,
    loading: multiLoading,
    error: multiError,
    refresh: refreshMulti,
    buyOutcome: buyOutcomePayload,
    sellOutcome: sellOutcomePayload,
  } = useMultiMarkets();

  // Convert binary markets to Polymarket format
  const convertedBinaryMarkets: Market[] = useMemo(() => {
    return binaryMarkets.map((market, index) => ({
      id: `binary-${market.address}`,
      question: market.question,
      image: getCategoryImage(market.description),
      yesPrice: market.yesPrice / 100,
      noPrice: market.noPrice / 100,
      volume: formatVolume((market.yesReserve + market.noReserve) / 100_000_000),
      liquidity: formatVolume((market.yesReserve + market.noReserve) / 100_000_000 / 2),
      category: mapCategory(market.description),
      endDate: formatEndDate(market.endTime),
      createdAt: new Date().toLocaleDateString(),
      resolver: market.creator || market.address.slice(0, 12) + '...',
      isNew: index < 2, // First 2 are "new"
      isTrending: market.yesReserve + market.noReserve > 100_000_000, // High volume = trending
      isMultiOutcome: false,
    }));
  }, [binaryMarkets]);

  // Convert multi-outcome markets to Polymarket format
  // Filter duplicates by question, keeping the one with highest volume
  const convertedMultiMarkets: Market[] = useMemo(() => {
    // First, deduplicate by question - keep highest volume
    const deduped = multiMarkets.reduce((acc, market) => {
      const existing = acc.find(m => m.question === market.question);
      if (!existing) {
        acc.push(market);
      } else if (market.totalCollateral > existing.totalCollateral) {
        // Replace with higher volume market
        const idx = acc.indexOf(existing);
        acc[idx] = market;
      }
      return acc;
    }, [] as typeof multiMarkets);

    return deduped.map((market, index) => {
      const outcomes: Outcome[] = market.outcomes.map((outcome: any, i: number) => ({
        id: `${market.address}-${outcome.index}`,
        name: outcome.label,
        price: outcome.price / 100, // Normalize to 0-1
        volume: formatVolume(market.totalCollateral / market.outcomeCount),
        color: OUTCOME_COLORS[i % OUTCOME_COLORS.length],
      }));

      // For multi-outcome, use highest probability as yesPrice
      const maxPrice = Math.max(...market.outcomes.map((o: any) => o.price));

      return {
        id: `multi-${market.address}`,
        question: market.question,
        image: getCategoryImage(market.category),
        yesPrice: maxPrice / 100,
        noPrice: (100 - maxPrice) / 100,
        volume: formatVolume(market.totalCollateral),
        liquidity: formatVolume(market.totalCollateral / 2),
        category: mapCategory(market.category),
        endDate: formatEndDate(market.endTime),
        createdAt: new Date().toLocaleDateString(),
        resolver: market.address.slice(0, 12) + '...',
        isNew: index < 2,
        isTrending: market.totalCollateral > 10,
        isMultiOutcome: true,
        outcomes,
      };
    });
  }, [multiMarkets]);

  // Combine all markets
  const allMarkets = useMemo(() => {
    return [...convertedMultiMarkets, ...convertedBinaryMarkets];
  }, [convertedBinaryMarkets, convertedMultiMarkets]);

  // Get market by ID
  const getMarket = useCallback((id: string): Market | undefined => {
    return allMarkets.find(m => m.id === id);
  }, [allMarkets]);

  // Parse market ID to get address and type
  const parseMarketId = (id: string): { type: 'binary' | 'multi'; address: string } => {
    if (id.startsWith('binary-')) {
      return { type: 'binary', address: id.replace('binary-', '') };
    } else if (id.startsWith('multi-')) {
      return { type: 'multi', address: id.replace('multi-', '') };
    }
    // Fallback: assume multi-outcome
    return { type: 'multi', address: id };
  };

  // Trading functions for binary markets
  const buyYes = useCallback(async (marketId: string, amountAPT: string) => {
    if (!walletAddress) throw new Error('Wallet not connected');
    const { address } = parseMarketId(marketId);
    const amountUnits = Math.floor(parseFloat(amountAPT) * 100_000_000);

    const payload = {
      function: `0x3f13249e31a1fbdb886741f7945cccc40307311abc08ba188894bd1a050e19b4::market::buy_yes` as const,
      functionArguments: [address, amountUnits, 0],
    };

    return signAndSubmitTransaction({ data: payload });
  }, [walletAddress, signAndSubmitTransaction]);

  const buyNo = useCallback(async (marketId: string, amountAPT: string) => {
    if (!walletAddress) throw new Error('Wallet not connected');
    const { address } = parseMarketId(marketId);
    const amountUnits = Math.floor(parseFloat(amountAPT) * 100_000_000);

    const payload = {
      function: `0x3f13249e31a1fbdb886741f7945cccc40307311abc08ba188894bd1a050e19b4::market::buy_no` as const,
      functionArguments: [address, amountUnits, 0],
    };

    return signAndSubmitTransaction({ data: payload });
  }, [walletAddress, signAndSubmitTransaction]);

  const sellYes = useCallback(async (marketId: string, amount: string) => {
    if (!walletAddress) throw new Error('Wallet not connected');
    const { address } = parseMarketId(marketId);
    const amountUnits = Math.floor(parseFloat(amount) * 100_000_000);

    const payload = {
      function: `0x3f13249e31a1fbdb886741f7945cccc40307311abc08ba188894bd1a050e19b4::market::sell_yes` as const,
      functionArguments: [address, amountUnits, 0],
    };

    return signAndSubmitTransaction({ data: payload });
  }, [walletAddress, signAndSubmitTransaction]);

  const sellNo = useCallback(async (marketId: string, amount: string) => {
    if (!walletAddress) throw new Error('Wallet not connected');
    const { address } = parseMarketId(marketId);
    const amountUnits = Math.floor(parseFloat(amount) * 100_000_000);

    const payload = {
      function: `0x3f13249e31a1fbdb886741f7945cccc40307311abc08ba188894bd1a050e19b4::market::sell_no` as const,
      functionArguments: [address, amountUnits, 0],
    };

    return signAndSubmitTransaction({ data: payload });
  }, [walletAddress, signAndSubmitTransaction]);

  // Trading functions for multi-outcome markets
  const buyOutcome = useCallback(async (marketId: string, outcomeIndex: number, amountAPT: string) => {
    if (!walletAddress) throw new Error('Wallet not connected');
    const { address } = parseMarketId(marketId);
    const payload = await buyOutcomePayload(address, outcomeIndex, amountAPT);

    return signAndSubmitTransaction({
      data: {
        ...payload,
        function: payload.function as `${string}::${string}::${string}`
      }
    });
  }, [walletAddress, signAndSubmitTransaction, buyOutcomePayload]);

  const sellOutcome = useCallback(async (marketId: string, outcomeIndex: number, amount: string) => {
    if (!walletAddress) throw new Error('Wallet not connected');
    const { address } = parseMarketId(marketId);
    const payload = await sellOutcomePayload(address, outcomeIndex, amount);

    return signAndSubmitTransaction({
      data: {
        ...payload,
        function: payload.function as `${string}::${string}::${string}`
      }
    });
  }, [walletAddress, signAndSubmitTransaction, sellOutcomePayload]);

  // Refresh all markets
  const refresh = useCallback(() => {
    refetchBinary();
    refreshMulti();
  }, [refetchBinary, refreshMulti]);

  return {
    markets: allMarkets,
    loading: binaryLoading || multiLoading,
    error: binaryError || multiError,
    refresh,
    buyYes,
    buyNo,
    sellYes,
    sellNo,
    buyOutcome,
    sellOutcome,
    getMarket,
    binaryMarkets,
    multiMarkets,
  };
}
