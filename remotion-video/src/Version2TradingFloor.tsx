import React from "react";
import {
  AbsoluteFill,
  Img,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
  staticFile,
  Easing,
  Sequence,
} from "remotion";

// Version 2: "Trading Floor" - Intense trading visualization with live ticker
export const Version2TradingFloor: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const colors = {
    purple: "#8B5CF6",
    green: "#10B981",
    red: "#EF4444",
    cyan: "#06B6D4",
    yellow: "#F59E0B",
  };

  // Simulated live trades
  const trades = [
    { side: "buy", outcome: "<$90K", amount: 250, price: 29 },
    { side: "sell", outcome: "$100K-$120K", amount: 180, price: 24 },
    { side: "buy", outcome: ">$120K", amount: 500, price: 23 },
    { side: "buy", outcome: "$90K-$100K", amount: 320, price: 23 },
    { side: "sell", outcome: "<$90K", amount: 150, price: 28 },
    { side: "buy", outcome: ">$120K", amount: 1200, price: 24 },
    { side: "buy", outcome: "$100K-$120K", amount: 890, price: 25 },
    { side: "sell", outcome: "$90K-$100K", amount: 400, price: 22 },
  ];

  // Which trades are visible based on frame
  const visibleTradeIndex = Math.floor(frame / 15) % trades.length;
  const activeTrades = trades.slice(0, Math.min(visibleTradeIndex + 1, 6));

  // TPS counter with dramatic ramp up
  const tpsValue = interpolate(
    frame,
    [0, fps * 2, fps * 6, fps * 8],
    [0, 5000, 25000, 30847],
    { extrapolateRight: "clamp" }
  );

  // Price changes animation
  const priceFlash = Math.sin(frame * 0.5) > 0.8;

  // Screen shake on big trades
  const shakeIntensity = frame > fps * 5 && frame < fps * 5.5 ? 3 : 0;
  const shakeX = Math.sin(frame * 2) * shakeIntensity;
  const shakeY = Math.cos(frame * 3) * shakeIntensity;

  return (
    <AbsoluteFill
      style={{
        background: "#0a0a0f",
        transform: `translate(${shakeX}px, ${shakeY}px)`,
      }}
    >
      {/* Animated grid background */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: `
            linear-gradient(rgba(139,92,246,0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(139,92,246,0.03) 1px, transparent 1px)
          `,
          backgroundSize: "50px 50px",
          transform: `perspective(500px) rotateX(60deg) translateY(${frame * 2}px)`,
          transformOrigin: "center top",
          opacity: 0.5,
        }}
      />

      {/* Glowing orbs */}
      <div
        style={{
          position: "absolute",
          width: 400,
          height: 400,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${colors.green}30, transparent 70%)`,
          left: "60%",
          top: "30%",
          filter: "blur(40px)",
          opacity: priceFlash ? 0.8 : 0.4,
          transition: "opacity 0.1s",
        }}
      />

      {/* Main layout */}
      <div style={{ display: "flex", height: "100%", padding: 40 }}>
        {/* Left side - Trading panel */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
          {/* Header with TPS */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              marginBottom: 30,
            }}
          >
            <div>
              <div
                style={{
                  fontSize: 48,
                  fontWeight: 800,
                  color: "#fff",
                  fontFamily: "system-ui",
                }}
              >
                LIVE TRADING
              </div>
              <div style={{ fontSize: 20, color: "#666", marginTop: 8 }}>
                Bitcoin Price Q1 2026
              </div>
            </div>

            {/* TPS Display */}
            <div
              style={{
                textAlign: "right",
                padding: "20px 30px",
                background: "rgba(16,185,129,0.1)",
                borderRadius: 16,
                border: `1px solid ${colors.green}44`,
              }}
            >
              <div style={{ color: colors.green, fontSize: 14, marginBottom: 4 }}>
                TRANSACTIONS/SEC
              </div>
              <div
                style={{
                  fontSize: 56,
                  fontWeight: 800,
                  fontFamily: "'JetBrains Mono', monospace",
                  color: colors.green,
                  textShadow: `0 0 30px ${colors.green}`,
                }}
              >
                {Math.round(tpsValue).toLocaleString()}
              </div>
            </div>
          </div>

          {/* Live Trade Stream */}
          <div
            style={{
              flex: 1,
              background: "rgba(255,255,255,0.02)",
              borderRadius: 20,
              border: "1px solid rgba(255,255,255,0.05)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                padding: "15px 20px",
                borderBottom: "1px solid rgba(255,255,255,0.05)",
                display: "flex",
                alignItems: "center",
                gap: 10,
              }}
            >
              <div
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  backgroundColor: colors.green,
                  boxShadow: `0 0 10px ${colors.green}`,
                }}
              />
              <span style={{ color: "#fff", fontWeight: 600 }}>Trade Stream</span>
              <span style={{ color: "#666", fontSize: 14, marginLeft: "auto" }}>
                APTOS TESTNET
              </span>
            </div>

            {/* Trades list */}
            <div style={{ padding: 20 }}>
              {activeTrades.map((trade, i) => {
                const isNew = i === activeTrades.length - 1;
                const entryOpacity = interpolate(
                  frame - (i * 15),
                  [0, 10],
                  [0, 1],
                  { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
                );

                return (
                  <div
                    key={i}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      padding: "12px 16px",
                      marginBottom: 8,
                      borderRadius: 12,
                      background: isNew
                        ? `linear-gradient(90deg, ${trade.side === "buy" ? colors.green : colors.red}22, transparent)`
                        : "rgba(255,255,255,0.02)",
                      border: isNew ? `1px solid ${trade.side === "buy" ? colors.green : colors.red}44` : "1px solid transparent",
                      opacity: entryOpacity,
                      transform: `translateX(${(1 - entryOpacity) * -30}px)`,
                    }}
                  >
                    <div
                      style={{
                        width: 60,
                        padding: "4px 0",
                        borderRadius: 6,
                        textAlign: "center",
                        fontSize: 12,
                        fontWeight: 700,
                        color: "#fff",
                        backgroundColor: trade.side === "buy" ? colors.green : colors.red,
                      }}
                    >
                      {trade.side.toUpperCase()}
                    </div>
                    <div style={{ flex: 1, marginLeft: 16, color: "#fff", fontWeight: 500 }}>
                      {trade.outcome}
                    </div>
                    <div style={{ color: "#888", marginRight: 20 }}>
                      ${trade.amount.toLocaleString()}
                    </div>
                    <div
                      style={{
                        color: trade.side === "buy" ? colors.green : colors.red,
                        fontFamily: "'JetBrains Mono', monospace",
                        fontWeight: 600,
                      }}
                    >
                      {trade.price}¢
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right side - App screenshot */}
        <div
          style={{
            width: 450,
            marginLeft: 40,
            display: "flex",
            flexDirection: "column",
          }}
        >
          {/* Phone mockup */}
          <div
            style={{
              flex: 1,
              borderRadius: 40,
              overflow: "hidden",
              boxShadow: `0 0 60px ${colors.purple}33`,
              border: `2px solid ${colors.purple}44`,
            }}
          >
            <Img
              src={staticFile("screenshots/market-detail-viewport.png")}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                objectPosition: "top",
              }}
            />
          </div>

          {/* Action buttons indicator */}
          <div
            style={{
              marginTop: 20,
              display: "flex",
              gap: 12,
            }}
          >
            <div
              style={{
                flex: 1,
                padding: "16px 24px",
                borderRadius: 12,
                background: colors.green,
                color: "#fff",
                fontWeight: 700,
                textAlign: "center",
                fontSize: 18,
                boxShadow: `0 0 30px ${colors.green}66`,
              }}
            >
              BUY YES
            </div>
            <div
              style={{
                flex: 1,
                padding: "16px 24px",
                borderRadius: 12,
                background: colors.red,
                color: "#fff",
                fontWeight: 700,
                textAlign: "center",
                fontSize: 18,
                boxShadow: `0 0 30px ${colors.red}66`,
              }}
            >
              BUY NO
            </div>
          </div>
        </div>
      </div>

      {/* Bottom ticker */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: 50,
          background: "rgba(0,0,0,0.8)",
          borderTop: `1px solid ${colors.purple}44`,
          display: "flex",
          alignItems: "center",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            display: "flex",
            gap: 60,
            animation: "ticker 20s linear infinite",
            transform: `translateX(-${(frame * 2) % 1000}px)`,
            whiteSpace: "nowrap",
          }}
        >
          {Array.from({ length: 10 }).map((_, i) => (
            <React.Fragment key={i}>
              <span style={{ color: colors.green }}>BTC Q1 &lt;$90K: 29¢ ↑</span>
              <span style={{ color: colors.red }}>$90K-$100K: 23¢ ↓</span>
              <span style={{ color: colors.green }}>$100K-$120K: 24¢ ↑</span>
              <span style={{ color: colors.cyan }}>&gt;$120K: 23¢ →</span>
              <span style={{ color: "#888" }}>|</span>
              <span style={{ color: colors.yellow }}>VOL: $1.2K</span>
              <span style={{ color: "#888" }}>|</span>
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Aptos branding */}
      <div
        style={{
          position: "absolute",
          top: 40,
          right: 40,
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "8px 16px",
          background: "rgba(255,255,255,0.05)",
          borderRadius: 8,
        }}
      >
        <span style={{ color: "#888", fontSize: 14 }}>Built on</span>
        <span style={{ color: "#fff", fontWeight: 700 }}>APTOS</span>
      </div>
    </AbsoluteFill>
  );
};
