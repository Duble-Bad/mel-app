"use client";

import type { ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useReducedMotion } from "./useReducedMotion";

/**
 * Conteúdo de um botão "Copiar link" com o feedback "Select Sweep"
 * (ui-motion-prompts, Copy to Clipboard 1): uma faixa de seleção na cor da MEL
 * varre o botão da esquerda para a direita e o rótulo vira "Link copiado" com
 * um check que se traça. Volta sozinho quando `copied` passa a `false`.
 * O botão que usa precisa de `relative overflow-hidden`.
 */
export function CopyFace({ copied, idle, done = "Link copiado!" }: { copied: boolean; idle: ReactNode; done?: string }) {
  const reduced = useReducedMotion();
  return (
    <>
      <AnimatePresence>
        {copied && !reduced && (
          <motion.span
            key="sweep"
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 origin-left bg-primary-soft"
            initial={{ scaleX: 0, opacity: 0.9 }}
            animate={{ scaleX: 1, opacity: [0.9, 0.9, 0] }}
            exit={{ opacity: 0 }}
            transition={{ scaleX: { duration: 0.32, ease: [0.65, 0, 0.35, 1] }, opacity: { duration: 0.9, times: [0, 0.6, 1] } }}
          />
        )}
      </AnimatePresence>
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={copied ? "done" : "idle"}
          className="relative inline-flex items-center gap-1.5"
          initial={reduced ? false : { opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduced ? undefined : { opacity: 0, y: -6 }}
          transition={{ duration: 0.18, delay: copied && !reduced ? 0.2 : 0 }}
        >
          {copied ? (
            <>
              <svg aria-hidden="true" viewBox="0 0 24 24" className="size-4 text-success" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <motion.path d="M5 12.5 10 17.5 19 7" initial={reduced ? false : { pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.25, delay: 0.3 }} />
              </svg>
              {done}
            </>
          ) : (
            idle
          )}
        </motion.span>
      </AnimatePresence>
    </>
  );
}
