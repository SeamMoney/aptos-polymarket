import React from "react";
import { useCurrentFrame, useVideoConfig, interpolate, spring, Img, staticFile } from "remotion";
import { colors, fonts, springs } from "../styles/theme";

interface BloombergLayoutProps {
  screenshotPath: string;
  startFrame?: number;
}

interface TradeItem {
  type: "buy" | "sell";
  outcome: string;
  amount: string;
  price: string;
  time: string;
}

export const BloombergLayout: React.FC<BloombergLayoutProps> = ({
  screenshotPath,
  startFrame = 0,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const localFrame = frame - startFrame;
  if (localFrame < 0) return null;

  // Panel entrance animations
  const panelDelay = 8;
  const panelEntrance = (index: number) =>
    spring({
      frame: localFrame - index * panelDelay,
      fps,
      config: springs.snappy,
    });

  // Live TPS counter
  const currentTPS = Math.floor(
    interpolate(localFrame, [0, 60], [0, 30847], { extrapolateRight: "clamp" }) +
      Math.sin(localFrame * 0.2) * 500
  );

  // Generate trade feed
  const trades: TradeItem[] = Array.from({ length: 12 }).map((_, i) => ({
    type: Math.random() > 0.5 ? "buy" : "sell",
    outcome: ["YES", "NO"][Math.floor(Math.random() * 2)],
    amount: `${(Math.random() * 500 + 50).toFixed(0)}`,
    price: `${(0.3 + Math.random() * 0.4).toFixed(2)}`,
    time: `${Math.floor(Math.random() * 59)}s ago`,
  }));

  // Visible trades based on frame
  const visibleTrades = Math.min(Math.floor(localFrame / 5), trades.length);

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        background: colors.bgDeep,
        display: "grid",
        gridTemplateColumns: "280px 1fr 320px",
        gridTemplateRows: "60px 1fr 180px",
        gap: 2,
        padding: 2,
      }}
    >
      {/* TOP BAR */}
      <div
        style={{
          gridColumn: "1 / -1",
          background: `linear-gradient(90deg, ${colors.aptosGreen}20, transparent)`,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 24px",
          borderBottom: `1px solid ${colors.aptosGreen}30`,
          opacity: panelEntrance(0),
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <span
            style={{
              fontFamily: fonts.display,
              fontSize: 24,
              fontWeight: 800,
              color: colors.aptosGreen,
            }}
          >
            APTOS MARKETS
          </span>
          <span
            style={{
              fontFamily: fonts.mono,
              fontSize: 12,
              color: colors.textMuted,
              padding: "4px 12px",
              background: `${colors.aptosGreen}20`,
              borderRadius: 4,
            }}
          >
            TESTNET
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 30 }}>
          <TPSIndicator tps={currentTPS} />
          <StatusIndicator status="LIVE" />
          <ClockDisplay frame={localFrame} />
        </div>
      </div>

      {/* LEFT SIDEBAR - Stats */}
      <div
        style={{
          background: `${colors.bgDeep}`,
          borderRight: `1px solid ${colors.aptosGreen}20`,
          display: "flex",
          flexDirection: "column",
          gap: 2,
          overflow: "hidden",
          transform: `translateX(${(1 - panelEntrance(1)) * -100}%)`,
        }}
      >
        <StatPanel title="NETWORK STATS" delay={0} localFrame={localFrame}>
          <StatRow label="TPS" value={currentTPS.toLocaleString()} color={colors.aptosGreen} />
          <StatRow label="FINALITY" value="125ms" color={colors.aptosCyan} />
          <StatRow label="BLOCK" value={"#" + (1000000 + Math.floor(localFrame / 30)).toString()} color={colors.textSecondary} />
          <StatRow label="GAS" value="<0.001 APT" color={colors.aptosGreen} />
        </StatPanel>

        <StatPanel title="MARKET STATS" delay={10} localFrame={localFrame}>
          <StatRow label="24H VOL" value="$2.4M" color={colors.aptosGreen} />
          <StatRow label="MARKETS" value="156" color={colors.textSecondary} />
          <StatRow label="TRADERS" value="12,847" color={colors.aptosCyan} />
          <StatRow label="TVL" value="$8.2M" color={colors.aptosGreen} />
        </StatPanel>

        <StatPanel title="PERFORMANCE" delay={20} localFrame={localFrame}>
          <ComparisonBar label="vs Polygon" ratio={4285} />
          <ComparisonBar label="vs Ethereum" ratio={1500} />
          <ComparisonBar label="vs Solana" ratio={8} />
        </StatPanel>
      </div>

      {/* CENTER - Main View */}
      <div
        style={{
          background: colors.bgDeep,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
          overflow: "hidden",
          opacity: panelEntrance(2),
          transform: `scale(${0.9 + panelEntrance(2) * 0.1})`,
        }}
      >
        {/* Phone mockup */}
        <div
          style={{
            width: 300,
            height: 620,
            background: "#1a1a1a",
            borderRadius: 40,
            padding: 10,
            boxShadow: `
              0 30px 60px rgba(0,0,0,0.5),
              0 0 40px ${colors.aptosGreen}20
            `,
          }}
        >
          <div
            style={{
              width: "100%",
              height: "100%",
              borderRadius: 30,
              overflow: "hidden",
              position: "relative",
            }}
          >
            <Img
              src={staticFile(screenshotPath)}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
              }}
            />
            {/* Screen glow effect */}
            <div
              style={{
                position: "absolute",
                inset: 0,
                background: `radial-gradient(circle at 50% 30%, ${colors.aptosGreen}10 0%, transparent 50%)`,
                pointerEvents: "none",
              }}
            />
          </div>
        </div>

        {/* Floating labels */}
        <FloatingLabel text="INSTANT SETTLEMENT" x={-180} y={-200} delay={30} localFrame={localFrame} />
        <FloatingLabel text="PARALLEL EXECUTION" x={200} y={-150} delay={40} localFrame={localFrame} />
        <FloatingLabel text="MOVE VM" x={-150} y={200} delay={50} localFrame={localFrame} />
      </div>

      {/* RIGHT SIDEBAR - Trade Feed */}
      <div
        style={{
          background: colors.bgDeep,
          borderLeft: `1px solid ${colors.aptosGreen}20`,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          transform: `translateX(${(1 - panelEntrance(3)) * 100}%)`,
        }}
      >
        <div
          style={{
            padding: "12px 16px",
            borderBottom: `1px solid ${colors.aptosGreen}20`,
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              backgroundColor: colors.aptosGreen,
              boxShadow: `0 0 10px ${colors.aptosGreen}`,
            }}
          />
          <span
            style={{
              fontFamily: fonts.mono,
              fontSize: 12,
              color: colors.aptosGreen,
              fontWeight: 600,
            }}
          >
            LIVE TRADES
          </span>
        </div>

        <div style={{ flex: 1, overflow: "hidden", padding: "8px 0" }}>
          {trades.slice(0, visibleTrades).map((trade, i) => (
            <TradeRow key={i} trade={trade} index={i} localFrame={localFrame} />
          ))}
        </div>
      </div>

      {/* BOTTOM - Chart Area */}
      <div
        style={{
          gridColumn: "1 / -1",
          background: colors.bgDeep,
          borderTop: `1px solid ${colors.aptosGreen}20`,
          display: "flex",
          gap: 2,
          transform: `translateY(${(1 - panelEntrance(4)) * 100}%)`,
        }}
      >
        <MiniChart title="TPS (24H)" data={generateTPSData(localFrame)} color={colors.aptosGreen} />
        <MiniChart title="VOLUME" data={generateVolumeData(localFrame)} color={colors.aptosCyan} />
        <MiniChart title="LATENCY" data={generateLatencyData(localFrame)} color={colors.aptosGreen} />
        <NewsScroller localFrame={localFrame} />
      </div>
    </div>
  );
};

