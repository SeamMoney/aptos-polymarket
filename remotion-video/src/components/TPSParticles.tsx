import React from "react";
import { useCurrentFrame, useVideoConfig, interpolate, random, Easing } from "remotion";
import { colors } from "../styles/theme";

interface TPSParticlesProps {
  count: number;
  startFrame?: number;
  duration?: number;
  color?: string;
  slow?: boolean; // For Polygon comparison
}

export const TPSParticles: React.FC<TPSParticlesProps> = ({
  count,
  startFrame = 0,
  duration = 60,
  color = colors.aptosGreen,
  slow = false,
}) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();

  const progress = interpolate(
    frame,
    [startFrame, startFrame + duration],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) }
  );

  // For slow mode, only show a few particles trickling
  const visibleCount = slow
    ? Math.min(Math.floor(progress * count), count)
    : Math.floor(progress * count);

  const particles = Array.from({ length: visibleCount }, (_, i) => {
    const angle = random(`angle-${i}`) * Math.PI * 2;
    const distance = slow
      ? 50 + random(`dist-${i}`) * 100
      : 100 + random(`dist-${i}`) * 400;
    const size = slow
      ? 4 + random(`size-${i}`) * 4
      : 2 + random(`size-${i}`) * 4;

    const spawnProgress = slow
      ? interpolate(i / count, [0, 1], [0, 1])
      : interpolate(i / count, [0, 0.8], [0, 1], { extrapolateRight: "clamp" });

    const particleProgress = Math.max(0, (progress - spawnProgress) / (1 - spawnProgress));

    // Explosion pattern for fast, slow drift for slow
    const currentDistance = slow
      ? distance * particleProgress * 0.3
      : distance * Math.pow(particleProgress, 0.5);

    const x = Math.cos(angle) * currentDistance;
    const y = Math.sin(angle) * currentDistance;

    const opacity = slow
      ? 0.3 + particleProgress * 0.4
      : Math.min(1, particleProgress * 2) * (1 - Math.pow(particleProgress, 3) * 0.5);

    return { x, y, size, opacity };
  });

  return (
    <div
      style={{
        position: "absolute",
        left: "50%",
        top: "50%",
        width: 0,
        height: 0,
      }}
    >
      {particles.map((p, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            width: p.size,
            height: p.size,
            borderRadius: "50%",
            backgroundColor: color,
            opacity: p.opacity,
            transform: `translate(${p.x}px, ${p.y}px)`,
            boxShadow: `0 0 ${p.size * 2}px ${color}`,
          }}
        />
      ))}
    </div>
  );
};
