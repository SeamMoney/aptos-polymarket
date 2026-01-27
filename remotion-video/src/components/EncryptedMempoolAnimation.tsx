import React from "react";
import {
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
  Easing,
  random,
} from "remotion";
import { colors, fonts, springs } from "../styles/theme";

interface EncryptedMempoolAnimationProps {
  startFrame?: number;
  cycleDuration?: number; // in frames
}

// Color constants matching aptos-consensus-visualizer style
const COLORS = {
  bg: "#000000",
  green: "#00ff88",
  greenBright: "#00ff88",
  cyan: "#00d4ff",
  red: "#ff3b30",
  orange: "#ff9500",
  yellow: "#ffcc00",
  aptosTeal: "#00d9a5",
  purple: "#8b5cf6",
  textPrimary: "#ffffff",
  textMuted: "#888888",
  textDim: "#555555",
  encrypted: "#8b5cf6", // Purple for encrypted state
  validator: "#00d9a5",
  mevBot: "#ff3b30",
};

// Phase configuration (matching consensus-visualizer pattern)
const PHASES = {
  TRADITIONAL: { start: 0.0, end: 0.18, label: "PUBLIC MEMPOOL", color: COLORS.red },
  ENCRYPT: { start: 0.18, end: 0.35, label: "ENCRYPTION", color: COLORS.purple },
  ORDERING: { start: 0.35, end: 0.55, label: "BLIND ORDERING", color: COLORS.cyan },
  DECRYPT: { start: 0.55, end: 0.78, label: "THRESHOLD DECRYPT", color: COLORS.aptosTeal },
  EXECUTE: { start: 0.78, end: 1.0, label: "FAIR EXECUTION", color: COLORS.green },
};

export const EncryptedMempoolAnimation: React.FC<EncryptedMempoolAnimationProps> = ({
  startFrame = 0,
  cycleDuration = 300, // 10 seconds at 30fps
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  const localFrame = frame - startFrame;
  if (localFrame < 0) return null;

  const progress = (localFrame % cycleDuration) / cycleDuration;

  // Determine current phase
  const currentPhase = Object.entries(PHASES).find(
    ([_, p]) => progress >= p.start && progress < p.end
  );
  const phaseName = currentPhase?.[0] || "EXECUTE";
  const phaseConfig = currentPhase?.[1] || PHASES.EXECUTE;

  // Phase-specific progress (0-1 within each phase)
  const phaseProgress =
    (progress - phaseConfig.start) / (phaseConfig.end - phaseConfig.start);

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        background: COLORS.bg,
        overflow: "hidden",
      }}
    >
      {/* Background grid */}
      <BackgroundGrid />

      {/* Phase indicator at top */}
      <PhaseIndicator
        phases={PHASES}
        currentPhase={phaseName}
        progress={progress}
      />

      {/* Main visualization area */}
      <div
        style={{
          position: "absolute",
          top: 100,
          left: 0,
          right: 0,
          bottom: 80,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {/* Phase 1: Traditional Mempool - Show MEV attack */}
        {phaseName === "TRADITIONAL" && (
          <TraditionalMempool progress={phaseProgress} localFrame={localFrame} />
        )}

        {/* Phase 2: Encryption - User encrypts transaction */}
        {phaseName === "ENCRYPT" && (
          <EncryptionPhase progress={phaseProgress} localFrame={localFrame} />
        )}

        {/* Phase 3: Blind Ordering - Validators order without seeing content */}
        {phaseName === "ORDERING" && (
          <BlindOrderingPhase progress={phaseProgress} localFrame={localFrame} />
        )}

        {/* Phase 4: Threshold Decryption - Collective reveal */}
        {phaseName === "DECRYPT" && (
          <ThresholdDecryptPhase progress={phaseProgress} localFrame={localFrame} />
        )}

        {/* Phase 5: Fair Execution - Transaction completes */}
        {phaseName === "EXECUTE" && (
          <FairExecutionPhase progress={phaseProgress} localFrame={localFrame} />
        )}
      </div>

      {/* Bottom progress bar */}
      <ProgressBar progress={progress} phaseColor={phaseConfig.color} />

      {/* Caption */}
      <Caption phase={phaseName} />
    </div>
  );
};

