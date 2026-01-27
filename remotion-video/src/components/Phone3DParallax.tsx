import React from "react";
import { useCurrentFrame, useVideoConfig, interpolate, spring, Img, staticFile } from "remotion";
import { colors, fonts, springs } from "../styles/theme";

interface Phone3DParallaxProps {
  screenshotPath: string;
  startFrame?: number;
  rotationRange?: number;
}

interface OrbitingStat {
  value: string;
  label: string;
  color: string;
  orbitRadius: number;
  orbitSpeed: number;
  startAngle: number;
}

const stats: OrbitingStat[] = [
  { value: "30,000+", label: "TPS", color: colors.aptosGreen, orbitRadius: 380, orbitSpeed: 0.015, startAngle: 0 },
  { value: "125ms", label: "FINALITY", color: colors.aptosCyan, orbitRadius: 350, orbitSpeed: -0.012, startAngle: Math.PI / 2 },
  { value: "<$0.001", label: "FEES", color: colors.aptosGreen, orbitRadius: 400, orbitSpeed: 0.018, startAngle: Math.PI },
  { value: "99.99%", label: "UPTIME", color: colors.aptosCyan, orbitRadius: 360, orbitSpeed: -0.014, startAngle: (3 * Math.PI) / 2 },
  { value: "BLOCK", label: "STM", color: colors.aptosGreen, orbitRadius: 420, orbitSpeed: 0.01, startAngle: Math.PI / 4 },
  { value: "MOVE", label: "LANG", color: colors.aptosCyan, orbitRadius: 390, orbitSpeed: -0.016, startAngle: (5 * Math.PI) / 4 },
];

