import React from "react";
import { useCurrentFrame, useVideoConfig, random } from "remotion";
import { colors, fonts } from "../styles/theme";

interface TransactionRainProps {
  density?: number;
  speed?: number;
  mode?: "normal" | "failing" | "fast";
}

export const TransactionRain: React.FC<TransactionRainProps> = ({
  density = 50,
  speed = 1,
  mode = "normal",
}) => {
  const frame = useCurrentFrame();
  const { height } = useVideoConfig();

  // Generate transaction hashes
  const txs = Array.from({ length: density }, (_, i) => {
    const hash = `0x${Array.from({ length: 8 }, (_, j) =>
      Math.floor(random(`hash-${i}-${j}`) * 16).toString(16)
    ).join("")}...`;

    const column = random(`col-${i}`) * 100;
    const startY = random(`startY-${i}`) * height;
    const txSpeed = (0.5 + random(`speed-${i}`) * 1.5) * speed;
    const opacity = 0.1 + random(`opacity-${i}`) * 0.3;
    const size = 10 + random(`size-${i}`) * 4;

    // Position based on frame
    const y = (startY + frame * txSpeed * 3) % (height + 100) - 50;

    // Color based on mode
    let color = colors.aptosGreen;
    if (mode === "failing") {
      color = random(`fail-${i}-${frame % 30}`) > 0.7 ? colors.errorRed : colors.deadGray;
    } else if (mode === "fast") {
      color = random(`fast-${i}`) > 0.5 ? colors.aptosGreen : colors.aptosCyan;
    }

    // Glitch effect for failing mode
    const glitchX = mode === "failing" && random(`glitch-${i}-${frame}`) > 0.9
      ? (random(`glitchX-${i}-${frame}`) - 0.5) * 20
      : 0;

    return {
      hash,
      x: column,
      y,
      opacity: mode === "failing" ? opacity * 0.5 : opacity,
      size,
      color,
      glitchX,
    };
  });

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        overflow: "hidden",
        pointerEvents: "none",
      }}
    >
      {txs.map((tx, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: `${tx.x}%`,
            top: tx.y,
            transform: `translateX(${tx.glitchX}px)`,
            fontFamily: fonts.mono,
            fontSize: tx.size,
            color: tx.color,
            opacity: tx.opacity,
            whiteSpace: "nowrap",
            textShadow: `0 0 10px ${tx.color}40`,
          }}
        >
          {tx.hash}
        </div>
      ))}
    </div>
  );
};
