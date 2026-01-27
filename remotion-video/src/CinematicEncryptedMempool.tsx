import React from "react";
import {
  AbsoluteFill,
  Img,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
  staticFile,
  Sequence,
  Easing,
  random,
  Audio,
} from "remotion";
import { fonts } from "./styles/theme";

// ============== CINEMATIC CONSTANTS ==============

const COLORS = {
  danger: "#ff3b30",
  dangerGlow: "#ff000080",
  safe: "#00ff88",
  safeGlow: "#00ff8880",
  encryption: "#8b5cf6",
  encryptionGlow: "#8b5cf680",
  cyan: "#00d4ff",
  gold: "#ffd700",
  white: "#ffffff",
  black: "#000000",
};

// ============== ATMOSPHERIC EFFECTS ==============

// Floating particles that add depth
const AtmosphericParticles: React.FC<{
  count?: number;
  color?: string;
  speed?: number;
  opacity?: number;
}> = ({ count = 50, color = COLORS.cyan, speed = 1, opacity = 0.3 }) => {
  const frame = useCurrentFrame();

  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden" }}>
      {Array.from({ length: count }).map((_, i) => {
        const x = random(`px-${i}`) * 100;
        const baseY = random(`py-${i}`) * 100;
        const size = 1 + random(`ps-${i}`) * 4;
        const drift = Math.sin(frame * 0.02 * speed + random(`pd-${i}`) * Math.PI * 2) * 20;
        const y = (baseY + frame * 0.1 * speed) % 120 - 10;
        const particleOpacity = opacity * (0.3 + random(`po-${i}`) * 0.7);

        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: `calc(${x}% + ${drift}px)`,
              top: `${y}%`,
              width: size,
              height: size,
              borderRadius: "50%",
              backgroundColor: color,
              opacity: particleOpacity,
              boxShadow: `0 0 ${size * 3}px ${color}`,
            }}
          />
        );
      })}
    </div>
  );
};

// Scanline overlay for tech aesthetic
const ScanLines: React.FC<{ opacity?: number; speed?: number }> = ({
  opacity = 0.1,
  speed = 1,
}) => {
  const frame = useCurrentFrame();
  const offset = (frame * speed) % 4;

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        background: `repeating-linear-gradient(
          0deg,
          transparent ${offset}px,
          transparent ${offset + 2}px,
          rgba(0, 0, 0, ${opacity}) ${offset + 2}px,
          rgba(0, 0, 0, ${opacity}) ${offset + 4}px
        )`,
        pointerEvents: "none",
      }}
    />
  );
};

// Vignette for cinematic framing
const Vignette: React.FC<{ intensity?: number; color?: string }> = ({
  intensity = 0.7,
  color = "black",
}) => (
  <div
    style={{
      position: "absolute",
      inset: 0,
      background: `radial-gradient(ellipse at center, transparent 40%, ${color} ${100 - intensity * 30}%)`,
      pointerEvents: "none",
    }}
  />
);

// Chromatic aberration effect
const ChromaticAberration: React.FC<{ intensity?: number }> = ({ intensity = 2 }) => (
  <div
    style={{
      position: "absolute",
      inset: 0,
      mixBlendMode: "screen",
      opacity: 0.1,
      pointerEvents: "none",
    }}
  >
    <div
      style={{
        position: "absolute",
        inset: 0,
        background: "linear-gradient(90deg, rgba(255,0,0,0.1) 0%, transparent 50%, rgba(0,255,255,0.1) 100%)",
      }}
    />
  </div>
);

// ============== CINEMATIC IMAGE COMPONENT ==============

