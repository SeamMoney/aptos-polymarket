import React from "react";
import {
  AbsoluteFill,
  Img,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
  staticFile,
  Easing,
  Sequence,
} from "remotion";

// Version 3: "Cinematic Zoom" - Dramatic zoom through the app with particle effects
export const Version3CinematicZoom: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const colors = {
    purple: "#8B5CF6",
    blue: "#3B82F6",
    green: "#10B981",
    cyan: "#06B6D4",
    pink: "#EC4899",
  };

  // Scene phases (each 10 seconds at 30fps = 300 frames)
  const phase1End = fps * 10;  // Home screen
  const phase2End = fps * 20;  // Market detail
  const phase3End = fps * 30;  // Order book + trade

  // Zoom levels for each phase
  const getZoomForPhase = () => {
    if (frame < phase1End) {
      // Phase 1: Zoom from far to home screen
      return interpolate(frame, [0, phase1End], [0.3, 1], {
        easing: Easing.out(Easing.cubic),
      });
    } else if (frame < phase2End) {
      // Phase 2: Zoom into market detail
      return interpolate(frame, [phase1End, phase2End], [1, 2.5], {
        easing: Easing.inOut(Easing.cubic),
      });
    } else {
      // Phase 3: Zoom into order book
      return interpolate(frame, [phase2End, phase3End], [2.5, 6], {
        easing: Easing.inOut(Easing.cubic),
      });
    }
  };

  const zoom = getZoomForPhase();

  // Camera pan offset
  const panX = interpolate(
    frame,
    [0, phase1End, phase2End, phase3End],
    [0, 0, -200, -400],
    { easing: Easing.inOut(Easing.quad) }
  );

  const panY = interpolate(
    frame,
    [0, phase1End, phase2End, phase3End],
    [0, 0, -300, -600],
    { easing: Easing.inOut(Easing.quad) }
  );

  // Speed lines effect during zoom
  const speedLineOpacity = interpolate(
    frame,
    [phase1End - 20, phase1End, phase1End + 30, phase2End - 20, phase2End, phase2End + 30],
    [0, 0.8, 0, 0, 0.8, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  // Generate speed lines
  const speedLines = Array.from({ length: 40 }, (_, i) => ({
    angle: (i / 40) * 360,
    length: 200 + Math.random() * 300,
    width: 1 + Math.random() * 2,
    delay: Math.random() * 10,
  }));

  // Particle burst on transitions
  const showParticleBurst =
    (frame > phase1End - 10 && frame < phase1End + 20) ||
    (frame > phase2End - 10 && frame < phase2End + 20);

  const particles = Array.from({ length: 50 }, (_, i) => {
    const angle = (i / 50) * Math.PI * 2;
    const speed = 5 + Math.random() * 10;
    const burstFrame = frame < phase2End ? phase1End : phase2End;
    const progress = Math.max(0, frame - burstFrame) / 30;

    return {
      x: Math.cos(angle) * speed * progress * 100,
      y: Math.sin(angle) * speed * progress * 100,
      size: 3 + Math.random() * 4,
      opacity: Math.max(0, 1 - progress),
      color: [colors.purple, colors.cyan, colors.green, colors.pink][i % 4],
    };
  });

  // TPS counter
  const tpsValue = interpolate(
    frame,
    [phase2End, phase3End],
    [0, 30847],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  // Current screen image based on phase
  const getCurrentImage = () => {
    if (frame < phase1End) return "screenshots/polymarket-home-mobile.png";
    if (frame < phase2End) return "screenshots/market-detail-viewport.png";
    return "screenshots/market-orderbook.png";
  };

  // Text overlays for each phase
  const phaseText = frame < phase1End
    ? { title: "EXPLORE MARKETS", subtitle: "15 Live Prediction Markets" }
    : frame < phase2End
    ? { title: "DIVE DEEPER", subtitle: "Real-time Charts & Order Books" }
    : { title: "TRADE INSTANTLY", subtitle: "30,000+ TPS on Aptos" };

  const textOpacity = interpolate(
    frame % (fps * 10),
    [0, 30, fps * 10 - 60, fps * 10 - 30],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  return (
    <AbsoluteFill style={{ background: "#050508", overflow: "hidden" }}>
      {/* Deep space background */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `
            radial-gradient(circle at 30% 40%, ${colors.purple}15 0%, transparent 50%),
            radial-gradient(circle at 70% 60%, ${colors.cyan}10 0%, transparent 40%),
            radial-gradient(circle at 50% 50%, ${colors.blue}08 0%, transparent 60%)
          `,
        }}
      />

      {/* Star field */}
      {Array.from({ length: 100 }).map((_, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: `${(i * 17) % 100}%`,
            top: `${(i * 23) % 100}%`,
            width: 2,
            height: 2,
            borderRadius: "50%",
            backgroundColor: "#fff",
            opacity: 0.1 + (i % 5) * 0.1,
          }}
        />
      ))}

      {/* Speed lines during zoom */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          opacity: speedLineOpacity,
        }}
      >
        {speedLines.map((line, i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              width: line.length,
              height: line.width,
              background: `linear-gradient(90deg, transparent, ${colors.cyan}88, transparent)`,
              transform: `rotate(${line.angle}deg) translateX(100px)`,
              transformOrigin: "left center",
            }}
          />
        ))}
      </div>

      {/* Particle burst */}
      {showParticleBurst && (
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
          }}
        >
          {particles.map((p, i) => (
            <div
              key={i}
              style={{
                position: "absolute",
                width: p.size,
                height: p.size,
                borderRadius: "50%",
                backgroundColor: p.color,
                opacity: p.opacity,
                transform: `translate(${p.x}px, ${p.y}px)`,
                boxShadow: `0 0 ${p.size * 2}px ${p.color}`,
              }}
            />
          ))}
        </div>
      )}

      {/* Main content - zooming phone */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          transform: `translate(-50%, -50%) scale(${zoom}) translate(${panX}px, ${panY}px)`,
          transformOrigin: "center center",
        }}
      >
        {/* Phone frame */}
        <div
          style={{
            width: 390,
            height: 844,
            borderRadius: 50,
            background: "linear-gradient(145deg, #2a2a2a, #1a1a1a)",
            padding: 10,
            boxShadow: `
              0 0 ${100 / zoom}px rgba(0,0,0,0.8),
              0 0 ${200 / zoom}px ${colors.purple}33,
              inset 0 1px 0 rgba(255,255,255,0.1)
            `,
          }}
        >
          <div
            style={{
              width: "100%",
              height: "100%",
              borderRadius: 42,
              overflow: "hidden",
              backgroundColor: "#0d1117",
            }}
          >
            <Img
              src={staticFile(getCurrentImage())}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                objectPosition: "top",
              }}
            />
          </div>
        </div>
      </div>

      {/* Phase text overlay */}
      <div
        style={{
          position: "absolute",
          left: 80,
          bottom: 120,
          opacity: textOpacity,
        }}
      >
        <div
          style={{
            fontSize: 64,
            fontWeight: 900,
            color: "#fff",
            textShadow: `0 0 40px ${colors.purple}`,
            fontFamily: "system-ui",
            letterSpacing: -2,
          }}
        >
          {phaseText.title}
        </div>
        <div
          style={{
            fontSize: 28,
            color: colors.cyan,
            marginTop: 12,
            fontFamily: "'JetBrains Mono', monospace",
          }}
        >
          {phaseText.subtitle}
        </div>
      </div>

      {/* TPS counter (phase 3) */}
      {frame > phase2End && (
        <div
          style={{
            position: "absolute",
            right: 80,
            top: 80,
            textAlign: "right",
            opacity: interpolate(frame, [phase2End, phase2End + 30], [0, 1], { extrapolateRight: "clamp" }),
          }}
        >
          <div style={{ color: "#666", fontSize: 16, marginBottom: 8 }}>
            LIVE TPS
          </div>
          <div
            style={{
              fontSize: 72,
              fontWeight: 900,
              fontFamily: "'JetBrains Mono', monospace",
              background: `linear-gradient(90deg, ${colors.green}, ${colors.cyan})`,
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              textShadow: `0 0 60px ${colors.green}44`,
            }}
          >
            {Math.round(tpsValue).toLocaleString()}
          </div>
        </div>
      )}

      {/* Progress indicator */}
      <div
        style={{
          position: "absolute",
          bottom: 40,
          left: "50%",
          transform: "translateX(-50%)",
          display: "flex",
          gap: 12,
        }}
      >
        {[0, 1, 2].map((i) => {
          const isActive =
            (i === 0 && frame < phase1End) ||
            (i === 1 && frame >= phase1End && frame < phase2End) ||
            (i === 2 && frame >= phase2End);
          const isPast =
            (i === 0 && frame >= phase1End) ||
            (i === 1 && frame >= phase2End);

          return (
            <div
              key={i}
              style={{
                width: isActive ? 40 : 12,
                height: 12,
                borderRadius: 6,
                backgroundColor: isActive || isPast ? colors.purple : "rgba(255,255,255,0.2)",
                transition: "all 0.3s",
                boxShadow: isActive ? `0 0 20px ${colors.purple}` : "none",
              }}
            />
          );
        })}
      </div>

      {/* Corner branding */}
      <div
        style={{
          position: "absolute",
          top: 40,
          left: 80,
        }}
      >
        <div
          style={{
            fontSize: 32,
            fontWeight: 800,
            background: `linear-gradient(90deg, ${colors.purple}, ${colors.cyan})`,
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}
        >
          POLYMARKET
        </div>
        <div style={{ color: "#666", fontSize: 14, marginTop: 4 }}>
          Prediction Markets on Aptos
        </div>
      </div>
    </AbsoluteFill>
  );
};
