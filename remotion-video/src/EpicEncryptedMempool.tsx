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
} from "remotion";
import { fonts } from "./styles/theme";

// ============== EPIC ANIMATED COMPONENTS ==============

// Flying transaction packet with trail
const TransactionPacket: React.FC<{
  id: number;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  delay: number;
  duration: number;
  color: string;
  encrypted?: boolean;
  intercepted?: boolean;
}> = ({ id, startX, startY, endX, endY, delay, duration, color, encrypted = false, intercepted = false }) => {
  const frame = useCurrentFrame();
  const localFrame = frame - delay;

  if (localFrame < 0 || localFrame > duration) return null;

  const progress = localFrame / duration;
  const easedProgress = Easing.inOut(Easing.cubic)(progress);

  // Bezier curve path for smooth motion
  const controlX = (startX + endX) / 2 + (random(`cx-${id}`) - 0.5) * 300;
  const controlY = (startY + endY) / 2 + (random(`cy-${id}`) - 0.5) * 200;

  const t = easedProgress;
  const x = (1 - t) * (1 - t) * startX + 2 * (1 - t) * t * controlX + t * t * endX;
  const y = (1 - t) * (1 - t) * startY + 2 * (1 - t) * t * controlY + t * t * endY;

  // Rotation based on direction
  const dx = endX - startX;
  const dy = endY - startY;
  const angle = Math.atan2(dy, dx) * (180 / Math.PI);

  const opacity = progress < 0.1 ? progress * 10 : progress > 0.9 ? (1 - progress) * 10 : 1;

  // Trail particles
  const trailCount = 8;
  const trails = Array.from({ length: trailCount }).map((_, i) => {
    const trailT = Math.max(0, t - i * 0.03);
    const trailX = (1 - trailT) * (1 - trailT) * startX + 2 * (1 - trailT) * trailT * controlX + trailT * trailT * endX;
    const trailY = (1 - trailT) * (1 - trailT) * startY + 2 * (1 - trailT) * trailT * controlY + trailT * trailT * endY;
    return { x: trailX, y: trailY, opacity: (1 - i / trailCount) * 0.5 };
  });

  const packetColor = intercepted ? "#ff3b30" : color;

  return (
    <>
      {/* Trail */}
      {trails.map((trail, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: trail.x,
            top: trail.y,
            width: 8 - i,
            height: 8 - i,
            borderRadius: "50%",
            backgroundColor: packetColor,
            opacity: trail.opacity * opacity,
            transform: "translate(-50%, -50%)",
            boxShadow: `0 0 ${10 - i}px ${packetColor}`,
          }}
        />
      ))}

      {/* Main packet */}
      <div
        style={{
          position: "absolute",
          left: x,
          top: y,
          transform: `translate(-50%, -50%) rotate(${angle}deg)`,
          opacity,
        }}
      >
        <div
          style={{
            width: encrypted ? 30 : 40,
            height: encrypted ? 20 : 16,
            background: encrypted
              ? `linear-gradient(90deg, #8b5cf6, #6366f1)`
              : `linear-gradient(90deg, ${packetColor}, ${packetColor}cc)`,
            borderRadius: encrypted ? 6 : 4,
            boxShadow: `0 0 20px ${encrypted ? "#8b5cf6" : packetColor}, 0 0 40px ${encrypted ? "#8b5cf680" : packetColor + "80"}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 10,
            color: "white",
            fontWeight: "bold",
          }}
        >
          {encrypted ? "🔒" : intercepted ? "❌" : "$"}
        </div>
      </div>
    </>
  );
};

// Scanning beam effect
const ScanningBeam: React.FC<{ color: string; speed?: number }> = ({ color, speed = 1 }) => {
  const frame = useCurrentFrame();
  const { height } = useVideoConfig();

  const y = (frame * 8 * speed) % (height + 200) - 100;

  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        top: y,
        height: 3,
        background: `linear-gradient(90deg, transparent, ${color}, transparent)`,
        boxShadow: `0 0 30px ${color}, 0 0 60px ${color}`,
        opacity: 0.8,
      }}
    />
  );
};

// MEV Bot character with scanning animation
const MEVBot: React.FC<{
  x: number;
  y: number;
  active: boolean;
  scanning: boolean;
  attacking: boolean;
}> = ({ x, y, active, scanning, attacking }) => {
  const frame = useCurrentFrame();

  const breathe = Math.sin(frame * 0.1) * 5;
  const scanRotation = scanning ? frame * 3 : 0;
  const pulseScale = attacking ? 1 + Math.sin(frame * 0.3) * 0.1 : 1;

  const eyeGlow = active ? 0.8 + Math.sin(frame * 0.2) * 0.2 : 0.3;

  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y + breathe,
        transform: `translate(-50%, -50%) scale(${pulseScale})`,
      }}
    >
      {/* Scanning cone */}
      {scanning && (
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: "100%",
            width: 0,
            height: 0,
            borderLeft: "150px solid transparent",
            borderRight: "150px solid transparent",
            borderTop: `300px solid rgba(255, 59, 48, ${0.1 + Math.sin(frame * 0.1) * 0.05})`,
            transform: `translateX(-50%) rotate(${scanRotation}deg)`,
            transformOrigin: "top center",
            filter: "blur(20px)",
          }}
        />
      )}

      {/* Bot body */}
      <div
        style={{
          width: 100,
          height: 100,
          background: attacking
            ? "linear-gradient(135deg, #ff3b30 0%, #cc0000 100%)"
            : "linear-gradient(135deg, #333 0%, #111 100%)",
          borderRadius: 20,
          border: `3px solid ${attacking ? "#ff3b30" : "#444"}`,
          boxShadow: attacking
            ? "0 0 40px #ff3b3080, inset 0 0 20px #ff3b3040"
            : "0 10px 40px rgba(0,0,0,0.5)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
        }}
      >
        {/* Eyes */}
        <div style={{ display: "flex", gap: 20 }}>
          {[0, 1].map((i) => (
            <div
              key={i}
              style={{
                width: 20,
                height: 20,
                borderRadius: "50%",
                backgroundColor: "#ff3b30",
                opacity: eyeGlow,
                boxShadow: `0 0 ${15 + Math.sin(frame * 0.15 + i) * 5}px #ff3b30`,
              }}
            />
          ))}
        </div>

        {/* Mouth/scanner */}
        <div
          style={{
            width: 40,
            height: 8,
            background: `linear-gradient(90deg, #ff3b30 ${scanning ? ((frame * 5) % 100) : 50}%, #333 ${scanning ? ((frame * 5) % 100) : 50}%)`,
            borderRadius: 4,
          }}
        />
      </div>

      {/* Label */}
      <div
        style={{
          position: "absolute",
          top: "110%",
          left: "50%",
          transform: "translateX(-50%)",
          fontFamily: "monospace",
          fontSize: 12,
          color: "#ff3b30",
          fontWeight: "bold",
          whiteSpace: "nowrap",
        }}
      >
        MEV BOT
      </div>
    </div>
  );
};

