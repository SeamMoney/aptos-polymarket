import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
} from "remotion";

// ============================================================================
// GLITCH TERMINAL BASE - Enhanced component with all effects
// ============================================================================

export const COLORS = {
  bg: "#0a0a0a",
  glitchRed: "#ff0040",
  glitchCyan: "#00ffff",
  glitchYellow: "#ffff00",
  glitchGreen: "#00ff88",
  glitchPurple: "#bf00ff",
  white: "#ffffff",
  gray: "#666666",
  darkGray: "#1a1a1a",
  success: "#00ff88",
  warning: "#ffaa00",
  error: "#ff0040",
};

export interface CodeLine {
  text: string;
  indent: number;
  type: "comment" | "keyword" | "param" | "function" | "string" | "number" | "type" | "operator" | "highlight" | "empty";
}

export interface TerminalConfig {
  title: string;
  subtitle: string;
  filename: string;
  code: CodeLine[];
  stats: { label: string; value: string; color: string }[];
  liveTrades?: boolean;
  showCompiler?: boolean;
  showProver?: boolean;
  showSecurity?: boolean;
  showPnL?: boolean;
}

const getColor = (type: string) => {
  switch (type) {
    case "comment": return COLORS.gray;
    case "keyword": return COLORS.glitchRed;
    case "param": return COLORS.glitchCyan;
    case "function": return COLORS.glitchYellow;
    case "string": return COLORS.glitchGreen;
    case "number": return COLORS.glitchPurple;
    case "type": return COLORS.glitchCyan;
    case "operator": return COLORS.white;
    case "highlight": return COLORS.glitchYellow;
    default: return COLORS.white;
  }
};

// Animated counter component
const AnimatedNumber: React.FC<{ value: number; prefix?: string; suffix?: string; color: string; frame: number; startFrame: number }> =
  ({ value, prefix = "", suffix = "", color, frame, startFrame }) => {
  const progress = interpolate(frame, [startFrame, startFrame + 30], [0, 1], { extrapolateRight: "clamp", extrapolateLeft: "clamp" });
  const displayValue = Math.floor(value * progress);
  return (
    <span style={{ color, fontFamily: "SF Mono, monospace", fontVariantNumeric: "tabular-nums" }}>
      {prefix}{displayValue.toLocaleString()}{suffix}
    </span>
  );
};

// Live trade ticker
const LiveTrades: React.FC<{ frame: number; fps: number }> = ({ frame, fps }) => {
  const trades = [
    { side: "BUY", outcome: "YES", amount: 1250, price: 0.67 },
    { side: "SELL", outcome: "NO", amount: 890, price: 0.33 },
    { side: "BUY", outcome: "YES", amount: 2100, price: 0.68 },
    { side: "BUY", outcome: "NO", amount: 450, price: 0.32 },
    { side: "SELL", outcome: "YES", amount: 1800, price: 0.67 },
    { side: "BUY", outcome: "YES", amount: 3200, price: 0.69 },
  ];

  const visibleTrades = Math.floor(frame / (fps * 0.4)) % trades.length + 1;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {trades.slice(0, Math.min(visibleTrades, 4)).map((trade, i) => {
        const opacity = interpolate(frame - i * fps * 0.4, [0, 10], [0, 1], { extrapolateRight: "clamp", extrapolateLeft: "clamp" });
        return (
          <div
            key={i}
            style={{
              display: "flex",
              gap: 8,
              fontFamily: "SF Mono, monospace",
              fontSize: 11,
              opacity,
              padding: "4px 8px",
              background: trade.side === "BUY" ? `${COLORS.glitchGreen}15` : `${COLORS.glitchRed}15`,
              borderLeft: `2px solid ${trade.side === "BUY" ? COLORS.glitchGreen : COLORS.glitchRed}`,
            }}
          >
            <span style={{ color: trade.side === "BUY" ? COLORS.glitchGreen : COLORS.glitchRed, width: 35 }}>
              {trade.side}
            </span>
            <span style={{ color: COLORS.white, width: 30 }}>{trade.outcome}</span>
            <span style={{ color: COLORS.glitchCyan }}>${trade.amount}</span>
            <span style={{ color: COLORS.gray }}>@{trade.price.toFixed(2)}</span>
          </div>
        );
      })}
    </div>
  );
};

