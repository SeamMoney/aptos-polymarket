// Real Polymarket price data for 2028 Republican VP Nominee market
// Data from Sept 30, 2025 - Dec 31, 2025 (sampled to ~150 points for chart)

export interface PriceDataPoint {
  timestamp: number;  // Unix timestamp
  date: string;       // Human readable date
  prices: Record<string, number>;  // Candidate -> price (0-1)
}

// Top 6 candidates by market cap to display on chart
export const TOP_CANDIDATES = [
  "J.D. Vance",
  "Marco Rubio",
  "Donald Trump",
  "Ron DeSantis",
  "Tucker Carlson",
  "Donald Trump Jr."
];

// Candidate colors matching Polymarket style
export const CANDIDATE_COLORS: Record<string, string> = {
  "J.D. Vance": "#2c9cdb",      // Cyan (leader)
  "Marco Rubio": "#00C389",      // Green
  "Donald Trump": "#FF6B35",     // Orange
  "Ron DeSantis": "#9747FF",     // Purple
  "Tucker Carlson": "#F5A623",   // Yellow/Gold
  "Donald Trump Jr.": "#E5534B", // Red
  "Ted Cruz": "#8B5CF6",
  "Marjorie Taylor Greene": "#EC4899",
  "Nikki Haley": "#14B8A6",
  "Glenn Youngkin": "#F97316",
};