// Sub-components

const TPSIndicator: React.FC<{ tps: number }> = ({ tps }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
    <span style={{ fontFamily: fonts.mono, fontSize: 11, color: colors.textMuted }}>TPS</span>
    <span
      style={{
        fontFamily: fonts.mono,
        fontSize: 20,
        fontWeight: 700,
        color: colors.aptosGreen,
        textShadow: `0 0 10px ${colors.aptosGreen}`,
      }}
    >
      {tps.toLocaleString()}
    </span>
  </div>
);

const StatusIndicator: React.FC<{ status: string }> = ({ status }) => (
  <div
    style={{
      display: "flex",
      alignItems: "center",
      gap: 6,
      padding: "4px 12px",
      background: `${colors.aptosGreen}20`,
      borderRadius: 4,
    }}
  >
    <div
      style={{
        width: 6,
        height: 6,
        borderRadius: "50%",
        backgroundColor: colors.aptosGreen,
        boxShadow: `0 0 8px ${colors.aptosGreen}`,
      }}
    />
    <span style={{ fontFamily: fonts.mono, fontSize: 11, color: colors.aptosGreen }}>{status}</span>
  </div>
);

const ClockDisplay: React.FC<{ frame: number }> = ({ frame }) => {
  const seconds = Math.floor(frame / 30);
  const minutes = Math.floor(seconds / 60);
  const displaySeconds = seconds % 60;

  return (
    <span style={{ fontFamily: fonts.mono, fontSize: 14, color: colors.textMuted }}>
      {String(minutes).padStart(2, "0")}:{String(displaySeconds).padStart(2, "0")}
    </span>
  );
};

