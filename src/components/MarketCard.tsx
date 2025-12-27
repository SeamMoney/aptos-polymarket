import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useWallet } from '@aptos-labs/wallet-adapter-react';
import { Aptos, AptosConfig, Network } from '@aptos-labs/ts-sdk';
import { PREDICTION_MARKET_ADDRESS } from '../utils/contracts';

const aptosConfig = new AptosConfig({ network: Network.TESTNET });
const aptos = new Aptos(aptosConfig);

export interface Market {
  id: string;
  question: string;
  category: string;
  yesPrice: number;
  noPrice: number;
  volume: string;
  endDate: string;
  image?: string;
  isLive?: boolean;
}

interface MarketCardProps {
  market: Market;
  onBet?: (market: Market, side: 'yes' | 'no', amount: number) => Promise<void>;
  onSell?: (market: Market, side: 'yes' | 'no', amount: number) => Promise<void>;
}

export function MarketCard({ market, onBet, onSell }: MarketCardProps) {
  const { connected, account } = useWallet();
  const [selectedSide, setSelectedSide] = useState<'yes' | 'no' | null>(null);
  const [amount, setAmount] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showTradePanel, setShowTradePanel] = useState(false);
  const [mode, setMode] = useState<'buy' | 'sell'>('buy');
  const [positions, setPositions] = useState<{ yes: number; no: number } | null>(null);
  const [aptBalance, setAptBalance] = useState<number>(0);

  const [dataFetched, setDataFetched] = useState(false);

  // Fetch user positions and balance ON DEMAND when trade panel opens
  // This drastically reduces API calls to preserve rate limit for HFT
  const fetchUserData = useCallback(async () => {
    if (!connected || !account || dataFetched) return;

    try {
      // Fetch APT balance
      const resources = await aptos.getAccountResources({ accountAddress: account.address });
      const aptCoin = resources.find(r => r.type === '0x1::coin::CoinStore<0x1::aptos_coin::AptosCoin>');
      if (aptCoin) {
        setAptBalance(Number((aptCoin.data as any).coin.value) / 100_000_000);
      }

      // Fetch positions for on-chain markets
      if (market.id.startsWith('0x')) {
        const result = await aptos.view({
          payload: {
            function: `${PREDICTION_MARKET_ADDRESS}::market::get_user_positions`,
            functionArguments: [market.id, account.address],
          },
        });
        setPositions({
          yes: Number(result[0]) / 100_000_000,
          no: Number(result[1]) / 100_000_000,
        });
      }
      setDataFetched(true);
    } catch (err: any) {
      // Handle rate limit gracefully
      if (err.message?.includes('429') || err.message?.includes('rate limit')) {
        console.warn('Rate limited - skipping user data fetch');
        return;
      }
      console.error('Error fetching data:', err);
    }
  }, [connected, account, market.id, dataFetched]);

  // Reset fetched state when wallet disconnects
  useEffect(() => {
    if (!connected) {
      setPositions(null);
      setAptBalance(0);
      setDataFetched(false);
    }
  }, [connected]);

  const handleAction = async () => {
    if (!connected || !selectedSide || !amount) return;

    setIsSubmitting(true);
    try {
      if (mode === 'buy' && onBet) {
        await onBet(market, selectedSide, parseFloat(amount));
      } else if (mode === 'sell' && onSell) {
        await onSell(market, selectedSide, parseFloat(amount));
      }
      setShowTradePanel(false);
      setSelectedSide(null);
      setAmount('');
    } catch (error) {
      console.error('Action failed:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleMaxClick = () => {
    if (mode === 'buy') {
      // Max buy = APT balance minus small buffer for gas
      const maxBuy = Math.max(0, aptBalance - 0.01);
      setAmount(maxBuy.toFixed(2));
    } else {
      // Max sell = token balance
      if (positions) {
        const maxSell = selectedSide === 'yes' ? positions.yes : positions.no;
        setAmount(maxSell.toFixed(4));
      }
    }
  };

  const yesPercentage = Math.round(market.yesPrice * 100);
  const noPercentage = Math.round(market.noPrice * 100);
  const isOnChain = market.id.startsWith('0x');
  const hasYesTokens = positions && positions.yes > 0.0001;
  const hasNoTokens = positions && positions.no > 0.0001;
  const hasPositions = hasYesTokens || hasNoTokens;

  const getMaxAmount = () => {
    if (mode === 'buy') {
      return Math.max(0, aptBalance - 0.01);
    }
    if (positions) {
      return selectedSide === 'yes' ? positions.yes : positions.no;
    }
    return 0;
  };

  const getEstimatedReturn = () => {
    const amt = parseFloat(amount || '0');
    if (mode === 'buy') {
      const price = selectedSide === 'yes' ? market.yesPrice : market.noPrice;
      return (amt / price).toFixed(2);
    } else {
      const price = selectedSide === 'yes' ? market.yesPrice : market.noPrice;
      return (amt * price).toFixed(4);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-poly-card border border-poly-border rounded-2xl overflow-hidden hover:border-poly-green/30 transition-all"
    >
      {/* Header */}
      <div className="p-4 pb-3">
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className={`px-2 py-0.5 text-xs rounded-full ${
              isOnChain
                ? 'bg-poly-green/20 text-poly-green'
                : 'bg-blue-500/20 text-blue-400'
            }`}>
              {market.category}
            </span>
            {market.isLive && (
              <span className="flex items-center gap-1 px-2 py-0.5 text-xs bg-red-500/20 text-red-400 rounded-full">
                <span className="w-1.5 h-1.5 bg-red-400 rounded-full animate-pulse" />
                LIVE
              </span>
            )}
          </div>
          <span className="text-xs text-gray-500">{market.endDate}</span>
        </div>

        <h3 className="text-base font-semibold text-white mb-3 leading-tight line-clamp-2">
          {market.question}
        </h3>

        {/* Price Display */}
        <div className="grid grid-cols-2 gap-2 mb-3">
          <button
            onClick={() => {
              setSelectedSide('yes');
              setShowTradePanel(true);
              setMode('buy');
              setAmount('');
              fetchUserData(); // Fetch data on demand
            }}
            className={`p-3 rounded-xl transition-all ${
              selectedSide === 'yes' && showTradePanel
                ? 'bg-poly-green/20 ring-2 ring-poly-green'
                : 'bg-poly-dark hover:bg-poly-green/10'
            }`}
          >
            <div className="text-poly-green font-bold text-2xl">{yesPercentage}¢</div>
            <div className="text-poly-green text-xs font-medium">YES</div>
          </button>

          <button
            onClick={() => {
              setSelectedSide('no');
              setShowTradePanel(true);
              setMode('buy');
              setAmount('');
              fetchUserData(); // Fetch data on demand
            }}
            className={`p-3 rounded-xl transition-all ${
              selectedSide === 'no' && showTradePanel
                ? 'bg-poly-red/20 ring-2 ring-poly-red'
                : 'bg-poly-dark hover:bg-poly-red/10'
            }`}
          >
            <div className="text-poly-red font-bold text-2xl">{noPercentage}¢</div>
            <div className="text-poly-red text-xs font-medium">NO</div>
          </button>
        </div>

        {/* Positions display */}
        {isOnChain && hasPositions && (
          <div className="p-2 bg-poly-dark/50 rounded-lg mb-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-400">Your Position</span>
              <div className="flex gap-2 text-xs">
                {hasYesTokens && (
                  <span className="text-poly-green font-medium">
                    {positions!.yes.toFixed(4)} YES
                  </span>
                )}
                {hasNoTokens && (
                  <span className="text-poly-red font-medium">
                    {positions!.no.toFixed(4)} NO
                  </span>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Trade Panel */}
      {showTradePanel && selectedSide && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          className="border-t border-poly-border"
        >
          <div className="p-4 bg-gradient-to-b from-poly-dark/80 to-poly-dark/40">
            {/* Buy/Sell Tabs */}
            <div className="flex rounded-lg bg-poly-dark p-1 mb-4">
              <button
                onClick={() => { setMode('buy'); setAmount(''); }}
                className={`flex-1 py-2 px-3 text-sm font-medium rounded-md transition-all ${
                  mode === 'buy'
                    ? 'bg-poly-green text-black'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                Buy
              </button>
              <button
                onClick={() => { setMode('sell'); setAmount(''); }}
                disabled={!isOnChain || (selectedSide === 'yes' ? !hasYesTokens : !hasNoTokens)}
                className={`flex-1 py-2 px-3 text-sm font-medium rounded-md transition-all ${
                  mode === 'sell'
                    ? 'bg-orange-500 text-white'
                    : 'text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed'
                }`}
              >
                Sell
              </button>
            </div>

            {/* Amount Input */}
            <div className="mb-3">
              <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
                <span>{mode === 'buy' ? 'Amount (APT)' : `Amount (${selectedSide.toUpperCase()})`}</span>
                <span>
                  {mode === 'buy'
                    ? `Balance: ${aptBalance.toFixed(2)} APT`
                    : `Max: ${getMaxAmount().toFixed(4)}`
                  }
                </span>
              </div>
              <div className="flex gap-2">
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  className="flex-1 px-3 py-2.5 bg-poly-dark border border-poly-border rounded-lg text-white text-lg font-medium focus:border-poly-green focus:outline-none"
                  min="0"
                  step="0.01"
                />
                <button
                  onClick={handleMaxClick}
                  className="px-3 py-2 bg-poly-dark border border-poly-border rounded-lg text-poly-green text-sm font-medium hover:bg-poly-green/10 transition-colors"
                >
                  MAX
                </button>
              </div>
            </div>

            {/* Quick Amount Buttons */}
            {mode === 'buy' && (
              <div className="flex gap-2 mb-3">
                {[1, 5, 10, 25].map((val) => (
                  <button
                    key={val}
                    onClick={() => setAmount(val.toString())}
                    className="flex-1 py-1.5 text-xs bg-poly-dark border border-poly-border rounded-lg text-gray-400 hover:text-white hover:border-poly-green/50 transition-all"
                  >
                    {val} APT
                  </button>
                ))}
              </div>
            )}

            {/* Estimated Return */}
            <div className="flex items-center justify-between p-3 bg-poly-dark/50 rounded-lg mb-4">
              <span className="text-sm text-gray-400">
                {mode === 'buy' ? 'Est. Shares' : 'Est. Return'}
              </span>
              <span className={`text-lg font-bold ${
                mode === 'buy'
                  ? (selectedSide === 'yes' ? 'text-poly-green' : 'text-poly-red')
                  : 'text-orange-400'
              }`}>
                {mode === 'buy'
                  ? `${getEstimatedReturn()} ${selectedSide.toUpperCase()}`
                  : `${getEstimatedReturn()} APT`
                }
              </span>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setShowTradePanel(false);
                  setSelectedSide(null);
                  setAmount('');
                }}
                className="flex-1 py-2.5 bg-poly-dark border border-poly-border rounded-lg text-gray-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAction}
                disabled={!connected || isSubmitting || !amount || parseFloat(amount) <= 0}
                className={`flex-1 py-2.5 rounded-lg font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                  mode === 'sell'
                    ? 'bg-orange-500 text-white hover:bg-orange-600'
                    : selectedSide === 'yes'
                    ? 'bg-poly-green text-black hover:bg-poly-green/90'
                    : 'bg-poly-red text-white hover:bg-poly-red/90'
                }`}
              >
                {isSubmitting ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Processing
                  </span>
                ) : connected ? (
                  `${mode === 'buy' ? 'Buy' : 'Sell'} ${selectedSide.toUpperCase()}`
                ) : (
                  'Connect Wallet'
                )}
              </button>
            </div>
          </div>
        </motion.div>
      )}

      {/* Footer */}
      <div className="px-4 py-2 border-t border-poly-border flex items-center justify-between bg-poly-dark/30">
        <span className="text-xs text-gray-500">Vol: {market.volume}</span>
        {isOnChain && (
          <span className="text-xs text-poly-green">On-Chain</span>
        )}
      </div>
    </motion.div>
  );
}
