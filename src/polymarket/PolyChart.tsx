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

// Real historical data from Polymarket Fed Chair market
const REAL_HISTORICAL_DATA = [
  { date: "08-06", hassett: 0.31, warsh: 0.34, waller: 0.15, rieder: 0.02 },
  { date: "08-07", hassett: 0.385, warsh: 0.34, waller: 0.17, rieder: 0.02 },
  { date: "08-08", hassett: 0.275, warsh: 0.195, waller: 0.445, rieder: 0.02 },
  { date: "08-09", hassett: 0.2, warsh: 0.195, waller: 0.305, rieder: 0.02 },
  { date: "08-10", hassett: 0.185, warsh: 0.18, waller: 0.4, rieder: 0.02 },
  { date: "08-11", hassett: 0.165, warsh: 0.19, waller: 0.415, rieder: 0.02 },
  { date: "08-12", hassett: 0.17, warsh: 0.185, waller: 0.375, rieder: 0.02 },
  { date: "08-13", hassett: 0.175, warsh: 0.175, waller: 0.34, rieder: 0.02 },
  { date: "08-14", hassett: 0.175, warsh: 0.17, waller: 0.325, rieder: 0.0135 },
  { date: "08-15", hassett: 0.165, warsh: 0.145, waller: 0.285, rieder: 0.0145 },
  { date: "08-16", hassett: 0.175, warsh: 0.145, waller: 0.295, rieder: 0.0145 },
  { date: "08-17", hassett: 0.155, warsh: 0.125, waller: 0.315, rieder: 0.043 },
  { date: "08-18", hassett: 0.155, warsh: 0.125, waller: 0.33, rieder: 0.042 },
  { date: "08-19", hassett: 0.165, warsh: 0.13, waller: 0.35, rieder: 0.028 },
  { date: "08-20", hassett: 0.155, warsh: 0.135, waller: 0.3, rieder: 0.0235 },
  { date: "09-01", hassett: 0.18, warsh: 0.15, waller: 0.28, rieder: 0.025 },
  { date: "09-15", hassett: 0.22, warsh: 0.18, waller: 0.25, rieder: 0.03 },
  { date: "09-30", hassett: 0.25, warsh: 0.20, waller: 0.22, rieder: 0.028 },
  { date: "10-15", hassett: 0.30, warsh: 0.22, waller: 0.18, rieder: 0.025 },
  { date: "10-31", hassett: 0.35, warsh: 0.25, waller: 0.16, rieder: 0.022 },
  { date: "11-15", hassett: 0.42, warsh: 0.28, waller: 0.14, rieder: 0.018 },
  { date: "11-30", hassett: 0.48, warsh: 0.30, waller: 0.13, rieder: 0.015 },
  { date: "12-17", hassett: 0.515, warsh: 0.305, waller: 0.1245, rieder: 0.0135 },
  { date: "12-18", hassett: 0.515, warsh: 0.23, waller: 0.1625, rieder: 0.029 },
  { date: "12-19", hassett: 0.515, warsh: 0.275, waller: 0.1375, rieder: 0.021 },
  { date: "12-20", hassett: 0.535, warsh: 0.195, waller: 0.1575, rieder: 0.072 },
  { date: "12-21", hassett: 0.545, warsh: 0.21, waller: 0.121, rieder: 0.0785 },
  { date: "12-22", hassett: 0.555, warsh: 0.21, waller: 0.1235, rieder: 0.071 },
  { date: "12-23", hassett: 0.61, warsh: 0.185, waller: 0.1145, rieder: 0.061 },
  { date: "12-24", hassett: 0.625, warsh: 0.215, waller: 0.0875, rieder: 0.0375 },
  { date: "12-25", hassett: 0.58, warsh: 0.225, waller: 0.1065, rieder: 0.063 },
  { date: "12-26", hassett: 0.535, warsh: 0.245, waller: 0.111, rieder: 0.055 },
  { date: "12-27", hassett: 0.475, warsh: 0.295, waller: 0.109, rieder: 0.065 },
  { date: "12-28", hassett: 0.41, warsh: 0.35, waller: 0.1135, rieder: 0.056 },
  { date: "12-29", hassett: 0.415, warsh: 0.315, waller: 0.118, rieder: 0.059 },
  { date: "12-30", hassett: 0.435, warsh: 0.325, waller: 0.1095, rieder: 0.062 },
  { date: "12-31", hassett: 0.445, warsh: 0.325, waller: 0.107, rieder: 0.0445 },
];

