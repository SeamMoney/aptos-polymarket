import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
} from "remotion";

// ============================================================================
// FUTURISTIC TERMINAL 5 - Retro CRT monitor with CPMM formulas
// ============================================================================

const COLORS = {
  bg: "#0a0a0a",
  phosphorGreen: "#33ff33",
  darkGreen: "#004400",
  amber: "#ffb000",
  scanline: "#003300",
  white: "#ffffff",
};

const CODE_LINES = [
  { text: "╔══════════════════════════════════════════════════════════════╗" },
  { text: "║  CPMM PRICING ENGINE :: APTOS PREDICTION MARKETS           ║" },
  { text: "╚══════════════════════════════════════════════════════════════╝" },
  { text: "" },
  { text: "/// Constant Product Market Maker (CPMM)" },
  { text: "/// Formula: x * y = k (invariant)" },
  { text: "" },
  { text: "/// BUY: tokens_out = reserve_out * amount_in / (reserve_in + amount_in)" },
  { text: "fun calculate_buy_output(" },
  { text: "    base_reserve: u64,      // Collateral reserve" },
  { text: "    outcome_reserve: u64,   // Outcome token reserve" },
  { text: "    amount_in: u64          // Collateral input" },
  { text: "): u64 {" },
  { text: "    let numerator = (outcome_reserve as u128) * (amount_in as u128);" },
  { text: "    let denominator = (base_reserve as u128) + (amount_in as u128);" },
  { text: "    ((numerator / denominator) as u64)" },
  { text: "}" },
  { text: "" },
  { text: "/// SELL: collateral_out = base * tokens / (outcome + tokens)" },
  { text: "fun calculate_sell_output(" },
  { text: "    outcome_reserve: u64," },
  { text: "    base_reserve: u64," },
  { text: "    tokens_in: u64" },
  { text: "): u64 {" },
  { text: "    let numerator = (base_reserve as u128) * (tokens_in as u128);" },
  { text: "    let denominator = (outcome_reserve as u128) + (tokens_in as u128);" },
  { text: "    ((numerator / denominator) as u64)" },
  { text: "}" },
  { text: "" },
  { text: "/// PRICE: percentage = base / (base + outcome) * 100" },
  { text: "fun calculate_price(base: u64, outcome: u64): u64 {" },
  { text: "    ((base as u128) * 100 / ((base + outcome) as u128) as u64)" },
  { text: "}" },
];

