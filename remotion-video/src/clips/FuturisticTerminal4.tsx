import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
} from "remotion";

// ============================================================================
// FUTURISTIC TERMINAL 4 - Holographic USD1 stablecoin contract
// ============================================================================

const COLORS = {
  bg: "#050510",
  gold: "#ffd700",
  amber: "#ffab00",
  white: "#ffffff",
  gray: "#6b7280",
  blue: "#3b82f6",
  green: "#10b981",
  darkBlue: "#0a1628",
};

const CODE_LINES = [
  { text: "/// USD1 Stablecoin - High-TPS collateral token", type: "comment" },
  { text: "///", type: "comment" },
  { text: "/// WHY THIS EXISTS:", type: "comment" },
  { text: "/// APT causes 356:1 state contention on transfers.", type: "comment" },
  { text: "/// Custom FA enables 10,000+ TPS without bottlenecks.", type: "comment" },
  { text: "///", type: "comment" },
  { text: "module prediction_market::usd1 {", type: "keyword" },
  { text: "    use aptos_framework::fungible_asset;", type: "import" },
  { text: "    use aptos_framework::primary_fungible_store;", type: "import" },
  { text: "", type: "empty" },
  { text: "    const DECIMALS: u8 = 8;  // APT-compatible", type: "const" },
  { text: "", type: "empty" },
  { text: "    /// Initialize the USD1 Stablecoin token", type: "comment" },
  { text: "    public entry fun initialize(deployer: &signer) {", type: "keyword" },
  { text: "        let constructor_ref = object::create_named_object(", type: "code" },
  { text: "            deployer, b\"USD1_STABLECOIN_V1\"", type: "string" },
  { text: "        );", type: "code" },
  { text: "", type: "empty" },
  { text: "        // Create fungible asset with primary store", type: "comment" },
  { text: "        primary_fungible_store::create_primary_store_enabled_fungible_asset(", type: "function" },
  { text: "            &constructor_ref,", type: "code" },
  { text: "            option::none(),  // Unlimited supply for demo", type: "param" },
  { text: "            string::utf8(b\"USD1 Stablecoin\"),", type: "string" },
  { text: "            string::utf8(b\"USD1\"),", type: "string" },
  { text: "            DECIMALS,", type: "const" },
  { text: "        );", type: "code" },
  { text: "    }", type: "keyword" },
  { text: "", type: "empty" },
  { text: "    /// Mint tokens (open for demo)", type: "comment" },
  { text: "    public entry fun mint(recipient: address, amount: u64) {", type: "keyword" },
  { text: "        let tokens = fungible_asset::mint(&refs.mint_ref, amount);", type: "function" },
  { text: "        primary_fungible_store::deposit(recipient, tokens);", type: "function" },
  { text: "    }", type: "keyword" },
  { text: "}", type: "keyword" },
];

const getColor = (type: string) => {
  switch (type) {
    case "comment": return COLORS.gray;
    case "keyword": return COLORS.gold;
    case "import": return COLORS.blue;
    case "const": return COLORS.amber;
    case "string": return COLORS.green;
    case "function": return COLORS.gold;
    case "param": return COLORS.white;
    default: return COLORS.white;
  }
};