// Background grid matching consensus-visualizer style
const BackgroundGrid: React.FC = () => (
  <div
    style={{
      position: "absolute",
      inset: 0,
      opacity: 0.05,
      background: `
        linear-gradient(${COLORS.aptosTeal}40 1px, transparent 1px),
        linear-gradient(90deg, ${COLORS.aptosTeal}40 1px, transparent 1px)
      `,
      backgroundSize: "40px 40px",
    }}
  />
);

// Phase indicator at top
const PhaseIndicator: React.FC<{
  phases: typeof PHASES;
  currentPhase: string;
  progress: number;
}> = ({ phases, currentPhase, progress }) => (
  <div
    style={{
      position: "absolute",
      top: 30,
      left: 60,
      right: 60,
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
    }}
  >
    {Object.entries(phases).map(([name, config], i) => {
      const isActive = name === currentPhase;
      const isComplete = progress > config.end;

      return (
        <div
          key={name}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            opacity: isActive ? 1 : isComplete ? 0.6 : 0.3,
          }}
        >
          <div
            style={{
              width: 12,
              height: 12,
              borderRadius: "50%",
              backgroundColor: isActive || isComplete ? config.color : COLORS.textDim,
              boxShadow: isActive ? `0 0 15px ${config.color}` : "none",
            }}
          />
          <span
            style={{
              fontFamily: "monospace",
              fontSize: 11,
              fontWeight: 600,
              color: isActive ? config.color : COLORS.textMuted,
              letterSpacing: "0.05em",
            }}
          >
            {config.label}
          </span>
        </div>
      );
    })}
  </div>
);

// Progress bar at bottom
const ProgressBar: React.FC<{ progress: number; phaseColor: string }> = ({
  progress,
  phaseColor,
}) => (
  <div
    style={{
      position: "absolute",
      bottom: 30,
      left: 60,
      right: 60,
      height: 4,
      background: `${COLORS.textDim}40`,
      borderRadius: 2,
    }}
  >
    <div
      style={{
        width: `${progress * 100}%`,
        height: "100%",
        background: phaseColor,
        borderRadius: 2,
        boxShadow: `0 0 10px ${phaseColor}`,
      }}
    />
  </div>
);

// Caption text
const Caption: React.FC<{ phase: string }> = ({ phase }) => {
  const captions: Record<string, string> = {
    TRADITIONAL: "MEV bots exploit visible transactions in public mempools",
    ENCRYPT: "Users encrypt transactions before submission",
    ORDERING: "Validators order transactions without seeing content",
    DECRYPT: ">2/3 validators collaborate to decrypt",
    EXECUTE: "Transactions execute in original order - MEV prevented",
  };

  return (
    <div
      style={{
        position: "absolute",
        bottom: 50,
        left: 0,
        right: 0,
        textAlign: "center",
        fontFamily: "monospace",
        fontSize: 14,
        color: COLORS.textMuted,
      }}
    >
      {captions[phase]}
    </div>
  );
};

// ============== PHASE COMPONENTS ==============

