"use client";

import { useSyncExternalStore } from "react";

const QUERY = "(prefers-reduced-motion: reduce)";

function subscribe(onChange: () => void) {
  const mq = matchMedia(QUERY);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

/**
 * "Reduzir movimento" do sistema, seguro para a hidratação: no servidor vale
 * `false` (o HTML já sai no estado inicial da animação) e o valor real chega na
 * hidratação. Quem anima no mount deve usar `key={String(reduced)}` para remontar
 * no estado final quando a pessoa pediu menos movimento. O `useReducedMotion`
 * do motion quebrava a hidratação (ver AdoptionCarousel).
 */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, () => matchMedia(QUERY).matches, () => false);
}
