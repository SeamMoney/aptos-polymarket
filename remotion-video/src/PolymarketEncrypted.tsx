import React, { useMemo } from "react";
import {
  AbsoluteFill,
  Sequence,
  useVideoConfig,
  useCurrentFrame,
  spring,
  interpolate,
  Easing,
  Img,
  staticFile,
  random,
} from "remotion";

// ============================================================================
// POLYMARKET x APTOS: THE ENCRYPTED MEMPOOL STORY
// ============================================================================
// Ties encrypted mempool directly to Polymarket's real problems
// Uses actual stats: $40M extracted, December 2024 outage, election night failure

// Color palette matching TheOutage for consistency
const COLORS = {
  // Aptos brand (success)
  aptosGreen: "#06D6A0",
  aptosCyan: "#00F5FF",
  aptosBlue: "#4F46E5",

  // Problem/failure
  danger: "#FF3B30",
  warning: "#FF9500",
  dead: "#3A3A3C",

  // Neutrals
  bgDeep: "#0A0A0F",
  bgSurface: "#12121A",
  bgCard: "#1A1A2E",
  text: "#FFFFFF",
  textMuted: "#5A5A6E",
  textDim: "#3A3A4E",

  // Polymarket brand
  polyPurple: "#8B5CF6",
  polyBlue: "#3B82F6",
};

