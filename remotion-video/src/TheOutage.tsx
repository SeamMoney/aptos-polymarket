import React from "react";
import {
  AbsoluteFill,
  Img,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
  staticFile,
  Sequence,
  Easing,
  random,
} from "remotion";
import { colors, fonts, fontWeights, shadows, springs } from "./styles/theme";
import { GlitchText } from "./components/GlitchText";
import { NumberCounter } from "./components/NumberCounter";
import { TransactionRain } from "./components/TransactionRain";
import { TPSParticles } from "./components/TPSParticles";
import { SplitScreenShowdown } from "./components/SplitScreenShowdown";
import { Phone3DParallax } from "./components/Phone3DParallax";
import { CounterRace } from "./components/CounterRace";
import { PortalReveal } from "./components/PortalReveal";
import { BloombergLayout } from "./components/BloombergLayout";

// Scene 1: Polymarket Glitching - ENHANCED with TransactionRain
const PolymarketDown: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const glitchIntensity = interpolate(frame, [0, fps * 2, fps * 3], [0.2, 0.6, 1], {
    extrapolateRight: "clamp",
  });

  const opacity = interpolate(frame, [0, 20], [0, 1]);

  // Error messages that appear
  const errors = [
    { text: "503 SERVICE UNAVAILABLE", x: 15, y: 15, delay: 30 },
    { text: "RPC TIMEOUT", x: 75, y: 25, delay: 45 },
    { text: "MEMPOOL FULL", x: 25, y: 75, delay: 60 },
    { text: "CONNECTION REFUSED", x: 70, y: 80, delay: 75 },
    { text: "TX DROPPED", x: 45, y: 50, delay: 90 },
  ];

  return (
    <AbsoluteFill
      style={{
        background: colors.bgDeep,
        justifyContent: "center",
        alignItems: "center",
        opacity,
      }}
    >
      {/* Transaction rain - failing mode */}
      <TransactionRain density={60} speed={0.5} mode="failing" />

      {/* Error messages flying around */}
      {errors.map((error, i) => {
        const errorOpacity = interpolate(
          frame - error.delay,
          [0, 10, 40, 50],
          [0, 1, 1, 0],
          { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
        );
        const glitchOffset = Math.random() > 0.8 ? (Math.random() - 0.5) * 30 : 0;

        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: `${error.x}%`,
              top: `${error.y}%`,
              transform: `translate(-50%, -50%) translateX(${glitchOffset}px)`,
              fontFamily: fonts.mono,
              fontSize: 16,
              color: colors.errorRed,
              opacity: errorOpacity,
              padding: "8px 16px",
              background: `${colors.errorRed}20`,
              border: `1px solid ${colors.errorRed}60`,
              borderRadius: 4,
              boxShadow: `0 0 20px ${colors.errorRed}40`,
            }}
          >
            {error.text}
          </div>
        );
      })}

      {/* Red warning glow */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `radial-gradient(circle at 50% 50%, ${colors.errorRed}30, transparent 70%)`,
          opacity: glitchIntensity,
        }}
      />

      {/* Date badge */}
      <div
        style={{
          position: "absolute",
          top: 40,
          left: 60,
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "8px 20px",
          background: `${colors.errorRed}20`,
          border: `1px solid ${colors.errorRed}40`,
          borderRadius: 8,
        }}
      >
        <div
          style={{
            width: 10,
            height: 10,
            borderRadius: "50%",
            backgroundColor: colors.errorRed,
            boxShadow: `0 0 15px ${colors.errorRed}`,
          }}
        />
        <span
          style={{
            fontFamily: fonts.mono,
            fontSize: 14,
            color: colors.errorRed,
            fontWeight: 600,
          }}
        >
          DECEMBER 2024
        </span>
      </div>

      {/* Main content */}
      <div style={{ textAlign: "center", zIndex: 10 }}>
        <GlitchText
          fontSize={100}
          intensity={glitchIntensity}
          color={colors.textPrimary}
          style={{ marginBottom: 30 }}
        >
          POLYMARKET
        </GlitchText>

        <div
          style={{
            marginTop: 40,
            padding: "24px 48px",
            background: `${colors.errorRed}20`,
            border: `3px solid ${colors.errorRed}`,
            borderRadius: 16,
            display: "inline-block",
            boxShadow: `0 0 40px ${colors.errorRed}40`,
          }}
        >
          <div
            style={{
              fontFamily: fonts.mono,
              fontSize: 36,
              color: colors.errorRed,
              fontWeight: fontWeights.bold,
              letterSpacing: "0.05em",
            }}
          >
            SERVICE UNAVAILABLE
          </div>
        </div>

        {/* Stats below */}
        <div
          style={{
            marginTop: 40,
            display: "flex",
            gap: 60,
            justifyContent: "center",
          }}
        >
          {[
            { value: "12+ HRS", label: "DOWNTIME" },
            { value: "500K+", label: "AFFECTED" },
            { value: "$50M+", label: "BLOCKED" },
          ].map((stat, i) => {
            const statOpacity = interpolate(
              frame - 60 - i * 15,
              [0, 15],
              [0, 1],
              { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
            );
            return (
              <div key={i} style={{ textAlign: "center", opacity: statOpacity }}>
                <div
                  style={{
                    fontFamily: fonts.display,
                    fontSize: 32,
                    fontWeight: 800,
                    color: colors.errorRed,
                  }}
                >
                  {stat.value}
                </div>
                <div
                  style={{
                    fontFamily: fonts.mono,
                    fontSize: 11,
                    color: colors.textMuted,
                    letterSpacing: "0.1em",
                  }}
                >
                  {stat.label}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Scanlines */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `repeating-linear-gradient(
            0deg,
            transparent,
            transparent 2px,
            rgba(0, 0, 0, 0.1) 2px,
            rgba(0, 0, 0, 0.1) 4px
          )`,
          pointerEvents: "none",
        }}
      />
    </AbsoluteFill>
  );
};

// Scene 2: The Pivot Question - ENHANCED with particle field
const ThePivot: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const textOpacity = interpolate(frame, [0, 30, fps * 3 - 30, fps * 3], [0, 1, 1, 0]);
  const textScale = spring({
    frame,
    fps,
    config: springs.smooth,
  });

  // Typing effect
  const question = "What if prediction markets";
  const answer = "never went down?";
  const charsVisible = Math.floor(interpolate(frame, [10, 60], [0, question.length + answer.length], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  }));

  const questionChars = Math.min(charsVisible, question.length);
  const answerChars = Math.max(0, charsVisible - question.length);

  return (
    <AbsoluteFill
      style={{
        background: colors.bgDeep,
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      {/* Subtle particle field */}
      {Array.from({ length: 50 }).map((_, i) => {
        const x = random(`px-${i}`) * 100;
        const y = random(`py-${i}`) * 100;
        const size = 1 + random(`ps-${i}`) * 3;
        const pulseOffset = random(`po-${i}`) * Math.PI * 2;
        const opacity = 0.1 + Math.sin(frame * 0.05 + pulseOffset) * 0.1;

        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: `${x}%`,
              top: `${y}%`,
              width: size,
              height: size,
              borderRadius: "50%",
              backgroundColor: colors.aptosGreen,
              opacity,
            }}
          />
        );
      })}

      {/* Cursor blink */}
      <div
        style={{
          textAlign: "center",
          opacity: textOpacity,
          transform: `scale(${0.9 + textScale * 0.1})`,
        }}
      >
        {/* Terminal prompt */}
        <div
          style={{
            fontFamily: fonts.mono,
            fontSize: 18,
            color: colors.aptosGreen,
            marginBottom: 20,
          }}
        >
          <span style={{ opacity: 0.6 }}>$</span> query --future
        </div>

        <div
          style={{
            fontFamily: fonts.display,
            fontSize: 56,
            fontWeight: fontWeights.medium,
            color: colors.textSecondary,
            lineHeight: 1.4,
          }}
        >
          {question.slice(0, questionChars)}
          <span style={{ opacity: questionChars < question.length ? 0.5 : 0 }}>|</span>
          <br />
          <span
            style={{
              fontWeight: fontWeights.bold,
              color: colors.textPrimary,
            }}
          >
            {answer.slice(0, answerChars)}
            <span
              style={{
                opacity: frame % 30 < 15 && answerChars >= answer.length ? 1 : 0,
                color: colors.aptosGreen,
              }}
            >
              |
            </span>
          </span>
        </div>
      </div>

      {/* Ripple effect */}
      {frame > 80 && (
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            width: interpolate(frame - 80, [0, 30], [0, 800]),
            height: interpolate(frame - 80, [0, 30], [0, 800]),
            marginLeft: -interpolate(frame - 80, [0, 30], [0, 400]),
            marginTop: -interpolate(frame - 80, [0, 30], [0, 400]),
            border: `2px solid ${colors.aptosGreen}`,
            borderRadius: "50%",
            opacity: interpolate(frame - 80, [0, 30], [0.5, 0]),
          }}
        />
      )}
    </AbsoluteFill>
  );
};

