import React from "react";
import {
  AbsoluteFill,
  useVideoConfig,
  useCurrentFrame,
  spring,
  interpolate,
  Img,
  staticFile,
  Easing,
} from "remotion";

// ============================================================================
// iPHONE SCROLL SHOWCASE - 25 second smooth scroll through all app content
// ============================================================================

const COLORS = {
  bg: "#0A0A0F",
  aptosGreen: "#06D6A0",
  aptosCyan: "#00F5FF",
  purple: "#8B5CF6",
  blue: "#3B82F6",
  text: "#FFFFFF",
  textMuted: "#5A5A6E",
};

export const iPhoneScrollShowcase: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  // Phone entrance
  const phoneEntrance = spring({
    frame,
    fps,
    config: { damping: 60, stiffness: 80 },
  });

  // Scroll through content
  const scrollY = interpolate(
    frame,
    [fps * 2, durationInFrames - fps * 2],
    [0, 3500],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.inOut(Easing.quad) }
  );

  // Phone 3D rotation based on scroll
  const rotateX = interpolate(
    frame,
    [0, durationInFrames],
    [5, -5],
    { extrapolateRight: "clamp" }
  );

  // Floating animation
  const floatY = Math.sin(frame * 0.025) * 10;
  const floatRotate = Math.sin(frame * 0.02) * 2;

  // Glow intensity based on scroll position
  const glowIntensity = 0.3 + Math.sin(frame * 0.03) * 0.2;

  // Section indicators
  const sections = [
    { name: "Markets", startScroll: 0, color: COLORS.aptosGreen },
    { name: "Detail", startScroll: 900, color: COLORS.purple },
    { name: "Chart", startScroll: 1800, color: COLORS.aptosCyan },
    { name: "Trade", startScroll: 2700, color: COLORS.blue },
  ];

  const currentSection = sections.reduce((acc, section) =>
    scrollY >= section.startScroll ? section : acc
  , sections[0]);

  return (
    <AbsoluteFill style={{ background: COLORS.bg }}>
      {/* Animated background */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `
            radial-gradient(ellipse at 60% 30%, ${currentSection.color}12 0%, transparent 50%),
            radial-gradient(ellipse at 30% 70%, ${COLORS.purple}08 0%, transparent 50%)
          `,
          transition: "background 0.5s",
        }}
      />

      {/* Floating particles */}
      {Array.from({ length: 30 }).map((_, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: `${(i * 13) % 100}%`,
            top: `${((i * 19 + frame * 0.15) % 110) - 5}%`,
            width: 2 + (i % 3),
            height: 2 + (i % 3),
            borderRadius: "50%",
            backgroundColor: [COLORS.aptosGreen, COLORS.purple, COLORS.aptosCyan, COLORS.blue][i % 4],
            opacity: 0.15 + (i % 4) * 0.05,
          }}
        />
      ))}

      {/* Title and branding */}
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
            fontFamily: "SF Pro Display",
            fontSize: 16,
            color: COLORS.aptosCyan,
            letterSpacing: "0.2em",
            marginBottom: 10,
          }}
        >
          MOBILE EXPERIENCE
        </div>
        <div
          style={{
            fontFamily: "SF Pro Display",
            fontSize: 56,
            fontWeight: 900,
            background: `linear-gradient(90deg, ${COLORS.text}, ${currentSection.color})`,
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            transition: "background 0.3s",
          }}
        >
          Polymarket
        </div>
        <div
          style={{
            fontFamily: "SF Pro Display",
            fontSize: 22,
            color: COLORS.textMuted,
            marginTop: 10,
          }}
        >
          Prediction markets, reimagined for mobile
        </div>
      </div>

      {/* Section indicator */}
      <div
        style={{
          position: "absolute",
          left: 80,
          top: 250,
          display: "flex",
          flexDirection: "column",
          gap: 16,
        }}
      >
        {sections.map((section) => {
          const isActive = currentSection.name === section.name;
          return (
            <div
              key={section.name}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                opacity: isActive ? 1 : 0.3,
                transition: "opacity 0.3s",
              }}
            >
              <div
                style={{
                  width: isActive ? 40 : 10,
                  height: 4,
                  borderRadius: 2,
                  backgroundColor: section.color,
                  transition: "width 0.3s, background-color 0.3s",
                }}
              />
              <span
                style={{
                  fontFamily: "SF Pro Display",
                  fontSize: 16,
                  fontWeight: isActive ? 600 : 400,
                  color: isActive ? section.color : COLORS.textMuted,
                  transition: "color 0.3s",
                }}
              >
                {section.name}
              </span>
            </div>
          );
        })}
      </div>

      {/* Main iPhone mockup */}
      <div
        style={{
          position: "absolute",
          right: 120,
          top: "50%",
          transform: `
            translateY(calc(-50% + ${floatY}px))
            scale(${phoneEntrance})
            perspective(1500px)
            rotateY(${-10 + floatRotate}deg)
            rotateX(${rotateX}deg)
          `,
          transformStyle: "preserve-3d",
        }}
      >
        {/* Phone frame */}
        <div
          style={{
            width: 400,
            height: 865,
            borderRadius: 58,
            background: "linear-gradient(145deg, #2a2a2a, #1a1a1a)",
            padding: 12,
            boxShadow: `
              0 60px 120px rgba(0,0,0,0.6),
              0 0 0 1px rgba(255,255,255,0.1),
              inset 0 1px 0 rgba(255,255,255,0.1),
              0 0 ${100 * glowIntensity}px ${currentSection.color}25
            `,
            transition: "box-shadow 0.5s",
          }}
        >
          {/* Screen */}
          <div
            style={{
              width: "100%",
              height: "100%",
              borderRadius: 48,
              backgroundColor: "#000",
              overflow: "hidden",
              position: "relative",
            }}
          >
            {/* Dynamic Island */}
            <div
              style={{
                position: "absolute",
                top: 12,
                left: "50%",
                transform: "translateX(-50%)",
                width: 125,
                height: 36,
                backgroundColor: "#000",
                borderRadius: 20,
                zIndex: 100,
              }}
            />

            {/* Scrolling content */}
            <div
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                transform: `translateY(-${scrollY}px)`,
              }}
            >
              {/* Stack all screenshots vertically */}
              <Img
                src={staticFile("screenshots/polymarket-home-mobile.png")}
                style={{ width: "100%", display: "block" }}
              />
              <Img
                src={staticFile("screenshots/khamenei-market-loaded.png")}
                style={{ width: "100%", display: "block" }}
              />
              <Img
                src={staticFile("screenshots/polymarket-khamenei-chart.png")}
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
                inset: 0,
                background: `linear-gradient(135deg, rgba(255,255,255,0.05) 0%, transparent 40%)`,
                pointerEvents: "none",
              }}
            />

            {/* Live indicator */}
            <div
              style={{
                position: "absolute",
                top: 55,
                right: 15,
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "5px 12px",
                background: "rgba(0,0,0,0.7)",
                borderRadius: 20,
                backdropFilter: "blur(10px)",
              }}
            >
              <div
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  backgroundColor: COLORS.aptosGreen,
                  boxShadow: `0 0 ${8 + Math.sin(frame * 0.15) * 4}px ${COLORS.aptosGreen}`,
                }}
              />
              <span style={{ fontSize: 11, color: "#fff", fontWeight: 600 }}>ON-CHAIN</span>
            </div>
          </div>
        </div>

        {/* Side buttons */}
        <div
          style={{
            position: "absolute",
            right: -3,
            top: 200,
            width: 4,
            height: 90,
            backgroundColor: "#333",
            borderRadius: 2,
          }}
        />
        <div
          style={{
            position: "absolute",
            left: -3,
            top: 160,
            width: 4,
            height: 45,
            backgroundColor: "#333",
            borderRadius: 2,
          }}
        />
        <div
          style={{
            position: "absolute",
            left: -3,
            top: 220,
            width: 4,
            height: 80,
            backgroundColor: "#333",
            borderRadius: 2,
          }}
        />
      </div>

      {/* Stats at bottom */}
      <div
        style={{
          position: "absolute",
          bottom: 60,
          left: 80,
          display: "flex",
          gap: 40,
          opacity: interpolate(frame, [fps * 2, fps * 3], [0, 0.8]),
        }}
      >
        {[
          { icon: "⚡", value: "30K+ TPS", label: "Throughput" },
          { icon: "🔒", value: "MEV Free", label: "Protected" },
          { icon: "💰", value: "<$0.001", label: "Per Trade" },
        ].map((stat) => (
          <div key={stat.label} style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 28 }}>{stat.icon}</span>
            <div>
              <div style={{ fontFamily: "SF Pro Display", fontSize: 20, fontWeight: 700, color: COLORS.text }}>
                {stat.value}
              </div>
              <div style={{ fontFamily: "monospace", fontSize: 11, color: COLORS.textMuted }}>
                {stat.label}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Aptos badge */}
      <div
        style={{
          position: "absolute",
          bottom: 40,
          right: 80,
          display: "flex",
          alignItems: "center",
          gap: 10,
          opacity: 0.6,
        }}
      >
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: 7,
            background: `linear-gradient(135deg, ${COLORS.aptosGreen}, ${COLORS.aptosCyan})`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: 900,
            fontSize: 16,
            color: "#000",
          }}
        >
          A
        </div>
        <span style={{ fontFamily: "SF Pro Display", fontSize: 16, color: COLORS.textMuted }}>
          Built on Aptos
        </span>
      </div>
    </AbsoluteFill>
  );
};