// Seeded random for consistent chart patterns
const seededRandom = (seed: number) => {
  const x = Math.sin(seed * 12345.6789) * 43758.5453;
  return x - Math.floor(x);
};

// Generate prices - works for ANY market with realistic patterns
export const generateOutcomePrices = (
  outcomeId: string,
  basePrice: number,
  numPoints: number,
  patternIndex: number
): number[] => {
  const prices: number[] = [];
  const dataLength = REAL_HISTORICAL_DATA.length;

  // Generate a seed from the outcomeId for consistent patterns
  const seed = outcomeId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) + patternIndex;

  // Check if we should use real historical data (for Fed Chair market)
  const useRealData = patternIndex < 4;

  for (let i = 0; i < numPoints; i++) {
    const dataIndex = Math.floor((i / numPoints) * dataLength);
    const data = REAL_HISTORICAL_DATA[Math.min(dataIndex, dataLength - 1)];

    let price: number;

    if (useRealData) {
      // Use real Fed Chair market data for first 4 outcomes
      switch (patternIndex) {
        case 0:
          price = data.hassett;
          break;
        case 1:
          price = data.warsh;
          break;
        case 2:
          price = data.waller;
          break;
        case 3:
          price = data.rieder;
          break;
        default:
          price = basePrice;
      }
    } else {
      // Generate synthetic volatile price patterns for other markets
      const t = i / numPoints;
      const rand = seededRandom(seed + i);
      const rand2 = seededRandom(seed * 2 + i);

      // Create different pattern types based on patternIndex
      const patternType = patternIndex % 6;

      let trend: number;
      switch (patternType) {
        case 0: // Volatile rising trend
          trend = basePrice * 0.4 + (basePrice * 1.0) * t;
          break;
        case 1: // Volatile falling trend
          trend = basePrice * 1.6 - (basePrice * 1.0) * t;
          break;
        case 2: // Wild swings
          trend = basePrice + Math.sin(t * 10 + seed) * 0.3 + Math.cos(t * 6) * 0.15;
          break;
        case 3: // Spike and crash
          trend = t < 0.35 ? basePrice + t * 1.2 : basePrice + 0.42 - (t - 0.35) * 0.9;
          break;
        case 4: // V-shaped recovery
          trend = t < 0.5 ? basePrice - t * 0.5 : basePrice - 0.25 + (t - 0.5) * 0.8;
          break;
        case 5: // Choppy sideways with spikes
          trend = basePrice + Math.sin(t * 18) * 0.15 + Math.cos(t * 9 + seed) * 0.1;
          break;
        default:
          trend = basePrice;
      }

      // Add significant volatility
      const volatility = (rand - 0.5) * 0.18 + (rand2 - 0.5) * 0.12;

      // Add sudden jumps/drops occasionally
      const jumpChance = seededRandom(seed * 3 + i);
      const jump = jumpChance > 0.9 ? (rand - 0.5) * 0.25 : jumpChance < 0.1 ? (rand - 0.5) * 0.25 : 0;

      price = trend + volatility + jump;
    }

    // Add small noise for realism
    const noise = (seededRandom(seed * 1000 + i) - 0.5) * 0.01;
    prices.push(Math.max(0.01, Math.min(0.99, price + noise)));
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
  const dataLength = REAL_HISTORICAL_DATA.length;
  const dataIndex = Math.floor(
    (activeIndex / (outcomes[0]?.prices.length || 100)) * dataLength
  );
  const dateData = REAL_HISTORICAL_DATA[Math.min(dataIndex, dataLength - 1)];

  return (
    <div
      className="absolute top-0 left-0 right-0 pointer-events-none select-none"
      style={{ height: CHART_HEIGHT }}
    >
      {/* Date at top right */}
      <span className="absolute top-0 right-12 text-poly-textMuted text-xs">
        {dateData?.date || ""} 2025
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
