import React from "react";
import {
  AbsoluteFill,
  useVideoConfig,
  useCurrentFrame,
  spring,
  interpolate,
  Easing,
  Img,
  staticFile,
} from "remotion";

// ============================================================================
// RAPTR 4-HOP - 18 second clip showing the consensus mechanism
// ============================================================================

const COLORS = {
  bg: "#0A0A0F",
  aptosGreen: "#06D6A0",
  aptosCyan: "#00F5FF",
  purple: "#8B5CF6",
  gold: "#FFD700",
  text: "#FFFFFF",
  textMuted: "#5A5A6E",
};

interface HopProps {
  label: string;
  x: number;
  color: string;
  delay: number;
  index: number;
}

const Hop: React.FC<HopProps> = ({ label, x, color, delay, index }) => {
  const frame = useCurrentFrame();
  const { fps, height } = useVideoConfig();

  const visible = frame > delay;
  const scale = visible
    ? spring({ frame: frame - delay, fps, config: { damping: 10, stiffness: 120 } })
    : 0;

  // Pulse when active
  const isActive = frame > delay && frame < delay + fps * 2;
  const pulse = isActive ? 0.9 + Math.sin((frame - delay) * 0.2) * 0.1 : 1;

  // Connection line to next hop
  const showConnection = visible && index < 3;
  const connectionProgress = interpolate(
    frame,
    [delay + fps * 0.5, delay + fps * 1],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  return (
    <>
      {/* Portal/Ring */}
      <div style={{
        position: "absolute",
        left: x,
        top: height / 2,
        transform: `translate(-50%, -50%) scale(${scale * pulse})`,
        textAlign: "center",
      }}>
        {/* Outer ring */}
        <div style={{
          width: 120,
          height: 120,
          borderRadius: "50%",
          border: `4px solid ${color}`,
          position: "relative",
          boxShadow: isActive ? `0 0 40px ${color}, inset 0 0 30px ${color}40` : `0 0 15px ${color}60`,
          transition: "box-shadow 0.3s",
        }}>
          {/* Inner glow */}
          <div style={{
            position: "absolute",
            inset: 15,
            borderRadius: "50%",
            background: `radial-gradient(circle, ${color}40 0%, transparent 70%)`,
          }} />

          {/* Number */}
          <div style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: "SF Pro Display",
            fontSize: 32,
            fontWeight: 900,
            color: color,
          }}>
            {index + 1}
          </div>
        </div>

        {/* Label */}
        <div style={{
          marginTop: 20,
          fontFamily: "SF Pro Display",
          fontSize: 18,
          fontWeight: 700,
          color: color,
        }}>
          {label}
        </div>
      </div>

      {/* Connection arrow */}
      {showConnection && (
        <svg style={{
          position: "absolute",
          left: x + 60,
          top: height / 2 - 10,
          width: 140,
          height: 20,
          overflow: "visible",
        }}>
          <defs>
            <linearGradient id={`grad-${index}`} x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor={color} />
              <stop offset="100%" stopColor={COLORS.aptosGreen} />
            </linearGradient>
          </defs>
          <line
            x1="0"
            y1="10"
            x2={140 * connectionProgress}
            y2="10"
            stroke={`url(#grad-${index})`}
            strokeWidth="3"
            strokeLinecap="round"
          />
          {connectionProgress > 0.8 && (
            <polygon
              points={`${140 * connectionProgress},10 ${140 * connectionProgress - 10},5 ${140 * connectionProgress - 10},15`}
              fill={COLORS.aptosGreen}
            />
          )}
        </svg>
      )}
    </>
  );
};

export const Raptr4Hop: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, width } = useVideoConfig();

  // Title animation
  const titleOpacity = interpolate(frame, [0, fps * 0.5], [0, 1], {
    extrapolateRight: "clamp",
  });

  // Final stats
  const showStats = frame > fps * 5;

  const hops = [
    { label: "PROPOSE", color: COLORS.purple },
    { label: "VOTE", color: COLORS.aptosCyan },
    { label: "QUORUM", color: COLORS.gold },
    { label: "COMMIT", color: COLORS.aptosGreen },
  ];

  return (
    <AbsoluteFill style={{ background: COLORS.bg }}>
      {/* Background */}
      <div style={{
        position: "absolute",
        inset: 0,
        opacity: 0.25,
      }}>
        <Img
          src={staticFile("diagrams/25-raptr-4-hop-portals.png")}
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
        opacity: titleOpacity,
      }}>
        <div style={{
          fontFamily: "monospace",
          fontSize: 14,
          color: COLORS.aptosCyan,
          letterSpacing: "0.3em",
          marginBottom: 10,
        }}>
          APTOS CONSENSUS
        </div>
        <div style={{
          fontFamily: "SF Pro Display, -apple-system, sans-serif",
          fontSize: 48,
          fontWeight: 900,
          color: COLORS.text,
        }}>
          RAPTR <span style={{ color: COLORS.aptosGreen }}>4-HOP</span>
        </div>
      </div>

      {/* Hops */}
      {hops.map((hop, i) => (
        <Hop
          key={i}
          label={hop.label}
          x={width * (0.15 + i * 0.23)}
          color={hop.color}
          delay={fps * (0.8 + i * 0.8)}
          index={i}
        />
      ))}

      {/* Stats */}
      {showStats && (
        <div style={{
          position: "absolute",
          bottom: 60,
          left: 0,
          right: 0,
          display: "flex",
          justifyContent: "center",
          gap: 60,
          transform: `scale(${spring({ frame: frame - fps * 5, fps, config: { damping: 12, stiffness: 100 } })})`,
        }}>
          <div style={{
            background: "#1a1a2e",
            borderRadius: 12,
            padding: "15px 30px",
            textAlign: "center",
          }}>
            <div style={{
              fontFamily: "SF Pro Display",
              fontSize: 32,
              fontWeight: 900,
              color: COLORS.aptosGreen,
            }}>
              4 Hops
            </div>
            <div style={{ fontFamily: "monospace", fontSize: 12, color: COLORS.textMuted }}>
              Network Round-Trips
            </div>
          </div>

          <div style={{
            background: "#1a1a2e",
            borderRadius: 12,
            padding: "15px 30px",
            textAlign: "center",
          }}>
            <div style={{
              fontFamily: "SF Pro Display",
              fontSize: 32,
              fontWeight: 900,
              color: COLORS.aptosCyan,
            }}>
              ~180ms
            </div>
            <div style={{ fontFamily: "monospace", fontSize: 12, color: COLORS.textMuted }}>
              Total Latency
            </div>
          </div>

          <div style={{
            background: "#1a1a2e",
            borderRadius: 12,
            padding: "15px 30px",
            textAlign: "center",
          }}>
            <div style={{
              fontFamily: "SF Pro Display",
              fontSize: 32,
              fontWeight: 900,
              color: COLORS.gold,
            }}>
              O(n)
            </div>
            <div style={{ fontFamily: "monospace", fontSize: 12, color: COLORS.textMuted }}>
              vs PBFT O(n²)
            </div>
          </div>
        </div>
      )}
    </AbsoluteFill>
  );
};