const StatPanel: React.FC<{
  title: string;
  delay: number;
  localFrame: number;
  children: React.ReactNode;
}> = ({ title, delay, localFrame, children }) => {
  const opacity = interpolate(localFrame - delay, [0, 15], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <div
      style={{
        padding: "12px 16px",
        borderBottom: `1px solid ${colors.aptosGreen}10`,
        opacity,
      }}
    >
      <div
        style={{
          fontFamily: fonts.mono,
          fontSize: 10,
          color: colors.textMuted,
          marginBottom: 12,
          letterSpacing: "0.1em",
        }}
      >
        {title}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>{children}</div>
    </div>
  );
};

const StatRow: React.FC<{ label: string; value: string; color: string }> = ({ label, value, color }) => (
  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
    <span style={{ fontFamily: fonts.mono, fontSize: 11, color: colors.textMuted }}>{label}</span>
    <span style={{ fontFamily: fonts.mono, fontSize: 13, fontWeight: 600, color }}>{value}</span>
  </div>
);

const ComparisonBar: React.FC<{ label: string; ratio: number }> = ({ label, ratio }) => (
  <div style={{ marginBottom: 8 }}>
    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
      <span style={{ fontFamily: fonts.mono, fontSize: 10, color: colors.textMuted }}>{label}</span>
      <span style={{ fontFamily: fonts.mono, fontSize: 10, color: colors.aptosGreen }}>{ratio}x faster</span>
    </div>
    <div style={{ height: 4, background: `${colors.aptosGreen}20`, borderRadius: 2 }}>
      <div
        style={{
          width: `${Math.min((ratio / 5000) * 100, 100)}%`,
          height: "100%",
          background: colors.aptosGreen,
          borderRadius: 2,
        }}
      />
    </div>
  </div>
);

const TradeRow: React.FC<{ trade: TradeItem; index: number; localFrame: number }> = ({ trade, index, localFrame }) => {
  const opacity = interpolate(localFrame - index * 5, [0, 10], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <div
      style={{
        padding: "8px 16px",
        display: "flex",
        alignItems: "center",
        gap: 8,
        opacity,
        borderBottom: `1px solid ${colors.aptosGreen}05`,
      }}
    >
      <div
        style={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          backgroundColor: trade.type === "buy" ? colors.aptosGreen : colors.errorRed,
        }}
      />
      <div style={{ flex: 1 }}>
        <div style={{ fontFamily: fonts.mono, fontSize: 11, color: "white" }}>
          {trade.type.toUpperCase()} {trade.outcome}
        </div>
        <div style={{ fontFamily: fonts.mono, fontSize: 9, color: colors.textMuted }}>{trade.time}</div>
      </div>
      <div style={{ textAlign: "right" }}>
        <div style={{ fontFamily: fonts.mono, fontSize: 11, color: colors.aptosGreen }}>${trade.amount}</div>
        <div style={{ fontFamily: fonts.mono, fontSize: 9, color: colors.textMuted }}>@{trade.price}</div>
      </div>
    </div>
  );
};

