import { CircleAlert, LoaderCircle, type LucideIcon, Search } from "lucide-react";
import type { ReactNode } from "react";

export function LoadingState({ label = "Carregando…" }: { label?: string }) {
  return (
    <div role="status" aria-live="polite" className="flex items-center gap-3 py-8 text-sm font-medium text-text-secondary">
      <LoaderCircle aria-hidden="true" className="size-5 animate-spin text-brand" strokeWidth={2} />
      {label}
    </div>
  );
}

export function ErrorState({
  title = "Algo não saiu como esperado.",
  children,
  action,
}: {
  title?: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div role="alert" className="flex flex-col items-start gap-3 rounded-card border border-status-lost/15 bg-status-lost-soft p-5">
      <span className="flex size-10 items-center justify-center rounded-full bg-surface text-status-lost shadow-xs">
        <CircleAlert aria-hidden="true" className="size-5" strokeWidth={2} />
      </span>
      <p className="text-lg font-semibold">{title}</p>
      {children && <div className="text-text-secondary">{children}</div>}
      {action}
    </div>
  );
}

/** Estado vazio com contexto: ícone, título, explicação e (opcional) uma ação. */
export function EmptyState({
  title,
  children,
  action,
  icon: Icon = Search,
}: {
  title: string;
  children?: ReactNode;
  action?: ReactNode;
  icon?: LucideIcon;
}) {
  return (
    <div className="flex flex-col items-start gap-3 rounded-card border border-border bg-surface p-6 shadow-xs">
      <span className="flex size-11 items-center justify-center rounded-full bg-primary-soft text-brand">
        <Icon aria-hidden="true" className="size-5" strokeWidth={1.75} />
      </span>
      <p className="text-lg font-semibold">{title}</p>
      {children && <div className="text-text-secondary">{children}</div>}
      {action}
    </div>
  );
}