// Ken Burns effect on images
const CinematicImage: React.FC<{
  src: string;
  startScale?: number;
  endScale?: number;
  startX?: number;
  endX?: number;
  startY?: number;
  endY?: number;
  brightness?: number;
  overlay?: string;
}> = ({
  src,
  startScale = 1,
  endScale = 1.1,
  startX = 0,
  endX = 0,
  startY = 0,
  endY = 0,
  brightness = 1,
  overlay,
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  const progress = frame / durationInFrames;

  const scale = interpolate(progress, [0, 1], [startScale, endScale], {
    easing: Easing.inOut(Easing.cubic),
  });

  const x = interpolate(progress, [0, 1], [startX, endX], {
    easing: Easing.inOut(Easing.cubic),
  });

  const y = interpolate(progress, [0, 1], [startY, endY], {
    easing: Easing.inOut(Easing.cubic),
  });

  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
      <Img
        src={staticFile(src)}
        style={{
          position: "absolute",
          width: "100%",
          height: "100%",
          objectFit: "cover",
          transform: `scale(${scale}) translate(${x}%, ${y}%)`,
          filter: `brightness(${brightness})`,
        }}
      />
      {overlay && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: overlay,
          }}
        />
      )}
    </div>
  );
};

// ============== TEXT OVERLAYS ==============

const CinematicTitle: React.FC<{
  text: string;
  subtitle?: string;
  color?: string;
  glowColor?: string;
  position?: "center" | "bottom" | "top";
}> = ({
  text,
  subtitle,
  color = COLORS.white,
  glowColor,
  position = "center",
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const opacity = interpolate(frame, [0, fps * 0.5, fps * 2.5, fps * 3], [0, 1, 1, 0], {
    extrapolateRight: "clamp",
  });

  const y = interpolate(frame, [0, fps * 0.5], [30, 0], {
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });

  const positionStyle =
    position === "center"
      ? { top: "50%", transform: `translateY(calc(-50% + ${y}px))` }
      : position === "bottom"
        ? { bottom: 120, transform: `translateY(${y}px)` }
        : { top: 120, transform: `translateY(${y}px)` };

  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        textAlign: "center",
        opacity,
        ...positionStyle,
      }}
    >
      <div
        style={{
          fontFamily: fonts.display,
          fontSize: 72,
          fontWeight: 800,
          color,
          textShadow: glowColor
            ? `0 0 40px ${glowColor}, 0 0 80px ${glowColor}, 0 4px 30px rgba(0,0,0,0.8)`
            : "0 4px 30px rgba(0,0,0,0.8)",
          letterSpacing: "0.05em",
        }}
      >
        {text}
      </div>
      {subtitle && (
        <div
          style={{
            fontFamily: "monospace",
            fontSize: 24,
            color: glowColor || color,
            marginTop: 20,
            opacity: 0.8,
            textShadow: "0 2px 20px rgba(0,0,0,0.8)",
            letterSpacing: "0.2em",
          }}
        >
          {subtitle}
        </div>
      )}
    </div>
  );
};

// Dramatic stat display
const StatOverlay: React.FC<{
  value: string;
  label: string;
  color: string;
  position: { x: number; y: number };
  delay?: number;
}> = ({ value, label, color, position, delay = 0 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const localFrame = frame - delay;
  if (localFrame < 0) return null;

  const opacity = interpolate(localFrame, [0, fps * 0.3], [0, 1], {
    extrapolateRight: "clamp",
  });

  const scale = interpolate(localFrame, [0, fps * 0.3], [0.8, 1], {
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.back(2)),
  });

  return (
    <div
      style={{
        position: "absolute",
        left: `${position.x}%`,
        top: `${position.y}%`,
        transform: `translate(-50%, -50%) scale(${scale})`,
        opacity,
        textAlign: "center",
      }}
    >
      <div
        style={{
          fontFamily: fonts.display,
          fontSize: 64,
          fontWeight: 800,
          color,
          textShadow: `0 0 30px ${color}, 0 4px 20px rgba(0,0,0,0.8)`,
        }}
      >
        {value}
      </div>
      <div
        style={{
          fontFamily: "monospace",
          fontSize: 14,
          color: COLORS.white,
          opacity: 0.7,
          letterSpacing: "0.15em",
          marginTop: 8,
        }}
      >
        {label}
      </div>
    </div>
  );
};

// ============== GLITCH TRANSITION ==============

