import { useMemo, useCallback } from 'react';
import { useWallet } from '@aptos-labs/wallet-adapter-react';
import { useMarkets } from './useMarkets';
import type { OnChainMarket } from './useMarkets';
import { useMultiMarkets } from './useMultiMarkets';
import type { Market, Category, Outcome } from '../polymarket/types';

// Contract address from env var (USD1 contract deployed Jan 11, 2026)
const CONTRACT_ADDRESS = import.meta.env.VITE_CONTRACT_ADDRESS || '0xca4d40eae9f07fb28a121862d649203fb4335ece9536ee51790e19f812ff7aea';

// Outcome colors for multi-outcome markets
const OUTCOME_COLORS = [
  '#00c853', '#2c9cdb', '#f5a623', '#00bcd4', '#ef4444',
  '#a855f7', '#ec4899', '#14b8a6', '#f97316', '#6366f1',
];

// Category images (placeholder gradients or stock images)
const CATEGORY_IMAGES: Record<string, string> = {
  Politics: 'https://images.unsplash.com/photo-1540910419892-4a36d2c3266c?w=200',
  Crypto: 'https://images.unsplash.com/photo-1518546305927-5a555bb7020d?w=200',
  Sports: 'https://images.unsplash.com/photo-1546519638-68e109498ffc?w=200',
  Business: 'https://images.unsplash.com/photo-1541354329998-f4d9a9f9297f?w=200',
  Science: 'https://images.unsplash.com/photo-1635070041078-e363dbe005cb?w=200',
  Culture: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=200',
  World: 'https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?w=200',
  default: 'https://images.unsplash.com/photo-1526304640581-d334cdbbf45e?w=200',
};

// Special market images (for specific markets by keyword) - using actual Polymarket images
const SPECIAL_MARKET_IMAGES: Record<string, string> = {
  // Politics
  'republican': 'https://polymarket-upload.s3.us-east-2.amazonaws.com/republicans+2028.png',
  'nominee 2028': 'https://polymarket-upload.s3.us-east-2.amazonaws.com/republicans+2028.png',
  'third term': 'https://polymarket-upload.s3.us-east-2.amazonaws.com/trump-announce-hes-run-for-3rd-term-xNfqKj-FDMLz.jpg',
  '3rd term': 'https://polymarket-upload.s3.us-east-2.amazonaws.com/trump-announce-hes-run-for-3rd-term-xNfqKj-FDMLz.jpg',
  'insurrection act': 'https://polymarket-upload.s3.us-east-2.amazonaws.com/trump-invokes-the-insurrection-act-before-august-jR3s2WWoaIbY.jpg',
  'midterm': 'https://polymarket-upload.s3.us-east-2.amazonaws.com/will-the-2026-midterm-elections-happen-as-scheduled-Yu4FtUsATBIb.jpg',
  // Trump/WLFI markets
  'wlfi': 'https://polymarket-upload.s3.us-east-2.amazonaws.com/wlfi.png',
  'world liberty': 'https://polymarket-upload.s3.us-east-2.amazonaws.com/wlfi.png',
  'banking charter': 'https://polymarket-upload.s3.us-east-2.amazonaws.com/wlfi.png',
  'greenland': 'https://polymarket-upload.s3.us-east-2.amazonaws.com/will-trump-acquire-greenland-in-2025-5ZDkcIGhdBMW.jpg',
  'fed chair': 'https://polymarket-upload.s3.us-east-2.amazonaws.com/who-will-trump-nominate-as-fed-chair-9p19ttRwsbKL.png',
  'nominate as fed': 'https://polymarket-upload.s3.us-east-2.amazonaws.com/who-will-trump-nominate-as-fed-chair-9p19ttRwsbKL.png',
  // Geopolitics
  'khamenei': 'https://polymarket-upload.s3.us-east-2.amazonaws.com/khamenei-out-as-supreme-leader-of-iran-in-2025-VNDMf5RqFLwB.jpg',
  'iran': 'https://polymarket-upload.s3.us-east-2.amazonaws.com/khamenei-out-as-supreme-leader-of-iran-in-2025-VNDMf5RqFLwB.jpg',
  'supreme leader': 'https://polymarket-upload.s3.us-east-2.amazonaws.com/khamenei-out-as-supreme-leader-of-iran-in-2025-VNDMf5RqFLwB.jpg',
  'taiwan': 'https://polymarket-upload.s3.us-east-2.amazonaws.com/china-invades-taiwan-in-2025-CCSd9dX2mrea.jpg',
  'china invade': 'https://polymarket-upload.s3.us-east-2.amazonaws.com/china-invades-taiwan-in-2025-CCSd9dX2mrea.jpg',
  'ukraine': 'https://polymarket-upload.s3.us-east-2.amazonaws.com/russia-x-ukraine-ceasefire-in-2025-w2voYOygx80B.jpg',
  'russia': 'https://polymarket-upload.s3.us-east-2.amazonaws.com/russia-x-ukraine-ceasefire-in-2025-w2voYOygx80B.jpg',
  'ceasefire': 'https://polymarket-upload.s3.us-east-2.amazonaws.com/russia-x-ukraine-ceasefire-in-2025-w2voYOygx80B.jpg',
  'venezuela': 'https://polymarket-upload.s3.us-east-2.amazonaws.com/venezuela-leader-end-of-2026-lOfqbUxiKAsg.png',
  // Crypto/Economic
  'bitcoin': 'https://polymarket-upload.s3.us-east-2.amazonaws.com/BTC+fullsize.png',
  'btc': 'https://polymarket-upload.s3.us-east-2.amazonaws.com/BTC+fullsize.png',
  '$150k': 'https://polymarket-upload.s3.us-east-2.amazonaws.com/BTC+fullsize.png',
  '$100k': 'https://polymarket-upload.s3.us-east-2.amazonaws.com/BTC+fullsize.png',
  'fed rate': 'https://polymarket-upload.s3.us-east-2.amazonaws.com/jerome+powell+glasses1.png',
  'fomc': 'https://polymarket-upload.s3.us-east-2.amazonaws.com/jerome+powell+glasses1.png',
  'rate decision': 'https://polymarket-upload.s3.us-east-2.amazonaws.com/jerome+powell+glasses1.png',
};

