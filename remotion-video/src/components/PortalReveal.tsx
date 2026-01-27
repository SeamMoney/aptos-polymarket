import React from "react";
import { useCurrentFrame, useVideoConfig, interpolate, spring, Easing, random } from "remotion";
import { colors, fonts, springs } from "../styles/theme";

interface PortalRevealProps {
  startFrame?: number;
  duration?: number;
}

export const PortalReveal: React.FC<PortalRevealProps> = ({
  startFrame = 0,
  duration = 120,
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  const localFrame = frame - startFrame;
  if (localFrame < 0) return null;

  // Portal opening phases
  const phase1End = duration * 0.3; // Portal appears
  const phase2End = duration * 0.6; // Portal expands
  const phase3End = duration; // Full reveal

  // Portal scale animation
  const portalScale = interpolate(
    localFrame,
    [0, phase1End, phase2End, phase3End],
    [0, 0.3, 1, 3],
    { extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) }
  );

  // Portal glow intensity
  const glowIntensity = interpolate(
    localFrame,
    [0, phase1End, phase2End],
    [0, 1, 2],
    { extrapolateRight: "clamp" }
  );

  // Background fade
  const bgOpacity = interpolate(
    localFrame,
    [phase2End, phase3End],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  // Rotation
  const rotation = localFrame * 0.5;

  // Energy rings
  const ringCount = 5;
  const rings = Array.from({ length: ringCount }).map((_, i) => {
    const delay = i * 10;
    const ringScale = interpolate(
      localFrame - delay,
      [0, 40],
      [0.5, 1.5 + i * 0.3],
      { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
    );
    const ringOpacity = interpolate(
      localFrame - delay,
      [0, 20, 40],
      [0, 0.8, 0],
      { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
    );

    return { scale: ringScale, opacity: ringOpacity, rotation: rotation * (1 + i * 0.2) };
  });

  // Particle burst at phase transition
  const showBurst = localFrame > phase1End && localFrame < phase2End + 30;
  const burstProgress = interpolate(
    localFrame,
    [phase1End, phase2End],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  // Logo appearance
  const showLogo = localFrame > phase2End;
  const logoProgress = spring({
    frame: localFrame - phase2End,
    fps,
    config: springs.bouncy,
  });

  // Shockwave
  const shockwaveScale = interpolate(
    localFrame,
    [phase2End, phase2End + 30],
    [0, 5],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );
  const shockwaveOpacity = interpolate(
    localFrame,
    [phase2End, phase2End + 30],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        overflow: "hidden",
        background: colors.bgDeep,
      }}
    >
      {/* Dark background that fades */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `radial-gradient(circle at center, #1a0a0a 0%, #0a0505 50%, #050000 100%)`,
          opacity: bgOpacity,
        }}
      />

      {/* Energy rings */}
      {rings.map((ring, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            width: 400,
            height: 400,
            marginLeft: -200,
            marginTop: -200,
            border: `3px solid ${colors.aptosGreen}`,
            borderRadius: "50%",
            transform: `scale(${ring.scale * portalScale}) rotate(${ring.rotation}deg)`,
            opacity: ring.opacity,
            boxShadow: `
              0 0 30px ${colors.aptosGreen}60,
              inset 0 0 30px ${colors.aptosGreen}30
            `,
          }}
        />
      ))}

      {/* Main portal */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          width: 500,
          height: 500,
          marginLeft: -250,
          marginTop: -250,
          transform: `scale(${portalScale}) rotate(${rotation}deg)`,
          borderRadius: "50%",
          background: `
            radial-gradient(circle at center,
              ${colors.aptosGreen}40 0%,
              ${colors.aptosCyan}30 30%,
              ${colors.aptosGreen}20 50%,
              transparent 70%
            )
          `,
          boxShadow: `
            0 0 ${60 * glowIntensity}px ${colors.aptosGreen}80,
            0 0 ${120 * glowIntensity}px ${colors.aptosCyan}40,
            inset 0 0 ${100 * glowIntensity}px ${colors.aptosGreen}60
          `,
        }}
      >
        {/* Portal inner glow */}
        <div
          style={{
            position: "absolute",
            inset: "20%",
            borderRadius: "50%",
            background: `radial-gradient(circle, ${colors.aptosGreen}60 0%, transparent 70%)`,
            animation: "pulse 1s infinite",
          }}
        />

        {/* Portal swirl effect */}
        <svg
          style={{
            position: "absolute",
            inset: 0,
            transform: `rotate(${-rotation * 2}deg)`,
          }}
          viewBox="0 0 500 500"
        >
          <defs>
            <linearGradient id="swirlGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={colors.aptosGreen} stopOpacity="0.8" />
              <stop offset="50%" stopColor={colors.aptosCyan} stopOpacity="0.4" />
              <stop offset="100%" stopColor={colors.aptosGreen} stopOpacity="0" />
            </linearGradient>
          </defs>
          {[0, 60, 120, 180, 240, 300].map((angle, i) => (
            <path
              key={i}
              d={`M 250 250 Q ${250 + Math.cos((angle * Math.PI) / 180) * 150} ${250 + Math.sin((angle * Math.PI) / 180) * 150} ${250 + Math.cos(((angle + 60) * Math.PI) / 180) * 200} ${250 + Math.sin(((angle + 60) * Math.PI) / 180) * 200}`}
              stroke="url(#swirlGradient)"
              strokeWidth="4"
              fill="none"
              opacity={0.5 + Math.sin(localFrame * 0.1 + i) * 0.3}
            />
          ))}
        </svg>
      </div>

      {/* Particle burst */}
      {showBurst &&
        Array.from({ length: 60 }).map((_, i) => {
          const angle = random(`angle-${i}`) * Math.PI * 2;
          const distance = 100 + random(`dist-${i}`) * 400 * burstProgress;
          const size = 2 + random(`size-${i}`) * 6;
          const x = Math.cos(angle) * distance;
          const y = Math.sin(angle) * distance;
          const opacity = (1 - burstProgress) * (0.5 + random(`op-${i}`) * 0.5);

          return (
            <div
              key={i}
              style={{
                position: "absolute",
                left: "50%",
                top: "50%",
                width: size,
                height: size,
                borderRadius: "50%",
                backgroundColor: i % 2 === 0 ? colors.aptosGreen : colors.aptosCyan,
                transform: `translate(${x}px, ${y}px)`,
                opacity,
                boxShadow: `0 0 ${size * 3}px ${i % 2 === 0 ? colors.aptosGreen : colors.aptosCyan}`,
              }}
            />
          );
        })}

      {/* Shockwave */}
      {localFrame > phase2End && (
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            width: 200,
            height: 200,
            marginLeft: -100,
            marginTop: -100,
            borderRadius: "50%",
            border: `4px solid ${colors.aptosGreen}`,
            transform: `scale(${shockwaveScale})`,
            opacity: shockwaveOpacity,
          }}
        />
      )}

      {/* APTOS Logo reveal */}
      {showLogo && (
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            transform: `translate(-50%, -50%) scale(${logoProgress})`,
            textAlign: "center",
          }}
        >
          {/* Logo text */}
          <div
            style={{
              fontFamily: fonts.display,
              fontSize: 120,
              fontWeight: 900,
              background: `linear-gradient(135deg, ${colors.aptosGreen} 0%, ${colors.aptosCyan} 50%, ${colors.aptosGreen} 100%)`,
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              filter: `drop-shadow(0 0 40px ${colors.aptosGreen})`,
              letterSpacing: "0.1em",
            }}
          >
            APTOS
          </div>

          {/* Tagline */}
          <div
            style={{
              fontFamily: fonts.mono,
              fontSize: 24,
              color: colors.textMuted,
              marginTop: 20,
              opacity: interpolate(localFrame - phase2End, [20, 40], [0, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              }),
            }}
          >
            THE FUTURE OF PREDICTION MARKETS
          </div>
        </div>
      )}

      {/* Lightning bolts */}
      {localFrame > 20 && localFrame < phase2End && (
        <svg
          style={{
            position: "absolute",
            inset: 0,
            pointerEvents: "none",
          }}
          viewBox={`0 0 ${width} ${height}`}
        >
          {Array.from({ length: 8 }).map((_, i) => {
            const startAngle = (i / 8) * Math.PI * 2;
            const startX = width / 2 + Math.cos(startAngle) * 100 * portalScale;
            const startY = height / 2 + Math.sin(startAngle) * 100 * portalScale;
            const endX = width / 2 + Math.cos(startAngle) * (300 + random(`len-${i}`) * 200);
            const endY = height / 2 + Math.sin(startAngle) * (300 + random(`len-${i}`) * 200);

            // Random zigzag path
            const midX1 = startX + (endX - startX) * 0.3 + (random(`mx1-${i}`) - 0.5) * 50;
            const midY1 = startY + (endY - startY) * 0.3 + (random(`my1-${i}`) - 0.5) * 50;
            const midX2 = startX + (endX - startX) * 0.6 + (random(`mx2-${i}`) - 0.5) * 50;
            const midY2 = startY + (endY - startY) * 0.6 + (random(`my2-${i}`) - 0.5) * 50;

            const opacity = random(`frame-${i}-${Math.floor(localFrame / 3)}`) > 0.7 ? 0.8 : 0;

            return (
              <path
                key={i}
                d={`M ${startX} ${startY} L ${midX1} ${midY1} L ${midX2} ${midY2} L ${endX} ${endY}`}
                stroke={colors.aptosCyan}
                strokeWidth={2}
                fill="none"
                opacity={opacity}
                style={{
                  filter: `drop-shadow(0 0 10px ${colors.aptosCyan})`,
                }}
              />
            );
          })}
        </svg>
      )}
    </div>
  );
};
