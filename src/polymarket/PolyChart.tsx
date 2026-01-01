import { useMemo, useRef, useState, useCallback, useEffect } from "react";

const CHART_WIDTH = 600;
const CHART_HEIGHT = 220;
const CHART_PADDING_RIGHT = 20;

interface OutcomeData {
  id: string;
  name: string;
  color: string;
  prices: number[];
}

interface PolyChartProps {
  outcomes: OutcomeData[];
  onIndexChange?: (index: number | null) => void;
  width?: number;
  highlightedOutcomeId?: string | null; // When set, only this outcome is fully colored
  timestamps?: number[]; // Optional real timestamps for hover labels
  autoScale?: boolean; // Auto-scale Y axis to data range (for short timeframes)
  timeRange?: string; // Time range for X-axis labels: 1H, 6H, 1D, 1W, 1M, ALL
}

// Seeded random for consistent chart patterns
const seededRandom = (seed: number) => {
  const x = Math.sin(seed * 12345.6789) * 43758.5453;
  return x - Math.floor(x);
};

// Generate realistic step-like prices that look like actual trading data
// Prices stay realistic - within reasonable bounds of current price
export const generateOutcomePrices = (
  outcomeId: string,
  currentPrice: number,  // Chart must end here
  numPoints: number,
  patternIndex: number,
  _totalOutcomes: number = 6  // How many outcomes total (for spreading)
): number[] => {
  const prices: number[] = [];

  const seed = outcomeId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) + patternIndex;
  const endPrice = Math.max(0.02, Math.min(0.98, currentPrice));

  // Start price varies but stays realistic relative to end price
  // For a 17% outcome, start might be 10-25%. For a 50% outcome, start might be 35-65%
  const patternType = patternIndex % 6;
  const variance = Math.min(0.15, endPrice * 0.5); // Variance scales with price
  let startPrice: number;

  switch (patternType) {
    case 0: startPrice = endPrice - variance * (0.5 + seededRandom(seed) * 0.5); break; // Trending up
    case 1: startPrice = endPrice + variance * (0.5 + seededRandom(seed) * 0.5); break; // Trending down
    case 2: startPrice = endPrice + (seededRandom(seed) - 0.5) * variance; break; // Sideways
    case 3: startPrice = Math.max(0.02, endPrice - variance * 1.2); break; // Strong uptrend
    case 4: startPrice = Math.min(0.98, endPrice + variance * 1.2); break; // Strong downtrend
    default: startPrice = endPrice + (seededRandom(seed) - 0.5) * variance * 0.8;
  }
  startPrice = Math.max(0.02, Math.min(0.98, startPrice));

  // Generate key price levels (step changes) - like real trading
  const numSteps = 15 + Math.floor(seededRandom(seed * 7) * 20); // 15-35 distinct price levels
  const stepPoints: { t: number; price: number }[] = [];

  // First point
  stepPoints.push({ t: 0, price: startPrice });

  // Generate random step changes throughout - realistic movements
  let currentStepPrice = startPrice;
  for (let s = 1; s < numSteps; s++) {
    const t = s / numSteps;
    const targetAtT = startPrice + (endPrice - startPrice) * t;

    // Random jump - scaled to reasonable market movements (max ~5% per step)
    const maxJump = Math.min(0.05, variance * 0.4);
    const jumpSize = (seededRandom(seed * 100 + s) - 0.5) * maxJump;
    const drift = (targetAtT - currentStepPrice) * 0.3; // Drift toward target

    // Occasional larger moves (like news events)
    const spikeChance = seededRandom(seed * 200 + s);
    let spike = 0;
    if (spikeChance > 0.92) spike = maxJump * (0.5 + seededRandom(seed * 300 + s) * 0.5); // Up spike
    else if (spikeChance < 0.08) spike = -maxJump * (0.5 + seededRandom(seed * 300 + s) * 0.5); // Down spike

    currentStepPrice = currentStepPrice + jumpSize + drift + spike;

    // Keep prices realistic - within reasonable bounds of start and end
    const minBound = Math.min(startPrice, endPrice) - variance * 0.5;
    const maxBound = Math.max(startPrice, endPrice) + variance * 0.5;
    currentStepPrice = Math.max(Math.max(0.02, minBound), Math.min(Math.min(0.98, maxBound), currentStepPrice));

    // Add some randomness to when steps occur
    const stepT = t + (seededRandom(seed * 400 + s) - 0.5) * 0.05;
    stepPoints.push({ t: Math.max(0.01, Math.min(0.99, stepT)), price: currentStepPrice });
  }

  // Last point must be end price
  stepPoints.push({ t: 1, price: endPrice });

  // Sort by time
  stepPoints.sort((a, b) => a.t - b.t);

  // Now generate the actual price array with step-like behavior
  let stepIndex = 0;
  for (let i = 0; i < numPoints; i++) {
    const t = i / (numPoints - 1);

    // Find current step level
    while (stepIndex < stepPoints.length - 1 && stepPoints[stepIndex + 1].t <= t) {
      stepIndex++;
    }

    // Get current step price (flat until next step)
    let price = stepPoints[stepIndex].price;

    // Add tiny micro-noise to make it look more realistic (very small)
    const microNoise = (seededRandom(seed * 5000 + i) - 0.5) * 0.005;
    price += microNoise;

    // Clamp to realistic bounds
    price = Math.max(0.02, Math.min(0.98, price));

    // Force exact end price
    if (i === numPoints - 1) price = endPrice;

    prices.push(price);
  }

  return prices;
};

