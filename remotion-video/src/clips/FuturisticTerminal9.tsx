import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
} from "remotion";

// ============================================================================
// FUTURISTIC TERMINAL 9 - Glass/Frosted macOS style with MultiMarket struct
// ============================================================================

const COLORS = {
  bg: "#0c0c0c",
  glass: "rgba(255, 255, 255, 0.05)",
  glassBorder: "rgba(255, 255, 255, 0.1)",
  blue: "#007aff",
  purple: "#af52de",
  pink: "#ff2d55",
  green: "#30d158",
  yellow: "#ffd60a",
  white: "#ffffff",
  gray: "#8e8e93",
};

const CODE_LINES = [
  { text: "/// MultiMarket - Core prediction market structure", type: "comment" },
  { text: "/// Supports 2-20 outcomes per market", type: "comment" },
  { text: "struct MultiMarket has key {", type: "keyword" },
  { text: "    /// Market identifier", type: "comment" },
  { text: "    id: u64,", type: "field" },
  { text: "", type: "empty" },
  { text: "    /// Market question/title", type: "comment" },
  { text: "    question: String,", type: "field" },
  { text: "", type: "empty" },
  { text: "    /// Number of possible outcomes (2-20)", type: "comment" },
  { text: "    outcome_count: u64,", type: "field" },
  { text: "", type: "empty" },
  { text: "    /// Outcome addresses (each is its own OutcomeMarket)", type: "comment" },
  { text: "    outcome_addresses: vector<address>,", type: "highlight" },
  { text: "", type: "empty" },
  { text: "    /// Oracle address for resolution", type: "comment" },
  { text: "    oracle: address,", type: "field" },
  { text: "", type: "empty" },
  { text: "    /// Resolution state", type: "comment" },
  { text: "    resolved: bool,", type: "field" },
  { text: "    winning_outcome: Option<u64>,", type: "field" },
  { text: "", type: "empty" },
  { text: "    /// Fee in basis points (30 = 0.3%)", type: "comment" },
  { text: "    fee_bps: u64,", type: "field" },
  { text: "", type: "empty" },
  { text: "    /// Total collateral deposited (USD1)", type: "comment" },
  { text: "    total_collateral: Aggregator<u64>,", type: "highlight" },
  { text: "}", type: "keyword" },
];

const getColor = (type: string) => {
  switch (type) {
    case "comment": return COLORS.gray;
    case "keyword": return COLORS.pink;
    case "field": return COLORS.blue;
    case "highlight": return COLORS.green;
    default: return COLORS.white;
  }
};

