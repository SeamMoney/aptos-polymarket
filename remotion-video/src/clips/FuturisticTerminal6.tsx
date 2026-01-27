import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
} from "remotion";

// ============================================================================
// FUTURISTIC TERMINAL 6 - AI/Neural network style with aggregator_v2 code
// ============================================================================

const COLORS = {
  bg: "#030712",
  neural: "#6366f1",
  electric: "#22d3ee",
  glow: "#818cf8",
  white: "#f8fafc",
  gray: "#64748b",
  success: "#4ade80",
  warning: "#fbbf24",
};

const CODE_LINES = [
  { text: "/// TPS OPTIMIZATIONS - The Secret to 30,000+ TPS", type: "header" },
  { text: "", type: "empty" },
  { text: "// 1. Aggregator_v2 for parallel numeric operations", type: "comment" },
  { text: "use aptos_framework::aggregator_v2::{Self, Aggregator};", type: "import" },
  { text: "", type: "empty" },
  { text: "struct OutcomeMarket has key {", type: "keyword" },
  { text: "    /// Parallel-safe reserve (NO CONTENTION!)", type: "comment" },
  { text: "    reserve: Aggregator<u64>,", type: "highlight" },
  { text: "    /// Each outcome has OWN base_reserve", type: "comment" },
  { text: "    base_reserve: Aggregator<u64>,", type: "highlight" },
  { text: "}", type: "keyword" },
  { text: "", type: "empty" },
  { text: "// 2. Snapshot reads avoid sequential dependencies", type: "comment" },
  { text: "// Per AIP-47: \"snapshot() is fast, avoids serialization\"", type: "comment" },
  { text: "let base_snapshot = aggregator_v2::snapshot(&outcome.base_reserve);", type: "code" },
  { text: "let current_base = aggregator_v2::read_snapshot(&base_snapshot);", type: "code" },
  { text: "", type: "empty" },
  { text: "// 3. Parallel add/sub operations", type: "comment" },
  { text: "aggregator_v2::add(&mut outcome.base_reserve, amount);", type: "highlight" },
  { text: "aggregator_v2::sub(&mut outcome.reserve, tokens_out);", type: "highlight" },
  { text: "", type: "empty" },
  { text: "// 4. Table registry for O(1) lookups", type: "comment" },
  { text: "struct MultiMarketRegistry has key {", type: "keyword" },
  { text: "    markets: Table<address, MarketMetadata>,  // NOT SmartTable!", type: "highlight" },
  { text: "}", type: "keyword" },
  { text: "", type: "empty" },
  { text: "// 5. Separate OutcomeMarket objects per outcome", type: "comment" },
  { text: "// Each outcome trades independently = PARALLEL EXECUTION", type: "success" },
];

const getColor = (type: string) => {
  switch (type) {
    case "header": return COLORS.electric;
    case "comment": return COLORS.gray;
    case "keyword": return COLORS.neural;
    case "highlight": return COLORS.electric;
    case "import": return COLORS.glow;
    case "success": return COLORS.success;
    default: return COLORS.white;
  }
};

