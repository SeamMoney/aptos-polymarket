import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
} from "remotion";

// ============================================================================
// FUTURISTIC TERMINAL 12 - Sci-fi hologram with fee_calculation code
// ============================================================================

const COLORS = {
  bg: "#020815",
  hologram: "#00fff2",
  hologramDark: "#008b8b",
  orange: "#ff6b35",
  white: "#ffffff",
  gray: "#5a6a7a",
};

const CODE_LINES = [
  { text: "/// Fee calculation for prediction market swaps", type: "comment" },
  { text: "/// Standard: 0.3% (30 basis points)", type: "comment" },
  { text: "", type: "empty" },
  { text: "const BPS_DENOMINATOR: u64 = 10000;  // 100% = 10000 bps", type: "const" },
  { text: "const DEFAULT_FEE_BPS: u64 = 30;     // 0.3% fee", type: "const" },
  { text: "", type: "empty" },
  { text: "/// Calculate fee on swap amount", type: "comment" },
  { text: "fun calculate_fee(amount: u64, fee_bps: u64): u64 {", type: "keyword" },
  { text: "    // fee = amount * fee_bps / 10000", type: "comment" },
  { text: "    let fee = ((amount as u128) * (fee_bps as u128)", type: "highlight" },
  { text: "              / (BPS_DENOMINATOR as u128)) as u64;", type: "highlight" },
  { text: "    fee", type: "code" },
  { text: "}", type: "keyword" },
  { text: "", type: "empty" },
  { text: "/// Apply fee and return net amount", type: "comment" },
  { text: "fun apply_fee(gross: u64, market: &MultiMarket): (u64, u64) {", type: "keyword" },
  { text: "    let fee = calculate_fee(gross, market.fee_bps);", type: "code" },
  { text: "    let net = gross - fee;", type: "highlight" },
  { text: "", type: "empty" },
  { text: "    // Accumulate fees in market", type: "comment" },
  { text: "    aggregator_v2::add(&mut market.collected_fees, fee);", type: "function" },
  { text: "", type: "empty" },
  { text: "    (net, fee)", type: "code" },
  { text: "}", type: "keyword" },
];

const getColor = (type: string) => {
  switch (type) {
    case "comment": return COLORS.gray;
    case "keyword": return COLORS.hologram;
    case "const": return COLORS.orange;
    case "highlight": return COLORS.hologram;
    case "function": return COLORS.orange;
    default: return COLORS.white;
  }
};