// Encryption transformation animation
const EncryptionTransform: React.FC<{
  progress: number; // 0-1
  x: number;
  y: number;
}> = ({ progress, x, y }) => {
  const frame = useCurrentFrame();

  const originalText = "SWAP 1000 USDC";
  const encryptedChars = "█▓▒░╔╗╚╝║═╬╣╠╦╩●◆◇○□";

  const displayText = originalText
    .split("")
    .map((char, i) => {
      const charProgress = progress * originalText.length - i;
      if (charProgress > 1) {
        return encryptedChars[Math.floor(random(`enc-${i}-${Math.floor(frame / 2)}`) * encryptedChars.length)];
      }
      return char;
    })
    .join("");

  const boxWidth = interpolate(progress, [0, 0.5, 1], [200, 180, 160]);
  const boxColor = interpolate(progress, [0, 0.5, 1], [0, 0.5, 1]);

  const bgColor = `rgb(${Math.floor(139 * boxColor)}, ${Math.floor(92 * boxColor)}, ${Math.floor(246 * boxColor)})`;
  const borderColor = progress > 0.5 ? "#8b5cf6" : "#00ff88";

  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        transform: "translate(-50%, -50%)",
      }}
    >
      {/* Encryption particles */}
      {progress > 0 && progress < 1 &&
        Array.from({ length: 20 }).map((_, i) => {
          const angle = (i / 20) * Math.PI * 2 + frame * 0.1;
          const radius = 80 + Math.sin(frame * 0.2 + i) * 20;
          const px = Math.cos(angle) * radius * progress;
          const py = Math.sin(angle) * radius * progress;
          const size = 3 + Math.random() * 3;

          return (
            <div
              key={i}
              style={{
                position: "absolute",
                left: px,
                top: py,
                width: size,
                height: size,
                borderRadius: "50%",
                backgroundColor: "#8b5cf6",
                opacity: 0.6,
                boxShadow: "0 0 10px #8b5cf6",
              }}
            />
          );
        })}

      {/* Main box */}
      <div
        style={{
          width: boxWidth,
          padding: "16px 24px",
          background: progress > 0.8 ? "linear-gradient(135deg, #8b5cf680, #6366f180)" : `${bgColor}40`,
          border: `2px solid ${borderColor}`,
          borderRadius: 12,
          boxShadow: `0 0 ${20 + progress * 20}px ${borderColor}60`,
        }}
      >
        <div
          style={{
            fontFamily: "monospace",
            fontSize: 16,
            color: progress > 0.8 ? "#8b5cf6" : "white",
            textAlign: "center",
            letterSpacing: progress > 0.5 ? "0.1em" : "0",
          }}
        >
          {progress > 0.95 ? "🔒 ENCRYPTED" : displayText}
        </div>
      </div>
    </div>
  );
};

