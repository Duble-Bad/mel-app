"use client";

import { useEffect, useRef } from "react";
import { useReducedMotion } from "./useReducedMotion";

type Particle = { x: number; y: number; vx: number; vy: number; rot: number; vr: number; size: number; life: number; ttl: number; color: string; shape: 0 | 1 | 2 | 3; float: boolean };

const HEART = "M0 -0.3 C -0.25 -0.8 -1 -0.6 -1 -0.05 C -1 0.45 -0.4 0.75 0 1 C 0.4 0.75 1 0.45 1 -0.05 C 1 -0.6 0.25 -0.8 0 -0.3 Z";

function drawPaw(ctx: CanvasRenderingContext2D) {
  ctx.beginPath();
  ctx.ellipse(0, 0.35, 0.62, 0.5, 0, 0, Math.PI * 2);
  for (const [x, y] of [[-0.72, -0.2], [-0.27, -0.72], [0.27, -0.72], [0.72, -0.2]] as const) {
    ctx.moveTo(x + 0.24, y);
    ctx.ellipse(x, y, 0.24, 0.3, 0, 0, Math.PI * 2);
  }
  ctx.fill();
}

/** Explosão de confete, corações e patinhas nas cores da marca (canvas 2D; roda só durante o efeito). */
export function launchBurst(canvas: HTMLCanvasElement, onFrame: (id: number) => void) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const rect = canvas.getBoundingClientRect();
  canvas.width = Math.round(rect.width * dpr);
  canvas.height = Math.round(rect.height * dpr);
  const w = rect.width;
  const h = rect.height;
  const colors = ["--mel-brand", "--mel-status-found", "--mel-status-sighting", "--mel-status-lost", "--mel-honey-300", "--mel-brand"].map((n) => getComputedStyle(canvas).getPropertyValue(n).trim());
  const heart = new Path2D(HEART);
  const ox = w / 2;
  const oy = h * 0.42;
  const scale = Math.min(1, w / 720) * 0.6 + 0.4;

  const parts: Particle[] = [];
  for (let i = 0; i < 120; i++) {
    const a = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.7;
    const speed = (5 + Math.random() * 11) * scale;
    parts.push({
      x: ox, y: oy, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed - 2,
      rot: Math.random() * Math.PI * 2, vr: (Math.random() - 0.5) * 0.4,
      size: 5 + Math.random() * 7, life: 0, ttl: 110 + Math.random() * 60,
      color: colors[i % colors.length] ?? "", shape: i % 6 === 0 ? 2 : i % 9 === 0 ? 3 : i % 2 === 0 ? 0 : 1, float: false,
    });
  }
  // Depois da explosão, corações e patinhas sobem devagar.
  for (let i = 0; i < 16; i++) {
    parts.push({
      x: ox + (Math.random() - 0.5) * w * 0.5, y: oy + 40 + Math.random() * 60, vx: (Math.random() - 0.5) * 0.5, vy: -(0.7 + Math.random() * 0.9),
      rot: (Math.random() - 0.5) * 0.5, vr: 0, size: 9 + Math.random() * 8, life: -30 - i * 7, ttl: 170,
      color: colors[i % 2 === 0 ? 0 : 1] ?? "", shape: i % 2 === 0 ? 2 : 3, float: true,
    });
  }

  let last = performance.now();
  function frame(now: number) {
    if (!ctx) return;
    const dt = Math.min((now - last) / 16.67, 2.5);
    last = now;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    let alive = false;
    for (const p of parts) {
      p.life += dt;
      if (p.life < 0) {
        alive = true;
        continue;
      }
      if (p.life > p.ttl) continue;
      alive = true;
      if (!p.float) {
        p.vy += 0.24 * dt;
        p.vx *= 0.985;
        p.vy *= 0.985;
      } else {
        p.x += Math.sin((p.life + p.size * 9) / 18) * 0.5;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.vr * dt;
      const t = p.life / p.ttl;
      ctx.globalAlpha = p.float ? Math.sin(Math.PI * t) * 0.85 : t > 0.7 ? (1 - t) / 0.3 : 1;
      ctx.fillStyle = p.color;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      if (p.shape === 0) {
        ctx.scale(1, Math.cos(p.life / 6 + p.size)); // confete girando no próprio eixo
        ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
      } else if (p.shape === 1) {
        ctx.beginPath();
        ctx.arc(0, 0, p.size / 3, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.scale(p.size * 0.7, p.size * 0.7);
        if (p.shape === 2) ctx.fill(heart);
        else drawPaw(ctx);
      }
      ctx.restore();
    }
    ctx.globalAlpha = 1;
    if (alive) onFrame(requestAnimationFrame(frame));
    else ctx.clearRect(0, 0, w, h);
  }
  onFrame(requestAnimationFrame(frame));
}

/**
 * Comemoração do reencontro: uma explosão única de confete, corações e patinhas nas cores da MEL,
 * disparada ao montar. O <canvas> cobre a tela, não recebe toque nem foco e fica vazio depois do
 * efeito. Com "reduzir movimento" nada é desenhado.
 */
export function CelebrationBurst({ className = "pointer-events-none fixed inset-0 z-40 size-full" }: { className?: string }) {
  const reduced = useReducedMotion();
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (reduced || !canvas.current) return;
    let raf = 0;
    // Espera o selo começar a se desenhar para a explosão não competir com a entrada da página.
    const timer = setTimeout(() => {
      if (canvas.current) launchBurst(canvas.current, (id) => (raf = id));
    }, 450);
    return () => {
      clearTimeout(timer);
      cancelAnimationFrame(raf);
    };
  }, [reduced]);
  return <canvas ref={canvas} aria-hidden="true" className={className} />;
}
