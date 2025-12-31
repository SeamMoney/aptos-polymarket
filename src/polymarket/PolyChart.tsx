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
}

// Seeded random for consistent chart patterns
const seededRandom = (seed: number) => {
  const x = Math.sin(seed * 12345.6789) * 43758.5453;
  return x - Math.floor(x);
};

// Generate prices that END at the current price - critical for accuracy
export const generateOutcomePrices = (
  outcomeId: string,
  currentPrice: number,  // This is the ACTUAL current price - chart must end here
  numPoints: number,
  patternIndex: number
): number[] => {
  const prices: number[] = [];

  // Generate a seed from the outcomeId for consistent patterns
  const seed = outcomeId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) + patternIndex;

  // Ensure current price is reasonable
  const endPrice = Math.max(0.05, Math.min(0.95, currentPrice));

  // Determine a plausible starting price based on pattern
  const patternType = patternIndex % 6;
  let startPrice: number;

  switch (patternType) {
    case 0: // Rising - started lower
      startPrice = Math.max(0.08, endPrice - 0.15 - seededRandom(seed) * 0.2);
      break;
    case 1: // Falling - started higher
      startPrice = Math.min(0.92, endPrice + 0.15 + seededRandom(seed) * 0.2);
      break;
    case 2: // Volatile around current
      startPrice = endPrice + (seededRandom(seed) - 0.5) * 0.15;
      break;
    case 3: // Spike then back down
      startPrice = endPrice - 0.05 + seededRandom(seed) * 0.1;
      break;
    case 4: // Dip then recovery
      startPrice = endPrice + 0.05 - seededRandom(seed) * 0.1;
      break;
    default: // Sideways
      startPrice = endPrice + (seededRandom(seed) - 0.5) * 0.1;
  }

  startPrice = Math.max(0.08, Math.min(0.92, startPrice));

  for (let i = 0; i < numPoints; i++) {
    const t = i / (numPoints - 1); // 0 to 1
    const rand = seededRandom(seed * 1000 + i);
    const rand2 = seededRandom(seed * 2000 + i);

    // Linear interpolation from start to end
    const baseValue = startPrice + (endPrice - startPrice) * t;

    // Add volatility that diminishes toward the end (so we hit exact price)
    const volatilityScale = Math.sin(t * Math.PI) * 0.8; // Peaks in middle, zero at ends
    const volatility = (rand - 0.5) * 0.08 * volatilityScale + (rand2 - 0.5) * 0.05 * volatilityScale;

    // Add occasional jumps in the middle portion
    let jump = 0;
    if (t > 0.1 && t < 0.9) {
      const jumpChance = seededRandom(seed * 3000 + i);
      if (jumpChance > 0.95) jump = (rand - 0.5) * 0.08;
      else if (jumpChance < 0.05) jump = (rand - 0.5) * 0.08;
    }

    let price = baseValue + volatility + jump;

    // Clamp but ensure we don't stray too far from the interpolation
    price = Math.max(0.05, Math.min(0.95, price));

    // Force exact end price on last point
    if (i === numPoints - 1) {
      price = endPrice;
    }

    prices.push(price);
  }

  return prices;
};

// Generate SVG path with padding
const generatePath = (
  prices: number[],
  width: number,
  height: number,
  paddingRight: number = 0
): string => {
  if (prices.length < 2) return "";

  const innerWidth = width - paddingRight;
  let path = "";
  for (let i = 0; i < prices.length; i++) {
    const x = (i / (prices.length - 1)) * innerWidth;
    const y = height - prices[i] * height;
    path += i === 0 ? `M ${x} ${y}` : ` L ${x} ${y}`;
  }
  return path;
};

