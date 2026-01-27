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
// iPHONE APP TOUR - 30 second comprehensive tour of all app screens
// ============================================================================

const COLORS = {
  bg: "#0A0A0F",
  aptosGreen: "#06D6A0",
  aptosCyan: "#00F5FF",
  purple: "#8B5CF6",
  blue: "#3B82F6",
  gold: "#FFD700",
  text: "#FFFFFF",
  textMuted: "#5A5A6E",
};

interface Screen {
  name: string;
  screenshot: string;
  color: string;
  description: string;
}

const screens: Screen[] = [
  {
    name: "Markets Home",
    screenshot: "screenshots/polymarket-home-mobile.png",
    color: COLORS.aptosGreen,
    description: "Browse prediction markets"
  },
  {
    name: "Market Detail",
    screenshot: "screenshots/khamenei-market-loaded.png",
    color: COLORS.purple,
    description: "View market data & chart"
  },
  {
    name: "Price Chart",
    screenshot: "screenshots/polymarket-khamenei-chart.png",
    color: COLORS.aptosCyan,
    description: "Real-time price movements"
  },
  {
    name: "Order Book",
    screenshot: "screenshots/market-orderbook.png",
    color: COLORS.blue,
    description: "Live trading activity"
  },
  {
    name: "Trade",
    screenshot: "screenshots/market-bids-buy.png",
    color: COLORS.gold,
    description: "Place your prediction"
  },
];

