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
// COMPLETE SETS - 20 second clip explaining prediction market mechanics
// ============================================================================

const COLORS = {
  bg: "#0A0A0F",
  aptosGreen: "#06D6A0",
  aptosCyan: "#00F5FF",
  yes: "#4ADE80",
  no: "#F87171",
  usd: "#FFD700",
  text: "#FFFFFF",
  textMuted: "#5A5A6E",
};

export const CompleteSets: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  // Animation phases
  const phase = frame < fps * 2 ? "intro"
    : frame < fps * 4 ? "mint"
    : frame < fps * 6 ? "trade"
    : "resolve";

  // USD coin position
  const usdY = interpolate(
    frame,
    [fps * 2, fps * 3],
    [0, 150],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.in(Easing.cubic) }
  );

  // Split animation
  const splitProgress = interpolate(
    frame,
    [fps * 3, fps * 4],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) }
  );

  // Token positions after split
  const yesX = width / 2 - 150 * splitProgress;
  const noX = width / 2 + 150 * splitProgress;

  // Winner highlight
  const showWinner = frame > fps * 6;
  const winnerGlow = showWinner ? 0.5 + Math.sin(frame * 0.2) * 0.5 : 0;

  return (
    <AbsoluteFill style={{ background: COLORS.bg }}>
      {/* Background */}
      <div style={{
        position: "absolute",
        inset: 0,
        opacity: 0.2,
      }}>
        <Img
          src={staticFile("diagrams/complete-sets.png")}
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
          PREDICTION MARKETS
        </div>
        <div style={{
          fontFamily: "SF Pro Display, -apple-system, sans-serif",
          fontSize: 48,
          fontWeight: 900,
          color: COLORS.text,
        }}>
          COMPLETE SETS
        </div>
      </div>

      {/* Animation area */}
      <div style={{
        position: "absolute",
        top: "35%",
        left: 0,
        right: 0,
        height: 300,
      }}>
        {/* USD Coin (before split) */}
        {phase !== "resolve" && (
          <div style={{
            position: "absolute",
            left: "50%",
            top: usdY,
            transform: "translate(-50%, -50%)",
            opacity: splitProgress < 1 ? 1 : 0,
          }}>
            <div style={{
              width: 100,
              height: 100,
              borderRadius: "50%",
              background: `linear-gradient(135deg, ${COLORS.usd}, #FFA500)`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: "SF Pro Display",
              fontSize: 32,
              fontWeight: 900,
              color: "#000",
              boxShadow: `0 0 30px ${COLORS.usd}60`,
            }}>
              $1
            </div>
            <div style={{
              textAlign: "center",
              marginTop: 10,
              fontFamily: "monospace",
              fontSize: 14,
              color: COLORS.usd,
            }}>
              USD1
            </div>
          </div>
        )}

        {/* Split indicator */}
        {phase === "mint" && splitProgress > 0 && splitProgress < 1 && (
          <div style={{
            position: "absolute",
            left: "50%",
            top: 150,
            transform: "translate(-50%, -50%)",
            fontFamily: "monospace",
            fontSize: 24,
            color: COLORS.aptosCyan,
          }}>
            MINTING...
          </div>
        )}

        {/* YES Token */}
        {splitProgress > 0 && (
          <div style={{
            position: "absolute",
            left: yesX,
            top: 200,
            transform: "translate(-50%, -50%)",
            opacity: splitProgress,
          }}>
            <div style={{
              width: 80,
              height: 80,
              borderRadius: "50%",
              background: `linear-gradient(135deg, ${COLORS.yes}, #22C55E)`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: "SF Pro Display",
              fontSize: 20,
              fontWeight: 900,
              color: "#000",
              boxShadow: showWinner ? `0 0 ${40 + winnerGlow * 40}px ${COLORS.yes}` : `0 0 20px ${COLORS.yes}60`,
              transform: showWinner ? `scale(${1 + winnerGlow * 0.1})` : "scale(1)",
            }}>
              YES
            </div>
            <div style={{
              textAlign: "center",
              marginTop: 10,
              fontFamily: "monospace",
              fontSize: 12,
              color: COLORS.yes,
            }}>
              {showWinner ? "WINNER! → $1" : "$0.60"}
            </div>
          </div>
        )}

        {/* NO Token */}
        {splitProgress > 0 && (
          <div style={{
            position: "absolute",
            left: noX,
            top: 200,
            transform: "translate(-50%, -50%)",
            opacity: splitProgress,
          }}>
            <div style={{
              width: 80,
              height: 80,
              borderRadius: "50%",
              background: showWinner
                ? `linear-gradient(135deg, #666, #444)`
                : `linear-gradient(135deg, ${COLORS.no}, #DC2626)`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: "SF Pro Display",
              fontSize: 20,
              fontWeight: 900,
              color: showWinner ? "#999" : "#000",
              boxShadow: showWinner ? "none" : `0 0 20px ${COLORS.no}60`,
              opacity: showWinner ? 0.5 : 1,
            }}>
              NO
            </div>
            <div style={{
              textAlign: "center",
              marginTop: 10,
              fontFamily: "monospace",
              fontSize: 12,
              color: showWinner ? COLORS.textMuted : COLORS.no,
            }}>
              {showWinner ? "→ $0" : "$0.40"}
            </div>
          </div>
        )}
      </div>

      {/* Explanation text */}
      <div style={{
        position: "absolute",
        bottom: 80,
        left: 0,
        right: 0,
        textAlign: "center",
      }}>
        {phase === "intro" && (
          <div style={{
            fontFamily: "monospace",
            fontSize: 18,
            color: COLORS.textMuted,
            opacity: interpolate(frame, [0, fps * 0.5], [0, 1], { extrapolateRight: "clamp" }),
          }}>
            1 USD1 can be minted into a complete set of outcome tokens
          </div>
        )}
        {phase === "mint" && (
          <div style={{
            fontFamily: "monospace",
            fontSize: 18,
            color: COLORS.aptosCyan,
          }}>
            1 USD1 = 1 YES + 1 NO (always)
          </div>
        )}
        {phase === "trade" && (
          <div style={{
            fontFamily: "monospace",
            fontSize: 18,
            color: COLORS.text,
          }}>
            Trade tokens based on your prediction • Prices sum to ~100%
          </div>
        )}
        {phase === "resolve" && (
          <div style={{
            fontFamily: "SF Pro Display",
            fontSize: 24,
            fontWeight: 700,
            color: COLORS.yes,
          }}>
            Winner redeems for $1 per token
          </div>
        )}
      </div>
    </AbsoluteFill>
  );
};
