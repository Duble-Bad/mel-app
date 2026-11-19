"use client";

import { useState } from "react";
import { MotionConfig } from "motion/react";
import { useReducedMotion } from "@/components/ui/motion/useReducedMotion";
import { CasesGrid } from "./CasesGrid";
import { FooterCta } from "./FooterCta";
import { Hero } from "./Hero";
import { LiveNumbers } from "./LiveNumbers";
import { NetworkStory } from "./NetworkStory";
import { Playground } from "./Playground";
import { Reunion } from "./Reunion";
import { ReducedContext } from "./shared";
import "./conceito-motion.css";

/**
 * Conceito de movimento da MEL (página interna). Tudo aqui é demonstração: dados fictícios,
 * nenhuma chamada ao servidor. "Movimento reduzido" vale pela preferência do sistema OU pela chave
 * fixa no canto, que simula a preferência para comparar os dois modos.
 */
export function ConceptMotion() {
  const system = useReducedMotion();
  const [forced, setForced] = useState(false);
  const reduced = system || forced;

  return (
    <ReducedContext value={reduced}>
      <MotionConfig reducedMotion={reduced ? "always" : "never"}>
        <div id="topo" className="cm-root" data-motion={reduced ? "reduced" : "normal"}>
          {/* Filtro "gooey" compartilhado (barra de abas e rodapé). */}
          <svg width="0" height="0" className="absolute" aria-hidden="true" focusable="false">
            <defs>
              <filter id="cm-goo">
                <feGaussianBlur in="SourceGraphic" stdDeviation="9" result="b" />
                <feColorMatrix in="b" mode="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 22 -9" />
              </filter>
              <filter id="cm-goo-lg">
                <feGaussianBlur in="SourceGraphic" stdDeviation="18" result="b" />
                <feColorMatrix in="b" mode="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 26 -11" />
              </filter>
            </defs>
          </svg>

          <Hero />
          <NetworkStory />
          <CasesGrid />
          <LiveNumbers />
          <Reunion />
          <Playground />
          <FooterCta />

          <div className="cm-toggle" role="group" aria-label="Movimento da página">
            <span className="cm-toggle-label">Movimento</span>
            <button type="button" aria-pressed={!reduced} disabled={system} onClick={() => setForced(false)}>
              Normal
            </button>
            <button type="button" aria-pressed={reduced} onClick={() => setForced(true)}>
              Reduzido
            </button>
          </div>
        </div>
      </MotionConfig>
    </ReducedContext>
  );
}