// Validator node with connection animation
const ValidatorNode: React.FC<{
  x: number;
  y: number;
  id: number;
  active: boolean;
  contributing: boolean;
  isLeader?: boolean;
}> = ({ x, y, id, active, contributing, isLeader = false }) => {
  const frame = useCurrentFrame();

  const pulse = active ? 1 + Math.sin(frame * 0.15) * 0.1 : 1;
  const glow = contributing ? 30 + Math.sin(frame * 0.2) * 10 : 10;

  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        transform: `translate(-50%, -50%) scale(${pulse})`,
      }}
    >
      {/* Connection pulse ring */}
      {contributing && (
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            width: 100 + (frame % 30) * 3,
            height: 100 + (frame % 30) * 3,
            borderRadius: "50%",
            border: "2px solid #00d9a5",
            transform: "translate(-50%, -50%)",
            opacity: 1 - (frame % 30) / 30,
          }}
        />
      )}

      {/* Node */}
      <div
        style={{
          width: isLeader ? 80 : 60,
          height: isLeader ? 80 : 60,
          borderRadius: "50%",
          background: contributing
            ? "linear-gradient(135deg, #00d9a5 0%, #00a080 100%)"
            : active
              ? "linear-gradient(135deg, #333 0%, #222 100%)"
              : "#1a1a1a",
          border: `3px solid ${contributing ? "#00d9a5" : active ? "#444" : "#333"}`,
          boxShadow: contributing
            ? `0 0 ${glow}px #00d9a5, inset 0 0 20px #00d9a540`
            : "0 5px 20px rgba(0,0,0,0.3)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "monospace",
          fontSize: isLeader ? 16 : 14,
          fontWeight: "bold",
          color: contributing ? "#000" : "#666",
        }}
      >
        V{id}
      </div>

      {isLeader && (
        <div
          style={{
            position: "absolute",
            top: -25,
            left: "50%",
            transform: "translateX(-50%)",
            fontFamily: "monospace",
            fontSize: 10,
            color: "#ffd700",
            fontWeight: "bold",
          }}
        >
          LEADER
        </div>
      )}

      {/* Key fragment */}
      {contributing && (
        <div
          style={{
            position: "absolute",
            top: "110%",
            left: "50%",
            transform: "translateX(-50%)",
            padding: "4px 8px",
            background: "#00d9a520",
            borderRadius: 4,
            fontFamily: "monospace",
            fontSize: 10,
            color: "#00d9a5",
          }}
        >
          🔑 KEY_{id}
        </div>
      )}
    </div>
  );
};