export const FuturisticTerminal6: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const framesPerLine = fps / 3.5;

  // Neural network nodes
  const nodes = Array.from({ length: 30 }).map((_, i) => {
    const angle = (i / 30) * Math.PI * 2 + frame * 0.01;
    const radius = 300 + Math.sin(i * 0.5 + frame * 0.02) * 100;
    return {
      x: 960 + Math.cos(angle) * radius,
      y: 540 + Math.sin(angle) * radius * 0.5,
      size: 4 + (i % 4) * 2,
      pulse: Math.sin(frame * 0.1 + i) * 0.5 + 0.5,
    };
  });

  // Connection lines between nodes
  const connections = nodes.slice(0, 15).map((node, i) => {
    const target = nodes[(i + 7) % nodes.length];
    return { x1: node.x, y1: node.y, x2: target.x, y2: target.y, opacity: 0.1 + node.pulse * 0.1 };
  });

  // Data flow particles
  const dataParticles = Array.from({ length: 20 }).map((_, i) => {
    const progress = ((frame * 2 + i * 50) % 1000) / 1000;
    const startNode = nodes[i % nodes.length];
    const endNode = nodes[(i + 5) % nodes.length];
    return {
      x: startNode.x + (endNode.x - startNode.x) * progress,
      y: startNode.y + (endNode.y - startNode.y) * progress,
      opacity: Math.sin(progress * Math.PI),
    };
  });

  return (
    <AbsoluteFill style={{ background: COLORS.bg }}>
      {/* Neural network background */}
      <svg
        style={{ position: "absolute", inset: 0, opacity: 0.4 }}
        viewBox="0 0 1920 1080"
      >
        {/* Connections */}
        {connections.map((conn, i) => (
          <line
            key={i}
            x1={conn.x1}
            y1={conn.y1}
            x2={conn.x2}
            y2={conn.y2}
            stroke={COLORS.neural}
            strokeWidth={1}
            opacity={conn.opacity}
          />
        ))}

        {/* Nodes */}
        {nodes.map((node, i) => (
          <circle
            key={i}
            cx={node.x}
            cy={node.y}
            r={node.size}
            fill={COLORS.neural}
            opacity={0.3 + node.pulse * 0.4}
          />
        ))}

        {/* Data particles */}
        {dataParticles.map((p, i) => (
          <circle
            key={`p${i}`}
            cx={p.x}
            cy={p.y}
            r={3}
            fill={COLORS.electric}
            opacity={p.opacity * 0.8}
          />
        ))}
      </svg>

      {/* Gradient overlays */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `
            radial-gradient(ellipse at 30% 30%, ${COLORS.neural}15 0%, transparent 50%),
            radial-gradient(ellipse at 70% 70%, ${COLORS.electric}10 0%, transparent 50%)
          `,
        }}
      />

      {/* Main code panel */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          transform: "translate(-50%, -50%)",
          width: 1200,
          background: `${COLORS.bg}e8`,
          borderRadius: 24,
          border: `1px solid ${COLORS.neural}40`,
          boxShadow: `
            0 0 80px ${COLORS.neural}20,
            0 40px 80px rgba(0,0,0,0.5)
          `,
          overflow: "hidden",
          backdropFilter: "blur(20px)",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "16px 28px",
            background: `linear-gradient(90deg, ${COLORS.neural}15, ${COLORS.electric}10)`,
            borderBottom: `1px solid ${COLORS.neural}30`,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: `linear-gradient(135deg, ${COLORS.neural}, ${COLORS.electric})`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path
                  d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"
                  stroke="#fff"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <div>
              <div style={{ fontFamily: "SF Pro Display", fontSize: 16, fontWeight: 600, color: COLORS.white }}>
                PARALLEL EXECUTION ENGINE
              </div>
              <div style={{ fontFamily: "SF Mono", fontSize: 11, color: COLORS.gray }}>
                Block-STM + Aggregator_v2
              </div>
            </div>
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "6px 14px",
              background: `${COLORS.success}20`,
              borderRadius: 16,
              border: `1px solid ${COLORS.success}40`,
            }}
          >
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: COLORS.success,
                boxShadow: `0 0 10px ${COLORS.success}`,
              }}
            />
            <span style={{ fontFamily: "SF Mono", fontSize: 11, color: COLORS.success }}>
              OPTIMIZED
            </span>
          </div>
        </div>

        {/* Code */}
        <div style={{ padding: "20px 28px", minHeight: 580 }}>
          {CODE_LINES.map((line, i) => {
            const lineStart = fps * 0.4 + i * framesPerLine;
            const progress = interpolate(
              frame,
              [lineStart, lineStart + framesPerLine * 0.5],
              [0, 1],
              { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
            );

            const visibleChars = Math.floor(line.text.length * progress);
            const text = line.text.slice(0, visibleChars);
            const color = getColor(line.type);
            const isHighlight = line.type === "highlight" || line.type === "success";

            return (
              <div
                key={i}
                style={{
                  fontFamily: "Fira Code, SF Mono, monospace",
                  fontSize: 14,
                  lineHeight: 1.7,
                  color: color,
                  opacity: progress > 0 ? 1 : 0,
                  background: isHighlight ? `${color}10` : "transparent",
                  padding: isHighlight ? "2px 8px" : "0",
                  marginLeft: isHighlight ? -8 : 0,
                  borderRadius: 4,
                  borderLeft: isHighlight ? `3px solid ${color}` : "none",
                }}
              >
                <span style={{ color: COLORS.gray, opacity: 0.3, marginRight: 20, fontSize: 12 }}>
                  {String(i + 1).padStart(2, "0")}
                </span>
                {text}
                {progress > 0 && progress < 1 && (
                  <span
                    style={{
                      display: "inline-block",
                      width: 2,
                      height: 16,
                      background: COLORS.electric,
                      boxShadow: `0 0 10px ${COLORS.electric}`,
                      marginLeft: 2,
                    }}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Title */}
      <div
        style={{
          position: "absolute",
          top: 40,
          left: 70,
          opacity: interpolate(frame, [0, fps * 0.4], [0, 1]),
        }}
      >
        <div
          style={{
            fontFamily: "SF Mono, monospace",
            fontSize: 13,
            color: COLORS.electric,
            letterSpacing: "0.2em",
          }}
        >
          APTOS BLOCK-STM
        </div>
        <div
          style={{
            fontFamily: "SF Pro Display, sans-serif",
            fontSize: 48,
            fontWeight: 900,
            background: `linear-gradient(90deg, ${COLORS.neural}, ${COLORS.electric})`,
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}
        >
          Aggregator_v2
        </div>
        <div style={{ fontFamily: "SF Mono", fontSize: 14, color: COLORS.gray, marginTop: 6 }}>
          Parallel-safe state for 30,000+ TPS
        </div>
      </div>

      {/* Stats */}
      <div
        style={{
          position: "absolute",
          bottom: 40,
          right: 70,
          display: "flex",
          gap: 20,
          opacity: interpolate(frame, [fps * 2, fps * 2.5], [0, 1]),
        }}
      >
        {[
          { label: "Contention", value: "0", color: COLORS.success },
          { label: "Parallelism", value: "PER-OUTCOME", color: COLORS.neural },
          { label: "TPS", value: "30K+", color: COLORS.electric },
        ].map((stat) => (
          <div
            key={stat.label}
            style={{
              padding: "14px 24px",
              background: `${stat.color}10`,
              border: `1px solid ${stat.color}30`,
              borderRadius: 12,
              textAlign: "center",
            }}
          >
            <div style={{ fontFamily: "SF Pro Display", fontSize: 26, fontWeight: 700, color: stat.color }}>
              {stat.value}
            </div>
            <div style={{ fontFamily: "SF Mono", fontSize: 10, color: COLORS.gray, marginTop: 4, letterSpacing: "0.1em" }}>
              {stat.label.toUpperCase()}
            </div>
          </div>
        ))}
      </div>

      {/* Aptos badge */}
      <div
        style={{
          position: "absolute",
          bottom: 45,
          left: 70,
          display: "flex",
          alignItems: "center",
          gap: 12,
          opacity: 0.7,
        }}
      >
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: 10,
            background: `linear-gradient(135deg, ${COLORS.neural}, ${COLORS.electric})`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: 900,
            fontSize: 22,
            color: "#fff",
          }}
        >
          A
        </div>
        <span style={{ fontFamily: "SF Pro Display", fontSize: 16, color: COLORS.white }}>
          Powered by Aptos
        </span>
      </div>
    </AbsoluteFill>
  );
};
