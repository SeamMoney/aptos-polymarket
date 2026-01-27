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
// BLOCK-STM - 20 second clip explaining parallel execution
// ============================================================================

const COLORS = {
  bg: "#0A0A0F",
  aptosGreen: "#06D6A0",
  aptosCyan: "#00F5FF",
  text: "#FFFFFF",
  textMuted: "#5A5A6E",
  lane1: "#FF6B6B",
  lane2: "#4ECDC4",
  lane3: "#FFE66D",
  lane4: "#95E1D3",
};

// Animated transaction moving through lane
const Transaction: React.FC<{
  laneY: number;
  color: string;
  delay: number;
  id: string;
}> = ({ laneY, color, delay, id }) => {
  const frame = useCurrentFrame();
  const { fps, width } = useVideoConfig();

  const progress = interpolate(
    frame,
    [delay, delay + fps * 2],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) }
  );

  const x = -50 + progress * (width + 100);
  const visible = frame >= delay;

  if (!visible) return null;

  return (
    <div style={{
      position: "absolute",
      left: x,
      top: laneY,
      width: 60,
      height: 30,
      background: `linear-gradient(90deg, ${color}80, ${color})`,
      borderRadius: 6,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: "monospace",
      fontSize: 10,
      color: "#000",
      fontWeight: 700,
      boxShadow: `0 0 15px ${color}80`,
    }}>
      TX-{id}
    </div>
  );
};