const GlitchTransition: React.FC<{ intensity?: number }> = ({ intensity = 1 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Glitch only in the middle of the sequence
  const glitchProgress = interpolate(frame, [0, fps * 0.3, fps * 0.7, fps], [0, 1, 1, 0]);

  if (glitchProgress < 0.1) return null;

  const slices = Array.from({ length: 15 }).map((_, i) => {
    const y = (i / 15) * 100;
    const height = 100 / 15;
    const offset = Math.sin(frame * 0.5 + i) * 30 * intensity * glitchProgress;
    const showSlice = random(`slice-${i}-${Math.floor(frame / 2)}`) > 0.3;

    return showSlice ? (
      <div
        key={i}
        style={{
          position: "absolute",
          left: offset,
          right: -offset,
          top: `${y}%`,
          height: `${height}%`,
          background: `linear-gradient(90deg,
            rgba(255,0,0,${0.3 * glitchProgress}) 0%,
            transparent 20%,
            transparent 80%,
            rgba(0,255,255,${0.3 * glitchProgress}) 100%)`,
        }}
      />
    ) : null;
  });

  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }}>
      {slices}
      {/* Static noise */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          opacity: 0.1 * glitchProgress,
          background: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
        }}
      />
    </div>
  );
};

// ============== SCENE COMPONENTS ==============

// Scene 1: The Mempool - Peaceful monitoring
const Scene1_TheMempool: React.FC = () => {
  return (
    <AbsoluteFill>
      <CinematicImage
        src="diagrams/01-mempool-scanner-control-room.png"
        startScale={1.1}
        endScale={1}
        startX={2}
        endX={0}
        brightness={0.9}
        overlay="linear-gradient(to bottom, rgba(0,0,0,0.3), transparent 50%, rgba(0,0,0,0.5))"
      />
      <AtmosphericParticles count={30} color={COLORS.cyan} opacity={0.15} />
      <ScanLines opacity={0.05} />
      <Vignette intensity={0.6} />

      <CinematicTitle
        text="THE MEMPOOL"
        subtitle="WHERE ALL TRANSACTIONS WAIT"
        color={COLORS.white}
        glowColor={COLORS.cyan}
        position="bottom"
      />

      <ChromaticAberration />
    </AbsoluteFill>
  );
};

// Scene 2: The Predators - MEV bots lurking
const Scene2_ThePredators: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const pulseIntensity = 0.3 + Math.sin(frame * 0.1) * 0.1;

  return (
    <AbsoluteFill>
      <CinematicImage
        src="diagrams/mev-battle.png"
        startScale={1}
        endScale={1.15}
        startY={0}
        endY={-3}
        brightness={1.1}
        overlay={`radial-gradient(ellipse at 30% 50%, ${COLORS.dangerGlow} 0%, transparent 50%)`}
      />
      <AtmosphericParticles count={40} color={COLORS.danger} opacity={0.2} speed={1.5} />
      <ScanLines opacity={0.08} speed={2} />
      <Vignette intensity={0.8} color="#1a0000" />

      {/* Pulsing danger overlay */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `radial-gradient(circle at 20% 50%, ${COLORS.danger}${Math.floor(pulseIntensity * 255).toString(16).padStart(2, "0")} 0%, transparent 40%)`,
        }}
      />

      <CinematicTitle
        text="THE PREDATORS"
        subtitle="MEV BOTS HUNT YOUR TRANSACTIONS"
        color={COLORS.danger}
        glowColor={COLORS.danger}
        position="bottom"
      />

      <StatOverlay
        value="$1.2B+"
        label="EXTRACTED ANNUALLY"
        color={COLORS.danger}
        position={{ x: 80, y: 30 }}
        delay={15}
      />
    </AbsoluteFill>
  );
};

