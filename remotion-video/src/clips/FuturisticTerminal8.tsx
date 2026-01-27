import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
} from "remotion";

// ============================================================================
// FUTURISTIC TERMINAL 8 - Synthwave/Outrun with claim_winnings
// ============================================================================

const COLORS = {
  bg: "#1a0533",
  synthPink: "#ff1493",
  synthPurple: "#9400d3",
  synthBlue: "#00bfff",
  synthYellow: "#ffd700",
  white: "#ffffff",
  gray: "#8b7aa0",
};

const CODE_LINES = [
  { text: "/// Claim winnings from a resolved market", type: "comment" },
  { text: "/// Winners receive 1 USD1 per winning token held", type: "comment" },
  { text: "public entry fun claim_winnings(", type: "keyword" },
  { text: "    claimer: &signer,", type: "param" },
  { text: "    market_addr: address,", type: "param" },
  { text: ") acquires MultiMarket, OutcomeMarket {", type: "keyword" },
  { text: "", type: "empty" },
  { text: "    let market = borrow_global<MultiMarket>(market_addr);", type: "code" },
  { text: "    assert!(market.resolved, E_MARKET_NOT_RESOLVED);", type: "assert" },
  { text: "", type: "empty" },
  { text: "    let winning = option::extract(&mut market.winning_outcome);", type: "code" },
  { text: "    let claimer_addr = signer::address_of(claimer);", type: "code" },
  { text: "", type: "empty" },
  { text: "    // Get user's winning token balance", type: "comment" },
  { text: "    let winning_outcome = borrow_global<OutcomeMarket>(outcome_addr);", type: "code" },
  { text: "    let token_balance = primary_fungible_store::balance(", type: "function" },
  { text: "        claimer_addr,", type: "param" },
  { text: "        winning_outcome.token_metadata", type: "param" },
  { text: "    );", type: "function" },
  { text: "", type: "empty" },
  { text: "    assert!(token_balance > 0, E_NO_TOKENS_TO_CLAIM);", type: "assert" },
  { text: "", type: "empty" },
  { text: "    // Calculate payout: 1 USD1 per winning token", type: "comment" },
  { text: "    let payout = token_balance;  // 1:1 redemption", type: "highlight" },
  { text: "", type: "empty" },
  { text: "    // Burn winning tokens", type: "comment" },
  { text: "    let tokens = primary_fungible_store::withdraw(claimer, ...);", type: "function" },
  { text: "    fungible_asset::burn(&winning_outcome.burn_ref, tokens);", type: "function" },
  { text: "", type: "empty" },
  { text: "    // Transfer USD1 payout to winner", type: "comment" },
  { text: "    primary_fungible_store::deposit(claimer_addr, payout_fa);", type: "highlight" },
  { text: "}", type: "keyword" },
];

const getColor = (type: string) => {
  switch (type) {
    case "comment": return COLORS.gray;
    case "keyword": return COLORS.synthPink;
    case "param": return COLORS.synthBlue;
    case "function": return COLORS.synthPurple;
    case "highlight": return COLORS.synthYellow;
    case "assert": return COLORS.synthPink;
    default: return COLORS.white;
  }
};

