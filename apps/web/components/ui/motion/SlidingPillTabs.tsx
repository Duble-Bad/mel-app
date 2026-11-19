"use client";

import Link from "next/link";
import { useEffect, useLayoutEffect, useRef, type ReactNode } from "react";
import { useReducedMotion } from "./useReducedMotion";
import "./sliding-pill-tabs.css";

export interface PillTab {
  id: string;
  label: string;
  icon: ReactNode;
  /** Com `href` a aba é um link (navegação); sem ele, um botão que chama `onSelect`. */
  href?: string;
}

/** Folga (px) entre a pílula e as pontas da barra. */
const EDGE = 6;
/** Largura (px) da pílula parada, centrada na aba ativa. */
const REST = 64;
/** Distância (px) em que a cor do ícone vai de inativa a ativa. */
const TINT = 80;
/** Molas das duas bordas: a da frente (lado para onde a pílula vai) é rápida; a de trás, mais lenta. */
const LEAD = { w: 19, z: 0.55 };
const TRAIL = { w: 11, z: 0.72 };

interface Edge {
  x: number;
  v: number;
  target: number;
  w: number;
  z: number;
}

const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

/**
 * Barra de abas "Sliding Pill" (ui-motion-prompts, Tab Bar 1) nas cores da MEL: uma pílula dourada
 * fica sob a aba ativa e, ao trocar, suas duas bordas viajam em molas diferentes (a da frente mais
 * rápida, ω₀ = 19 e ζ = 0,55; a de trás mais lenta, ω₀ = 11 e ζ = 0,72), então ela estica no caminho
 * e volta à largura de repouso. A cor de cada aba mistura de inativa para ativa conforme a
 * distância até o meio da pílula. Com "reduzir movimento", a pílula troca de lugar sem mola.
 *
 * As molas rodam num requestAnimationFrame que escreve direto no estilo (sem re-render) e para
 * sozinho quando a pílula assenta. `active` é a única fonte da posição: ao navegar ou voltar, a
 * pílula vai para a aba da rota atual.
 */
export function SlidingPillTabs({ label, tabs, active, onSelect }: { label: string; tabs: readonly PillTab[]; active: string; onSelect?: (id: string) => void }) {
  const reduced = useReducedMotion();
  const bar = useRef<HTMLDivElement>(null);
  const pill = useRef<HTMLSpanElement>(null);
  const items = useRef<(HTMLElement | null)[]>([]);
  const left = useRef<Edge>({ x: 0, v: 0, target: 0, ...TRAIL });
  const right = useRef<Edge>({ x: 0, v: 0, target: 0, ...LEAD });
  const frame = useRef(0);
  const placed = useRef(false);
  const index = Math.max(0, tabs.findIndex((t) => t.id === active));

  useIsoLayoutEffect(() => {
    const el = bar.current;
    if (!el) return;

    /** Escreve a pílula e a cor de cada aba a partir das duas bordas. */
    const paint = () => {
      const l = left.current.x;
      const r = right.current.x;
      if (pill.current) {
        pill.current.style.transform = `translateX(${l.toFixed(2)}px)`;
        pill.current.style.width = `${Math.max(r - l, 0).toFixed(2)}px`;
      }
      const middle = (l + r) / 2;
      for (const item of items.current) {
        if (!item) continue;
        const center = item.offsetLeft + item.offsetWidth / 2;
        const c = Math.min(Math.max(1 - Math.abs(middle - center) / TINT, 0), 1);
        item.style.setProperty("--c", c.toFixed(3));
      }
    };

    /** Bordas de repouso da pílula na aba ativa, presas a 6 px das pontas da barra. */
    const rest = () => {
      const item = items.current[index];
      if (!item) return null;
      const center = item.offsetLeft + item.offsetWidth / 2;
      const half = Math.min(REST, item.offsetWidth - 2 * EDGE) / 2;
      return { l: Math.max(center - half, EDGE), r: Math.min(center + half, el.clientWidth - EDGE) };
    };

    const jump = () => {
      const t = rest();
      if (!t) return;
      cancelAnimationFrame(frame.current);
      frame.current = 0;
      Object.assign(left.current, { x: t.l, v: 0, target: t.l });
      Object.assign(right.current, { x: t.r, v: 0, target: t.r });
      paint();
    };

    const t = rest();
    if (!t) return;
    if (!placed.current || reduced) {
      placed.current = true;
      jump();
    } else {
      // A borda do lado para onde a pílula vai é a rápida.
      const toRight = (t.l + t.r) / 2 >= (left.current.x + right.current.x) / 2;
      Object.assign(left.current, { target: t.l }, toRight ? TRAIL : LEAD);
      Object.assign(right.current, { target: t.r }, toRight ? LEAD : TRAIL);
      const max = el.clientWidth - EDGE;
      let last = performance.now();
      const step = (now: number) => {
        // Passos fixos de 4 ms: a mola fica estável mesmo se um quadro atrasar.
        let dt = Math.min((now - last) / 1000, 0.05);
        last = now;
        while (dt > 0) {
          const h = Math.min(dt, 0.004);
          for (const e of [left.current, right.current]) {
            e.v += (-e.w * e.w * (e.x - e.target) - 2 * e.z * e.w * e.v) * h;
            e.x += e.v * h;
          }
          dt -= h;
        }
        // Presas dentro da barra, e a pílula nunca "vira do avesso".
        left.current.x = Math.min(Math.max(left.current.x, EDGE), max - 12);
        right.current.x = Math.max(Math.min(right.current.x, max), left.current.x + 12);
        paint();
        const settled = [left.current, right.current].every((e) => Math.abs(e.x - e.target) < 0.05 && Math.abs(e.v) < 0.5);
        if (settled) {
          left.current.x = left.current.target;
          right.current.x = right.current.target;
          paint();
          frame.current = 0;
        } else frame.current = requestAnimationFrame(step);
      };
      cancelAnimationFrame(frame.current);
      frame.current = requestAnimationFrame(step);
    }

    // Girar o aparelho ou mudar a largura: reposiciona sem animar.
    const ro = new ResizeObserver(() => {
      if (!frame.current) jump();
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [index, reduced, tabs.length]);

  useEffect(() => () => cancelAnimationFrame(frame.current), []);

  return (
    <nav aria-label={label} className="mel-pilltabs">
      <div ref={bar} className="mel-pilltabs__bar" style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}>
        <span ref={pill} aria-hidden="true" className="mel-pilltabs__pill" />
        {tabs.map((tab, i) => {
          const current = i === index;
          const content = (
            <>
              <span className="mel-pilltabs__icon" aria-hidden="true">
                {tab.icon}
              </span>
              <span className="mel-pilltabs__label">{tab.label}</span>
            </>
          );
          const ref = (el: HTMLElement | null) => {
            items.current[i] = el;
          };
          return tab.href ? (
            <Link key={tab.id} ref={ref} href={tab.href} aria-current={current ? "page" : undefined} className="mel-pilltabs__tab" onClick={() => onSelect?.(tab.id)}>
              {content}
            </Link>
          ) : (
            <button key={tab.id} ref={ref} type="button" aria-current={current ? "page" : undefined} className="mel-pilltabs__tab" onClick={() => onSelect?.(tab.id)}>
              {content}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
