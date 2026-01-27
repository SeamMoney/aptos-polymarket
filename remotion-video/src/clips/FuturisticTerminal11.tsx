import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
} from "remotion";

// ============================================================================
// FUTURISTIC TERMINAL 11 - Brutalist/Stark with OutcomeMarket struct
// ============================================================================

const COLORS = {
  bg: "#ffffff",
  black: "#000000",
  red: "#ff0000",
  gray: "#888888",
};

const CODE_LINES = [
  { text: "/// OutcomeMarket - Individual tradeable outcome", type: "comment" },
  { text: "/// Each outcome is its own parallel-safe object", type: "comment" },
  { text: "struct OutcomeMarket has key {", type: "keyword" },
  { text: "", type: "empty" },
  { text: "    /// Parent market reference", type: "comment" },
  { text: "    market_addr: address,", type: "field" },
  { text: "", type: "empty" },
  { text: "    /// Outcome index (0 to N-1)", type: "comment" },
  { text: "    outcome_index: u64,", type: "field" },
  { text: "", type: "empty" },
  { text: "    /// Outcome name (e.g., \"Yes\", \"Trump\", \"Lakers\")", type: "comment" },
  { text: "    name: String,", type: "field" },
  { text: "", type: "empty" },
  { text: "    /// Fungible asset metadata for this outcome token", type: "comment" },
  { text: "    token_metadata: Object<Metadata>,", type: "highlight" },
  { text: "", type: "empty" },
  { text: "    /// CPMM reserves (parallel-safe aggregators)", type: "comment" },
  { text: "    reserve: Aggregator<u64>,        // Outcome tokens", type: "highlight" },
  { text: "    base_reserve: Aggregator<u64>,   // USD1 collateral", type: "highlight" },
  { text: "", type: "empty" },
  { text: "    /// Token control refs", type: "comment" },
  { text: "    mint_ref: MintRef,", type: "field" },
  { text: "    burn_ref: BurnRef,", type: "field" },
  { text: "    transfer_ref: TransferRef,", type: "field" },
  { text: "}", type: "keyword" },
];

const getColor = (type: string) => {
  switch (type) {
    case "comment": return COLORS.gray;
    case "keyword": return COLORS.red;
    case "field": return COLORS.black;
    case "highlight": return COLORS.red;
    default: return COLORS.black;
  }
};

