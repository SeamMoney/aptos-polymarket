import React from "react";
import { useCurrentFrame, useVideoConfig, interpolate, spring, Easing } from "remotion";
import { colors, fonts, springs } from "../styles/theme";
import { TransactionRain } from "./TransactionRain";
import { TPSParticles } from "./TPSParticles";

interface SplitScreenShowdownProps {
  startFrame?: number;
  duration?: number;
}

export const SplitScreenShowdown: React.FC<SplitScreenShowdownProps> = ({
  startFrame = 0,
  duration = 180,
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  const localFrame = frame - startFrame;
  if (localFrame < 0) return null;

  // Animation phases
  const splitProgress = spring({
    frame: localFrame,
    fps,
    config: springs.smooth,
  });

  const polygonGlitchIntensity = interpolate(
    localFrame,
    [0, 30, 60, 90, 120],
    [0, 0.3, 0.6, 0.8, 1],
    { extrapolateRight: "clamp" }
  );

  const aptosGlowIntensity = interpolate(
    localFrame,
    [30, 60, 90],
    [0, 0.5, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  // Counter values
  const polygonTPS = Math.floor(interpolate(localFrame, [0, duration], [0, 7], { extrapolateRight: "clamp" }));
  const aptosTPS = Math.floor(interpolate(localFrame, [30, duration], [0, 30847], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }));

  // Polygon side glitch effect
  const glitchX = Math.sin(localFrame * 0.5) * polygonGlitchIntensity * 10;
  const glitchY = Math.cos(localFrame * 0.7) * polygonGlitchIntensity * 5;

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        overflow: "hidden",
      }}
    >
      {/* POLYGON SIDE - LEFT */}
      <div
        style={{
          flex: 1,
          position: "relative",
          backgroundColor: "#0a0a0a",
          borderRight: `2px solid ${colors.errorRed}40`,
          overflow: "hidden",
          transform: `translate(${glitchX}px, ${glitchY}px)`,
        }}
      >
        {/* Failing transaction rain */}
        <TransactionRain density={30} speed={0.3} mode="failing" />

        {/* Red overlay pulse */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: `radial-gradient(circle at center, ${colors.errorRed}20 0%, transparent 70%)`,
            opacity: 0.3 + Math.sin(localFrame * 0.1) * 0.2,
          }}
        />

        {/* Scanlines */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: `repeating-linear-gradient(
              0deg,
              transparent,
              transparent 2px,
              rgba(0,0,0,0.3) 2px,
              rgba(0,0,0,0.3) 4px
            )`,
            pointerEvents: "none",
          }}
        />

        {/* POLYGON Label */}
        <div
          style={{
            position: "absolute",
            top: 60,
            left: "50%",
            transform: "translateX(-50%)",
            fontFamily: fonts.display,
            fontSize: 48,
            fontWeight: 800,
            color: colors.errorRed,
            textShadow: `0 0 20px ${colors.errorRed}`,
            letterSpacing: "0.1em",
          }}
        >
          POLYGON
        </div>

        {/* TPS Counter */}
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            textAlign: "center",
          }}
        >
          <div
            style={{
              fontFamily: fonts.mono,
              fontSize: 120,
              fontWeight: 900,
              color: colors.errorRed,
              textShadow: `0 0 40px ${colors.errorRed}`,
            }}
          >
            {polygonTPS}
          </div>
          <div
            style={{
              fontFamily: fonts.mono,
              fontSize: 24,
              color: colors.deadGray,
              marginTop: 10,
            }}
          >
            TPS
          </div>
        </div>

        {/* Slow particles */}
        <TPSParticles
          count={7}
          startFrame={startFrame}
          duration={duration}
          color={colors.errorRed}
          slow={true}
        />

        {/* Error messages floating */}
        {localFrame > 30 && (
          <>
            <ErrorMessage text="RPC TIMEOUT" x={20} y={200} delay={0} frame={localFrame} />
            <ErrorMessage text="MEMPOOL FULL" x={60} y={350} delay={20} frame={localFrame} />
            <ErrorMessage text="TX DROPPED" x={30} y={500} delay={40} frame={localFrame} />
            <ErrorMessage text="RETRY: 3/3" x={50} y={650} delay={60} frame={localFrame} />
            <ErrorMessage text="FAILED" x={40} y={800} delay={80} frame={localFrame} />
          </>
        )}

        {/* Status indicator */}
        <div
          style={{
            position: "absolute",
            bottom: 60,
            left: "50%",
            transform: "translateX(-50%)",
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}
        >
          <div
            style={{
              width: 16,
              height: 16,
              borderRadius: "50%",
              backgroundColor: colors.errorRed,
              boxShadow: `0 0 20px ${colors.errorRed}`,
              animation: "pulse 1s infinite",
            }}
          />
          <span
            style={{
              fontFamily: fonts.mono,
              fontSize: 18,
              color: colors.errorRed,
            }}
          >
            DEGRADED
          </span>
        </div>
      </div>

      {/* APTOS SIDE - RIGHT */}
      <div
        style={{
          flex: 1,
          position: "relative",
          backgroundColor: colors.bgDeep,
          overflow: "hidden",
        }}
      >
        {/* Fast transaction rain */}
        <TransactionRain density={80} speed={2} mode="fast" />

        {/* Green glow */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: `radial-gradient(circle at center, ${colors.aptosGreen}15 0%, transparent 60%)`,
            opacity: aptosGlowIntensity,
          }}
        />

        {/* APTOS Label */}
        <div
          style={{
            position: "absolute",
            top: 60,
            left: "50%",
            transform: "translateX(-50%)",
            fontFamily: fonts.display,
            fontSize: 48,
            fontWeight: 800,
            background: `linear-gradient(135deg, ${colors.aptosGreen}, ${colors.aptosCyan})`,
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            textShadow: `0 0 40px ${colors.aptosGreen}40`,
            letterSpacing: "0.1em",
          }}
        >
          APTOS
        </div>

        {/* TPS Counter */}
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            textAlign: "center",
          }}
        >
          <div
            style={{
              fontFamily: fonts.mono,
              fontSize: 120,
              fontWeight: 900,
              background: `linear-gradient(135deg, ${colors.aptosGreen}, ${colors.aptosCyan})`,
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              filter: `drop-shadow(0 0 40px ${colors.aptosGreen})`,
            }}
          >
            {aptosTPS.toLocaleString()}
          </div>
          <div
            style={{
              fontFamily: fonts.mono,
              fontSize: 24,
              color: colors.aptosGreen,
              marginTop: 10,
            }}
          >
            TPS
          </div>
        </div>

        {/* Explosive particles */}
        <TPSParticles
          count={200}
          startFrame={startFrame + 30}
          duration={duration - 30}
          color={colors.aptosGreen}
          slow={false}
        />

        {/* Success stats floating */}
        {localFrame > 60 && (
          <>
            <SuccessStat text="125ms" label="FINALITY" x={70} y={200} delay={0} frame={localFrame} />
            <SuccessStat text="<$0.001" label="FEE" x={30} y={400} delay={20} frame={localFrame} />
            <SuccessStat text="99.99%" label="UPTIME" x={60} y={600} delay={40} frame={localFrame} />
            <SuccessStat text="4,285x" label="FASTER" x={40} y={800} delay={60} frame={localFrame} />
          </>
        )}

        {/* Status indicator */}
        <div
          style={{
            position: "absolute",
            bottom: 60,
            left: "50%",
            transform: "translateX(-50%)",
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}
        >
          <div
            style={{
              width: 16,
              height: 16,
              borderRadius: "50%",
              backgroundColor: colors.aptosGreen,
              boxShadow: `0 0 20px ${colors.aptosGreen}`,
            }}
          />
          <span
            style={{
              fontFamily: fonts.mono,
              fontSize: 18,
              color: colors.aptosGreen,
            }}
          >
            OPERATIONAL
          </span>
        </div>
      </div>

      {/* Center divider with VS */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          transform: "translate(-50%, -50%)",
          zIndex: 10,
        }}
      >
        <div
          style={{
            width: 80,
            height: 80,
            borderRadius: "50%",
            background: `linear-gradient(135deg, ${colors.errorRed}, ${colors.aptosGreen})`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: `0 0 40px ${colors.aptosGreen}60, 0 0 40px ${colors.errorRed}60`,
          }}
        >
          <span
            style={{
              fontFamily: fonts.display,
              fontSize: 28,
              fontWeight: 900,
              color: "white",
            }}
          >
            VS
          </span>
        </div>
      </div>
    </div>
  );
};

