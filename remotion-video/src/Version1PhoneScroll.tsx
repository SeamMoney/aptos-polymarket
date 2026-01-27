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
} from "remotion";

// Version 1: "Phone Scroll" - Elegant phone mockup scrolling through the app
export const Version1PhoneScroll: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const colors = {
    purple: "#8B5CF6",
    blue: "#3B82F6",
    green: "#10B981",
    cyan: "#06B6D4",
    pink: "#EC4899",
  };

  // Phone entrance animation
  const phoneScale = spring({
    frame,
    fps,
    config: { damping: 80, stiffness: 100 },
  });

  const phoneRotateY = interpolate(frame, [0, fps * 2], [15, 0], {
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });

  // Scroll progress through the app
  const scrollProgress = interpolate(
    frame,
    [fps * 2, durationInFrames - fps * 3],
    [0, 2500],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.inOut(Easing.quad) }
  );

  // Floating particles
  const particles = Array.from({ length: 30 }, (_, i) => ({
    x: (i * 137) % 100,
    y: ((i * 73 + frame * 0.3) % 120) - 10,
    size: 2 + (i % 4),
    opacity: 0.1 + (i % 5) * 0.1,
    color: [colors.purple, colors.blue, colors.cyan, colors.green, colors.pink][i % 5],
  }));

  // TPS counter animation
  const tpsValue = interpolate(
    frame,
    [fps * 5, fps * 8],
    [0, 30847],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  const showTPS = frame > fps * 5;

  return (
    <AbsoluteFill
      style={{
        background: `linear-gradient(135deg, #0a0a0f 0%, #1a1a2e 50%, #0a0a0f 100%)`,
        overflow: "hidden",
      }}
    >
      {/* Animated gradient orbs */}
      <div
        style={{
          position: "absolute",
          width: 600,
          height: 600,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${colors.purple}40, transparent 70%)`,
          left: "10%",
          top: "20%",
          filter: "blur(60px)",
          transform: `translate(${Math.sin(frame * 0.02) * 50}px, ${Math.cos(frame * 0.015) * 30}px)`,
        }}
      />
      <div
        style={{
          position: "absolute",
          width: 500,
          height: 500,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${colors.cyan}30, transparent 70%)`,
          right: "15%",
          bottom: "10%",
          filter: "blur(50px)",
          transform: `translate(${Math.cos(frame * 0.018) * 40}px, ${Math.sin(frame * 0.022) * 40}px)`,
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
            backgroundColor: p.color,
            opacity: p.opacity,
            boxShadow: `0 0 ${p.size * 2}px ${p.color}`,
          }}
        />
      ))}

      {/* Title */}
      <div
        style={{
          position: "absolute",
          top: 60,
          left: 80,
          opacity: interpolate(frame, [0, fps], [0, 1]),
        }}
      >
        <div
          style={{
            fontSize: 56,
            fontWeight: 800,
            background: `linear-gradient(90deg, ${colors.purple}, ${colors.cyan})`,
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            fontFamily: "system-ui, -apple-system, sans-serif",
          }}
        >
          POLYMARKET
        </div>
        <div style={{ fontSize: 24, color: "#666", marginTop: 8 }}>
          on Aptos • 30,000+ TPS
        </div>
      </div>

      {/* Phone mockup */}
      <div
        style={{
          position: "absolute",
          right: 100,
          top: "50%",
          transform: `translateY(-50%) scale(${phoneScale}) perspective(1000px) rotateY(${phoneRotateY}deg)`,
          transformStyle: "preserve-3d",
        }}
      >
        {/* Phone frame */}
        <div
          style={{
            width: 390,
            height: 844,
            borderRadius: 50,
            background: "linear-gradient(145deg, #2a2a2a, #1a1a1a)",
            padding: 12,
            boxShadow: `
              0 50px 100px rgba(0,0,0,0.5),
              0 0 0 1px rgba(255,255,255,0.1),
              inset 0 1px 0 rgba(255,255,255,0.1),
              0 0 80px ${colors.purple}22
            `,
          }}
        >
          {/* Screen bezel */}
          <div
            style={{
              width: "100%",
              height: "100%",
              borderRadius: 40,
              backgroundColor: "#000",
              overflow: "hidden",
              position: "relative",
            }}
          >
            {/* Dynamic island */}
            <div
              style={{
                position: "absolute",
                top: 12,
                left: "50%",
                transform: "translateX(-50%)",
                width: 120,
                height: 35,
                backgroundColor: "#000",
                borderRadius: 20,
                zIndex: 100,
              }}
            />

            {/* Screen content - scrolling screenshots */}
            <div
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                transform: `translateY(-${scrollProgress}px)`,
              }}
            >
              <Img
                src={staticFile("screenshots/polymarket-home-mobile.png")}
                style={{ width: "100%", display: "block" }}
              />
              <Img
                src={staticFile("screenshots/market-detail-viewport.png")}
                style={{ width: "100%", display: "block" }}
              />
              <Img
                src={staticFile("screenshots/market-orderbook.png")}
                style={{ width: "100%", display: "block" }}
              />
              <Img
                src={staticFile("screenshots/market-bids-buy.png")}
                style={{ width: "100%", display: "block" }}
              />
            </div>

            {/* Screen reflection */}
            <div
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: "linear-gradient(135deg, rgba(255,255,255,0.03) 0%, transparent 50%)",
                pointerEvents: "none",
              }}
            />
          </div>
        </div>
      </div>

      {/* Stats panel */}
      <div
        style={{
          position: "absolute",
          left: 80,
          bottom: 80,
          opacity: interpolate(frame, [fps * 3, fps * 4], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
        }}
      >
        {/* TPS Counter */}
        {showTPS && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 20,
              marginBottom: 30,
              padding: "20px 30px",
              background: "rgba(255,255,255,0.05)",
              borderRadius: 20,
              border: "1px solid rgba(255,255,255,0.1)",
              backdropFilter: "blur(10px)",
            }}
          >
            <div
              style={{
                width: 12,
                height: 12,
                borderRadius: "50%",
                backgroundColor: colors.green,
                boxShadow: `0 0 20px ${colors.green}`,
                animation: "pulse 1s infinite",
              }}
            />
            <div>
              <div style={{ color: "#888", fontSize: 14 }}>Live TPS</div>
              <div
                style={{
                  fontSize: 48,
                  fontWeight: 800,
                  fontFamily: "'JetBrains Mono', monospace",
                  background: `linear-gradient(90deg, ${colors.green}, ${colors.cyan})`,
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                }}
              >
                {Math.round(tpsValue).toLocaleString()}
              </div>
            </div>
          </div>
        )}

        {/* Feature badges */}
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", maxWidth: 500 }}>
          {["Instant Finality", "0.001¢ Fees", "Parallel Execution", "Mobile First"].map((feature, i) => (
            <div
              key={feature}
              style={{
                padding: "10px 20px",
                borderRadius: 30,
                background: `linear-gradient(135deg, ${colors.purple}22, ${colors.blue}22)`,
                border: `1px solid ${colors.purple}44`,
                color: "#fff",
                fontSize: 14,
                fontWeight: 500,
                opacity: interpolate(
                  frame,
                  [fps * 4 + i * 5, fps * 4 + i * 5 + 10],
                  [0, 1],
                  { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
                ),
                transform: `translateY(${interpolate(
                  frame,
                  [fps * 4 + i * 5, fps * 4 + i * 5 + 10],
                  [20, 0],
                  { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
                )}px)`,
              }}
            >
              {feature}
            </div>
          ))}
        </div>
      </div>

      {/* Powered by Aptos */}
      <div
        style={{
          position: "absolute",
          bottom: 30,
          right: 80,
          display: "flex",
          alignItems: "center",
          gap: 12,
          opacity: 0.6,
        }}
      >
        <span style={{ color: "#888", fontSize: 16 }}>Powered by</span>
        <span style={{ color: "#fff", fontSize: 20, fontWeight: 700 }}>APTOS</span>
      </div>
    </AbsoluteFill>
  );
};
