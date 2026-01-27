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
// iPHONE HOME SCREEN - 20 second clip showing markets home with 3D phone
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

export const iPhoneHomeScreen: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  // Phone entrance animation
  const phoneEntrance = spring({
    frame,
    fps,
    config: { damping: 80, stiffness: 100 },
  });

  // 3D rotation
  const rotateY = interpolate(frame, [0, fps * 2], [25, 0], {
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });

  // Subtle floating animation
  const floatY = Math.sin(frame * 0.03) * 8;
  const floatRotate = Math.sin(frame * 0.02) * 2;

  // Screen glow pulse
  const glowPulse = 0.5 + Math.sin(frame * 0.05) * 0.3;

  // Feature cards animation
  const showFeatures = frame > fps * 2;

  const features = [
    { icon: "⚡", label: "30,000+ TPS", color: COLORS.aptosGreen },
    { icon: "🔒", label: "MEV Protected", color: COLORS.purple },
    { icon: "💰", label: "<$0.001 Fees", color: COLORS.aptosCyan },
    { icon: "🌐", label: "Global Markets", color: COLORS.blue },
  ];

  return (
    <AbsoluteFill style={{ background: COLORS.bg }}>
      {/* Animated gradient background */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `
            radial-gradient(circle at 30% 20%, ${COLORS.purple}15 0%, transparent 50%),
            radial-gradient(circle at 70% 80%, ${COLORS.aptosCyan}10 0%, transparent 50%)
          `,
        }}
      />

      {/* Floating orbs */}
      <div
        style={{
          position: "absolute",
          width: 400,
          height: 400,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${COLORS.aptosGreen}20, transparent 70%)`,
          left: "5%",
          top: "30%",
          filter: "blur(60px)",
          transform: `translate(${Math.sin(frame * 0.015) * 30}px, ${Math.cos(frame * 0.02) * 20}px)`,
        }}
      />
      <div
        style={{
          position: "absolute",
          width: 300,
          height: 300,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${COLORS.purple}25, transparent 70%)`,
          right: "10%",
          bottom: "20%",
          filter: "blur(50px)",
          transform: `translate(${Math.cos(frame * 0.018) * 25}px, ${Math.sin(frame * 0.022) * 25}px)`,
        }}
      />

      {/* Title */}
      <div
        style={{
          position: "absolute",
          top: 80,
          left: 100,
          opacity: interpolate(frame, [0, fps * 0.5], [0, 1]),
          transform: `translateY(${interpolate(frame, [0, fps * 0.5], [30, 0])}px)`,
        }}
      >
        <div
          style={{
            fontFamily: "SF Pro Display, -apple-system, sans-serif",
            fontSize: 18,
            fontWeight: 500,
            color: COLORS.aptosCyan,
            letterSpacing: "0.2em",
            marginBottom: 10,
          }}
        >
          PREDICTION MARKETS
        </div>
        <div
          style={{
            fontFamily: "SF Pro Display, -apple-system, sans-serif",
            fontSize: 64,
            fontWeight: 900,
            background: `linear-gradient(135deg, ${COLORS.text} 0%, ${COLORS.aptosGreen} 100%)`,
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}
        >
          Markets Home
        </div>
        <div
          style={{
            fontFamily: "SF Pro Display, -apple-system, sans-serif",
            fontSize: 20,
            color: COLORS.textMuted,
            marginTop: 15,
          }}
        >
          Browse real-time prediction markets on Aptos
        </div>
      </div>

      {/* iPhone mockup */}
      <div
        style={{
          position: "absolute",
          right: 120,
          top: "50%",
          transform: `
            translateY(calc(-50% + ${floatY}px))
            scale(${phoneEntrance})
            perspective(1200px)
            rotateY(${rotateY + floatRotate}deg)
          `,
          transformStyle: "preserve-3d",
        }}
      >
        {/* Phone frame */}
        <div
          style={{
            width: 380,
            height: 820,
            borderRadius: 55,
            background: "linear-gradient(145deg, #2a2a2a, #1a1a1a)",
            padding: 12,
            boxShadow: `
              0 50px 100px rgba(0,0,0,0.6),
              0 0 0 1px rgba(255,255,255,0.1),
              inset 0 1px 0 rgba(255,255,255,0.1),
              0 0 ${80 * glowPulse}px ${COLORS.aptosGreen}25
            `,
          }}
        >
          {/* Screen */}
          <div
            style={{
              width: "100%",
              height: "100%",
              borderRadius: 45,
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
                width: 120,
                height: 35,
                backgroundColor: "#000",
                borderRadius: 20,
                zIndex: 100,
                boxShadow: "0 0 10px rgba(0,0,0,0.5)",
              }}
            />

            {/* Screenshot */}
            <Img
              src={staticFile("screenshots/polymarket-home-mobile.png")}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                objectPosition: "top",
              }}
            />

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
                padding: "4px 10px",
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
                  boxShadow: `0 0 ${10 + Math.sin(frame * 0.2) * 5}px ${COLORS.aptosGreen}`,
                }}
              />
              <span style={{ fontSize: 11, color: COLORS.text, fontWeight: 600 }}>LIVE</span>
            </div>
          </div>
        </div>

        {/* Side buttons */}
        <div
          style={{
            position: "absolute",
            right: -3,
            top: 180,
            width: 4,
            height: 80,
            backgroundColor: "#333",
            borderRadius: 2,
          }}
        />
        <div
          style={{
            position: "absolute",
            left: -3,
            top: 150,
            width: 4,
            height: 40,
            backgroundColor: "#333",
            borderRadius: 2,
          }}
        />
        <div
          style={{
            position: "absolute",
            left: -3,
            top: 210,
            width: 4,
            height: 70,
            backgroundColor: "#333",
            borderRadius: 2,
          }}
        />
      </div>

      {/* Feature cards */}
      {showFeatures && (
        <div
          style={{
            position: "absolute",
            left: 100,
            bottom: 100,
            display: "flex",
            gap: 16,
          }}
        >
          {features.map((feature, i) => {
            const cardDelay = fps * 2 + i * 8;
            const cardProgress = spring({
              frame: frame - cardDelay,
              fps,
              config: { damping: 15, stiffness: 150 },
            });

            return (
              <div
                key={feature.label}
                style={{
                  padding: "16px 24px",
                  background: `linear-gradient(135deg, ${feature.color}15, ${feature.color}05)`,
                  border: `1px solid ${feature.color}40`,
                  borderRadius: 16,
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  transform: `scale(${cardProgress}) translateY(${(1 - cardProgress) * 20}px)`,
                  opacity: cardProgress,
                }}
              >
                <span style={{ fontSize: 24 }}>{feature.icon}</span>
                <span
                  style={{
                    fontFamily: "SF Pro Display",
                    fontSize: 16,
                    fontWeight: 600,
                    color: COLORS.text,
                  }}
                >
                  {feature.label}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Aptos branding */}
      <div
        style={{
          position: "absolute",
          bottom: 40,
          right: 100,
          display: "flex",
          alignItems: "center",
          gap: 10,
          opacity: interpolate(frame, [fps * 3, fps * 4], [0, 0.7]),
        }}
      >
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            background: `linear-gradient(135deg, ${COLORS.aptosGreen}, ${COLORS.aptosCyan})`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: 900,
            fontSize: 18,
            color: "#000",
          }}
        >
          A
        </div>
        <span
          style={{
            fontFamily: "SF Pro Display",
            fontSize: 18,
            fontWeight: 600,
            color: COLORS.textMuted,
          }}
        >
          Powered by Aptos
        </span>
      </div>
    </AbsoluteFill>
  );
};
