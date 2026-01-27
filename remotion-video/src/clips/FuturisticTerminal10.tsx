import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
} from "remotion";

// ============================================================================
// FUTURISTIC TERMINAL 10 - Glitch/distortion with mint_outcome_tokens
// ============================================================================

const COLORS = {
  bg: "#0a0a0a",
  glitchRed: "#ff0040",
  glitchCyan: "#00ffff",
  glitchYellow: "#ffff00",
  white: "#ffffff",
  gray: "#666666",
  darkGray: "#1a1a1a",
};

const CODE_LINES = [
  { text: "/// Mint outcome tokens using Complete Sets model", type: "comment" },
  { text: "/// 1 USD1 -> 1 of EACH outcome token", type: "comment" },
  { text: "public entry fun mint_complete_set(", type: "keyword" },
  { text: "    buyer: &signer,", type: "param" },
  { text: "    market_addr: address,", type: "param" },
  { text: "    collateral_amount: u64,", type: "param" },
  { text: ") acquires MultiMarket, OutcomeMarket {", type: "keyword" },
  { text: "", type: "empty" },
  { text: "    let market = borrow_global_mut<MultiMarket>(market_addr);", type: "code" },
  { text: "    let buyer_addr = signer::address_of(buyer);", type: "code" },
  { text: "", type: "empty" },
  { text: "    // Withdraw USD1 collateral from buyer", type: "comment" },
  { text: "    let collateral = primary_fungible_store::withdraw(", type: "function" },
  { text: "        buyer, market.collateral_metadata, collateral_amount", type: "param" },
  { text: "    );", type: "function" },
  { text: "", type: "empty" },
  { text: "    // Deposit to market vault", type: "comment" },
  { text: "    fungible_asset::deposit(market.vault, collateral);", type: "function" },
  { text: "", type: "empty" },
  { text: "    // Mint 1 token of EACH outcome to buyer", type: "comment" },
  { text: "    let i = 0;", type: "code" },
  { text: "    while (i < market.outcome_count) {", type: "keyword" },
  { text: "        let outcome = borrow_global_mut<OutcomeMarket>(...);", type: "code" },
  { text: "        let tokens = fungible_asset::mint(", type: "highlight" },
  { text: "            &outcome.mint_ref, collateral_amount", type: "highlight" },
  { text: "        );", type: "highlight" },
  { text: "        primary_fungible_store::deposit(buyer_addr, tokens);", type: "function" },
  { text: "        i = i + 1;", type: "code" },
  { text: "    };", type: "keyword" },
  { text: "}", type: "keyword" },
];

const getColor = (type: string) => {
  switch (type) {
    case "comment": return COLORS.gray;
    case "keyword": return COLORS.glitchRed;
    case "param": return COLORS.glitchCyan;
    case "function": return COLORS.white;
    case "highlight": return COLORS.glitchYellow;
    default: return COLORS.white;
  }
};