const FloatingLabel: React.FC<{ text: string; x: number; y: number; delay: number; localFrame: number }> = ({
  text,
  x,
  y,
  delay,
  localFrame,
}) => {
  const opacity = interpolate(localFrame - delay, [0, 20], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const offsetY = interpolate(localFrame - delay, [0, 20], [20, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <div
      style={{
        position: "absolute",
        left: `calc(50% + ${x}px)`,
        top: `calc(50% + ${y}px)`,
        transform: `translateY(${offsetY}px)`,
        opacity,
        padding: "8px 16px",
        background: `${colors.bgDeep}ee`,
        border: `1px solid ${colors.aptosGreen}40`,
        borderRadius: 8,
        fontFamily: fonts.mono,
        fontSize: 11,
        color: colors.aptosGreen,
        whiteSpace: "nowrap",
      }}
    >
      {text}
    </div>
  );
};

const MiniChart: React.FC<{ title: string; data: number[]; color: string }> = ({ title, data, color }) => {
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;

  const points = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * 100;
      const y = 100 - ((v - min) / range) * 80;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <div style={{ flex: 1, padding: "12px 16px", borderRight: `1px solid ${colors.aptosGreen}10` }}>
      <div style={{ fontFamily: fonts.mono, fontSize: 10, color: colors.textMuted, marginBottom: 8 }}>{title}</div>
      <svg viewBox="0 0 100 100" style={{ width: "100%", height: 80 }}>
        <polyline points={points} fill="none" stroke={color} strokeWidth="2" />
        <polyline
          points={`0,100 ${points} 100,100`}
          fill={`${color}20`}
          stroke="none"
        />
      </svg>
    </div>
  );
};

const NewsScroller: React.FC<{ localFrame: number }> = ({ localFrame }) => {
  const headlines = [
    "APTOS HITS 30,000+ TPS IN PRODUCTION",
    "PREDICTION MARKETS MIGRATE FROM POLYGON",
    "MOVE LANGUAGE ENABLES PARALLEL EXECUTION",
    "BLOCK-STM TECHNOLOGY REVOLUTIONIZES THROUGHPUT",
  ];

  const offset = (localFrame * 2) % (headlines.join(" • ").length * 10 + 1000);

  return (
    <div
      style={{
        flex: 2,
        padding: "12px 16px",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
      }}
    >
      <div style={{ fontFamily: fonts.mono, fontSize: 10, color: colors.textMuted, marginBottom: 8 }}>HEADLINES</div>
      <div
        style={{
          fontFamily: fonts.mono,
          fontSize: 12,
          color: colors.aptosGreen,
          whiteSpace: "nowrap",
          transform: `translateX(-${offset}px)`,
        }}
      >
        {headlines.join(" • ")} • {headlines.join(" • ")}
      </div>
    </div>
  );
};

// Data generators
const generateTPSData = (frame: number): number[] =>
  Array.from({ length: 50 }, (_, i) => 25000 + Math.sin((frame + i) * 0.1) * 5000 + Math.random() * 2000);

const generateVolumeData = (frame: number): number[] =>
  Array.from({ length: 50 }, (_, i) => 100000 + Math.sin((frame + i) * 0.05) * 50000 + Math.random() * 20000);

const generateLatencyData = (frame: number): number[] =>
  Array.from({ length: 50 }, (_, i) => 125 + Math.sin((frame + i) * 0.08) * 10 + Math.random() * 5);
