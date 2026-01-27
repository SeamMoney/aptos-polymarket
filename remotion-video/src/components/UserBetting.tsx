import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
  Easing,
} from "remotion";

export const UserBetting: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const polymarketColors = {
    purple: "#8B5CF6",
    blue: "#3B82F6",
    green: "#10B981",
    red: "#EF4444",
    yellow: "#F59E0B",
    cyan: "#06B6D4",
  };

  // Animation phases
  const slideIn = spring({
    frame,
    fps,
    config: {
      damping: 80,
      stiffness: 150,
    },
  });

  // Price animation (starts at 42%, ends at 65%)
  const priceProgress = interpolate(
    frame,
    [fps * 2, fps * 7],
    [42, 65],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.out(Easing.cubic),
    }
  );

  // Bet amount typing animation
  const betAmount = interpolate(
    frame,
    [fps * 3, fps * 4],
    [0, 100],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }
  );

  // Button click animation
  const buttonClick = frame > fps * 5 && frame < fps * 5.3;
  const buttonScale = buttonClick ? 0.95 : 1;

  // Success animation
  const showSuccess = frame > fps * 5.5;
  const successOpacity = interpolate(
    frame,
    [fps * 5.5, fps * 6],
    [0, 1],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }
  );

  // TPS counter
  const tpsCount = interpolate(
    frame,
    [fps * 6, fps * 9],
    [0, 30847],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.out(Easing.cubic),
    }
  );

  // Chart data points
  const chartProgress = interpolate(
    frame,
    [0, durationInFrames],
    [0, 1],
    {
      easing: Easing.linear,
    }
  );

  const chartPoints = [
    { x: 0, y: 42 },
    { x: 15, y: 40 },
    { x: 30, y: 45 },
    { x: 45, y: 48 },
    { x: 60, y: 52 },
    { x: 75, y: 58 },
    { x: 90, y: 62 },
    { x: 100, y: 65 },
  ];

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#0d0d0d",
        fontFamily: "'Inter', -apple-system, sans-serif",
      }}
    >
      {/* Background gradient */}
      <div
        style={{
          position: "absolute",
          width: "100%",
          height: "100%",
          background: `radial-gradient(circle at 70% 30%, ${polymarketColors.purple}15, transparent 50%),
                       radial-gradient(circle at 30% 70%, ${polymarketColors.blue}10, transparent 50%)`,
        }}
      />

      <div
        style={{
          display: "flex",
          height: "100%",
          padding: 60,
          gap: 40,
          transform: `translateX(${(1 - slideIn) * -100}px)`,
          opacity: slideIn,
        }}
      >
        {/* Left side - Market info */}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
          }}
        >
          {/* Header */}
          <div
            style={{
              marginBottom: 40,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 15,
                marginBottom: 20,
              }}
            >
              <div
                style={{
                  width: 50,
                  height: 50,
                  borderRadius: 12,
                  background: `linear-gradient(135deg, ${polymarketColors.purple}, ${polymarketColors.blue})`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 24,
                }}
              >
                🇺🇸
              </div>
              <span
                style={{
                  color: "#888",
                  fontSize: 14,
                  background: "#1a1a1a",
                  padding: "4px 12px",
                  borderRadius: 20,
                }}
              >
                Politics
              </span>
            </div>
            <h1
              style={{
                fontSize: 36,
                fontWeight: 700,
                color: "#fff",
                margin: 0,
                lineHeight: 1.3,
              }}
            >
              Will Trump win the 2028 Presidential Election?
            </h1>
          </div>

          {/* Chart */}
          <div
            style={{
              flex: 1,
              backgroundColor: "#1a1a1a",
              borderRadius: 20,
              padding: 30,
              border: "1px solid #333",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: 20,
              }}
            >
              <span style={{ color: "#888", fontSize: 14 }}>24h Volume: $2.4M</span>
              <span style={{ color: polymarketColors.green, fontSize: 14 }}>
                +{(priceProgress - 42).toFixed(1)}%
              </span>
            </div>

            {/* SVG Chart */}
            <svg
              viewBox="0 0 100 50"
              style={{
                width: "100%",
                height: 300,
              }}
            >
              {/* Grid lines */}
              {[0, 25, 50, 75, 100].map((y) => (
                <line
                  key={y}
                  x1="0"
                  y1={50 - y / 2}
                  x2="100"
                  y2={50 - y / 2}
                  stroke="#333"
                  strokeWidth="0.2"
                />
              ))}

              {/* Chart line */}
              <defs>
                <linearGradient id="lineGradient" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor={polymarketColors.purple} />
                  <stop offset="100%" stopColor={polymarketColors.green} />
                </linearGradient>
                <linearGradient id="fillGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={polymarketColors.purple} stopOpacity="0.3" />
                  <stop offset="100%" stopColor={polymarketColors.purple} stopOpacity="0" />
                </linearGradient>
              </defs>

              {/* Area fill */}
              <path
                d={`M 0 50 ${chartPoints
                  .filter((_, i) => i / chartPoints.length <= chartProgress)
                  .map((p) => `L ${p.x} ${50 - p.y / 2}`)
                  .join(" ")} L ${chartProgress * 100} 50 Z`}
                fill="url(#fillGradient)"
              />

              {/* Line */}
              <path
                d={`M ${chartPoints
                  .filter((_, i) => i / chartPoints.length <= chartProgress)
                  .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${50 - p.y / 2}`)
                  .join(" ")}`}
                fill="none"
                stroke="url(#lineGradient)"
                strokeWidth="0.8"
              />

              {/* Current point */}
              <circle
                cx={chartProgress * 100}
                cy={50 - priceProgress / 2}
                r="1.5"
                fill={polymarketColors.green}
              />
            </svg>
          </div>
        </div>

        {/* Right side - Betting panel */}
        <div
          style={{
            width: 450,
            backgroundColor: "#1a1a1a",
            borderRadius: 20,
            padding: 30,
            border: `2px solid ${polymarketColors.purple}44`,
            boxShadow: `0 0 60px ${polymarketColors.purple}22`,
            display: "flex",
            flexDirection: "column",
          }}
        >
          {/* Outcome buttons */}
          <div
            style={{
              display: "flex",
              gap: 15,
              marginBottom: 30,
            }}
          >
            <div
              style={{
                flex: 1,
                padding: 20,
                borderRadius: 12,
                backgroundColor: `${polymarketColors.green}22`,
                border: `2px solid ${polymarketColors.green}`,
                textAlign: "center",
              }}
            >
              <div style={{ color: polymarketColors.green, fontSize: 14, marginBottom: 5 }}>
                Yes
              </div>
              <div style={{ color: "#fff", fontSize: 28, fontWeight: 700 }}>
                {priceProgress.toFixed(0)}¢
              </div>
            </div>
            <div
              style={{
                flex: 1,
                padding: 20,
                borderRadius: 12,
                backgroundColor: "#222",
                border: "2px solid #333",
                textAlign: "center",
              }}
            >
              <div style={{ color: "#888", fontSize: 14, marginBottom: 5 }}>No</div>
              <div style={{ color: "#888", fontSize: 28, fontWeight: 700 }}>
                {(100 - priceProgress).toFixed(0)}¢
              </div>
            </div>
          </div>

          {/* Amount input */}
          <div style={{ marginBottom: 30 }}>
            <label style={{ color: "#888", fontSize: 14, marginBottom: 10, display: "block" }}>
              Amount
            </label>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                backgroundColor: "#111",
                borderRadius: 12,
                padding: "15px 20px",
                border: "1px solid #333",
              }}
            >
              <span style={{ color: "#666", marginRight: 10 }}>$</span>
              <span style={{ color: "#fff", fontSize: 24, fontWeight: 600, flex: 1 }}>
                {Math.round(betAmount)}
              </span>
              <span style={{ color: polymarketColors.cyan, fontSize: 14 }}>USD1</span>
            </div>
          </div>

          {/* Potential return */}
          <div
            style={{
              backgroundColor: "#111",
              borderRadius: 12,
              padding: 20,
              marginBottom: 30,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: 15,
              }}
            >
              <span style={{ color: "#888" }}>Potential Return</span>
              <span style={{ color: polymarketColors.green, fontWeight: 600 }}>
                ${(betAmount / (priceProgress / 100)).toFixed(2)}
              </span>
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
              }}
            >
              <span style={{ color: "#888" }}>Shares</span>
              <span style={{ color: "#fff" }}>
                {(betAmount / (priceProgress / 100)).toFixed(2)} YES
              </span>
            </div>
          </div>

          {/* Buy button */}
          <button
            style={{
              width: "100%",
              padding: 20,
              borderRadius: 12,
              border: "none",
              background: showSuccess
                ? polymarketColors.green
                : `linear-gradient(135deg, ${polymarketColors.purple}, ${polymarketColors.blue})`,
              color: "#fff",
              fontSize: 18,
              fontWeight: 700,
              cursor: "pointer",
              transform: `scale(${buttonScale})`,
              transition: "transform 0.1s",
            }}
          >
            {showSuccess ? "✓ Trade Confirmed!" : "Buy Yes"}
          </button>

          {/* Success message */}
          {showSuccess && (
            <div
              style={{
                marginTop: 20,
                opacity: successOpacity,
                textAlign: "center",
              }}
            >
              <div
                style={{
                  color: polymarketColors.green,
                  fontSize: 14,
                  marginBottom: 10,
                }}
              >
                Transaction confirmed in 0.4s
              </div>
              <div
                style={{
                  color: "#666",
                  fontSize: 12,
                  fontFamily: "'JetBrains Mono', monospace",
                }}
              >
                tx: 0x7a8b...f3e2
              </div>
            </div>
          )}
        </div>
      </div>

      {/* TPS Counter overlay */}
      {frame > fps * 6 && (
        <div
          style={{
            position: "absolute",
            bottom: 40,
            left: "50%",
            transform: "translateX(-50%)",
            display: "flex",
            alignItems: "center",
            gap: 20,
            backgroundColor: "#1a1a1a",
            padding: "15px 30px",
            borderRadius: 50,
            border: `1px solid ${polymarketColors.purple}44`,
          }}
        >
          <div
            style={{
              width: 12,
              height: 12,
              borderRadius: "50%",
              backgroundColor: polymarketColors.green,
              animation: "pulse 1s infinite",
            }}
          />
          <div
            style={{
              fontSize: 14,
              color: "#888",
            }}
          >
            Live TPS:
          </div>
          <div
            style={{
              fontSize: 28,
              fontWeight: 700,
              background: `linear-gradient(90deg, ${polymarketColors.purple}, ${polymarketColors.green})`,
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              fontFamily: "'JetBrains Mono', monospace",
            }}
          >
            {Math.round(tpsCount).toLocaleString()}
          </div>
        </div>
      )}

      {/* Powered by Aptos */}
      <div
        style={{
          position: "absolute",
          bottom: 40,
          right: 60,
          display: "flex",
          alignItems: "center",
          gap: 10,
          opacity: 0.6,
        }}
      >
        <span style={{ color: "#666", fontSize: 14 }}>Powered by</span>
        <span
          style={{
            color: "#fff",
            fontSize: 16,
            fontWeight: 600,
          }}
        >
          APTOS
        </span>
      </div>
    </AbsoluteFill>
  );
};