export const FuturisticTerminal10: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const framesPerLine = fps / 3.5;

  // Glitch timing
  const glitchActive = Math.sin(frame * 0.15) > 0.85;
  const microGlitch = Math.sin(frame * 0.4) > 0.95;
  const glitchOffset = glitchActive ? (Math.random() - 0.5) * 20 : 0;
  const chromaOffset = glitchActive ? 4 : microGlitch ? 2 : 0;

  // Scanline position
  const scanlineY = (frame * 5) % 1080;

  // Noise bars
  const noiseBars = glitchActive ? Array.from({ length: 5 }).map((_, i) => ({
    y: Math.random() * 1080,
    height: Math.random() * 20 + 5,
    opacity: Math.random() * 0.5,
  })) : [];

  return (
    <AbsoluteFill style={{ background: COLORS.bg }}>
      {/* Chromatic aberration layers */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: COLORS.glitchRed,
          mixBlendMode: "screen",
          opacity: glitchActive ? 0.1 : 0,
          transform: `translateX(${chromaOffset}px)`,
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: COLORS.glitchCyan,
          mixBlendMode: "screen",
          opacity: glitchActive ? 0.1 : 0,
          transform: `translateX(-${chromaOffset}px)`,
        }}
      />

      {/* Scanline */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: scanlineY,
          height: 3,
          background: `linear-gradient(90deg, transparent, ${COLORS.white}30, transparent)`,
          pointerEvents: "none",
        }}
      />

      {/* Noise bars during glitch */}
      {noiseBars.map((bar, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: bar.y,
            height: bar.height,
            background: COLORS.white,
            opacity: bar.opacity,
          }}
        />
      ))}

      {/* VHS tracking lines */}
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

      {/* Main terminal */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          transform: `translate(calc(-50% + ${glitchOffset}px), -50%)`,
          width: 1200,
          background: COLORS.darkGray,
          border: `2px solid ${glitchActive ? COLORS.glitchRed : COLORS.gray}40`,
          overflow: "hidden",
        }}
      >
        {/* Header with glitch */}
        <div
          style={{
            padding: "12px 20px",
            background: COLORS.bg,
            borderBottom: `1px solid ${COLORS.gray}30`,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div
              style={{
                fontFamily: "SF Mono, monospace",
                fontSize: 14,
                color: COLORS.glitchRed,
                letterSpacing: "0.1em",
              }}
            >
              {glitchActive ? "ERR0R://" : "SYS://"}mint_tokens.move
            </div>
          </div>
          <div
            style={{
              fontFamily: "SF Mono, monospace",
              fontSize: 12,
              color: glitchActive ? COLORS.glitchYellow : COLORS.glitchCyan,
            }}
          >
            [{glitchActive ? "GLITCH" : "STABLE"}]
          </div>
        </div>

        {/* Code with glitch effect */}
        <div style={{ padding: "20px 28px", minHeight: 560, position: "relative" }}>
          {CODE_LINES.map((line, i) => {
            const lineStart = fps * 0.3 + i * framesPerLine;
            const progress = interpolate(
              frame,
              [lineStart, lineStart + framesPerLine * 0.5],
              [0, 1],
              { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
            );

            const visibleChars = Math.floor(line.text.length * progress);
            let text = line.text.slice(0, visibleChars);

            // Random character corruption during glitch
            if (glitchActive && Math.random() > 0.7 && text.length > 0) {
              const chars = text.split("");
              const idx = Math.floor(Math.random() * chars.length);
              chars[idx] = String.fromCharCode(Math.random() * 94 + 33);
              text = chars.join("");
            }

            const color = getColor(line.type);
            const isHighlight = line.type === "highlight";
            const lineGlitch = microGlitch && Math.random() > 0.8;

            return (
              <div
                key={i}
                style={{
                  fontFamily: "Fira Code, SF Mono, monospace",
                  fontSize: 14,
                  lineHeight: 1.7,
                  color: color,
                  opacity: progress > 0 ? 1 : 0,
                  transform: lineGlitch ? `translateX(${(Math.random() - 0.5) * 10}px)` : "none",
                  background: isHighlight ? `${color}15` : "transparent",
                  padding: isHighlight ? "2px 8px" : "0",
                  marginLeft: isHighlight ? -8 : 0,
                  borderLeft: isHighlight ? `3px solid ${color}` : "none",
                }}
              >
                <span style={{ color: COLORS.glitchRed, opacity: 0.5, marginRight: 20, fontSize: 12 }}>
                  {String(i + 1).padStart(2, "0")}
                </span>
                {/* Chromatic text split */}
                <span style={{ position: "relative" }}>
                  {chromaOffset > 0 && (
                    <>
                      <span style={{ position: "absolute", left: -chromaOffset, color: COLORS.glitchRed, opacity: 0.7 }}>
                        {text}
                      </span>
                      <span style={{ position: "absolute", left: chromaOffset, color: COLORS.glitchCyan, opacity: 0.7 }}>
                        {text}
                      </span>
                    </>
                  )}
                  <span style={{ position: "relative" }}>{text}</span>
                </span>
                {progress > 0 && progress < 1 && (
                  <span
                    style={{
                      display: "inline-block",
                      width: 8,
                      height: 16,
                      background: COLORS.glitchRed,
                      marginLeft: 2,
                    }}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Title with glitch */}
      <div
        style={{
          position: "absolute",
          top: 45,
          left: 70,
          opacity: interpolate(frame, [0, fps * 0.3], [0, 1]),
        }}
      >
        <div
          style={{
            fontFamily: "SF Mono, monospace",
            fontSize: 12,
            color: COLORS.glitchCyan,
            letterSpacing: "0.2em",
          }}
        >
          {glitchActive ? "█APT0S█PREDICT10N█" : "APTOS PREDICTION MARKET"}
        </div>
        <div
          style={{
            fontFamily: "SF Pro Display, sans-serif",
            fontSize: 50,
            fontWeight: 900,
            color: COLORS.white,
            position: "relative",
          }}
        >
          {chromaOffset > 0 && (
            <>
              <span style={{ position: "absolute", left: -chromaOffset, color: COLORS.glitchRed, opacity: 0.7 }}>
                Complete Sets
              </span>
              <span style={{ position: "absolute", left: chromaOffset, color: COLORS.glitchCyan, opacity: 0.7 }}>
                Complete Sets
              </span>
            </>
          )}
          <span style={{ position: "relative" }}>Complete Sets</span>
        </div>
        <div style={{ fontFamily: "SF Mono", fontSize: 13, color: COLORS.gray, marginTop: 6 }}>
          1 USD1 = 1 of each outcome token
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
          { label: "MINT", value: "N:1", color: COLORS.glitchYellow },
          { label: "COLLATERAL", value: "USD1", color: COLORS.glitchCyan },
          { label: "OUTCOMES", value: "2-20", color: COLORS.glitchRed },
        ].map((stat) => (
          <div
            key={stat.label}
            style={{
              padding: "12px 20px",
              border: `1px solid ${stat.color}50`,
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
              }}
            >
              {stat.value}
            </div>
            <div style={{ fontFamily: "SF Mono", fontSize: 10, color: COLORS.gray, marginTop: 4 }}>
              {stat.label}
            </div>
          </div>
        ))}
      </div>

      {/* Badge */}
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
            border: `2px solid ${COLORS.glitchRed}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: 900,
            fontSize: 20,
            color: COLORS.glitchRed,
          }}
        >
          A
        </div>
        <span style={{ fontFamily: "SF Pro Display", fontSize: 15, color: COLORS.white }}>
          Aptos Network
        </span>
      </div>
    </AbsoluteFill>
  );
};
