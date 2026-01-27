import React from "react";
import {
  AbsoluteFill,
  useVideoConfig,
  useCurrentFrame,
  spring,
  interpolate,
  Img,
  staticFile,
} from "remotion";

// ============================================================================
// OUTAGE TIMELINE - 18 second clip showing Polygon's failure history
// ============================================================================

const COLORS = {
  bg: "#0A0A0F",
  aptosGreen: "#06D6A0",
  danger: "#FF3B30",
  warning: "#FF9500",
  text: "#FFFFFF",
  textMuted: "#5A5A6E",
};

interface OutageProps {
  date: string;
  description: string;
  x: number;
  delay: number;
}

const Outage: React.FC<OutageProps> = ({ date, description, x, delay }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const visible = frame > delay;
  const scale = visible
    ? spring({ frame: frame - delay, fps, config: { damping: 10, stiffness: 150 } })
    : 0;

  // Pulse effect
  const pulse = visible ? 0.8 + Math.sin((frame - delay) * 0.15) * 0.2 : 1;

  return (
    <div style={{
      position: "absolute",
      left: x,
      top: "50%",
      transform: `translate(-50%, -50%) scale(${scale})`,
      textAlign: "center",
    }}>
      {/* Warning icon */}
      <div style={{
        width: 50,
        height: 50,
        borderRadius: "50%",
        background: COLORS.danger,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 24,
        margin: "0 auto 15px",
        boxShadow: `0 0 ${20 * pulse}px ${COLORS.danger}`,
        transform: `scale(${pulse})`,
      }}>
        ⚠️
      </div>

      {/* Date */}
      <div style={{
        fontFamily: "monospace",
        fontSize: 14,
        color: COLORS.danger,
        marginBottom: 5,
      }}>
        {date}
      </div>

      {/* Description */}
      <div style={{
        fontFamily: "SF Pro Display",
        fontSize: 12,
        color: COLORS.textMuted,
        maxWidth: 100,
      }}>
        {description}
      </div>
    </div>
  );
};

export const OutageTimeline: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, width } = useVideoConfig();

  const outages = [
    { date: "DEC 2024", description: "12+ hr trading halt" },
    { date: "MAR 2025", description: "Consensus failure" },
    { date: "JUL 2025", description: "RPC outage" },
    { date: "NOV 2025", description: "Validator crash" },
    { date: "DEC 2025", description: "Network degraded" },
    { date: "JAN 2026", description: "Gas spike crisis" },
  ];

  // Timeline progress
  const lineProgress = interpolate(frame, [fps * 0.5, fps * 4], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Aptos comparison
  const showAptos = frame > fps * 5;

  return (
    <AbsoluteFill style={{ background: COLORS.bg }}>
      {/* Background */}
      <div style={{
        position: "absolute",
        inset: 0,
        opacity: 0.15,
      }}>
        <Img
          src={staticFile("diagrams/polygon-outage-timeline.png")}
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
          fontFamily: "SF Pro Display, -apple-system, sans-serif",
          fontSize: 48,
          fontWeight: 900,
          color: COLORS.text,
        }}>
          POLYGON <span style={{ color: COLORS.danger }}>OUTAGES</span>
        </div>
        <div style={{
          fontFamily: "monospace",
          fontSize: 16,
          color: COLORS.textMuted,
          marginTop: 10,
        }}>
          12 months of infrastructure failures
        </div>
      </div>

      {/* Timeline line */}
      <div style={{
        position: "absolute",
        top: "50%",
        left: 60,
        right: 60,
        height: 4,
        background: COLORS.textMuted + "30",
        borderRadius: 2,
      }}>
        <div style={{
          width: `${lineProgress * 100}%`,
          height: "100%",
          background: `linear-gradient(90deg, ${COLORS.danger}, ${COLORS.warning})`,
          borderRadius: 2,
        }} />
      </div>

      {/* Outage markers */}
      {outages.map((outage, i) => (
        <Outage
          key={i}
          date={outage.date}
          description={outage.description}
          x={100 + (i / (outages.length - 1)) * (width - 200)}
          delay={fps * (0.8 + i * 0.4)}
        />
      ))}

      {/* Counter */}
      <div style={{
        position: "absolute",
        top: 150,
        right: 60,
        textAlign: "right",
      }}>
        <div style={{
          fontFamily: "SF Pro Display",
          fontSize: 72,
          fontWeight: 900,
          color: COLORS.danger,
        }}>
          6+
        </div>
        <div style={{
          fontFamily: "monospace",
          fontSize: 14,
          color: COLORS.textMuted,
        }}>
          MAJOR OUTAGES
        </div>
      </div>

      {/* Aptos comparison */}
      {showAptos && (
        <div style={{
          position: "absolute",
          bottom: 60,
          left: 0,
          right: 0,
          textAlign: "center",
          transform: `scale(${spring({ frame: frame - fps * 5, fps, config: { damping: 12, stiffness: 100 } })})`,
        }}>
          <div style={{
            display: "inline-block",
            background: `linear-gradient(135deg, ${COLORS.aptosGreen}20, ${COLORS.aptosGreen}10)`,
            border: `2px solid ${COLORS.aptosGreen}`,
            borderRadius: 12,
            padding: "15px 50px",
          }}>
            <div style={{
              fontFamily: "SF Pro Display",
              fontSize: 24,
              fontWeight: 900,
              color: COLORS.aptosGreen,
            }}>
              APTOS: ZERO OUTAGES
            </div>
            <div style={{
              fontFamily: "monospace",
              fontSize: 14,
              color: COLORS.textMuted,
              marginTop: 5,
            }}>
              99.99% uptime since mainnet launch
            </div>
          </div>
        </div>
      )}
    </AbsoluteFill>
  );
};
