import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  Easing,
} from "remotion";

// Code layers for infinite zoom effect
const codeLayers = [
  {
    code: `struct MultiMarket has key {
    question: String,
    outcome_addresses: vector<address>,
    total_collateral: Aggregator<u64>,
}`,
    highlight: "MultiMarket",
  },
  {
    code: `struct OutcomeMarket has key {
    market_addr: address,
    reserve: Aggregator<u64>,
    base_reserve: Aggregator<u64>,
}`,
    highlight: "OutcomeMarket",
  },
  {
    code: `public entry fun buy_outcome(
    buyer: &signer,
    market_addr: address,
    outcome_index: u64,
) acquires MultiMarket, OutcomeMarket`,
    highlight: "buy_outcome",
  },
  {
    code: `// CPMM Formula
let tokens_out = reserve_out * amount_in
    / (reserve_in + amount_in);

aggregator_v2::add(&mut outcome.base_reserve, amount);`,
    highlight: "CPMM",
  },
  {
    code: `// TPS OPTIMIZED
// 30,000+ transactions per second
// Parallel execution enabled

use aggregator_v2::{Self, Aggregator};`,
    highlight: "TPS",
  },
];

export const InfiniteZoom: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const polymarketColors = {
    purple: "#8B5CF6",
    blue: "#3B82F6",
    green: "#10B981",
    cyan: "#06B6D4",
  };

  // Exponential zoom for infinite effect
  const zoomProgress = interpolate(frame, [0, durationInFrames], [0, 1], {
    easing: Easing.inOut(Easing.quad),
  });

  // Calculate which layer we're on
  const layerDuration = durationInFrames / codeLayers.length;
  const currentLayerIndex = Math.min(
    Math.floor(frame / layerDuration),
    codeLayers.length - 1
  );

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#0d0d0d",
        justifyContent: "center",
        alignItems: "center",
        overflow: "hidden",
      }}
    >
      {/* Radial glow effect */}
      <div
        style={{
          position: "absolute",
          width: "200%",
          height: "200%",
          background: `radial-gradient(circle at 50% 50%, ${polymarketColors.purple}30, transparent 50%)`,
          transform: `scale(${1 + zoomProgress * 2})`,
        }}
      />

      {/* Code layers with zoom effect */}
      {codeLayers.map((layer, index) => {
        const layerStart = index * layerDuration;
        const layerEnd = (index + 1) * layerDuration;

        // Calculate this layer's progress
        const layerProgress = interpolate(
          frame,
          [layerStart, layerEnd],
          [0, 1],
          {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }
        );

        // Zoom scale: starts at 1, ends at huge
        const scale = interpolate(
          layerProgress,
          [0, 0.8, 1],
          [1, 2, 20],
          {
            easing: Easing.inOut(Easing.cubic),
          }
        );

        // Opacity: fade in, stay visible, fade out as we zoom past
        const opacity = interpolate(
          layerProgress,
          [0, 0.1, 0.7, 1],
          [0, 1, 1, 0],
          {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }
        );

        // Only show layers that are visible
        if (frame < layerStart - layerDuration || frame > layerEnd + layerDuration / 2) {
          return null;
        }

        // Syntax highlighting for the code
        const highlightCode = (code: string): React.ReactNode => {
          let highlighted = code;

          // Keywords
          highlighted = highlighted.replace(
            /\b(struct|public|entry|fun|has|key|use|let|mut|acquires)\b/g,
            `<span style="color: ${polymarketColors.purple}">$1</span>`
          );

          // Types
          highlighted = highlighted.replace(
            /\b(address|u64|String|Object|Aggregator|vector|signer)\b/g,
            `<span style="color: ${polymarketColors.cyan}">$1</span>`
          );

          // Comments
          highlighted = highlighted.replace(
            /(\/\/.*)$/gm,
            `<span style="color: #666">$1</span>`
          );

          // Function names
          highlighted = highlighted.replace(
            /(\w+)(\s*\()/g,
            `<span style="color: ${polymarketColors.blue}">$1</span>$2`
          );

          return <span dangerouslySetInnerHTML={{ __html: highlighted }} />;
        };

        return (
          <div
            key={index}
            style={{
              position: "absolute",
              transform: `scale(${scale})`,
              opacity,
              padding: 60,
              backgroundColor: "#1a1a1a",
              borderRadius: 20,
              border: `3px solid ${polymarketColors.purple}66`,
              boxShadow: `0 0 60px ${polymarketColors.purple}44`,
              maxWidth: 900,
            }}
          >
            <div
              style={{
                fontSize: 14,
                color: polymarketColors.green,
                marginBottom: 20,
                fontFamily: "'JetBrains Mono', monospace",
                textTransform: "uppercase",
                letterSpacing: 2,
              }}
            >
              {layer.highlight}
            </div>
            <pre
              style={{
                fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                fontSize: 20,
                lineHeight: 1.8,
                color: "#e0e0e0",
                margin: 0,
                whiteSpace: "pre-wrap",
              }}
            >
              {highlightCode(layer.code)}
            </pre>
          </div>
        );
      })}

      {/* Zoom indicator */}
      <div
        style={{
          position: "absolute",
          bottom: 60,
          right: 60,
          display: "flex",
          alignItems: "center",
          gap: 15,
        }}
      >
        <div
          style={{
            width: 200,
            height: 4,
            backgroundColor: "#333",
            borderRadius: 2,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: `${zoomProgress * 100}%`,
              height: "100%",
              background: `linear-gradient(90deg, ${polymarketColors.purple}, ${polymarketColors.green})`,
            }}
          />
        </div>
        <span
          style={{
            color: "#666",
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 14,
          }}
        >
          {Math.round(zoomProgress * 1000)}x
        </span>
      </div>

      {/* Layer indicator */}
      <div
        style={{
          position: "absolute",
          bottom: 60,
          left: 60,
          display: "flex",
          gap: 10,
        }}
      >
        {codeLayers.map((_, index) => (
          <div
            key={index}
            style={{
              width: 10,
              height: 10,
              borderRadius: "50%",
              backgroundColor:
                index <= currentLayerIndex ? polymarketColors.purple : "#333",
              transition: "background-color 0.3s",
            }}
          />
        ))}
      </div>
    </AbsoluteFill>
  );
};