// Key assembly animation
const KeyAssembly: React.FC<{
  progress: number;
  centerX: number;
  centerY: number;
  keyCount: number;
  threshold: number;
}> = ({ progress, centerX, centerY, keyCount, threshold }) => {
  const frame = useCurrentFrame();

  const keysToShow = Math.min(Math.floor(progress * (keyCount + 1)), threshold);
  const assemblyComplete = keysToShow >= threshold;

  const finalScale = assemblyComplete ? 1 + Math.sin(frame * 0.15) * 0.05 : 1;

  return (
    <div
      style={{
        position: "absolute",
        left: centerX,
        top: centerY,
        transform: "translate(-50%, -50%)",
      }}
    >
      {/* Assembling key fragments */}
      {Array.from({ length: keysToShow }).map((_, i) => {
        const angle = (i / threshold) * Math.PI * 2 - Math.PI / 2;
        const radius = assemblyComplete ? 0 : 80;
        const x = Math.cos(angle) * radius;
        const y = Math.sin(angle) * radius;

        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: x,
              top: y,
              width: 30,
              height: 30,
              background: "linear-gradient(135deg, #ffd700 0%, #ffaa00 100%)",
              borderRadius: assemblyComplete ? "50%" : 8,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 16,
              boxShadow: `0 0 20px #ffd70080`,
              transform: `scale(${assemblyComplete ? 0 : 1})`,
              transition: "transform 0.3s ease",
            }}
          >
            🔑
          </div>
        );
      })}

      {/* Final assembled key/lock */}
      {assemblyComplete && (
        <div
          style={{
            width: 100,
            height: 100,
            background: "linear-gradient(135deg, #ffd700 0%, #00d9a5 100%)",
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 48,
            boxShadow: `0 0 ${40 + Math.sin(frame * 0.2) * 20}px #ffd700, 0 0 80px #00d9a560`,
            transform: `scale(${finalScale})`,
          }}
        >
          🔓
        </div>
      )}

      {/* Progress indicator */}
      <div
        style={{
          position: "absolute",
          top: 70,
          left: "50%",
          transform: "translateX(-50%)",
          fontFamily: "monospace",
          fontSize: 14,
          color: assemblyComplete ? "#00d9a5" : "#ffd700",
          fontWeight: "bold",
        }}
      >
        {keysToShow}/{threshold} KEYS
      </div>
    </div>
  );
};

// Explosion effect
const Explosion: React.FC<{
  x: number;
  y: number;
  color: string;
  particleCount?: number;
}> = ({ x, y, color, particleCount = 50 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const progress = Math.min(frame / (fps * 1.5), 1);

  return (
    <>
      {Array.from({ length: particleCount }).map((_, i) => {
        const angle = random(`exp-angle-${i}`) * Math.PI * 2;
        const speed = 200 + random(`exp-speed-${i}`) * 400;
        const size = 4 + random(`exp-size-${i}`) * 12;

        const distance = speed * Easing.out(Easing.cubic)(progress);
        const px = x + Math.cos(angle) * distance;
        const py = y + Math.sin(angle) * distance;

        const opacity = 1 - progress;

        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: px,
              top: py,
              width: size * (1 - progress * 0.5),
              height: size * (1 - progress * 0.5),
              borderRadius: "50%",
              backgroundColor: color,
              opacity,
              boxShadow: `0 0 ${size}px ${color}`,
              transform: "translate(-50%, -50%)",
            }}
          />
        );
      })}

      {/* Central flash */}
      {progress < 0.3 && (
        <div
          style={{
            position: "absolute",
            left: x,
            top: y,
            width: 200 * (1 - progress * 3),
            height: 200 * (1 - progress * 3),
            borderRadius: "50%",
            background: `radial-gradient(circle, ${color} 0%, transparent 70%)`,
            transform: "translate(-50%, -50%)",
            opacity: 1 - progress * 3,
          }}
        />
      )}
    </>
  );
};

// Animated counter with rolling effect
const RollingCounter: React.FC<{
  value: number;
  prefix?: string;
  suffix?: string;
  color: string;
  fontSize?: number;
}> = ({ value, prefix = "", suffix = "", color, fontSize = 72 }) => {
  const displayValue = Math.floor(value);

  return (
    <div
      style={{
        fontFamily: "monospace",
        fontSize,
        fontWeight: 900,
        color,
        textShadow: `0 0 30px ${color}, 0 0 60px ${color}80`,
      }}
    >
      {prefix}
      {displayValue.toLocaleString()}
      {suffix}
    </div>
  );
};

// ============== SCENE COMPOSITIONS ==============

