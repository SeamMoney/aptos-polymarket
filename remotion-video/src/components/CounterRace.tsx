import React from "react";
import { useCurrentFrame, useVideoConfig, interpolate, spring, Easing } from "remotion";
import { colors, fonts, springs } from "../styles/theme";

interface CounterRaceProps {
  startFrame?: number;
  duration?: number;
}

export const CounterRace: React.FC<CounterRaceProps> = ({
  startFrame = 0,
  duration = 150,
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  const localFrame = frame - startFrame;
  if (localFrame < 0) return null;

  // Race progress
  const raceProgress = interpolate(
    localFrame,
    [0, duration * 0.8],
    [0, 1],
    { extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) }
  );

  // Counter values
  const polygonCount = Math.floor(7 * raceProgress);
  const aptosCount = Math.floor(30847 * raceProgress);

  // Bar widths (percentage)
  const maxBarWidth = 70; // percentage of container
  const polygonBarWidth = (polygonCount / 30847) * maxBarWidth;
  const aptosBarWidth = (aptosCount / 30847) * maxBarWidth;

  // Winner flash effect
  const showWinner = localFrame > duration * 0.85;
  const winnerPulse = showWinner ? 0.5 + Math.sin(localFrame * 0.3) * 0.5 : 0;

  // Entrance animation
  const entranceProgress = spring({
    frame: localFrame,
    fps,
    config: springs.smooth,
  });

  // Racing particles for Aptos
  const particleCount = Math.floor(aptosCount / 500);

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: 80,
        background: `radial-gradient(ellipse at center, ${colors.bgDeep} 0%, #000 100%)`,
      }}
    >
      {/* Title */}
      <div
        style={{
          fontFamily: fonts.display,
          fontSize: 64,
          fontWeight: 800,
          color: "white",
          marginBottom: 60,
          opacity: entranceProgress,
          transform: `translateY(${(1 - entranceProgress) * 30}px)`,
        }}
      >
        THE <span style={{ color: colors.aptosGreen }}>RACE</span>
      </div>

      {/* Race container */}
      <div
        style={{
          width: "100%",
          maxWidth: 1400,
          display: "flex",
          flexDirection: "column",
          gap: 60,
        }}
      >
        {/* POLYGON Lane */}
        <RaceLane
          name="POLYGON"
          count={polygonCount}
          maxCount={30847}
          barWidth={polygonBarWidth}
          color={colors.errorRed}
          icon="🐢"
          isLoser={showWinner}
          entranceProgress={entranceProgress}
          localFrame={localFrame}
        />

        {/* APTOS Lane */}
        <RaceLane
          name="APTOS"
          count={aptosCount}
          maxCount={30847}
          barWidth={aptosBarWidth}
          color={colors.aptosGreen}
          icon="🚀"
          isWinner={showWinner}
          entranceProgress={entranceProgress}
          localFrame={localFrame}
          particles={particleCount}
        />
      </div>

      {/* Winner announcement */}
      {showWinner && (
        <div
          style={{
            position: "absolute",
            bottom: 100,
            fontFamily: fonts.display,
            fontSize: 42,
            fontWeight: 800,
            color: colors.aptosGreen,
            textShadow: `0 0 ${40 + winnerPulse * 20}px ${colors.aptosGreen}`,
            opacity: interpolate(localFrame, [duration * 0.85, duration * 0.95], [0, 1]),
          }}
        >
          APTOS WINS BY <span style={{ fontSize: 56 }}>4,407x</span>
        </div>
      )}

      {/* Time indicator */}
      <div
        style={{
          position: "absolute",
          top: 40,
          right: 60,
          fontFamily: fonts.mono,
          fontSize: 24,
          color: colors.textMuted,
        }}
      >
        TIME: <span style={{ color: "white" }}>{(raceProgress * 10).toFixed(1)}s</span>
      </div>

      {/* Background grid */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          opacity: 0.05,
          background: `
            linear-gradient(${colors.aptosGreen}40 1px, transparent 1px),
            linear-gradient(90deg, ${colors.aptosGreen}40 1px, transparent 1px)
          `,
          backgroundSize: "50px 50px",
          pointerEvents: "none",
        }}
      />
    </div>
  );
};