// Compiler progress bar
const CompilerProgress: React.FC<{ frame: number; fps: number; startFrame: number }> = ({ frame, fps, startFrame }) => {
  const stages = [
    { name: "Parsing", duration: 0.5 },
    { name: "Type checking", duration: 0.8 },
    { name: "Bytecode generation", duration: 0.6 },
    { name: "Optimization", duration: 0.4 },
    { name: "Linking", duration: 0.3 },
  ];

  const totalDuration = stages.reduce((acc, s) => acc + s.duration, 0);
  const elapsed = (frame - startFrame) / fps;
  const progress = Math.min(elapsed / totalDuration, 1);

  let currentStage = 0;
  let accumulated = 0;
  for (let i = 0; i < stages.length; i++) {
    if (accumulated + stages[i].duration > elapsed) {
      currentStage = i;
      break;
    }
    accumulated += stages[i].duration;
    if (i === stages.length - 1) currentStage = i;
  }

  const isComplete = progress >= 1;

  return (
    <div style={{ width: 200 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
        <span style={{ fontFamily: "SF Mono", fontSize: 10, color: COLORS.glitchCyan }}>
          {isComplete ? "COMPILED" : stages[currentStage].name}
        </span>
        <span style={{ fontFamily: "SF Mono", fontSize: 10, color: isComplete ? COLORS.glitchGreen : COLORS.white }}>
          {Math.floor(progress * 100)}%
        </span>
      </div>
      <div style={{ height: 4, background: COLORS.darkGray, borderRadius: 2, overflow: "hidden" }}>
        <div
          style={{
            height: "100%",
            width: `${progress * 100}%`,
            background: isComplete
              ? COLORS.glitchGreen
              : `linear-gradient(90deg, ${COLORS.glitchCyan}, ${COLORS.glitchPurple})`,
            boxShadow: isComplete ? `0 0 10px ${COLORS.glitchGreen}` : `0 0 10px ${COLORS.glitchCyan}`,
            transition: "width 0.1s",
          }}
        />
      </div>
    </div>
  );
};

// Move Prover verification
const ProverStatus: React.FC<{ frame: number; fps: number; startFrame: number }> = ({ frame, fps, startFrame }) => {
  const checks = [
    { name: "No reentrancy", status: "pass" },
    { name: "No overflow", status: "pass" },
    { name: "No underflow", status: "pass" },
    { name: "Access control", status: "pass" },
    { name: "Invariants hold", status: "pass" },
  ];

  const visibleChecks = Math.floor((frame - startFrame) / (fps * 0.25));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
      <div style={{ fontFamily: "SF Mono", fontSize: 10, color: COLORS.glitchPurple, marginBottom: 4 }}>
        MOVE PROVER
      </div>
      {checks.slice(0, Math.min(visibleChecks, checks.length)).map((check, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{
            width: 14,
            height: 14,
            borderRadius: 3,
            background: COLORS.glitchGreen,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 10,
            color: "#000",
            fontWeight: 700,
          }}>
            ✓
          </span>
          <span style={{ fontFamily: "SF Mono", fontSize: 10, color: COLORS.white }}>
            {check.name}
          </span>
        </div>
      ))}
    </div>
  );
};

// Security score display
const SecurityScore: React.FC<{ frame: number; fps: number; startFrame: number }> = ({ frame, fps, startFrame }) => {
  const progress = interpolate(frame, [startFrame, startFrame + fps], [0, 1], { extrapolateRight: "clamp", extrapolateLeft: "clamp" });
  const score = Math.floor(100 * progress);

  return (
    <div style={{ textAlign: "center" }}>
      <div style={{
        fontFamily: "SF Pro Display",
        fontSize: 36,
        fontWeight: 900,
        color: COLORS.glitchGreen,
        textShadow: `0 0 20px ${COLORS.glitchGreen}60`,
      }}>
        {score}%
      </div>
      <div style={{ fontFamily: "SF Mono", fontSize: 9, color: COLORS.gray, letterSpacing: "0.1em" }}>
        SECURITY SCORE
      </div>
      <div style={{ fontFamily: "SF Mono", fontSize: 10, color: COLORS.glitchGreen, marginTop: 4 }}>
        0% REENTRANCY RISK
      </div>
    </div>
  );
};