export const FuturisticTerminal8: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const framesPerLine = fps / 3.5;

  // Sun animation
  const sunY = 350 + Math.sin(frame * 0.02) * 10;

  // Grid movement
  const gridSpeed = frame * 3;

  return (
    <AbsoluteFill style={{ background: COLORS.bg }}>
      {/* Gradient sky */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `linear-gradient(180deg,
            #1a0533 0%,
            #2d0a4e 30%,
            #ff1493 70%,
            #ff6b35 100%
          )`,
        }}
      />

      {/* Synthwave sun */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: sunY,
          transform: "translateX(-50%)",
          width: 400,
          height: 400,
          borderRadius: "50%",
          background: `linear-gradient(180deg, ${COLORS.synthYellow} 0%, ${COLORS.synthPink} 100%)`,
          boxShadow: `0 0 100px ${COLORS.synthPink}, 0 0 200px ${COLORS.synthYellow}50`,
          overflow: "hidden",
        }}
      >
        {/* Sun stripes */}
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              top: 200 + i * 30,
              height: 15,
              background: COLORS.bg,
            }}
          />
        ))}
      </div>

      {/* Perspective grid */}
      <svg
        style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: "50%" }}
        viewBox="0 0 1920 540"
        preserveAspectRatio="none"
      >
        {/* Horizontal lines */}
        {Array.from({ length: 20 }).map((_, i) => {
          const y = (gridSpeed + i * 30) % 540;
          const opacity = y / 540;
          return (
            <line
              key={`h${i}`}
              x1={0}
              y1={y}
              x2={1920}
              y2={y}
              stroke={COLORS.synthPink}
              strokeWidth={2}
              opacity={opacity * 0.8}
            />
          );
        })}

        {/* Vertical converging lines */}
        {Array.from({ length: 30 }).map((_, i) => {
          const x = i * 70 - 70;
          return (
            <line
              key={`v${i}`}
              x1={x}
              y1={540}
              x2={960 + (x - 960) * 0.1}
              y2={0}
              stroke={COLORS.synthPurple}
              strokeWidth={1.5}
              opacity={0.6}
            />
          );
        })}
      </svg>

      {/* Main terminal */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "48%",
          transform: "translate(-50%, -50%)",
          width: 1200,
          background: `${COLORS.bg}e8`,
          borderRadius: 16,
          border: `3px solid`,
          borderImage: `linear-gradient(135deg, ${COLORS.synthPink}, ${COLORS.synthPurple}, ${COLORS.synthBlue}) 1`,
          boxShadow: `
            0 0 60px ${COLORS.synthPink}40,
            0 0 120px ${COLORS.synthPurple}20,
            inset 0 0 40px ${COLORS.synthPink}10
          `,
          overflow: "hidden",
        }}
      >
        {/* Chrome header */}
        <div
          style={{
            padding: "14px 24px",
            background: `linear-gradient(90deg, ${COLORS.synthPink}20, ${COLORS.synthPurple}20, ${COLORS.synthBlue}20)`,
            borderBottom: `2px solid ${COLORS.synthPink}50`,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ display: "flex", gap: 10 }}>
              {[COLORS.synthPink, COLORS.synthYellow, COLORS.synthBlue].map((color, i) => (
                <div
                  key={i}
                  style={{
                    width: 14,
                    height: 14,
                    borderRadius: "50%",
                    background: color,
                    boxShadow: `0 0 15px ${color}`,
                  }}
                />
              ))}
            </div>
            <div
              style={{
                fontFamily: "SF Mono, monospace",
                fontSize: 14,
                color: COLORS.synthPink,
                textShadow: `0 0 10px ${COLORS.synthPink}`,
                letterSpacing: "0.1em",
              }}
            >
              NEON_TERMINAL::claim_winnings.move
            </div>
          </div>
          <div
            style={{
              fontFamily: "SF Mono, monospace",
              fontSize: 12,
              color: COLORS.synthYellow,
              textShadow: `0 0 10px ${COLORS.synthYellow}`,
            }}
          >
            [$] PAYOUT READY
          </div>
        </div>

        {/* Code */}
        <div style={{ padding: "20px 28px", minHeight: 560 }}>
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
                  lineHeight: 1.7,
                  color: color,
                  opacity: progress > 0 ? 1 : 0,
                  textShadow: `0 0 5px ${color}50`,
                  background: isHighlight ? `${color}15` : "transparent",
                  padding: isHighlight ? "2px 8px" : "0",
                  marginLeft: isHighlight ? -8 : 0,
                  borderLeft: isHighlight ? `3px solid ${color}` : "none",
                }}
              >
                <span style={{ color: COLORS.synthPurple, opacity: 0.5, marginRight: 20, fontSize: 12 }}>
                  {String(i + 1).padStart(2, "0")}
                </span>
                {text}
                {progress > 0 && progress < 1 && (
                  <span
                    style={{
                      display: "inline-block",
                      width: 2,
                      height: 16,
                      background: COLORS.synthPink,
                      boxShadow: `0 0 10px ${COLORS.synthPink}`,
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
          top: 35,
          left: 70,
          opacity: interpolate(frame, [0, fps * 0.3], [0, 1]),
        }}
      >
        <div
          style={{
            fontFamily: "SF Mono, monospace",
            fontSize: 13,
            color: COLORS.synthBlue,
            letterSpacing: "0.25em",
            textShadow: `0 0 10px ${COLORS.synthBlue}`,
          }}
        >
          APTOS PREDICTION MARKETS
        </div>
        <div
          style={{
            fontFamily: "SF Pro Display, sans-serif",
            fontSize: 50,
            fontWeight: 900,
            background: `linear-gradient(90deg, ${COLORS.synthPink}, ${COLORS.synthYellow})`,
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            filter: `drop-shadow(0 0 20px ${COLORS.synthPink}60)`,
          }}
        >
          claim_winnings()
        </div>
        <div style={{ fontFamily: "SF Mono", fontSize: 13, color: COLORS.gray, marginTop: 4 }}>
          1:1 redemption :: Winners take all
        </div>
      </div>

      {/* Stats */}
      <div
        style={{
          position: "absolute",
          bottom: 35,
          right: 70,
          display: "flex",
          gap: 20,
          opacity: interpolate(frame, [fps * 2, fps * 2.5], [0, 1]),
        }}
      >
        {[
          { label: "REDEMPTION", value: "1:1", color: COLORS.synthYellow },
          { label: "GAS", value: "<$0.001", color: COLORS.synthPink },
          { label: "PAYOUT", value: "INSTANT", color: COLORS.synthBlue },
        ].map((stat) => (
          <div
            key={stat.label}
            style={{
              padding: "12px 20px",
              background: `${stat.color}15`,
              border: `2px solid ${stat.color}60`,
              borderRadius: 8,
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
          bottom: 40,
          left: 70,
          display: "flex",
          alignItems: "center",
          gap: 12,
        }}
      >
        <div
          style={{
            width: 38,
            height: 38,
            borderRadius: 10,
            background: `linear-gradient(135deg, ${COLORS.synthPink}, ${COLORS.synthPurple})`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: 900,
            fontSize: 22,
            color: "#fff",
            boxShadow: `0 0 20px ${COLORS.synthPink}60`,
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