// Scene 3: Portal Reveal - REUSING our component
const AptosPortalReveal: React.FC = () => {
  return <PortalReveal startFrame={0} duration={120} />;
};

// Scene 4: Split Screen Showdown
const ShowdownScene: React.FC = () => {
  return <SplitScreenShowdown startFrame={0} duration={180} />;
};

// Scene 5: Counter Race
const RaceScene: React.FC = () => {
  return <CounterRace startFrame={0} duration={150} />;
};

// Scene 6: 3D Phone Parallax
const Phone3DScene: React.FC = () => {
  return (
    <AbsoluteFill style={{ background: colors.bgDeep }}>
      {/* Background gradient */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `radial-gradient(ellipse at center, ${colors.aptosGreen}10 0%, transparent 50%)`,
        }}
      />
      <Phone3DParallax
        screenshotPath="screenshots/market-detail-viewport.png"
        startFrame={0}
        rotationRange={12}
      />
    </AbsoluteFill>
  );
};

// Scene 7: Bloomberg Layout - THE FINALE
const BloombergFinale: React.FC = () => {
  return <BloombergLayout screenshotPath="screenshots/market-detail-viewport.png" startFrame={0} />;
};

// Main composition - EPIC 35-SECOND VIDEO
export const TheOutage: React.FC = () => {
  const { fps } = useVideoConfig();

  return (
    <AbsoluteFill style={{ background: colors.bgDeep }}>
      {/* Scene 1: Polymarket Down (0-4s) - Sets up the problem */}
      <Sequence from={0} durationInFrames={fps * 4}>
        <PolymarketDown />
      </Sequence>

      {/* Scene 2: The Pivot Question (4-7s) - Transition */}
      <Sequence from={fps * 4} durationInFrames={fps * 3}>
        <ThePivot />
      </Sequence>

      {/* Scene 3: Portal Reveal (7-11s) - APTOS ENTERS */}
      <Sequence from={fps * 7} durationInFrames={fps * 4}>
        <AptosPortalReveal />
      </Sequence>

      {/* Scene 4: Split Screen Showdown (11-17s) - THE COMPARISON */}
      <Sequence from={fps * 11} durationInFrames={fps * 6}>
        <ShowdownScene />
      </Sequence>

      {/* Scene 5: Counter Race (17-22s) - VISUAL PROOF */}
      <Sequence from={fps * 17} durationInFrames={fps * 5}>
        <RaceScene />
      </Sequence>

      {/* Scene 6: 3D Phone (22-26s) - THE PRODUCT */}
      <Sequence from={fps * 22} durationInFrames={fps * 4}>
        <Phone3DScene />
      </Sequence>

      {/* Scene 7: Bloomberg Layout (26-35s) - THE FINALE */}
      <Sequence from={fps * 26} durationInFrames={fps * 9}>
        <BloombergFinale />
      </Sequence>
    </AbsoluteFill>
  );
};