// Scene 1: The Hunt - MEV Bot scanning the mempool
const Scene1_TheHunt: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  const scanActive = frame > fps * 0.5;
  const botAttacking = frame > fps * 2.5;

  // Generate flying transactions
  const transactions = Array.from({ length: 12 }).map((_, i) => ({
    id: i,
    startX: random(`tx-sx-${i}`) * width,
    startY: -50,
    endX: random(`tx-ex-${i}`) * width,
    endY: height + 50,
    delay: i * 8 + 10,
    duration: 60,
    intercepted: botAttacking && i === 5,
  }));

  return (
    <AbsoluteFill style={{ background: "#0a0a0f" }}>
      {/* Grid background */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          opacity: 0.1,
          background: `
            linear-gradient(#ff3b3020 1px, transparent 1px),
            linear-gradient(90deg, #ff3b3020 1px, transparent 1px)
          `,
          backgroundSize: "50px 50px",
        }}
      />

      {/* Scanning beam */}
      {scanActive && <ScanningBeam color="#ff3b30" speed={1.5} />}

      {/* Flying transactions */}
      {transactions.map((tx) => (
        <TransactionPacket
          key={tx.id}
          {...tx}
          color="#00ff88"
        />
      ))}

      {/* MEV Bot */}
      <MEVBot
        x={width / 2}
        y={height / 2}
        active={true}
        scanning={scanActive}
        attacking={botAttacking}
      />

      {/* Title */}
      <div
        style={{
          position: "absolute",
          bottom: 80,
          left: 0,
          right: 0,
          textAlign: "center",
        }}
      >
        <div
          style={{
            fontFamily: fonts.display,
            fontSize: 64,
            fontWeight: 800,
            color: "#ff3b30",
            textShadow: "0 0 40px #ff3b3080",
          }}
        >
          THE HUNT
        </div>
        <div
          style={{
            fontFamily: "monospace",
            fontSize: 20,
            color: "#888",
            marginTop: 10,
          }}
        >
          MEV BOTS SCAN FOR PROFITABLE TRANSACTIONS
        </div>
      </div>

      {/* Danger indicator */}
      {botAttacking && (
        <div
          style={{
            position: "absolute",
            top: 40,
            right: 60,
            padding: "12px 24px",
            background: "#ff3b3030",
            border: "2px solid #ff3b30",
            borderRadius: 8,
            fontFamily: "monospace",
            fontSize: 16,
            color: "#ff3b30",
            boxShadow: `0 0 20px #ff3b3060`,
          }}
        >
          ⚠️ FRONT-RUN DETECTED
        </div>
      )}
    </AbsoluteFill>
  );
};

// Scene 2: The Encryption - Transaction gets encrypted
const Scene2_TheEncryption: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  const encryptProgress = interpolate(frame, [fps * 0.5, fps * 2.5], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const showShield = frame > fps * 2.8;

  return (
    <AbsoluteFill style={{ background: "#0a0a15" }}>
      {/* Purple gradient background */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `radial-gradient(circle at 50% 50%, #8b5cf620 0%, transparent 60%)`,
        }}
      />

      {/* Encryption animation */}
      <EncryptionTransform
        progress={encryptProgress}
        x={width / 2}
        y={height / 2}
      />

      {/* Shield effect */}
      {showShield && (
        <div
          style={{
            position: "absolute",
            left: width / 2,
            top: height / 2,
            transform: "translate(-50%, -50%)",
          }}
        >
          {/* Hexagonal shield */}
          {Array.from({ length: 6 }).map((_, i) => {
            const angle = (i / 6) * Math.PI * 2;
            const radius = 150 + Math.sin(frame * 0.1 + i) * 10;
            const x = Math.cos(angle) * radius;
            const y = Math.sin(angle) * radius;

            return (
              <div
                key={i}
                style={{
                  position: "absolute",
                  left: x,
                  top: y,
                  width: 20,
                  height: 20,
                  background: "#8b5cf6",
                  borderRadius: 4,
                  boxShadow: "0 0 20px #8b5cf6",
                  transform: "translate(-50%, -50%) rotate(45deg)",
                }}
              />
            );
          })}
        </div>
      )}

      {/* Title */}
      <div
        style={{
          position: "absolute",
          bottom: 80,
          left: 0,
          right: 0,
          textAlign: "center",
        }}
      >
        <div
          style={{
            fontFamily: fonts.display,
            fontSize: 64,
            fontWeight: 800,
            color: "#8b5cf6",
            textShadow: "0 0 40px #8b5cf680",
          }}
        >
          ENCRYPTED
        </div>
        <div
          style={{
            fontFamily: "monospace",
            fontSize: 20,
            color: "#888",
            marginTop: 10,
          }}
        >
          TRANSACTION CONTENT BECOMES INVISIBLE
        </div>
      </div>
    </AbsoluteFill>
  );
};

