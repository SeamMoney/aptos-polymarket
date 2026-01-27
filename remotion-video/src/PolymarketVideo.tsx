import React from "react";
import {
  AbsoluteFill,
  Sequence,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
  Easing,
} from "remotion";
import { Terminal } from "./components/Terminal";
import { InfiniteZoom } from "./components/InfiniteZoom";
import { UserBetting } from "./components/UserBetting";

export const PolymarketVideo: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Timeline:
  // 0-5s: Title intro
  // 5-25s: Terminal writing multi_outcome_market.move
  // 25-35s: Terminal writing usd1.move
  // 35-40s: Compile animation
  // 40-50s: Infinite zoom into code
  // 50-60s: User betting on Polymarket

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#0d0d0d",
        fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
      }}
    >
      {/* Title Intro */}
      <Sequence from={0} durationInFrames={fps * 5}>
        <TitleIntro />
      </Sequence>

      {/* Terminal Writing Code */}
      <Sequence from={fps * 5} durationInFrames={fps * 30}>
        <Terminal />
      </Sequence>

      {/* Compile Animation */}
      <Sequence from={fps * 35} durationInFrames={fps * 5}>
        <CompileAnimation />
      </Sequence>

      {/* Infinite Zoom */}
      <Sequence from={fps * 40} durationInFrames={fps * 10}>
        <InfiniteZoom />
      </Sequence>

      {/* User Betting Scene */}
      <Sequence from={fps * 50} durationInFrames={fps * 10}>
        <UserBetting />
      </Sequence>
    </AbsoluteFill>
  );
};

const TitleIntro: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const titleOpacity = interpolate(frame, [0, fps * 0.5], [0, 1], {
    extrapolateRight: "clamp",
  });

  const subtitleOpacity = interpolate(frame, [fps * 1, fps * 1.5], [0, 1], {
    extrapolateRight: "clamp",
  });

  const scale = spring({
    frame,
    fps,
    config: {
      damping: 100,
      stiffness: 200,
      mass: 0.5,
    },
  });

  const polymarketColors = {
    purple: "#8B5CF6",
    blue: "#3B82F6",
    green: "#10B981",
    dark: "#0d0d0d",
  };

  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
        background: `radial-gradient(circle at 50% 50%, ${polymarketColors.purple}22, ${polymarketColors.dark})`,
      }}
    >
      <div
        style={{
          transform: `scale(${scale})`,
          textAlign: "center",
        }}
      >
        <div
          style={{
            opacity: titleOpacity,
            fontSize: 80,
            fontWeight: 800,
            background: `linear-gradient(135deg, ${polymarketColors.purple}, ${polymarketColors.blue})`,
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            marginBottom: 20,
          }}
        >
          POLYMARKET
        </div>
        <div
          style={{
            opacity: titleOpacity,
            fontSize: 40,
            color: "#666",
            marginBottom: 40,
          }}
        >
          on Aptos
        </div>
        <div
          style={{
            opacity: subtitleOpacity,
            fontSize: 28,
            color: polymarketColors.green,
            fontFamily: "'JetBrains Mono', monospace",
          }}
        >
          30,000+ TPS Prediction Markets
        </div>
      </div>
    </AbsoluteFill>
  );
};

const CompileAnimation: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const progress = interpolate(frame, [0, fps * 3], [0, 100], {
    extrapolateRight: "clamp",
  });

  const checkOpacity = interpolate(frame, [fps * 3, fps * 4], [0, 1], {
    extrapolateRight: "clamp",
  });

  const polymarketColors = {
    purple: "#8B5CF6",
    green: "#10B981",
  };

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#0d0d0d",
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <div
        style={{
          width: 800,
          padding: 40,
          backgroundColor: "#1a1a1a",
          borderRadius: 16,
          border: `2px solid ${polymarketColors.purple}44`,
        }}
      >
        <div
          style={{
            fontSize: 24,
            color: "#fff",
            marginBottom: 30,
            fontFamily: "'JetBrains Mono', monospace",
          }}
        >
          $ aptos move compile
        </div>

        <div
          style={{
            marginBottom: 20,
            color: "#888",
            fontSize: 16,
          }}
        >
          Compiling prediction_market::multi_outcome_market
        </div>

        <div
          style={{
            height: 8,
            backgroundColor: "#333",
            borderRadius: 4,
            overflow: "hidden",
            marginBottom: 10,
          }}
        >
          <div
            style={{
              width: `${progress}%`,
              height: "100%",
              background: `linear-gradient(90deg, ${polymarketColors.purple}, ${polymarketColors.green})`,
              borderRadius: 4,
              transition: "width 0.1s ease-out",
            }}
          />
        </div>

        <div
          style={{
            color: "#666",
            fontSize: 14,
            marginBottom: 20,
          }}
        >
          {Math.round(progress)}% complete
        </div>

        <div
          style={{
            opacity: checkOpacity,
            color: polymarketColors.green,
            fontSize: 20,
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <span style={{ fontSize: 28 }}>✓</span>
          BUILD SUCCESSFUL - 2 modules compiled
        </div>
      </div>
    </AbsoluteFill>
  );
};
