import React from "react";
import { useCurrentFrame, useVideoConfig, interpolate, spring, Easing } from "remotion";
import { colors, fonts, fontWeights, shadows } from "../styles/theme";

interface NumberCounterProps {
  from?: number;
  to: number;
  startFrame?: number;
  duration?: number; // in frames
  fontSize?: number;
  color?: string;
  suffix?: string;
  prefix?: string;
  glow?: boolean;
  formatNumber?: boolean;
}

export const NumberCounter: React.FC<NumberCounterProps> = ({
  from = 0,
  to,
  startFrame = 0,
  duration = 60,
  fontSize = 72,
  color = colors.aptosGreen,
  suffix = "",
  prefix = "",
  glow = true,
  formatNumber = true,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const progress = interpolate(
    frame,
    [startFrame, startFrame + duration],
    [0, 1],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.out(Easing.cubic),
    }
  );

  // Add some overshoot for dramatic effect
  const springProgress = spring({
    frame: frame - startFrame,
    fps,
    config: {
      damping: 30,
      stiffness: 100,
      mass: 0.8,
    },
  });

  const currentValue = Math.round(from + (to - from) * Math.min(progress, 1));

  // Format with commas
  const displayValue = formatNumber
    ? currentValue.toLocaleString()
    : currentValue.toString();

  // Scale effect on completion
  const scale = progress >= 1
    ? spring({
        frame: frame - (startFrame + duration),
        fps,
        config: { damping: 15, stiffness: 200, mass: 0.5 },
        durationInFrames: 20,
      }) * 0.05 + 1
    : 1;

  return (
    <div
      style={{
        fontFamily: fonts.mono,
        fontWeight: fontWeights.bold,
        fontSize,
        color,
        textShadow: glow ? shadows.text(color) : "none",
        transform: `scale(${scale})`,
        letterSpacing: "-0.02em",
        fontVariantNumeric: "tabular-nums",
      }}
    >
      {prefix}
      {displayValue}
      {suffix}
    </div>
  );
};
