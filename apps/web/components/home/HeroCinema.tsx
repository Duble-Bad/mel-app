"use client";

import { useEffect, useRef, useSyncExternalStore, type CSSProperties } from "react";

const REDUCED = "(prefers-reduced-motion: reduce)";
const sub = (cb: () => void) => {
  const mq = window.matchMedia(REDUCED);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
};

/** Pinos de avistamento que pousam na cena (posição em fração do vídeo, que aparece inteiro). */
const PINS = [
  { x: 40, y: 26, label: "Visto às 14h32", delay: 0.6 },
  { x: 84, y: 16, label: "Guardião a 200 m", delay: 2.2 },
  { x: 30, y: 74, label: "Rua das Flores", delay: 3.8 },
];

/**
 * Topo do início (conceito C, aprovado em 2026-11-12): o vídeo da Mel com o gatinho é o palco,
 * encostado na borda direita da tela e dissolvendo no fundo à esquerda; pinos de avistamento pousam
 * na cena. O vídeo aparece inteiro (sem corte), para os dois bichos ficarem visíveis. Sem "reduzir
 * movimento" o vídeo toca em loop; com ele, fica no primeiro quadro e os pinos ficam parados.
 */
export function HeroCinema() {
  const reduced = useSyncExternalStore(sub, () => window.matchMedia(REDUCED).matches, () => false);
  const video = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    // O atributo autoPlay tocaria antes de sabermos da preferência; por isso o play é aqui.
    if (reduced) video.current?.pause();
    else video.current?.play().catch(() => {});
  }, [reduced]);

  return (
    <div className="mh-cine-stage">
      <video
        ref={video}
        aria-label="Vídeo: a Mel, uma Yorkshire com laço amarelo, brincando com um gatinho tigrado na grama"
        poster="/videos/mel-e-gatinho-poster.webp"
        muted
        loop
        playsInline
        preload="auto"
        className="size-full object-cover"
      >
        <source src="/videos/mel-e-gatinho.webm" type="video/webm" />
        <source src="/videos/mel-e-gatinho.mp4" type="video/mp4" />
      </video>
      {PINS.map((p) => (
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
  );
}