// Generate SVG path with padding and optional scaling
const generatePath = (
  prices: number[],
  width: number,
  height: number,
  paddingRight: number = 0,
  minPrice: number = 0,
  maxPrice: number = 1
): string => {
  if (prices.length < 2) return "";

  const innerWidth = width - paddingRight;
  const priceRange = maxPrice - minPrice || 1;
  let path = "";
  for (let i = 0; i < prices.length; i++) {
    const x = (i / (prices.length - 1)) * innerWidth;
    // Scale price to 0-1 range based on min/max, then to height
    const normalizedPrice = (prices[i] - minPrice) / priceRange;
    const y = height - normalizedPrice * height;
    path += i === 0 ? `M ${x} ${y}` : ` L ${x} ${y}`;
  }
  return path;
};

export function PolyChart({ outcomes, onIndexChange, width = CHART_WIDTH, highlightedOutcomeId, timestamps, autoScale = false, timeRange = 'ALL' }: PolyChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [cursorX, setCursorX] = useState<number>(0);
  const [isTouching, setIsTouching] = useState(false);

  const numPoints = outcomes[0]?.prices.length || 100;
  const innerWidth = width - CHART_PADDING_RIGHT;

  // Calculate min/max for auto-scaling
  const { minPrice, maxPrice, yAxisLabels } = useMemo(() => {
    if (!autoScale) {
      return {
        minPrice: 0,
        maxPrice: 1,
        yAxisLabels: ['100%', '75%', '50%', '25%', '0%']
      };
    }

    // Find min/max across all outcomes
    let min = 1, max = 0;
    outcomes.forEach(outcome => {
      outcome.prices.forEach(p => {
        if (p < min) min = p;
        if (p > max) max = p;
      });
    });

    // Add 10% padding to the range
    const range = max - min || 0.1;
    const padding = range * 0.15;
    min = Math.max(0, min - padding);
    max = Math.min(1, max + padding);

    // Round to nice values
    min = Math.floor(min * 100) / 100;
    max = Math.ceil(max * 100) / 100;

    // Generate Y axis labels for the scaled range
    const labels = [];
    for (let i = 0; i <= 4; i++) {
      const val = max - (i / 4) * (max - min);
      labels.push(`${Math.round(val * 100)}%`);
    }

    return { minPrice: min, maxPrice: max, yAxisLabels: labels };
  }, [outcomes, autoScale]);

  // Pre-calculate all paths with scaling
  const chartPaths = useMemo(() => {
    const priceRange = maxPrice - minPrice || 1;

    return outcomes.map((outcome) => {
      const path = generatePath(outcome.prices, width, CHART_HEIGHT, CHART_PADDING_RIGHT, minPrice, maxPrice);
      const lastPrice = outcome.prices[outcome.prices.length - 1];
      const lastX = innerWidth;
      // Scale lastY using the same min/max
      const normalizedLastPrice = (lastPrice - minPrice) / priceRange;
      const lastY = CHART_HEIGHT - normalizedLastPrice * CHART_HEIGHT;

      return {
        id: outcome.id,
        name: outcome.name,
        color: outcome.color,
        path,
        lastX,
        lastY,
        prices: outcome.prices,
      };
    });
  }, [outcomes, width, innerWidth, minPrice, maxPrice]);

  // Calculate position from x coordinate
  const updatePosition = useCallback(
    (clientX: number) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const x = Math.max(0, Math.min(width, clientX - rect.left));
      setCursorX(x);
      const idx = Math.round((x / width) * (numPoints - 1));
      setActiveIndex(idx);
      onIndexChange?.(idx);
    },
    [width, numPoints, onIndexChange]
  );

  // Mouse events
  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (isTouching) return; // Ignore mouse events during touch
      updatePosition(e.clientX);
    },
    [updatePosition, isTouching]
  );

  const handleMouseLeave = useCallback(() => {
    if (isTouching) return;
    setActiveIndex(null);
    onIndexChange?.(null);
  }, [onIndexChange, isTouching]);

  // Touch events for mobile
  const handleTouchStart = useCallback(
    (e: React.TouchEvent<HTMLDivElement>) => {
      e.preventDefault(); // Prevent text selection and scroll
      setIsTouching(true);
      if (e.touches.length > 0) {
        updatePosition(e.touches[0].clientX);
      }
    },
    [updatePosition]
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent<HTMLDivElement>) => {
      e.preventDefault(); // Prevent scroll while dragging
      if (e.touches.length > 0) {
        updatePosition(e.touches[0].clientX);
      }
    },
    [updatePosition]
  );

  const handleTouchEnd = useCallback(() => {
    setIsTouching(false);
    setActiveIndex(null);
    onIndexChange?.(null);
  }, [onIndexChange]);

  // Prevent context menu on long press
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const preventDefault = (e: Event) => e.preventDefault();

    container.addEventListener('contextmenu', preventDefault);
    container.addEventListener('selectstart', preventDefault);

    return () => {
      container.removeEventListener('contextmenu', preventDefault);
      container.removeEventListener('selectstart', preventDefault);
    };
  }, []);

  return (
    <div className="px-4">
      <div className="flex">
        <div
          ref={containerRef}
          className="relative cursor-crosshair select-none"
          style={{
            width,
            height: CHART_HEIGHT,
            touchAction: 'none', // Disable browser touch actions
            WebkitUserSelect: 'none',
            WebkitTouchCallout: 'none',
          }}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onTouchCancel={handleTouchEnd}
        >
          <svg
            width={width}
            height={CHART_HEIGHT}
            style={{
              touchAction: 'none',
              userSelect: 'none',
            }}
          >
            {/* Grid lines - more visible */}
            {[0, 0.25, 0.5, 0.75, 1].map((pct) => (
              <line
                key={pct}
                x1={0}
                y1={CHART_HEIGHT * (1 - pct)}
                x2={width}
                y2={CHART_HEIGHT * (1 - pct)}
                stroke="#4a5568"
                strokeWidth={1}
                strokeDasharray="4,6"
                opacity={0.5}
              />
            ))}

            {/* Polymarket watermark - top right corner away from chart data */}
            <g opacity={0.15}>
              <image
                href="/images/icon-white.svg"
                x={width - 120}
                y={8}
                width={20}
                height={20}
              />
              <text
                x={width - 96}
                y={22}
                fill="#ffffff"
                fontSize={11}
                fontWeight={500}
                fontFamily="system-ui, -apple-system, sans-serif"
              >
                Polymarket
              </text>
            </g>

            {/* Chart lines - thicker strokes */}
            {chartPaths.map(({ id, path, color, lastX, lastY }) => {
              // If an outcome is highlighted, dim all others
              const isHighlighted = !highlightedOutcomeId || highlightedOutcomeId === id;
              const lineColor = isHighlighted ? color : "#4a5568";
              const lineOpacity = isHighlighted ? 1 : 0.4;
              const lineWidth = isHighlighted ? 2.5 : 1.5;

              return (
                <g key={id} style={{ opacity: lineOpacity, transition: 'opacity 0.2s ease' }}>
                  <path d={path} stroke={lineColor} strokeWidth={lineWidth} fill="none" strokeLinecap="round" strokeLinejoin="round" />
                  {/* Pulsating outer ring - only for highlighted or when none highlighted */}
                  {isHighlighted && (
                    <>
                      <circle cx={lastX} cy={lastY} r={8} fill={lineColor} opacity={0.3}>
                        <animate attributeName="r" values="5;12;5" dur="1.5s" repeatCount="indefinite" />
                        <animate attributeName="opacity" values="0.4;0;0.4" dur="1.5s" repeatCount="indefinite" />
                      </circle>
                      {/* Solid end point */}
                      <circle cx={lastX} cy={lastY} r={5} fill={lineColor} stroke="#1c2b3a" strokeWidth={2} />
                    </>
                  )}
                  {/* Small end point for dimmed lines */}
                  {!isHighlighted && (
                    <circle cx={lastX} cy={lastY} r={3} fill={lineColor} stroke="#1c2b3a" strokeWidth={1} />
                  )}
                </g>
              );
            })}
          </svg>

          {/* Cursor line */}
          {activeIndex !== null && (
            <div
              className="absolute top-0 pointer-events-none"
              style={{
                left: cursorX,
                height: CHART_HEIGHT,
                width: 1,
                backgroundColor: 'rgba(255, 255, 255, 0.6)',
              }}
            />
          )}

          {/* Hover labels */}
          {activeIndex !== null && activeIndex >= 0 && (
            <HoverLabels
              outcomes={outcomes}
              activeIndex={activeIndex}
              chartWidth={width}
              timestamps={timestamps}
              timeRange={timeRange}
            />
          )}
        </div>

        {/* Y-axis */}
        <div className="ml-3 flex flex-col justify-between select-none" style={{ height: CHART_HEIGHT }}>
          {yAxisLabels.map((label, i) => (
            <span key={i} className="text-poly-textMuted text-xs">{label}</span>
          ))}
        </div>
      </div>

      {/* X-axis - dynamic based on timeRange */}
      <div className="flex justify-between mt-1 select-none" style={{ width }}>
        {(() => {
          const now = new Date();
          const formatTime = (d: Date) => d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
          const formatDate = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

          switch (timeRange) {
            case '1H': {
              const start = new Date(now.getTime() - 60 * 60 * 1000);
              return (
                <>
                  <span className="text-poly-textMuted text-xs">{formatTime(start)}</span>
                  <span className="text-poly-textMuted text-xs">{formatTime(now)}</span>
                </>
              );
            }
            case '6H': {
              const start = new Date(now.getTime() - 6 * 60 * 60 * 1000);
              return (
                <>
                  <span className="text-poly-textMuted text-xs">{formatTime(start)}</span>
                  <span className="text-poly-textMuted text-xs">{formatTime(now)}</span>
                </>
              );
            }
            case '1D': {
              const start = new Date(now.getTime() - 24 * 60 * 60 * 1000);
              return (
                <>
                  <span className="text-poly-textMuted text-xs">{formatDate(start)}</span>
                  <span className="text-poly-textMuted text-xs">{formatDate(now)}</span>
                </>
              );
            }
            case '1W': {
              const start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
              return (
                <>
                  <span className="text-poly-textMuted text-xs">{formatDate(start)}</span>
                  <span className="text-poly-textMuted text-xs">{formatDate(now)}</span>
                </>
              );
            }
            case '1M': {
              const start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
              return (
                <>
                  <span className="text-poly-textMuted text-xs">{formatDate(start)}</span>
                  <span className="text-poly-textMuted text-xs">{formatDate(now)}</span>
                </>
              );
            }
            default: // ALL
              return (
                <>
                  <span className="text-poly-textMuted text-xs">Sep</span>
                  <span className="text-poly-textMuted text-xs">Dec</span>
                </>
              );
          }
        })()}
      </div>
    </div>
  );
}