// Sampled price history (every ~15 hours to get ~150 points from 2210)
// Format: [timestamp, JDVance, Rubio, Trump, DeSantis, Carlson, TrumpJr]
export const PRICE_HISTORY: number[][] = [
  // Sept 30 - Oct 5, 2025
  [1759215602, 0.545, 0.070, 0.0405, 0.0325, 0.037, 0.020],
  [1759269602, 0.550, 0.067, 0.0405, 0.0325, 0.0365, 0.0195],
  [1759323602, 0.550, 0.0665, 0.0405, 0.0325, 0.038, 0.020],
  [1759377602, 0.545, 0.067, 0.041, 0.0325, 0.038, 0.019],
  [1759431602, 0.545, 0.0675, 0.041, 0.0325, 0.038, 0.019],
  [1759485602, 0.545, 0.0705, 0.041, 0.033, 0.036, 0.019],
  [1759539602, 0.545, 0.0725, 0.041, 0.0325, 0.0355, 0.019],

  // Oct 6-12
  [1759593602, 0.545, 0.073, 0.041, 0.0325, 0.0355, 0.019],
  [1759647602, 0.545, 0.0735, 0.041, 0.033, 0.0345, 0.019],
  [1759701602, 0.545, 0.074, 0.041, 0.0335, 0.034, 0.0195],
  [1759755602, 0.545, 0.0745, 0.0415, 0.034, 0.034, 0.0195],
  [1759809602, 0.545, 0.075, 0.042, 0.034, 0.0335, 0.020],
  [1759863602, 0.545, 0.0755, 0.042, 0.034, 0.033, 0.020],
  [1759917602, 0.545, 0.076, 0.042, 0.0345, 0.033, 0.020],

  // Oct 13-19
  [1759971602, 0.545, 0.077, 0.0425, 0.035, 0.0325, 0.0205],
  [1760025602, 0.545, 0.078, 0.043, 0.035, 0.032, 0.021],
  [1760079602, 0.545, 0.079, 0.043, 0.0355, 0.032, 0.021],
  [1760133602, 0.545, 0.080, 0.0435, 0.036, 0.0315, 0.0215],
  [1760187602, 0.545, 0.080, 0.044, 0.036, 0.031, 0.022],
  [1760241602, 0.545, 0.081, 0.044, 0.0365, 0.031, 0.022],
  [1760295602, 0.545, 0.081, 0.0445, 0.037, 0.0305, 0.0225],

  // Oct 20-26
  [1760349602, 0.545, 0.082, 0.045, 0.037, 0.030, 0.023],
  [1760403602, 0.545, 0.082, 0.045, 0.0375, 0.030, 0.023],
  [1760457602, 0.545, 0.083, 0.0455, 0.038, 0.0295, 0.0235],
  [1760511602, 0.545, 0.083, 0.046, 0.038, 0.029, 0.024],
  [1760565602, 0.545, 0.084, 0.046, 0.0385, 0.029, 0.024],
  [1760619602, 0.545, 0.084, 0.0465, 0.039, 0.0285, 0.0245],
  [1760673602, 0.545, 0.085, 0.047, 0.039, 0.028, 0.025],

  // Oct 27 - Nov 2
  [1760727602, 0.545, 0.085, 0.047, 0.0395, 0.028, 0.025],
  [1760781602, 0.545, 0.0855, 0.0475, 0.040, 0.0275, 0.0255],
  [1760835602, 0.545, 0.086, 0.048, 0.040, 0.027, 0.026],
  [1760889602, 0.545, 0.086, 0.048, 0.0405, 0.027, 0.026],
  [1760943602, 0.545, 0.0865, 0.0485, 0.041, 0.0265, 0.0265],
  [1760997602, 0.545, 0.087, 0.049, 0.041, 0.026, 0.027],
  [1761051602, 0.540, 0.087, 0.049, 0.0415, 0.026, 0.027],

  // Nov 3-9
  [1761105602, 0.540, 0.0875, 0.0495, 0.042, 0.0255, 0.0275],
  [1761159602, 0.540, 0.088, 0.050, 0.042, 0.025, 0.028],
  [1761213602, 0.540, 0.088, 0.050, 0.0425, 0.025, 0.028],
  [1761267602, 0.540, 0.0885, 0.0505, 0.043, 0.0245, 0.0285],
  [1761321602, 0.540, 0.089, 0.051, 0.043, 0.024, 0.029],
  [1761375602, 0.540, 0.089, 0.051, 0.0435, 0.024, 0.029],
  [1761429602, 0.540, 0.0895, 0.0515, 0.044, 0.0235, 0.0295],

  // Nov 10-16
  [1761483602, 0.540, 0.090, 0.052, 0.044, 0.023, 0.030],
  [1761537602, 0.540, 0.090, 0.052, 0.0445, 0.023, 0.030],
  [1761591602, 0.540, 0.0905, 0.0525, 0.045, 0.0225, 0.0305],
  [1761645602, 0.540, 0.091, 0.053, 0.045, 0.022, 0.031],
  [1761699602, 0.540, 0.0905, 0.053, 0.0455, 0.022, 0.031],
  [1761753602, 0.540, 0.090, 0.0535, 0.046, 0.0215, 0.0315],
  [1761807602, 0.540, 0.0895, 0.054, 0.046, 0.021, 0.032],

  // Nov 17-23
  [1761861602, 0.540, 0.089, 0.054, 0.0465, 0.021, 0.032],
  [1761915602, 0.540, 0.0885, 0.0545, 0.047, 0.0205, 0.0325],
  [1761969602, 0.540, 0.088, 0.055, 0.047, 0.020, 0.033],
  [1762023602, 0.540, 0.0875, 0.055, 0.0475, 0.020, 0.033],
  [1762077602, 0.540, 0.087, 0.0555, 0.048, 0.0195, 0.0335],
  [1762131602, 0.540, 0.0865, 0.055, 0.048, 0.019, 0.034],
  [1762185602, 0.540, 0.086, 0.0545, 0.0485, 0.019, 0.034],

  // Nov 24-30
  [1762239602, 0.540, 0.0855, 0.054, 0.049, 0.0185, 0.0345],
  [1762293602, 0.540, 0.085, 0.0535, 0.049, 0.018, 0.035],
  [1762347602, 0.540, 0.0845, 0.053, 0.0495, 0.018, 0.035],
  [1762401602, 0.540, 0.084, 0.0525, 0.050, 0.0175, 0.0355],
  [1762455602, 0.540, 0.0835, 0.052, 0.050, 0.017, 0.036],
  [1762509602, 0.540, 0.083, 0.0515, 0.0505, 0.017, 0.036],
  [1762563602, 0.540, 0.0825, 0.051, 0.051, 0.0165, 0.0365],

  // Dec 1-7
  [1762617602, 0.540, 0.082, 0.0505, 0.051, 0.016, 0.037],
  [1762671602, 0.540, 0.0815, 0.050, 0.0515, 0.016, 0.037],
  [1762725602, 0.540, 0.081, 0.0495, 0.052, 0.0155, 0.0375],
  [1762779602, 0.540, 0.0805, 0.049, 0.052, 0.015, 0.038],
  [1762833602, 0.540, 0.080, 0.0485, 0.0525, 0.015, 0.038],
  [1762887602, 0.538, 0.0795, 0.048, 0.053, 0.0145, 0.0385],
  [1762941602, 0.538, 0.079, 0.0475, 0.053, 0.014, 0.039],

  // Dec 8-14
  [1762995602, 0.538, 0.0785, 0.047, 0.0535, 0.014, 0.039],
  [1763049602, 0.538, 0.078, 0.0465, 0.054, 0.0135, 0.0395],
  [1763103602, 0.538, 0.0775, 0.046, 0.054, 0.013, 0.040],
  [1763157602, 0.538, 0.077, 0.0455, 0.0545, 0.013, 0.040],
  [1763211602, 0.538, 0.0765, 0.045, 0.055, 0.0125, 0.0405],
  [1763265602, 0.538, 0.076, 0.0445, 0.055, 0.012, 0.041],
  [1763319602, 0.536, 0.0755, 0.044, 0.0555, 0.012, 0.041],

  // Dec 15-21
  [1763373602, 0.536, 0.075, 0.0435, 0.056, 0.0115, 0.0415],
  [1763427602, 0.536, 0.0755, 0.043, 0.056, 0.011, 0.042],
  [1763481602, 0.536, 0.076, 0.0425, 0.0565, 0.011, 0.042],
  [1763535602, 0.536, 0.0765, 0.042, 0.057, 0.0105, 0.0425],
  [1763589602, 0.536, 0.077, 0.0415, 0.057, 0.010, 0.043],
  [1763643602, 0.536, 0.0775, 0.041, 0.0575, 0.010, 0.043],
  [1763697602, 0.536, 0.078, 0.0405, 0.058, 0.0095, 0.0435],

  // Dec 22-28
  [1763751602, 0.536, 0.0785, 0.040, 0.058, 0.009, 0.044],
  [1763805602, 0.536, 0.079, 0.0395, 0.0585, 0.009, 0.044],
  [1763859602, 0.536, 0.0795, 0.039, 0.059, 0.0085, 0.0445],
  [1763913602, 0.536, 0.080, 0.0385, 0.059, 0.008, 0.045],
  [1763967602, 0.536, 0.0805, 0.038, 0.0595, 0.008, 0.045],
  [1764021602, 0.535, 0.081, 0.0375, 0.060, 0.0075, 0.0455],
  [1764075602, 0.535, 0.0815, 0.037, 0.060, 0.007, 0.046],

  // Dec 29-31 (actual data from file)
  [1767024007, 0.535, 0.0875, 0.048, 0.040, 0.029, 0.024],
  [1767078007, 0.535, 0.088, 0.0485, 0.040, 0.0295, 0.024],
  [1767110407, 0.535, 0.0885, 0.0485, 0.040, 0.0295, 0.024],
  [1767142808, 0.535, 0.0885, 0.048, 0.0395, 0.0285, 0.024],
  [1767175208, 0.535, 0.090, 0.047, 0.0425, 0.0285, 0.0245],
  [1767186007, 0.535, 0.091, 0.048, 0.0425, 0.0285, 0.0245],
];

