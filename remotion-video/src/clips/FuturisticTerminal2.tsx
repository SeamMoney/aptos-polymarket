import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  Easing,
} from "remotion";

// ============================================================================
// FUTURISTIC TERMINAL 2 - Matrix rain style with create_multi_market
// ============================================================================

const COLORS = {
  bg: "#000000",
  matrixGreen: "#00ff41",
  darkGreen: "#003b00",
  cyan: "#00d4ff",
  white: "#ffffff",
  comment: "#4a9f4a",
  keyword: "#00ff41",
  function: "#7dff7d",
  type: "#00d4ff",
};

const CODE_LINES = [
  { text: "/// Create a new multi-outcome prediction market", color: COLORS.comment },
  { text: "public entry fun create_multi_market_with_collateral(", color: COLORS.keyword },
  { text: "    creator: &signer,", color: COLORS.white },
  { text: "    question: String,", color: COLORS.white },
  { text: "    description: String,", color: COLORS.white },
  { text: "    category: String,", color: COLORS.white },
  { text: "    outcome_labels: vector<String>,", color: COLORS.type },
  { text: "    end_time: u64,", color: COLORS.white },
  { text: "    initial_liquidity: u64,", color: COLORS.white },
  { text: "    collateral_metadata: Object<Metadata>,", color: COLORS.type },
  { text: ") acquires MultiMarketRegistry {", color: COLORS.keyword },
  { text: "", color: COLORS.white },
  { text: "    // Validate outcome count (2-20 outcomes)", color: COLORS.comment },
  { text: "    let outcome_count = vector::length(&outcome_labels);", color: COLORS.white },
  { text: "    assert!(outcome_count >= MIN_OUTCOMES, E_INVALID);", color: COLORS.function },
  { text: "    assert!(outcome_count <= MAX_OUTCOMES, E_INVALID);", color: COLORS.function },
  { text: "", color: COLORS.white },
  { text: "    // Create market object", color: COLORS.comment },
  { text: "    let constructor_ref = object::create_object(creator_addr);", color: COLORS.cyan },
  { text: "    let market_signer = object::generate_signer(&constructor_ref);", color: COLORS.cyan },
  { text: "", color: COLORS.white },
  { text: "    // Create separate OutcomeMarket for each outcome", color: COLORS.comment },
  { text: "    // THIS IS KEY FOR 30K TPS - PARALLEL EXECUTION!", color: COLORS.matrixGreen },
  { text: "    let i = 0;", color: COLORS.white },
  { text: "    while (i < outcome_count) {", color: COLORS.keyword },
  { text: "        let label = *vector::borrow(&outcome_labels, i);", color: COLORS.white },
  { text: "        create_outcome_market(&market_signer, market_addr, i, label);", color: COLORS.function },
  { text: "        i = i + 1;", color: COLORS.white },
  { text: "    };", color: COLORS.keyword },
  { text: "", color: COLORS.white },
  { text: "    // Register in Table (O(1) lookups)", color: COLORS.comment },
  { text: "    table::add(&mut registry.markets, market_addr, metadata);", color: COLORS.function },
  { text: "}", color: COLORS.keyword },
];

// Matrix rain characters
const MATRIX_CHARS = "アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン0123456789ABCDEF";

