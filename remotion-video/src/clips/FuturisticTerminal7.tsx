import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
} from "remotion";

// ============================================================================
// FUTURISTIC TERMINAL 7 - Tron-inspired neon grid with resolve_market
// ============================================================================

const COLORS = {
  bg: "#000814",
  tronBlue: "#00d4ff",
  tronOrange: "#ff6600",
  white: "#ffffff",
  gray: "#4a5568",
  darkBlue: "#001d3d",
};

const CODE_LINES = [
  { text: "/// Resolve a market with the winning outcome", type: "comment" },
  { text: "/// Only callable by oracle or after dispute period", type: "comment" },
  { text: "public entry fun resolve_market(", type: "keyword" },
  { text: "    resolver: &signer,", type: "param" },
  { text: "    market_addr: address,", type: "param" },
  { text: "    winning_outcome: u64,", type: "param" },
  { text: ") acquires MultiMarket, OutcomeMarket {", type: "keyword" },
  { text: "", type: "empty" },
  { text: "    let market = borrow_global_mut<MultiMarket>(market_addr);", type: "code" },
  { text: "    assert!(!market.resolved, E_MARKET_ALREADY_RESOLVED);", type: "assert" },
  { text: "    assert!(winning_outcome < market.outcome_count, E_INVALID_OUTCOME);", type: "assert" },
  { text: "", type: "empty" },
  { text: "    // Verify resolver is authorized oracle", type: "comment" },
  { text: "    let resolver_addr = signer::address_of(resolver);", type: "code" },
  { text: "    assert!(resolver_addr == market.oracle, E_UNAUTHORIZED);", type: "assert" },
  { text: "", type: "empty" },
  { text: "    // Mark market as resolved", type: "comment" },
  { text: "    market.resolved = true;", type: "highlight" },
  { text: "    market.winning_outcome = option::some(winning_outcome);", type: "highlight" },
  { text: "", type: "empty" },
  { text: "    // Emit resolution event", type: "comment" },
  { text: "    event::emit(MarketResolved {", type: "event" },
  { text: "        market_addr,", type: "param" },
  { text: "        winning_outcome,", type: "param" },
  { text: "        resolved_at: timestamp::now_seconds(),", type: "param" },
  { text: "    });", type: "event" },
  { text: "}", type: "keyword" },
];

const getColor = (type: string) => {
  switch (type) {
    case "comment": return COLORS.gray;
    case "keyword": return COLORS.tronBlue;
    case "param": return COLORS.tronOrange;
    case "highlight": return COLORS.tronBlue;
    case "assert": return COLORS.tronOrange;
    case "event": return "#00ff88";
    default: return COLORS.white;
  }
};