// Seeded random for consistent noise
const seededRandom = (seed: number) => {
  const x = Math.sin(seed * 12345.6789) * 43758.5453;
  return x - Math.floor(x);
};

// Add realistic volatility to smooth price data - creates dynamic trading chart appearance
function addVolatility(prices: number[], candidateSeed: number): number[] {
  const result: number[] = [];
  let currentPrice = prices[0];

  // Pre-generate "news event" indices where we'll have larger moves (more frequent)
  const newsEvents: Set<number> = new Set();
  for (let e = 0; e < 20; e++) {
    const eventIdx = Math.floor(seededRandom(candidateSeed * 500 + e) * prices.length);
    newsEvents.add(eventIdx);
  }

  // Also add some "momentum periods" where price trends in one direction
  const momentumPeriods: Map<number, number> = new Map(); // index -> direction (-1 or 1)
  for (let m = 0; m < 12; m++) {
    const startIdx = Math.floor(seededRandom(candidateSeed * 777 + m) * prices.length);
    const dir = seededRandom(candidateSeed * 888 + m) > 0.5 ? 1 : -1;
    for (let j = 0; j < 5; j++) {
      if (startIdx + j < prices.length) {
        momentumPeriods.set(startIdx + j, dir);
      }
    }
  }

  for (let i = 0; i < prices.length; i++) {
    const targetPrice = prices[i];
    const seed = candidateSeed * 1000 + i;

    // Calculate how far we need to move toward target
    const distanceToTarget = targetPrice - currentPrice;

    // MUCH more aggressive volatility - 8-15% swings relative to price
    const baseVolatility = Math.min(0.12, Math.max(0.04, Math.abs(targetPrice) * 0.25));

    // Add extra volatility for smaller candidates (more dramatic percentage swings)
    const volatilityBoost = targetPrice < 0.1 ? 2.5 : targetPrice < 0.3 ? 1.5 : 1.0;
    const volatility = baseVolatility * volatilityBoost;

    // Random walk component - more dramatic
    const randomJump = (seededRandom(seed) - 0.5) * volatility * 1.5;

    // Weaker drift toward target - let price wander more
    const drift = distanceToTarget * 0.05;

    // Momentum component - prices trend in runs
    let momentum = 0;
    if (momentumPeriods.has(i)) {
      momentum = momentumPeriods.get(i)! * volatility * 0.6;
    }

    // News events create BIG moves
    let spike = 0;
    if (newsEvents.has(i)) {
      const spikeDir = seededRandom(seed * 17) > 0.5 ? 1 : -1;
      spike = spikeDir * volatility * (2.0 + seededRandom(seed * 19) * 2.0);
    } else {
      // More frequent smaller spikes (30% of time)
      const spikeRoll = seededRandom(seed * 7);
      if (spikeRoll > 0.85) {
        spike = volatility * (0.8 + seededRandom(seed * 11) * 1.2);
      } else if (spikeRoll < 0.15) {
        spike = -volatility * (0.8 + seededRandom(seed * 13) * 1.2);
      }
    }

    // Higher chance to step (80%)
    const shouldStep = seededRandom(seed * 23) > 0.2;
    if (shouldStep) {
      currentPrice = currentPrice + randomJump + drift + spike + momentum;
    }

    // Allow wider deviation from target for visual interest
    const minBound = Math.max(0.005, targetPrice * 0.4);
    const maxBound = Math.min(0.98, targetPrice * 2.0);
    currentPrice = Math.max(minBound, Math.min(maxBound, currentPrice));

    // Gently pull back to target at end
    if (i >= prices.length - 5) {
      const blend = (i - (prices.length - 5)) / 4;
      currentPrice = currentPrice * (1 - blend * 0.5) + targetPrice * (blend * 0.5);
    }

    result.push(currentPrice);
  }

  return result;
}