export const FuturisticTerminal12: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const framesPerLine = fps / 3;

  // Hologram flicker
  const flicker = 0.85 + Math.sin(frame * 0.3) * 0.1 + Math.random() * 0.05;

  // Hologram scan line
  const scanY = (frame * 8) % 700;

  // Floating particles
  const particles = Array.from({ length: 40 }).map((_, i) => ({
    x: (i * 53 + frame * 0.5) % 1920,
    y: (i * 37 + frame * 0.3) % 1080,
    size: 1 + (i % 3),
    opacity: 0.2 + (i % 5) * 0.1,
  }));

  // Holographic rings
  const ringPulse = Math.sin(frame * 0.05) * 20;

  return (
    <AbsoluteFill style={{ background: COLORS.bg }}>
      {/* Radial gradient background */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `radial-gradient(ellipse at 50% 50%, ${COLORS.hologram}08 0%, transparent 60%)`,
        }}
      />

      {/* Floating particles */}
      {particles.map((p, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: p.x,
            top: p.y,
            width: p.size,
            height: p.size,
            borderRadius: "50%",
            background: COLORS.hologram,
            opacity: p.opacity,
            boxShadow: `0 0 ${p.size * 2}px ${COLORS.hologram}`,
          }}
        />
      ))}

      {/* Holographic rings */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          transform: "translate(-50%, -50%)",
          width: 1400 + ringPulse,
          height: 800 + ringPulse,
          border: `1px solid ${COLORS.hologram}20`,
          borderRadius: "50%",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          transform: "translate(-50%, -50%)",
          width: 1500 + ringPulse,
          height: 850 + ringPulse,
          border: `1px solid ${COLORS.hologram}10`,
          borderRadius: "50%",
        }}
      />

      {/* Main hologram panel */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          transform: "translate(-50%, -50%)",
          width: 1150,
          background: `linear-gradient(180deg, ${COLORS.hologram}08, ${COLORS.bg}e0)`,
          borderRadius: 8,
          border: `2px solid ${COLORS.hologram}60`,
          boxShadow: `
            0 0 60px ${COLORS.hologram}30,
            inset 0 0 60px ${COLORS.hologram}10
          `,
          overflow: "hidden",
          opacity: flicker,
        }}
      >
        {/* Scan line effect */}
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: scanY,
            height: 2,
            background: `linear-gradient(90deg, transparent, ${COLORS.hologram}50, transparent)`,
            pointerEvents: "none",
          }}
        />

        {/* Header */}
        <div
          style={{
            padding: "14px 24px",
            borderBottom: `1px solid ${COLORS.hologram}40`,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: COLORS.hologram,
                boxShadow: `0 0 15px ${COLORS.hologram}`,
              }}
            />
            <span
              style={{
                fontFamily: "SF Mono, monospace",
                fontSize: 14,
                color: COLORS.hologram,
                letterSpacing: "0.15em",
                textShadow: `0 0 10px ${COLORS.hologram}`,
              }}
            >
              HOLO://fee_calculation.move
            </span>
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "6px 12px",
              border: `1px solid ${COLORS.orange}50`,
              borderRadius: 4,
            }}
          >
            <span style={{ fontFamily: "SF Mono", fontSize: 12, color: COLORS.orange }}>
              FEE: 0.3%
            </span>
          </div>
        </div>

        {/* Code */}
        <div style={{ padding: "22px 28px", minHeight: 520 }}>
          {CODE_LINES.map((line, i) => {
            const lineStart = fps * 0.35 + i * framesPerLine;
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
                  lineHeight: 1.75,
                  color: color,
                  opacity: progress > 0 ? 1 : 0,
                  textShadow: isHighlight ? `0 0 8px ${color}` : "none",
                  background: isHighlight ? `${COLORS.hologram}10` : "transparent",
                  padding: isHighlight ? "2px 8px" : "0",
                  marginLeft: isHighlight ? -8 : 0,
                  borderLeft: isHighlight ? `2px solid ${COLORS.hologram}` : "none",
                }}
              >
                <span style={{ color: COLORS.hologram, opacity: 0.4, marginRight: 22, fontSize: 12 }}>
                  {String(i + 1).padStart(2, "0")}
                </span>
                {text}
                {progress > 0 && progress < 1 && (
                  <span
                    style={{
                      display: "inline-block",
                      width: 2,
                      height: 16,
                      background: COLORS.hologram,
                      boxShadow: `0 0 10px ${COLORS.hologram}`,
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
          top: 45,
          left: 75,
          opacity: interpolate(frame, [0, fps * 0.35], [0, 1]),
        }}
      >
        <div
          style={{
            fontFamily: "SF Mono, monospace",
            fontSize: 12,
            color: COLORS.hologram,
            letterSpacing: "0.25em",
            textShadow: `0 0 8px ${COLORS.hologram}`,
          }}
        >
          APTOS PREDICTION MARKET
        </div>
        <div
          style={{
            fontFamily: "SF Pro Display, sans-serif",
            fontSize: 50,
            fontWeight: 800,
            color: COLORS.hologram,
            textShadow: `0 0 30px ${COLORS.hologram}50`,
          }}
        >
          Fee Calculation
        </div>
        <div style={{ fontFamily: "SF Mono", fontSize: 14, color: COLORS.gray, marginTop: 6 }}>
          30 basis points (0.3%) on all swaps
        </div>
      </div>

      {/* Stats */}
      <div
        style={{
          position: "absolute",
          bottom: 45,
          right: 75,
          display: "flex",
          gap: 20,
          opacity: interpolate(frame, [fps * 2, fps * 2.5], [0, 1]),
        }}
      >
        {[
          { label: "FEE RATE", value: "0.3%", color: COLORS.hologram },
          { label: "BPS", value: "30", color: COLORS.orange },
          { label: "ACCUMULATOR", value: "ON", color: COLORS.hologram },
        ].map((stat) => (
          <div
            key={stat.label}
            style={{
              padding: "14px 22px",
              border: `1px solid ${stat.color}40`,
              background: `${stat.color}08`,
              textAlign: "center",
            }}
          >
            <div
              style={{
                fontFamily: "SF Pro Display",
                fontSize: 26,
                fontWeight: 700,
                color: stat.color,
                textShadow: `0 0 15px ${stat.color}60`,
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

      {/* Badge */}
      <div
        style={{
          position: "absolute",
          bottom: 50,
          left: 75,
          display: "flex",
          alignItems: "center",
          gap: 12,
        }}
      >
        <div
          style={{
            width: 38,
            height: 38,
            borderRadius: 8,
            border: `2px solid ${COLORS.hologram}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: 900,
            fontSize: 22,
            color: COLORS.hologram,
            textShadow: `0 0 10px ${COLORS.hologram}`,
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
