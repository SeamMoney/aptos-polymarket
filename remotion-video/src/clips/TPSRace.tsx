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
// TPS RACE - 20 second clip showing Aptos speed dominance
// ============================================================================

const COLORS = {
  bg: "#0A0A0F",
  aptosGreen: "#06D6A0",
  aptosCyan: "#00F5FF",
  text: "#FFFFFF",
  textMuted: "#5A5A6E",
  ethereum: "#627EEA",
  polygon: "#8247E5",
  solana: "#14F195",
  danger: "#FF3B30",
};

interface RacerProps {
  name: string;
  tps: number;
  maxTps: number;
  color: string;
  y: number;
  delay: number;
}

const Racer: React.FC<RacerProps> = ({ name, tps, maxTps, color, y, delay }) => {
  const frame = useCurrentFrame();
  const { fps, width } = useVideoConfig();

  const progress = interpolate(
    frame,
    [delay, delay + fps * 3],
    [0, tps / maxTps],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) }
  );

  const barWidth = progress * (width - 400);
  const showTps = frame > delay + fps * 1;

  return (
    <div style={{ position: "absolute", left: 60, top: y, right: 60 }}>
      {/* Label */}
      <div style={{
        fontFamily: "SF Pro Display, -apple-system, sans-serif",
        fontSize: 24,
        fontWeight: 700,
        color: COLORS.text,
        marginBottom: 10,
        display: "flex",
        alignItems: "center",
        gap: 15,
      }}>
        <div style={{
          width: 12,
          height: 12,
          borderRadius: "50%",
          background: color,
          boxShadow: `0 0 10px ${color}`,
        }} />
        {name}
      </div>

      {/* Track */}
      <div style={{
        height: 40,
        background: "#1a1a2e",
        borderRadius: 8,
        overflow: "hidden",
        position: "relative",
      }}>
        {/* Progress bar */}
        <div style={{
          position: "absolute",
          left: 0,
          top: 0,
          bottom: 0,
          width: barWidth,
          background: `linear-gradient(90deg, ${color}80, ${color})`,
          borderRadius: 8,
          boxShadow: `0 0 20px ${color}60`,
        }} />

        {/* TPS label */}
        {showTps && (
          <div style={{
            position: "absolute",
            right: 15,
            top: "50%",
            transform: "translateY(-50%)",
            fontFamily: "monospace",
            fontSize: 18,
            fontWeight: 700,
            color: COLORS.text,
          }}>
            {Math.floor(tps * progress).toLocaleString()} TPS
          </div>
        )}
      </div>
    </div>
  );
};

export const TPSRace: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  // Title animation
  const titleOpacity = interpolate(frame, [0, fps * 0.5], [0, 1], {
    extrapolateRight: "clamp",
  });

  // Winner announcement
  const showWinner = frame > fps * 5;
  const winnerScale = showWinner
    ? spring({ frame: frame - fps * 5, fps, config: { damping: 10, stiffness: 100 } })
    : 0;

  // Background pulse
  const pulse = 0.3 + Math.sin(frame * 0.05) * 0.1;

  return (
    <AbsoluteFill style={{ background: COLORS.bg }}>
      {/* Background image */}
      <div style={{
        position: "absolute",
        inset: 0,
        opacity: 0.2,
      }}>
        <Img
          src={staticFile("diagrams/tps-race.png")}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      </div>

      {/* Radial glow */}
      <div style={{
        position: "absolute",
        inset: 0,
        background: `radial-gradient(ellipse at 80% 20%, ${COLORS.aptosGreen}${Math.floor(pulse * 255).toString(16).padStart(2, "0")} 0%, transparent 50%)`,
      }} />

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
          BLOCKCHAIN SPEED TEST
        </div>
        <div style={{
          fontFamily: "SF Pro Display, -apple-system, sans-serif",
          fontSize: 56,
          fontWeight: 900,
          color: COLORS.text,
        }}>
          THE TPS RACE
        </div>
      </div>

      {/* Racers */}
      <Racer name="Ethereum" tps={15} maxTps={35000} color={COLORS.ethereum} y={220} delay={fps * 1} />
      <Racer name="Polygon" tps={65} maxTps={35000} color={COLORS.polygon} y={320} delay={fps * 1.2} />
      <Racer name="Solana" tps={4000} maxTps={35000} color={COLORS.solana} y={420} delay={fps * 1.4} />
      <Racer name="APTOS" tps={30847} maxTps={35000} color={COLORS.aptosGreen} y={520} delay={fps * 1.6} />

      {/* Winner announcement */}
      {showWinner && (
        <div style={{
          position: "absolute",
          bottom: 80,
          left: 0,
          right: 0,
          textAlign: "center",
          transform: `scale(${winnerScale})`,
        }}>
          <div style={{
            display: "inline-block",
            background: `linear-gradient(135deg, ${COLORS.aptosGreen}20, ${COLORS.aptosCyan}20)`,
            border: `2px solid ${COLORS.aptosGreen}`,
            borderRadius: 16,
            padding: "20px 60px",
          }}>
            <div style={{
              fontFamily: "SF Pro Display",
              fontSize: 32,
              fontWeight: 900,
              color: COLORS.aptosGreen,
            }}>
              APTOS WINS
            </div>
            <div style={{
              fontFamily: "monospace",
              fontSize: 48,
              fontWeight: 900,
              color: COLORS.text,
              marginTop: 10,
            }}>
              4,407x FASTER
            </div>
            <div style={{
              fontFamily: "monospace",
              fontSize: 14,
              color: COLORS.textMuted,
              marginTop: 5,
            }}>
              than Ethereum
            </div>
          </div>
        </div>
      )}
    </AbsoluteFill>
  );
};
