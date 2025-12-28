import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { OutcomeButton } from './OutcomeButton';

interface Outcome {
  index: number;
  label: string;
  price: number;  // Normalized 0-100
  rawPrice: number;  // Raw price from contract
  userBalance: number;
}

interface MultiOutcomeMarketProps {
  address: string;
  question: string;
  category: string;
  outcomes: Outcome[];
  endDate: string;
  totalVolume: string;
  resolved: boolean;
  winningOutcome: number | null;
  walletBalance?: number; // User's APT balance
  onBuy: (outcomeIndex: number, amount: string) => Promise<void>;
  onSell: (outcomeIndex: number, amount: string) => Promise<void>;
}

export function MultiOutcomeMarketCard({
  address,
  question,
  category,
  outcomes,
  endDate,
  totalVolume,
  resolved,
  winningOutcome,
  walletBalance = 0,
  onBuy,
  onSell,
}: MultiOutcomeMarketProps) {
  const [selectedOutcome, setSelectedOutcome] = useState<number | null>(null);
  const [amount, setAmount] = useState('0.1');
  const [mode, setMode] = useState<'buy' | 'sell'>('buy');
  const [isLoading, setIsLoading] = useState(false);

  // Sort outcomes by price (highest first)
  const sortedOutcomes = [...outcomes].sort((a, b) => b.price - a.price);

  // Determine grid columns based on outcome count
  const getGridCols = () => {
    const count = outcomes.length;
    if (count <= 2) return 'grid-cols-2';
    if (count <= 4) return 'grid-cols-2 sm:grid-cols-4';
    if (count <= 6) return 'grid-cols-2 sm:grid-cols-3';
    if (count <= 9) return 'grid-cols-3';
    return 'grid-cols-2 sm:grid-cols-4 lg:grid-cols-5';
  };

  const handleTrade = async () => {
    if (selectedOutcome === null) return;
    setIsLoading(true);
    try {
      if (mode === 'buy') {
        await onBuy(selectedOutcome, amount);
      } else {
        await onSell(selectedOutcome, amount);
      }
      setSelectedOutcome(null);
    } catch (error) {
      console.error('Trade failed:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const selectedOutcomeData = selectedOutcome !== null
    ? outcomes.find(o => o.index === selectedOutcome)
    : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-poly-card border border-poly-border rounded-2xl overflow-hidden"
    >
      {/* Header */}
      <div className="p-4">
        <div className="flex items-center gap-2 mb-2">
          <span className="px-2 py-0.5 text-xs bg-purple-500/20 text-purple-400 rounded-full font-medium">
            {category}
          </span>
          <span className="px-2 py-0.5 text-xs bg-poly-green/20 text-poly-green rounded-full font-medium">
            Multi-Outcome
          </span>
          <span className="text-xs text-gray-500 ml-auto">{endDate}</span>
        </div>

        <h3 className="text-lg font-semibold text-white mb-4">{question}</h3>

        {/* Outcome Grid */}
        <div className={`grid gap-2 ${getGridCols()}`}>
          {sortedOutcomes.map((outcome) => (
            <OutcomeButton
              key={outcome.index}
              label={outcome.label}
              price={outcome.price}
              userBalance={outcome.userBalance}
              isSelected={selectedOutcome === outcome.index}
              isWinner={resolved && winningOutcome === outcome.index}
              onClick={() => setSelectedOutcome(
                selectedOutcome === outcome.index ? null : outcome.index
              )}
            />
          ))}
        </div>
      </div>

      {/* Trade Panel */}
      <AnimatePresence>
        {selectedOutcome !== null && selectedOutcomeData && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-t border-poly-border overflow-hidden"
          >
            <div className="p-4 bg-poly-dark/50">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <span className="text-sm text-gray-400">Trading</span>
                  <div className="text-lg font-bold text-white">
                    {selectedOutcomeData.label}
                  </div>
                </div>

                {/* Buy/Sell Toggle */}
                <div className="flex bg-poly-dark rounded-lg p-1">
                  <button
                    onClick={() => setMode('buy')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                      mode === 'buy'
                        ? 'bg-poly-green text-black'
                        : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    Buy
                  </button>
                  <button
                    onClick={() => setMode('sell')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                      mode === 'sell'
                        ? 'bg-red-500 text-white'
                        : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    Sell
                  </button>
                </div>
              </div>

              {/* Amount Input */}
              <div className="mb-4">
                <div className="flex justify-between items-center mb-2">
                  <label className="text-sm text-gray-400">
                    {mode === 'buy' ? 'Amount (APT)' : 'Amount (Shares)'}
                  </label>
                  {mode === 'buy' ? (
                    <span className="text-xs text-gray-500">
                      Balance: <span className="text-white font-mono">{walletBalance.toFixed(2)} APT</span>
                    </span>
                  ) : (
                    selectedOutcomeData.userBalance > 0 && (
                      <span className="text-xs text-gray-500">
                        Shares: <span className="text-white font-mono">{selectedOutcomeData.userBalance.toFixed(4)}</span>
                      </span>
                    )
                  )}
                </div>
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                    className="flex-1 bg-poly-dark border border-poly-border rounded-lg px-4 py-2 text-white font-mono"
                    step="0.1"
                    min="0"
                  />
                  <div className="flex gap-1">
                    {mode === 'buy' ? (
                      // Buy presets based on wallet balance
                      walletBalance > 0 ? (
                        <>
                          <button
                            onClick={() => setAmount((walletBalance * 0.1).toFixed(2))}
                            className="px-3 py-2 bg-poly-dark border border-poly-border rounded-lg text-sm text-gray-400 hover:text-white hover:border-gray-600 transition-all"
                          >
                            10%
                          </button>
                          <button
                            onClick={() => setAmount((walletBalance * 0.25).toFixed(2))}
                            className="px-3 py-2 bg-poly-dark border border-poly-border rounded-lg text-sm text-gray-400 hover:text-white hover:border-gray-600 transition-all"
                          >
                            25%
                          </button>
                          <button
                            onClick={() => setAmount((walletBalance * 0.5).toFixed(2))}
                            className="px-3 py-2 bg-poly-dark border border-poly-border rounded-lg text-sm text-gray-400 hover:text-white hover:border-gray-600 transition-all"
                          >
                            50%
                          </button>
                          <button
                            onClick={() => setAmount(walletBalance.toFixed(2))}
                            className="px-3 py-2 bg-poly-green/20 border border-poly-green/30 rounded-lg text-sm text-poly-green hover:text-poly-green hover:border-poly-green/50 transition-all"
                          >
                            Max
                          </button>
                        </>
                      ) : (
                        ['0.1', '0.5', '1'].map((preset) => (
                          <button
                            key={preset}
                            onClick={() => setAmount(preset)}
                            className="px-3 py-2 bg-poly-dark border border-poly-border rounded-lg text-sm text-gray-400 hover:text-white hover:border-gray-600 transition-all"
                          >
                            {preset}
                          </button>
                        ))
                      )
                    ) : (
                      // Sell presets based on user balance
                      selectedOutcomeData.userBalance > 0 ? (
                        <>
                          <button
                            onClick={() => setAmount((selectedOutcomeData.userBalance * 0.25).toFixed(4))}
                            className="px-3 py-2 bg-poly-dark border border-poly-border rounded-lg text-sm text-gray-400 hover:text-white hover:border-gray-600 transition-all"
                          >
                            25%
                          </button>
                          <button
                            onClick={() => setAmount((selectedOutcomeData.userBalance * 0.5).toFixed(4))}
                            className="px-3 py-2 bg-poly-dark border border-poly-border rounded-lg text-sm text-gray-400 hover:text-white hover:border-gray-600 transition-all"
                          >
                            50%
                          </button>
                          <button
                            onClick={() => setAmount(selectedOutcomeData.userBalance.toFixed(4))}
                            className="px-3 py-2 bg-red-500/20 border border-red-500/30 rounded-lg text-sm text-red-400 hover:text-red-300 hover:border-red-500/50 transition-all"
                          >
                            Max
                          </button>
                        </>
                      ) : (
                        <span className="text-xs text-gray-500 px-2 py-2">No shares to sell</span>
                      )
                    )}
                  </div>
                </div>
              </div>

              {/* Trade Summary */}
              <div className="bg-poly-dark rounded-lg p-3 mb-4">
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-gray-400">Price</span>
                  <span className="text-white font-mono">{selectedOutcomeData.price.toFixed(1)}c</span>
                </div>
                {mode === 'buy' ? (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Est. Shares</span>
                    <span className="text-white font-mono">
                      ~{(parseFloat(amount || '0') / (selectedOutcomeData.price / 100)).toFixed(2)}
                    </span>
                  </div>
                ) : (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Est. Return</span>
                    <span className="text-white font-mono">
                      ~{(parseFloat(amount || '0') * (selectedOutcomeData.price / 100)).toFixed(4)} APT
                    </span>
                  </div>
                )}
              </div>

              {/* Submit Button */}
              <button
                onClick={handleTrade}
                disabled={isLoading || !amount || parseFloat(amount) <= 0}
                className={`w-full py-3 rounded-lg font-bold transition-all ${
                  mode === 'buy'
                    ? 'bg-poly-green text-black hover:bg-poly-green/90'
                    : 'bg-red-500 text-white hover:bg-red-600'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {isLoading ? 'Processing...' : `${mode === 'buy' ? 'Buy' : 'Sell'} ${selectedOutcomeData.label}`}
              </button>

              {/* Cancel */}
              <button
                onClick={() => setSelectedOutcome(null)}
                className="w-full mt-2 py-2 text-gray-400 text-sm hover:text-white"
              >
                Cancel
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-poly-border flex justify-between items-center text-sm">
        <span className="text-gray-500">Vol: {totalVolume}</span>
        <span className="text-gray-500 font-mono text-xs">{address.slice(0, 10)}...</span>
      </div>
    </motion.div>
  );
}
