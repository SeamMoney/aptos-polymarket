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
  Sequence,
} from "remotion";

// ============================================================================
// iPHONE TRADING FLOW - 25 second clip showing full trading UX
// ============================================================================

const COLORS = {
  bg: "#0A0A0F",
  aptosGreen: "#06D6A0",
  aptosCyan: "#00F5FF",
  purple: "#8B5CF6",
  yes: "#4ADE80",
  no: "#F87171",
  text: "#FFFFFF",
  textMuted: "#5A5A6E",
};

interface PhoneScreenProps {
  screenshot: string;
  scale?: number;
  rotateY?: number;
  glow?: string;
}

const PhoneScreen: React.FC<PhoneScreenProps> = ({
  screenshot,
  scale = 1,
  rotateY = 0,
  glow = COLORS.aptosGreen,
}) => {
  const frame = useCurrentFrame();
  const floatY = Math.sin(frame * 0.04) * 5;

  return (
    <div
      style={{
        transform: `
          translateY(${floatY}px)
          scale(${scale})
          perspective(1200px)
          rotateY(${rotateY}deg)
        `,
        transformStyle: "preserve-3d",
      }}
    >
      <div
        style={{
          width: 320,
          height: 693,
          borderRadius: 46,
          background: "linear-gradient(145deg, #2a2a2a, #1a1a1a)",
          padding: 10,
          boxShadow: `
            0 40px 80px rgba(0,0,0,0.5),
            0 0 0 1px rgba(255,255,255,0.1),
            0 0 50px ${glow}20
          `,
        }}
      >
        <div
          style={{
            width: "100%",
            height: "100%",
            borderRadius: 38,
            backgroundColor: "#000",
            overflow: "hidden",
            position: "relative",
          }}
        >
          {/* Dynamic Island */}
          <div
            style={{
              position: "absolute",
              top: 10,
              left: "50%",
              transform: "translateX(-50%)",
              width: 100,
              height: 30,
              backgroundColor: "#000",
              borderRadius: 16,
              zIndex: 100,
            }}
          />

          <Img
            src={staticFile(screenshot)}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              objectPosition: "top",
            }}
          />

          {/* Reflection */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "linear-gradient(135deg, rgba(255,255,255,0.04) 0%, transparent 30%)",
            }}
          />
        </div>
      </div>
    </div>
  );
};