// Scene 3: The Attack - Sandwich attack visualization
const Scene3_TheAttack: React.FC = () => {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill>
      <CinematicImage
        src="diagrams/20-sandwich-attack-3d.png"
        startScale={1.2}
        endScale={1}
        startX={-5}
        endX={0}
        brightness={1}
        overlay="linear-gradient(135deg, rgba(255,0,0,0.2) 0%, transparent 50%, rgba(0,0,0,0.4) 100%)"
      />
      <AtmosphericParticles count={60} color={COLORS.danger} opacity={0.25} speed={2} />
      <ScanLines opacity={0.1} speed={3} />
      <GlitchTransition intensity={0.5} />
      <Vignette intensity={0.9} color="#200000" />

      <CinematicTitle
        text="SANDWICH ATTACK"
        subtitle="YOUR TRANSACTION IS THE MEAT"
        color={COLORS.danger}
        glowColor={COLORS.danger}
        position="center"
      />
    </AbsoluteFill>
  );
};

// Scene 4: The Chaos - Trading floor in chaos
const Scene4_TheChaos: React.FC = () => {
  const frame = useCurrentFrame();
  const shake = Math.sin(frame * 0.8) * 3;

  return (
    <AbsoluteFill style={{ transform: `translate(${shake}px, ${shake * 0.5}px)` }}>
      <CinematicImage
        src="diagrams/13-trading-floor-mev-chaos.png"
        startScale={1.05}
        endScale={1.2}
        brightness={1.2}
        overlay="radial-gradient(circle at center, transparent 30%, rgba(255,0,0,0.3) 100%)"
      />
      <AtmosphericParticles count={80} color={COLORS.danger} opacity={0.3} speed={3} />
      <ScanLines opacity={0.15} speed={4} />
      <GlitchTransition intensity={1} />
      <Vignette intensity={1} color="#300000" />

      {/* Flashing alert */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: COLORS.danger,
          opacity: Math.sin(frame * 0.5) > 0.8 ? 0.1 : 0,
        }}
      />

      <CinematicTitle
        text="CHAOS"
        subtitle="$847 LOST IN MILLISECONDS"
        color={COLORS.danger}
        glowColor={COLORS.danger}
        position="center"
      />
    </AbsoluteFill>
  );
};

// Scene 5: The Solution - Encryption shield
const Scene5_TheSolution: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const shieldGlow = 0.5 + Math.sin(frame * 0.08) * 0.2;

  return (
    <AbsoluteFill>
      <CinematicImage
        src="diagrams/encryption-shield.png"
        startScale={1.3}
        endScale={1}
        brightness={1.1}
        overlay={`radial-gradient(circle at center, ${COLORS.encryptionGlow} 0%, transparent 60%)`}
      />
      <AtmosphericParticles count={50} color={COLORS.encryption} opacity={0.25} />
      <ScanLines opacity={0.05} />
      <Vignette intensity={0.5} />

      {/* Shield glow pulse */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `radial-gradient(circle at center, ${COLORS.encryption}${Math.floor(shieldGlow * 60).toString(16).padStart(2, "0")} 0%, transparent 50%)`,
        }}
      />

      <CinematicTitle
        text="THE SHIELD"
        subtitle="ENCRYPTED MEMPOOL ACTIVATES"
        color={COLORS.encryption}
        glowColor={COLORS.encryption}
        position="bottom"
      />
    </AbsoluteFill>
  );
};

// Scene 6: The Ceremony - Threshold key generation
const Scene6_TheCeremony: React.FC = () => {
  return (
    <AbsoluteFill>
      <CinematicImage
        src="diagrams/11-threshold-key-generation-ceremony.png"
        startScale={1}
        endScale={1.1}
        startY={2}
        endY={0}
        brightness={0.95}
        overlay="linear-gradient(to bottom, rgba(0,0,0,0.2), transparent 30%, rgba(139,92,246,0.2))"
      />
      <AtmosphericParticles count={30} color={COLORS.gold} opacity={0.2} />
      <ScanLines opacity={0.03} />
      <Vignette intensity={0.6} />

      <CinematicTitle
        text="THE CEREMONY"
        subtitle="VALIDATORS GENERATE SHARED KEY"
        color={COLORS.gold}
        glowColor={COLORS.gold}
        position="bottom"
      />

      <StatOverlay
        value=">2/3"
        label="THRESHOLD REQUIRED"
        color={COLORS.gold}
        position={{ x: 15, y: 25 }}
        delay={20}
      />
    </AbsoluteFill>
  );
};

