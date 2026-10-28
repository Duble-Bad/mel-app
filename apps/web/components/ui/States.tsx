import type { ReactNode } from "react";

export function LoadingState({ label = "Carregando…" }: { label?: string }) {
  return (
    <div role="status" aria-live="polite" className="flex items-center gap-3 py-8 text-text-secondary">
      <span
        aria-hidden="true"
        className="size-5 animate-spin rounded-full border-2 border-border-strong border-t-brand-primary"
      />
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
    <div role="alert" className="flex flex-col gap-3 rounded-lg bg-status-lost-soft p-5">
      <p className="font-bold text-status-lost">{title}</p>
      {children && <div className="text-text-primary">{children}</div>}
      {action}
    </div>
  );
}

export function EmptyState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-start gap-3 rounded-lg border-2 border-dashed border-border p-5">
      <p className="font-bold">{title}</p>
      {children && <div className="text-text-secondary">{children}</div>}
      {action}
    </div>
  );
}
