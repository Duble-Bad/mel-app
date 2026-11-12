"use client";

import { Popover } from "@ark-ui/react/popover";
import { Info } from "lucide-react";
import type { ReactNode } from "react";

/**
 * Ícone "i" ao lado de um rótulo que abre um balão com a explicação. Tira da tela os parágrafos de
 * ajuda sem esconder a informação: abre com toque, clique ou teclado (Enter/Espaço) e fecha com Esc
 * ou tocando fora. O conteúdo fica no DOM (oculto) logo após o botão, para leitores de tela e testes.
 */
export function InfoTip({ label, children, testId }: { label: string; children: ReactNode; testId?: string }) {
  return (
    <Popover.Root positioning={{ placement: "bottom-start", gutter: 6, strategy: "fixed" }}>
      <Popover.Trigger
        aria-label={label}
        className="inline-flex size-7 shrink-0 items-center justify-center rounded-full align-middle text-text-secondary transition-colors duration-200 ease-mel hover:bg-surface-muted hover:text-text-primary focus-visible:outline-2 focus-visible:outline-primary data-[state=open]:bg-primary-soft data-[state=open]:text-primary-soft-foreground"
      >
        <Info aria-hidden="true" className="size-4.5" strokeWidth={2} />
      </Popover.Trigger>
      <Popover.Positioner className="z-50">
        <Popover.Content
          data-testid={testId}
          className="w-[min(calc(100vw-2rem),22rem)] rounded-xl border border-border-strong bg-surface-elevated p-3.5 text-sm leading-relaxed font-normal text-text-primary shadow-lg outline-none data-[state=open]:animate-pop"
        >
          {children}
        </Popover.Content>
      </Popover.Positioner>
    </Popover.Root>
  );
}
