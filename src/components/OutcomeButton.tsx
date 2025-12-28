import { motion } from 'framer-motion';

interface OutcomeButtonProps {
  label: string;
  price: number;  // 0-100 representing probability
  userBalance: number;
  isSelected: boolean;
  isWinner?: boolean;
  onClick: () => void;
}

export function OutcomeButton({
  label,
  price,
  userBalance,
  isSelected,
  isWinner,
  onClick,
}: OutcomeButtonProps) {
  // Color based on probability
  const getColorClasses = () => {
    if (isWinner) return 'bg-poly-green/20 border-poly-green text-poly-green';
    if (price >= 50) return 'bg-poly-green/10 border-poly-green/30 text-poly-green';
    if (price >= 25) return 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400';
    if (price >= 10) return 'bg-orange-500/10 border-orange-500/30 text-orange-400';
    return 'bg-gray-500/10 border-gray-500/30 text-gray-400';
  };

  return (
    <motion.button
      onClick={onClick}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      className={`
        relative p-3 rounded-xl border transition-all
        ${getColorClasses()}
        ${isSelected ? 'ring-2 ring-poly-green ring-offset-2 ring-offset-poly-dark' : ''}
        hover:brightness-110
      `}
    >
      {isWinner && (
        <div className="absolute -top-2 -right-2 bg-poly-green text-black text-xs px-2 py-0.5 rounded-full font-bold z-10">
          WINNER
        </div>
      )}

      <div className="text-2xl font-bold">{price.toFixed(1)}c</div>
      <div className="text-sm font-medium truncate mt-1">{label}</div>

      {userBalance > 0 && (
        <div className="text-xs mt-1 opacity-70 font-mono">
          {userBalance.toFixed(2)} shares
        </div>
      )}
    </motion.button>
  );
}
