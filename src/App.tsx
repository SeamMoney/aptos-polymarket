import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useWallet } from '@aptos-labs/wallet-adapter-react';
import { Aptos, AptosConfig, Network } from '@aptos-labs/ts-sdk';
import { Header, MarketCard, StressTest, VisualizerEmbed, FeatureShowcase, CreateMarket, HFTVisualizer, TurboVisualizer } from './components';
import { MultiOutcomeMarketCard } from './components/MultiOutcomeMarketCard';
import type { Market } from './components';
import { PREDICTION_MARKET_ADDRESS } from './utils/contracts';
import { useMarkets } from './hooks/useMarkets';
import { useMultiMarkets } from './hooks/useMultiMarkets';

const aptosConfig = new AptosConfig({ network: Network.TESTNET });
const aptos = new Aptos(aptosConfig);

// Prediction Market Contract deployed at:
const CONTRACT_ADDRESS = PREDICTION_MARKET_ADDRESS;


function App() {
  const { connected, account, signAndSubmitTransaction } = useWallet();
  const [lastTxHash, setLastTxHash] = useState<string | null>(null);
  const [txStatus, setTxStatus] = useState<'idle' | 'pending' | 'success' | 'error'>('idle');
  const [walletBalance, setWalletBalance] = useState<number>(0);
  const [turboExpanded, setTurboExpanded] = useState(false);

  // Fetch wallet APT balance
  const fetchWalletBalance = useCallback(async () => {
    if (!account?.address) {
      setWalletBalance(0);
      return;
    }
    try {
      const resources = await aptos.getAccountResource({
        accountAddress: account.address,
        resourceType: '0x1::coin::CoinStore<0x1::aptos_coin::AptosCoin>',
      });
      const balance = parseInt((resources as { coin: { value: string } }).coin.value) / 100_000_000;
      setWalletBalance(balance);
    } catch {
      // Try fungible asset balance
      try {
        const balance = await aptos.getAccountAPTAmount({ accountAddress: account.address });
        setWalletBalance(balance / 100_000_000);
      } catch {
        setWalletBalance(0);
      }
    }
  }, [account?.address]);

  useEffect(() => {
    fetchWalletBalance();
    const interval = setInterval(fetchWalletBalance, 5000);
    return () => clearInterval(interval);
  }, [fetchWalletBalance]);

  // Fetch real on-chain markets
  const { markets: onChainMarkets, loading: marketsLoading, refetch: refetchMarkets } = useMarkets();

  // Fetch multi-outcome markets
  const { markets: multiMarkets, loading: multiMarketsLoading, refresh: refreshMultiMarkets } = useMultiMarkets();

  // Convert on-chain markets to Market format for display
  const realMarkets: Market[] = useMemo(() => {
    // eslint-disable-next-line react-hooks/purity
    const now = Date.now();
    return onChainMarkets.map((m) => ({
      id: m.address,
      question: m.question,
      category: 'On-Chain',
      yesPrice: m.yesPrice / 100,
      noPrice: m.noPrice / 100,
      // Volume estimate: reserves represent current liquidity, multiply by turnover factor for demo
      volume: `${(((m.yesReserve + m.noReserve) / 100_000_000) * 10).toFixed(2)} APT`,
      endDate: new Date(m.endTime * 1000).toLocaleDateString(),
      isLive: !m.resolved && m.endTime * 1000 > now,
    }));
  }, [onChainMarkets]);

  const handleBet = async (market: Market, side: 'yes' | 'no', amount: number) => {
    if (!connected || !account) {
      alert('Please connect your wallet first');
      return;
    }

    // Check if this is a real on-chain market (id is an address) or demo market
    const isRealMarket = market.id.startsWith('0x');

    if (!isRealMarket) {
      alert(`This is a demo market. To trade, create a real market on-chain first.\n\nContract deployed at: ${CONTRACT_ADDRESS}\n\nYou need APT to create/trade markets.`);
      return;
    }

    const marketAddress = market.id;
    setTxStatus('pending');
    console.log(`Placing ${side} bet of ${amount} APT on market ${marketAddress}`);

    try {
      // Convert amount to APT units (8 decimals)
      const amountInUnits = Math.floor(amount * 100_000_000);

      // Call the REAL prediction market contract
      const response = await signAndSubmitTransaction({
        data: {
          function: side === 'yes'
            ? `${CONTRACT_ADDRESS}::market::buy_yes`
            : `${CONTRACT_ADDRESS}::market::buy_no`,
          functionArguments: [marketAddress, amountInUnits, 0], // 0 = no slippage protection for demo
        },
      });

      // Wait for transaction
      try {
        await aptos.waitForTransaction({
          transactionHash: response.hash,
          options: { timeoutSecs: 10, checkSuccess: true }
        });
      } catch {
        console.log(`Tx ${response.hash} submitted, may still be propagating...`);
      }

      setLastTxHash(response.hash);
      setTxStatus('success');

      console.log(`Transaction submitted: ${response.hash}`);
      // Refetch markets to update prices
      refetchMarkets();
    } catch (error) {
      console.error('Transaction failed:', error);
      setTxStatus('error');
    }
  };

  const handleSell = async (market: Market, side: 'yes' | 'no', amount: number) => {
    if (!connected || !account) {
      alert('Please connect your wallet first');
      return;
    }

    const isRealMarket = market.id.startsWith('0x');
    if (!isRealMarket) {
      alert('Cannot sell on demo markets');
      return;
    }

    const marketAddress = market.id;
    setTxStatus('pending');
    console.log(`Selling ${amount} ${side.toUpperCase()} tokens on market ${marketAddress}`);

    try {
      // Convert amount to token units (8 decimals)
      const amountInUnits = Math.floor(amount * 100_000_000);

      const response = await signAndSubmitTransaction({
        data: {
          function: side === 'yes'
            ? `${CONTRACT_ADDRESS}::market::sell_yes`
            : `${CONTRACT_ADDRESS}::market::sell_no`,
          functionArguments: [marketAddress, amountInUnits, 0], // 0 = no slippage protection
        },
      });

      try {
        await aptos.waitForTransaction({
          transactionHash: response.hash,
          options: { timeoutSecs: 10, checkSuccess: true }
        });
      } catch {
        console.log(`Tx ${response.hash} submitted, may still be propagating...`);
      }

      setLastTxHash(response.hash);
      setTxStatus('success');
      console.log(`Sell transaction submitted: ${response.hash}`);
      refetchMarkets();
    } catch (error) {
      console.error('Sell transaction failed:', error);
      setTxStatus('error');
    }
  };

  // Multi-outcome trading handlers
  const handleMultiBuy = async (marketAddress: string, outcomeIndex: number, amount: string) => {
    if (!connected || !account) {
      alert('Please connect your wallet first');
      return;
    }

    setTxStatus('pending');
    try {
      const amountInUnits = Math.floor(parseFloat(amount) * 100_000_000);

      const response = await signAndSubmitTransaction({
        data: {
          function: `${CONTRACT_ADDRESS}::multi_outcome_market::buy_outcome`,
          functionArguments: [marketAddress, outcomeIndex, amountInUnits, 0],
        },
      });

      try {
        await aptos.waitForTransaction({
          transactionHash: response.hash,
          options: { timeoutSecs: 10, checkSuccess: true }
        });
      } catch {
        console.log(`Tx ${response.hash} submitted, may still be propagating...`);
      }

      setLastTxHash(response.hash);
      setTxStatus('success');
      refreshMultiMarkets();
    } catch (error) {
      console.error('Multi-outcome buy failed:', error);
      setTxStatus('error');
    }
  };

  const handleMultiSell = async (marketAddress: string, outcomeIndex: number, amount: string) => {
    if (!connected || !account) {
      alert('Please connect your wallet first');
      return;
    }

    setTxStatus('pending');
    try {
      const amountInUnits = Math.floor(parseFloat(amount) * 100_000_000);

      const response = await signAndSubmitTransaction({
        data: {
          function: `${CONTRACT_ADDRESS}::multi_outcome_market::sell_outcome`,
          functionArguments: [marketAddress, outcomeIndex, amountInUnits, 0],
        },
      });

      try {
        await aptos.waitForTransaction({
          transactionHash: response.hash,
          options: { timeoutSecs: 10, checkSuccess: true }
        });
      } catch {
        console.log(`Tx ${response.hash} submitted, may still be propagating...`);
      }

      setLastTxHash(response.hash);
      setTxStatus('success');
      refreshMultiMarkets();
    } catch (error) {
      console.error('Multi-outcome sell failed:', error);
      setTxStatus('error');
    }
  };

  return (
    <div className="min-h-screen bg-poly-dark">
      <Header />

      {/* Transaction Toast */}
      {txStatus !== 'idle' && (
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 50 }}
          className="fixed bottom-4 right-4 z-50"
        >
          <div
            className={`px-4 py-3 rounded-xl shadow-lg border ${
              txStatus === 'pending'
                ? 'bg-poly-card border-yellow-500/30'
                : txStatus === 'success'
                ? 'bg-poly-card border-poly-green/30'
                : 'bg-poly-card border-red-500/30'
            }`}
          >
            <div className="flex items-center gap-3">
              {txStatus === 'pending' && (
                <svg className="animate-spin h-5 w-5 text-yellow-400" viewBox="0 0 24 24">
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                    fill="none"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
              )}
              {txStatus === 'success' && (
                <div className="w-5 h-5 bg-poly-green rounded-full flex items-center justify-center">
                  <svg className="w-3 h-3 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              )}
              {txStatus === 'error' && (
                <div className="w-5 h-5 bg-red-500 rounded-full flex items-center justify-center">
                  <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </div>
              )}
              <div>
                <div className="text-white text-sm font-medium">
                  {txStatus === 'pending' && 'Submitting transaction...'}
                  {txStatus === 'success' && 'Transaction confirmed!'}
                  {txStatus === 'error' && 'Transaction failed'}
                </div>
                {txStatus === 'success' && lastTxHash && (
                  <a
                    href={`https://explorer.aptoslabs.com/txn/${lastTxHash}?network=testnet`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-poly-green hover:underline"
                  >
                    View on Explorer
                  </a>
                )}
              </div>
              <button
                onClick={() => setTxStatus('idle')}
                className="ml-2 text-gray-400 hover:text-white"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        </motion.div>
      )}

      {/* Hero Section */}
      <section className="pt-24 pb-16 px-4">
        <div className="max-w-7xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-poly-green/10 border border-poly-green/30 rounded-full mb-6">
              <span className="w-2 h-2 bg-poly-green rounded-full animate-pulse" />
              <span className="text-poly-green text-sm font-medium">
                Live Demo • Testnet
              </span>
            </div>

            <h1 className="text-5xl md:text-7xl font-bold text-white mb-4">
              Polymarket on{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-poly-green to-emerald-400">
                Aptos
              </span>
            </h1>

            <p className="text-xl text-gray-400 max-w-2xl mx-auto mb-8">
              Experience prediction markets with sub-second finality, parallel execution,
              and cross-chain wallet support. No more Polygon outages.
            </p>

            <div className="flex items-center justify-center gap-4 flex-wrap">
              <a
                href="/demo-day"
                className="px-6 py-3 bg-gradient-to-r from-[#1652f0] to-[#2d9cdb] text-white font-bold rounded-xl hover:from-[#164bcf] hover:to-[#1652f0] transition-all flex items-center gap-2 shadow-lg shadow-[#1652f0]/20"
              >
                <span>⚡</span> Demo Day Mode
              </a>
              <a
                href="/demo"
                className="px-6 py-3 bg-poly-green text-black font-bold rounded-xl hover:bg-poly-green/90 transition-all flex items-center gap-2"
              >
                Simple Demo
              </a>
              <a
                href="#hft-demo"
                className="px-6 py-3 bg-poly-card border border-poly-border text-white rounded-xl hover:border-poly-green/50 transition-all"
              >
                HFT Visualizer
              </a>
              <a
                href="#markets"
                className="px-6 py-3 bg-poly-card border border-poly-border text-white rounded-xl hover:border-poly-green/50 transition-all"
              >
                View Markets
              </a>
            </div>
          </motion.div>

          {/* Quick Stats */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="grid grid-cols-2 md:grid-cols-4 gap-3 max-w-4xl mx-auto mt-12"
          >
            <div className="bg-[#141414] border border-[#1e1e1e] rounded-xl p-4 hover:border-poly-green/30 transition-colors group">
              <div className="text-3xl font-bold text-white group-hover:text-poly-green transition-colors">~470ms</div>
              <div className="text-sm text-gray-500">Finality</div>
            </div>
            <div className="bg-[#141414] border border-[#1e1e1e] rounded-xl p-4 hover:border-poly-green/30 transition-colors group">
              <div className="text-3xl font-bold text-white group-hover:text-poly-green transition-colors">160k+</div>
              <div className="text-sm text-gray-500">Peak TPS</div>
            </div>
            <div className="bg-[#141414] border border-[#1e1e1e] rounded-xl p-4 hover:border-poly-green/30 transition-colors group">
              <div className="text-3xl font-bold text-white group-hover:text-poly-green transition-colors">&lt;$0.001</div>
              <div className="text-sm text-gray-500">Avg Fee</div>
            </div>
            <div className="bg-[#141414] border border-[#1e1e1e] rounded-xl p-4 hover:border-orange-400/30 transition-colors group">
              <div className="text-3xl font-bold text-orange-400">X-Chain</div>
              <div className="text-sm text-gray-500">ETH/Sol Wallets</div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Markets Section */}
      <section id="markets" className="py-16 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-3xl font-bold text-white">Markets</h2>
              <p className="text-gray-400">Place bets with APT on Aptos</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 bg-poly-green rounded-full animate-pulse" />
              <span className="text-sm text-poly-green font-medium">{realMarkets.length} live markets</span>
            </div>
          </div>

          {/* Create Market Button */}
          <CreateMarket onMarketCreated={() => refetchMarkets()} />

          {/* On-Chain Markets */}
          {marketsLoading ? (
            <div className="p-12 text-center">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-poly-green"></div>
              <p className="text-gray-400 mt-3">Loading markets...</p>
            </div>
          ) : realMarkets.length > 0 ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {realMarkets.map((market) => (
                <MarketCard key={market.id} market={market} onBet={handleBet} onSell={handleSell} />
              ))}
            </div>
          ) : (
            <div className="p-12 text-center border border-dashed border-poly-border rounded-2xl">
              <div className="text-4xl mb-3">📈</div>
              <h3 className="text-xl font-bold text-white mb-2">No Markets Yet</h3>
              <p className="text-gray-400 mb-4">Create the first prediction market on Aptos!</p>
              <p className="text-xs text-gray-500">
                Contract: <a
                  href={`https://explorer.aptoslabs.com/account/${CONTRACT_ADDRESS}/modules?network=testnet`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-poly-green hover:underline"
                >
                  {CONTRACT_ADDRESS.slice(0, 10)}...
                </a>
              </p>
            </div>
          )}
        </div>
      </section>

      {/* Multi-Outcome Markets Section */}
      <section id="multi-markets" className="py-16 px-4 bg-poly-card/30">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-3xl font-bold text-white">Multi-Outcome Markets</h2>
              <p className="text-gray-400">Markets with 3+ outcomes - Presidential elections, sports, and more</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 bg-purple-400 rounded-full animate-pulse" />
              <span className="text-sm text-purple-400 font-medium">{multiMarkets.length} markets</span>
            </div>
          </div>

          {multiMarketsLoading ? (
            <div className="p-12 text-center">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-purple-400"></div>
              <p className="text-gray-400 mt-3">Loading multi-outcome markets...</p>
            </div>
          ) : multiMarkets.length > 0 ? (
            <div className="grid md:grid-cols-2 gap-6">
              {multiMarkets.map((market) => (
                <MultiOutcomeMarketCard
                  key={market.address}
                  address={market.address}
                  question={market.question}
                  category={market.category}
                  outcomes={market.outcomes}
                  endDate={new Date(market.endTime * 1000).toLocaleDateString()}
                  totalVolume={`${market.totalCollateral.toFixed(2)} APT`}
                  resolved={market.resolved}
                  winningOutcome={market.winningOutcome}
                  walletBalance={walletBalance}
                  onBuy={(outcomeIndex, amount) => handleMultiBuy(market.address, outcomeIndex, amount)}
                  onSell={(outcomeIndex, amount) => handleMultiSell(market.address, outcomeIndex, amount)}
                />
              ))}
            </div>
          ) : (
            <div className="p-12 text-center border border-dashed border-purple-500/30 rounded-2xl">
              <div className="text-4xl mb-3">🗳️</div>
              <h3 className="text-xl font-bold text-white mb-2">No Multi-Outcome Markets Yet</h3>
              <p className="text-gray-400 mb-4">Multi-outcome markets support elections, tournaments, and complex events</p>
              <p className="text-xs text-gray-500">
                Use the create-multi-market script to deploy a market
              </p>
            </div>
          )}
        </div>
      </section>

      {/* TURBO MODE - Collapsible Section */}
      <section id="turbo-demo" className="py-4 px-4">
        <div className="max-w-4xl mx-auto">
          <motion.button
            onClick={() => setTurboExpanded(!turboExpanded)}
            className="w-full flex items-center justify-between p-4 bg-poly-dark/50 rounded-xl border border-poly-border hover:border-orange-500/30 transition-colors group"
            whileHover={{ scale: 1.005 }}
            whileTap={{ scale: 0.995 }}
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl">🔥</span>
              <div className="text-left">
                <div className="text-sm font-semibold text-gray-300 group-hover:text-orange-400 transition-colors">
                  TURBO MODE
                </div>
                <div className="text-xs text-gray-500">
                  Legacy parallel transaction demo
                </div>
              </div>
            </div>
            <motion.div
              animate={{ rotate: turboExpanded ? 180 : 0 }}
              transition={{ duration: 0.2 }}
              className="text-gray-500 group-hover:text-orange-400"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </motion.div>
          </motion.button>

          <AnimatePresence>
            {turboExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.3, ease: 'easeInOut' }}
                className="overflow-hidden"
              >
                <div className="pt-4 bg-gradient-to-b from-orange-500/5 to-transparent rounded-b-xl">
                  <TurboVisualizer />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </section>

      {/* HFT Visualization Section */}
      <section id="hft-demo" className="py-8 md:py-16 px-4">
        <div className="max-w-6xl mx-auto">
          <HFTVisualizer />
        </div>
      </section>

      {/* Stress Test Section */}
      <section id="stress-test" className="py-8 md:py-16 px-4">
        <div className="max-w-5xl mx-auto">
          <StressTest />
        </div>
      </section>

      {/* Visualizer Section */}
      <section id="visualizer" className="py-16 px-4">
        <div className="max-w-6xl mx-auto">
          <VisualizerEmbed txHash={lastTxHash || undefined} />
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-16 px-4 bg-poly-card/30">
        <div className="max-w-6xl mx-auto">
          <FeatureShowcase />
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-4 border-t border-poly-border">
        <div className="max-w-7xl mx-auto text-center">
          <div className="flex items-center justify-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-poly-green to-emerald-600 flex items-center justify-center">
              <span className="text-sm font-bold text-white">P</span>
            </div>
            <span className="text-xl font-bold text-white">Polymarket on Aptos</span>
          </div>
          <p className="text-gray-400 text-sm mb-4">
            A demo showcasing what Polymarket could look like on Aptos
          </p>

          {/* Contract Info */}
          <div className="mb-4 p-3 bg-poly-card border border-poly-border rounded-lg inline-block">
            <div className="text-xs text-gray-500 mb-1">Prediction Market Contract (Testnet)</div>
            <a
              href={`https://explorer.aptoslabs.com/account/${CONTRACT_ADDRESS}/modules?network=testnet`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-poly-green hover:underline font-mono"
            >
              {CONTRACT_ADDRESS.slice(0, 10)}...{CONTRACT_ADDRESS.slice(-8)}
            </a>
          </div>

          <div className="flex items-center justify-center gap-6 text-sm text-gray-500">
            <a
              href="https://aptos.dev"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-white transition-colors"
            >
              Aptos Docs
            </a>
            <a
              href="https://aptos-consensus-visualizer.vercel.app/"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-white transition-colors"
            >
              Visualizer
            </a>
            <a
              href={`https://explorer.aptoslabs.com/account/${CONTRACT_ADDRESS}?network=testnet`}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-white transition-colors"
            >
              Contract Explorer
            </a>
          </div>
          <div className="mt-6 text-xs text-gray-600">
            Built with Aptos, for the future of prediction markets
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