export const FuturisticTerminal7: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const framesPerLine = fps / 3.5;

  // Grid animation
  const gridOffset = (frame * 2) % 100;

  // Perspective lines
  const perspectiveLines = Array.from({ length: 20 }).map((_, i) => {
    const progress = ((i * 5 + frame * 0.5) % 100) / 100;
    return {
      y: 1080 - progress * 600,
      opacity: progress,
      width: 2 + progress * 3,
    };
  });

  return (
    <AbsoluteFill style={{ background: COLORS.bg }}>
      {/* Tron grid floor */}
      <svg
        style={{ position: "absolute", inset: 0, opacity: 0.6 }}
        viewBox="0 0 1920 1080"
        preserveAspectRatio="none"
      >
        {/* Horizontal grid lines with perspective */}
        {Array.from({ length: 30 }).map((_, i) => {
          const y = 600 + i * 20 + gridOffset;
          const opacity = Math.max(0, 1 - (y - 600) / 500);
          return (
            <line
              key={`h${i}`}
              x1={0}
              y1={y}
              x2={1920}
              y2={y}
              stroke={COLORS.tronBlue}
              strokeWidth={1}
              opacity={opacity * 0.5}
            />
          );
        })}

        {/* Vertical grid lines converging to horizon */}
        {Array.from({ length: 40 }).map((_, i) => {
          const x = i * 50 - 50;
          const horizonX = 960;
          const horizonY = 600;
          return (
            <line
              key={`v${i}`}
              x1={x}
              y1={1080}
              x2={horizonX + (x - horizonX) * 0.1}
              y2={horizonY}
              stroke={COLORS.tronBlue}
              strokeWidth={1}
              opacity={0.3}
            />
          );
        })}

        {/* Horizon glow */}
        <ellipse
          cx={960}
          cy={600}
          rx={800}
          ry={20}
          fill={COLORS.tronBlue}
          opacity={0.2}
        />
      </svg>

      {/* Perspective speed lines */}
      {perspectiveLines.map((line, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: 960 - line.width / 2,
            top: line.y,
            width: line.width,
            height: 2,
            background: COLORS.tronBlue,
            opacity: line.opacity * 0.3,
            boxShadow: `0 0 10px ${COLORS.tronBlue}`,
          }}
        />
      ))}

      {/* Main terminal */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          transform: "translate(-50%, -55%)",
          width: 1200,
          background: `${COLORS.darkBlue}e5`,
          borderRadius: 4,
          border: `2px solid ${COLORS.tronBlue}`,
          boxShadow: `
            0 0 40px ${COLORS.tronBlue}40,
            0 0 80px ${COLORS.tronBlue}20,
            inset 0 0 40px ${COLORS.tronBlue}10
          `,
          overflow: "hidden",
        }}
      >
        {/* Header bar */}
        <div
          style={{
            padding: "12px 24px",
            background: `linear-gradient(90deg, ${COLORS.tronBlue}20, transparent)`,
            borderBottom: `1px solid ${COLORS.tronBlue}50`,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div
              style={{
                width: 30,
                height: 30,
                border: `2px solid ${COLORS.tronBlue}`,
                borderRadius: 4,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <div
                style={{
                  width: 12,
                  height: 12,
                  background: COLORS.tronBlue,
                  boxShadow: `0 0 10px ${COLORS.tronBlue}`,
                }}
              />
            </div>
            <span
              style={{
                fontFamily: "SF Mono, monospace",
                fontSize: 14,
                color: COLORS.tronBlue,
                letterSpacing: "0.15em",
                textShadow: `0 0 10px ${COLORS.tronBlue}`,
              }}
            >
              GRID://MARKET_RESOLUTION.MOVE
            </span>
          </div>
          <div
            style={{
              fontFamily: "SF Mono, monospace",
              fontSize: 12,
              color: COLORS.tronOrange,
              textShadow: `0 0 8px ${COLORS.tronOrange}`,
            }}
          >
            SECTOR 7G :: LIVE
          </div>
        </div>

        {/* Code */}
        <div style={{ padding: "20px 28px", minHeight: 520 }}>
          {CODE_LINES.map((line, i) => {
            const lineStart = fps * 0.3 + i * framesPerLine;
            const progress = interpolate(
              frame,
              [lineStart, lineStart + framesPerLine * 0.5],
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
                  fontFamily: "Fira Code, SF Mono, monospace",
                  fontSize: 14,
                  lineHeight: 1.7,
                  color: color,
                  opacity: progress > 0 ? 1 : 0,
                  textShadow: isHighlight ? `0 0 10px ${color}` : "none",
                  background: isHighlight ? `${color}15` : "transparent",
                  padding: isHighlight ? "2px 8px" : "0",
                  marginLeft: isHighlight ? -8 : 0,
                  borderLeft: isHighlight ? `2px solid ${color}` : "none",
                }}
              >
                <span style={{ color: COLORS.tronBlue, opacity: 0.4, marginRight: 20, fontSize: 12 }}>
                  {String(i + 1).padStart(2, "0")}
                </span>
                {text}
                {progress > 0 && progress < 1 && (
                  <span
                    style={{
                      display: "inline-block",
                      width: 2,
                      height: 16,
                      background: COLORS.tronBlue,
                      boxShadow: `0 0 10px ${COLORS.tronBlue}`,
                      marginLeft: 2,
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
          top: 40,
          left: 70,
          opacity: interpolate(frame, [0, fps * 0.3], [0, 1]),
        }}
      >
        <div
          style={{
            fontFamily: "SF Mono, monospace",
            fontSize: 12,
            color: COLORS.tronOrange,
            letterSpacing: "0.3em",
            textShadow: `0 0 10px ${COLORS.tronOrange}`,
          }}
        >
          APTOS PREDICTION GRID
        </div>
        <div
          style={{
            fontFamily: "SF Pro Display, sans-serif",
            fontSize: 52,
            fontWeight: 900,
            color: COLORS.tronBlue,
            textShadow: `0 0 30px ${COLORS.tronBlue}60, 0 0 60px ${COLORS.tronBlue}30`,
          }}
        >
          resolve_market()
        </div>
        <div style={{ fontFamily: "SF Mono", fontSize: 13, color: COLORS.gray, marginTop: 6 }}>
          Finalize winning outcome :: Trigger payouts
        </div>
      </div>

      {/* Stats */}
      <div
        style={{
          position: "absolute",
          bottom: 40,
          right: 70,
          display: "flex",
          gap: 16,
          opacity: interpolate(frame, [fps * 2, fps * 2.5], [0, 1]),
        }}
      >
        {[
          { label: "FINALITY", value: "470ms", color: COLORS.tronBlue },
          { label: "GAS COST", value: "$0.001", color: COLORS.tronOrange },
          { label: "STATUS", value: "ATOMIC", color: "#00ff88" },
        ].map((stat) => (
          <div
            key={stat.label}
            style={{
              padding: "12px 20px",
              border: `1px solid ${stat.color}60`,
              background: `${stat.color}10`,
              textAlign: "center",
            }}
          >
            <div
              style={{
                fontFamily: "SF Pro Display",
                fontSize: 24,
                fontWeight: 700,
                color: stat.color,
                textShadow: `0 0 15px ${stat.color}`,
              }}
            >
              {stat.value}
            </div>
            <div style={{ fontFamily: "SF Mono", fontSize: 10, color: COLORS.gray, marginTop: 4, letterSpacing: "0.1em" }}>
              {stat.label}
            </div>
          </div>
        ))}
      </div>

      {/* Aptos badge */}
      <div
        style={{
          position: "absolute",
          bottom: 45,
          left: 70,
          display: "flex",
          alignItems: "center",
          gap: 12,
        }}
      >
        <div
          style={{
            width: 36,
            height: 36,
            border: `2px solid ${COLORS.tronBlue}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: 900,
            fontSize: 20,
            color: COLORS.tronBlue,
            textShadow: `0 0 10px ${COLORS.tronBlue}`,
          }}
        >
          A
        </div>
        <span style={{ fontFamily: "SF Pro Display", fontSize: 15, color: COLORS.white }}>
          Powered by Aptos
        </span>
      </div>
    </AbsoluteFill>
  );
};
