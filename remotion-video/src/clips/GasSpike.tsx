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
// GAS SPIKE - 18 second clip showing the 47x gas explosion
// ============================================================================

const COLORS = {
  bg: "#0A0A0F",
  aptosGreen: "#06D6A0",
  danger: "#FF3B30",
  warning: "#FF9500",
  text: "#FFFFFF",
  textMuted: "#5A5A6E",
};

export const GasSpike: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  // Gas price animation - starts normal, then SPIKES
  const normalPrice = 50; // gwei
  const spikePrice = 2359; // actual peak
  const priceProgress = interpolate(
    frame,
    [fps * 1, fps * 2, fps * 2.5, fps * 4],
    [0, 0.1, 1, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );
  const currentPrice = normalPrice + (spikePrice - normalPrice) * priceProgress;

  // Explosion effect
  const exploding = frame > fps * 2 && frame < fps * 4;
  const explosionScale = exploding
    ? 1 + Math.sin((frame - fps * 2) * 0.3) * 0.1
    : 1;

  // Screen shake during spike
  const shakeX = exploding ? Math.sin(frame * 2) * 5 : 0;
  const shakeY = exploding ? Math.cos(frame * 2.5) * 3 : 0;

  // Comparison reveal
  const showComparison = frame > fps * 5;
  const comparisonOpacity = interpolate(frame, [fps * 5, fps * 6], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Price color
  const priceColor = priceProgress > 0.5 ? COLORS.danger : COLORS.warning;

  return (
    <AbsoluteFill style={{
      background: COLORS.bg,
      transform: `translate(${shakeX}px, ${shakeY}px)`,
    }}>
      {/* Background explosion image */}
      <div style={{
        position: "absolute",
        inset: 0,
        opacity: 0.3 + priceProgress * 0.4,
        transform: `scale(${explosionScale})`,
      }}>
        <Img
          src={staticFile("diagrams/24-gas-spike-47x-explosion.png")}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      </div>

      {/* Vignette */}
      <div style={{
        position: "absolute",
        inset: 0,
        background: `radial-gradient(ellipse at center, transparent 30%, ${COLORS.bg}90 100%)`,
      }} />

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
          color: COLORS.danger,
          letterSpacing: "0.3em",
          marginBottom: 10,
        }}>
          ELECTION NIGHT 2024
        </div>
        <div style={{
          fontFamily: "SF Pro Display, -apple-system, sans-serif",
          fontSize: 48,
          fontWeight: 900,
          color: COLORS.text,
        }}>
          THE GAS <span style={{ color: COLORS.danger }}>EXPLOSION</span>
        </div>
      </div>

      {/* Gas price display */}
      <div style={{
        position: "absolute",
        top: "40%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        textAlign: "center",
      }}>
        <div style={{
          fontFamily: "monospace",
          fontSize: 14,
          color: COLORS.textMuted,
          marginBottom: 10,
        }}>
          POLYGON GAS PRICE
        </div>
        <div style={{
          fontFamily: "SF Pro Display",
          fontSize: 120,
          fontWeight: 900,
          color: priceColor,
          textShadow: priceProgress > 0.5 ? `0 0 60px ${COLORS.danger}` : "none",
          transition: "color 0.3s",
        }}>
          {Math.floor(currentPrice).toLocaleString()}
        </div>
        <div style={{
          fontFamily: "monospace",
          fontSize: 24,
          color: priceColor,
        }}>
          GWEI
        </div>

        {/* 47x badge */}
        {priceProgress > 0.9 && (
          <div style={{
            marginTop: 30,
            display: "inline-block",
            background: COLORS.danger,
            borderRadius: 8,
            padding: "10px 30px",
            transform: `scale(${spring({ frame: frame - fps * 4, fps, config: { damping: 10, stiffness: 100 } })})`,
          }}>
            <span style={{
              fontFamily: "SF Pro Display",
              fontSize: 32,
              fontWeight: 900,
              color: COLORS.text,
            }}>
              47x SPIKE
            </span>
          </div>
        )}
      </div>

      {/* Comparison */}
      {showComparison && (
        <div style={{
          position: "absolute",
          bottom: 80,
          left: 0,
          right: 0,
          display: "flex",
          justifyContent: "center",
          gap: 80,
          opacity: comparisonOpacity,
        }}>
          <div style={{ textAlign: "center" }}>
            <div style={{
              fontFamily: "SF Pro Display",
              fontSize: 20,
              fontWeight: 700,
              color: COLORS.danger,
              marginBottom: 10,
            }}>
              POLYGON
            </div>
            <div style={{
              fontFamily: "SF Pro Display",
              fontSize: 36,
              fontWeight: 900,
              color: COLORS.danger,
            }}>
              $2.00+
            </div>
            <div style={{
              fontFamily: "monospace",
              fontSize: 12,
              color: COLORS.textMuted,
            }}>
              per transaction
            </div>
          </div>

          <div style={{
            width: 2,
            background: COLORS.textMuted,
            opacity: 0.3,
          }} />

          <div style={{ textAlign: "center" }}>
            <div style={{
              fontFamily: "SF Pro Display",
              fontSize: 20,
              fontWeight: 700,
              color: COLORS.aptosGreen,
              marginBottom: 10,
            }}>
              APTOS
            </div>
            <div style={{
              fontFamily: "SF Pro Display",
              fontSize: 36,
              fontWeight: 900,
              color: COLORS.aptosGreen,
            }}>
              {"<$0.01"}
            </div>
            <div style={{
              fontFamily: "monospace",
              fontSize: 12,
              color: COLORS.textMuted,
            }}>
              always stable
            </div>
          </div>
        </div>
      )}
    </AbsoluteFill>
  );
};
