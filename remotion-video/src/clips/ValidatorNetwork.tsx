import React from "react";
import {
  AbsoluteFill,
  useVideoConfig,
  useCurrentFrame,
  spring,
  interpolate,
  Img,
  staticFile,
  random,
} from "remotion";

// ============================================================================
// VALIDATOR NETWORK - 18 second clip showing global distribution
// ============================================================================

const COLORS = {
  bg: "#0A0A0F",
  aptosGreen: "#06D6A0",
  aptosCyan: "#00F5FF",
  purple: "#8B5CF6",
  text: "#FFFFFF",
  textMuted: "#5A5A6E",
};

export const ValidatorNetwork: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  // Validator count animation
  const validatorCount = Math.floor(interpolate(
    frame,
    [fps * 1, fps * 3],
    [0, 128],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  ));

  // Node positions (spread across screen like a globe)
  const nodes = React.useMemo(() => {
    return Array.from({ length: 30 }).map((_, i) => ({
      x: 100 + random(`x-${i}`) * (width - 200),
      y: 200 + random(`y-${i}`) * (height - 400),
      size: 6 + random(`size-${i}`) * 8,
      delay: fps * (0.5 + random(`delay-${i}`) * 2),
    }));
  }, [width, height, fps]);

  // Connection lines between nodes
  const connections = React.useMemo(() => {
    const conns: Array<{ from: number; to: number }> = [];
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const dist = Math.sqrt(
          Math.pow(nodes[i].x - nodes[j].x, 2) +
          Math.pow(nodes[i].y - nodes[j].y, 2)
        );
        if (dist < 300 && conns.length < 40) {
          conns.push({ from: i, to: j });
        }
      }
    }
    return conns;
  }, [nodes]);

  // Pulse animation
  const pulse = 0.7 + Math.sin(frame * 0.1) * 0.3;

  return (
    <AbsoluteFill style={{ background: COLORS.bg }}>
      {/* Background globe */}
      <div style={{
        position: "absolute",
        inset: 0,
        opacity: 0.25,
      }}>
        <Img
          src={staticFile("diagrams/validator-globe.png")}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      </div>

      {/* Title */}
      <div style={{
        position: "absolute",
        top: 50,
        left: 0,
        right: 0,
        textAlign: "center",
      }}>
        <div style={{
          fontFamily: "monospace",
          fontSize: 14,
          color: COLORS.aptosCyan,
          letterSpacing: "0.3em",
          marginBottom: 10,
        }}>
          GLOBAL DECENTRALIZATION
        </div>
        <div style={{
          fontFamily: "SF Pro Display, -apple-system, sans-serif",
          fontSize: 48,
          fontWeight: 900,
          color: COLORS.text,
        }}>
          VALIDATOR NETWORK
        </div>
      </div>

      {/* Connection lines */}
      <svg style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
        {connections.map((conn, i) => {
          const fromNode = nodes[conn.from];
          const toNode = nodes[conn.to];
          const progress = interpolate(
            frame,
            [Math.max(fromNode.delay, toNode.delay), Math.max(fromNode.delay, toNode.delay) + fps * 0.5],
            [0, 1],
            { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
          );

          return (
            <line
              key={i}
              x1={fromNode.x}
              y1={fromNode.y}
              x2={fromNode.x + (toNode.x - fromNode.x) * progress}
              y2={fromNode.y + (toNode.y - fromNode.y) * progress}
              stroke={COLORS.aptosCyan}
              strokeWidth={1}
              opacity={0.3 * pulse}
            />
          );
        })}
      </svg>

      {/* Validator nodes */}
      {nodes.map((node, i) => {
        const visible = frame > node.delay;
        const scale = visible
          ? spring({ frame: frame - node.delay, fps, config: { damping: 15, stiffness: 200 } })
          : 0;
        const nodePulse = visible ? 0.8 + Math.sin(frame * 0.15 + i) * 0.2 : 1;

        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: node.x - node.size / 2,
              top: node.y - node.size / 2,
              width: node.size,
              height: node.size,
              borderRadius: "50%",
              background: COLORS.aptosGreen,
              transform: `scale(${scale * nodePulse})`,
              boxShadow: `0 0 ${10 * nodePulse}px ${COLORS.aptosGreen}`,
            }}
          />
        );
      })}

      {/* Stats */}
      <div style={{
        position: "absolute",
        bottom: 80,
        left: 0,
        right: 0,
        display: "flex",
        justifyContent: "center",
        gap: 80,
      }}>
        <div style={{ textAlign: "center" }}>
          <div style={{
            fontFamily: "SF Pro Display",
            fontSize: 64,
            fontWeight: 900,
            color: COLORS.aptosGreen,
          }}>
            {validatorCount}+
          </div>
          <div style={{
            fontFamily: "monospace",
            fontSize: 14,
            color: COLORS.textMuted,
          }}>
            VALIDATORS
          </div>
        </div>

        <div style={{ textAlign: "center" }}>
          <div style={{
            fontFamily: "SF Pro Display",
            fontSize: 64,
            fontWeight: 900,
            color: COLORS.aptosCyan,
          }}>
            2/3
          </div>
          <div style={{
            fontFamily: "monospace",
            fontSize: 14,
            color: COLORS.textMuted,
          }}>
            THRESHOLD
          </div>
        </div>

        <div style={{ textAlign: "center" }}>
          <div style={{
            fontFamily: "SF Pro Display",
            fontSize: 64,
            fontWeight: 900,
            color: COLORS.purple,
          }}>
            99.99%
          </div>
          <div style={{
            fontFamily: "monospace",
            fontSize: 14,
            color: COLORS.textMuted,
          }}>
            UPTIME
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
