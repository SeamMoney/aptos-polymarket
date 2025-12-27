import { motion } from 'framer-motion';

const features = [
  {
    id: 'xchain',
    title: 'X-Chain Accounts',
    subtitle: 'Bet with MetaMask',
    description:
      "Connect your Ethereum or Solana wallet directly. No bridging, no new wallet setup. Your existing users can start betting immediately.",
    icon: '🔗',
    color: 'orange',
    stats: ['100M+ ETH/Sol users', 'Zero bridging', 'Instant onboarding'],
  },
  {
    id: 'speed',
    title: 'Sub-Second Finality',
    subtitle: 'No more "Pending..."',
    description:
      "Aptos confirms transactions in ~470ms. During viral events, users don't wait—they trade. No election-night outages.",
    icon: '⚡',
    color: 'green',
    stats: ['~470ms finality', '160k+ TPS', 'Zero outages'],
  },
  {
    id: 'parallel',
    title: 'Block-STM Execution',
    subtitle: 'True Parallel Processing',
    description:
      'Unlike sequential EVM chains, Aptos executes transactions in parallel. 1000 bets process as fast as 1.',
    icon: '🧠',
    color: 'blue',
    stats: ['Parallel execution', 'MVCC optimistic', '<5% conflicts'],
  },
  {
    id: 'fees',
    title: 'Micro-Transaction Friendly',
    subtitle: 'Fees under $0.001',
    description:
      'Small bets are viable on Aptos. Retail users can place $1 bets without losing 10% to gas fees.',
    icon: '💰',
    color: 'yellow',
    stats: ['<$0.001 fees', 'No L2 needed', 'Direct settlement'],
  },
  {
    id: 'usd1',
    title: 'USD1 Stablecoin',
    subtitle: 'WLFI Integration',
    description:
      'Native USD1 stablecoin from World Liberty Financial. Designed for US regulatory compliance from day one.',
    icon: '💵',
    color: 'green',
    stats: ['US compliant', 'Cross-chain native', 'WLFI backed'],
  },
  {
    id: 'privacy',
    title: 'Confidential Transactions',
    subtitle: 'Hide Your Bets',
    description:
      'Confidential assets on Aptos let users hide bet amounts. Prevents whale manipulation and protects sensitive positions.',
    icon: '🔒',
    color: 'purple',
    stats: ['ZK-proofs', 'On-chain privacy', 'Live on testnet'],
  },
];

const colorClasses = {
  orange: {
    bg: 'bg-orange-500/10',
    border: 'border-orange-500/30',
    text: 'text-orange-400',
    glow: 'hover:shadow-orange-500/20',
  },
  green: {
    bg: 'bg-poly-green/10',
    border: 'border-poly-green/30',
    text: 'text-poly-green',
    glow: 'hover:shadow-poly-green/20',
  },
  blue: {
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/30',
    text: 'text-blue-400',
    glow: 'hover:shadow-blue-500/20',
  },
  yellow: {
    bg: 'bg-yellow-500/10',
    border: 'border-yellow-500/30',
    text: 'text-yellow-400',
    glow: 'hover:shadow-yellow-500/20',
  },
  purple: {
    bg: 'bg-purple-500/10',
    border: 'border-purple-500/30',
    text: 'text-purple-400',
    glow: 'hover:shadow-purple-500/20',
  },
};

export function FeatureShowcase() {
  return (
    <div>
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold text-white mb-2">
          Why Polymarket Belongs on Aptos
        </h2>
        <p className="text-gray-400 max-w-2xl mx-auto">
          Every feature Polymarket needs to scale globally—without building a custom L2
        </p>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {features.map((feature, index) => {
          const colors = colorClasses[feature.color as keyof typeof colorClasses];
          return (
            <motion.div
              key={feature.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className={`${colors.bg} border ${colors.border} rounded-2xl p-6 hover:shadow-lg ${colors.glow} transition-all cursor-pointer`}
            >
              <div className="text-4xl mb-4">{feature.icon}</div>

              <h3 className="text-xl font-bold text-white mb-1">{feature.title}</h3>
              <div className={`text-sm ${colors.text} mb-3`}>{feature.subtitle}</div>

              <p className="text-gray-400 text-sm mb-4 leading-relaxed">
                {feature.description}
              </p>

              <div className="flex flex-wrap gap-2">
                {feature.stats.map((stat) => (
                  <span
                    key={stat}
                    className={`px-2 py-1 text-xs ${colors.bg} ${colors.text} rounded-full`}
                  >
                    {stat}
                  </span>
                ))}
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* CTA Section */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
        className="mt-12 text-center"
      >
        <div className="inline-block p-8 bg-gradient-to-r from-poly-green/10 via-transparent to-poly-green/10 border border-poly-green/30 rounded-2xl">
          <h3 className="text-2xl font-bold text-white mb-2">
            Ready to Move to Aptos?
          </h3>
          <p className="text-gray-400 mb-4">
            Let Aptos Labs build the infrastructure. Focus on your product.
          </p>
          <div className="flex items-center justify-center gap-4">
            <button className="px-6 py-3 bg-poly-green text-black font-bold rounded-xl hover:bg-poly-green/90 transition-all">
              Schedule Demo
            </button>
            <button className="px-6 py-3 bg-poly-card border border-poly-border text-white rounded-xl hover:border-poly-green/50 transition-all">
              View Documentation
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