export const BlockSTM: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  // Phase progression
  const phase = frame < fps * 2 ? "intro"
    : frame < fps * 4 ? "sequential"
    : frame < fps * 6 ? "parallel"
    : "stats";

  // Title animation
  const titleOpacity = interpolate(frame, [0, fps * 0.5], [0, 1], {
    extrapolateRight: "clamp",
  });

  // Sequential vs Parallel comparison
  const sequentialActive = phase === "sequential" || phase === "intro";
  const parallelActive = phase === "parallel" || phase === "stats";

  // Stats reveal
  const statsScale = phase === "stats"
    ? spring({ frame: frame - fps * 6, fps, config: { damping: 12, stiffness: 100 } })
    : 0;

  const laneHeight = 50;
  const startY = 280;

  return (
    <AbsoluteFill style={{ background: COLORS.bg }}>
      {/* Background */}
      <div style={{
        position: "absolute",
        inset: 0,
        opacity: 0.15,
      }}>
        <Img
          src={staticFile("diagrams/block-stm-matrix.png")}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      </div>

      {/* Title */}
      <div style={{
        position: "absolute",
        top: 40,
        left: 0,
        right: 0,
        textAlign: "center",
        opacity: titleOpacity,
      }}>
        <div style={{
          fontFamily: "monospace",
          fontSize: 14,
          color: COLORS.aptosGreen,
          letterSpacing: "0.3em",
          marginBottom: 10,
        }}>
          APTOS INNOVATION
        </div>
        <div style={{
          fontFamily: "SF Pro Display, -apple-system, sans-serif",
          fontSize: 48,
          fontWeight: 900,
          color: COLORS.text,
        }}>
          BLOCK-STM
        </div>
        <div style={{
          fontFamily: "monospace",
          fontSize: 16,
          color: COLORS.textMuted,
          marginTop: 10,
        }}>
          Parallel Transaction Execution
        </div>
      </div>

      {/* Comparison labels */}
      <div style={{
        position: "absolute",
        top: 180,
        left: 60,
        right: 60,
        display: "flex",
        justifyContent: "space-between",
      }}>
        <div style={{
          fontFamily: "SF Pro Display",
          fontSize: 24,
          fontWeight: 700,
          color: sequentialActive ? COLORS.text : COLORS.textMuted,
          opacity: sequentialActive ? 1 : 0.5,
        }}>
          SEQUENTIAL (EVM)
        </div>
        <div style={{
          fontFamily: "SF Pro Display",
          fontSize: 24,
          fontWeight: 700,
          color: parallelActive ? COLORS.aptosGreen : COLORS.textMuted,
          opacity: parallelActive ? 1 : 0.5,
        }}>
          PARALLEL (APTOS)
        </div>
      </div>

      {/* Divider */}
      <div style={{
        position: "absolute",
        left: width / 2 - 1,
        top: 220,
        bottom: 150,
        width: 2,
        background: `linear-gradient(180deg, transparent, ${COLORS.textMuted}40, transparent)`,
      }} />

      {/* Sequential side - single lane */}
      <div style={{
        position: "absolute",
        left: 60,
        top: startY,
        width: width / 2 - 100,
        height: laneHeight,
        background: "#1a1a2e",
        borderRadius: 8,
        opacity: sequentialActive ? 1 : 0.3,
      }}>
        {/* Single transaction moving slowly */}
        {sequentialActive && (
          <Transaction
            laneY={10}
            color={COLORS.lane1}
            delay={fps * 2}
            id="1"
          />
        )}
      </div>

      {/* Parallel side - 4 lanes */}
      {[COLORS.lane1, COLORS.lane2, COLORS.lane3, COLORS.lane4].map((color, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: width / 2 + 40,
            top: startY + i * (laneHeight + 10),
            width: width / 2 - 100,
            height: laneHeight - 10,
            background: "#1a1a2e",
            borderRadius: 6,
            overflow: "hidden",
            opacity: parallelActive ? 1 : 0.3,
          }}
        >
          {parallelActive && (
            <Transaction
              laneY={5}
              color={color}
              delay={fps * 4 + i * 5}
              id={String(i + 1)}
            />
          )}
        </div>
      ))}

      {/* Lane labels */}
      {parallelActive && (
        <div style={{
          position: "absolute",
          right: 60,
          top: startY,
          fontFamily: "monospace",
          fontSize: 12,
          color: COLORS.textMuted,
        }}>
          4 PARALLEL THREADS
        </div>
      )}

      {/* Stats box */}
      {phase === "stats" && (
        <div style={{
          position: "absolute",
          bottom: 60,
          left: 0,
          right: 0,
          display: "flex",
          justifyContent: "center",
          gap: 60,
          transform: `scale(${statsScale})`,
        }}>
          <div style={{
            background: "#1a1a2e",
            border: `1px solid ${COLORS.textMuted}40`,
            borderRadius: 12,
            padding: "20px 40px",
            textAlign: "center",
          }}>
            <div style={{
              fontFamily: "SF Pro Display",
              fontSize: 36,
              fontWeight: 900,
              color: COLORS.textMuted,
            }}>
              ~1,000
            </div>
            <div style={{ fontFamily: "monospace", fontSize: 12, color: COLORS.textMuted }}>
              Sequential TPS
            </div>
          </div>

          <div style={{
            background: `linear-gradient(135deg, ${COLORS.aptosGreen}20, ${COLORS.aptosCyan}20)`,
            border: `2px solid ${COLORS.aptosGreen}`,
            borderRadius: 12,
            padding: "20px 40px",
            textAlign: "center",
          }}>
            <div style={{
              fontFamily: "SF Pro Display",
              fontSize: 36,
              fontWeight: 900,
              color: COLORS.aptosGreen,
            }}>
              160,000+
            </div>
            <div style={{ fontFamily: "monospace", fontSize: 12, color: COLORS.aptosGreen }}>
              Parallel TPS
            </div>
          </div>

          <div style={{
            background: "#1a1a2e",
            border: `1px solid ${COLORS.aptosCyan}40`,
            borderRadius: 12,
            padding: "20px 40px",
            textAlign: "center",
          }}>
            <div style={{
              fontFamily: "SF Pro Display",
              fontSize: 36,
              fontWeight: 900,
              color: COLORS.aptosCyan,
            }}>
              160x
            </div>
            <div style={{ fontFamily: "monospace", fontSize: 12, color: COLORS.aptosCyan }}>
              Faster
            </div>
          </div>
        </div>
      )}
    </AbsoluteFill>
  );
};
