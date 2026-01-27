import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
} from "remotion";

// ============================================================================
// FUTURISTIC TERMINAL 3 - Cyberpunk neon with sell_outcome function
// ============================================================================

const COLORS = {
  bg: "#0f0a1a",
  neonPink: "#ff2d95",
  neonBlue: "#00d4ff",
  neonPurple: "#bf00ff",
  neonYellow: "#ffea00",
  white: "#ffffff",
  gray: "#8b8b9a",
  darkPurple: "#1a0a2e",
};

const CODE_LINES = [
  { text: "/// Sell tokens of a specific outcome", type: "comment" },
  { text: "/// TPS OPTIMIZED: Only locks the specific OutcomeMarket", type: "comment" },
  { text: "public entry fun sell_outcome(", type: "keyword" },
  { text: "    seller: &signer,", type: "param" },
  { text: "    market_addr: address,", type: "param" },
  { text: "    outcome_index: u64,", type: "param" },
  { text: "    tokens_in: u64,", type: "param" },
  { text: "    min_collateral_out: u64,", type: "param" },
  { text: ") acquires MultiMarket, OutcomeMarket {", type: "keyword" },
  { text: "", type: "empty" },
  { text: "    let market = borrow_global_mut<MultiMarket>(market_addr);", type: "code" },
  { text: "    assert!(!market.resolved, E_MARKET_ALREADY_RESOLVED);", type: "assert" },
  { text: "", type: "empty" },
  { text: "    // Get outcome and calculate CPMM output", type: "comment" },
  { text: "    let outcome = borrow_global_mut<OutcomeMarket>(outcome_addr);", type: "code" },
  { text: "", type: "empty" },
  { text: "    // CPMM formula: collateral_out = base * tokens / (outcome + tokens)", type: "comment" },
  { text: "    let collateral_out = calculate_sell_output(", type: "function" },
  { text: "        current_outcome_reserve,", type: "number" },
  { text: "        current_base_reserve,", type: "number" },
  { text: "        tokens_in", type: "number" },
  { text: "    );", type: "code" },
  { text: "", type: "empty" },
  { text: "    // Deduct 0.3% fee", type: "comment" },
  { text: "    let fee = (collateral_out * market.fee_bps) / BPS_DENOMINATOR;", type: "code" },
  { text: "", type: "empty" },
  { text: "    // Update reserves atomically (parallel-safe)", type: "comment" },
  { text: "    aggregator_v2::add(&mut outcome.reserve, tokens_in);", type: "highlight" },
  { text: "    aggregator_v2::sub(&mut outcome.base_reserve, collateral_out);", type: "highlight" },
  { text: "", type: "empty" },
  { text: "    // Burn tokens from seller", type: "comment" },
  { text: "    fungible_asset::burn(&outcome.burn_ref, tokens);", type: "function" },
  { text: "", type: "empty" },
  { text: "    // Return collateral to seller", type: "comment" },
  { text: "    primary_fungible_store::deposit(seller_addr, payout);", type: "function" },
  { text: "}", type: "keyword" },
];

const getColor = (type: string) => {
  switch (type) {
    case "comment": return COLORS.gray;
    case "keyword": return COLORS.neonPink;
    case "param": return COLORS.neonBlue;
    case "function": return COLORS.neonPurple;
    case "number": return COLORS.neonYellow;
    case "assert": return COLORS.neonPink;
    case "highlight": return COLORS.neonBlue;
    default: return COLORS.white;
  }
};