export function PolyChart({ outcomes, onIndexChange, width = CHART_WIDTH }: PolyChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [cursorX, setCursorX] = useState<number>(0);
  const [isTouching, setIsTouching] = useState(false);

  const numPoints = outcomes[0]?.prices.length || 100;
  const innerWidth = width - CHART_PADDING_RIGHT;

  // Pre-calculate all paths
  const chartPaths = useMemo(() => {
    return outcomes.map((outcome) => {
      const path = generatePath(outcome.prices, width, CHART_HEIGHT, CHART_PADDING_RIGHT);
      const lastPrice = outcome.prices[outcome.prices.length - 1];
      const lastX = innerWidth;
      const lastY = CHART_HEIGHT - lastPrice * CHART_HEIGHT;

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
  }, [outcomes, width, innerWidth]);

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
            {/* Faint grid lines */}
            {[0, 0.25, 0.5, 0.75, 1].map((pct) => (
              <line
                key={pct}
                x1={0}
                y1={CHART_HEIGHT * (1 - pct)}
                x2={width}
                y2={CHART_HEIGHT * (1 - pct)}
                stroke="#30363D"
                strokeWidth={0.5}
                strokeDasharray="2,8"
                opacity={0.4}
              />
            ))}

            {/* Polymarket watermark - moved to left with text */}
            <g opacity={0.12}>
              <image
                href="/images/icon-white.svg"
                x={16}
                y={CHART_HEIGHT - 36}
                width={24}
                height={24}
              />
              <text
                x={44}
                y={CHART_HEIGHT - 18}
                fill="#ffffff"
                fontSize={12}
                fontWeight={600}
                fontFamily="system-ui, -apple-system, sans-serif"
              >
                Polymarket
              </text>
            </g>

            {/* Chart lines - thicker strokes */}
            {chartPaths.map(({ id, path, color, lastX, lastY }) => (
              <g key={id}>
                <path d={path} stroke={color} strokeWidth={2.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
                <circle cx={lastX} cy={lastY} r={5} fill={color} stroke="#1c2b3a" strokeWidth={2} />
              </g>
            ))}
          </svg>

          {/* Cursor line */}
          {activeIndex !== null && (
            <div
              className="absolute top-0 w-px bg-poly-textSecondary pointer-events-none"
              style={{
                left: cursorX,
                height: CHART_HEIGHT,
              }}
            />
          )}

          {/* Hover labels */}
          {activeIndex !== null && activeIndex >= 0 && (
            <HoverLabels
              outcomes={outcomes}
              activeIndex={activeIndex}
              chartWidth={width}
            />
          )}
        </div>

        {/* Y-axis */}
        <div className="ml-3 flex flex-col justify-between select-none" style={{ height: CHART_HEIGHT }}>
          <span className="text-poly-textMuted text-xs">100%</span>
          <span className="text-poly-textMuted text-xs">75%</span>
          <span className="text-poly-textMuted text-xs">50%</span>
          <span className="text-poly-textMuted text-xs">25%</span>
          <span className="text-poly-textMuted text-xs">0%</span>
        </div>
      </div>

      {/* X-axis */}
      <div className="flex justify-between mt-1 select-none" style={{ width }}>
        <span className="text-poly-textMuted text-xs">Sep</span>
        <span className="text-poly-textMuted text-xs">Dec</span>
      </div>
    </div>
  );
}

// Hover labels component
interface HoverLabelsProps {
  outcomes: OutcomeData[];
  activeIndex: number;
  chartWidth: number;
}

function HoverLabels({ outcomes, activeIndex, chartWidth }: HoverLabelsProps) {
  const numPoints = outcomes[0]?.prices.length || 100;
  const t = activeIndex / (numPoints - 1);

  // Generate date label based on position (Sept to Dec range)
  const months = ["Sep", "Oct", "Nov", "Dec"];
  const monthIndex = Math.floor(t * 3.99);
  const day = Math.floor((t * 4 - monthIndex) * 28) + 1;
  const dateLabel = `${months[monthIndex]} ${day}`;

  return (
    <div
      className="absolute top-0 left-0 right-0 pointer-events-none select-none"
      style={{ height: CHART_HEIGHT }}
    >
      {/* Date at top right */}
      <span className="absolute top-0 right-12 text-poly-textMuted text-xs">
        {dateLabel}, 2025
      </span>

      {/* Price labels */}
      {outcomes.map((outcome) => {
        const price = outcome.prices[activeIndex];
        if (price === undefined) return null;

        const y = CHART_HEIGHT - price * CHART_HEIGHT;
        const x = (activeIndex / (outcome.prices.length - 1)) * chartWidth;
        const percentage = Math.round(price * 100);

        const textColor = outcome.color === "#f5a623" ? "#000" : "#fff";

        return (
          <div
            key={outcome.id}
            className="absolute px-2 py-1 rounded text-xs font-semibold"
            style={{
              top: y - 12,
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
