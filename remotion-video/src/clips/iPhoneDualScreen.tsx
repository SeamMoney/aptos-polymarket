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
// iPHONE DUAL SCREEN - 18 second clip showing two phones side by side
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

interface PhoneProps {
  screenshot: string;
  label: string;
  side: "left" | "right";
  delay: number;
  glow: string;
}

const Phone: React.FC<PhoneProps> = ({ screenshot, label, side, delay, glow }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const entrance = spring({
    frame: Math.max(0, frame - delay),
    fps,
    config: { damping: 50, stiffness: 80 },
  });

  const startX = side === "left" ? -200 : 200;
  const x = interpolate(entrance, [0, 1], [startX, 0]);
  const floatY = Math.sin((frame - delay) * 0.03) * 6;
  const rotate = side === "left" ? 8 : -8;

  return (
    <div
      style={{
        transform: `
          translateX(${x}px)
          translateY(${floatY}px)
          perspective(1200px)
          rotateY(${rotate}deg)
        `,
        opacity: entrance,
      }}
    >
      {/* Label above phone */}
      <div
        style={{
          textAlign: "center",
          marginBottom: 20,
          opacity: interpolate(entrance, [0.5, 1], [0, 1]),
        }}
      >
        <div
          style={{
            fontFamily: "SF Pro Display",
            fontSize: 20,
            fontWeight: 700,
            color: glow,
          }}
        >
          {label}
        </div>
      </div>

      {/* Phone frame */}
      <div
        style={{
          width: 300,
          height: 650,
          borderRadius: 46,
          background: "linear-gradient(145deg, #2a2a2a, #1a1a1a)",
          padding: 10,
          boxShadow: `
            0 40px 80px rgba(0,0,0,0.5),
            0 0 0 1px rgba(255,255,255,0.1),
            0 0 60px ${glow}25
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
              width: 95,
              height: 28,
              backgroundColor: "#000",
              borderRadius: 15,
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

export const iPhoneDualScreen: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, width } = useVideoConfig();

  // Connection line animation
  const lineProgress = interpolate(
    frame,
    [fps * 1.5, fps * 3],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  // Stats that appear
  const showStats = frame > fps * 2;

  return (
    <AbsoluteFill style={{ background: COLORS.bg }}>
      {/* Background */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `
            radial-gradient(ellipse at 30% 40%, ${COLORS.aptosGreen}12 0%, transparent 50%),
            radial-gradient(ellipse at 70% 60%, ${COLORS.purple}12 0%, transparent 50%)
          `,
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
          opacity: interpolate(frame, [0, fps * 0.5], [0, 1]),
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
          SEAMLESS EXPERIENCE
        </div>
        <div
          style={{
            fontFamily: "SF Pro Display",
            fontSize: 48,
            fontWeight: 900,
            color: COLORS.text,
          }}
        >
          Browse → Trade
        </div>
      </div>

      {/* Phones container */}
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -45%)",
          display: "flex",
          alignItems: "flex-start",
          gap: 120,
        }}
      >
        <Phone
          screenshot="screenshots/polymarket-home-mobile.png"
          label="Discover Markets"
          side="left"
          delay={fps * 0.3}
          glow={COLORS.aptosGreen}
        />

        {/* Connection arrow */}
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: "45%",
            transform: "translate(-50%, -50%)",
            display: "flex",
            alignItems: "center",
            opacity: lineProgress,
          }}
        >
          <svg width="80" height="40" viewBox="0 0 80 40">
            <defs>
              <linearGradient id="arrowGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor={COLORS.aptosGreen} />
                <stop offset="100%" stopColor={COLORS.purple} />
              </linearGradient>
            </defs>
            <line
              x1="0"
              y1="20"
              x2={60 * lineProgress}
              y2="20"
              stroke="url(#arrowGradient)"
              strokeWidth="3"
              strokeLinecap="round"
            />
            {lineProgress > 0.8 && (
              <polygon
                points="60,20 50,14 50,26"
                fill={COLORS.purple}
              />
            )}
          </svg>
        </div>

        <Phone
          screenshot="screenshots/market-bids-buy.png"
          label="Place Trade"
          side="right"
          delay={fps * 0.8}
          glow={COLORS.purple}
        />
      </div>

      {/* Stats row */}
      {showStats && (
        <div
          style={{
            position: "absolute",
            bottom: 60,
            left: 0,
            right: 0,
            display: "flex",
            justifyContent: "center",
            gap: 60,
            opacity: interpolate(frame, [fps * 2, fps * 2.5], [0, 1]),
          }}
        >
          {[
            { label: "Browse Time", value: "< 1s", color: COLORS.aptosGreen },
            { label: "Trade Execution", value: "~470ms", color: COLORS.aptosCyan },
            { label: "Total Fee", value: "$0.001", color: COLORS.purple },
          ].map((stat) => (
            <div
              key={stat.label}
              style={{
                textAlign: "center",
                padding: "16px 30px",
                background: `${stat.color}10`,
                borderRadius: 16,
                border: `1px solid ${stat.color}30`,
              }}
            >
              <div
                style={{
                  fontFamily: "SF Pro Display",
                  fontSize: 28,
                  fontWeight: 700,
                  color: stat.color,
                }}
              >
                {stat.value}
              </div>
              <div
                style={{
                  fontFamily: "monospace",
                  fontSize: 12,
                  color: COLORS.textMuted,
                  marginTop: 4,
                }}
              >
                {stat.label}
              </div>
            </div>
          ))}
        </div>
      )}
    </AbsoluteFill>
  );
};