// Hover labels component
interface HoverLabelsProps {
  outcomes: OutcomeData[];
  activeIndex: number;
  chartWidth: number;
  timestamps?: number[];
  timeRange?: string;
}

function HoverLabels({ outcomes, activeIndex, chartWidth, timestamps, timeRange = 'ALL' }: HoverLabelsProps) {
  const numPoints = outcomes[0]?.prices.length || 100;
  const LABEL_HEIGHT = 24; // Height of each label including padding
  const MIN_GAP = 4; // Minimum gap between labels

  // Generate date label based on timeRange and position
  const t = activeIndex / (numPoints - 1);
  const now = new Date();
  let dateLabel: string;

  // Use real timestamp if available
  if (timestamps && timestamps[activeIndex]) {
    const date = new Date(timestamps[activeIndex] * 1000);
    dateLabel = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } else {
    // Generate label based on timeRange
    switch (timeRange) {
      case '1H': {
        const time = new Date(now.getTime() - (1 - t) * 60 * 60 * 1000);
        dateLabel = time.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
        break;
      }
      case '6H': {
        const time = new Date(now.getTime() - (1 - t) * 6 * 60 * 60 * 1000);
        dateLabel = time.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
        break;
      }
      case '1D': {
        const time = new Date(now.getTime() - (1 - t) * 24 * 60 * 60 * 1000);
        dateLabel = time.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', hour12: true });
        break;
      }
      case '1W': {
        const time = new Date(now.getTime() - (1 - t) * 7 * 24 * 60 * 60 * 1000);
        dateLabel = time.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        break;
      }
      case '1M': {
        const time = new Date(now.getTime() - (1 - t) * 30 * 24 * 60 * 60 * 1000);
        dateLabel = time.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        break;
      }
      default: { // ALL - fallback to Sept-Dec
        const months = ["Sep", "Oct", "Nov", "Dec"];
        const monthIndex = Math.floor(t * 3.99);
        const day = Math.floor((t * 4 - monthIndex) * 28) + 1;
        dateLabel = `${months[monthIndex]} ${day}`;
      }
    }
  }

  // Calculate label positions and resolve overlaps
  const labels = outcomes
    .map((outcome) => {
      const price = outcome.prices[activeIndex];
      if (price === undefined) return null;
      const y = CHART_HEIGHT - price * CHART_HEIGHT - 12;
      const percentage = Math.round(price * 100);
      return { outcome, y, percentage };
    })
    .filter((l): l is NonNullable<typeof l> => l !== null)
    .sort((a, b) => a.y - b.y); // Sort by Y position (top to bottom)

  // Resolve overlapping labels by pushing them apart
  for (let i = 1; i < labels.length; i++) {
    const prev = labels[i - 1];
    const curr = labels[i];
    const minY = prev.y + LABEL_HEIGHT + MIN_GAP;
    if (curr.y < minY) {
      curr.y = minY;
    }
  }

  // If labels overflow bottom, push everything up
  const lastLabel = labels[labels.length - 1];
  if (lastLabel && lastLabel.y + LABEL_HEIGHT > CHART_HEIGHT) {
    const overflow = lastLabel.y + LABEL_HEIGHT - CHART_HEIGHT;
    labels.forEach(l => l.y -= overflow);
  }

  const x = (activeIndex / (numPoints - 1)) * chartWidth;

  return (
    <div
      className="absolute top-0 left-0 right-0 pointer-events-none select-none"
      style={{ height: CHART_HEIGHT }}
    >
      {/* Date at top right */}
      <span className="absolute top-0 right-12 text-poly-textMuted text-xs">
        {dateLabel}{timeRange === 'ALL' || timeRange === '1M' || timeRange === '1W' ? '' : ''}
      </span>

      {/* Price labels - positioned to avoid overlaps */}
      {labels.map(({ outcome, y, percentage }) => {
        const textColor = outcome.color === "#f5a623" ? "#000" : "#fff";

        return (
          <div
            key={outcome.id}
            className="absolute px-2 py-1 rounded text-xs font-semibold whitespace-nowrap"
            style={{
              top: Math.max(0, y),
              left: Math.min(x + 12, chartWidth - 130),
              backgroundColor: outcome.color,
              color: textColor,
            }}
          >
            {outcome.name} {percentage}%
          </div>
        );
      })}
    </div>
  );
}