// Error message component for Polygon side
const ErrorMessage: React.FC<{
  text: string;
  x: number;
  y: number;
  delay: number;
  frame: number;
}> = ({ text, x, y, delay, frame }) => {
  const localFrame = frame - delay;
  if (localFrame < 0) return null;

  const opacity = interpolate(localFrame, [0, 10, 50, 60], [0, 1, 1, 0], {
    extrapolateRight: "clamp",
  });

  const glitchOffset = Math.random() > 0.9 ? (Math.random() - 0.5) * 10 : 0;

  return (
    <div
      style={{
        position: "absolute",
        left: `${x}%`,
        top: y,
        transform: `translateX(${glitchOffset}px)`,
        fontFamily: fonts.mono,
        fontSize: 14,
        color: colors.errorRed,
        opacity,
        padding: "4px 8px",
        background: `${colors.errorRed}20`,
        border: `1px solid ${colors.errorRed}40`,
        borderRadius: 4,
      }}
    >
      {text}
    </div>
  );
};

// Success stat component for Aptos side
const SuccessStat: React.FC<{
  text: string;
  label: string;
  x: number;
  y: number;
  delay: number;
  frame: number;
}> = ({ text, label, x, y, delay, frame }) => {
  const localFrame = frame - delay;
  if (localFrame < 0) return null;

  const opacity = interpolate(localFrame, [0, 15], [0, 1], {
    extrapolateRight: "clamp",
  });

  const scale = interpolate(localFrame, [0, 15], [0.8, 1], {
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        position: "absolute",
        left: `${x}%`,
        top: y,
        transform: `scale(${scale})`,
        opacity,
        textAlign: "center",
      }}
    >
      <div
        style={{
          fontFamily: fonts.mono,
          fontSize: 24,
          fontWeight: 700,
          color: colors.aptosGreen,
          textShadow: `0 0 10px ${colors.aptosGreen}`,
        }}
      >
        {text}
      </div>
      <div
        style={{
          fontFamily: fonts.mono,
          fontSize: 10,
          color: colors.textMuted,
          letterSpacing: "0.1em",
        }}
      >
        {label}
      </div>
    </div>
  );
};
