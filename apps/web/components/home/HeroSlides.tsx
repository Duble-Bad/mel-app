"use client";

import Image from "next/image";
import { AnimatePresence, motion } from "motion/react";
import { useState, useSyncExternalStore } from "react";

type Slide = {
  key: string;
  src: string;
  width: number;
  height: number;
  alt: string;
  /** Enquadramento da foto no quadro (object-position). */
  position: string;
  /** De onde a cena nasce ao entrar (centro do círculo que se abre). */
  origin: string;
  label: string;
  chip: { title: string; text: string; dot: string };
};

const SLIDES: Slide[] = [
  {
    key: "rede",
    src: "/fotos/mel-e-gatinho.webp",
    width: 1600,
    height: 901,
    alt: "A Mel, uma Yorkshire com laço amarelo, abraçada a um gatinho tigrado",
    position: "62% 35%",
    origin: "8% 8%", // o coração do canto
    label: "A rede",
    chip: { title: "Avistamentos em tempo real", text: "chegam direto para o tutor", dot: "bg-status-found-accent" },
  },
  {
    key: "guardiao",
    src: "/fotos/guardiao-bairro.webp",
    width: 1172,
    height: 724,
    alt: "Uma Yorkshire e um gato laranja diante de um escudo dourado, sobre o mapa iluminado de um bairro",
    position: "56% 50%",
    origin: "51% 80%", // o pino dourado do mapa
    label: "Guardiões no bairro",
    chip: { title: "Guardiões no seu bairro", text: "avisos chegam a quem está perto", dot: "bg-primary" },
  },
];

const DURATION_S = 7;
const EASE = [0.7, 0, 0.2, 1] as const;
const REDUCED = "(prefers-reduced-motion: reduce)";
const subscribe = (cb: () => void) => {
  const mq = window.matchMedia(REDUCED);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
};

/**
 * Imagem principal do início com duas cenas que se alternam: a foto da Mel com o gatinho e a
 * ilustração do Guardião no bairro. A cena nova se abre em círculo a partir de um ponto com
 * significado (o coração do canto; o pino dourado do mapa), cada cena aproxima devagar enquanto
 * está na tela e o selo de baixo troca junto. Os dois indicadores mostram o tempo de cada cena e
 * trocam com um toque; a troca pausa com o mouse em cima ou o foco dentro. Com "reduzir movimento",
 * não troca sozinha e as cenas só esmaecem.
 */
export function HeroSlides() {
  // seq cresce a cada troca: a cena que entra fica sempre por cima da que sai (também ao voltar).
  const [{ index, seq }, setState] = useState({ index: 0, seq: 0 });
  const [hold, setHold] = useState(false);
  const reduced = useSyncExternalStore(subscribe, () => window.matchMedia(REDUCED).matches, () => false);
  const slide = SLIDES[index]!;
  const go = (i: number) => setState((s) => ({ index: (i + SLIDES.length) % SLIDES.length, seq: s.seq + 1 }));

  return (
    <div
      role="group"
      aria-roledescription="apresentação"
      aria-label="Imagens da MEL"
      className="relative"
      onPointerEnter={(e) => e.pointerType === "mouse" && setHold(true)}
      onPointerLeave={(e) => e.pointerType === "mouse" && setHold(false)}
      onFocus={(e) => e.target.matches(":focus-visible") && setHold(true)}
      onBlur={(e) => !e.currentTarget.contains(e.relatedTarget as Node | null) && setHold(false)}
    >
      {/* isolate: as camadas das cenas (z-index crescente) ficam presas no quadro e nunca cobrem os controles. */}
      <div className="mh-slides relative isolate aspect-[16/11] w-full overflow-hidden rounded-hero bg-surface-muted shadow-lg lg:aspect-auto lg:h-[480px]">
        <AnimatePresence initial={false}>
          <motion.div
            key={slide.key}
            className="absolute inset-0"
            initial={reduced ? { opacity: 0 } : { clipPath: `circle(0% at ${slide.origin})` }}
            animate={reduced ? { opacity: 1 } : { clipPath: `circle(150% at ${slide.origin})` }}
            // A cena que sai escurece e se afasta de leve enquanto o círculo da nova se abre por cima
            // (uma saída "de 1 para 1" terminaria na hora e a cena sumiria antes da revelação).
            exit={reduced ? { opacity: 0, transition: { duration: 0.4 } } : { opacity: 0.45, scale: 1.04, transition: { duration: 1.2, ease: EASE } }}
            transition={{ duration: reduced ? 0.4 : 1.2, ease: EASE }}
            style={{ zIndex: seq + 1 }}
          >
            <motion.div
              className="size-full"
              initial={{ scale: reduced ? 1 : 1.1 }}
              animate={{ scale: 1 }}
              transition={{ duration: reduced ? 0 : DURATION_S + 1.2, ease: "linear" }}
            >
              <Image
                src={slide.src}
                alt={slide.alt}
                width={slide.width}
                height={slide.height}
                priority={index === 0}
                sizes="(min-width: 1024px) 560px, 100vw"
                className="size-full object-cover"
                style={{ objectPosition: slide.position }}
              />
            </motion.div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Indicadores: o tempo de cada cena; tocar troca de cena. */}
      <div className="absolute top-4 right-4 z-[4] flex gap-1.5 rounded-full border border-border-strong/60 bg-background/70 p-1.5 shadow-md backdrop-blur-md">
        {SLIDES.map((s, i) => (
          <button
            key={s.key}
            type="button"
            onClick={() => go(i)}
            aria-label={`Mostrar: ${s.label}`}
            aria-pressed={i === index}
            className="group relative flex h-6 w-11 items-center rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <span className="relative block h-1.5 w-full overflow-hidden rounded-full bg-text-primary/20 group-hover:bg-text-primary/35">
              {i === index && (
                <span
                  key={`${s.key}-${index}`}
                  className={`mh-slide-progress absolute inset-y-0 left-0 w-full origin-left rounded-full bg-primary ${hold ? "is-paused" : ""} ${reduced ? "is-static" : ""}`}
                  style={{ animationDuration: `${DURATION_S}s` }}
                  onAnimationEnd={() => go(index + 1)}
                />
              )}
            </span>
          </button>
        ))}
      </div>

      {/* Selo de baixo, trocando junto com a cena. Flutua sobre a borda de baixo (metade fora) para
          não cobrir o centro da cena (na ilustração do Guardião, o pino dourado do mapa). */}
      <div className="absolute -bottom-6 left-4 z-[3] overflow-hidden rounded-lg border border-border-strong/70 bg-background/85 shadow-md backdrop-blur-md">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={slide.key}
            className="flex items-center gap-3 py-2.5 pr-4 pl-3"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.35, ease: EASE }}
            aria-live="off"
          >
            <span aria-hidden="true" className={`mel-live size-2.5 shrink-0 rounded-full ${slide.chip.dot}`} />
            <span className="text-sm">
              <strong className="block font-bold">{slide.chip.title}</strong>
              <span className="text-text-secondary">{slide.chip.text}</span>
            </span>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