export const FuturisticTerminal4: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const framesPerLine = fps / 3;

  // Holographic shimmer
  const shimmer = (frame * 2) % 1920;

  // Glow pulse
  const glowIntensity = 0.6 + Math.sin(frame * 0.06) * 0.3;

  // Floating golden particles
  const particles = Array.from({ length: 50 }).map((_, i) => ({
    x: (i * 41 + frame * 0.3) % 100,
    y: (i * 67 + frame * 0.2) % 100,
    size: 2 + (i % 4),
    opacity: 0.2 + (i % 5) * 0.1,
  }));

  return (
    <AbsoluteFill style={{ background: COLORS.bg }}>
      {/* Radial gradients */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `
            radial-gradient(ellipse at 30% 30%, ${COLORS.gold}12 0%, transparent 50%),
            radial-gradient(ellipse at 70% 70%, ${COLORS.amber}08 0%, transparent 50%)
          `,
        }}
      />

      {/* Golden particles */}
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
            background: COLORS.gold,
            opacity: p.opacity,
            boxShadow: `0 0 ${p.size * 3}px ${COLORS.gold}`,
          }}
        />
      ))}

      {/* Main terminal */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          transform: "translate(-50%, -50%)",
          width: 1300,
          background: `linear-gradient(180deg, ${COLORS.darkBlue}f5 0%, ${COLORS.bg}f8 100%)`,
          borderRadius: 20,
          border: `2px solid ${COLORS.gold}40`,
          boxShadow: `
            0 0 ${80 * glowIntensity}px ${COLORS.gold}20,
            0 40px 80px rgba(0,0,0,0.5),
            inset 0 1px 0 ${COLORS.gold}20
          `,
          overflow: "hidden",
        }}
      >
        {/* Holographic shimmer overlay */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: `linear-gradient(90deg, transparent, ${COLORS.gold}08, transparent)`,
            transform: `translateX(${shimmer - 1920}px)`,
            pointerEvents: "none",
          }}
        />

        {/* Header */}
        <div
          style={{
            padding: "16px 28px",
            background: `linear-gradient(90deg, ${COLORS.gold}10, ${COLORS.amber}08)`,
            borderBottom: `1px solid ${COLORS.gold}30`,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 10,
                background: `linear-gradient(135deg, ${COLORS.gold}, ${COLORS.amber})`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 900,
                fontSize: 20,
                color: "#000",
                boxShadow: `0 0 20px ${COLORS.gold}50`,
              }}
            >
              $
            </div>
            <div>
              <div
                style={{
                  fontFamily: "SF Pro Display, sans-serif",
                  fontSize: 18,
                  fontWeight: 700,
                  color: COLORS.gold,
                }}
              >
                USD1 STABLECOIN
              </div>
              <div
                style={{
                  fontFamily: "SF Mono, monospace",
                  fontSize: 11,
                  color: COLORS.gray,
                }}
              >
                usd1.move
              </div>
            </div>
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "8px 16px",
              background: `${COLORS.green}20`,
              borderRadius: 20,
              border: `1px solid ${COLORS.green}40`,
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
            <span style={{ fontFamily: "SF Mono", fontSize: 12, color: COLORS.green }}>
              DEPLOYED
            </span>
          </div>
        </div>

        {/* Code area */}
        <div style={{ padding: "24px 32px", minHeight: 600 }}>
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
            const color = getColor(line.type);

            return (
              <div
                key={i}
                style={{
                  fontFamily: "Fira Code, SF Mono, monospace",
                  fontSize: 15,
                  lineHeight: 1.7,
                  color: color,
                  opacity: progress > 0 ? 1 : 0,
                }}
              >
                <span style={{ color: COLORS.gray, opacity: 0.4, marginRight: 24 }}>
                  {String(i + 1).padStart(2, " ")}
                </span>
                {text}
                {progress > 0 && progress < 1 && (
                  <span
                    style={{
                      display: "inline-block",
                      width: 8,
                      height: 18,
                      background: COLORS.gold,
                      boxShadow: `0 0 10px ${COLORS.gold}`,
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
            fontFamily: "SF Mono, monospace",
            fontSize: 14,
            color: COLORS.amber,
            letterSpacing: "0.2em",
          }}
        >
          APTOS FUNGIBLE ASSET
        </div>
        <div
          style={{
            fontFamily: "SF Pro Display, sans-serif",
            fontSize: 56,
            fontWeight: 900,
            background: `linear-gradient(90deg, ${COLORS.gold}, ${COLORS.amber})`,
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            filter: `drop-shadow(0 0 30px ${COLORS.gold}50)`,
          }}
        >
          USD1 Collateral
        </div>
        <div style={{ fontFamily: "SF Mono", fontSize: 14, color: COLORS.gray, marginTop: 8 }}>
          Zero state contention :: 10,000+ TPS enabled
        </div>
      </div>

      {/* Stats */}
      <div
        style={{
          position: "absolute",
          bottom: 50,
          right: 80,
          display: "flex",
          gap: 24,
          opacity: interpolate(frame, [fps * 2, fps * 2.5], [0, 1]),
        }}
      >
        {[
          { label: "Decimals", value: "8", color: COLORS.gold },
          { label: "Contention", value: "0:1", color: COLORS.green },
          { label: "TPS Boost", value: "356x", color: COLORS.amber },
        ].map((stat) => (
          <div
            key={stat.label}
            style={{
              padding: "16px 28px",
              background: `${stat.color}10`,
              border: `1px solid ${stat.color}40`,
              borderRadius: 12,
              textAlign: "center",
            }}
          >
            <div
              style={{
                fontFamily: "SF Pro Display",
                fontSize: 32,
                fontWeight: 700,
                color: stat.color,
              }}
            >
              {stat.value}
            </div>
            <div style={{ fontFamily: "SF Mono", fontSize: 11, color: COLORS.gray, marginTop: 4 }}>
              {stat.label}
            </div>
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
          gap: 12,
          opacity: 0.7,
        }}
      >
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: 9,
            background: `linear-gradient(135deg, ${COLORS.gold}, ${COLORS.amber})`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: 900,
            fontSize: 20,
            color: "#000",
          }}
        >
          A
        </div>
        <span style={{ fontFamily: "SF Pro Display", fontSize: 16, color: COLORS.white }}>
          Powered by Aptos
        </span>
      </div>
    </AbsoluteFill>
  );
};
