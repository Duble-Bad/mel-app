import type { ComponentProps, ReactNode } from "react";

/** Linha divisória com texto central ("ou continue com e-mail"). */
export function Divider({ children }: { children?: ReactNode }) {
  if (!children) return <hr className="border-border" />;
  return (
    <div className="flex items-center gap-4 text-sm font-medium text-text-secondary">
      <span aria-hidden="true" className="h-px flex-1 bg-border" />
      <span>{children}</span>
      <span aria-hidden="true" className="h-px flex-1 bg-border" />
    </div>
  );
}

/** Cartão base: superfície branca, raio de cartão, sombra sutil. */
export function Card({ className, ...props }: ComponentProps<"div">) {
  return <div {...props} className={`rounded-card border border-border/70 bg-surface p-5 shadow-sm ${className ?? ""}`} />;
}

/** Título de seção com ação opcional à direita ("Ver todos"). */
export function SectionHeader({ title, action, id }: { title: string; action?: ReactNode; id?: string }) {
  return (
    <div className="flex items-end justify-between gap-4">
      <h2 id={id} className="text-xl font-bold">
        {title}
      </h2>
      {action}
    </div>
  );
}

/** Bloco de carregamento com brilho suave (no lugar de spinners grandes). */
export function Skeleton({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`block animate-shimmer rounded-sm bg-[linear-gradient(90deg,var(--mel-surface-muted)_0%,var(--mel-border)_50%,var(--mel-surface-muted)_100%)] bg-[length:200%_100%] ${className ?? ""}`}
    />
  );
}

/** Esqueleto de cartão de pet/alerta (foto dominante + 3 linhas). */
export function PetCardSkeleton() {
  return (
    <div role="status" aria-label="Carregando" className="overflow-hidden rounded-card border border-border/70 bg-surface shadow-sm">
      <Skeleton className="aspect-[4/3] w-full rounded-none" />
      <div className="flex flex-col gap-2.5 p-4">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-5 w-2/3" />
        <Skeleton className="h-3.5 w-1/2" />
      </div>
    </div>
  );
}
