import React from "react";
import { AbsoluteFill, Sequence, useVideoConfig, useCurrentFrame } from "remotion";
import { EncryptedMempoolAnimation } from "./components/EncryptedMempoolAnimation";
import { fonts } from "./styles/theme";

// Full encrypted mempool video - 20 seconds
export const EncryptedMempool: React.FC = () => {
  const { fps } = useVideoConfig();

  return (
    <AbsoluteFill style={{ background: "#000" }}>
      {/* Intro title (0-2s) */}
      <Sequence from={0} durationInFrames={fps * 2}>
        <IntroTitle />
      </Sequence>

      {/* Main animation (2-18s) */}
      <Sequence from={fps * 2} durationInFrames={fps * 16}>
        <EncryptedMempoolAnimation startFrame={0} cycleDuration={fps * 16} />
      </Sequence>

      {/* Outro (18-20s) */}
      <Sequence from={fps * 18} durationInFrames={fps * 2}>
        <OutroSlide />
      </Sequence>
    </AbsoluteFill>
  );
};

const IntroTitle: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const opacity = frame < fps * 0.3
    ? frame / (fps * 0.3)
    : frame > fps * 1.5
      ? 1 - (frame - fps * 1.5) / (fps * 0.5)
      : 1;

  return (
    <AbsoluteFill
      style={{
        background: "#000",
        justifyContent: "center",
        alignItems: "center",
        opacity,
      }}
    >
      <div style={{ textAlign: "center" }}>
        <div
          style={{
            fontFamily: "monospace",
            fontSize: 18,
            color: "#00d9a5",
            letterSpacing: "0.3em",
            marginBottom: 20,
          }}
        >
          APTOS INNOVATION
        </div>
        <div
          style={{
            fontFamily: fonts.display,
            fontSize: 72,
            fontWeight: 800,
            background: "linear-gradient(135deg, #00d9a5 0%, #8b5cf6 50%, #00d4ff 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            marginBottom: 20,
          }}
        >
          ENCRYPTED MEMPOOL
        </div>
        <div
          style={{
            fontFamily: "monospace",
            fontSize: 20,
            color: "#888",
          }}
        >
          Native MEV Protection at the Protocol Level
        </div>
      </div>
    </AbsoluteFill>
  );
};

const OutroSlide: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const opacity = frame < fps * 0.5 ? frame / (fps * 0.5) : 1;

  return (
    <AbsoluteFill
      style={{
        background: "#000",
        justifyContent: "center",
        alignItems: "center",
        opacity,
      }}
    >
      <div style={{ textAlign: "center" }}>
        <div
          style={{
            fontFamily: fonts.display,
            fontSize: 48,
            fontWeight: 700,
            color: "#00d9a5",
            marginBottom: 30,
          }}
        >
          FIRST L1 WITH NATIVE ENCRYPTION
        </div>
        <div
          style={{
            display: "flex",
            gap: 60,
            justifyContent: "center",
          }}
        >
          {[
            { icon: "🔐", label: "Batched Threshold Encryption" },
            { icon: "⚡", label: "No Performance Penalty" },
            { icon: "🛡️", label: "MEV Protection" },
          ].map((item, i) => (
            <div
              key={i}
              style={{
                textAlign: "center",
              }}
            >
              <div style={{ fontSize: 48, marginBottom: 12 }}>{item.icon}</div>
              <div
                style={{
                  fontFamily: "monospace",
                  fontSize: 14,
                  color: "#888",
                }}
              >
                {item.label}
              </div>
            </div>
          ))}
        </div>
      </div>
    </AbsoluteFill>
  );
};
