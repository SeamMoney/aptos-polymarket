// Design System for Polymarket on Aptos Videos

export const colors = {
  // Aptos Brand
  aptosGreen: "#06D6A0",
  aptosCyan: "#00F5FF",
  aptosBlue: "#4F46E5",
  deepPurple: "#6B46C1",

  // Success/Speed
  neonGreen: "#39FF14",
  electricBlue: "#00D4FF",

  // Error/Problems (Polygon)
  errorRed: "#FF3B30",
  warningOrange: "#FF9500",
  glitchMagenta: "#FF00FF",
  deadGray: "#3A3A3C",

  // Neutrals
  bgDeep: "#0A0A0F",
  bgSurface: "#12121A",
  bgCard: "#1A1A2E",
  bgElevated: "#252538",

  textPrimary: "#FFFFFF",
  textSecondary: "#A0A0B0",
  textMuted: "#5A5A6E",

  // Gradients
  gradientAptos: "linear-gradient(135deg, #06D6A0, #00F5FF)",
  gradientPurple: "linear-gradient(135deg, #6B46C1, #4F46E5)",
  gradientError: "linear-gradient(135deg, #FF3B30, #FF9500)",
};

export const fonts = {
  display: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
  mono: "'JetBrains Mono', 'Fira Code', monospace",
};

export const fontWeights = {
  regular: 400,
  medium: 500,
  semibold: 600,
  bold: 700,
  black: 900,
};

export const shadows = {
  glow: (color: string) => `0 0 40px ${color}40, 0 0 80px ${color}20`,
  glowStrong: (color: string) => `0 0 60px ${color}60, 0 0 120px ${color}40`,
  text: (color: string) => `0 0 20px ${color}80`,
};

export const easings = {
  // Smooth, natural motion
  out: "cubic-bezier(0.16, 1, 0.3, 1)",
  in: "cubic-bezier(0.7, 0, 0.84, 0)",
  inOut: "cubic-bezier(0.87, 0, 0.13, 1)",
  // Bouncy
  bounce: "cubic-bezier(0.34, 1.56, 0.64, 1)",
  // Sharp
  sharp: "cubic-bezier(0.4, 0, 0.2, 1)",
};

// Spring configs for Remotion
export const springs = {
  snappy: { damping: 20, stiffness: 300, mass: 0.5 },
  smooth: { damping: 30, stiffness: 150, mass: 1 },
  bouncy: { damping: 12, stiffness: 200, mass: 0.8 },
  slow: { damping: 50, stiffness: 100, mass: 1.5 },
};
