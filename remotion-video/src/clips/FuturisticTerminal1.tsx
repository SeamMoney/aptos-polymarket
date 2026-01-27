import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
  Easing,
} from "remotion";

// ============================================================================
// FUTURISTIC TERMINAL 1 - Holographic code display with buy_outcome function
// ============================================================================

const COLORS = {
  bg: "#0a0a12",
  terminal: "#0d1117",
  green: "#00ff9f",
  cyan: "#00f0ff",
  purple: "#bf5af2",
  pink: "#ff6b9d",
  blue: "#58a6ff",
  orange: "#ff9f43",
  yellow: "#ffd93d",
  text: "#c9d1d9",
  comment: "#6e7681",
  keyword: "#ff7b72",
  function: "#d2a8ff",
  string: "#a5d6ff",
  number: "#79c0ff",
};

const CODE_LINES = [
  { text: "/// Buy tokens of a specific outcome using CPMM pricing", color: COLORS.comment },
  { text: "/// TPS OPTIMIZED: Only locks the specific OutcomeMarket", color: COLORS.comment },
  { text: "public entry fun buy_outcome(", color: COLORS.keyword },
  { text: "    buyer: &signer,", color: COLORS.text },
  { text: "    market_addr: address,", color: COLORS.text },
  { text: "    outcome_index: u64,", color: COLORS.text },
  { text: "    collateral_in: u64,", color: COLORS.text },
  { text: "    min_tokens_out: u64,", color: COLORS.text },
  { text: ") acquires MultiMarket, OutcomeMarket {", color: COLORS.keyword },
  { text: "    assert!(collateral_in > 0, E_ZERO_AMOUNT);", color: COLORS.function },
  { text: "", color: COLORS.text },
  { text: "    // Read market state", color: COLORS.comment },
  { text: "    let market = borrow_global_mut<MultiMarket>(market_addr);", color: COLORS.text },
  { text: "    assert!(!market.resolved, E_MARKET_ALREADY_RESOLVED);", color: COLORS.function },
  { text: "", color: COLORS.text },
  { text: "    // Calculate fee (0.3%)", color: COLORS.comment },
  { text: "    let fee = (collateral_in * market.fee_bps) / BPS_DENOMINATOR;", color: COLORS.text },
  { text: "    let amount_after_fee = collateral_in - fee;", color: COLORS.text },
  { text: "", color: COLORS.text },
  { text: "    // CPMM: tokens_out = reserve * amount / (base + amount)", color: COLORS.comment },
  { text: "    let tokens_out = calculate_buy_output(", color: COLORS.function },
  { text: "        current_base_reserve,", color: COLORS.number },
  { text: "        current_outcome_reserve,", color: COLORS.number },
  { text: "        amount_after_fee", color: COLORS.number },
  { text: "    );", color: COLORS.text },
  { text: "", color: COLORS.text },
  { text: "    // Update reserves (parallel-safe aggregators)", color: COLORS.comment },
  { text: "    aggregator_v2::add(&mut outcome.base_reserve, amount_after_fee);", color: COLORS.cyan },
  { text: "    aggregator_v2::sub(&mut outcome.reserve, tokens_out);", color: COLORS.cyan },
  { text: "", color: COLORS.text },
  { text: "    // Mint tokens to buyer", color: COLORS.comment },
  { text: "    let tokens = fungible_asset::mint(&outcome.mint_ref, tokens_out);", color: COLORS.green },
  { text: "    primary_fungible_store::deposit(buyer_addr, tokens);", color: COLORS.green },
  { text: "}", color: COLORS.keyword },
];