// ============================================================================
// SCENE 1: THE EXTRACTION (0-7s) - $40M stolen from Polymarket traders
// ============================================================================
const Scene1_Extraction: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  // Counter animation
  const extractedAmount = interpolate(frame, [fps * 1.5, fps * 4], [0, 40000000], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });

  // Zoom on blackhole
  const zoom = interpolate(frame, [0, fps * 7], [1, 1.2], {
    extrapolateRight: "clamp",
  });

  // Vortex rotation
  const rotation = frame * 0.3;

  // Transaction fragments getting sucked in
  const fragments = useMemo(() => {
    return Array.from({ length: 15 }).map((_, i) => ({
      id: i,
      angle: (i / 15) * Math.PI * 2,
      startRadius: 400 + random(`rad-${i}`) * 200,
      speed: 0.5 + random(`speed-${i}`) * 0.5,
      size: 20 + random(`size-${i}`) * 30,
      label: ["$100K", "$50K", "$25K", "$10K", "$5K"][Math.floor(random(`label-${i}`) * 5)],
    }));
  }, []);

  return (
    <AbsoluteFill style={{ background: COLORS.bgDeep }}>
      {/* Background - MEV Blackhole */}
      <div style={{
        position: "absolute",
        inset: 0,
        transform: `scale(${zoom}) rotate(${rotation}deg)`,
        transformOrigin: "center center",
      }}>
        <Img
          src={staticFile("diagrams/mev-blackhole.png")}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
          }}
        />
      </div>

      {/* Overlay gradient */}
      <div style={{
        position: "absolute",
        inset: 0,
        background: `radial-gradient(ellipse at center, transparent 20%, ${COLORS.bgDeep}90 70%)`,
      }} />

      {/* Transaction fragments spiraling in */}
      {fragments.map((frag) => {
        const spiralProgress = (frame * frag.speed * 0.01) % 1;
        const radius = frag.startRadius * (1 - spiralProgress * 0.8);
        const angle = frag.angle + spiralProgress * Math.PI * 4;
        const x = width / 2 + Math.cos(angle) * radius;
        const y = height / 2 + Math.sin(angle) * radius;
        const opacity = 1 - spiralProgress;

        return (
          <div
            key={frag.id}
            style={{
              position: "absolute",
              left: x - frag.size / 2,
              top: y - frag.size / 2,
              width: frag.size,
              height: frag.size,
              background: `linear-gradient(135deg, ${COLORS.danger}80, ${COLORS.warning}80)`,
              borderRadius: 4,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: "monospace",
              fontSize: 8,
              color: COLORS.text,
              opacity,
              transform: `rotate(${angle * 57}deg)`,
            }}
          >
            {frag.label}
          </div>
        );
      })}

      {/* Title */}
      <div style={{
        position: "absolute",
        top: 60,
        left: 0,
        right: 0,
        textAlign: "center",
      }}>
        <div style={{
          fontFamily: "monospace",
          fontSize: 16,
          color: COLORS.danger,
          letterSpacing: "0.3em",
          marginBottom: 10,
          opacity: interpolate(frame, [fps * 0.3, fps * 1], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
        }}>
          POLYMARKET TRADERS ARE BEING HUNTED
        </div>
        <div style={{
          fontFamily: "SF Pro Display, -apple-system, sans-serif",
          fontSize: 64,
          fontWeight: 900,
          color: COLORS.text,
          opacity: interpolate(frame, [fps * 0.5, fps * 1.2], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
        }}>
          THE MEV BLACKHOLE
        </div>
      </div>

      {/* Extraction counter */}
      <div style={{
        position: "absolute",
        bottom: 100,
        left: 0,
        right: 0,
        textAlign: "center",
      }}>
        <div style={{
          fontFamily: "monospace",
          fontSize: 14,
          color: COLORS.textMuted,
          marginBottom: 10,
        }}>
          EXTRACTED FROM POLYMARKET (APR 2024 - APR 2025)
        </div>
        <div style={{
          fontFamily: "SF Pro Display, -apple-system, sans-serif",
          fontSize: 96,
          fontWeight: 900,
          color: COLORS.danger,
          textShadow: `0 0 60px ${COLORS.danger}80`,
        }}>
          ${Math.floor(extractedAmount).toLocaleString()}
        </div>
        <div style={{
          fontFamily: "monospace",
          fontSize: 16,
          color: COLORS.warning,
          marginTop: 10,
          opacity: interpolate(frame, [fps * 4.5, fps * 5.5], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
        }}>
          Source: IMDEA Networks Institute Research (86 million transactions analyzed)
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ============================================================================
// SCENE 2: THE VISIBILITY PROBLEM (7-14s) - Your orders are public
// ============================================================================
const Scene2_Visibility: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  // Pan effect
  const panX = interpolate(frame, [0, fps * 7], [30, -30], {
    extrapolateRight: "clamp",
  });

  // Scanning beam
  const scanX = (frame * 8) % (width + 200) - 100;

  // Bot eyes blinking
  const eyeBlink = Math.sin(frame * 0.2) > 0.95;

  return (
    <AbsoluteFill style={{ background: COLORS.bgDeep }}>
      {/* Background - Orderflow Visibility */}
      <div style={{
        position: "absolute",
        inset: 0,
        transform: `translateX(${panX}px)`,
      }}>
        <Img
          src={staticFile("diagrams/orderflow-visibility.png")}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
          }}
        />
      </div>

      {/* Scanning beam */}
      <div style={{
        position: "absolute",
        top: 0,
        bottom: 0,
        left: scanX,
        width: 4,
        background: `linear-gradient(180deg, transparent, ${COLORS.danger}, transparent)`,
        boxShadow: `0 0 40px ${COLORS.danger}, 0 0 80px ${COLORS.danger}50`,
      }} />

      {/* Overlay */}
      <div style={{
        position: "absolute",
        inset: 0,
        background: `linear-gradient(180deg, ${COLORS.bgDeep}80 0%, transparent 30%, transparent 70%, ${COLORS.bgDeep}90 100%)`,
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
          fontFamily: "SF Pro Display, -apple-system, sans-serif",
          fontSize: 56,
          fontWeight: 800,
          color: COLORS.text,
          opacity: interpolate(frame, [fps * 0.3, fps * 1], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
        }}>
          YOUR INTENT IS <span style={{ color: COLORS.danger }}>PUBLIC</span>
        </div>
      </div>

      {/* Explanation cards */}
      <div style={{
        position: "absolute",
        bottom: 80,
        left: 0,
        right: 0,
        display: "flex",
        justifyContent: "center",
        gap: 40,
      }}>
        {[
          { icon: "👁️", label: "VALIDATORS SEE", sublabel: "Your pending trades", delay: fps * 1 },
          { icon: "🤖", label: "MEV BOTS SEE", sublabel: "Your entry price", delay: fps * 2 },
          { icon: "🦈", label: "THEY ATTACK", sublabel: "Before you execute", delay: fps * 3 },
        ].map((item, i) => {
          const opacity = interpolate(frame, [item.delay, item.delay + fps * 0.5], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });
          const y = interpolate(frame, [item.delay, item.delay + fps * 0.5], [20, 0], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });

          return (
            <div
              key={i}
              style={{
                background: `${COLORS.bgCard}CC`,
                border: `1px solid ${COLORS.danger}40`,
                borderRadius: 12,
                padding: "20px 30px",
                textAlign: "center",
                opacity,
                transform: `translateY(${y}px)`,
              }}
            >
              <div style={{ fontSize: 36, marginBottom: 10 }}>{item.icon}</div>
              <div style={{
                fontFamily: "SF Pro Display, -apple-system, sans-serif",
                fontSize: 18,
                fontWeight: 700,
                color: COLORS.danger,
                marginBottom: 5,
              }}>
                {item.label}
              </div>
              <div style={{
                fontFamily: "monospace",
                fontSize: 12,
                color: COLORS.textMuted,
              }}>
                {item.sublabel}
              </div>
            </div>
          );
        })}
      </div>

      {/* Quote */}
      <div style={{
        position: "absolute",
        top: "40%",
        left: 60,
        maxWidth: 500,
        opacity: interpolate(frame, [fps * 4, fps * 5], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
      }}>
        <div style={{
          fontFamily: "Georgia, serif",
          fontSize: 24,
          fontStyle: "italic",
          color: COLORS.text,
          lineHeight: 1.6,
        }}>
          "The average DeFi trader pays 0.5-2% as an invisible MEV tax on top of legitimate fees."
        </div>
        <div style={{
          fontFamily: "monospace",
          fontSize: 12,
          color: COLORS.textMuted,
          marginTop: 15,
        }}>
          — Arkham Research
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ============================================================================
// SCENE 3: ELECTION NIGHT FAILURE (14-21s) - The December 2024 outage
// ============================================================================
const Scene3_ElectionFailure: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Glitch effect
  const glitchIntensity = frame > fps * 2 && frame < fps * 5
    ? Math.sin(frame * 0.5) * (Math.random() > 0.8 ? 10 : 0)
    : 0;

  // Stats reveal timing
  const stats = [
    { value: "12+", unit: "HRS", label: "DOWNTIME", delay: fps * 1.5 },
    { value: "86%", unit: "", label: "USERS AFFECTED", delay: fps * 2 },
    { value: "$50M+", unit: "", label: "CAPITAL BLOCKED", delay: fps * 2.5 },
    { value: "8%", unit: "", label: "OF POLYGON GAS", delay: fps * 3 },
  ];

  return (
    <AbsoluteFill style={{ background: COLORS.bgDeep }}>
      {/* Background - Election Night Failure */}
      <div style={{
        position: "absolute",
        inset: 0,
        transform: `translateX(${glitchIntensity}px)`,
        filter: glitchIntensity > 0 ? `hue-rotate(${glitchIntensity * 5}deg)` : "none",
      }}>
        <Img
          src={staticFile("diagrams/election-night-failure.png")}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
          }}
        />
      </div>

      {/* Scanlines */}
      <div style={{
        position: "absolute",
        inset: 0,
        backgroundImage: `repeating-linear-gradient(
          0deg,
          transparent,
          transparent 2px,
          rgba(0, 0, 0, 0.15) 2px,
          rgba(0, 0, 0, 0.15) 4px
        )`,
        pointerEvents: "none",
      }} />

      {/* Overlay for text readability */}
      <div style={{
        position: "absolute",
        inset: 0,
        background: `linear-gradient(135deg, ${COLORS.bgDeep}90 0%, transparent 50%, ${COLORS.bgDeep}80 100%)`,
      }} />

      {/* Title */}
      <div style={{
        position: "absolute",
        top: 60,
        left: 60,
      }}>
        <div style={{
          fontFamily: "monospace",
          fontSize: 14,
          color: COLORS.danger,
          letterSpacing: "0.2em",
          marginBottom: 10,
        }}>
          DECEMBER 2024
        </div>
        <div style={{
          fontFamily: "SF Pro Display, -apple-system, sans-serif",
          fontSize: 64,
          fontWeight: 900,
          color: COLORS.text,
          opacity: interpolate(frame, [fps * 0.3, fps * 1], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
        }}>
          POLYMARKET
          <br />
          <span style={{ color: COLORS.danger }}>WENT DARK</span>
        </div>
      </div>

      {/* Stats grid */}
      <div style={{
        position: "absolute",
        bottom: 80,
        left: 60,
        display: "grid",
        gridTemplateColumns: "repeat(4, 1fr)",
        gap: 30,
      }}>
        {stats.map((stat, i) => {
          const opacity = interpolate(frame, [stat.delay, stat.delay + fps * 0.4], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });
          const scale = spring({
            frame: Math.max(0, frame - stat.delay),
            fps,
            config: { damping: 12, stiffness: 100 },
          });

          return (
            <div
              key={i}
              style={{
                opacity,
                transform: `scale(${scale})`,
              }}
            >
              <div style={{
                fontFamily: "SF Pro Display, -apple-system, sans-serif",
                fontSize: 48,
                fontWeight: 900,
                color: COLORS.danger,
              }}>
                {stat.value}
                <span style={{ fontSize: 24, color: COLORS.textMuted }}>{stat.unit}</span>
              </div>
              <div style={{
                fontFamily: "monospace",
                fontSize: 12,
                color: COLORS.textMuted,
                marginTop: 5,
              }}>
                {stat.label}
              </div>
            </div>
          );
        })}
      </div>

      {/* Quote */}
      <div style={{
        position: "absolute",
        top: "50%",
        right: 60,
        maxWidth: 400,
        textAlign: "right",
        opacity: interpolate(frame, [fps * 4, fps * 5], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
      }}>
        <div style={{
          fontFamily: "Georgia, serif",
          fontSize: 22,
          fontStyle: "italic",
          color: COLORS.text,
          lineHeight: 1.6,
        }}>
          "Building our own L2 is #1 priority"
        </div>
        <div style={{
          fontFamily: "monospace",
          fontSize: 12,
          color: COLORS.warning,
          marginTop: 15,
        }}>
          — Polymarket Team Response
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ============================================================================
// SCENE 4: THE PIVOT (21-24s) - What if there was a better way?
// ============================================================================
const Scene4_Pivot: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  // Fade from black
  const opacity = interpolate(frame, [0, fps * 0.5], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Text reveal
  const line1Opacity = interpolate(frame, [fps * 0.5, fps * 1.2], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const line2Opacity = interpolate(frame, [fps * 1.5, fps * 2.2], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Pulsing glow
  const pulse = 0.5 + Math.sin(frame * 0.1) * 0.5;

  return (
    <AbsoluteFill style={{
      background: COLORS.bgDeep,
      opacity,
    }}>
      {/* Subtle gradient background */}
      <div style={{
        position: "absolute",
        inset: 0,
        background: `radial-gradient(ellipse at center, ${COLORS.aptosGreen}10 0%, transparent 50%)`,
        opacity: pulse,
      }} />

      {/* Question text */}
      <div style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
      }}>
        <div style={{
          fontFamily: "SF Pro Display, -apple-system, sans-serif",
          fontSize: 48,
          fontWeight: 500,
          color: COLORS.textMuted,
          marginBottom: 30,
          opacity: line1Opacity,
        }}>
          What if prediction markets
        </div>
        <div style={{
          fontFamily: "SF Pro Display, -apple-system, sans-serif",
          fontSize: 72,
          fontWeight: 900,
          background: `linear-gradient(135deg, ${COLORS.aptosGreen} 0%, ${COLORS.aptosCyan} 100%)`,
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          opacity: line2Opacity,
        }}>
          couldn't be exploited?
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ============================================================================
// SCENE 5: THE SOLUTION (24-32s) - Encrypted Mempool reveal
// ============================================================================
const Scene5_Solution: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  // Shield scale animation
  const shieldScale = spring({
    frame: Math.max(0, frame - fps * 0.5),
    fps,
    config: { damping: 12, stiffness: 80 },
  });

  // Particle ring
  const ringRotation = frame * 0.5;

  // Feature cards timing
  const features = [
    { icon: "🔐", title: "THRESHOLD ENCRYPTION", desc: "Transactions encrypted before broadcast", delay: fps * 2 },
    { icon: "👁️‍🗨️", title: "BLIND ORDERING", desc: "Validators order without seeing content", delay: fps * 3 },
    { icon: "🛡️", title: "MEV BLOCKED", desc: "No front-running, no sandwich attacks", delay: fps * 4 },
  ];

  return (
    <AbsoluteFill style={{ background: COLORS.bgDeep }}>
      {/* Background image */}
      <div style={{
        position: "absolute",
        inset: 0,
        opacity: 0.4,
      }}>
        <Img
          src={staticFile("diagrams/encrypted-mempool.png")}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
          }}
        />
      </div>

      {/* Radial glow */}
      <div style={{
        position: "absolute",
        inset: 0,
        background: `radial-gradient(ellipse at center, ${COLORS.aptosGreen}20 0%, transparent 50%)`,
      }} />

      {/* Title */}
      <div style={{
        position: "absolute",
        top: 60,
        left: 0,
        right: 0,
        textAlign: "center",
      }}>
        <div style={{
          fontFamily: "monospace",
          fontSize: 16,
          color: COLORS.aptosGreen,
          letterSpacing: "0.5em",
          marginBottom: 15,
          opacity: interpolate(frame, [fps * 0.3, fps * 0.8], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
        }}>
          APTOS INNOVATION
        </div>
        <div style={{
          fontFamily: "SF Pro Display, -apple-system, sans-serif",
          fontSize: 72,
          fontWeight: 900,
          background: `linear-gradient(135deg, ${COLORS.aptosGreen} 0%, ${COLORS.aptosCyan} 100%)`,
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          opacity: interpolate(frame, [fps * 0.5, fps * 1.2], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
        }}>
          ENCRYPTED MEMPOOL
        </div>
      </div>

      {/* Center shield with particles */}
      <div style={{
        position: "absolute",
        top: "50%",
        left: "50%",
        transform: `translate(-50%, -50%) scale(${shieldScale})`,
      }}>
        {/* Orbiting particles */}
        {Array.from({ length: 12 }).map((_, i) => {
          const angle = (i / 12) * Math.PI * 2 + (ringRotation * Math.PI) / 180;
          const radius = 180;
          const x = Math.cos(angle) * radius;
          const y = Math.sin(angle) * radius;

          return (
            <div
              key={i}
              style={{
                position: "absolute",
                left: "50%",
                top: "50%",
                width: 10,
                height: 10,
                borderRadius: "50%",
                background: i % 2 === 0 ? COLORS.aptosGreen : COLORS.aptosCyan,
                transform: `translate(${x - 5}px, ${y - 5}px)`,
                boxShadow: `0 0 15px ${i % 2 === 0 ? COLORS.aptosGreen : COLORS.aptosCyan}`,
              }}
            />
          );
        })}

        {/* Shield image */}
        <div style={{ width: 200, height: 200 }}>
          <Img
            src={staticFile("diagrams/encryption-shield.png")}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "contain",
            }}
          />
        </div>
      </div>

      {/* Feature cards */}
      <div style={{
        position: "absolute",
        bottom: 80,
        left: 0,
        right: 0,
        display: "flex",
        justifyContent: "center",
        gap: 40,
      }}>
        {features.map((feat, i) => {
          const opacity = interpolate(frame, [feat.delay, feat.delay + fps * 0.5], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });
          const y = interpolate(frame, [feat.delay, feat.delay + fps * 0.5], [30, 0], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });

          return (
            <div
              key={i}
              style={{
                background: `${COLORS.bgCard}CC`,
                border: `1px solid ${COLORS.aptosGreen}40`,
                borderRadius: 12,
                padding: "20px 30px",
                textAlign: "center",
                opacity,
                transform: `translateY(${y}px)`,
                minWidth: 250,
              }}
            >
              <div style={{ fontSize: 32, marginBottom: 10 }}>{feat.icon}</div>
              <div style={{
                fontFamily: "SF Pro Display, -apple-system, sans-serif",
                fontSize: 16,
                fontWeight: 700,
                color: COLORS.aptosGreen,
                marginBottom: 8,
              }}>
                {feat.title}
              </div>
              <div style={{
                fontFamily: "monospace",
                fontSize: 12,
                color: COLORS.textMuted,
              }}>
                {feat.desc}
              </div>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

// ============================================================================
// SCENE 6: HOW IT WORKS (32-40s) - Threshold decryption explained
// ============================================================================
const Scene6_HowItWorks: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  const centerX = width / 2;
  const centerY = height / 2;

  // Phase progression
  const phase = frame < fps * 2 ? 1
    : frame < fps * 4 ? 2
    : frame < fps * 6 ? 3
    : 4;

  // Validator count reveal
  const validatorCount = 7;
  const validatorsActive = Math.min(
    validatorCount,
    Math.floor(interpolate(frame, [fps * 2, fps * 5], [0, 5], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }))
  );

  const thresholdReached = validatorsActive >= 5;

  // Transaction state
  const txEncrypted = frame < fps * 5.5;

  return (
    <AbsoluteFill style={{ background: COLORS.bgDeep }}>
      {/* Background */}
      <div style={{
        position: "absolute",
        inset: 0,
        opacity: 0.25,
      }}>
        <Img
          src={staticFile("diagrams/threshold-decryption-assembly.png")}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            filter: "blur(3px)",
          }}
        />
      </div>

      {/* Phase indicator */}
      <div style={{
        position: "absolute",
        top: 40,
        left: 0,
        right: 0,
        display: "flex",
        justifyContent: "center",
        gap: 20,
      }}>
        {[
          { num: 1, label: "ENCRYPT" },
          { num: 2, label: "BROADCAST" },
          { num: 3, label: "CONSENSUS" },
          { num: 4, label: "DECRYPT" },
        ].map((p) => (
          <div
            key={p.num}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              opacity: phase >= p.num ? 1 : 0.3,
              transition: "opacity 0.3s",
            }}
          >
            <div style={{
              width: 32,
              height: 32,
              borderRadius: "50%",
              background: phase >= p.num ? COLORS.aptosGreen : COLORS.bgCard,
              border: `2px solid ${phase >= p.num ? COLORS.aptosGreen : COLORS.textDim}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: "SF Pro Display",
              fontSize: 14,
              fontWeight: 700,
              color: phase >= p.num ? COLORS.bgDeep : COLORS.textMuted,
            }}>
              {p.num}
            </div>
            <div style={{
              fontFamily: "monospace",
              fontSize: 12,
              color: phase >= p.num ? COLORS.aptosGreen : COLORS.textMuted,
            }}>
              {p.label}
            </div>
          </div>
        ))}
      </div>

      {/* Central transaction */}
      <div style={{
        position: "absolute",
        left: centerX - 60,
        top: centerY - 60,
        width: 120,
        height: 120,
        borderRadius: "50%",
        background: txEncrypted
          ? `linear-gradient(135deg, ${COLORS.aptosCyan}40, ${COLORS.aptosBlue}40)`
          : `linear-gradient(135deg, ${COLORS.aptosGreen}40, ${COLORS.aptosCyan}40)`,
        border: `3px solid ${txEncrypted ? COLORS.aptosCyan : COLORS.aptosGreen}`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        boxShadow: `0 0 40px ${txEncrypted ? COLORS.aptosCyan : COLORS.aptosGreen}60`,
        transition: "all 0.5s",
      }}>
        <div style={{
          fontFamily: "monospace",
          fontSize: txEncrypted ? 40 : 48,
          color: txEncrypted ? COLORS.aptosCyan : COLORS.aptosGreen,
        }}>
          {txEncrypted ? "🔐" : "🔓"}
        </div>
      </div>

      {/* Validator nodes */}
      {Array.from({ length: validatorCount }).map((_, i) => {
        const angle = (i / validatorCount) * Math.PI * 2 - Math.PI / 2;
        const radius = 250;
        const x = centerX + Math.cos(angle) * radius;
        const y = centerY + Math.sin(angle) * radius;
        const isActive = i < validatorsActive;

        return (
          <React.Fragment key={i}>
            {/* Connection line */}
            {isActive && (
              <svg style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
                <line
                  x1={x}
                  y1={y}
                  x2={centerX}
                  y2={centerY}
                  stroke={COLORS.aptosGreen}
                  strokeWidth={2}
                  opacity={0.6}
                  strokeDasharray="5,5"
                  style={{ strokeDashoffset: -frame * 2 }}
                />
              </svg>
            )}

            {/* Validator node */}
            <div style={{
              position: "absolute",
              left: x - 35,
              top: y - 35,
              width: 70,
              height: 70,
              borderRadius: "50%",
              background: isActive
                ? `linear-gradient(135deg, ${COLORS.aptosGreen}40, ${COLORS.aptosCyan}40)`
                : COLORS.bgCard,
              border: `2px solid ${isActive ? COLORS.aptosGreen : COLORS.textDim}`,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: isActive ? `0 0 20px ${COLORS.aptosGreen}40` : "none",
              transition: "all 0.3s",
            }}>
              <div style={{
                fontFamily: "monospace",
                fontSize: 10,
                color: isActive ? COLORS.aptosGreen : COLORS.textMuted,
              }}>
                V{i + 1}
              </div>
              {isActive && <div style={{ fontSize: 14 }}>🔑</div>}
            </div>
          </React.Fragment>
        );
      })}

      {/* Threshold indicator */}
      <div style={{
        position: "absolute",
        bottom: 80,
        left: 0,
        right: 0,
        textAlign: "center",
      }}>
        <div style={{
          fontFamily: "monospace",
          fontSize: 20,
          color: thresholdReached ? COLORS.aptosGreen : COLORS.textMuted,
        }}>
          {validatorsActive}/7 Key Shares
          {thresholdReached && (
            <span style={{ color: COLORS.aptosGreen, marginLeft: 20 }}>
              ✓ 2/3 THRESHOLD REACHED
            </span>
          )}
        </div>

        {/* Progress bar */}
        <div style={{
          width: 400,
          height: 8,
          background: COLORS.bgCard,
          borderRadius: 4,
          margin: "20px auto 0",
          overflow: "hidden",
        }}>
          <div style={{
            width: `${(validatorsActive / validatorCount) * 100}%`,
            height: "100%",
            background: thresholdReached
              ? `linear-gradient(90deg, ${COLORS.aptosGreen}, ${COLORS.aptosCyan})`
              : COLORS.aptosBlue,
            borderRadius: 4,
            transition: "width 0.3s, background 0.5s",
          }} />
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ============================================================================
// SCENE 7: THE COMPARISON (40-47s) - Aptos vs Polygon side by side
// ============================================================================
const Scene7_Comparison: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  // Split screen slide
  const dividerX = interpolate(frame, [0, fps * 1], [0, width / 2], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });

  // Stats animation
  const polygonTPS = 7;
  const aptosTPS = interpolate(frame, [fps * 2, fps * 4], [0, 30847], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const speedMultiplier = Math.floor(aptosTPS / polygonTPS);

  return (
    <AbsoluteFill style={{ background: COLORS.bgDeep }}>
      {/* Polygon side (left) */}
      <div style={{
        position: "absolute",
        left: 0,
        top: 0,
        width: width / 2,
        height: "100%",
        background: `linear-gradient(180deg, ${COLORS.danger}10 0%, ${COLORS.bgDeep} 100%)`,
        overflow: "hidden",
      }}>
        {/* Background image */}
        <div style={{
          position: "absolute",
          inset: 0,
          opacity: 0.2,
        }}>
          <Img
            src={staticFile("diagrams/polygon-outage-timeline.png")}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
            }}
          />
        </div>

        <div style={{
          position: "absolute",
          inset: 0,
          padding: 60,
          display: "flex",
          flexDirection: "column",
        }}>
          <div style={{
            fontFamily: "SF Pro Display, -apple-system, sans-serif",
            fontSize: 36,
            fontWeight: 800,
            color: COLORS.danger,
            marginBottom: 40,
          }}>
            POLYGON
          </div>

          {[
            { label: "MEMPOOL", value: "PUBLIC", bad: true },
            { label: "TPS", value: `${polygonTPS}`, bad: true },
            { label: "MEV PROTECTION", value: "NONE", bad: true },
            { label: "2024 OUTAGES", value: "6+", bad: true },
          ].map((stat, i) => (
            <div key={i} style={{ marginBottom: 30 }}>
              <div style={{
                fontFamily: "monospace",
                fontSize: 12,
                color: COLORS.textMuted,
                marginBottom: 5,
              }}>
                {stat.label}
              </div>
              <div style={{
                fontFamily: "SF Pro Display",
                fontSize: 32,
                fontWeight: 700,
                color: stat.bad ? COLORS.danger : COLORS.text,
              }}>
                {stat.value}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Aptos side (right) */}
      <div style={{
        position: "absolute",
        right: 0,
        top: 0,
        width: width / 2,
        height: "100%",
        background: `linear-gradient(180deg, ${COLORS.aptosGreen}10 0%, ${COLORS.bgDeep} 100%)`,
        overflow: "hidden",
      }}>
        {/* Background image */}
        <div style={{
          position: "absolute",
          inset: 0,
          opacity: 0.2,
        }}>
          <Img
            src={staticFile("diagrams/speed-race.png")}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
            }}
          />
        </div>

        <div style={{
          position: "absolute",
          inset: 0,
          padding: 60,
          display: "flex",
          flexDirection: "column",
        }}>
          <div style={{
            fontFamily: "SF Pro Display, -apple-system, sans-serif",
            fontSize: 36,
            fontWeight: 800,
            color: COLORS.aptosGreen,
            marginBottom: 40,
          }}>
            APTOS
          </div>

          {[
            { label: "MEMPOOL", value: "ENCRYPTED", good: true },
            { label: "TPS", value: Math.floor(aptosTPS).toLocaleString(), good: true },
            { label: "MEV PROTECTION", value: "NATIVE", good: true },
            { label: "UPTIME", value: "99.99%", good: true },
          ].map((stat, i) => (
            <div key={i} style={{ marginBottom: 30 }}>
              <div style={{
                fontFamily: "monospace",
                fontSize: 12,
                color: COLORS.textMuted,
                marginBottom: 5,
              }}>
                {stat.label}
              </div>
              <div style={{
                fontFamily: "SF Pro Display",
                fontSize: 32,
                fontWeight: 700,
                color: stat.good ? COLORS.aptosGreen : COLORS.text,
              }}>
                {stat.value}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Center divider with speed multiplier */}
      <div style={{
        position: "absolute",
        left: width / 2 - 2,
        top: 0,
        width: 4,
        height: "100%",
        background: `linear-gradient(180deg, ${COLORS.danger}, ${COLORS.warning}, ${COLORS.aptosGreen})`,
      }} />

      {/* Speed multiplier badge */}
      <div style={{
        position: "absolute",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        background: COLORS.bgDeep,
        border: `3px solid ${COLORS.aptosGreen}`,
        borderRadius: 16,
        padding: "20px 40px",
        opacity: interpolate(frame, [fps * 4.5, fps * 5.5], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
      }}>
        <div style={{
          fontFamily: "SF Pro Display",
          fontSize: 48,
          fontWeight: 900,
          color: COLORS.aptosGreen,
          textAlign: "center",
        }}>
          {speedMultiplier.toLocaleString()}x
        </div>
        <div style={{
          fontFamily: "monospace",
          fontSize: 14,
          color: COLORS.textMuted,
          textAlign: "center",
        }}>
          FASTER
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ============================================================================
// SCENE 8: THE FINALE (47-55s) - Polymarket on Aptos vision
// ============================================================================
const Scene8_Finale: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  // Stats counters
  const savedAmount = interpolate(frame, [fps * 1, fps * 3], [0, 40000000], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const mevBlocked = interpolate(frame, [fps * 1.5, fps * 3.5], [0, 100], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Feature list
  const features = [
    { icon: "🔐", label: "Threshold Encryption", delay: fps * 4 },
    { icon: "⚡", label: "Sub-Second Finality", delay: fps * 4.5 },
    { icon: "🛡️", label: "Native MEV Protection", delay: fps * 5 },
    { icon: "🌐", label: "First L1 Implementation", delay: fps * 5.5 },
  ];

  return (
    <AbsoluteFill style={{ background: COLORS.bgDeep }}>
      {/* Background gradient */}
      <div style={{
        position: "absolute",
        inset: 0,
        background: `radial-gradient(ellipse at 50% 30%, ${COLORS.aptosGreen}15 0%, transparent 50%),
                     radial-gradient(ellipse at 30% 70%, ${COLORS.polyPurple}10 0%, transparent 40%),
                     radial-gradient(ellipse at 70% 80%, ${COLORS.aptosCyan}10 0%, transparent 40%)`,
      }} />

      {/* Hero message */}
      <div style={{
        position: "absolute",
        top: "15%",
        left: 0,
        right: 0,
        textAlign: "center",
      }}>
        <div style={{
          fontFamily: "SF Pro Display, -apple-system, sans-serif",
          fontSize: 28,
          color: COLORS.textMuted,
          marginBottom: 20,
          letterSpacing: "0.2em",
          opacity: interpolate(frame, [fps * 0.3, fps * 1], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
        }}>
          PREDICTION MARKETS DESERVE
        </div>
        <div style={{
          fontFamily: "SF Pro Display, -apple-system, sans-serif",
          fontSize: 80,
          fontWeight: 900,
          background: `linear-gradient(135deg, ${COLORS.aptosGreen} 0%, ${COLORS.aptosCyan} 50%, ${COLORS.polyPurple} 100%)`,
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          opacity: interpolate(frame, [fps * 0.5, fps * 1.2], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
        }}>
          FAIR EXECUTION
        </div>
      </div>

      {/* Stats */}
      <div style={{
        position: "absolute",
        top: "45%",
        left: 0,
        right: 0,
        display: "flex",
        justifyContent: "center",
        gap: 120,
      }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 48, marginBottom: 15 }}>💰</div>
          <div style={{
            fontFamily: "SF Pro Display",
            fontSize: 56,
            fontWeight: 900,
            color: COLORS.aptosGreen,
            textShadow: `0 0 30px ${COLORS.aptosGreen}60`,
          }}>
            ${Math.floor(savedAmount).toLocaleString()}
          </div>
          <div style={{
            fontFamily: "monospace",
            fontSize: 14,
            color: COLORS.textMuted,
            marginTop: 10,
          }}>
            COULD BE SAVED ANNUALLY
          </div>
        </div>

        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 48, marginBottom: 15 }}>🛡️</div>
          <div style={{
            fontFamily: "SF Pro Display",
            fontSize: 56,
            fontWeight: 900,
            color: COLORS.aptosCyan,
            textShadow: `0 0 30px ${COLORS.aptosCyan}60`,
          }}>
            {Math.floor(mevBlocked)}%
          </div>
          <div style={{
            fontFamily: "monospace",
            fontSize: 14,
            color: COLORS.textMuted,
            marginTop: 10,
          }}>
            MEV ATTACKS BLOCKED
          </div>
        </div>
      </div>

      {/* Features */}
      <div style={{
        position: "absolute",
        bottom: 150,
        left: 0,
        right: 0,
        display: "flex",
        justifyContent: "center",
        gap: 60,
      }}>
        {features.map((feat, i) => {
          const opacity = interpolate(frame, [feat.delay, feat.delay + fps * 0.4], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });
          const y = interpolate(frame, [feat.delay, feat.delay + fps * 0.4], [15, 0], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });

          return (
            <div
              key={i}
              style={{
                textAlign: "center",
                opacity,
                transform: `translateY(${y}px)`,
              }}
            >
              <div style={{ fontSize: 36, marginBottom: 10 }}>{feat.icon}</div>
              <div style={{
                fontFamily: "monospace",
                fontSize: 12,
                color: COLORS.textMuted,
                maxWidth: 120,
              }}>
                {feat.label}
              </div>
            </div>
          );
        })}
      </div>

      {/* Aptos branding */}
      <div style={{
        position: "absolute",
        bottom: 50,
        left: 0,
        right: 0,
        textAlign: "center",
        opacity: interpolate(frame, [fps * 6, fps * 7], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
      }}>
        <div style={{
          fontFamily: "SF Pro Display",
          fontSize: 32,
          fontWeight: 700,
          color: COLORS.text,
          letterSpacing: "0.2em",
        }}>
          APTOS
        </div>
        <div style={{
          fontFamily: "monospace",
          fontSize: 14,
          color: COLORS.aptosGreen,
          marginTop: 8,
        }}>
          Move Fast. Stay Safe.
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ============================================================================
// MAIN COMPOSITION
// ============================================================================
export const PolymarketEncrypted: React.FC = () => {
  const { fps } = useVideoConfig();

  // Scene durations
  const scenes = {
    extraction: 7,      // 0-7s: $40M MEV blackhole
    visibility: 7,      // 7-14s: Your intent is public
    electionFail: 7,    // 14-21s: December 2024 outage
    pivot: 3,           // 21-24s: What if?
    solution: 8,        // 24-32s: Encrypted mempool reveal
    howItWorks: 8,      // 32-40s: Threshold decryption
    comparison: 7,      // 40-47s: Aptos vs Polygon
    finale: 8,          // 47-55s: Fair execution vision
  };

  let currentFrame = 0;

  return (
    <AbsoluteFill style={{ background: COLORS.bgDeep }}>
      <Sequence from={currentFrame} durationInFrames={fps * scenes.extraction}>
        <Scene1_Extraction />
      </Sequence>

      <Sequence from={(currentFrame += fps * scenes.extraction)} durationInFrames={fps * scenes.visibility}>
        <Scene2_Visibility />
      </Sequence>

      <Sequence from={(currentFrame += fps * scenes.visibility)} durationInFrames={fps * scenes.electionFail}>
        <Scene3_ElectionFailure />
      </Sequence>

      <Sequence from={(currentFrame += fps * scenes.electionFail)} durationInFrames={fps * scenes.pivot}>
        <Scene4_Pivot />
      </Sequence>

      <Sequence from={(currentFrame += fps * scenes.pivot)} durationInFrames={fps * scenes.solution}>
        <Scene5_Solution />
      </Sequence>

      <Sequence from={(currentFrame += fps * scenes.solution)} durationInFrames={fps * scenes.howItWorks}>
        <Scene6_HowItWorks />
      </Sequence>

      <Sequence from={(currentFrame += fps * scenes.howItWorks)} durationInFrames={fps * scenes.comparison}>
        <Scene7_Comparison />
      </Sequence>

      <Sequence from={(currentFrame += fps * scenes.comparison)} durationInFrames={fps * scenes.finale}>
        <Scene8_Finale />
      </Sequence>
    </AbsoluteFill>
  );
};