// Candidate/person face images for outcomes
const CANDIDATE_IMAGES: Record<string, string> = {
  // GOP Nominees
  'j.d. vance': '/images/jd-vance.png',
  'jd vance': '/images/jd-vance.png',
  'vance': '/images/jd-vance.png',
  'marco rubio': '/images/marco-rubio.png',
  'rubio': '/images/marco-rubio.png',
  'donald trump': '/images/donald-trump.png',
  'trump': '/images/donald-trump.png',
  'ron desantis': '/images/ron-desantis.png',
  'desantis': '/images/ron-desantis.png',
  'tucker carlson': '/images/tucker-carlson.png',
  'carlson': '/images/tucker-carlson.png',
  'donald trump jr': '/images/donald-trump-jr.png',
  'trump jr': '/images/donald-trump-jr.png',
  'ted cruz': '/images/ted-cruz.png',
  'cruz': '/images/ted-cruz.png',
  'marjorie taylor greene': '/images/marjorie-taylor-greene.png',
  'mtg': '/images/marjorie-taylor-greene.png',
  'greene': '/images/marjorie-taylor-greene.png',
  'nikki haley': '/images/nikki-haley.png',
  'haley': '/images/nikki-haley.png',
  // Fed Chair nominees (use placeholder initials style - handled by UI)
  'kevin warsh': 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100',
  'warsh': 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100',
  'kevin hassett': 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100',
  'hassett': 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100',
  'powell stays': 'https://images.unsplash.com/photo-1560250097-0b93528c311a?w=100',
  'powell': 'https://images.unsplash.com/photo-1560250097-0b93528c311a?w=100',
  // Venezuela leaders
  'delcy rodriguez': 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=100',
  'maria corina machado': 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=100',
  'machado': 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=100',
  'military junta': 'https://images.unsplash.com/photo-1579912437766-7896df6d3cd3?w=100',
};