export const FuturisticTerminal2: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  // Generate matrix rain columns
  const columns = Array.from({ length: 60 }).map((_, i) => {
    const speed = 0.5 + (i % 5) * 0.3;
    const startY = ((i * 73 + frame * speed * 3) % 150) - 30;
    const chars = Array.from({ length: 20 }).map((_, j) => ({
      char: MATRIX_CHARS[Math.floor((i * 17 + j * 31 + frame * 0.5) % MATRIX_CHARS.length)],
      opacity: 1 - j * 0.05,
    }));
    return { x: i * (1920 / 60), y: startY, chars, brightness: 0.3 + (i % 3) * 0.2 };
  });

  // Code reveal
  const totalLines = CODE_LINES.length;
  const framesPerLine = fps / 3;

  return (
    <AbsoluteFill style={{ background: COLORS.bg }}>
      {/* Matrix rain background */}
      {columns.map((col, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: col.x,
            top: `${col.y}%`,
            fontFamily: "MS Gothic, monospace",
            fontSize: 18,
            lineHeight: 1.2,
            opacity: col.brightness * 0.4,
            textShadow: `0 0 10px ${COLORS.matrixGreen}`,
          }}
        >
          {col.chars.map((c, j) => (
            <div
              key={j}
              style={{
                color: j === 0 ? COLORS.white : COLORS.matrixGreen,
                opacity: c.opacity,
              }}
            >
              {c.char}
            </div>
          ))}
        </div>
      ))}

      {/* Central code panel */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          transform: "translate(-50%, -50%)",
          width: 1300,
          background: "rgba(0, 20, 0, 0.92)",
          border: `2px solid ${COLORS.matrixGreen}50`,
          borderRadius: 8,
          boxShadow: `
            0 0 100px ${COLORS.matrixGreen}20,
            inset 0 0 100px ${COLORS.matrixGreen}05
          `,
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "12px 20px",
            borderBottom: `1px solid ${COLORS.matrixGreen}30`,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div
            style={{
              fontFamily: "Courier New, monospace",
              fontSize: 14,
              color: COLORS.matrixGreen,
              letterSpacing: "0.15em",
            }}
          >
            [APTOS://CONTRACTS/MULTI_OUTCOME_MARKET.MOVE]
          </div>
          <div
            style={{
              fontFamily: "Courier New, monospace",
              fontSize: 12,
              color: COLORS.cyan,
            }}
          >
            {`LINES: ${CODE_LINES.length} | ENCODING: UTF-8 | MOVE 2.0`}
          </div>
        </div>

        {/* Code content */}
        <div style={{ padding: "20px 30px", minHeight: 650 }}>
          {CODE_LINES.map((line, i) => {
            const lineStart = fps * 0.5 + i * framesPerLine;
            const progress = interpolate(
              frame,
              [lineStart, lineStart + framesPerLine * 0.6],
              [0, 1],
              { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
            );

            const visibleChars = Math.floor(line.text.length * progress);
            const text = line.text.slice(0, visibleChars);

            return (
              <div
                key={i}
                style={{
                  fontFamily: "Fira Code, Courier New, monospace",
                  fontSize: 15,
                  lineHeight: 1.7,
                  color: line.color,
                  opacity: progress > 0 ? 1 : 0,
                  textShadow: line.color === COLORS.matrixGreen ? `0 0 20px ${COLORS.matrixGreen}` : "none",
                }}
              >
                <span style={{ color: COLORS.darkGreen, marginRight: 20 }}>
                  {String(i + 286).padStart(3, "0")}
                </span>
                {text}
                {progress > 0 && progress < 1 && (
                  <span
                    style={{
                      color: COLORS.matrixGreen,
                      textShadow: `0 0 10px ${COLORS.matrixGreen}`,
                    }}
                  >
                    █
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {/* Scanline overlay */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: `repeating-linear-gradient(
              0deg,
              transparent,
              transparent 2px,
              rgba(0,0,0,0.1) 2px,
              rgba(0,0,0,0.1) 4px
            )`,
            pointerEvents: "none",
          }}
        />
      </div>

      {/* Title */}
      <div
        style={{
          position: "absolute",
          top: 50,
          left: 80,
          opacity: interpolate(frame, [0, fps * 0.5], [0, 1]),
        }}
      >
        <div
          style={{
            fontFamily: "Courier New, monospace",
            fontSize: 16,
            color: COLORS.cyan,
            letterSpacing: "0.2em",
            marginBottom: 8,
          }}
        >
          &gt; INITIALIZING MODULE
        </div>
        <div
          style={{
            fontFamily: "SF Pro Display, sans-serif",
            fontSize: 52,
            fontWeight: 900,
            color: COLORS.matrixGreen,
            textShadow: `0 0 30px ${COLORS.matrixGreen}80`,
          }}
        >
          create_multi_market()
        </div>
        <div
          style={{
            fontFamily: "Courier New, monospace",
            fontSize: 14,
            color: COLORS.comment,
            marginTop: 10,
          }}
        >
          Polymarket-style prediction market with up to 20 outcomes
        </div>
      </div>

      {/* Bottom stats */}
      <div
        style={{
          position: "absolute",
          bottom: 50,
          left: 0,
          right: 0,
          display: "flex",
          justifyContent: "center",
          gap: 60,
          opacity: interpolate(frame, [fps * 2, fps * 2.5], [0, 0.9]),
        }}
      >
        {[
          { label: "OUTCOMES", value: "2-20", icon: "◆" },
          { label: "COLLATERAL", value: "USD1", icon: "◈" },
          { label: "PARALLELIZATION", value: "PER-OUTCOME", icon: "◇" },
        ].map((stat) => (
          <div
            key={stat.label}
            style={{
              textAlign: "center",
              padding: "12px 24px",
              border: `1px solid ${COLORS.matrixGreen}40`,
              background: `${COLORS.matrixGreen}08`,
            }}
          >
            <div style={{ fontSize: 20, color: COLORS.matrixGreen, marginBottom: 4 }}>
              {stat.icon}
            </div>
            <div
              style={{
                fontFamily: "Courier New, monospace",
                fontSize: 22,
                fontWeight: 700,
                color: COLORS.matrixGreen,
                textShadow: `0 0 10px ${COLORS.matrixGreen}60`,
              }}
            >
              {stat.value}
            </div>
            <div
              style={{
                fontFamily: "Courier New, monospace",
                fontSize: 10,
                color: COLORS.comment,
                letterSpacing: "0.15em",
                marginTop: 4,
              }}
            >
              {stat.label}
            </div>
          </div>
        ))}
      </div>
    </AbsoluteFill>
  );
};