export const iPhoneAppTour: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames, width, height } = useVideoConfig();

  // Calculate current screen based on frame
  const screenDuration = durationInFrames / screens.length;
  const currentScreenIndex = Math.min(
    Math.floor(frame / screenDuration),
    screens.length - 1
  );
  const currentScreen = screens[currentScreenIndex];
  const localFrame = frame - currentScreenIndex * screenDuration;
  const screenProgress = localFrame / screenDuration;

  // Phone carousel position
  const carouselOffset = interpolate(
    frame,
    screens.map((_, i) => i * screenDuration),
    screens.map((_, i) => -i * 400),
    { extrapolateRight: "clamp" }
  );

  // Main phone scale
  const phoneScale = spring({
    frame: localFrame,
    fps,
    config: { damping: 50, stiffness: 100 },
  });

  return (
    <AbsoluteFill style={{ background: COLORS.bg }}>
      {/* Animated background gradient based on current screen */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `
            radial-gradient(ellipse at 50% 30%, ${currentScreen.color}15 0%, transparent 60%),
            radial-gradient(ellipse at 20% 80%, ${COLORS.purple}10 0%, transparent 50%)
          `,
          transition: "background 0.5s",
        }}
      />

      {/* Title */}
      <div
        style={{
          position: "absolute",
          top: 50,
          left: 0,
          right: 0,
          textAlign: "center",
        }}
      >
        <div
          style={{
            fontFamily: "SF Pro Display",
            fontSize: 18,
            color: COLORS.aptosCyan,
            letterSpacing: "0.2em",
            marginBottom: 12,
          }}
        >
          POLYMARKET ON APTOS
        </div>
        <div
          style={{
            fontFamily: "SF Pro Display",
            fontSize: 56,
            fontWeight: 900,
            color: COLORS.text,
          }}
        >
          App Tour
        </div>
      </div>

      {/* Phone carousel */}
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: `translateX(-50%) translateY(-50%)`,
          display: "flex",
          alignItems: "center",
          gap: 60,
        }}
      >
        {screens.map((screen, i) => {
          const isActive = i === currentScreenIndex;
          const offset = (i - currentScreenIndex) * 380;
          const scale = isActive ? 1 : 0.75;
          const opacity = isActive ? 1 : 0.3;
          const rotateY = isActive ? 0 : (i < currentScreenIndex ? 25 : -25);
          const zIndex = isActive ? 10 : 5 - Math.abs(i - currentScreenIndex);

          // Animate into position
          const animScale = isActive
            ? spring({ frame: localFrame, fps, config: { damping: 50, stiffness: 100 } })
            : scale;

          return (
            <div
              key={screen.name}
              style={{
                position: "absolute",
                left: "50%",
                transform: `
                  translateX(calc(-50% + ${offset}px))
                  scale(${animScale})
                  perspective(1200px)
                  rotateY(${rotateY}deg)
                `,
                opacity,
                zIndex,
                transition: "transform 0.5s ease-out, opacity 0.3s",
              }}
            >
              {/* Phone frame */}
              <div
                style={{
                  width: 340,
                  height: 735,
                  borderRadius: 50,
                  background: "linear-gradient(145deg, #2a2a2a, #1a1a1a)",
                  padding: 11,
                  boxShadow: isActive
                    ? `
                      0 50px 100px rgba(0,0,0,0.5),
                      0 0 0 1px rgba(255,255,255,0.1),
                      0 0 80px ${screen.color}30
                    `
                    : "0 30px 60px rgba(0,0,0,0.3)",
                }}
              >
                {/* Screen */}
                <div
                  style={{
                    width: "100%",
                    height: "100%",
                    borderRadius: 42,
                    backgroundColor: "#000",
                    overflow: "hidden",
                    position: "relative",
                  }}
                >
                  {/* Dynamic Island */}
                  <div
                    style={{
                      position: "absolute",
                      top: 11,
                      left: "50%",
                      transform: "translateX(-50%)",
                      width: 110,
                      height: 32,
                      backgroundColor: "#000",
                      borderRadius: 18,
                      zIndex: 100,
                    }}
                  />

                  <Img
                    src={staticFile(screen.screenshot)}
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
                      background: "linear-gradient(135deg, rgba(255,255,255,0.04) 0%, transparent 30%)",
                    }}
                  />

                  {/* Active indicator */}
                  {isActive && (
                    <div
                      style={{
                        position: "absolute",
                        top: 50,
                        right: 12,
                        display: "flex",
                        alignItems: "center",
                        gap: 5,
                        padding: "4px 10px",
                        background: "rgba(0,0,0,0.7)",
                        borderRadius: 15,
                        backdropFilter: "blur(10px)",
                      }}
                    >
                      <div
                        style={{
                          width: 7,
                          height: 7,
                          borderRadius: "50%",
                          backgroundColor: screen.color,
                          boxShadow: `0 0 10px ${screen.color}`,
                        }}
                      />
                      <span style={{ fontSize: 10, color: "#fff", fontWeight: 600 }}>LIVE</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Screen name label */}
      <div
        style={{
          position: "absolute",
          bottom: 120,
          left: 0,
          right: 0,
          textAlign: "center",
        }}
      >
        <div
          style={{
            display: "inline-block",
            padding: "16px 40px",
            background: `linear-gradient(135deg, ${currentScreen.color}20, ${currentScreen.color}05)`,
            border: `1px solid ${currentScreen.color}40`,
            borderRadius: 20,
          }}
        >
          <div
            style={{
              fontFamily: "SF Pro Display",
              fontSize: 32,
              fontWeight: 700,
              color: currentScreen.color,
            }}
          >
            {currentScreen.name}
          </div>
          <div
            style={{
              fontFamily: "SF Pro Display",
              fontSize: 16,
              color: COLORS.textMuted,
              marginTop: 6,
            }}
          >
            {currentScreen.description}
          </div>
        </div>
      </div>

      {/* Progress dots */}
      <div
        style={{
          position: "absolute",
          bottom: 50,
          left: "50%",
          transform: "translateX(-50%)",
          display: "flex",
          gap: 12,
        }}
      >
        {screens.map((screen, i) => (
          <div
            key={i}
            style={{
              width: i === currentScreenIndex ? 30 : 10,
              height: 10,
              borderRadius: 5,
              backgroundColor: i === currentScreenIndex ? screen.color : COLORS.textMuted + "40",
              transition: "all 0.3s",
            }}
          />
        ))}
      </div>

      {/* Aptos branding */}
      <div
        style={{
          position: "absolute",
          top: 50,
          right: 80,
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}
      >
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            background: `linear-gradient(135deg, ${COLORS.aptosGreen}, ${COLORS.aptosCyan})`,
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
        <span
          style={{
            fontFamily: "SF Pro Display",
            fontSize: 18,
            fontWeight: 600,
            color: COLORS.text,
          }}
        >
          APTOS
        </span>
      </div>
    </AbsoluteFill>
  );
};