export const FuturisticTerminal11: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const framesPerLine = fps / 3;

  return (
    <AbsoluteFill style={{ background: COLORS.bg }}>
      {/* Grid pattern */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: `
            linear-gradient(${COLORS.black}08 1px, transparent 1px),
            linear-gradient(90deg, ${COLORS.black}08 1px, transparent 1px)
          `,
          backgroundSize: "40px 40px",
        }}
      />

      {/* Large background text */}
      <div
        style={{
          position: "absolute",
          right: -100,
          top: "50%",
          transform: "translateY(-50%) rotate(-90deg)",
          fontFamily: "Helvetica Neue, Arial, sans-serif",
          fontSize: 200,
          fontWeight: 900,
          color: COLORS.black,
          opacity: 0.03,
          letterSpacing: "-0.05em",
          whiteSpace: "nowrap",
        }}
      >
        APTOS
      </div>

      {/* Main terminal */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          transform: "translate(-50%, -50%)",
          width: 1100,
          background: COLORS.bg,
          border: `4px solid ${COLORS.black}`,
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "16px 24px",
            background: COLORS.black,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div
            style={{
              fontFamily: "Helvetica Neue, Arial, sans-serif",
              fontSize: 14,
              fontWeight: 700,
              color: COLORS.bg,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
            }}
          >
            OutcomeMarket.move
          </div>
          <div
            style={{
              fontFamily: "Helvetica Neue, Arial, sans-serif",
              fontSize: 12,
              fontWeight: 500,
              color: COLORS.red,
            }}
          >
            APTOS MOVE
          </div>
        </div>

        {/* Code */}
        <div style={{ padding: "28px 32px", minHeight: 540 }}>
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
                  fontFamily: "IBM Plex Mono, Menlo, monospace",
                  fontSize: 15,
                  lineHeight: 1.8,
                  color: color,
                  fontWeight: isHighlight ? 700 : 400,
                  opacity: progress > 0 ? 1 : 0,
                  background: isHighlight ? COLORS.black : "transparent",
                  color: isHighlight ? COLORS.bg : color,
                  padding: isHighlight ? "4px 12px" : "0",
                  marginLeft: isHighlight ? -12 : 0,
                  display: "inline-block",
                  width: isHighlight ? "auto" : "100%",
                }}
              >
                <span style={{ color: isHighlight ? COLORS.gray : COLORS.gray, marginRight: 28, fontWeight: 400 }}>
                  {String(i + 1).padStart(2, "0")}
                </span>
                {text}
                {progress > 0 && progress < 1 && (
                  <span
                    style={{
                      display: "inline-block",
                      width: 12,
                      height: 20,
                      background: COLORS.red,
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
          top: 50,
          left: 80,
          opacity: interpolate(frame, [0, fps * 0.4], [0, 1]),
        }}
      >
        <div
          style={{
            fontFamily: "Helvetica Neue, Arial, sans-serif",
            fontSize: 12,
            fontWeight: 500,
            color: COLORS.gray,
            letterSpacing: "0.2em",
            textTransform: "uppercase",
          }}
        >
          Data Structure
        </div>
        <div
          style={{
            fontFamily: "Helvetica Neue, Arial, sans-serif",
            fontSize: 56,
            fontWeight: 900,
            color: COLORS.black,
            letterSpacing: "-0.03em",
          }}
        >
          OutcomeMarket
        </div>
        <div
          style={{
            fontFamily: "Helvetica Neue, Arial, sans-serif",
            fontSize: 16,
            color: COLORS.gray,
            marginTop: 8,
          }}
        >
          Parallel-safe tradeable outcome with CPMM reserves
        </div>
      </div>

      {/* Stats */}
      <div
        style={{
          position: "absolute",
          bottom: 50,
          right: 80,
          display: "flex",
          gap: 0,
          opacity: interpolate(frame, [fps * 2, fps * 2.5], [0, 1]),
        }}
      >
        {[
          { label: "CONTENTION", value: "ZERO" },
          { label: "EXECUTION", value: "PARALLEL" },
          { label: "TPS", value: "30K+" },
        ].map((stat, i) => (
          <div
            key={stat.label}
            style={{
              padding: "16px 24px",
              border: `2px solid ${COLORS.black}`,
              borderLeft: i > 0 ? "none" : `2px solid ${COLORS.black}`,
              textAlign: "center",
            }}
          >
            <div
              style={{
                fontFamily: "Helvetica Neue, Arial, sans-serif",
                fontSize: 28,
                fontWeight: 900,
                color: COLORS.black,
              }}
            >
              {stat.value}
            </div>
            <div
              style={{
                fontFamily: "Helvetica Neue, Arial, sans-serif",
                fontSize: 10,
                fontWeight: 500,
                color: COLORS.gray,
                letterSpacing: "0.15em",
                marginTop: 4,
              }}
            >
              {stat.label}
            </div>
          </div>
        ))}
      </div>

      {/* Badge */}
      <div
        style={{
          position: "absolute",
          bottom: 55,
          left: 80,
          display: "flex",
          alignItems: "center",
          gap: 12,
        }}
      >
        <div
          style={{
            width: 40,
            height: 40,
            background: COLORS.black,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: "Helvetica Neue, Arial, sans-serif",
            fontWeight: 900,
            fontSize: 24,
            color: COLORS.bg,
          }}
        >
          A
        </div>
        <span
          style={{
            fontFamily: "Helvetica Neue, Arial, sans-serif",
            fontSize: 14,
            fontWeight: 500,
            color: COLORS.black,
          }}
        >
          APTOS NETWORK
        </span>
      </div>
    </AbsoluteFill>
  );
};