// Scene 7: The Lock - Threshold decryption
const Scene7_TheLock: React.FC = () => {
  const frame = useCurrentFrame();
  const glow = 0.6 + Math.sin(frame * 0.1) * 0.2;

  return (
    <AbsoluteFill>
      <CinematicImage
        src="diagrams/22-threshold-decryption-assembly.png"
        startScale={1.1}
        endScale={1}
        brightness={1.1}
        overlay={`radial-gradient(circle at 50% 40%, ${COLORS.gold}40 0%, transparent 50%)`}
      />
      <AtmosphericParticles count={40} color={COLORS.gold} opacity={0.3} />
      <ScanLines opacity={0.04} />
      <Vignette intensity={0.5} />

      {/* Golden glow pulse */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `radial-gradient(circle at 50% 40%, ${COLORS.gold}${Math.floor(glow * 40).toString(16).padStart(2, "0")} 0%, transparent 40%)`,
        }}
      />

      <CinematicTitle
        text="COLLECTIVE UNLOCK"
        subtitle="5 OF 7 VALIDATORS COMBINE KEYS"
        color={COLORS.gold}
        glowColor={COLORS.gold}
        position="bottom"
      />
    </AbsoluteFill>
  );
};

// Scene 8: The Victory - Protected execution
const Scene8_TheVictory: React.FC = () => {
  const frame = useCurrentFrame();
  const celebrationPulse = 0.3 + Math.sin(frame * 0.15) * 0.15;

  return (
    <AbsoluteFill>
      <CinematicImage
        src="diagrams/10-aptos-protection-dashboard.png"
        startScale={1}
        endScale={1.08}
        brightness={1.1}
        overlay={`radial-gradient(circle at center, ${COLORS.safeGlow} 0%, transparent 60%)`}
      />
      <AtmosphericParticles count={60} color={COLORS.safe} opacity={0.3} />
      <ScanLines opacity={0.03} />
      <Vignette intensity={0.4} />

      {/* Victory glow */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `radial-gradient(circle at center, ${COLORS.safe}${Math.floor(celebrationPulse * 50).toString(16).padStart(2, "0")} 0%, transparent 50%)`,
        }}
      />

      <CinematicTitle
        text="PROTECTED"
        subtitle="$0 MEV LOST • FAIR EXECUTION"
        color={COLORS.safe}
        glowColor={COLORS.safe}
        position="center"
      />

      <StatOverlay
        value="$0"
        label="MEV EXTRACTED"
        color={COLORS.safe}
        position={{ x: 20, y: 75 }}
        delay={20}
      />

      <StatOverlay
        value="100%"
        label="TRANSACTION VALUE PRESERVED"
        color={COLORS.safe}
        position={{ x: 80, y: 75 }}
        delay={30}
      />
    </AbsoluteFill>
  );
};

// Scene 9: The Comparison
const Scene9_TheComparison: React.FC = () => {
  return (
    <AbsoluteFill>
      <CinematicImage
        src="diagrams/21-transparent-vs-encrypted-spheres.png"
        startScale={1.05}
        endScale={1}
        brightness={1}
        overlay="linear-gradient(90deg, rgba(255,0,0,0.1) 0%, transparent 50%, rgba(0,255,136,0.1) 100%)"
      />
      <AtmosphericParticles count={40} color={COLORS.cyan} opacity={0.2} />
      <ScanLines opacity={0.04} />
      <Vignette intensity={0.6} />

      <CinematicTitle
        text="THE DIFFERENCE"
        subtitle="TRANSPARENT VS ENCRYPTED"
        color={COLORS.white}
        position="bottom"
      />

      <StatOverlay
        value="VISIBLE"
        label="EXPLOITABLE"
        color={COLORS.danger}
        position={{ x: 25, y: 30 }}
        delay={10}
      />

      <StatOverlay
        value="HIDDEN"
        label="PROTECTED"
        color={COLORS.safe}
        position={{ x: 75, y: 30 }}
        delay={20}
      />
    </AbsoluteFill>
  );
};