// Scene 3: The Validators - Threshold decryption ceremony
const Scene3_TheValidators: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  const validatorCount = 7;
  const threshold = 5;

  const validators = Array.from({ length: validatorCount }).map((_, i) => {
    const angle = (i / validatorCount) * Math.PI * 2 - Math.PI / 2;
    const radius = 250;
    return {
      id: i + 1,
      x: width / 2 + Math.cos(angle) * radius,
      y: height / 2 + Math.sin(angle) * radius,
      active: frame > fps * 0.3 + i * 5,
      contributing: frame > fps * 1 + i * 10,
      isLeader: i === 0,
    };
  });

  const assemblyProgress = interpolate(frame, [fps * 1.5, fps * 3.5], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ background: "#050a0f" }}>
      {/* Network lines */}
      <svg
        style={{ position: "absolute", inset: 0 }}
        viewBox={`0 0 ${width} ${height}`}
      >
        {validators.map((v1, i) =>
          validators.slice(i + 1).map((v2, j) => {
            const lineOpacity = v1.contributing && v2.contributing ? 0.5 : 0.1;
            return (
              <line
                key={`${i}-${j}`}
                x1={v1.x}
                y1={v1.y}
                x2={v2.x}
                y2={v2.y}
                stroke="#00d9a5"
                strokeWidth={v1.contributing && v2.contributing ? 2 : 1}
                opacity={lineOpacity}
              />
            );
          })
        )}
      </svg>

      {/* Validators */}
      {validators.map((v) => (
        <ValidatorNode key={v.id} {...v} />
      ))}

      {/* Key assembly in center */}
      <KeyAssembly
        progress={assemblyProgress}
        centerX={width / 2}
        centerY={height / 2}
        keyCount={validatorCount}
        threshold={threshold}
      />

      {/* Title */}
      <div
        style={{
          position: "absolute",
          bottom: 60,
          left: 0,
          right: 0,
          textAlign: "center",
        }}
      >
        <div
          style={{
            fontFamily: fonts.display,
            fontSize: 56,
            fontWeight: 800,
            color: "#00d9a5",
            textShadow: "0 0 40px #00d9a580",
          }}
        >
          COLLECTIVE UNLOCK
        </div>
        <div
          style={{
            fontFamily: "monospace",
            fontSize: 18,
            color: "#888",
            marginTop: 10,
          }}
        >
          {`>`}2/3 VALIDATORS COMBINE KEY SHARES
        </div>
      </div>
    </AbsoluteFill>
  );
};

// Scene 4: The Victory - Protected execution
const Scene4_TheVictory: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  const showExplosion = frame > fps * 0.5;
  const counterValue = interpolate(frame, [fps, fps * 2], [0, 0], {
    extrapolateRight: "clamp",
  });

  const savedValue = interpolate(frame, [fps * 1.5, fps * 2.5], [0, 847], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ background: "#050f0a" }}>
      {/* Success glow */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `radial-gradient(circle at 50% 50%, #00ff8830 0%, transparent 60%)`,
        }}
      />

      {/* Victory explosion */}
      {showExplosion && (
        <Explosion
          x={width / 2}
          y={height / 2}
          color="#00ff88"
          particleCount={80}
        />
      )}

      {/* Stats */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          transform: "translate(-50%, -50%)",
          textAlign: "center",
        }}
      >
        <div
          style={{
            fontFamily: fonts.display,
            fontSize: 120,
            fontWeight: 900,
            color: "#00ff88",
            textShadow: "0 0 60px #00ff88, 0 0 120px #00ff8880",
          }}
        >
          $0
        </div>
        <div
          style={{
            fontFamily: "monospace",
            fontSize: 24,
            color: "#00ff88",
            marginTop: 10,
          }}
        >
          MEV EXTRACTED
        </div>

        {/* Comparison */}
        <div
          style={{
            display: "flex",
            gap: 80,
            marginTop: 60,
            justifyContent: "center",
          }}
        >
          <div style={{ textAlign: "center" }}>
            <div
              style={{
                fontFamily: "monospace",
                fontSize: 48,
                fontWeight: 700,
                color: "#ff3b30",
                textDecoration: "line-through",
                opacity: 0.6,
              }}
            >
              -${Math.floor(savedValue)}
            </div>
            <div style={{ fontFamily: "monospace", fontSize: 14, color: "#888" }}>
              WITHOUT ENCRYPTION
            </div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div
              style={{
                fontFamily: "monospace",
                fontSize: 48,
                fontWeight: 700,
                color: "#00ff88",
              }}
            >
              +${Math.floor(savedValue)}
            </div>
            <div style={{ fontFamily: "monospace", fontSize: 14, color: "#888" }}>
              SAVED WITH APTOS
            </div>
          </div>
        </div>
      </div>

      {/* Title */}
      <div
        style={{
          position: "absolute",
          top: 60,
          left: 0,
          right: 0,
          textAlign: "center",
        }}
      >
        <div
          style={{
            fontFamily: fonts.display,
            fontSize: 64,
            fontWeight: 800,
            color: "#00ff88",
            textShadow: "0 0 40px #00ff8880",
          }}
        >
          ✓ PROTECTED
        </div>
      </div>
    </AbsoluteFill>
  );
};

