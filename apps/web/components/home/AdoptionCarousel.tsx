"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent, type ReactNode } from "react";
import { ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";

const AUTOPLAY_MS = 5000;
const SWIPE_PX = 40;
const EASE = "cubic-bezier(.4,1.6,.4,1)";

/**
 * Carrossel circular dos anúncios de adoção da home: cartão da vez no centro e os vizinhos
 * inclinados e elevados dos lados. Gira sozinho a cada 5 s (pausa com o ponteiro em cima, com
 * o foco dentro, na aba escondida, pelo botão de pausa e com "reduzir movimento") e anda pelas
 * setas, pelos pontos, pelas setas do teclado, arrastando ou tocando num cartão lateral.
 * Só anima transform e opacity.
 */
export function AdoptionCarousel({ items, labels }: { items: ReactNode[]; labels: string[] }) {
  const n = items.length;
  // Com dois anúncios o anel repete a lista (A B A B) para haver vizinho dos dois lados;
  // as cópias ficam inertes nas laterais e os pontos continuam contando só os anúncios reais.
  const ring = n === 2 ? [...items, ...items] : items;
  const m = ring.length;
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false); // botão de pausa (decisão de quem vê)
  const [hold, setHold] = useState(false); // ponteiro em cima ou foco dentro
  const [reduced, setReduced] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [tick, setTick] = useState(0); // reinicia a contagem após um movimento manual
  const drag = useRef<{ x: number; y: number; id: number } | null>(null);
  const moved = useRef(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onMq = () => setReduced(mq.matches);
    const onVis = () => setHidden(document.hidden);
    onMq();
    onVis();
    mq.addEventListener("change", onMq);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      mq.removeEventListener("change", onMq);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  const go = useCallback(
    (to: number) => {
      setActive(((to % m) + m) % m);
      setTick((t) => t + 1);
    },
    [m],
  );

  const running = m > 1 && !paused && !hold && !reduced && !hidden;
  useEffect(() => {
    if (!running) return;
    const id = window.setTimeout(() => setActive((i) => (i + 1) % m), AUTOPLAY_MS);
    return () => window.clearTimeout(id);
  }, [running, active, tick, m]);

  if (n === 0) return null;

  function slot(i: number): "center" | "left" | "right" | "off" {
    if (i === active) return "center";
    if (i === (active + 1) % m) return "right";
    if (i === (active - 1 + m) % m) return "left";
    return "off";
  }

  function style(pos: ReturnType<typeof slot>): CSSProperties {
    const transition = reduced ? "opacity .2s linear" : `transform .7s ${EASE}, opacity .45s ease`;
    switch (pos) {
      case "center":
        return { transform: "translate3d(0,0,0) scale(1) rotateY(0deg)", opacity: 1, zIndex: 3, transition };
      case "left":
        return { transform: "translate3d(-42%,-7%,0) scale(.84) rotateY(15deg)", opacity: 1, zIndex: 2, transition };
      case "right":
        return { transform: "translate3d(42%,-7%,0) scale(.84) rotateY(-15deg)", opacity: 1, zIndex: 2, transition };
      default:
        return { transform: "translate3d(0,-7%,0) scale(.7)", opacity: 0, zIndex: 1, pointerEvents: "none", transition };
    }
  }

  function onKey(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      go(active - 1);
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      go(active + 1);
    }
  }

  function onPointerDown(e: PointerEvent<HTMLDivElement>) {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    drag.current = { x: e.clientX, y: e.clientY, id: e.pointerId };
    moved.current = false;
  }
  function onPointerMove(e: PointerEvent<HTMLDivElement>) {
    const d = drag.current;
    if (!d || d.id !== e.pointerId || moved.current) return;
    const dx = e.clientX - d.x;
    if (Math.abs(dx) > SWIPE_PX && Math.abs(dx) > Math.abs(e.clientY - d.y)) {
      moved.current = true;
      go(active + (dx < 0 ? 1 : -1));
    }
  }
  function onPointerEnd() {
    drag.current = null;
  }

  const current = active % n;
  /** Ponto i: vai para a posição do anel mais perto da atual com aquele anúncio. */
  function goReal(i: number) {
    if (m === n) return go(i);
    const fwd = (i - current + n) % n;
    go(fwd <= n / 2 ? active + fwd : active - (n - fwd));
  }

  if (n === 1) return <div className="mx-auto w-full max-w-[300px]">{items[0]}</div>;

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
        <div
          className="grid touch-pan-y select-none [perspective:1000px]"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerEnd}
          onPointerCancel={onPointerEnd}
          onClickCapture={(e) => {
            // Arrastar não abre o link do cartão.
            if (moved.current) {
              e.preventDefault();
              e.stopPropagation();
              moved.current = false;
            }
          }}
          aria-live={running ? "off" : "polite"}
        >
          {ring.map((node, i) => {
            const pos = slot(i);
            const side = pos === "left" || pos === "right";
            return (
              <div
                key={i}
                role="group"
                aria-roledescription="slide"
                aria-label={`${(i % n) + 1} de ${n}: ${labels[i % n]}`}
                aria-hidden={pos !== "center"}
                className="relative col-start-1 row-start-1 mx-auto w-[64%] max-w-[300px] will-change-transform sm:w-[54%]"
                style={style(pos)}
              >
                {/* Só o conteúdo fica inerte: a camada de clique abaixo precisa receber o toque. */}
                <div inert={pos !== "center"} className="h-full">
                  {node}
                </div>
                {side && (
                  // Camada de clique do cartão lateral: traz o cartão para o centro (o conteúdo fica inerte).
                  <button
                    type="button"
                    tabIndex={-1}
                    aria-hidden="true"
                    onClick={() => go(i)}
                    className="absolute inset-0 z-10 cursor-pointer rounded-card bg-bg/35 transition-colors duration-300 hover:bg-bg/10"
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <ArrowButton label="Anúncio anterior" onClick={() => go(active - 1)}>
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
        <ArrowButton label="Próximo anúncio" onClick={() => go(active + 1)}>
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