interface RaceLaneProps {
  name: string;
  count: number;
  maxCount: number;
  barWidth: number;
  color: string;
  icon: string;
  isWinner?: boolean;
  isLoser?: boolean;
  entranceProgress: number;
  localFrame: number;
  particles?: number;
}

const RaceLane: React.FC<RaceLaneProps> = ({
  name,
  count,
  maxCount,
  barWidth,
  color,
  icon,
  isWinner = false,
  isLoser = false,
  entranceProgress,
  localFrame,
  particles = 0,
}) => {
  const glowIntensity = isWinner ? 1 + Math.sin(localFrame * 0.3) * 0.3 : 1;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 30,
        opacity: entranceProgress,
        transform: `translateX(${(1 - entranceProgress) * -50}px)`,
      }}
    >
      {/* Name */}
      <div
        style={{
          width: 160,
          fontFamily: fonts.display,
          fontSize: 32,
          fontWeight: 700,
          color: isLoser ? colors.deadGray : color,
          textShadow: isWinner ? `0 0 20px ${color}` : "none",
        }}
      >
        {name}
      </div>

      {/* Bar container */}
      <div
        style={{
          flex: 1,
          height: 60,
          background: `${color}10`,
          borderRadius: 30,
          overflow: "hidden",
          position: "relative",
          border: `2px solid ${color}30`,
        }}
      >
        {/* Progress bar */}
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            bottom: 0,
            width: `${Math.max(barWidth, 0.5)}%`,
            background: `linear-gradient(90deg, ${color}80, ${color})`,
            borderRadius: 30,
            boxShadow: isWinner
              ? `0 0 ${30 * glowIntensity}px ${color}, inset 0 0 20px rgba(255,255,255,0.3)`
              : `0 0 10px ${color}50`,
            transition: "width 0.05s linear",
          }}
        />

        {/* Racing particles */}
        {particles > 0 &&
          Array.from({ length: Math.min(particles, 30) }).map((_, i) => {
            const particleX = barWidth + (Math.random() - 0.5) * 5;
            const particleY = 50 + (Math.random() - 0.5) * 40;
            const size = 2 + Math.random() * 4;
            const opacity = 0.3 + Math.random() * 0.5;

            return (
              <div
                key={i}
                style={{
                  position: "absolute",
                  left: `${particleX}%`,
                  top: `${particleY}%`,
                  width: size,
                  height: size,
                  borderRadius: "50%",
                  backgroundColor: color,
                  opacity,
                  boxShadow: `0 0 ${size * 2}px ${color}`,
                  transform: "translate(-50%, -50%)",
                }}
              />
            );
          })}

        {/* Icon at front */}
        <div
          style={{
            position: "absolute",
            left: `${Math.max(barWidth, 2)}%`,
            top: "50%",
            transform: "translate(-50%, -50%)",
            fontSize: 36,
            filter: isLoser ? "grayscale(1)" : "none",
          }}
        >
          {icon}
        </div>
      </div>

      {/* Counter */}
      <div
        style={{
          width: 180,
          textAlign: "right",
        }}
      >
        <div
          style={{
            fontFamily: fonts.mono,
            fontSize: 48,
            fontWeight: 900,
            color: isLoser ? colors.deadGray : color,
            textShadow: isWinner ? `0 0 20px ${color}` : "none",
          }}
        >
          {count.toLocaleString()}
        </div>
        <div
          style={{
            fontFamily: fonts.mono,
            fontSize: 14,
            color: colors.textMuted,
          }}
        >
          TPS
        </div>
      </div>
    </div>
  );
};