export const Phone3DParallax: React.FC<Phone3DParallaxProps> = ({
  screenshotPath,
  startFrame = 0,
  rotationRange = 15,
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  const localFrame = frame - startFrame;
  if (localFrame < 0) return null;

  // Phone entrance animation
  const entranceProgress = spring({
    frame: localFrame,
    fps,
    config: { ...springs.smooth, damping: 25 },
  });

  const phoneScale = interpolate(entranceProgress, [0, 1], [0.5, 1]);
  const phoneOpacity = interpolate(entranceProgress, [0, 1], [0, 1]);

  // Subtle 3D rotation based on frame
  const rotateY = Math.sin(localFrame * 0.02) * rotationRange;
  const rotateX = Math.cos(localFrame * 0.015) * (rotationRange / 2);

  // Parallax layers offset
  const parallaxOffset = {
    foreground: { x: Math.sin(localFrame * 0.03) * 20, y: Math.cos(localFrame * 0.025) * 15 },
    midground: { x: Math.sin(localFrame * 0.02) * 10, y: Math.cos(localFrame * 0.018) * 8 },
    background: { x: Math.sin(localFrame * 0.01) * 5, y: Math.cos(localFrame * 0.012) * 4 },
  };

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        perspective: 1500,
      }}
    >
      {/* Background layer - subtle grid */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          transform: `translate(${parallaxOffset.background.x}px, ${parallaxOffset.background.y}px)`,
          opacity: 0.1,
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: -100,
            backgroundImage: `
              linear-gradient(${colors.aptosGreen}20 1px, transparent 1px),
              linear-gradient(90deg, ${colors.aptosGreen}20 1px, transparent 1px)
            `,
            backgroundSize: "60px 60px",
          }}
        />
      </div>

      {/* Orbiting stats - background orbit */}
      {stats.map((stat, i) => {
        const angle = stat.startAngle + localFrame * stat.orbitSpeed;
        const x = Math.cos(angle) * stat.orbitRadius;
        const y = Math.sin(angle) * stat.orbitRadius * 0.3; // Flatten for perspective
        const z = Math.sin(angle) * 100;
        const scale = interpolate(z, [-100, 100], [0.7, 1.1]);
        const opacity = interpolate(z, [-100, 100], [0.4, 1]);

        const statEntrance = spring({
          frame: localFrame - i * 5,
          fps,
          config: springs.bouncy,
        });

        if (localFrame < i * 5) return null;

        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: "50%",
              top: "50%",
              transform: `translate(${x}px, ${y}px) scale(${scale * statEntrance})`,
              opacity: opacity * statEntrance,
              zIndex: z > 0 ? 20 : 5,
              pointerEvents: "none",
            }}
          >
            <div
              style={{
                padding: "12px 20px",
                background: `${colors.bgDeep}ee`,
                border: `2px solid ${stat.color}60`,
                borderRadius: 12,
                backdropFilter: "blur(10px)",
                boxShadow: `0 0 30px ${stat.color}30`,
              }}
            >
              <div
                style={{
                  fontFamily: fonts.mono,
                  fontSize: 28,
                  fontWeight: 800,
                  color: stat.color,
                  textShadow: `0 0 15px ${stat.color}`,
                  whiteSpace: "nowrap",
                }}
              >
                {stat.value}
              </div>
              <div
                style={{
                  fontFamily: fonts.mono,
                  fontSize: 11,
                  color: colors.textMuted,
                  letterSpacing: "0.15em",
                  textAlign: "center",
                }}
              >
                {stat.label}
              </div>
            </div>
          </div>
        );
      })}

      {/* Phone device - midground */}
      <div
        style={{
          transform: `
            translate(${parallaxOffset.midground.x}px, ${parallaxOffset.midground.y}px)
            rotateY(${rotateY}deg)
            rotateX(${rotateX}deg)
            scale(${phoneScale})
          `,
          opacity: phoneOpacity,
          transformStyle: "preserve-3d",
          zIndex: 10,
        }}
      >
        {/* Phone frame */}
        <div
          style={{
            width: 320,
            height: 680,
            background: `linear-gradient(145deg, #1a1a1a 0%, #0a0a0a 100%)`,
            borderRadius: 44,
            padding: 12,
            boxShadow: `
              0 50px 100px rgba(0,0,0,0.8),
              0 0 60px ${colors.aptosGreen}20,
              inset 0 1px 0 rgba(255,255,255,0.1)
            `,
            position: "relative",
          }}
        >
          {/* Notch */}
          <div
            style={{
              position: "absolute",
              top: 12,
              left: "50%",
              transform: "translateX(-50%)",
              width: 100,
              height: 28,
              background: "#000",
              borderRadius: 14,
              zIndex: 20,
            }}
          />

          {/* Screen */}
          <div
            style={{
              width: "100%",
              height: "100%",
              borderRadius: 32,
              overflow: "hidden",
              background: colors.bgDeep,
              position: "relative",
            }}
          >
            {/* Screenshot */}
            <Img
              src={staticFile(screenshotPath)}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
              }}
            />

            {/* Screen reflection */}
            <div
              style={{
                position: "absolute",
                inset: 0,
                background: `linear-gradient(
                  135deg,
                  rgba(255,255,255,0.1) 0%,
                  transparent 50%,
                  transparent 100%
                )`,
                pointerEvents: "none",
              }}
            />

            {/* Live indicator */}
            <div
              style={{
                position: "absolute",
                top: 40,
                right: 15,
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "4px 10px",
                background: `${colors.aptosGreen}30`,
                borderRadius: 20,
              }}
            >
              <div
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  backgroundColor: colors.aptosGreen,
                  boxShadow: `0 0 10px ${colors.aptosGreen}`,
                }}
              />
              <span
                style={{
                  fontFamily: fonts.mono,
                  fontSize: 10,
                  color: colors.aptosGreen,
                  fontWeight: 600,
                }}
              >
                LIVE
              </span>
            </div>
          </div>

          {/* Side buttons */}
          <div
            style={{
              position: "absolute",
              right: -3,
              top: 120,
              width: 4,
              height: 60,
              background: "#2a2a2a",
              borderRadius: 2,
            }}
          />
          <div
            style={{
              position: "absolute",
              left: -3,
              top: 100,
              width: 4,
              height: 35,
              background: "#2a2a2a",
              borderRadius: 2,
            }}
          />
          <div
            style={{
              position: "absolute",
              left: -3,
              top: 150,
              width: 4,
              height: 70,
              background: "#2a2a2a",
              borderRadius: 2,
            }}
          />
        </div>
      </div>

      {/* Foreground particles */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          transform: `translate(${parallaxOffset.foreground.x}px, ${parallaxOffset.foreground.y}px)`,
          pointerEvents: "none",
          zIndex: 15,
        }}
      >
        {Array.from({ length: 20 }).map((_, i) => {
          const x = (i % 5) * 400 - 800 + Math.sin(localFrame * 0.02 + i) * 30;
          const y = Math.floor(i / 5) * 300 - 450 + Math.cos(localFrame * 0.025 + i) * 20;
          const size = 2 + (i % 3);
          const opacity = 0.2 + (i % 4) * 0.1;

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
      </div>

      {/* Connection lines from phone to stats */}
      <svg
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 8,
          pointerEvents: "none",
        }}
        width={width}
        height={height}
      >
        {stats.map((stat, i) => {
          const angle = stat.startAngle + localFrame * stat.orbitSpeed;
          const endX = width / 2 + Math.cos(angle) * stat.orbitRadius;
          const endY = height / 2 + Math.sin(angle) * stat.orbitRadius * 0.3;

          const lineOpacity = interpolate(localFrame, [i * 5, i * 5 + 20], [0, 0.3], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });

          return (
            <line
              key={i}
              x1={width / 2}
              y1={height / 2}
              x2={endX}
              y2={endY}
              stroke={stat.color}
              strokeWidth={1}
              strokeDasharray="5,5"
              opacity={lineOpacity}
            />
          );
        })}
      </svg>
    </div>
  );
};