export const FuturisticTerminal1: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  // Terminal boot sequence
  const bootProgress = interpolate(frame, [0, fps * 0.5], [0, 1], {
    extrapolateRight: "clamp",
  });

  // Code typing animation
  const totalLines = CODE_LINES.length;
  const linesPerSecond = 2.5;
  const framesPerLine = fps / linesPerSecond;

  // Scanline effect
  const scanlineY = (frame * 3) % 1200;

  // Glow pulse
  const glowPulse = 0.5 + Math.sin(frame * 0.08) * 0.3;

  // Floating particles
  const particles = Array.from({ length: 40 }).map((_, i) => ({
    x: (i * 47) % 100,
    y: ((i * 31 + frame * 0.5) % 120) - 10,
    size: 1 + (i % 3),
    opacity: 0.1 + (i % 5) * 0.05,
  }));

  return (
    <AbsoluteFill style={{ background: COLORS.bg }}>
      {/* Grid background */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: `
            linear-gradient(${COLORS.cyan}08 1px, transparent 1px),
            linear-gradient(90deg, ${COLORS.cyan}08 1px, transparent 1px)
          `,
          backgroundSize: "50px 50px",
          opacity: 0.5,
        }}
      />

      {/* Floating particles */}
      {particles.map((p, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: p.size,
            height: p.size,
            borderRadius: "50%",
            backgroundColor: [COLORS.cyan, COLORS.green, COLORS.purple][i % 3],
            opacity: p.opacity,
            boxShadow: `0 0 ${p.size * 4}px ${[COLORS.cyan, COLORS.green, COLORS.purple][i % 3]}`,
          }}
        />
      ))}

      {/* Main terminal window */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          transform: `translate(-50%, -50%) scale(${bootProgress})`,
          width: 1400,
          background: `linear-gradient(180deg, ${COLORS.terminal}f0 0%, ${COLORS.terminal}e0 100%)`,
          borderRadius: 20,
          border: `1px solid ${COLORS.cyan}40`,
          boxShadow: `
            0 0 ${60 * glowPulse}px ${COLORS.cyan}30,
            0 40px 80px rgba(0,0,0,0.5),
            inset 0 1px 0 ${COLORS.cyan}20
          `,
          overflow: "hidden",
        }}
      >
        {/* Terminal header */}
        <div
          style={{
            padding: "16px 24px",
            background: `linear-gradient(90deg, ${COLORS.cyan}15, ${COLORS.purple}10)`,
            borderBottom: `1px solid ${COLORS.cyan}30`,
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}
        >
          <div style={{ display: "flex", gap: 8 }}>
            <div style={{ width: 14, height: 14, borderRadius: "50%", background: "#ff5f57" }} />
            <div style={{ width: 14, height: 14, borderRadius: "50%", background: "#febc2e" }} />
            <div style={{ width: 14, height: 14, borderRadius: "50%", background: "#28c840" }} />
          </div>
          <div
            style={{
              flex: 1,
              textAlign: "center",
              fontFamily: "SF Mono, monospace",
              fontSize: 14,
              color: COLORS.cyan,
              letterSpacing: "0.1em",
            }}
          >
            APTOS MOVE VM :: multi_outcome_market.move
          </div>
          <div
            style={{
              fontFamily: "SF Mono, monospace",
              fontSize: 12,
              color: COLORS.green,
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: COLORS.green,
                boxShadow: `0 0 10px ${COLORS.green}`,
              }}
            />
            LIVE
          </div>
        </div>

        {/* Code area */}
        <div style={{ padding: "24px 32px", minHeight: 700 }}>
          {CODE_LINES.map((line, i) => {
            const lineStartFrame = fps * 0.8 + i * framesPerLine;
            const lineProgress = interpolate(
              frame,
              [lineStartFrame, lineStartFrame + framesPerLine * 0.8],
              [0, 1],
              { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
            );

            const chars = Math.floor(line.text.length * lineProgress);
            const displayText = line.text.slice(0, chars);
            const showCursor = lineProgress > 0 && lineProgress < 1;

            return (
              <div
                key={i}
                style={{
                  fontFamily: "SF Mono, Fira Code, monospace",
                  fontSize: 16,
                  lineHeight: 1.8,
                  color: line.color,
                  opacity: lineProgress > 0 ? 1 : 0,
                  display: "flex",
                }}
              >
                <span
                  style={{
                    width: 50,
                    color: COLORS.comment,
                    opacity: 0.5,
                    userSelect: "none",
                  }}
                >
                  {i + 459}
                </span>
                <span>
                  {displayText}
                  {showCursor && (
                    <span
                      style={{
                        display: "inline-block",
                        width: 10,
                        height: 20,
                        background: COLORS.cyan,
                        marginLeft: 2,
                        animation: "blink 0.5s infinite",
                        boxShadow: `0 0 10px ${COLORS.cyan}`,
                      }}
                    />
                  )}
                </span>
              </div>
            );
          })}
        </div>

        {/* Scanline effect */}
        <div
          style={{
            position: "absolute",
            left: 0,
            top: scanlineY,
            width: "100%",
            height: 2,
            background: `linear-gradient(90deg, transparent, ${COLORS.cyan}30, transparent)`,
            pointerEvents: "none",
          }}
        />
      </div>

      {/* Title */}
      <div
        style={{
          position: "absolute",
          top: 40,
          left: 60,
          opacity: interpolate(frame, [fps * 0.3, fps * 0.8], [0, 1], { extrapolateRight: "clamp" }),
        }}
      >
        <div
          style={{
            fontFamily: "SF Pro Display, sans-serif",
            fontSize: 14,
            color: COLORS.cyan,
            letterSpacing: "0.3em",
            marginBottom: 8,
          }}
        >
          APTOS BLOCKCHAIN
        </div>
        <div
          style={{
            fontFamily: "SF Pro Display, sans-serif",
            fontSize: 48,
            fontWeight: 800,
            background: `linear-gradient(90deg, ${COLORS.green}, ${COLORS.cyan})`,
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}
        >
          buy_outcome()
        </div>
        <div
          style={{
            fontFamily: "SF Mono, monospace",
            fontSize: 16,
            color: COLORS.text,
            opacity: 0.7,
            marginTop: 8,
          }}
        >
          CPMM swap with parallel execution
        </div>
      </div>

      {/* Stats panel */}
      <div
        style={{
          position: "absolute",
          bottom: 40,
          right: 60,
          display: "flex",
          gap: 30,
          opacity: interpolate(frame, [fps * 2, fps * 2.5], [0, 1], { extrapolateRight: "clamp" }),
        }}
      >
        {[
          { label: "TPS", value: "30,000+", color: COLORS.green },
          { label: "Finality", value: "~470ms", color: COLORS.cyan },
          { label: "Fee", value: "0.3%", color: COLORS.purple },
        ].map((stat) => (
          <div
            key={stat.label}
            style={{
              padding: "16px 24px",
              background: `${stat.color}15`,
              border: `1px solid ${stat.color}40`,
              borderRadius: 12,
              textAlign: "center",
            }}
          >
            <div
              style={{
                fontFamily: "SF Pro Display, sans-serif",
                fontSize: 28,
                fontWeight: 700,
                color: stat.color,
              }}
            >
              {stat.value}
            </div>
            <div
              style={{
                fontFamily: "SF Mono, monospace",
                fontSize: 11,
                color: COLORS.text,
                opacity: 0.6,
                marginTop: 4,
              }}
            >
              {stat.label}
            </div>
          </div>
        ))}
      </div>

      {/* Aptos logo */}
      <div
        style={{
          position: "absolute",
          bottom: 40,
          left: 60,
          display: "flex",
          alignItems: "center",
          gap: 12,
          opacity: 0.6,
        }}
      >
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: 10,
            background: `linear-gradient(135deg, ${COLORS.green}, ${COLORS.cyan})`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: 900,
            fontSize: 22,
            color: "#000",
          }}
        >
          A
        </div>
        <span
          style={{
            fontFamily: "SF Pro Display, sans-serif",
            fontSize: 18,
            color: COLORS.text,
          }}
        >
          Powered by Aptos
        </span>
      </div>
    </AbsoluteFill>
  );
};
