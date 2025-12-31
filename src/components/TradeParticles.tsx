/**
 * High-Performance Trade Visualization using Canvas/WebGL
 * Renders 30k+ TPS as animated particles without killing React
 */

import { useEffect, useRef, useCallback } from 'react';

interface Trade {
  id: string;
  action: 'buy' | 'sell';
  outcome: number;
  amount: number;
  timestamp: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
}

// Outcome colors matching Polymarket
const OUTCOME_COLORS = [
  '#00c853', // Green
  '#5b9cf6', // Blue
  '#f5a623', // Orange
  '#00bcd4', // Cyan
  '#ef4444', // Red
  '#a855f7', // Purple
];

interface TradeParticlesProps {
  width: number;
  height: number;
  trades: Trade[];
  tps: number;
  className?: string;
}

export function TradeParticles({ width, height, trades, tps, className }: TradeParticlesProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const animationRef = useRef<number>(0);
  const lastTradeCountRef = useRef(0);

  // Spawn particles for new trades (batched for performance)
  const spawnParticles = useCallback((newTrades: Trade[]) => {
    const particles = particlesRef.current;

    // Limit max particles based on TPS (sample at high TPS)
    const sampleRate = tps > 10000 ? 0.01 : tps > 1000 ? 0.1 : 1;

    for (const trade of newTrades) {
      if (Math.random() > sampleRate) continue;

      const isBuy = trade.action === 'buy';
      const color = OUTCOME_COLORS[trade.outcome % OUTCOME_COLORS.length];

      // Spawn from edges - buys from left, sells from right
      const startX = isBuy ? 0 : width;
      const startY = Math.random() * height;
      const targetX = width / 2 + (Math.random() - 0.5) * 200;
      const targetY = height / 2 + (Math.random() - 0.5) * 100;

      const dx = targetX - startX;
      const dy = targetY - startY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const speed = 8 + Math.random() * 4;

      particles.push({
        x: startX,
        y: startY,
        vx: (dx / dist) * speed,
        vy: (dy / dist) * speed,
        life: 1,
        maxLife: dist / speed / 60, // seconds
        color,
        size: 2 + Math.min(trade.amount / 10000000, 6), // Size based on amount
      });
    }

    // Cap total particles for performance
    if (particles.length > 2000) {
      particlesRef.current = particles.slice(-1500);
    }
  }, [width, height, tps]);

  // Animation loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    let lastTime = performance.now();

    const animate = (currentTime: number) => {
      const deltaTime = (currentTime - lastTime) / 1000;
      lastTime = currentTime;

      // Clear with fade effect for trails
      ctx.fillStyle = 'rgba(28, 43, 58, 0.15)';
      ctx.fillRect(0, 0, width, height);

      const particles = particlesRef.current;

      // Update and draw particles
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];

        // Update position
        p.x += p.vx;
        p.y += p.vy;

        // Update life
        p.life -= deltaTime / p.maxLife;

        // Remove dead particles
        if (p.life <= 0 || p.x < -50 || p.x > width + 50 || p.y < -50 || p.y > height + 50) {
          particles.splice(i, 1);
          continue;
        }

        // Draw particle with glow
        const alpha = Math.min(1, p.life * 2);
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = p.color + Math.floor(alpha * 255).toString(16).padStart(2, '0');
        ctx.fill();

        // Glow effect
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * 2, 0, Math.PI * 2);
        ctx.fillStyle = p.color + Math.floor(alpha * 50).toString(16).padStart(2, '0');
        ctx.fill();
      }

      // Draw TPS counter with glow
      ctx.font = 'bold 48px "SF Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#60a5fa';
      ctx.shadowColor = '#60a5fa';
      ctx.shadowBlur = 20;
      ctx.fillText(`${tps.toLocaleString()} TPS`, width / 2, 60);
      ctx.shadowBlur = 0;

      // Particle count (debug)
      ctx.font = '12px monospace';
      ctx.fillStyle = '#6b7a8a';
      ctx.textAlign = 'right';
      ctx.fillText(`${particles.length} particles`, width - 10, height - 10);

      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animationRef.current);
    };
  }, [width, height, tps]);

  // Process new trades
  useEffect(() => {
    if (trades.length > lastTradeCountRef.current) {
      const newTrades = trades.slice(lastTradeCountRef.current);
      spawnParticles(newTrades);
      lastTradeCountRef.current = trades.length;
    }
  }, [trades, spawnParticles]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      className={className}
      style={{
        background: 'linear-gradient(180deg, #1c2b3a 0%, #0f1a24 100%)',
        borderRadius: '12px',
      }}
    />
  );
}
