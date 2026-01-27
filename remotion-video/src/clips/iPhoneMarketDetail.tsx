import React from "react";
import {
  AbsoluteFill,
  useVideoConfig,
  useCurrentFrame,
  spring,
  interpolate,
  Img,
  staticFile,
  Easing,
} from "remotion";

// ============================================================================
// iPHONE MARKET DETAIL - 20 second clip showing market detail with chart
// ============================================================================

const COLORS = {
  bg: "#0A0A0F",
  aptosGreen: "#06D6A0",
  aptosCyan: "#00F5FF",
  purple: "#8B5CF6",
  yes: "#4ADE80",
  no: "#F87171",
  text: "#FFFFFF",
  textMuted: "#5A5A6E",
};

export const iPhoneMarketDetail: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Phone entrance - slides in from right
  const phoneEntrance = spring({
    frame,
    fps,
    config: { damping: 60, stiffness: 80 },
  });

  const phoneX = interpolate(phoneEntrance, [0, 1], [200, 0]);
  const phoneOpacity = interpolate(phoneEntrance, [0, 0.3], [0, 1]);

  // Subtle tilt
  const tiltY = Math.sin(frame * 0.025) * 3;
  const tiltX = Math.cos(frame * 0.02) * 2;

  // Price animation
  const priceValue = interpolate(
    frame,
    [fps * 2, fps * 5],
    [42, 67],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.quad) }
  );

  // Chart line animation
  const chartProgress = interpolate(
    frame,
    [fps * 1, fps * 4],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  // Generate chart points
  const chartPoints = React.useMemo(() => {
    const points = [];
    for (let i = 0; i <= 100; i++) {
      const x = i * 3.5;
      const baseY = 80 - (i / 100) * 50;
      const noise = Math.sin(i * 0.3) * 10 + Math.sin(i * 0.7) * 5;
      points.push({ x, y: baseY + noise });
    }
    return points;
  }, []);

  const visiblePoints = chartPoints.slice(0, Math.floor(chartPoints.length * chartProgress));
  const pathD = visiblePoints.length > 1
    ? `M ${visiblePoints[0].x} ${visiblePoints[0].y} ` + visiblePoints.slice(1).map(p => `L ${p.x} ${p.y}`).join(" ")
    : "";

  return (
    <AbsoluteFill style={{ background: COLORS.bg }}>
      {/* Background gradient */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `
            radial-gradient(ellipse at 70% 30%, ${COLORS.yes}10 0%, transparent 50%),
            radial-gradient(ellipse at 20% 70%, ${COLORS.purple}10 0%, transparent 50%)
          `,
        }}
      />

      {/* Title section */}
      <div
        style={{
          position: "absolute",
          top: 80,
          left: 80,
          opacity: interpolate(frame, [0, fps * 0.5], [0, 1]),
          transform: `translateY(${interpolate(frame, [0, fps * 0.5], [20, 0])}px)`,
        }}
      >
        <div
          style={{
            fontFamily: "SF Pro Display, -apple-system, sans-serif",
            fontSize: 16,
            color: COLORS.aptosCyan,
            letterSpacing: "0.2em",
            marginBottom: 12,
          }}
        >
          MARKET DETAIL
        </div>
        <div
          style={{
            fontFamily: "SF Pro Display, -apple-system, sans-serif",
            fontSize: 48,
            fontWeight: 900,
            color: COLORS.text,
            maxWidth: 500,
            lineHeight: 1.1,
          }}
        >
          Will Khamenei still be
          <br />
          <span style={{ color: COLORS.aptosGreen }}>Supreme Leader?</span>
        </div>
      </div>

      {/* Price display */}
      <div
        style={{
          position: "absolute",
          left: 80,
          top: 280,
          opacity: interpolate(frame, [fps * 1, fps * 1.5], [0, 1]),
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-end", gap: 20 }}>
          <div
            style={{
              fontFamily: "SF Pro Display",
              fontSize: 120,
              fontWeight: 900,
              color: COLORS.yes,
              lineHeight: 1,
            }}
          >
            {Math.round(priceValue)}%
          </div>
          <div
            style={{
              fontFamily: "monospace",
              fontSize: 24,
              color: COLORS.yes,
              marginBottom: 15,
            }}
          >
            YES ↑
          </div>
        </div>

        {/* Mini chart */}
        <svg width="350" height="100" style={{ marginTop: 20 }}>
          <defs>
            <linearGradient id="chartGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor={COLORS.yes} stopOpacity={0.3} />
              <stop offset="100%" stopColor={COLORS.yes} stopOpacity={0} />
            </linearGradient>
          </defs>
          {visiblePoints.length > 1 && (
            <>
              <path
                d={pathD + ` L ${visiblePoints[visiblePoints.length - 1].x} 100 L ${visiblePoints[0].x} 100 Z`}
                fill="url(#chartGradient)"
              />
              <path d={pathD} fill="none" stroke={COLORS.yes} strokeWidth={3} />
              <circle
                cx={visiblePoints[visiblePoints.length - 1]?.x || 0}
                cy={visiblePoints[visiblePoints.length - 1]?.y || 50}
                r={6}
                fill={COLORS.yes}
              >
                <animate
                  attributeName="r"
                  values="6;10;6"
                  dur="1s"
                  repeatCount="indefinite"
                />
              </circle>
            </>
          )}
        </svg>
      </div>

      {/* iPhone mockup */}
      <div
        style={{
          position: "absolute",
          right: 80,
          top: "50%",
          transform: `
            translateY(-50%)
            translateX(${phoneX}px)
            perspective(1200px)
            rotateY(${-8 + tiltY}deg)
            rotateX(${tiltX}deg)
          `,
          opacity: phoneOpacity,
          transformStyle: "preserve-3d",
        }}
      >
        {/* Phone frame */}
        <div
          style={{
            width: 380,
            height: 820,
            borderRadius: 55,
            background: "linear-gradient(145deg, #2a2a2a, #1a1a1a)",
            padding: 12,
            boxShadow: `
              0 50px 100px rgba(0,0,0,0.6),
              0 0 0 1px rgba(255,255,255,0.1),
              inset 0 1px 0 rgba(255,255,255,0.1),
              0 0 60px ${COLORS.yes}20
            `,
          }}
        >
          {/* Screen */}
          <div
            style={{
              width: "100%",
              height: "100%",
              borderRadius: 45,
              backgroundColor: "#000",
              overflow: "hidden",
              position: "relative",
            }}
          >
            {/* Dynamic Island */}
            <div
              style={{
                position: "absolute",
                top: 12,
                left: "50%",
                transform: "translateX(-50%)",
                width: 120,
                height: 35,
                backgroundColor: "#000",
                borderRadius: 20,
                zIndex: 100,
              }}
            />

            {/* Screenshot - Khamenei market */}
            <Img
              src={staticFile("screenshots/polymarket-khamenei-full.png")}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                objectPosition: "top",
              }}
            />

            {/* Screen reflection */}
            <div
              style={{
                position: "absolute",
                inset: 0,
                background: `linear-gradient(135deg, rgba(255,255,255,0.04) 0%, transparent 35%)`,
                pointerEvents: "none",
              }}
            />
          </div>
        </div>

        {/* Side buttons */}
        <div
          style={{
            position: "absolute",
            right: -3,
            top: 180,
            width: 4,
            height: 80,
            backgroundColor: "#333",
            borderRadius: 2,
          }}
        />
      </div>

      {/* Stats row */}
      <div
        style={{
          position: "absolute",
          bottom: 80,
          left: 80,
          display: "flex",
          gap: 40,
          opacity: interpolate(frame, [fps * 2.5, fps * 3], [0, 1]),
        }}
      >
        {[
          { label: "Volume", value: "$2.4M" },
          { label: "Liquidity", value: "$890K" },
          { label: "Traders", value: "12,847" },
        ].map((stat, i) => (
          <div key={stat.label}>
            <div style={{ fontFamily: "monospace", fontSize: 14, color: COLORS.textMuted }}>
              {stat.label}
            </div>
            <div
              style={{
                fontFamily: "SF Pro Display",
                fontSize: 32,
                fontWeight: 700,
                color: COLORS.text,
              }}
            >
              {stat.value}
            </div>
          </div>
        ))}
      </div>

      {/* Aptos badge */}
      <div
        style={{
          position: "absolute",
          bottom: 40,
          right: 80,
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "8px 16px",
          background: `${COLORS.aptosGreen}15`,
          borderRadius: 30,
          border: `1px solid ${COLORS.aptosGreen}30`,
          opacity: interpolate(frame, [fps * 3, fps * 4], [0, 1]),
        }}
      >
        <div
          style={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            backgroundColor: COLORS.aptosGreen,
          }}
        />
        <span style={{ fontFamily: "monospace", fontSize: 14, color: COLORS.aptosGreen }}>
          On-Chain Aptos
        </span>
      </div>
    </AbsoluteFill>
  );
};