// Scene 5: Finale
const Scene5_Finale: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  const logoScale = spring({
    frame,
    fps,
    config: { damping: 12, stiffness: 80 },
  });

  // Orbiting particles
  const orbitCount = 30;

  return (
    <AbsoluteFill style={{ background: "#000" }}>
      {/* Orbiting particles */}
      {Array.from({ length: orbitCount }).map((_, i) => {
        const baseAngle = (i / orbitCount) * Math.PI * 2;
        const angle = baseAngle + frame * 0.02;
        const radius = 300 + Math.sin(frame * 0.05 + i) * 50;
        const x = width / 2 + Math.cos(angle) * radius;
        const y = height / 2 + Math.sin(angle) * radius * 0.4;
        const size = 4 + Math.sin(i) * 2;

        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: x,
              top: y,
              width: size,
              height: size,
              borderRadius: "50%",
              backgroundColor: i % 2 === 0 ? "#00d9a5" : "#00ff88",
              boxShadow: `0 0 ${size * 2}px ${i % 2 === 0 ? "#00d9a5" : "#00ff88"}`,
              transform: "translate(-50%, -50%)",
            }}
          />
        );
      })}

      {/* Central content */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          transform: `translate(-50%, -50%) scale(${logoScale})`,
          textAlign: "center",
        }}
      >
        <div
          style={{
            fontFamily: fonts.display,
            fontSize: 140,
            fontWeight: 900,
            background: "linear-gradient(135deg, #00d9a5 0%, #00ff88 50%, #00d4ff 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            filter: "drop-shadow(0 0 60px #00d9a580)",
          }}
        >
          APTOS
        </div>
        <div
          style={{
            fontFamily: "monospace",
            fontSize: 28,
            color: "white",
            marginTop: 20,
            letterSpacing: "0.2em",
          }}
        >
          ENCRYPTED MEMPOOL
        </div>
        <div
          style={{
            fontFamily: "monospace",
            fontSize: 18,
            color: "#00d9a5",
            marginTop: 30,
            letterSpacing: "0.15em",
          }}
        >
          FIRST L1 WITH NATIVE MEV PROTECTION
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ============== MAIN COMPOSITION ==============

export const EpicEncryptedMempool: React.FC = () => {
  const { fps } = useVideoConfig();

  return (
    <AbsoluteFill style={{ background: "#000" }}>
      <Sequence from={0} durationInFrames={fps * 4}>
        <Scene1_TheHunt />
      </Sequence>

      <Sequence from={fps * 4} durationInFrames={fps * 4}>
        <Scene2_TheEncryption />
      </Sequence>

      <Sequence from={fps * 8} durationInFrames={fps * 5}>
        <Scene3_TheValidators />
      </Sequence>

      <Sequence from={fps * 13} durationInFrames={fps * 4}>
        <Scene4_TheVictory />
      </Sequence>

      <Sequence from={fps * 17} durationInFrames={fps * 4}>
        <Scene5_Finale />
      </Sequence>
    </AbsoluteFill>
  );
};
