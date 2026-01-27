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
// SUB-SECOND FINALITY - 15 second clip comparing finality times
// ============================================================================

const COLORS = {
  bg: "#0A0A0F",
  aptosGreen: "#06D6A0",
  aptosCyan: "#00F5FF",
  text: "#FFFFFF",
  textMuted: "#5A5A6E",
  slow: "#FF6B6B",
  medium: "#FFE66D",
};

interface ClockProps {
  label: string;
  time: string;
  timeMs: number;
  color: string;
  x: number;
  delay: number;
  isAptos?: boolean;
}

const Clock: React.FC<ClockProps> = ({ label, time, timeMs, color, x, delay, isAptos }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const visible = frame > delay;
  const scale = visible
    ? spring({ frame: frame - delay, fps, config: { damping: 12, stiffness: 100 } })
    : 0;

  // Clock hand animation
  const handRotation = visible
    ? interpolate(frame - delay, [0, fps * 2], [0, 360 * (timeMs / 1000)], { extrapolateRight: "clamp" })
    : 0;

  const pulse = isAptos ? 0.9 + Math.sin(frame * 0.15) * 0.1 : 1;

  return (
    <div style={{
      position: "absolute",
      left: x,
      top: "40%",
      transform: `translate(-50%, -50%) scale(${scale * pulse})`,
      textAlign: "center",
    }}>
      {/* Clock face */}
      <div style={{
        width: 150,
        height: 150,
        borderRadius: "50%",
        background: `linear-gradient(135deg, ${color}20, ${color}10)`,
        border: `3px solid ${color}`,
        position: "relative",
        margin: "0 auto 20px",
        boxShadow: isAptos ? `0 0 40px ${color}60` : "none",
      }}>
        {/* Clock marks */}
        {[0, 90, 180, 270].map((angle) => (
          <div
            key={angle}
            style={{
              position: "absolute",
              width: 2,
              height: 10,
              background: color,
              top: angle === 0 ? 10 : angle === 180 ? "auto" : "50%",
              bottom: angle === 180 ? 10 : "auto",
              left: angle === 90 ? "auto" : angle === 270 ? 10 : "50%",
              right: angle === 90 ? 10 : "auto",
              transform: angle === 90 || angle === 270 ? "translateY(-50%) rotate(90deg)" : "translateX(-50%)",
            }}
          />
        ))}

        {/* Clock hand */}
        <div style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          width: 3,
          height: 50,
          background: color,
          borderRadius: 2,
          transformOrigin: "bottom center",
          transform: `translateX(-50%) rotate(${handRotation}deg)`,
        }} />

        {/* Center dot */}
        <div style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          width: 10,
          height: 10,
          borderRadius: "50%",
          background: color,
          transform: "translate(-50%, -50%)",
        }} />
      </div>

      {/* Label */}
      <div style={{
        fontFamily: "SF Pro Display",
        fontSize: 20,
        fontWeight: 700,
        color,
        marginBottom: 10,
      }}>
        {label}
      </div>

      {/* Time */}
      <div style={{
        fontFamily: "SF Pro Display",
        fontSize: isAptos ? 48 : 32,
        fontWeight: 900,
        color: COLORS.text,
      }}>
        {time}
      </div>
    </div>
  );
};

export const SubSecondFinality: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, width } = useVideoConfig();

  // Title animation
  const titleOpacity = interpolate(frame, [0, fps * 0.5], [0, 1], {
    extrapolateRight: "clamp",
  });

  // Winner highlight
  const showWinner = frame > fps * 4;

  return (
    <AbsoluteFill style={{ background: COLORS.bg }}>
      {/* Background */}
      <div style={{
        position: "absolute",
        inset: 0,
        opacity: 0.2,
      }}>
        <Img
          src={staticFile("diagrams/finality-speed.png")}
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
          fontFamily: "SF Pro Display, -apple-system, sans-serif",
          fontSize: 48,
          fontWeight: 900,
          color: COLORS.text,
        }}>
          FINALITY <span style={{ color: COLORS.aptosGreen }}>RACE</span>
        </div>
        <div style={{
          fontFamily: "monospace",
          fontSize: 16,
          color: COLORS.textMuted,
          marginTop: 10,
        }}>
          How long until your transaction is final?
        </div>
      </div>

      {/* Clocks */}
      <Clock
        label="ETHEREUM"
        time="12+ min"
        timeMs={720000}
        color={COLORS.slow}
        x={width * 0.2}
        delay={fps * 0.5}
      />
      <Clock
        label="POLYGON"
        time="2-5 sec"
        timeMs={3500}
        color={COLORS.medium}
        x={width * 0.5}
        delay={fps * 1}
      />
      <Clock
        label="APTOS"
        time="125ms"
        timeMs={125}
        color={COLORS.aptosGreen}
        x={width * 0.8}
        delay={fps * 1.5}
        isAptos
      />

      {/* Winner banner */}
      {showWinner && (
        <div style={{
          position: "absolute",
          bottom: 80,
          left: 0,
          right: 0,
          textAlign: "center",
          transform: `scale(${spring({ frame: frame - fps * 4, fps, config: { damping: 10, stiffness: 100 } })})`,
        }}>
          <div style={{
            display: "inline-block",
            background: `linear-gradient(135deg, ${COLORS.aptosGreen}20, ${COLORS.aptosCyan}20)`,
            border: `2px solid ${COLORS.aptosGreen}`,
            borderRadius: 12,
            padding: "15px 50px",
          }}>
            <div style={{
              fontFamily: "monospace",
              fontSize: 24,
              color: COLORS.aptosGreen,
            }}>
              SUB-SECOND FINALITY
            </div>
            <div style={{
              fontFamily: "SF Pro Display",
              fontSize: 18,
              color: COLORS.textMuted,
              marginTop: 5,
            }}>
              Your trade is final before you blink
            </div>
          </div>
        </div>
      )}
    </AbsoluteFill>
  );
};