// Get candidate image from name
function getCandidateImage(name: string): string | undefined {
  const lowerName = name.toLowerCase().trim();
  return CANDIDATE_IMAGES[lowerName];
}

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

// Get image for a market (checks question for special images first)
function getMarketImage(question: string, category: string): string {
  const lowerQuestion = question.toLowerCase();

  // Check for special market keywords
  for (const [keyword, image] of Object.entries(SPECIAL_MARKET_IMAGES)) {
    if (lowerQuestion.includes(keyword)) {
      return image;
    }
  }

  return getCategoryImage(category);
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
      image: getMarketImage(market.question, market.description),
      yesPrice: market.yesPrice / 100,
      noPrice: market.noPrice / 100,
      volume: formatVolume((market.yesReserve + market.noReserve) / 100_000_000),
      liquidity: formatVolume((market.yesReserve + market.noReserve) / 100_000_000 / 2),
      category: mapCategory(market.description),
      endDate: formatEndDate(market.endTime),
      endTime: market.endTime,
      resolved: market.resolved,
      createdAt: new Date().toLocaleDateString(),
      resolver: market.creator || market.address.slice(0, 12) + '...',
      isNew: index < 2, // First 2 are "new"
      isTrending: market.yesReserve + market.noReserve > 100_000_000, // High volume = trending
      isMultiOutcome: false,
    }));
  }, [binaryMarkets]);

  // Normalize question text for deduplication (handles punctuation, whitespace, case)
  const normalizeQuestion = (q: string): string => {
    return q
      .toLowerCase()
      .trim()
      .replace(/[?!.,;:'"]/g, '')  // Remove punctuation
      .replace(/\s+/g, ' ')        // Normalize whitespace
      .replace(/\$/g, '')          // Remove $ symbols
      .substring(0, 50);           // First 50 chars for matching
  };

  // Convert multi-outcome markets to Polymarket format
  // Filter duplicates by question, keeping the one with highest volume
  // Also filter out specific markets we don't want to show
  const convertedMultiMarkets: Market[] = useMemo(() => {
    // First, deduplicate by normalized question - keep highest volume
    const deduped = multiMarkets.reduce((acc, market) => {
      // Filter out 2024 presidential election market
      if (market.question.toLowerCase().includes('2024') &&
          market.question.toLowerCase().includes('presidential')) {
        return acc;
      }

      const normalizedQuestion = normalizeQuestion(market.question);
      const existing = acc.find(m => normalizeQuestion(m.question) === normalizedQuestion);
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
        image: getCandidateImage(outcome.label), // Add candidate face image
        price: outcome.price / 100, // Normalize to 0-1
        // Per-outcome volume not tracked on-chain, show dash
        volume: "—",
        color: OUTCOME_COLORS[i % OUTCOME_COLORS.length],
      }));

      // For multi-outcome, use highest probability as yesPrice
      const maxPrice = Math.max(...market.outcomes.map((o: any) => o.price));

      return {
        id: `multi-${market.address}`,
        question: market.question,
        image: getMarketImage(market.question, market.category),
        yesPrice: maxPrice / 100,
        noPrice: (100 - maxPrice) / 100,
        volume: formatVolume(market.totalCollateral),
        liquidity: formatVolume(market.totalCollateral / 2),
        category: mapCategory(market.category),
        endDate: formatEndDate(market.endTime),
        endTime: market.endTime,
        resolved: market.resolved,
        createdAt: new Date().toLocaleDateString(),
        resolver: market.address.slice(0, 12) + '...',
        isNew: index < 2,
        isTrending: market.totalCollateral > 10,
        isMultiOutcome: true,
        outcomes,
        // Pass through oracle info from on-chain data
        oracleInfo: market.oracleInfo,
      };
    });
  }, [multiMarkets]);

  // Priority order for markets on home page
  const MARKET_ORDER_KEYWORDS = [
    'republican', '2028 nominee',  // 1. Republican 2028 Nominee
    'khamenei', 'supreme leader',  // 2. Khamenei
    'taiwan', 'china invade',      // 3. China Taiwan
    'wlfi', 'banking charter',     // 4. WLFI Banking Charter
  ];

  // Sort markets by priority (featured markets first)
  const sortMarketsByPriority = (markets: Market[]): Market[] => {
    return [...markets].sort((a, b) => {
      const aQuestion = a.question.toLowerCase();
      const bQuestion = b.question.toLowerCase();

      // Find priority index for each market
      const aPriority = MARKET_ORDER_KEYWORDS.findIndex(kw => aQuestion.includes(kw));
      const bPriority = MARKET_ORDER_KEYWORDS.findIndex(kw => bQuestion.includes(kw));

      // Markets with priority keywords come first
      if (aPriority !== -1 && bPriority === -1) return -1;
      if (aPriority === -1 && bPriority !== -1) return 1;
      if (aPriority !== -1 && bPriority !== -1) return aPriority - bPriority;

      // For non-priority markets, keep original order
      return 0;
    });
  };

  // Combine all markets and sort by priority
  const allMarkets = useMemo(() => {
    const combined = [...convertedMultiMarkets, ...convertedBinaryMarkets];
    return sortMarketsByPriority(combined);
  }, [convertedBinaryMarkets, convertedMultiMarkets]);

  // Get market by ID (supports both prefixed IDs and raw addresses)
  const getMarket = useCallback((id: string): Market | undefined => {
    // Direct match first
    let market = allMarkets.find(m => m.id === id);
    if (market) return market;

    // Try with prefixes if raw address was passed
    if (!id.startsWith('binary-') && !id.startsWith('multi-')) {
      market = allMarkets.find(m => m.id === `multi-${id}` || m.id === `binary-${id}`);
      if (market) return market;
    }

    // Try matching the address part (strip prefix if searching by prefixed ID)
    const searchAddress = id.replace('binary-', '').replace('multi-', '');
    return allMarkets.find(m => m.id.endsWith(searchAddress));
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
    console.log('[usePolymarkets] buyYes called:', { marketId, amountAPT, hasWallet: !!walletAddress, hasSign: !!signAndSubmitTransaction });
    if (!walletAddress) throw new Error('Wallet not connected');
    if (!signAndSubmitTransaction) throw new Error('Wallet signing not available. Please reconnect your wallet.');

    const { address } = parseMarketId(marketId);
    const amountUnits = Math.floor(parseFloat(amountAPT) * 100_000_000);

    const payload = {
      function: `${CONTRACT_ADDRESS}::market::buy_yes` as const,
      functionArguments: [address, amountUnits, 0],
    };

    return signAndSubmitTransaction({ data: payload });
  }, [walletAddress, signAndSubmitTransaction]);

  const buyNo = useCallback(async (marketId: string, amountAPT: string) => {
    console.log('[usePolymarkets] buyNo called:', { marketId, amountAPT, hasWallet: !!walletAddress, hasSign: !!signAndSubmitTransaction });
    if (!walletAddress) throw new Error('Wallet not connected');
    if (!signAndSubmitTransaction) throw new Error('Wallet signing not available. Please reconnect your wallet.');

    const { address } = parseMarketId(marketId);
    const amountUnits = Math.floor(parseFloat(amountAPT) * 100_000_000);

    const payload = {
      function: `${CONTRACT_ADDRESS}::market::buy_no` as const,
      functionArguments: [address, amountUnits, 0],
    };

    return signAndSubmitTransaction({ data: payload });
  }, [walletAddress, signAndSubmitTransaction]);

  const sellYes = useCallback(async (marketId: string, amount: string) => {
    console.log('[usePolymarkets] sellYes called:', { marketId, amount, hasWallet: !!walletAddress, hasSign: !!signAndSubmitTransaction });
    if (!walletAddress) throw new Error('Wallet not connected');
    if (!signAndSubmitTransaction) throw new Error('Wallet signing not available. Please reconnect your wallet.');

    const { address } = parseMarketId(marketId);
    const amountUnits = Math.floor(parseFloat(amount) * 100_000_000);

    const payload = {
      function: `${CONTRACT_ADDRESS}::market::sell_yes` as const,
      functionArguments: [address, amountUnits, 0],
    };

    return signAndSubmitTransaction({ data: payload });
  }, [walletAddress, signAndSubmitTransaction]);

  const sellNo = useCallback(async (marketId: string, amount: string) => {
    console.log('[usePolymarkets] sellNo called:', { marketId, amount, hasWallet: !!walletAddress, hasSign: !!signAndSubmitTransaction });
    if (!walletAddress) throw new Error('Wallet not connected');
    if (!signAndSubmitTransaction) throw new Error('Wallet signing not available. Please reconnect your wallet.');

    const { address } = parseMarketId(marketId);
    const amountUnits = Math.floor(parseFloat(amount) * 100_000_000);

    const payload = {
      function: `${CONTRACT_ADDRESS}::market::sell_no` as const,
      functionArguments: [address, amountUnits, 0],
    };

    return signAndSubmitTransaction({ data: payload });
  }, [walletAddress, signAndSubmitTransaction]);

  // Trading functions for multi-outcome markets
  const buyOutcome = useCallback(async (marketId: string, outcomeIndex: number, amountAPT: string) => {
    console.log('[usePolymarkets] buyOutcome called:', { marketId, outcomeIndex, amountAPT, walletAddress: !!walletAddress });

    if (!walletAddress) {
      console.error('[usePolymarkets] buyOutcome: No wallet address');
      throw new Error('Wallet not connected');
    }

    // Mobile Safari can lose signAndSubmitTransaction even when address exists
    if (!signAndSubmitTransaction) {
      console.error('[usePolymarkets] buyOutcome: signAndSubmitTransaction is undefined - wallet may need reconnection');
      throw new Error('Wallet signing not available. Please reconnect your wallet.');
    }

    const { address } = parseMarketId(marketId);
    console.log('[usePolymarkets] Getting payload for market:', address);

    const payload = await buyOutcomePayload(address, outcomeIndex, amountAPT);
    console.log('[usePolymarkets] Payload ready, calling signAndSubmitTransaction...');

    try {
      const result = await signAndSubmitTransaction({
        data: {
          ...payload,
          function: payload.function as `${string}::${string}::${string}`
        }
      });
      console.log('[usePolymarkets] Transaction submitted:', result);
      return result;
    } catch (err) {
      console.error('[usePolymarkets] signAndSubmitTransaction failed:', err);
      console.error('[usePolymarkets] Error details:', {
        name: (err as Error)?.name,
        message: (err as Error)?.message,
      });
      throw err;
    }
  }, [walletAddress, signAndSubmitTransaction, buyOutcomePayload]);

  const sellOutcome = useCallback(async (marketId: string, outcomeIndex: number, amount: string) => {
    console.log('[usePolymarkets] sellOutcome called:', { marketId, outcomeIndex, amount, walletAddress: !!walletAddress });

    if (!walletAddress) {
      console.error('[usePolymarkets] sellOutcome: No wallet address');
      throw new Error('Wallet not connected');
    }

    // Mobile Safari can lose signAndSubmitTransaction even when address exists
    if (!signAndSubmitTransaction) {
      console.error('[usePolymarkets] sellOutcome: signAndSubmitTransaction is undefined - wallet may need reconnection');
      throw new Error('Wallet signing not available. Please reconnect your wallet.');
    }

    const { address } = parseMarketId(marketId);
    console.log('[usePolymarkets] Getting payload for market:', address);

    const payload = await sellOutcomePayload(address, outcomeIndex, amount);
    console.log('[usePolymarkets] Payload ready, calling signAndSubmitTransaction...');

    try {
      const result = await signAndSubmitTransaction({
        data: {
          ...payload,
          function: payload.function as `${string}::${string}::${string}`
        }
      });
      console.log('[usePolymarkets] Transaction submitted:', result);
      return result;
    } catch (err) {
      console.error('[usePolymarkets] signAndSubmitTransaction failed:', err);
      console.error('[usePolymarkets] Error details:', {
        name: (err as Error)?.name,
        message: (err as Error)?.message,
      });
      throw err;
    }
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