export const FuturisticTerminal3: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const framesPerLine = fps / 3.5;

  // Neon flicker effect
  const flicker = 0.95 + Math.sin(frame * 0.5) * 0.05;

  // Glitch effect occasional
  const glitchActive = Math.sin(frame * 0.1) > 0.95;
  const glitchOffset = glitchActive ? Math.random() * 4 - 2 : 0;

  return (
    <AbsoluteFill style={{ background: COLORS.bg }}>
      {/* Gradient overlay */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `
            radial-gradient(ellipse at 20% 20%, ${COLORS.neonPink}15 0%, transparent 50%),
            radial-gradient(ellipse at 80% 80%, ${COLORS.neonBlue}15 0%, transparent 50%),
            radial-gradient(ellipse at 50% 50%, ${COLORS.neonPurple}08 0%, transparent 70%)
          `,
        }}
      />

      {/* Horizontal lines decoration */}
      {Array.from({ length: 8 }).map((_, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: 100 + i * 130,
            height: 1,
            background: `linear-gradient(90deg, transparent, ${COLORS.neonPink}20, transparent)`,
            opacity: 0.3,
          }}
        />
      ))}

      {/* Main terminal */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          transform: `translate(calc(-50% + ${glitchOffset}px), -50%)`,
          width: 1350,
          background: `linear-gradient(135deg, ${COLORS.darkPurple}f5, ${COLORS.bg}f5)`,
          borderRadius: 16,
          border: `2px solid`,
          borderImage: `linear-gradient(135deg, ${COLORS.neonPink}, ${COLORS.neonBlue}, ${COLORS.neonPurple}) 1`,
          boxShadow: `
            0 0 60px ${COLORS.neonPink}25,
            0 0 120px ${COLORS.neonBlue}15,
            inset 0 0 60px ${COLORS.neonPurple}10
          `,
          overflow: "hidden",
          opacity: flicker,
        }}
      >
        {/* Terminal header */}
        <div
          style={{
            padding: "14px 24px",
            background: `linear-gradient(90deg, ${COLORS.neonPink}15, ${COLORS.neonPurple}15, ${COLORS.neonBlue}15)`,
            borderBottom: `1px solid ${COLORS.neonPink}30`,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ display: "flex", gap: 8 }}>
              <div style={{ width: 12, height: 12, borderRadius: "50%", background: COLORS.neonPink, boxShadow: `0 0 10px ${COLORS.neonPink}` }} />
              <div style={{ width: 12, height: 12, borderRadius: "50%", background: COLORS.neonYellow, boxShadow: `0 0 10px ${COLORS.neonYellow}` }} />
              <div style={{ width: 12, height: 12, borderRadius: "50%", background: COLORS.neonBlue, boxShadow: `0 0 10px ${COLORS.neonBlue}` }} />
            </div>
            <div
              style={{
                fontFamily: "SF Mono, monospace",
                fontSize: 13,
                color: COLORS.neonPink,
                textShadow: `0 0 10px ${COLORS.neonPink}`,
                letterSpacing: "0.05em",
              }}
            >
              CYBERDECK::MOVE_COMPILER_v2.0
            </div>
          </div>
          <div
            style={{
              fontFamily: "SF Mono, monospace",
              fontSize: 12,
              color: COLORS.neonBlue,
              textShadow: `0 0 8px ${COLORS.neonBlue}`,
            }}
          >
            multi_outcome_market.move [531:599]
          </div>
        </div>

        {/* Code area */}
        <div style={{ padding: "24px 32px", minHeight: 680 }}>
          {CODE_LINES.map((line, i) => {
            const lineStart = fps * 0.4 + i * framesPerLine;
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
                  fontSize: 15,
                  lineHeight: 1.75,
                  color: color,
                  opacity: progress > 0 ? 1 : 0,
                  textShadow: isHighlight ? `0 0 15px ${color}` : "none",
                  background: isHighlight ? `${color}10` : "transparent",
                  padding: isHighlight ? "2px 8px" : "0",
                  marginLeft: isHighlight ? -8 : 0,
                  borderRadius: 4,
                }}
              >
                <span style={{ color: COLORS.gray, opacity: 0.4, marginRight: 24 }}>
                  {String(i + 531).padStart(3, " ")}
                </span>
                {text}
                {progress > 0 && progress < 1 && (
                  <span
                    style={{
                      display: "inline-block",
                      width: 8,
                      height: 18,
                      background: COLORS.neonPink,
                      boxShadow: `0 0 15px ${COLORS.neonPink}`,
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
          left: 70,
          opacity: interpolate(frame, [0, fps * 0.4], [0, 1]),
        }}
      >
        <div
          style={{
            fontFamily: "SF Mono, monospace",
            fontSize: 13,
            color: COLORS.neonBlue,
            letterSpacing: "0.25em",
            textShadow: `0 0 10px ${COLORS.neonBlue}`,
          }}
        >
          [ APTOS MOVE PROTOCOL ]
        </div>
        <div
          style={{
            fontFamily: "SF Pro Display, sans-serif",
            fontSize: 54,
            fontWeight: 900,
            background: `linear-gradient(90deg, ${COLORS.neonPink}, ${COLORS.neonPurple}, ${COLORS.neonBlue})`,
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            filter: `drop-shadow(0 0 20px ${COLORS.neonPink}60)`,
          }}
        >
          sell_outcome()
        </div>
        <div
          style={{
            fontFamily: "SF Mono, monospace",
            fontSize: 14,
            color: COLORS.gray,
            marginTop: 8,
          }}
        >
          CPMM swap :: tokens → collateral
        </div>
      </div>

      {/* Stats */}
      <div
        style={{
          position: "absolute",
          bottom: 45,
          right: 70,
          display: "flex",
          gap: 24,
          opacity: interpolate(frame, [fps * 2, fps * 2.5], [0, 1]),
        }}
      >
        {[
          { label: "SLIPPAGE", value: "0.3%", color: COLORS.neonPink },
          { label: "GAS", value: "<$0.001", color: COLORS.neonPurple },
          { label: "LATENCY", value: "470ms", color: COLORS.neonBlue },
        ].map((stat) => (
          <div
            key={stat.label}
            style={{
              padding: "14px 22px",
              background: `${stat.color}10`,
              border: `1px solid ${stat.color}50`,
              borderRadius: 8,
              textAlign: "center",
            }}
          >
            <div
              style={{
                fontFamily: "SF Pro Display, sans-serif",
                fontSize: 26,
                fontWeight: 700,
                color: stat.color,
                textShadow: `0 0 15px ${stat.color}80`,
              }}
            >
              {stat.value}
            </div>
            <div
              style={{
                fontFamily: "SF Mono, monospace",
                fontSize: 10,
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

      {/* Aptos badge */}
      <div
        style={{
          position: "absolute",
          bottom: 50,
          left: 70,
          display: "flex",
          alignItems: "center",
          gap: 12,
        }}
      >
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: 12,
            background: `linear-gradient(135deg, ${COLORS.neonPink}, ${COLORS.neonPurple})`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: 900,
            fontSize: 24,
            color: "#fff",
            boxShadow: `0 0 20px ${COLORS.neonPink}50`,
          }}
        >
          A
        </div>
        <div>
          <div style={{ fontFamily: "SF Pro Display", fontSize: 16, fontWeight: 600, color: COLORS.white }}>
            APTOS
          </div>
          <div style={{ fontFamily: "SF Mono", fontSize: 10, color: COLORS.gray, letterSpacing: "0.1em" }}>
            PREDICTION MARKETS
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
