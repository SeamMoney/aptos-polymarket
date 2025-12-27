import { useState } from 'react';
import { motion } from 'framer-motion';
import { useWallet } from '@aptos-labs/wallet-adapter-react';
import { PREDICTION_MARKET_ADDRESS } from '../utils/contracts';

interface CreateMarketProps {
  onMarketCreated?: (marketAddress: string) => void;
}

export function CreateMarket({ onMarketCreated }: CreateMarketProps) {
  const { connected, signAndSubmitTransaction } = useWallet();
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [question, setQuestion] = useState('');
  const [description, setDescription] = useState('');
  const [endDate, setEndDate] = useState('');
  const [initialLiquidity, setInitialLiquidity] = useState('1');
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  const handleCreate = async () => {
    if (!connected) {
      alert('Please connect your wallet first');
      return;
    }

    if (!question || !endDate || !initialLiquidity) {
      alert('Please fill in all fields');
      return;
    }

    setIsSubmitting(true);
    setResult(null);

    try {
      // Convert end date to Unix timestamp
      const endTime = Math.floor(new Date(endDate).getTime() / 1000);

      // Convert liquidity to APT units (8 decimals)
      const liquidityUnits = Math.floor(parseFloat(initialLiquidity) * 100_000_000);

      const response = await signAndSubmitTransaction({
        data: {
          function: `${PREDICTION_MARKET_ADDRESS}::market::create_market`,
          functionArguments: [question, description || '', endTime, liquidityUnits],
        },
      });

      setResult({
        success: true,
        message: `Market created! TX: ${response.hash.slice(0, 10)}...`,
      });

      // Reset form
      setQuestion('');
      setDescription('');
      setEndDate('');
      setInitialLiquidity('100');

      if (onMarketCreated) {
        // The market address would be emitted in the transaction events
        // For now we just notify that creation succeeded
        onMarketCreated(response.hash);
      }
    } catch (error) {
      console.error('Failed to create market:', error);
      setResult({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to create market. Make sure you have enough APT.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mb-8">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-4 py-2 bg-poly-green text-black font-bold rounded-xl hover:bg-poly-green/90 transition-all"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        Create Market
      </button>

      {isOpen && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="mt-4 p-6 bg-poly-card border border-poly-border rounded-2xl"
        >
          <h3 className="text-xl font-bold text-white mb-4">Create a Prediction Market</h3>
          <p className="text-gray-400 text-sm mb-4">
            Requires APT for initial liquidity. Markets use CPMM pricing (like Polymarket).
          </p>

          <div className="space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Question</label>
              <input
                type="text"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="Will Bitcoin exceed $200,000 by end of 2025?"
                className="w-full px-4 py-3 bg-poly-dark border border-poly-border rounded-xl text-white placeholder-gray-500 focus:border-poly-green focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-1">Description (optional)</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Additional context for the market..."
                rows={2}
                className="w-full px-4 py-3 bg-poly-dark border border-poly-border rounded-xl text-white placeholder-gray-500 focus:border-poly-green focus:outline-none resize-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">End Date</label>
                <input
                  type="datetime-local"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full px-4 py-3 bg-poly-dark border border-poly-border rounded-xl text-white focus:border-poly-green focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">Initial Liquidity (APT)</label>
                <input
                  type="number"
                  value={initialLiquidity}
                  onChange={(e) => setInitialLiquidity(e.target.value)}
                  min="1"
                  step="1"
                  className="w-full px-4 py-3 bg-poly-dark border border-poly-border rounded-xl text-white focus:border-poly-green focus:outline-none"
                />
              </div>
            </div>

            {result && (
              <div
                className={`p-3 rounded-xl ${
                  result.success
                    ? 'bg-poly-green/20 border border-poly-green/30 text-poly-green'
                    : 'bg-red-500/20 border border-red-500/30 text-red-400'
                }`}
              >
                {result.message}
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setIsOpen(false)}
                className="flex-1 py-3 bg-poly-dark border border-poly-border rounded-xl text-gray-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={!connected || isSubmitting}
                className="flex-1 py-3 bg-poly-green text-black font-bold rounded-xl hover:bg-poly-green/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? 'Creating...' : 'Create Market'}
              </button>
            </div>
          </div>

          <div className="mt-4 p-3 bg-poly-dark/50 rounded-xl">
            <p className="text-xs text-gray-500">
              Contract: <a
                href={`https://explorer.aptoslabs.com/account/${PREDICTION_MARKET_ADDRESS}/modules?network=testnet`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-poly-green hover:underline font-mono"
              >
                {PREDICTION_MARKET_ADDRESS.slice(0, 10)}...
              </a>
            </p>
          </div>
        </motion.div>
      )}
    </div>
  );
}