export const FuturisticTerminal5: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const framesPerLine = fps / 4;

  // CRT effects
  const scanlineOffset = (frame * 2) % 4;
  const flicker = 0.97 + Math.random() * 0.03;
  const curvature = 8;

  // Screen shake occasionally
  const shakeX = Math.sin(frame * 0.3) * (Math.sin(frame * 0.1) > 0.9 ? 2 : 0);
  const shakeY = Math.cos(frame * 0.3) * (Math.sin(frame * 0.1) > 0.9 ? 1 : 0);

  return (
    <AbsoluteFill style={{ background: "#000" }}>
      {/* CRT monitor frame */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          transform: "translate(-50%, -50%)",
          width: 1500,
          height: 950,
          background: "linear-gradient(180deg, #2a2a2a 0%, #1a1a1a 50%, #0a0a0a 100%)",
          borderRadius: 40,
          padding: 40,
          boxShadow: `
            0 0 0 8px #333,
            0 0 0 12px #222,
            0 50px 100px rgba(0,0,0,0.8),
            inset 0 0 100px rgba(0,0,0,0.5)
          `,
        }}
      >
        {/* Monitor bezel */}
        <div
          style={{
            width: "100%",
            height: "100%",
            background: COLORS.bg,
            borderRadius: 20,
            overflow: "hidden",
            position: "relative",
            boxShadow: "inset 0 0 50px rgba(0,0,0,0.8)",
          }}
        >
          {/* Screen content with curvature effect */}
          <div
            style={{
              position: "absolute",
              inset: 20,
              background: COLORS.bg,
              borderRadius: curvature,
              overflow: "hidden",
              transform: `translate(${shakeX}px, ${shakeY}px)`,
              opacity: flicker,
            }}
          >
            {/* Phosphor glow */}
            <div
              style={{
                position: "absolute",
                inset: 0,
                background: `radial-gradient(ellipse at 50% 50%, ${COLORS.phosphorGreen}08 0%, transparent 70%)`,
              }}
            />

            {/* Code content */}
            <div style={{ padding: "30px 40px", position: "relative" }}>
              {CODE_LINES.map((line, i) => {
                const lineStart = fps * 0.3 + i * framesPerLine;
                const progress = interpolate(
                  frame,
                  [lineStart, lineStart + framesPerLine * 0.4],
                  [0, 1],
                  { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
                );

                const visibleChars = Math.floor(line.text.length * progress);
                const text = line.text.slice(0, visibleChars);

                // Determine color based on content
                let color = COLORS.phosphorGreen;
                if (line.text.startsWith("///")) color = COLORS.darkGreen;
                if (line.text.includes("╔") || line.text.includes("║") || line.text.includes("╚")) color = COLORS.amber;

                return (
                  <div
                    key={i}
                    style={{
                      fontFamily: "IBM Plex Mono, Courier New, monospace",
                      fontSize: 16,
                      lineHeight: 1.6,
                      color: color,
                      opacity: progress > 0 ? 1 : 0,
                      textShadow: `0 0 10px ${color}, 0 0 20px ${color}50`,
                      letterSpacing: "0.02em",
                    }}
                  >
                    {text}
                    {progress > 0 && progress < 1 && (
                      <span
                        style={{
                          display: "inline-block",
                          width: 10,
                          height: 18,
                          background: COLORS.phosphorGreen,
                          boxShadow: `0 0 15px ${COLORS.phosphorGreen}`,
                          animation: "blink 0.5s infinite",
                        }}
                      />
                    )}
                  </div>
                );
              })}
            </div>

            {/* Scanlines */}
            <div
              style={{
                position: "absolute",
                inset: 0,
                background: `repeating-linear-gradient(
                  0deg,
                  transparent,
                  transparent 2px,
                  rgba(0,0,0,0.3) 2px,
                  rgba(0,0,0,0.3) 4px
                )`,
                backgroundPosition: `0 ${scanlineOffset}px`,
                pointerEvents: "none",
              }}
            />

            {/* Screen curvature vignette */}
            <div
              style={{
                position: "absolute",
                inset: 0,
                background: `radial-gradient(ellipse at 50% 50%, transparent 60%, rgba(0,0,0,0.4) 100%)`,
                pointerEvents: "none",
              }}
            />

            {/* Reflection */}
            <div
              style={{
                position: "absolute",
                inset: 0,
                background: `linear-gradient(135deg, ${COLORS.phosphorGreen}08 0%, transparent 30%)`,
                pointerEvents: "none",
              }}
            />
          </div>
        </div>

        {/* Monitor brand */}
        <div
          style={{
            position: "absolute",
            bottom: 12,
            left: "50%",
            transform: "translateX(-50%)",
            fontFamily: "SF Pro Display, sans-serif",
            fontSize: 14,
            color: "#555",
            letterSpacing: "0.3em",
          }}
        >
          APTOS-TRON 3000
        </div>

        {/* Power LED */}
        <div
          style={{
            position: "absolute",
            bottom: 15,
            right: 60,
            width: 10,
            height: 10,
            borderRadius: "50%",
            background: COLORS.phosphorGreen,
            boxShadow: `0 0 10px ${COLORS.phosphorGreen}`,
          }}
        />
      </div>

      {/* Title */}
      <div
        style={{
          position: "absolute",
          top: 30,
          left: 60,
          opacity: interpolate(frame, [0, fps * 0.3], [0, 1]),
        }}
      >
        <div
          style={{
            fontFamily: "IBM Plex Mono, monospace",
            fontSize: 14,
            color: COLORS.phosphorGreen,
            letterSpacing: "0.2em",
            textShadow: `0 0 10px ${COLORS.phosphorGreen}`,
          }}
        >
          [ SYSTEM BOOT ]
        </div>
        <div
          style={{
            fontFamily: "SF Pro Display, sans-serif",
            fontSize: 42,
            fontWeight: 900,
            color: COLORS.phosphorGreen,
            textShadow: `0 0 30px ${COLORS.phosphorGreen}60`,
            marginTop: 8,
          }}
        >
          CPMM Price Engine
        </div>
      </div>

      {/* Bottom info */}
      <div
        style={{
          position: "absolute",
          bottom: 30,
          left: 60,
          fontFamily: "IBM Plex Mono, monospace",
          fontSize: 12,
          color: COLORS.phosphorGreen,
          opacity: 0.7,
          textShadow: `0 0 5px ${COLORS.phosphorGreen}`,
        }}
      >
        APTOS MOVE VM v2.0 :: BLOCK-STM PARALLEL EXECUTION :: 30,000+ TPS
      </div>
    </AbsoluteFill>
  );
};