// PnL Display
const PnLDisplay: React.FC<{ frame: number; fps: number }> = ({ frame, fps }) => {
  const pnl = 12847.52 + Math.sin(frame * 0.1) * 500;
  const pnlPercent = 23.4 + Math.sin(frame * 0.1) * 2;
  const isPositive = pnl > 0;

  return (
    <div style={{ textAlign: "right" }}>
      <div style={{ fontFamily: "SF Mono", fontSize: 10, color: COLORS.gray }}>TOTAL P&L</div>
      <div style={{
        fontFamily: "SF Pro Display",
        fontSize: 28,
        fontWeight: 700,
        color: isPositive ? COLORS.glitchGreen : COLORS.glitchRed,
      }}>
        {isPositive ? "+" : ""}{pnl.toFixed(2)} USD1
      </div>
      <div style={{
        fontFamily: "SF Mono",
        fontSize: 12,
        color: isPositive ? COLORS.glitchGreen : COLORS.glitchRed,
      }}>
        {isPositive ? "▲" : "▼"} {pnlPercent.toFixed(1)}%
      </div>
    </div>
  );
};

export const GlitchTerminalBase: React.FC<TerminalConfig> = ({
  title,
  subtitle,
  filename,
  code,
  stats,
  liveTrades = false,
  showCompiler = false,
  showProver = false,
  showSecurity = false,
  showPnL = false,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const framesPerLine = fps / 4;

  // Glitch timing
  const glitchActive = Math.sin(frame * 0.15) > 0.85;
  const microGlitch = Math.sin(frame * 0.4) > 0.95;
  const glitchOffset = glitchActive ? (Math.random() - 0.5) * 20 : 0;
  const chromaOffset = glitchActive ? 4 : microGlitch ? 2 : 0;

  // Scanline position
  const scanlineY = (frame * 5) % 1080;

  // Noise bars
  const noiseBars = glitchActive ? Array.from({ length: 5 }).map((_, i) => ({
    y: Math.random() * 1080,
    height: Math.random() * 20 + 5,
    opacity: Math.random() * 0.5,
  })) : [];

  // Data stream particles
  const particles = Array.from({ length: 30 }).map((_, i) => ({
    x: (i * 67 + frame * 2) % 1920,
    y: (i * 43 + frame * 1.5) % 1080,
    size: 2 + (i % 3),
    opacity: 0.1 + (i % 5) * 0.05,
  }));

  return (
    <AbsoluteFill style={{ background: COLORS.bg }}>
      {/* Background grid */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: `
            linear-gradient(${COLORS.glitchCyan}05 1px, transparent 1px),
            linear-gradient(90deg, ${COLORS.glitchCyan}05 1px, transparent 1px)
          `,
          backgroundSize: "50px 50px",
        }}
      />

      {/* Data stream particles */}
      {particles.map((p, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: p.x,
            top: p.y,
            width: p.size,
            height: p.size,
            borderRadius: "50%",
            background: i % 2 === 0 ? COLORS.glitchCyan : COLORS.glitchRed,
            opacity: p.opacity,
            boxShadow: `0 0 ${p.size * 2}px ${i % 2 === 0 ? COLORS.glitchCyan : COLORS.glitchRed}`,
          }}
        />
      ))}

      {/* Chromatic aberration layers */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: COLORS.glitchRed,
          mixBlendMode: "screen",
          opacity: glitchActive ? 0.1 : 0,
          transform: `translateX(${chromaOffset}px)`,
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: COLORS.glitchCyan,
          mixBlendMode: "screen",
          opacity: glitchActive ? 0.1 : 0,
          transform: `translateX(-${chromaOffset}px)`,
        }}
      />

      {/* Scanline */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: scanlineY,
          height: 3,
          background: `linear-gradient(90deg, transparent, ${COLORS.white}30, transparent)`,
          pointerEvents: "none",
        }}
      />

      {/* Noise bars during glitch */}
      {noiseBars.map((bar, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: bar.y,
            height: bar.height,
            background: COLORS.white,
            opacity: bar.opacity,
          }}
        />
      ))}

      {/* VHS tracking lines */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `repeating-linear-gradient(
            0deg,
            transparent,
            transparent 2px,
            rgba(0,0,0,0.1) 2px,
            rgba(0,0,0,0.1) 4px
          )`,
          pointerEvents: "none",
        }}
      />

      {/* Main terminal */}
      <div
        style={{
          position: "absolute",
          left: 60,
          top: 120,
          transform: `translateX(${glitchOffset}px)`,
          width: liveTrades || showProver || showPnL ? 1000 : 1200,
          background: `${COLORS.darkGray}f0`,
          border: `2px solid ${glitchActive ? COLORS.glitchRed : COLORS.glitchCyan}40`,
          borderRadius: 8,
          overflow: "hidden",
          boxShadow: `0 0 40px ${COLORS.glitchCyan}20`,
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "12px 20px",
            background: COLORS.bg,
            borderBottom: `1px solid ${COLORS.gray}30`,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ display: "flex", gap: 6 }}>
              <div style={{ width: 12, height: 12, borderRadius: "50%", background: COLORS.glitchRed }} />
              <div style={{ width: 12, height: 12, borderRadius: "50%", background: COLORS.glitchYellow }} />
              <div style={{ width: 12, height: 12, borderRadius: "50%", background: COLORS.glitchGreen }} />
            </div>
            <div
              style={{
                fontFamily: "SF Mono, monospace",
                fontSize: 13,
                color: COLORS.glitchCyan,
                letterSpacing: "0.05em",
              }}
            >
              {glitchActive ? "█ERR0R█" : "SYS://"}{filename}
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            {showCompiler && <CompilerProgress frame={frame} fps={fps} startFrame={fps * 0.5} />}
            <div
              style={{
                fontFamily: "SF Mono, monospace",
                fontSize: 11,
                color: glitchActive ? COLORS.glitchYellow : COLORS.glitchGreen,
                padding: "4px 10px",
                border: `1px solid ${glitchActive ? COLORS.glitchYellow : COLORS.glitchGreen}50`,
                borderRadius: 4,
              }}
            >
              {glitchActive ? "⚠ GLITCH" : "● LIVE"}
            </div>
          </div>
        </div>

        {/* Code area */}
        <div style={{ padding: "16px 24px", minHeight: 480 }}>
          {code.map((line, i) => {
            const lineStart = fps * 0.5 + i * framesPerLine;
            const progress = interpolate(
              frame,
              [lineStart, lineStart + framesPerLine * 0.5],
              [0, 1],
              { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
            );

            const visibleChars = Math.floor(line.text.length * progress);
            let text = line.text.slice(0, visibleChars);

            // Random character corruption during glitch
            if (glitchActive && Math.random() > 0.7 && text.length > 0) {
              const chars = text.split("");
              const idx = Math.floor(Math.random() * chars.length);
              chars[idx] = String.fromCharCode(Math.random() * 94 + 33);
              text = chars.join("");
            }

            const color = getColor(line.type);
            const isHighlight = line.type === "highlight";
            const lineGlitch = microGlitch && Math.random() > 0.8;
            const indent = "  ".repeat(line.indent);

            return (
              <div
                key={i}
                style={{
                  fontFamily: "Fira Code, SF Mono, monospace",
                  fontSize: 13,
                  lineHeight: 1.8,
                  color: color,
                  opacity: progress > 0 ? 1 : 0,
                  transform: lineGlitch ? `translateX(${(Math.random() - 0.5) * 10}px)` : "none",
                  background: isHighlight ? `${color}15` : "transparent",
                  padding: isHighlight ? "2px 8px" : "0",
                  marginLeft: isHighlight ? -8 : 0,
                  borderLeft: isHighlight ? `3px solid ${color}` : "none",
                  whiteSpace: "pre",
                }}
              >
                <span style={{ color: COLORS.gray, opacity: 0.4, marginRight: 16, fontSize: 11, fontVariantNumeric: "tabular-nums" }}>
                  {String(i + 1).padStart(2, "0")}
                </span>
                {/* Chromatic text split */}
                <span style={{ position: "relative" }}>
                  {chromaOffset > 0 && (
                    <>
                      <span style={{ position: "absolute", left: -chromaOffset, color: COLORS.glitchRed, opacity: 0.7 }}>
                        {indent}{text}
                      </span>
                      <span style={{ position: "absolute", left: chromaOffset, color: COLORS.glitchCyan, opacity: 0.7 }}>
                        {indent}{text}
                      </span>
                    </>
                  )}
                  <span style={{ position: "relative" }}>{indent}{text}</span>
                </span>
                {progress > 0 && progress < 1 && (
                  <span
                    style={{
                      display: "inline-block",
                      width: 8,
                      height: 14,
                      background: COLORS.glitchCyan,
                      marginLeft: 2,
                      boxShadow: `0 0 8px ${COLORS.glitchCyan}`,
                    }}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Side panel */}
      {(liveTrades || showProver || showPnL) && (
        <div
          style={{
            position: "absolute",
            right: 60,
            top: 120,
            width: 280,
            display: "flex",
            flexDirection: "column",
            gap: 16,
          }}
        >
          {showPnL && (
            <div style={{ background: `${COLORS.darkGray}f0`, padding: 16, borderRadius: 8, border: `1px solid ${COLORS.glitchGreen}30` }}>
              <PnLDisplay frame={frame} fps={fps} />
            </div>
          )}
          {liveTrades && (
            <div style={{ background: `${COLORS.darkGray}f0`, padding: 12, borderRadius: 8, border: `1px solid ${COLORS.glitchCyan}30` }}>
              <div style={{ fontFamily: "SF Mono", fontSize: 10, color: COLORS.glitchCyan, marginBottom: 8 }}>
                LIVE TRADES
              </div>
              <LiveTrades frame={frame} fps={fps} />
            </div>
          )}
          {showProver && (
            <div style={{ background: `${COLORS.darkGray}f0`, padding: 12, borderRadius: 8, border: `1px solid ${COLORS.glitchPurple}30` }}>
              <ProverStatus frame={frame} fps={fps} startFrame={fps * 2} />
            </div>
          )}
          {showSecurity && (
            <div style={{ background: `${COLORS.darkGray}f0`, padding: 16, borderRadius: 8, border: `1px solid ${COLORS.glitchGreen}30` }}>
              <SecurityScore frame={frame} fps={fps} startFrame={fps * 3} />
            </div>
          )}
        </div>
      )}

      {/* Title */}
      <div
        style={{
          position: "absolute",
          top: 35,
          left: 60,
          opacity: interpolate(frame, [0, fps * 0.3], [0, 1]),
        }}
      >
        <div
          style={{
            fontFamily: "SF Mono, monospace",
            fontSize: 11,
            color: COLORS.glitchCyan,
            letterSpacing: "0.25em",
          }}
        >
          {glitchActive ? "█APT0S█M0VE█" : "APTOS MOVE PROTOCOL"}
        </div>
        <div
          style={{
            fontFamily: "SF Pro Display, sans-serif",
            fontSize: 42,
            fontWeight: 900,
            color: COLORS.white,
            position: "relative",
            marginTop: 4,
          }}
        >
          {chromaOffset > 0 && (
            <>
              <span style={{ position: "absolute", left: -chromaOffset, color: COLORS.glitchRed, opacity: 0.7 }}>
                {title}
              </span>
              <span style={{ position: "absolute", left: chromaOffset, color: COLORS.glitchCyan, opacity: 0.7 }}>
                {title}
              </span>
            </>
          )}
          <span style={{ position: "relative" }}>{title}</span>
        </div>
        <div style={{ fontFamily: "SF Mono", fontSize: 12, color: COLORS.gray, marginTop: 4 }}>
          {subtitle}
        </div>
      </div>

      {/* Stats */}
      <div
        style={{
          position: "absolute",
          bottom: 35,
          right: 60,
          display: "flex",
          gap: 16,
          opacity: interpolate(frame, [fps * 2, fps * 2.5], [0, 1]),
        }}
      >
        {stats.map((stat, i) => (
          <div
            key={stat.label}
            style={{
              padding: "12px 20px",
              border: `1px solid ${stat.color}50`,
              background: `${stat.color}10`,
              textAlign: "center",
              borderRadius: 6,
            }}
          >
            <div
              style={{
                fontFamily: "SF Pro Display",
                fontSize: 22,
                fontWeight: 700,
                color: stat.color,
                textShadow: `0 0 10px ${stat.color}50`,
              }}
            >
              {stat.value}
            </div>
            <div style={{ fontFamily: "SF Mono", fontSize: 9, color: COLORS.gray, marginTop: 2, letterSpacing: "0.1em" }}>
              {stat.label}
            </div>
          </div>
        ))}
      </div>

      {/* Aptos badge */}
      <div
        style={{
          position: "absolute",
          bottom: 40,
          left: 60,
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}
      >
        <div
          style={{
            width: 32,
            height: 32,
            border: `2px solid ${COLORS.glitchCyan}`,
            borderRadius: 6,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: 900,
            fontSize: 18,
            color: COLORS.glitchCyan,
            boxShadow: `0 0 10px ${COLORS.glitchCyan}40`,
          }}
        >
          A
        </div>
        <div>
          <div style={{ fontFamily: "SF Pro Display", fontSize: 13, fontWeight: 600, color: COLORS.white }}>
            Aptos Network
          </div>
          <div style={{ fontFamily: "SF Mono", fontSize: 9, color: COLORS.gray }}>
            Block-STM • 30,000+ TPS
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