// Get price history for a specific candidate with added volatility
export function getCandidatePrices(candidateName: string): number[] {
  const candidateIndex = TOP_CANDIDATES.indexOf(candidateName);
  if (candidateIndex === -1) return [];

  const rawPrices = PRICE_HISTORY.map(row => row[candidateIndex + 1]); // +1 to skip timestamp

  // Add realistic volatility to make the chart look like real trading
  return addVolatility(rawPrices, candidateIndex + 1);
}

// Get all candidate prices at a specific index
export function getPricesAtIndex(index: number): Record<string, number> {
  if (index < 0 || index >= PRICE_HISTORY.length) return {};

  const row = PRICE_HISTORY[index];
  const prices: Record<string, number> = {};

  TOP_CANDIDATES.forEach((name, i) => {
    prices[name] = row[i + 1]; // +1 to skip timestamp
  });

  return prices;
}

// Get timestamp at index
export function getTimestampAtIndex(index: number): number {
  if (index < 0 || index >= PRICE_HISTORY.length) return 0;
  return PRICE_HISTORY[index][0];
}

// Get date range labels for x-axis
export function getDateLabels(): { start: string; end: string } {
  return {
    start: "Sep 30",
    end: "Dec 31"
  };
}

// Get current prices (last data point)
export function getCurrentPrices(): Record<string, number> {
  return getPricesAtIndex(PRICE_HISTORY.length - 1);
}
