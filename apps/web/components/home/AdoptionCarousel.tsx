"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type KeyboardEvent, type ReactNode, type Ref } from "react";
import { animate, motion, useMotionValue, useTransform, type MotionValue, type PanInfo } from "motion/react";
import { ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";

const AUTOPLAY_MS = 5000;
/** Deslocamento do cartão lateral, em fração da largura do cartão. */
const SIDE_X = 0.42;
/** Mola do encaixe: chega rápido e balança de leve, como o original. */
const SPRING = { type: "spring", stiffness: 240, damping: 26, mass: 0.9 } as const;

/** Distância circular de i até a posição v, em [-m/2, m/2). */
function wrap(v: number, m: number) {
  return ((((v + m / 2) % m) + m) % m) - m / 2;
}
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

// "Reduzir movimento": no servidor e no 1º desenho vale `false` (igual ao HTML), depois o valor real.
// (O `useReducedMotion` do motion já responde no 1º desenho e quebrava a hidratação.)
const REDUCED_QUERY = "(prefers-reduced-motion: reduce)";
function subscribeReduced(cb: () => void) {
  const mq = window.matchMedia(REDUCED_QUERY);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}
const usePrefersReducedMotion = () =>
  useSyncExternalStore(subscribeReduced, () => window.matchMedia(REDUCED_QUERY).matches, () => false);

/**
 * Carrossel circular dos anúncios de adoção da home: cartão da vez no centro e os vizinhos
 * inclinados e elevados dos lados. A posição é contínua (`pos`): ao arrastar, os cartões seguem
 * o dedo ou o mouse e, ao soltar, encaixam com mola no mais próximo (ou no seguinte, se o gesto
 * for rápido). Gira sozinho a cada 5 s (pausa com o mouse em cima, foco pelo teclado, aba
 * escondida, durante o arraste e pelo botão de pausa; "reduzir movimento" desliga) e anda pelas
 * setas, pelos pontos, pelas setas do teclado ou tocando num cartão lateral.
 */
export function AdoptionCarousel({ items, labels }: { items: ReactNode[]; labels: string[] }) {
  const n = items.length;
  // Com dois anúncios o anel repete a lista (A B A B) para haver vizinho dos dois lados;
  // as cópias ficam inertes nas laterais e os pontos continuam contando só os anúncios reais.
  const ring = n === 2 ? [...items, ...items] : items;
  const m = ring.length;

  const pos = useMotionValue(0); // posição contínua no anel (pode passar de m; o desenho dá a volta)
  const [target, setTarget] = useState(0); // cartão inteiro onde a posição vai parar
  const targetRef = useRef(0);
  const [paused, setPaused] = useState(false); // botão de pausa (decisão de quem vê)
  const [hold, setHold] = useState(false); // mouse em cima ou foco pelo teclado
  const [dragging, setDragging] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [tick, setTick] = useState(0); // reinicia a contagem após um movimento manual
  const reduced = usePrefersReducedMotion();
  const slideRef = useRef<HTMLDivElement>(null);
  const panStart = useRef(0);
  const moved = useRef(false);

  useEffect(() => {
    const onVis = () => setHidden(document.hidden);
    onVis();
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  /** Leva a posição até o cartão `to` (inteiro) com mola, ou direto com "reduzir movimento". */
  const settle = useCallback(
    (to: number) => {
      targetRef.current = to;
      setTarget(to);
      animate(pos, to, reduced ? { duration: 0 } : SPRING);
    },
    [pos, reduced],
  );

  const go = useCallback(
    (to: number) => {
      settle(to);
      setTick((t) => t + 1);
    },
    [settle],
  );

  const running = m > 1 && !paused && !hold && !dragging && !reduced && !hidden;
  useEffect(() => {
    if (!running) return;
    const id = window.setTimeout(() => settle(targetRef.current + 1), AUTOPLAY_MS);
    return () => window.clearTimeout(id);
  }, [running, target, tick, settle]);

  if (n === 0) return null;
  if (n === 1) return <div className="mx-auto w-full max-w-[300px]">{items[0]}</div>;

  const center = ((target % m) + m) % m;
  const current = center % n;

  /** Ponto i: vai para a posição do anel mais perto da atual com aquele anúncio. */
  function goReal(i: number) {
    const fwd = (i - current + n) % n;
    go(target + (fwd <= n / 2 ? fwd : fwd - n));
  }

  function onKey(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      go(target - 1);
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      go(target + 1);
    }
  }

  /** Quantos pixels de arraste equivalem a um cartão: o quanto o cartão do centro anda até a lateral. */
  const stepPx = () => Math.max(60, (slideRef.current?.offsetWidth ?? 280) * SIDE_X);

  function onPanStart() {
    pos.stop();
    panStart.current = pos.get();
    moved.current = true;
    setDragging(true);
  }
  function onPan(_: PointerEvent, info: PanInfo) {
    pos.set(panStart.current - info.offset.x / stepPx());
  }
  function onPanEnd(_: PointerEvent, info: PanInfo) {
    setDragging(false);
    const step = stepPx();
    // Projeta o gesto pela velocidade (lançar com o dedo passa para o próximo) e anda no máximo um cartão.
    const projected = pos.get() - (info.velocity.x / step) * 0.18;
    const base = Math.round(panStart.current);
    go(clamp(Math.round(projected), base - 1, base + 1));
  }

  return (
    <div
      role="region"
      aria-roledescription="carrossel"
      aria-label="Animais para adoção"
      className="flex flex-col items-center gap-5"
      // Pausa com mouse em cima ou foco pelo teclado. O toque no celular não pausa: ele simula
      // "mouseenter" sem "mouseleave" e deixa o foco no botão, o que travaria a troca automática.
      onPointerEnter={(e) => e.pointerType === "mouse" && setHold(true)}
      onPointerLeave={(e) => e.pointerType === "mouse" && setHold(false)}
      onFocus={(e) => {
        if (e.target.matches(":focus-visible")) setHold(true);
      }}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setHold(false);
      }}
      onKeyDown={onKey}
    >
      {/* overflow-x-clip: os cartões laterais passam da coluna sem criar rolagem. No celular a faixa
          vai até a borda da tela (anula o px-4 da seção) para o corte acontecer na borda, não na margem. */}
      <div className="-mx-4 w-[calc(100%+2rem)] overflow-x-clip pt-6 lg:mx-0 lg:w-full">
        <motion.div
          className={`grid touch-pan-y select-none [perspective:1000px] ${dragging ? "cursor-grabbing" : "cursor-grab"}`}
          onPanStart={onPanStart}
          onPan={onPan}
          onPanEnd={onPanEnd}
          onPointerDownCapture={() => {
            moved.current = false;
          }}
          // Sem isso o navegador começa a arrastar a foto ou o link (arrastar e soltar nativo) e cancela o gesto.
          onDragStartCapture={(e) => e.preventDefault()}
          onPointerCancel={() => {
            // Gesto interrompido pelo sistema: encaixa no cartão mais próximo em vez de ficar no meio.
            if (dragging) {
              setDragging(false);
              go(Math.round(pos.get()));
            }
          }}
          onClickCapture={(e) => {
            // Arrastar não abre o link do cartão nem conta como toque no cartão lateral.
            if (moved.current) {
              e.preventDefault();
              e.stopPropagation();
              moved.current = false;
            }
          }}
          aria-live={running ? "off" : "polite"}
        >
          {ring.map((node, i) => {
            const rel = wrap(i - target, m);
            const isCenter = i === center;
            return (
              <Slide
                key={i}
                ref={i === 0 ? slideRef : undefined}
                pos={pos}
                index={i}
                m={m}
                label={`${(i % n) + 1} de ${n}: ${labels[i % n]}`}
                isCenter={isCenter}
                onSideTap={Math.abs(rel) === 1 ? () => go(target + rel) : undefined}
              >
                {node}
              </Slide>
            );
          })}
        </motion.div>
      </div>

      <div className="flex items-center gap-3">
        <ArrowButton label="Anúncio anterior" onClick={() => go(target - 1)}>
          <ChevronLeft aria-hidden="true" className="size-5" strokeWidth={2.5} />
        </ArrowButton>
        <div className="flex items-center gap-1" role="group" aria-label="Escolher anúncio">
          {items.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => goReal(i)}
              aria-label={`Ver ${labels[i]}`}
              aria-current={i === current ? "true" : undefined}
              className="group flex size-6 items-center justify-center rounded-full focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary"
            >
              <span
                className={`block h-2 rounded-full transition-[width,background-color] duration-300 ${
                  i === current ? "w-5 bg-primary" : "w-2 bg-text-muted/50 group-hover:bg-text-muted"
                }`}
              />
            </button>
          ))}
        </div>
        <ArrowButton label="Próximo anúncio" onClick={() => go(target + 1)}>
          <ChevronRight aria-hidden="true" className="size-5" strokeWidth={2.5} />
        </ArrowButton>
        {!reduced && (
          <button
            type="button"
            onClick={() => setPaused((p) => !p)}
            aria-label={paused ? "Retomar troca automática" : "Pausar troca automática"}
            className="ml-1 flex size-9 items-center justify-center rounded-full text-text-secondary transition-colors hover:bg-surface-muted hover:text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            {paused ? <Play aria-hidden="true" className="size-4" strokeWidth={2.25} /> : <Pause aria-hidden="true" className="size-4" strokeWidth={2.25} />}
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * Um cartão do anel. Tudo deriva da distância `d` até a posição atual: 0 no centro, ±1 nas
 * laterais e, além disso, some atrás (é ali que o anel "dá a volta" sem aparecer).
 */
function Slide({
  ref,
  pos,
  index,
  m,
  label,
  isCenter,
  onSideTap,
  children,
}: {
  ref?: Ref<HTMLDivElement>;
  pos: MotionValue<number>;
  index: number;
  m: number;
  label: string;
  isCenter: boolean;
  onSideTap?: () => void;
  children: ReactNode;
}) {
  const d = useTransform(pos, (v) => wrap(index - v, m));
  const x = useTransform(d, (v) => `${clamp(v, -1.6, 1.6) * SIDE_X * 100}%`);
  const y = useTransform(d, (v) => `${-7 * Math.min(Math.abs(v), 1)}%`);
  const scale = useTransform(d, (v) => 1 - 0.16 * Math.min(Math.abs(v), 1));
  const rotateY = useTransform(d, (v) => -15 * clamp(v, -1, 1));
  const opacity = useTransform(d, (v) => {
    const a = Math.abs(v);
    return a <= 1 ? 1 : Math.max(0, 1 - (a - 1) * 2.5);
  });
  const zIndex = useTransform(d, (v) => Math.round(10 - Math.abs(v) * 3));
  const pointerEvents = useTransform(d, (v) => (Math.abs(v) > 1.2 ? "none" : "auto"));

  return (
    <motion.div
      ref={ref}
      role="group"
      aria-roledescription="slide"
      aria-label={label}
      aria-hidden={!isCenter}
      className="relative col-start-1 row-start-1 mx-auto w-[64%] max-w-[300px] will-change-transform sm:w-[54%]"
      style={{ x, y, scale, rotateY, opacity, zIndex, pointerEvents }}
    >
      {/* Só o conteúdo fica inerte: a camada de clique abaixo precisa receber o toque. */}
      <div inert={!isCenter} className="h-full">
        {children}
      </div>
      {onSideTap && (
        // Camada de clique do cartão lateral: traz o cartão para o centro.
        <button
          type="button"
          tabIndex={-1}
          aria-hidden="true"
          onClick={onSideTap}
          className="absolute inset-0 z-10 cursor-pointer rounded-card bg-bg/35 transition-colors duration-300 hover:bg-bg/10"
        />
      )}
    </motion.div>
  );
}

function ArrowButton({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="flex size-11 items-center justify-center rounded-full border border-border bg-surface text-text transition-[background-color,color,border-color,transform] duration-200 hover:border-primary hover:bg-primary hover:text-primary-foreground active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
    >
      {children}
    </button>
  );
}