// Scene 10: Final - Aptos Hero
const Scene10_Finale: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const logoScale = spring({
    frame,
    fps,
    config: { damping: 15, stiffness: 100 },
  });

  return (
    <AbsoluteFill>
      <CinematicImage
        src="diagrams/aptos-hero.png"
        startScale={1.2}
        endScale={1}
        brightness={1.1}
        overlay={`radial-gradient(circle at center, ${COLORS.safeGlow} 0%, transparent 50%)`}
      />
      <AtmosphericParticles count={80} color={COLORS.safe} opacity={0.4} speed={0.5} />
      <ScanLines opacity={0.02} />
      <Vignette intensity={0.3} />

      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          transform: `scale(${logoScale})`,
        }}
      >
        <div
          style={{
            fontFamily: fonts.display,
            fontSize: 100,
            fontWeight: 900,
            background: `linear-gradient(135deg, ${COLORS.safe} 0%, ${COLORS.cyan} 50%, ${COLORS.safe} 100%)`,
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            textShadow: `0 0 60px ${COLORS.safe}`,
            letterSpacing: "0.1em",
          }}
        >
          APTOS
        </div>
        <div
          style={{
            fontFamily: "monospace",
            fontSize: 28,
            color: COLORS.white,
            marginTop: 20,
            opacity: 0.9,
            letterSpacing: "0.3em",
          }}
        >
          FIRST L1 WITH NATIVE MEV PROTECTION
        </div>
        <div
          style={{
            fontFamily: "monospace",
            fontSize: 18,
            color: COLORS.safe,
            marginTop: 30,
            opacity: 0.7,
            letterSpacing: "0.2em",
          }}
        >
          ENCRYPTED MEMPOOL • THRESHOLD CRYPTOGRAPHY
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ============== MAIN COMPOSITION ==============

export const CinematicEncryptedMempool: React.FC = () => {
  const { fps } = useVideoConfig();

  // Scene durations in seconds
  const sceneDurations = {
    mempool: 3,
    predators: 3.5,
    attack: 3,
    chaos: 2.5,
    solution: 3.5,
    ceremony: 3,
    lock: 3,
    victory: 4,
    comparison: 3,
    finale: 4,
  };

  // Calculate frame positions
  let currentFrame = 0;
  const getFrameRange = (duration: number) => {
    const start = currentFrame;
    currentFrame += fps * duration;
    return { from: start, duration: fps * duration };
  };

  return (
    <AbsoluteFill style={{ background: "#000" }}>
      <Sequence {...getFrameRange(sceneDurations.mempool)}>
        <Scene1_TheMempool />
      </Sequence>

      <Sequence {...getFrameRange(sceneDurations.predators)}>
        <Scene2_ThePredators />
      </Sequence>

      <Sequence {...getFrameRange(sceneDurations.attack)}>
        <Scene3_TheAttack />
      </Sequence>

      <Sequence {...getFrameRange(sceneDurations.chaos)}>
        <Scene4_TheChaos />
      </Sequence>

      <Sequence {...getFrameRange(sceneDurations.solution)}>
        <Scene5_TheSolution />
      </Sequence>

      <Sequence {...getFrameRange(sceneDurations.ceremony)}>
        <Scene6_TheCeremony />
      </Sequence>

      <Sequence {...getFrameRange(sceneDurations.lock)}>
        <Scene7_TheLock />
      </Sequence>

      <Sequence {...getFrameRange(sceneDurations.victory)}>
        <Scene8_TheVictory />
      </Sequence>

      <Sequence {...getFrameRange(sceneDurations.comparison)}>
        <Scene9_TheComparison />
      </Sequence>

      <Sequence {...getFrameRange(sceneDurations.finale)}>
        <Scene10_Finale />
      </Sequence>
    </AbsoluteFill>
  );
};