// Phase 1: Traditional Mempool with MEV attack
const TraditionalMempool: React.FC<{ progress: number; localFrame: number }> = ({
  progress,
  localFrame,
}) => {
  const entranceProgress = Math.min(progress * 3, 1);
  const mevAttackProgress = Math.max(0, (progress - 0.4) / 0.6);

  // Generate visible transactions
  const transactions = [
    { id: "0x7a3f...", type: "SWAP", amount: "$5,000", y: -100 },
    { id: "0x9b2e...", type: "BUY", amount: "$12,500", y: 0 },
    { id: "0x4c8d...", type: "SELL", amount: "$8,200", y: 100 },
  ];

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 40,
        opacity: entranceProgress,
      }}
    >
      {/* Mempool container */}
      <div
        style={{
          position: "relative",
          width: 600,
          padding: "30px 40px",
          background: `${COLORS.red}10`,
          border: `2px solid ${COLORS.red}40`,
          borderRadius: 16,
        }}
      >
        <div
          style={{
            position: "absolute",
            top: -12,
            left: 20,
            padding: "4px 12px",
            background: COLORS.bg,
            fontFamily: "monospace",
            fontSize: 12,
            color: COLORS.red,
          }}
        >
          PUBLIC MEMPOOL (VISIBLE)
        </div>

        {/* Transactions */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {transactions.map((tx, i) => (
            <TransactionBox
              key={i}
              tx={tx}
              visible={true}
              color={COLORS.textPrimary}
              delay={i * 0.1}
              progress={entranceProgress}
            />
          ))}
        </div>

        {/* MEV Bot watching */}
        <div
          style={{
            position: "absolute",
            right: -180,
            top: "50%",
            transform: `translateY(-50%) scale(${0.8 + entranceProgress * 0.2})`,
            opacity: entranceProgress,
          }}
        >
          <MEVBot active={mevAttackProgress > 0} attacking={mevAttackProgress > 0.5} />
        </div>
      </div>

      {/* MEV Attack visualization */}
      {mevAttackProgress > 0 && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 20,
            opacity: mevAttackProgress,
            transform: `translateY(${(1 - mevAttackProgress) * 20}px)`,
          }}
        >
          <div
            style={{
              padding: "12px 24px",
              background: `${COLORS.red}20`,
              border: `2px solid ${COLORS.red}`,
              borderRadius: 8,
              fontFamily: "monospace",
              fontSize: 14,
              color: COLORS.red,
              boxShadow: `0 0 20px ${COLORS.red}40`,
            }}
          >
            🚨 FRONT-RUN DETECTED
          </div>
          <div
            style={{
              fontFamily: "monospace",
              fontSize: 24,
              fontWeight: 700,
              color: COLORS.red,
            }}
          >
            -$847 LOST
          </div>
        </div>
      )}
    </div>
  );
};

// Phase 2: Encryption
const EncryptionPhase: React.FC<{ progress: number; localFrame: number }> = ({
  progress,
  localFrame,
}) => {
  const encryptProgress = Math.min(progress * 2, 1);
  const scrambleProgress = Math.max(0, (progress - 0.3) / 0.4);
  const completeProgress = Math.max(0, (progress - 0.7) / 0.3);

  // Original transaction text
  const originalTx = "SWAP 1000 USDC → APT";
  // Encrypted version (gradually scrambles)
  const encryptedChars = "█▓▒░╔╗╚╝║═╬╣╠╦╩";

  const displayText = originalTx
    .split("")
    .map((char, i) => {
      const charProgress = (scrambleProgress * originalTx.length - i) / 3;
      if (charProgress > 1) {
        return encryptedChars[Math.floor(random(`char-${i}`) * encryptedChars.length)];
      }
      return char;
    })
    .join("");

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 60,
      }}
    >
      {/* User icon */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 30,
          opacity: encryptProgress,
        }}
      >
        <div
          style={{
            width: 80,
            height: 80,
            borderRadius: "50%",
            background: `linear-gradient(135deg, ${COLORS.aptosTeal}40, ${COLORS.cyan}40)`,
            border: `2px solid ${COLORS.aptosTeal}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 36,
          }}
        >
          👤
        </div>

        {/* Arrow */}
        <div
          style={{
            width: 60,
            height: 4,
            background: `linear-gradient(90deg, ${COLORS.aptosTeal}, ${COLORS.purple})`,
            position: "relative",
          }}
        >
          <div
            style={{
              position: "absolute",
              right: -8,
              top: -6,
              width: 0,
              height: 0,
              borderLeft: `12px solid ${COLORS.purple}`,
              borderTop: "8px solid transparent",
              borderBottom: "8px solid transparent",
            }}
          />
        </div>

        {/* Lock icon */}
        <div
          style={{
            width: 80,
            height: 80,
            borderRadius: 16,
            background: `${COLORS.purple}20`,
            border: `2px solid ${COLORS.purple}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 36,
            boxShadow: `0 0 30px ${COLORS.purple}40`,
          }}
        >
          🔐
        </div>
      </div>

      {/* Transaction transforming */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 20,
        }}
      >
        {/* Original (fading out) */}
        <div
          style={{
            padding: "16px 32px",
            background: `${COLORS.green}15`,
            border: `2px solid ${COLORS.green}40`,
            borderRadius: 8,
            fontFamily: "monospace",
            fontSize: 18,
            color: COLORS.green,
            opacity: 1 - scrambleProgress,
          }}
        >
          {originalTx}
        </div>

        {/* Encrypting */}
        <div
          style={{
            padding: "16px 32px",
            background: `${COLORS.purple}15`,
            border: `2px solid ${COLORS.purple}`,
            borderRadius: 8,
            fontFamily: "monospace",
            fontSize: 18,
            color: COLORS.purple,
            opacity: scrambleProgress > 0 ? 1 : 0,
            boxShadow: `0 0 20px ${COLORS.purple}40`,
            letterSpacing: "0.1em",
          }}
        >
          {scrambleProgress > 0.9 ? "🔒 ENCRYPTED CIPHERTEXT" : displayText}
        </div>
      </div>

      {/* DKG Public Key info */}
      {completeProgress > 0 && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            opacity: completeProgress,
            fontFamily: "monospace",
            fontSize: 12,
            color: COLORS.textMuted,
          }}
        >
          <span>Encrypted with</span>
          <span style={{ color: COLORS.aptosTeal }}>EPOCH_42_PUBLIC_KEY</span>
        </div>
      )}
    </div>
  );
};