export const FuturisticTerminal9: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const framesPerLine = fps / 3;

  // Ambient light blobs
  const blob1X = 30 + Math.sin(frame * 0.01) * 10;
  const blob1Y = 20 + Math.cos(frame * 0.015) * 10;
  const blob2X = 70 + Math.cos(frame * 0.012) * 10;
  const blob2Y = 60 + Math.sin(frame * 0.01) * 10;

  return (
    <AbsoluteFill style={{ background: COLORS.bg }}>
      {/* Ambient light blobs */}
      <div
        style={{
          position: "absolute",
          left: `${blob1X}%`,
          top: `${blob1Y}%`,
          width: 600,
          height: 600,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${COLORS.purple}30 0%, transparent 70%)`,
          filter: "blur(80px)",
          transform: "translate(-50%, -50%)",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: `${blob2X}%`,
          top: `${blob2Y}%`,
          width: 500,
          height: 500,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${COLORS.blue}25 0%, transparent 70%)`,
          filter: "blur(80px)",
          transform: "translate(-50%, -50%)",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "80%",
          width: 700,
          height: 400,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${COLORS.pink}20 0%, transparent 70%)`,
          filter: "blur(100px)",
          transform: "translate(-50%, -50%)",
        }}
      />

      {/* Main frosted glass terminal */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          transform: "translate(-50%, -50%)",
          width: 1150,
          background: COLORS.glass,
          backdropFilter: "blur(40px) saturate(180%)",
          WebkitBackdropFilter: "blur(40px) saturate(180%)",
          borderRadius: 20,
          border: `1px solid ${COLORS.glassBorder}`,
          boxShadow: `
            0 32px 64px rgba(0, 0, 0, 0.4),
            inset 0 1px 0 rgba(255, 255, 255, 0.1)
          `,
          overflow: "hidden",
        }}
      >
        {/* Traffic light header */}
        <div
          style={{
            padding: "16px 20px",
            background: "rgba(255, 255, 255, 0.03)",
            borderBottom: `1px solid ${COLORS.glassBorder}`,
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <div style={{ display: "flex", gap: 8 }}>
            <div style={{ width: 12, height: 12, borderRadius: "50%", background: "#ff5f57" }} />
            <div style={{ width: 12, height: 12, borderRadius: "50%", background: "#febc2e" }} />
            <div style={{ width: 12, height: 12, borderRadius: "50%", background: "#28c840" }} />
          </div>
          <div
            style={{
              flex: 1,
              textAlign: "center",
              fontFamily: "SF Pro Text, -apple-system, sans-serif",
              fontSize: 13,
              color: COLORS.gray,
            }}
          >
            multi_outcome_market.move — Aptos Move
          </div>
        </div>

        {/* Code area */}
        <div style={{ padding: "24px 32px", minHeight: 580 }}>
          {CODE_LINES.map((line, i) => {
            const lineStart = fps * 0.4 + i * framesPerLine;
            const progress = interpolate(
              frame,
              [lineStart, lineStart + framesPerLine * 0.6],
              [0, 1],
              { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
            );

            const visibleChars = Math.floor(line.text.length * progress);
            const text = line.text.slice(0, visibleChars);
            const color = getColor(line.type);
            const isHighlight = line.type === "highlight";

            return (
              <div
                key={i}
                style={{
                  fontFamily: "SF Mono, Menlo, monospace",
                  fontSize: 15,
                  lineHeight: 1.75,
                  color: color,
                  opacity: progress > 0 ? 1 : 0,
                  background: isHighlight ? `${color}15` : "transparent",
                  padding: isHighlight ? "3px 10px" : "0",
                  marginLeft: isHighlight ? -10 : 0,
                  borderRadius: isHighlight ? 6 : 0,
                }}
              >
                <span style={{ color: COLORS.gray, opacity: 0.4, marginRight: 24, fontVariantNumeric: "tabular-nums" }}>
                  {String(i + 1).padStart(2, " ")}
                </span>
                {text}
                {progress > 0 && progress < 1 && (
                  <span
                    style={{
                      display: "inline-block",
                      width: 2,
                      height: 18,
                      background: COLORS.blue,
                      marginLeft: 1,
                      borderRadius: 1,
                    }}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Title */}
      <div
        style={{
          position: "absolute",
          top: 50,
          left: 80,
          opacity: interpolate(frame, [0, fps * 0.4], [0, 1]),
        }}
      >
        <div
          style={{
            fontFamily: "SF Pro Text, -apple-system, sans-serif",
            fontSize: 13,
            color: COLORS.gray,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
          }}
        >
          Aptos Move Struct
        </div>
        <div
          style={{
            fontFamily: "SF Pro Display, -apple-system, sans-serif",
            fontSize: 48,
            fontWeight: 700,
            background: `linear-gradient(135deg, ${COLORS.white}, ${COLORS.gray})`,
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}
        >
          MultiMarket
        </div>
        <div style={{ fontFamily: "SF Pro Text", fontSize: 15, color: COLORS.gray, marginTop: 6 }}>
          Prediction market core data structure
        </div>
      </div>

      {/* Feature pills */}
      <div
        style={{
          position: "absolute",
          bottom: 50,
          right: 80,
          display: "flex",
          gap: 12,
          opacity: interpolate(frame, [fps * 2, fps * 2.5], [0, 1]),
        }}
      >
        {[
          { label: "2-20 Outcomes", color: COLORS.blue },
          { label: "Parallel-Safe", color: COLORS.green },
          { label: "On-Chain Oracle", color: COLORS.purple },
        ].map((pill) => (
          <div
            key={pill.label}
            style={{
              padding: "10px 18px",
              background: `${pill.color}20`,
              border: `1px solid ${pill.color}40`,
              borderRadius: 20,
              fontFamily: "SF Pro Text",
              fontSize: 13,
              fontWeight: 500,
              color: pill.color,
            }}
          >
            {pill.label}
          </div>
        ))}
      </div>

      {/* Aptos badge */}
      <div
        style={{
          position: "absolute",
          bottom: 55,
          left: 80,
          display: "flex",
          alignItems: "center",
          gap: 10,
          opacity: 0.7,
        }}
      >
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            background: `linear-gradient(135deg, ${COLORS.blue}, ${COLORS.purple})`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: 700,
            fontSize: 18,
            color: "#fff",
          }}
        >
          A
        </div>
        <span style={{ fontFamily: "SF Pro Text", fontSize: 14, color: COLORS.white }}>
          Built on Aptos
        </span>
      </div>
    </AbsoluteFill>
  );
};
