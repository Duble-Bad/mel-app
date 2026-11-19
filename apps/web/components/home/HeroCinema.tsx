"use client";

import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";
import { useReducedMotion } from "@/components/ui/motion/useReducedMotion";
import "./hero-cinema.css";

/** Pinos de avistamento que pousam na cena (posição em fração do vídeo, que aparece inteiro). */
const PINS = [
  { x: 40, y: 26, label: "Visto às 14h32", delay: 0.6 },
  { x: 84, y: 16, label: "Guardião a 200 m", delay: 2.2 },
  { x: 30, y: 74, label: "Rua das Flores", delay: 3.8 },
];

/**
 * Topo do início: UM só vídeo da Mel com o gatinho, com duas apresentações (hero-cinema.css).
 *
 * - Telas grandes (lg+), `variant="auto"`: conceito C aprovado em 2026-11-12, sem mudança. O vídeo é
 *   o palco, encostado na borda direita da tela e dissolvendo no fundo; pinos pousam na cena.
 * - Telas menores (ou `variant="radar"`, na página de conceito): o vídeo fica dentro do círculo do
 *   radar, enquadrado para os dois bichos aparecerem, com os cartões flutuantes recebidos em
 *   `children` (dados reais: ver HeroLiveChips).
 *
 * Como é o mesmo <video> nos dois casos, nenhum aparelho baixa o vídeo duas vezes. Sem "reduzir
 * movimento" o vídeo toca em loop; com ele, fica no primeiro quadro.
 */
export function HeroCinema({ variant = "auto", children }: { variant?: "auto" | "radar"; children?: ReactNode }) {
  const reduced = useReducedMotion();
  const video = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    // O atributo autoPlay tocaria antes de sabermos da preferência; por isso o play é aqui.
    if (reduced) video.current?.pause();
    else video.current?.play().catch(() => {});
  }, [reduced]);

  return (
    <div className="mh-radar" data-variant={variant}>
      <span className="mh-radar-deco" aria-hidden="true">
        <span className="mh-radar-orbit mh-radar-orbit-a" />
        <span className="mh-radar-orbit mh-radar-orbit-b" />
        {[0, 1, 2].map((i) => (
          <span key={i} className="mh-radar-ring" style={{ "--i": i } as CSSProperties} />
        ))}
        <span className="mh-radar-sweep" />
      </span>
      <div className="mh-cine-stage">
        <video
          ref={video}
          aria-label="Vídeo: a Mel, uma Yorkshire com laço amarelo, brincando com um gatinho tigrado na grama"
          poster="/videos/mel-e-gatinho-poster.webp"
          muted
          loop
          playsInline
          preload="auto"
          className="mh-cine-video size-full object-cover"
        >
          <source src="/videos/mel-e-gatinho.webm" type="video/webm" />
          <source src="/videos/mel-e-gatinho.mp4" type="video/mp4" />
        </video>
        {variant === "auto" &&
          PINS.map((p) => (
            <span
              key={p.label}
              aria-hidden="true"
              className={`mh-pin ${p.x > 60 ? "mh-pin--left" : ""}`}
              style={{ left: `${p.x}%`, top: `${p.y}%`, "--d": `${p.delay}s` } as CSSProperties}
            >
              <span className="mh-pin-ring" />
              <span className="mh-pin-dot" />
              <span className="mh-pin-label">{p.label}</span>
            </span>
          ))}
      </div>
      {children}
    </div>
  );
}
