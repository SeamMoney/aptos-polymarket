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
// ULTRA ENCRYPTED MEMPOOL - Production Quality Motion Graphics
// ============================================================================
// Combines cinematic backgrounds with real animated elements
// Inspired by Apple product videos, viral crypto explainers, and motion design trends

const COLORS = {
  bg: "#000000",
  encrypted: "#00d4ff",
  protected: "#00ffaa",
  success: "#00ff88",
  danger: "#ff3b30",
  warning: "#ff9500",
  purple: "#8b5cf6",
  gold: "#ffd700",
  text: "#ffffff",
  textMuted: "#888888",
  textDim: "#444444",
};

// ============================================================================
// SCENE 1: THE DARK FOREST (0-6s) - Establish the danger
// ============================================================================
const Scene1_DarkForest: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  // Slow zoom on control room
  const zoom = interpolate(frame, [0, fps * 6], [1, 1.15], {
    extrapolateRight: "clamp",
  });

  // Dramatic vignette intensifies
  const vignetteIntensity = interpolate(frame, [0, fps * 3], [0.3, 0.7], {
    extrapolateRight: "clamp",
  });

  // Text reveal timing
  const titleOpacity = interpolate(frame, [fps * 0.5, fps * 1.5], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const subtitleOpacity = interpolate(frame, [fps * 2, fps * 3], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Scanning beam
  const scanY = (frame * 4) % (height + 100);

  // Glitch effect on text
  const glitchOffset = frame > fps * 4 ? Math.sin(frame * 0.5) * (Math.random() > 0.9 ? 5 : 0) : 0;

  return (
    <AbsoluteFill>
      {/* Background Image - Control Room */}
      <div style={{
        position: "absolute",
        inset: 0,
        transform: `scale(${zoom})`,
        transition: "transform 0.1s",
      }}>
        <Img
          src={staticFile("diagrams/01-mempool-scanner-control-room.png")}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
          }}
        />
      </div>

      {/* Scanning beam overlay */}
      <div style={{
        position: "absolute",
        left: 0,
        right: 0,
        top: scanY,
        height: 3,
        background: `linear-gradient(90deg, transparent, ${COLORS.danger}80, transparent)`,
        boxShadow: `0 0 30px ${COLORS.danger}, 0 0 60px ${COLORS.danger}50`,
        opacity: 0.8,
      }} />

      {/* Vignette */}
      <div style={{
        position: "absolute",
        inset: 0,
        background: `radial-gradient(ellipse at center, transparent 30%, rgba(0,0,0,${vignetteIntensity}) 100%)`,
      }} />

      {/* Scanlines */}
      <div style={{
        position: "absolute",
        inset: 0,
        backgroundImage: `repeating-linear-gradient(
          0deg,
          transparent,
          transparent 2px,
          rgba(0, 0, 0, 0.1) 2px,
          rgba(0, 0, 0, 0.1) 4px
        )`,
        pointerEvents: "none",
      }} />

      {/* Title text */}
      <div style={{
        position: "absolute",
        top: "15%",
        left: 0,
        right: 0,
        textAlign: "center",
        opacity: titleOpacity,
        transform: `translateX(${glitchOffset}px)`,
      }}>
        <div style={{
          fontFamily: "monospace",
          fontSize: 18,
          color: COLORS.danger,
          letterSpacing: "0.5em",
          marginBottom: 20,
          textShadow: `0 0 10px ${COLORS.danger}`,
        }}>
          ⚠ WARNING ⚠
        </div>
        <div style={{
          fontFamily: "SF Pro Display, -apple-system, sans-serif",
          fontSize: 72,
          fontWeight: 800,
          color: COLORS.text,
          textShadow: `0 0 40px ${COLORS.danger}80`,
        }}>
          THE DARK FOREST
        </div>
      </div>

      {/* Subtitle */}
      <div style={{
        position: "absolute",
        bottom: "20%",
        left: 0,
        right: 0,
        textAlign: "center",
        opacity: subtitleOpacity,
      }}>
        <div style={{
          fontFamily: "monospace",
          fontSize: 24,
          color: COLORS.textMuted,
          maxWidth: 800,
          margin: "0 auto",
          lineHeight: 1.6,
        }}>
          In the mempool, predators watch your every move.
          <br />
          <span style={{ color: COLORS.danger }}>$847M</span> extracted from users in 2024.
        </div>
      </div>

      {/* Floating threat indicators */}
      {Array.from({ length: 8 }).map((_, i) => {
        const angle = (i / 8) * Math.PI * 2 + frame * 0.01;
        const radius = 300 + Math.sin(frame * 0.05 + i) * 50;
        const x = width / 2 + Math.cos(angle) * radius;
        const y = height / 2 + Math.sin(angle) * radius;
        const pulse = 0.5 + Math.sin(frame * 0.1 + i) * 0.5;

        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: x - 8,
              top: y - 8,
              width: 16,
              height: 16,
              borderRadius: "50%",
              background: COLORS.danger,
              opacity: pulse * 0.6,
              boxShadow: `0 0 20px ${COLORS.danger}, 0 0 40px ${COLORS.danger}50`,
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};

// ============================================================================
// SCENE 2: THE PREDATORS (6-12s) - Show MEV bots hunting
// ============================================================================
const Scene2_Predators: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  // Ken Burns on shark image
  const zoom = interpolate(frame, [0, fps * 6], [1.1, 1], {
    extrapolateRight: "clamp",
  });
  const panX = interpolate(frame, [0, fps * 6], [-50, 0], {
    extrapolateRight: "clamp",
  });

  // Transaction packets flying
  const packets = useMemo(() => {
    return Array.from({ length: 12 }).map((_, i) => ({
      id: i,
      startX: -100,
      startY: 200 + (i % 4) * 150,
      speed: 3 + random(`speed-${i}`) * 2,
      size: 20 + random(`size-${i}`) * 15,
      delay: i * 8,
      intercepted: i % 3 === 0,
      color: COLORS.encrypted,
    }));
  }, []);

  // Shark/bot pulse
  const botPulse = 0.8 + Math.sin(frame * 0.15) * 0.2;

  return (
    <AbsoluteFill>
      {/* Background - MEV Predators */}
      <div style={{
        position: "absolute",
        inset: 0,
        transform: `scale(${zoom}) translateX(${panX}px)`,
      }}>
        <Img
          src={staticFile("diagrams/mev-predators-hunting.png")}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
          }}
        />
      </div>

      {/* Overlay gradient for text readability */}
      <div style={{
        position: "absolute",
        inset: 0,
        background: "linear-gradient(180deg, rgba(0,0,0,0.7) 0%, transparent 40%, transparent 60%, rgba(0,0,0,0.8) 100%)",
      }} />

      {/* Transaction packets */}
      {packets.map((packet) => {
        const packetFrame = frame - packet.delay;
        if (packetFrame < 0) return null;

        const progress = (packetFrame * packet.speed) / width;
        if (progress > 1.2) return null;

        const x = packet.startX + progress * (width + 200);
        const y = packet.startY + Math.sin(progress * Math.PI * 2) * 30;

        // Intercept animation
        const isBeingIntercepted = packet.intercepted && progress > 0.4 && progress < 0.7;
        const interceptProgress = packet.intercepted
          ? interpolate(progress, [0.4, 0.6], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
          : 0;

        const color = isBeingIntercepted
          ? interpolate(interceptProgress, [0, 1], [0, 1]) > 0.5 ? COLORS.danger : packet.color
          : packet.color;

        // Trail
        const trail = Array.from({ length: 6 }).map((_, ti) => ({
          x: x - ti * 15,
          y: y + Math.sin((progress - ti * 0.02) * Math.PI * 2) * 30,
          opacity: (1 - ti / 6) * 0.4,
          size: packet.size * (1 - ti / 8),
        }));

        return (
          <React.Fragment key={packet.id}>
            {/* Trail */}
            {trail.map((t, ti) => (
              <div
                key={ti}
                style={{
                  position: "absolute",
                  left: t.x - t.size / 2,
                  top: t.y - t.size / 2,
                  width: t.size,
                  height: t.size,
                  borderRadius: "50%",
                  background: color,
                  opacity: t.opacity,
                }}
              />
            ))}

            {/* Main packet */}
            <div style={{
              position: "absolute",
              left: x - packet.size / 2,
              top: y - packet.size / 2,
              width: packet.size,
              height: packet.size,
              borderRadius: "50%",
              background: color,
              boxShadow: `0 0 20px ${color}, 0 0 40px ${color}80`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 10,
              fontFamily: "monospace",
              color: "#000",
              fontWeight: "bold",
            }}>
              TX
            </div>

            {/* Intercept warning */}
            {isBeingIntercepted && (
              <div style={{
                position: "absolute",
                left: x - 50,
                top: y - 40,
                fontFamily: "monospace",
                fontSize: 12,
                color: COLORS.danger,
                textShadow: `0 0 10px ${COLORS.danger}`,
                opacity: Math.sin(frame * 0.3) > 0 ? 1 : 0,
              }}>
                ⚠ INTERCEPTED
              </div>
            )}
          </React.Fragment>
        );
      })}

      {/* MEV Bot indicator */}
      <div style={{
        position: "absolute",
        right: 100,
        top: "50%",
        transform: `translateY(-50%) scale(${botPulse})`,
      }}>
        <div style={{
          width: 80,
          height: 80,
          borderRadius: "50%",
          border: `3px solid ${COLORS.danger}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: `0 0 30px ${COLORS.danger}, inset 0 0 30px ${COLORS.danger}40`,
        }}>
          <div style={{
            fontFamily: "monospace",
            fontSize: 12,
            color: COLORS.danger,
            textAlign: "center",
          }}>
            MEV
            <br />
            BOT
          </div>
        </div>

        {/* Scanning cone */}
        <svg
          style={{
            position: "absolute",
            left: -200,
            top: -60,
            width: 200,
            height: 200,
            opacity: 0.3,
          }}
        >
          <defs>
            <linearGradient id="scanGrad" x1="100%" y1="50%" x2="0%" y2="50%">
              <stop offset="0%" stopColor={COLORS.danger} stopOpacity="0.8" />
              <stop offset="100%" stopColor={COLORS.danger} stopOpacity="0" />
            </linearGradient>
          </defs>
          <polygon
            points="200,100 0,50 0,150"
            fill="url(#scanGrad)"
            style={{
              transform: `rotate(${Math.sin(frame * 0.05) * 15}deg)`,
              transformOrigin: "200px 100px",
            }}
          />
        </svg>
      </div>

      {/* Stats overlay */}
      <div style={{
        position: "absolute",
        top: 60,
        left: 60,
        fontFamily: "monospace",
        color: COLORS.text,
      }}>
        <div style={{ fontSize: 14, color: COLORS.textMuted, marginBottom: 8 }}>
          MEV EXTRACTION RATE
        </div>
        <div style={{ fontSize: 48, fontWeight: 900, color: COLORS.danger }}>
          ${Math.floor(interpolate(frame, [0, fps * 4], [0, 847], { extrapolateRight: "clamp" }))}M
        </div>
        <div style={{ fontSize: 14, color: COLORS.textMuted }}>
          extracted in 2024
        </div>
      </div>

      {/* Bottom text */}
      <div style={{
        position: "absolute",
        bottom: 80,
        left: 0,
        right: 0,
        textAlign: "center",
      }}>
        <div style={{
          fontFamily: "SF Pro Display, -apple-system, sans-serif",
          fontSize: 36,
          fontWeight: 700,
          color: COLORS.text,
          opacity: interpolate(frame, [fps * 2, fps * 3], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
        }}>
          Your transactions are <span style={{ color: COLORS.danger }}>visible</span> to everyone.
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ============================================================================
// SCENE 3: THE SANDWICH (12-18s) - Show the attack mechanism
// ============================================================================
const Scene3_Sandwich: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  // Phase progression
  const phase = frame < fps * 2 ? "setup"
    : frame < fps * 4 ? "frontrun"
    : frame < fps * 5 ? "victim"
    : "backrun";

  // 3D perspective
  const perspective = 1200;
  const rotateX = interpolate(frame, [0, fps * 6], [15, 5], { extrapolateRight: "clamp" });

  // Block positions
  const frontrunX = interpolate(frame, [fps * 1.5, fps * 3], [-300, width / 2 - 200], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });

  const victimX = interpolate(frame, [fps * 3, fps * 4.5], [-300, width / 2], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });

  const backrunX = interpolate(frame, [fps * 4.5, fps * 6], [-300, width / 2 + 200], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });

  // Damage indicator
  const showDamage = frame > fps * 5;
  const damageScale = showDamage ? spring({ frame: frame - fps * 5, fps, config: { damping: 10, stiffness: 100 } }) : 0;

  return (
    <AbsoluteFill style={{ background: "#0a0a0a" }}>
      {/* Background image - Sandwich Attack 3D */}
      <div style={{
        position: "absolute",
        inset: 0,
        opacity: 0.3,
      }}>
        <Img
          src={staticFile("diagrams/sandwich-attack-3d.png")}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            filter: "blur(5px)",
          }}
        />
      </div>

      {/* Title */}
      <div style={{
        position: "absolute",
        top: 60,
        left: 0,
        right: 0,
        textAlign: "center",
      }}>
        <div style={{
          fontFamily: "SF Pro Display, -apple-system, sans-serif",
          fontSize: 48,
          fontWeight: 800,
          color: COLORS.text,
        }}>
          THE SANDWICH ATTACK
        </div>
        <div style={{
          fontFamily: "monospace",
          fontSize: 18,
          color: COLORS.textMuted,
          marginTop: 10,
        }}>
          How MEV bots extract value from your trades
        </div>
      </div>

      {/* 3D Transaction blocks */}
      <div style={{
        position: "absolute",
        inset: 0,
        perspective: `${perspective}px`,
        perspectiveOrigin: "50% 50%",
      }}>
        <div style={{
          position: "absolute",
          top: "50%",
          left: 0,
          right: 0,
          transform: `rotateX(${rotateX}deg)`,
          transformStyle: "preserve-3d",
        }}>
          {/* FRONTRUN block */}
          <TransactionBlock
            x={frontrunX}
            y={0}
            label="FRONTRUN"
            sublabel="Bot buys first"
            color={COLORS.warning}
            glowColor={COLORS.warning}
            visible={frame > fps * 1.5}
          />

          {/* VICTIM block (your trade) */}
          <TransactionBlock
            x={victimX}
            y={0}
            label="YOUR TRADE"
            sublabel="Executes at worse price"
            color={COLORS.encrypted}
            glowColor={COLORS.encrypted}
            visible={frame > fps * 3}
            isVictim
          />

          {/* BACKRUN block */}
          <TransactionBlock
            x={backrunX}
            y={0}
            label="BACKRUN"
            sublabel="Bot sells, profits"
            color={COLORS.danger}
            glowColor={COLORS.danger}
            visible={frame > fps * 4.5}
          />
        </div>
      </div>

      {/* Damage indicator */}
      {showDamage && (
        <div style={{
          position: "absolute",
          top: "70%",
          left: "50%",
          transform: `translate(-50%, -50%) scale(${damageScale})`,
          textAlign: "center",
        }}>
          <div style={{
            fontFamily: "SF Pro Display, -apple-system, sans-serif",
            fontSize: 72,
            fontWeight: 900,
            color: COLORS.danger,
            textShadow: `0 0 40px ${COLORS.danger}`,
          }}>
            -$2.4K
          </div>
          <div style={{
            fontFamily: "monospace",
            fontSize: 18,
            color: COLORS.textMuted,
          }}>
            Lost to MEV on a single trade
          </div>
        </div>
      )}

      {/* Connection arrows */}
      <svg style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
        {frame > fps * 3 && (
          <AnimatedArrow
            fromX={frontrunX + 80}
            fromY={height / 2}
            toX={victimX - 80}
            toY={height / 2}
            color={COLORS.warning}
            progress={interpolate(frame, [fps * 3, fps * 3.5], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })}
          />
        )}
        {frame > fps * 5 && (
          <AnimatedArrow
            fromX={victimX + 80}
            fromY={height / 2}
            toX={backrunX - 80}
            toY={height / 2}
            color={COLORS.danger}
            progress={interpolate(frame, [fps * 5, fps * 5.5], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })}
          />
        )}
      </svg>
    </AbsoluteFill>
  );
};

// Transaction block component
const TransactionBlock: React.FC<{
  x: number;
  y: number;
  label: string;
  sublabel: string;
  color: string;
  glowColor: string;
  visible: boolean;
  isVictim?: boolean;
}> = ({ x, y, label, sublabel, color, glowColor, visible, isVictim }) => {
  const frame = useCurrentFrame();
  const opacity = visible ? 1 : 0;
  const pulse = isVictim ? 0.9 + Math.sin(frame * 0.2) * 0.1 : 1;

  return (
    <div style={{
      position: "absolute",
      left: x - 75,
      top: y - 50,
      width: 150,
      height: 100,
      background: `linear-gradient(135deg, ${color}20, ${color}40)`,
      border: `2px solid ${color}`,
      borderRadius: 12,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      boxShadow: `0 0 30px ${glowColor}60, inset 0 0 20px ${glowColor}20`,
      opacity,
      transform: `scale(${pulse})`,
      transition: "opacity 0.3s",
    }}>
      <div style={{
        fontFamily: "SF Pro Display, -apple-system, sans-serif",
        fontSize: 16,
        fontWeight: 700,
        color: color,
        marginBottom: 4,
      }}>
        {label}
      </div>
      <div style={{
        fontFamily: "monospace",
        fontSize: 10,
        color: COLORS.textMuted,
        textAlign: "center",
      }}>
        {sublabel}
      </div>
    </div>
  );
};

// Animated arrow component
const AnimatedArrow: React.FC<{
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  color: string;
  progress: number;
}> = ({ fromX, fromY, toX, toY, color, progress }) => {
  const currentX = fromX + (toX - fromX) * progress;
  const headSize = 10;
  const angle = Math.atan2(toY - fromY, toX - fromX);

  return (
    <g>
      <line
        x1={fromX}
        y1={fromY}
        x2={currentX}
        y2={toY}
        stroke={color}
        strokeWidth={3}
        strokeLinecap="round"
      />
      {progress > 0.9 && (
        <polygon
          points={`
            ${toX},${toY}
            ${toX - headSize * Math.cos(angle - Math.PI / 6)},${toY - headSize * Math.sin(angle - Math.PI / 6)}
            ${toX - headSize * Math.cos(angle + Math.PI / 6)},${toY - headSize * Math.sin(angle + Math.PI / 6)}
          `}
          fill={color}
        />
      )}
    </g>
  );
};

// ============================================================================
// SCENE 4: THE SOLUTION (18-26s) - Encrypted Mempool reveal
// ============================================================================
const Scene4_Solution: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  // Dramatic reveal timing
  const revealProgress = interpolate(frame, [fps * 1, fps * 3], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Shield scale animation
  const shieldScale = spring({
    frame: Math.max(0, frame - fps * 2),
    fps,
    config: { damping: 12, stiffness: 80 },
  });

  // Encryption particle ring
  const ringRotation = frame * 0.5;

  // Text scramble effect for "ENCRYPTED"
  const scrambleChars = "█▓▒░▀▄";
  const targetText = "ENCRYPTED";
  const scrambleProgress = interpolate(frame, [fps * 3, fps * 4.5], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const displayText = targetText.split("").map((char, i) => {
    const charProgress = scrambleProgress * targetText.length - i;
    if (charProgress < 0) return " ";
    if (charProgress < 1) return scrambleChars[Math.floor(random(`scr-${i}-${Math.floor(frame / 2)}`) * scrambleChars.length)];
    return char;
  }).join("");

  // Glow layers
  const glowLayers = [
    { blur: 80, alpha: 0.15, scale: 1.8 },
    { blur: 50, alpha: 0.25, scale: 1.4 },
    { blur: 30, alpha: 0.4, scale: 1.2 },
    { blur: 15, alpha: 0.6, scale: 1.0 },
  ];

  return (
    <AbsoluteFill style={{ background: "#000" }}>
      {/* Background - faded comparison image */}
      <div style={{
        position: "absolute",
        inset: 0,
        opacity: 0.2 + revealProgress * 0.3,
      }}>
        <Img
          src={staticFile("diagrams/encrypted-vs-transparent-dual-monitors.png")}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
          }}
        />
      </div>

      {/* Transition flash */}
      <div style={{
        position: "absolute",
        inset: 0,
        background: COLORS.encrypted,
        opacity: interpolate(frame, [fps * 1.8, fps * 2.5], [0.8, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        }),
      }} />

      {/* Central shield with glow layers */}
      <div style={{
        position: "absolute",
        top: "50%",
        left: "50%",
        transform: `translate(-50%, -50%) scale(${shieldScale})`,
      }}>
        {/* Glow layers */}
        {glowLayers.map((layer, i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              width: 300 * layer.scale,
              height: 300 * layer.scale,
              transform: "translate(-50%, -50%)",
              borderRadius: "50%",
              background: `radial-gradient(circle, ${COLORS.encrypted}${Math.floor(layer.alpha * 255).toString(16).padStart(2, "0")} 0%, transparent 70%)`,
              filter: `blur(${layer.blur}px)`,
            }}
          />
        ))}

        {/* Main shield image */}
        <div style={{
          width: 250,
          height: 250,
          position: "relative",
        }}>
          <Img
            src={staticFile("diagrams/encryption-shield.png")}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "contain",
            }}
          />
        </div>

        {/* Orbiting encryption particles */}
        {Array.from({ length: 12 }).map((_, i) => {
          const angle = (i / 12) * Math.PI * 2 + (ringRotation * Math.PI) / 180;
          const radius = 180;
          const x = Math.cos(angle) * radius;
          const y = Math.sin(angle) * radius;
          const size = 8 + Math.sin(frame * 0.1 + i) * 3;

          return (
            <div
              key={i}
              style={{
                position: "absolute",
                left: "50%",
                top: "50%",
                width: size,
                height: size,
                borderRadius: "50%",
                background: COLORS.encrypted,
                transform: `translate(${x - size / 2}px, ${y - size / 2}px)`,
                boxShadow: `0 0 15px ${COLORS.encrypted}`,
              }}
            />
          );
        })}
      </div>

      {/* Top label */}
      <div style={{
        position: "absolute",
        top: 80,
        left: 0,
        right: 0,
        textAlign: "center",
        opacity: interpolate(frame, [fps * 0.5, fps * 1.5], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
      }}>
        <div style={{
          fontFamily: "monospace",
          fontSize: 18,
          color: COLORS.encrypted,
          letterSpacing: "0.5em",
        }}>
          INTRODUCING
        </div>
      </div>

      {/* Main title with scramble */}
      <div style={{
        position: "absolute",
        top: "75%",
        left: 0,
        right: 0,
        textAlign: "center",
      }}>
        <div style={{
          fontFamily: "SF Pro Display, -apple-system, sans-serif",
          fontSize: 80,
          fontWeight: 900,
          background: `linear-gradient(135deg, ${COLORS.encrypted} 0%, ${COLORS.protected} 50%, ${COLORS.success} 100%)`,
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          letterSpacing: "0.1em",
        }}>
          {displayText}
        </div>
        <div style={{
          fontFamily: "SF Pro Display, -apple-system, sans-serif",
          fontSize: 48,
          fontWeight: 700,
          color: COLORS.text,
          marginTop: 10,
          opacity: interpolate(frame, [fps * 5, fps * 6], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
        }}>
          MEMPOOL
        </div>
      </div>

      {/* Subtitle */}
      <div style={{
        position: "absolute",
        bottom: 60,
        left: 0,
        right: 0,
        textAlign: "center",
        opacity: interpolate(frame, [fps * 6, fps * 7], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
      }}>
        <div style={{
          fontFamily: "monospace",
          fontSize: 20,
          color: COLORS.textMuted,
        }}>
          Native MEV Protection at the Protocol Level
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ============================================================================
// SCENE 5: THE MECHANISM (26-34s) - How threshold encryption works
// ============================================================================
const Scene5_Mechanism: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  const centerX = width / 2;
  const centerY = height / 2;

  // Validator reveal timing
  const validatorCount = 7;
  const validatorsRevealed = Math.min(
    validatorCount,
    Math.floor(interpolate(frame, [fps * 0.5, fps * 3], [0, validatorCount], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }))
  );

  // Key assembly progress
  const keyAssemblyProgress = interpolate(frame, [fps * 4, fps * 6], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Threshold indicator (2/3 = 5 out of 7)
  const thresholdReached = validatorsRevealed >= 5;

  // Decryption beam animation
  const showBeams = frame > fps * 5;

  return (
    <AbsoluteFill style={{ background: "#050505" }}>
      {/* Background - threshold decryption image */}
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
          fontSize: 42,
          fontWeight: 800,
          color: COLORS.text,
        }}>
          THRESHOLD DECRYPTION
        </div>
        <div style={{
          fontFamily: "monospace",
          fontSize: 16,
          color: COLORS.gold,
          marginTop: 10,
        }}>
          2/3 STAKE QUORUM REQUIRED
        </div>
      </div>

      {/* Central encrypted transaction */}
      <div style={{
        position: "absolute",
        left: centerX - 60,
        top: centerY - 60,
        width: 120,
        height: 120,
        borderRadius: "50%",
        background: `radial-gradient(circle, ${COLORS.encrypted}40 0%, transparent 70%)`,
        border: `3px solid ${thresholdReached ? COLORS.success : COLORS.encrypted}`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        boxShadow: `0 0 40px ${thresholdReached ? COLORS.success : COLORS.encrypted}60`,
        transition: "border-color 0.5s, box-shadow 0.5s",
      }}>
        <div style={{
          fontFamily: "monospace",
          fontSize: thresholdReached ? 40 : 30,
          color: thresholdReached ? COLORS.success : COLORS.encrypted,
          transition: "all 0.5s",
        }}>
          {thresholdReached ? "🔓" : "🔐"}
        </div>
      </div>

      {/* Validator nodes in a circle */}
      {Array.from({ length: validatorCount }).map((_, i) => {
        const angle = (i / validatorCount) * Math.PI * 2 - Math.PI / 2;
        const radius = 250;
        const x = centerX + Math.cos(angle) * radius;
        const y = centerY + Math.sin(angle) * radius;
        const isRevealed = i < validatorsRevealed;
        const isContributing = isRevealed && frame > fps * 4 + i * 5;

        // Pulse animation
        const pulse = isContributing ? 0.9 + Math.sin(frame * 0.15 + i) * 0.1 : 1;

        return (
          <React.Fragment key={i}>
            {/* Connection beam to center when contributing */}
            {showBeams && isContributing && (
              <svg style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
                <line
                  x1={x}
                  y1={y}
                  x2={centerX}
                  y2={centerY}
                  stroke={COLORS.gold}
                  strokeWidth={2}
                  opacity={0.6}
                  strokeDasharray="5,5"
                  style={{
                    strokeDashoffset: -frame * 2,
                  }}
                />
                {/* Traveling particle */}
                {(() => {
                  const particleProgress = ((frame * 0.02 + i * 0.2) % 1);
                  const px = x + (centerX - x) * particleProgress;
                  const py = y + (centerY - y) * particleProgress;
                  return (
                    <circle
                      cx={px}
                      cy={py}
                      r={5}
                      fill={COLORS.gold}
                      style={{
                        filter: `drop-shadow(0 0 8px ${COLORS.gold})`,
                      }}
                    />
                  );
                })()}
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
              background: isRevealed
                ? `linear-gradient(135deg, ${COLORS.purple}40, ${COLORS.purple}20)`
                : "#111",
              border: `2px solid ${isContributing ? COLORS.gold : isRevealed ? COLORS.purple : "#333"}`,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              opacity: isRevealed ? 1 : 0.3,
              transform: `scale(${pulse})`,
              boxShadow: isContributing ? `0 0 25px ${COLORS.gold}60` : "none",
              transition: "all 0.3s",
            }}>
              <div style={{
                fontFamily: "monospace",
                fontSize: 10,
                color: isContributing ? COLORS.gold : COLORS.textMuted,
              }}>
                V{i + 1}
              </div>
              {isContributing && (
                <div style={{ fontSize: 16, marginTop: 2 }}>🔑</div>
              )}
            </div>
          </React.Fragment>
        );
      })}

      {/* Progress indicator */}
      <div style={{
        position: "absolute",
        bottom: 80,
        left: 0,
        right: 0,
        textAlign: "center",
      }}>
        <div style={{
          fontFamily: "monospace",
          fontSize: 24,
          color: thresholdReached ? COLORS.success : COLORS.textMuted,
        }}>
          {validatorsRevealed}/7 Validators Contributing
          {thresholdReached && (
            <span style={{ color: COLORS.success, marginLeft: 20 }}>
              ✓ THRESHOLD REACHED
            </span>
          )}
        </div>

        {/* Progress bar */}
        <div style={{
          width: 400,
          height: 8,
          background: "#222",
          borderRadius: 4,
          margin: "20px auto 0",
          overflow: "hidden",
        }}>
          <div style={{
            width: `${(validatorsRevealed / validatorCount) * 100}%`,
            height: "100%",
            background: thresholdReached
              ? `linear-gradient(90deg, ${COLORS.success}, ${COLORS.protected})`
              : COLORS.purple,
            borderRadius: 4,
            transition: "width 0.3s, background 0.5s",
          }} />
          {/* Threshold marker */}
          <div style={{
            position: "absolute",
            left: `calc(50% - 200px + ${(5 / 7) * 400}px)`,
            top: -5,
            width: 2,
            height: 18,
            background: COLORS.gold,
          }} />
        </div>
        <div style={{
          fontFamily: "monospace",
          fontSize: 12,
          color: COLORS.gold,
          marginTop: 8,
        }}>
          ▲ 2/3 Threshold
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ============================================================================
// SCENE 6: THE VICTORY (34-40s) - MEV blocked, user protected
// ============================================================================
const Scene6_Victory: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  // Victory explosion
  const explosionProgress = interpolate(frame, [fps * 0.5, fps * 2], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Counter animations
  const savedAmount = interpolate(frame, [fps * 2, fps * 4], [0, 847000000], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const mevBlocked = interpolate(frame, [fps * 2.5, fps * 4.5], [0, 100], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Particle explosion
  const particleCount = 60;
  const particles = useMemo(() => {
    return Array.from({ length: particleCount }).map((_, i) => ({
      angle: (i / particleCount) * Math.PI * 2 + random(`angle-${i}`) * 0.5,
      speed: 200 + random(`speed-${i}`) * 400,
      size: 4 + random(`size-${i}`) * 8,
      color: [COLORS.success, COLORS.protected, COLORS.encrypted, COLORS.gold][Math.floor(random(`color-${i}`) * 4)],
    }));
  }, []);

  return (
    <AbsoluteFill style={{ background: "#000" }}>
      {/* Background radial glow */}
      <div style={{
        position: "absolute",
        inset: 0,
        background: `radial-gradient(circle at center, ${COLORS.success}10 0%, transparent 60%)`,
      }} />

      {/* Explosion particles */}
      {particles.map((p, i) => {
        const distance = p.speed * Easing.out(Easing.cubic)(explosionProgress);
        const x = width / 2 + Math.cos(p.angle) * distance;
        const y = height / 2 + Math.sin(p.angle) * distance;
        const opacity = 1 - explosionProgress;

        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: x - p.size / 2,
              top: y - p.size / 2,
              width: p.size,
              height: p.size,
              borderRadius: "50%",
              background: p.color,
              opacity,
              boxShadow: `0 0 ${p.size * 2}px ${p.color}`,
            }}
          />
        );
      })}

      {/* Central success icon */}
      <div style={{
        position: "absolute",
        top: "30%",
        left: "50%",
        transform: "translate(-50%, -50%)",
      }}>
        <div style={{
          width: 150,
          height: 150,
          borderRadius: "50%",
          background: `linear-gradient(135deg, ${COLORS.success}40, ${COLORS.protected}40)`,
          border: `4px solid ${COLORS.success}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 72,
          boxShadow: `0 0 60px ${COLORS.success}60, 0 0 120px ${COLORS.success}30`,
          transform: `scale(${spring({ frame, fps, config: { damping: 10, stiffness: 80 } })})`,
        }}>
          ✓
        </div>
      </div>

      {/* Title */}
      <div style={{
        position: "absolute",
        top: "50%",
        left: 0,
        right: 0,
        textAlign: "center",
      }}>
        <div style={{
          fontFamily: "SF Pro Display, -apple-system, sans-serif",
          fontSize: 64,
          fontWeight: 900,
          color: COLORS.success,
          textShadow: `0 0 40px ${COLORS.success}80`,
        }}>
          MEV BLOCKED
        </div>
        <div style={{
          fontFamily: "monospace",
          fontSize: 20,
          color: COLORS.textMuted,
          marginTop: 15,
        }}>
          Your transaction executed at the fair price
        </div>
      </div>

      {/* Stats */}
      <div style={{
        position: "absolute",
        bottom: 120,
        left: 0,
        right: 0,
        display: "flex",
        justifyContent: "center",
        gap: 100,
      }}>
        <StatBox
          label="POTENTIAL VALUE SAVED"
          value={`$${Math.floor(savedAmount).toLocaleString()}`}
          color={COLORS.success}
          icon="💰"
        />
        <StatBox
          label="MEV ATTACKS BLOCKED"
          value={`${Math.floor(mevBlocked)}%`}
          color={COLORS.protected}
          icon="🛡️"
        />
      </div>
    </AbsoluteFill>
  );
};

// Stat box component
const StatBox: React.FC<{
  label: string;
  value: string;
  color: string;
  icon: string;
}> = ({ label, value, color, icon }) => {
  return (
    <div style={{ textAlign: "center" }}>
      <div style={{ fontSize: 40, marginBottom: 10 }}>{icon}</div>
      <div style={{
        fontFamily: "SF Pro Display, -apple-system, sans-serif",
        fontSize: 48,
        fontWeight: 900,
        color,
        textShadow: `0 0 20px ${color}60`,
      }}>
        {value}
      </div>
      <div style={{
        fontFamily: "monospace",
        fontSize: 12,
        color: COLORS.textMuted,
        marginTop: 8,
        letterSpacing: "0.1em",
      }}>
        {label}
      </div>
    </div>
  );
};

// ============================================================================
// SCENE 7: THE FINALE (40-45s) - Aptos branding and CTA
// ============================================================================
const Scene7_Finale: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Fade in
  const opacity = interpolate(frame, [0, fps * 1], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Features stagger
  const features = [
    { icon: "🔐", label: "Threshold Encryption", delay: fps * 1 },
    { icon: "⚡", label: "No Performance Penalty", delay: fps * 1.5 },
    { icon: "🛡️", label: "Native MEV Protection", delay: fps * 2 },
    { icon: "🌐", label: "First L1 Implementation", delay: fps * 2.5 },
  ];

  return (
    <AbsoluteFill style={{ background: "#000" }}>
      {/* Gradient background */}
      <div style={{
        position: "absolute",
        inset: 0,
        background: `radial-gradient(ellipse at 50% 30%, ${COLORS.encrypted}15 0%, transparent 50%),
                     radial-gradient(ellipse at 30% 70%, ${COLORS.purple}10 0%, transparent 40%),
                     radial-gradient(ellipse at 70% 80%, ${COLORS.success}10 0%, transparent 40%)`,
        opacity,
      }} />

      {/* Main title */}
      <div style={{
        position: "absolute",
        top: "20%",
        left: 0,
        right: 0,
        textAlign: "center",
        opacity,
      }}>
        <div style={{
          fontFamily: "SF Pro Display, -apple-system, sans-serif",
          fontSize: 28,
          color: COLORS.textMuted,
          marginBottom: 20,
          letterSpacing: "0.3em",
        }}>
          THE FIRST L1 WITH
        </div>
        <div style={{
          fontFamily: "SF Pro Display, -apple-system, sans-serif",
          fontSize: 96,
          fontWeight: 900,
          background: `linear-gradient(135deg, ${COLORS.encrypted} 0%, ${COLORS.purple} 50%, ${COLORS.success} 100%)`,
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
        }}>
          NATIVE ENCRYPTION
        </div>
      </div>

      {/* Features grid */}
      <div style={{
        position: "absolute",
        top: "55%",
        left: 0,
        right: 0,
        display: "flex",
        justifyContent: "center",
        gap: 80,
      }}>
        {features.map((feature, i) => {
          const featureOpacity = interpolate(frame, [feature.delay, feature.delay + fps * 0.5], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });
          const featureY = interpolate(frame, [feature.delay, feature.delay + fps * 0.5], [20, 0], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });

          return (
            <div
              key={i}
              style={{
                textAlign: "center",
                opacity: featureOpacity,
                transform: `translateY(${featureY}px)`,
              }}
            >
              <div style={{ fontSize: 48, marginBottom: 15 }}>{feature.icon}</div>
              <div style={{
                fontFamily: "monospace",
                fontSize: 14,
                color: COLORS.textMuted,
                maxWidth: 150,
              }}>
                {feature.label}
              </div>
            </div>
          );
        })}
      </div>

      {/* Aptos logo/branding area */}
      <div style={{
        position: "absolute",
        bottom: 80,
        left: 0,
        right: 0,
        textAlign: "center",
        opacity: interpolate(frame, [fps * 3, fps * 4], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
      }}>
        <div style={{
          fontFamily: "SF Pro Display, -apple-system, sans-serif",
          fontSize: 36,
          fontWeight: 700,
          color: COLORS.text,
          letterSpacing: "0.2em",
        }}>
          APTOS
        </div>
        <div style={{
          fontFamily: "monospace",
          fontSize: 14,
          color: COLORS.encrypted,
          marginTop: 10,
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
export const UltraEncryptedMempool: React.FC = () => {
  const { fps } = useVideoConfig();

  // Scene durations in seconds
  const scenes = {
    darkForest: 6,    // 0-6s
    predators: 6,     // 6-12s
    sandwich: 6,      // 12-18s
    solution: 8,      // 18-26s
    mechanism: 8,     // 26-34s
    victory: 6,       // 34-40s
    finale: 5,        // 40-45s
  };

  return (
    <AbsoluteFill style={{ background: "#000" }}>
      <Sequence from={0} durationInFrames={fps * scenes.darkForest}>
        <Scene1_DarkForest />
      </Sequence>

      <Sequence from={fps * 6} durationInFrames={fps * scenes.predators}>
        <Scene2_Predators />
      </Sequence>

      <Sequence from={fps * 12} durationInFrames={fps * scenes.sandwich}>
        <Scene3_Sandwich />
      </Sequence>

      <Sequence from={fps * 18} durationInFrames={fps * scenes.solution}>
        <Scene4_Solution />
      </Sequence>

      <Sequence from={fps * 26} durationInFrames={fps * scenes.mechanism}>
        <Scene5_Mechanism />
      </Sequence>

      <Sequence from={fps * 34} durationInFrames={fps * scenes.victory}>
        <Scene6_Victory />
      </Sequence>

      <Sequence from={fps * 40} durationInFrames={fps * scenes.finale}>
        <Scene7_Finale />
      </Sequence>
    </AbsoluteFill>
  );
};
