"use client";

import Image from "next/image";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Heart, House, RotateCcw, Sparkles } from "lucide-react";
import { launchBurst } from "@/components/ui/motion/CelebrationBurst";
import { Magnetic, PHOTOS, SectionHead, useCmReduced } from "./shared";

type Phase = "idle" | "meeting" | "done";

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