export const iPhoneTradingFlow: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Scene timing
  const scene1End = fps * 5;    // Browse markets
  const scene2End = fps * 12;   // Select market
  const scene3End = fps * 19;   // View order book
  // scene4 = buy flow (to end)

  const currentScene = frame < scene1End ? 1
    : frame < scene2End ? 2
    : frame < scene3End ? 3
    : 4;

  // Scene labels
  const sceneLabels = [
    { num: 1, label: "Browse Markets", active: currentScene === 1 },
    { num: 2, label: "Select Market", active: currentScene === 2 },
    { num: 3, label: "View Order Book", active: currentScene === 3 },
    { num: 4, label: "Place Trade", active: currentScene === 4 },
  ];

  // Phone positions for each scene
  const getPhoneTransform = () => {
    if (currentScene === 1) {
      const progress = interpolate(frame, [0, fps], [0, 1], { extrapolateRight: "clamp" });
      return { x: interpolate(progress, [0, 1], [300, 0]), rotate: interpolate(progress, [0, 1], [20, 5]) };
    }
    if (currentScene === 2) {
      const localFrame = frame - scene1End;
      const progress = interpolate(localFrame, [0, fps * 0.5], [0, 1], { extrapolateRight: "clamp" });
      return { x: interpolate(progress, [0, 1], [0, -100]), rotate: 0 };
    }
    if (currentScene === 3) {
      return { x: -100, rotate: -3 };
    }
    return { x: -100, rotate: 0 };
  };

  const phoneTransform = getPhoneTransform();

  // Screenshots for each scene
  const screenshots = [
    "screenshots/polymarket-home-mobile.png",
    "screenshots/khamenei-market-loaded.png",
    "screenshots/market-orderbook.png",
    "screenshots/market-bids-buy.png",
  ];

  return (
    <AbsoluteFill style={{ background: COLORS.bg }}>
      {/* Background particles */}
      {Array.from({ length: 20 }).map((_, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: `${(i * 17) % 100}%`,
            top: `${((i * 23 + frame * 0.2) % 110) - 5}%`,
            width: 3 + (i % 3),
            height: 3 + (i % 3),
            borderRadius: "50%",
            backgroundColor: [COLORS.aptosGreen, COLORS.purple, COLORS.aptosCyan][i % 3],
            opacity: 0.2,
          }}
        />
      ))}

      {/* Title */}
      <div
        style={{
          position: "absolute",
          top: 60,
          left: 80,
        }}
      >
        <div
          style={{
            fontFamily: "SF Pro Display",
            fontSize: 18,
            color: COLORS.aptosCyan,
            letterSpacing: "0.15em",
            marginBottom: 10,
          }}
        >
          USER EXPERIENCE
        </div>
        <div
          style={{
            fontFamily: "SF Pro Display",
            fontSize: 56,
            fontWeight: 900,
            color: COLORS.text,
          }}
        >
          Trading Flow
        </div>
      </div>

      {/* Scene progress indicators */}
      <div
        style={{
          position: "absolute",
          top: 200,
          left: 80,
          display: "flex",
          flexDirection: "column",
          gap: 20,
        }}
      >
        {sceneLabels.map((scene, i) => {
          const isComplete = currentScene > scene.num;
          const isActive = scene.active;

          return (
            <div
              key={scene.num}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 16,
                opacity: isComplete ? 0.4 : isActive ? 1 : 0.3,
              }}
            >
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: "50%",
                  backgroundColor: isActive ? COLORS.aptosGreen : isComplete ? COLORS.aptosGreen + "40" : "transparent",
                  border: `2px solid ${isActive ? COLORS.aptosGreen : COLORS.textMuted}`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontFamily: "SF Pro Display",
                  fontSize: 18,
                  fontWeight: 700,
                  color: isActive ? "#000" : COLORS.textMuted,
                  transition: "all 0.3s",
                }}
              >
                {isComplete ? "✓" : scene.num}
              </div>
              <span
                style={{
                  fontFamily: "SF Pro Display",
                  fontSize: 20,
                  fontWeight: isActive ? 600 : 400,
                  color: isActive ? COLORS.text : COLORS.textMuted,
                }}
              >
                {scene.label}
              </span>
            </div>
          );
        })}
      </div>

      {/* Phone mockup */}
      <div
        style={{
          position: "absolute",
          right: 150,
          top: "50%",
          transform: `
            translateY(-50%)
            translateX(${phoneTransform.x}px)
            perspective(1200px)
            rotateY(${phoneTransform.rotate}deg)
          `,
        }}
      >
        <PhoneScreen
          screenshot={screenshots[currentScene - 1]}
          glow={currentScene === 4 ? COLORS.yes : COLORS.aptosGreen}
        />
      </div>

      {/* Action label for current scene */}
      <div
        style={{
          position: "absolute",
          bottom: 100,
          left: 80,
          padding: "20px 40px",
          background: `linear-gradient(135deg, ${COLORS.aptosGreen}20, ${COLORS.aptosCyan}10)`,
          borderRadius: 20,
          border: `1px solid ${COLORS.aptosGreen}40`,
        }}
      >
        <div style={{ fontFamily: "monospace", fontSize: 14, color: COLORS.aptosGreen, marginBottom: 8 }}>
          STEP {currentScene}/4
        </div>
        <div style={{ fontFamily: "SF Pro Display", fontSize: 28, fontWeight: 700, color: COLORS.text }}>
          {sceneLabels[currentScene - 1].label}
        </div>
      </div>

      {/* Bottom stats */}
      <div
        style={{
          position: "absolute",
          bottom: 40,
          right: 80,
          display: "flex",
          gap: 30,
          opacity: 0.7,
        }}
      >
        <div style={{ textAlign: "center" }}>
          <div style={{ fontFamily: "SF Pro Display", fontSize: 24, fontWeight: 700, color: COLORS.aptosGreen }}>
            ~470ms
          </div>
          <div style={{ fontFamily: "monospace", fontSize: 12, color: COLORS.textMuted }}>Finality</div>
        </div>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontFamily: "SF Pro Display", fontSize: 24, fontWeight: 700, color: COLORS.aptosCyan }}>
            {"<$0.001"}
          </div>
          <div style={{ fontFamily: "monospace", fontSize: 12, color: COLORS.textMuted }}>Fee</div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
