import { ViewTransition, type ReactNode } from "react";

/**
 * "Shared Element" (ui-motion-prompts, Screen Transition 3): a foto tocada no
 * cartão (mural, mapa, início) "voa" e cresce até a foto grande da página do
 * caso. Usa o View Transitions do navegador via React (`ViewTransition`), sem
 * biblioteca; navegador sem suporte só troca a página, como antes. O nome liga
 * as duas fotos: os dois lados chamam `casePhotoName` com o mesmo endereço.
 * CSS do voo e "reduzir movimento" em app/globals.css (`.morph`).
 */
export function casePhotoName(href: string): string {
  return `foto-${href.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "")}`;
}

export function SharedPhoto({ name, children }: { name?: string; children: ReactNode }) {
  if (!name) return <>{children}</>;
  return (
    <ViewTransition name={name} share="morph" default="none">
      {children}
    </ViewTransition>
  );
}
