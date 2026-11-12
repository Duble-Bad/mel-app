"use client";

import { AnimatePresence, motion } from "motion/react";
import { ChevronLeft, ChevronRight, Expand } from "lucide-react";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import "./pet-gallery.css";

interface Photo {
  id: string;
  url: string;
  thumbUrl: string;
}

const AUTOPLAY_MS = 5000;

const reducedQuery = "(prefers-reduced-motion: reduce)";
const subscribeReduced = (cb: () => void) => {
  const m = window.matchMedia(reducedQuery);
  m.addEventListener("change", cb);
  return () => m.removeEventListener("change", cb);
};

/**
 * Galeria da página do pet: a foto aparece inteira (sem corte) sobre ela mesma desfocada; troca
 * sozinha a cada 5 s (pausa com o mouse em cima, com foco ou depois de uma escolha manual por um
 * ciclo; parada com "reduzir movimento"); setas, arrastar com o dedo e miniaturas trocam a foto
 * grande no lugar. "Ver inteira" abre a foto em uma nova página.
 */
export function PetGallery({ photos, name }: { photos: Photo[]; name: string }) {
  const [index, setIndex] = useState(0);
  const [dir, setDir] = useState(1);
  const [paused, setPaused] = useState(false);
  const [cycle, setCycle] = useState(0);
  const reduced = useSyncExternalStore(subscribeReduced, () => window.matchMedia(reducedQuery).matches, () => true);
  const many = photos.length > 1;
  const current = photos[index];

  const go = useCallback(
    (next: number, direction: number) => {
      setDir(direction);
      setIndex((next + photos.length) % photos.length);
      setCycle((c) => c + 1); // reinicia o tempo da troca automática
    },
    [photos.length],
  );

  useEffect(() => {
    if (!many || paused || reduced) return;
    const t = window.setTimeout(() => {
      setDir(1);
      setIndex((i) => (i + 1) % photos.length);
      setCycle((c) => c + 1);
    }, AUTOPLAY_MS);
    return () => window.clearTimeout(t);
  }, [many, paused, reduced, photos.length, cycle]);

  // Arrastar com o dedo (ou o mouse): mais de 40 px troca de foto.
  const startX = useRef<number | null>(null);

  return (
    <div className="flex w-full min-w-0 flex-col gap-3" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} onFocus={() => setPaused(true)} onBlur={() => setPaused(false)}>
      <div
        className="relative isolate aspect-[4/5] w-full min-w-0 touch-pan-y overflow-hidden rounded-2xl bg-surface-muted select-none lg:max-h-[78vh]"
        role="region"
        aria-roledescription="carrossel"
        aria-label={`Fotos de ${name}`}
        onPointerDown={(e) => {
          startX.current = e.clientX;
          // Captura: o soltar chega aqui mesmo se o dedo sair da foto.
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerUp={(e) => {
          if (startX.current == null || !many) return;
          const dx = e.clientX - startX.current;
          startX.current = null;
          if (Math.abs(dx) > 40) go(index + (dx < 0 ? 1 : -1), dx < 0 ? 1 : -1);
        }}
        onPointerCancel={() => {
          startX.current = null;
        }}
      >
        <AnimatePresence initial={false} custom={dir} mode="popLayout">
          <motion.div
            key={current.id}
            custom={dir}
            className="absolute inset-0 flex items-center justify-center"
            initial={reduced ? { opacity: 0 } : { opacity: 0, x: dir * 40, scale: 1.02 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={reduced ? { opacity: 0 } : { opacity: 0, x: dir * -40, scale: 0.98 }}
            transition={{ duration: reduced ? 0.2 : 0.45, ease: [0.22, 1, 0.36, 1] }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- fundo decorativo (miniatura) */}
            <img src={current.thumbUrl} alt="" aria-hidden="true" draggable={false} className="absolute inset-0 -z-10 size-full scale-110 object-cover opacity-60 blur-2xl" />
            {/* eslint-disable-next-line @next/next/no-img-element -- imagem já otimizada (1280px) no upload */}
            <img
              src={current.url}
              alt={`Foto de ${name}${many ? ` (${index + 1} de ${photos.length})` : ""}`}
              draggable={false}
              className="max-h-full max-w-full object-contain"
            />
          </motion.div>
        </AnimatePresence>

        {/* Ver a foto inteira, em nova página: discreto, no topo. */}
        <a
          href={current.url}
          target="_blank"
          rel="noreferrer"
          onPointerDown={(e) => e.stopPropagation()}
          className="absolute top-3 right-3 z-10 inline-flex items-center gap-1.5 rounded-full bg-[rgb(0_0_0/0.45)] px-3 py-1.5 text-xs font-semibold text-white backdrop-blur-sm transition-colors duration-200 ease-mel hover:bg-[rgb(0_0_0/0.65)]"
        >
          <Expand aria-hidden="true" className="size-3.5" strokeWidth={2.25} />
          Ver inteira
        </a>

        {many && (
          <>
            {(["prev", "next"] as const).map((side) => (
              <button
                key={side}
                type="button"
                aria-label={side === "prev" ? "Foto anterior" : "Próxima foto"}
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => go(index + (side === "prev" ? -1 : 1), side === "prev" ? -1 : 1)}
                className={`absolute top-1/2 z-10 inline-flex size-11 -translate-y-1/2 items-center justify-center rounded-full bg-[rgb(0_0_0/0.45)] text-white backdrop-blur-sm transition-colors duration-200 ease-mel hover:bg-[rgb(0_0_0/0.65)] ${
                  side === "prev" ? "left-3" : "right-3"
                }`}
              >
                {side === "prev" ? <ChevronLeft aria-hidden="true" className="size-5" strokeWidth={2.5} /> : <ChevronRight aria-hidden="true" className="size-5" strokeWidth={2.5} />}
              </button>
            ))}
            {/* Indicadores: o atual é uma barra que enche no tempo da troca automática. */}
            <div className="absolute inset-x-0 bottom-3 z-10 flex justify-center gap-1.5">
              {photos.map((p, i) => (
                <span key={p.id} aria-hidden="true" className={`relative h-1.5 overflow-hidden rounded-full bg-[rgb(255_255_255/0.4)] transition-[width] duration-300 ease-mel ${i === index ? "w-7" : "w-1.5"}`}>
                  {i === index && !paused && !reduced && (
                    <span key={cycle} className="pg-fill absolute inset-0 origin-left rounded-full bg-primary" style={{ animationDuration: `${AUTOPLAY_MS}ms` }} />
                  )}
                  {i === index && (paused || reduced) && <span className="absolute inset-0 rounded-full bg-primary" />}
                </span>
              ))}
            </div>
          </>
        )}
      </div>

      {many && (
        <ul className="-m-1 flex gap-2 overflow-x-auto p-1" aria-label="Escolher foto">
          {photos.map((p, i) => (
            <li key={p.id} className="shrink-0">
              <button
                type="button"
                onClick={() => go(i, i >= index ? 1 : -1)}
                aria-label={`Mostrar foto ${i + 1} de ${photos.length}`}
                aria-current={i === index || undefined}
                className={`block size-18 overflow-hidden rounded-xl ring-offset-1 ring-offset-background transition-[opacity,box-shadow] duration-200 ease-mel sm:size-20 ${
                  i === index ? "ring-2 ring-primary" : "opacity-60 hover:opacity-100"
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- miniatura */}
                <img src={p.thumbUrl} alt="" loading="lazy" draggable={false} className="size-full object-cover" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
