/**
 * PixiJS High-Performance Trade Visualization
 * WebGL-accelerated for 60fps at 30k+ TPS
 */

import { useEffect, useRef, useCallback, useState } from 'react';
import { Application, Graphics, Text, TextStyle, Container } from 'pixi.js';

interface Trade {
  id: string;
  action: string;
  outcome?: number;
  amount: number;
  timestamp: number;
  success: boolean;
}

interface PixiTradeVizProps {
  width: number;
  height: number;
  tps: number;
  peakTps: number;
  totalTrades: number;
  trades: Trade[];
  outcomes?: string[];
  prices?: number[];
  isRunning: boolean;
}

const OUTCOME_COLORS = [
  0x00c853, // Green
  0x2c9cdb, // Cyan
  0xf5a623, // Orange
  0x00bcd4, // Cyan
  0xef4444, // Red
  0xa855f7, // Purple
];

interface Particle {
  graphics: Graphics;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
}

export function PixiTradeViz({
  width,
  height,
  tps,
  peakTps,
  totalTrades,
  trades,
  outcomes = [],
  prices = [],
  isRunning,
}: PixiTradeVizProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<Application | null>(null);
  const particlesRef = useRef<Particle[]>([]);
  const particleContainerRef = useRef<Container | null>(null);
  const tpsTextRef = useRef<Text | null>(null);
  const statsTextRef = useRef<Text | null>(null);
  const lastTradeIndexRef = useRef(0);
  const [isInitialized, setIsInitialized] = useState(false);

  // Initialize PixiJS
  useEffect(() => {
    if (!containerRef.current || appRef.current) return;

    const initPixi = async () => {
      const app = new Application();
      await app.init({
        width,
        height,
        backgroundColor: 0x1c2b3a,
        antialias: true,
        resolution: window.devicePixelRatio || 1,
        autoDensity: true,
      });

      containerRef.current?.appendChild(app.canvas);
      appRef.current = app;

      // Create particle container
      const particleContainer = new Container();
      app.stage.addChild(particleContainer);
      particleContainerRef.current = particleContainer;

      // Create TPS text with glow effect
      const tpsStyle = new TextStyle({
        fontFamily: 'SF Mono, Monaco, monospace',
        fontSize: 72,
        fontWeight: 'bold',
        fill: 0x60a5fa,
        dropShadow: {
          color: 0x60a5fa,
          blur: 20,
          distance: 0,
        },
      });

      const tpsText = new Text({ text: '0 TPS', style: tpsStyle });
      tpsText.anchor.set(0.5, 0);
      tpsText.x = width / 2;
      tpsText.y = 30;
      app.stage.addChild(tpsText);
      tpsTextRef.current = tpsText;

      // Create stats text
      const statsStyle = new TextStyle({
        fontFamily: 'SF Mono, Monaco, monospace',
        fontSize: 16,
        fill: 0x8297a3,
      });

      const statsText = new Text({ text: '', style: statsStyle });
      statsText.anchor.set(0.5, 0);
      statsText.x = width / 2;
      statsText.y = 110;
      app.stage.addChild(statsText);
      statsTextRef.current = statsText;

      // Create center price display area
      const priceBox = new Graphics();
      priceBox.roundRect(width / 2 - 150, height / 2 - 60, 300, 120, 16);
      priceBox.fill({ color: 0x2a3d4e, alpha: 0.8 });
      priceBox.stroke({ width: 2, color: 0x3a4f60 });
      app.stage.addChild(priceBox);

      // Animation loop
      app.ticker.add((ticker) => {
        const particles = particlesRef.current;
        const container = particleContainerRef.current;
        if (!container) return;

        // Update particles
        for (let i = particles.length - 1; i >= 0; i--) {
          const p = particles[i];

          p.graphics.x += p.vx * ticker.deltaTime;
          p.graphics.y += p.vy * ticker.deltaTime;
          p.life -= ticker.deltaTime / 60;

          // Fade out
          p.graphics.alpha = Math.max(0, p.life / p.maxLife);

          // Remove dead particles
          if (p.life <= 0) {
            container.removeChild(p.graphics);
            p.graphics.destroy();
            particles.splice(i, 1);
          }
        }
      });

      setIsInitialized(true);
    };

    initPixi();

    return () => {
      if (appRef.current) {
        appRef.current.destroy(true, { children: true });
        appRef.current = null;
      }
    };
  }, [width, height]);

  // Spawn particles for new trades
  const spawnParticle = useCallback((trade: Trade) => {
    const container = particleContainerRef.current;
    if (!container) return;

    const isBuy = trade.action.includes('buy');
    const outcomeIndex = trade.outcome || 0;
    const color = OUTCOME_COLORS[outcomeIndex % OUTCOME_COLORS.length];

    const graphics = new Graphics();
    const size = 3 + Math.min(trade.amount / 5000000, 8);

    // Draw glowing circle
    graphics.circle(0, 0, size * 2);
    graphics.fill({ color, alpha: 0.3 });
    graphics.circle(0, 0, size);
    graphics.fill({ color, alpha: 0.9 });

    // Start position - buys from left, sells from right
    graphics.x = isBuy ? -20 : width + 20;
    graphics.y = 150 + Math.random() * (height - 250);

    // Velocity toward center
    const targetX = width / 2 + (Math.random() - 0.5) * 100;
    const targetY = height / 2 + (Math.random() - 0.5) * 50;
    const dx = targetX - graphics.x;
    const dy = targetY - graphics.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const speed = 6 + Math.random() * 4;

    container.addChild(graphics);

    particlesRef.current.push({
      graphics,
      vx: (dx / dist) * speed,
      vy: (dy / dist) * speed,
      life: 1,
      maxLife: 1,
    });

    // Cap particles
    if (particlesRef.current.length > 1500) {
      const old = particlesRef.current.shift();
      if (old) {
        container.removeChild(old.graphics);
        old.graphics.destroy();
      }
    }
  }, [width, height]);

  // Process new trades with sampling
  useEffect(() => {
    if (!isInitialized) return;

    const newTrades = trades.slice(lastTradeIndexRef.current);
    lastTradeIndexRef.current = trades.length;

    // Sample rate based on TPS
    const sampleRate = tps > 20000 ? 0.005 : tps > 10000 ? 0.01 : tps > 1000 ? 0.05 : 0.2;

    for (const trade of newTrades) {
      if (Math.random() < sampleRate) {
        spawnParticle(trade);
      }
    }
  }, [trades, tps, isInitialized, spawnParticle]);

  // Update TPS display
  useEffect(() => {
    if (tpsTextRef.current) {
      tpsTextRef.current.text = `${tps.toLocaleString()} TPS`;

      // Color based on TPS level
      if (tps > 20000) {
        tpsTextRef.current.style.fill = 0x00ff88; // Bright green
      } else if (tps > 10000) {
        tpsTextRef.current.style.fill = 0x60a5fa; // Blue
      } else {
        tpsTextRef.current.style.fill = 0xf5a623; // Orange
      }
    }

    if (statsTextRef.current) {
      statsTextRef.current.text = `Peak: ${peakTps.toLocaleString()} TPS  |  Total: ${totalTrades.toLocaleString()} trades`;
    }
  }, [tps, peakTps, totalTrades]);

  return (
    <div
      ref={containerRef}
      style={{
        width,
        height,
        borderRadius: 16,
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      {/* Overlay UI */}
      {isRunning && (
        <div
          style={{
            position: 'absolute',
            bottom: 20,
            left: 20,
            right: 20,
            display: 'flex',
            justifyContent: 'space-between',
            pointerEvents: 'none',
          }}
        >
          {/* Outcome prices */}
          <div style={{ display: 'flex', gap: 12 }}>
            {outcomes.slice(0, 4).map((name, i) => (
              <div
                key={i}
                style={{
                  padding: '8px 12px',
                  background: `${OUTCOME_COLORS[i].toString(16).padStart(6, '0')}33`,
                  borderRadius: 8,
                  border: `1px solid #${OUTCOME_COLORS[i].toString(16).padStart(6, '0')}`,
                }}
              >
                <div style={{ color: '#8297a3', fontSize: 11 }}>{name}</div>
                <div style={{ color: '#fff', fontSize: 18, fontWeight: 'bold' }}>
                  {prices[i] || 50}%
                </div>
              </div>
            ))}
          </div>

          {/* Live indicator */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div
              style={{
                width: 12,
                height: 12,
                borderRadius: '50%',
                background: '#ef4444',
                animation: 'pulse 1s infinite',
              }}
            />
            <span style={{ color: '#ef4444', fontWeight: 'bold', fontSize: 14 }}>LIVE</span>
          </div>
        </div>
      )}

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(1.2); }
        }
      `}</style>
    </div>
  );
}
