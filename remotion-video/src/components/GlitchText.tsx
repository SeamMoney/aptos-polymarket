import React from "react";
import { useCurrentFrame, useVideoConfig, interpolate, random } from "remotion";
import { colors, fonts, fontWeights } from "../styles/theme";

interface GlitchTextProps {
  children: string;
  fontSize?: number;
  intensity?: number; // 0-1
  color?: string;
  style?: React.CSSProperties;
}

export const GlitchText: React.FC<GlitchTextProps> = ({
  children,
  fontSize = 48,
  intensity = 0.5,
  color = colors.textPrimary,
  style,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Glitch timing - random intervals
  const glitchActive =
    random(`glitch-${frame}-active`) < intensity * 0.3 ||
    (frame % Math.floor(fps * 0.5) < 3);

  // RGB split offset
  const rgbOffset = glitchActive ? random(`rgb-${frame}`) * 8 * intensity : 0;

  // Position jitter
  const jitterX = glitchActive ? (random(`jx-${frame}`) - 0.5) * 10 * intensity : 0;
  const jitterY = glitchActive ? (random(`jy-${frame}`) - 0.5) * 5 * intensity : 0;

  // Skew distortion
  const skew = glitchActive ? (random(`skew-${frame}`) - 0.5) * 10 * intensity : 0;

  // Slice effect - horizontal bars
  const sliceCount = 5;
  const slices = Array.from({ length: sliceCount }, (_, i) => {
    const sliceActive = glitchActive && random(`slice-${frame}-${i}`) > 0.5;
    return {
      top: `${(i / sliceCount) * 100}%`,
      height: `${100 / sliceCount}%`,
      transform: sliceActive
        ? `translateX(${(random(`sx-${frame}-${i}`) - 0.5) * 20 * intensity}px)`
        : "none",
      clipPath: `inset(${(i / sliceCount) * 100}% 0 ${100 - ((i + 1) / sliceCount) * 100}% 0)`,
    };
  });

  const baseStyle: React.CSSProperties = {
    fontSize,
    fontFamily: fonts.display,
    fontWeight: fontWeights.bold,
    color,
    position: "relative",
    display: "inline-block",
    transform: `translate(${jitterX}px, ${jitterY}px) skewX(${skew}deg)`,
    ...style,
  };

  return (
    <div style={{ position: "relative", display: "inline-block" }}>
      {/* Red channel offset */}
      <span
        style={{
          ...baseStyle,
          position: "absolute",
          left: -rgbOffset,
          color: colors.errorRed,
          opacity: glitchActive ? 0.8 : 0,
          mixBlendMode: "screen",
        }}
      >
        {children}
      </span>

      {/* Cyan channel offset */}
      <span
        style={{
          ...baseStyle,
          position: "absolute",
          left: rgbOffset,
          color: colors.aptosCyan,
          opacity: glitchActive ? 0.8 : 0,
          mixBlendMode: "screen",
        }}
      >
        {children}
      </span>

      {/* Main text with slices */}
      <span style={baseStyle}>
        {slices.map((slice, i) => (
          <span
            key={i}
            style={{
              position: i === 0 ? "relative" : "absolute",
              left: 0,
              top: 0,
              width: "100%",
              height: "100%",
              clipPath: slice.clipPath,
              transform: slice.transform,
              display: "block",
            }}
          >
            {i === 0 ? children : (
              <span style={{ visibility: "hidden" }}>{children}</span>
            )}
          </span>
        ))}
        {children}
      </span>

      {/* Scanline overlay */}
      {glitchActive && (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
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
      )}
    </div>
  );
};