// Phase 3: Blind Ordering
const BlindOrderingPhase: React.FC<{ progress: number; localFrame: number }> = ({
  progress,
  localFrame,
}) => {
  const validators = 7;
  const orderedProgress = Math.min(progress * 1.5, 1);

  // Encrypted transactions in mempool
  const encryptedTxs = [
    { id: 1, order: null as number | null },
    { id: 2, order: null as number | null },
    { id: 3, order: null as number | null },
  ];

  // Assign order based on progress
  encryptedTxs.forEach((tx, i) => {
    if (orderedProgress > (i + 1) * 0.25) {
      tx.order = i + 1;
    }
  });

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 40,
      }}
    >
      {/* Validator ring */}
      <div
        style={{
          position: "relative",
          width: 400,
          height: 250,
        }}
      >
        {/* Validators in arc */}
        {Array.from({ length: validators }).map((_, i) => {
          const angle = Math.PI + (i / (validators - 1)) * Math.PI;
          const radius = 150;
          const x = 200 + Math.cos(angle) * radius;
          const y = 180 + Math.sin(angle) * radius * 0.6;
          const isLeader = i === 3;

          return (
            <div
              key={i}
              style={{
                position: "absolute",
                left: x - 25,
                top: y - 25,
                width: 50,
                height: 50,
                borderRadius: "50%",
                background: isLeader
                  ? `linear-gradient(135deg, ${COLORS.aptosTeal}, ${COLORS.cyan})`
                  : `${COLORS.aptosTeal}30`,
                border: `2px solid ${COLORS.aptosTeal}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontFamily: "monospace",
                fontSize: 12,
                color: isLeader ? COLORS.bg : COLORS.aptosTeal,
                fontWeight: isLeader ? 700 : 400,
                boxShadow: isLeader ? `0 0 20px ${COLORS.aptosTeal}` : "none",
              }}
            >
              V{i + 1}
              {isLeader && (
                <div
                  style={{
                    position: "absolute",
                    top: -20,
                    fontSize: 10,
                    color: COLORS.aptosTeal,
                  }}
                >
                  LEADER
                </div>
              )}
            </div>
          );
        })}

        {/* Center: Encrypted mempool */}
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: 60,
            transform: "translateX(-50%)",
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
          {encryptedTxs.map((tx, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
              }}
            >
              <div
                style={{
                  padding: "8px 16px",
                  background: `${COLORS.purple}20`,
                  border: `1px solid ${COLORS.purple}60`,
                  borderRadius: 6,
                  fontFamily: "monospace",
                  fontSize: 12,
                  color: COLORS.purple,
                  opacity: 0.8,
                }}
              >
                🔒 ████████
              </div>
              {tx.order && (
                <div
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: "50%",
                    background: COLORS.cyan,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontFamily: "monospace",
                    fontSize: 12,
                    fontWeight: 700,
                    color: COLORS.bg,
                  }}
                >
                  {tx.order}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Consensus indicator */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 20,
        }}
      >
        <div
          style={{
            fontFamily: "monospace",
            fontSize: 14,
            color: COLORS.textMuted,
          }}
        >
          CONSENSUS ON ORDER:
        </div>
        <div
          style={{
            display: "flex",
            gap: 4,
          }}
        >
          {Array.from({ length: 7 }).map((_, i) => (
            <div
              key={i}
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background:
                  orderedProgress > (i + 1) * 0.12
                    ? COLORS.aptosTeal
                    : `${COLORS.aptosTeal}30`,
                boxShadow:
                  orderedProgress > (i + 1) * 0.12
                    ? `0 0 8px ${COLORS.aptosTeal}`
                    : "none",
              }}
            />
          ))}
        </div>
        <div
          style={{
            fontFamily: "monospace",
            fontSize: 14,
            color: COLORS.aptosTeal,
          }}
        >
          {Math.min(Math.floor(orderedProgress * 7), 7)}/7 ✓
        </div>
      </div>

      {/* Key insight */}
      <div
        style={{
          padding: "12px 24px",
          background: `${COLORS.cyan}15`,
          border: `1px solid ${COLORS.cyan}40`,
          borderRadius: 8,
          fontFamily: "monospace",
          fontSize: 13,
          color: COLORS.cyan,
        }}
      >
        📋 Order determined BEFORE content is revealed
      </div>
    </div>
  );
};

// Phase 4: Threshold Decryption
const ThresholdDecryptPhase: React.FC<{ progress: number; localFrame: number }> = ({
  progress,
  localFrame,
}) => {
  const validators = 7;
  const requiredValidators = 5; // >2/3 of 7
  const decryptProgress = progress;

  const contributingCount = Math.min(
    Math.floor(decryptProgress * validators * 1.5),
    requiredValidators
  );
  const reconstructionProgress =
    contributingCount >= requiredValidators
      ? Math.min((decryptProgress - 0.5) * 2, 1)
      : 0;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 40,
      }}
    >
      {/* Validators providing partial decryptions */}
      <div
        style={{
          display: "flex",
          gap: 16,
        }}
      >
        {Array.from({ length: validators }).map((_, i) => {
          const hasContributed = i < contributingCount;

          return (
            <div
              key={i}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 8,
              }}
            >
              <div
                style={{
                  width: 50,
                  height: 50,
                  borderRadius: "50%",
                  background: hasContributed
                    ? `${COLORS.aptosTeal}40`
                    : `${COLORS.textDim}20`,
                  border: `2px solid ${
                    hasContributed ? COLORS.aptosTeal : COLORS.textDim
                  }`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontFamily: "monospace",
                  fontSize: 12,
                  color: hasContributed ? COLORS.aptosTeal : COLORS.textDim,
                  boxShadow: hasContributed
                    ? `0 0 15px ${COLORS.aptosTeal}40`
                    : "none",
                }}
              >
                V{i + 1}
              </div>

              {/* Partial decryption key fragment */}
              {hasContributed && (
                <div
                  style={{
                    padding: "4px 8px",
                    background: `${COLORS.aptosTeal}20`,
                    borderRadius: 4,
                    fontFamily: "monospace",
                    fontSize: 10,
                    color: COLORS.aptosTeal,
                  }}
                >
                  🔑 SHARE_{i + 1}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Threshold indicator */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 16,
        }}
      >
        <div
          style={{
            width: 200,
            height: 12,
            background: `${COLORS.textDim}30`,
            borderRadius: 6,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: `${(contributingCount / requiredValidators) * 100}%`,
              height: "100%",
              background:
                contributingCount >= requiredValidators
                  ? COLORS.green
                  : COLORS.aptosTeal,
              borderRadius: 6,
              transition: "width 0.3s ease",
            }}
          />
        </div>
        <div
          style={{
            fontFamily: "monospace",
            fontSize: 14,
            color:
              contributingCount >= requiredValidators
                ? COLORS.green
                : COLORS.textMuted,
          }}
        >
          {contributingCount}/{requiredValidators} ({">"} 2/3 required)
        </div>
      </div>

      {/* Reconstruction visualization */}
      {reconstructionProgress > 0 && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 20,
            opacity: reconstructionProgress,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
            }}
          >
            {Array.from({ length: 5 }).map((_, i) => (
              <React.Fragment key={i}>
                <div
                  style={{
                    padding: "8px 12px",
                    background: `${COLORS.aptosTeal}20`,
                    borderRadius: 4,
                    fontFamily: "monospace",
                    fontSize: 10,
                    color: COLORS.aptosTeal,
                  }}
                >
                  🔑{i + 1}
                </div>
                {i < 4 && (
                  <span style={{ color: COLORS.textMuted, fontSize: 16 }}>+</span>
                )}
              </React.Fragment>
            ))}
            <span style={{ color: COLORS.textMuted, fontSize: 20, margin: "0 12px" }}>
              =
            </span>
            <div
              style={{
                padding: "12px 24px",
                background: `${COLORS.green}20`,
                border: `2px solid ${COLORS.green}`,
                borderRadius: 8,
                fontFamily: "monospace",
                fontSize: 14,
                color: COLORS.green,
                boxShadow: `0 0 25px ${COLORS.green}40`,
              }}
            >
              🔓 DECRYPTED
            </div>
          </div>

          {/* Revealed transaction */}
          {reconstructionProgress > 0.5 && (
            <div
              style={{
                padding: "16px 32px",
                background: `${COLORS.green}15`,
                border: `2px solid ${COLORS.green}60`,
                borderRadius: 8,
                fontFamily: "monospace",
                fontSize: 16,
                color: COLORS.green,
              }}
            >
              SWAP 1000 USDC → APT @ 0.98
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// Phase 5: Fair Execution
const FairExecutionPhase: React.FC<{ progress: number; localFrame: number }> = ({
  progress,
  localFrame,
}) => {
  const executeProgress = Math.min(progress * 1.5, 1);
  const celebrateProgress = Math.max(0, (progress - 0.5) / 0.5);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 40,
      }}
    >
      {/* Execution flow */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 30,
          opacity: executeProgress,
        }}
      >
        {/* Transaction queue */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
          {[1, 2, 3].map((num) => (
            <div
              key={num}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <div
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: "50%",
                  background: executeProgress > num * 0.25 ? COLORS.green : COLORS.cyan,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontFamily: "monospace",
                  fontSize: 12,
                  fontWeight: 700,
                  color: COLORS.bg,
                }}
              >
                {num}
              </div>
              <div
                style={{
                  padding: "8px 16px",
                  background:
                    executeProgress > num * 0.25
                      ? `${COLORS.green}20`
                      : `${COLORS.cyan}15`,
                  border: `1px solid ${
                    executeProgress > num * 0.25 ? COLORS.green : COLORS.cyan
                  }40`,
                  borderRadius: 6,
                  fontFamily: "monospace",
                  fontSize: 12,
                  color: executeProgress > num * 0.25 ? COLORS.green : COLORS.cyan,
                }}
              >
                TX_{num} {executeProgress > num * 0.25 ? "✓" : "..."}
              </div>
            </div>
          ))}
        </div>

        {/* Arrow */}
        <div
          style={{
            width: 80,
            height: 4,
            background: `linear-gradient(90deg, ${COLORS.cyan}, ${COLORS.green})`,
            position: "relative",
          }}
        >
          <div
            style={{
              position: "absolute",
              right: -8,
              top: -6,
              width: 0,
              height: 0,
              borderLeft: `12px solid ${COLORS.green}`,
              borderTop: "8px solid transparent",
              borderBottom: "8px solid transparent",
            }}
          />
        </div>

        {/* Result */}
        <div
          style={{
            padding: "20px 32px",
            background: `${COLORS.green}15`,
            border: `2px solid ${COLORS.green}`,
            borderRadius: 12,
            textAlign: "center",
            boxShadow: `0 0 30px ${COLORS.green}30`,
          }}
        >
          <div
            style={{
              fontFamily: "monospace",
              fontSize: 14,
              color: COLORS.textMuted,
              marginBottom: 8,
            }}
          >
            EXECUTED AT FAIR PRICE
          </div>
          <div
            style={{
              fontFamily: "monospace",
              fontSize: 28,
              fontWeight: 700,
              color: COLORS.green,
            }}
          >
            $0.00 MEV LOST
          </div>
        </div>
      </div>

      {/* Success celebration */}
      {celebrateProgress > 0 && (
        <div
          style={{
            display: "flex",
            gap: 40,
            opacity: celebrateProgress,
            transform: `scale(${0.9 + celebrateProgress * 0.1})`,
          }}
        >
          <ComparisonCard
            title="WITHOUT ENCRYPTION"
            value="-$847"
            subtitle="Front-run loss"
            color={COLORS.red}
            icon="❌"
          />
          <ComparisonCard
            title="WITH ENCRYPTION"
            value="$0"
            subtitle="Protected execution"
            color={COLORS.green}
            icon="✅"
          />
        </div>
      )}
    </div>
  );
};

// Helper components
const TransactionBox: React.FC<{
  tx: { id: string; type: string; amount: string };
  visible: boolean;
  color: string;
  delay: number;
  progress: number;
}> = ({ tx, visible, color, delay, progress }) => {
  const opacity = Math.min((progress - delay) * 5, 1);

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "10px 16px",
        background: `${color}10`,
        border: `1px solid ${color}30`,
        borderRadius: 6,
        opacity: Math.max(0, opacity),
      }}
    >
      <div
        style={{
          fontFamily: "monospace",
          fontSize: 12,
          color: COLORS.textMuted,
        }}
      >
        {tx.id}
      </div>
      <div
        style={{
          fontFamily: "monospace",
          fontSize: 14,
          fontWeight: 600,
          color: COLORS.green,
        }}
      >
        {tx.type}
      </div>
      <div
        style={{
          fontFamily: "monospace",
          fontSize: 14,
          color,
        }}
      >
        {tx.amount}
      </div>
    </div>
  );
};

const MEVBot: React.FC<{ active: boolean; attacking: boolean }> = ({
  active,
  attacking,
}) => (
  <div
    style={{
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: 8,
    }}
  >
    <div
      style={{
        width: 70,
        height: 70,
        borderRadius: 12,
        background: attacking ? `${COLORS.red}30` : `${COLORS.red}15`,
        border: `2px solid ${COLORS.red}`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 32,
        boxShadow: attacking ? `0 0 25px ${COLORS.red}60` : "none",
      }}
    >
      🤖
    </div>
    <div
      style={{
        fontFamily: "monospace",
        fontSize: 10,
        color: COLORS.red,
        fontWeight: 600,
      }}
    >
      MEV BOT
    </div>
    {active && (
      <div
        style={{
          fontFamily: "monospace",
          fontSize: 9,
          color: COLORS.red,
          padding: "2px 8px",
          background: `${COLORS.red}20`,
          borderRadius: 4,
        }}
      >
        👁️ WATCHING
      </div>
    )}
  </div>
);

const ComparisonCard: React.FC<{
  title: string;
  value: string;
  subtitle: string;
  color: string;
  icon: string;
}> = ({ title, value, subtitle, color, icon }) => (
  <div
    style={{
      padding: "20px 30px",
      background: `${color}10`,
      border: `2px solid ${color}40`,
      borderRadius: 12,
      textAlign: "center",
    }}
  >
    <div
      style={{
        fontFamily: "monospace",
        fontSize: 11,
        color: COLORS.textMuted,
        marginBottom: 8,
      }}
    >
      {title}
    </div>
    <div
      style={{
        fontFamily: "monospace",
        fontSize: 32,
        fontWeight: 700,
        color,
        marginBottom: 4,
      }}
    >
      {icon} {value}
    </div>
    <div
      style={{
        fontFamily: "monospace",
        fontSize: 11,
        color: COLORS.textMuted,
      }}
    >
      {subtitle}
    </div>
  </div>
);
