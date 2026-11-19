"use client";

import Image from "next/image";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Heart, House, RotateCcw, Sparkles } from "lucide-react";
import { Magnetic, PHOTOS, readToken, SectionHead, useCmReduced } from "./shared";

type Phase = "idle" | "meeting" | "done";

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
function launchBurst(canvas: HTMLCanvasElement, onFrame: (id: number) => void) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const rect = canvas.getBoundingClientRect();
  canvas.width = Math.round(rect.width * dpr);
  canvas.height = Math.round(rect.height * dpr);
  const w = rect.width;
  const h = rect.height;
  const colors = ["--mel-brand", "--mel-status-found", "--mel-status-sighting", "--mel-status-lost", "--mel-honey-300", "--mel-brand"].map((n) => readToken(canvas, n));
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

const BEFORE = "Mel está a 1,2 km de casa.";
const AFTER = "Mel voltou para casa.";

/**
 * 5. O reencontro: ao tocar no botão, pet e casa se aproximam, o anel e o "check" se desenham, o
 * título troca letra a letra e uma explosão discreta de confete, corações e patinhas comemora.
 * Com movimento reduzido, o estado final aparece direto, sem partículas.
 */
export function Reunion() {
  const reduced = useCmReduced();
  const [phase, setPhase] = useState<Phase>("idle");
  const canvas = useRef<HTMLCanvasElement>(null);
  const raf = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(
    () => () => {
      cancelAnimationFrame(raf.current);
      clearTimeout(timer.current);
    },
    [],
  );

  function play() {
    clearTimeout(timer.current);
    cancelAnimationFrame(raf.current);
    if (reduced) {
      setPhase("done");
      return;
    }
    setPhase("meeting");
    timer.current = setTimeout(() => {
      setPhase("done");
      if (canvas.current) launchBurst(canvas.current, (id) => (raf.current = id));
    }, 820);
  }
  function reset() {
    clearTimeout(timer.current);
    setPhase("idle");
  }

  const done = phase === "done";
  const title = done ? AFTER : BEFORE;

  return (
    <section id="reencontro" aria-labelledby="cm-reencontro-title" className="cm-section">
      <div className="mel-container">
        <SectionHead
          id="cm-reencontro-title"
          index="04"
          kicker="O momento que importa"
          title={<>O reencontro merece mais do que um aviso verde.</>}
          lead="Uma comemoração curta, nas cores da MEL, que não atrapalha o próximo passo."
        />

        <div className="cm-reu" data-phase={phase}>
          <canvas ref={canvas} className="cm-reu-canvas" aria-hidden="true" />
          <div className="cm-reu-glow" aria-hidden="true" />

          <div className="cm-reu-pair" aria-hidden="true">
            <span className="cm-reu-line" />
            <span className="cm-reu-dist">1,2 km</span>
            <span className="cm-reu-av cm-reu-a">
              <Image src={PHOTOS.mel.src} alt="" fill sizes="140px" style={{ objectFit: "cover", objectPosition: PHOTOS.mel.pos }} />
            </span>
            <span className="cm-reu-av cm-reu-b">
              <House size={40} strokeWidth={1.6} />
            </span>
            <svg className="cm-reu-check" viewBox="0 0 120 120">
              <circle cx="60" cy="60" r="52" pathLength={1} className="cm-reu-ring" />
              <path d="M38 62 L54 78 L84 44" pathLength={1} className="cm-reu-tick" />
            </svg>
            <span className="cm-reu-heart">
              <Heart size={26} fill="currentColor" />
            </span>
          </div>

          <p className="cm-reu-title" aria-hidden="true" key={title}>
            {title.split(" ").map((word, i) => (
              <span key={i} style={{ "--i": i } as CSSProperties}>
                {word}
              </span>
            ))}
          </p>
          <p className="sr-only" role="status">
            {done ? "Reencontro confirmado: Mel voltou para casa." : BEFORE}
          </p>
          <p className="cm-reu-sub">
            {done ? "9 horas fora, 4 avistamentos, 312 Guardiões avisados. Obrigado, vizinhança." : "A tutora e quem encontrou a Mel já estão conversando pelo chat seguro."}
          </p>

          <div className="mt-7 flex flex-wrap justify-center gap-3">
            {done ? (
              <button type="button" className="cm-btn cm-btn-ghost" onClick={reset}>
                <RotateCcw size={17} aria-hidden="true" />
                Repetir
              </button>
            ) : (
              <Magnetic>
                <button type="button" className="cm-btn cm-btn-gold" onClick={play} disabled={phase === "meeting"}>
                  <span className="cm-btn-sheen" aria-hidden="true" />
                  <Sparkles size={18} aria-hidden="true" />
                  Simular reencontro
                </button>
              </Magnetic>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
