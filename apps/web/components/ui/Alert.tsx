import type { ReactNode } from "react";

type Tone = "error" | "success" | "info";

const tones: Record<Tone, { box: string; icon: string; label: string }> = {
  error: { box: "border-status-lost bg-status-lost-soft text-status-lost", icon: "!", label: "Atenção" },
  success: { box: "border-status-found bg-status-found-soft text-status-found", icon: "✓", label: "Tudo certo" },
  info: { box: "border-border-strong bg-surface-muted text-text-primary", icon: "i", label: "Informação" },
};

/** Mensagem de feedback. Usa ícone + texto, não só cor. */
export function Alert({ tone = "info", children }: { tone?: Tone; children: ReactNode }) {
  const t = tones[tone];
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={`flex gap-3 rounded-md border-l-4 p-4 ${t.box}`}
    >
      <span aria-hidden="true" className="font-bold">
        {t.icon}
      </span>
      <span className="sr-only">{t.label}:</span>
      <div className="font-medium">{children}</div>
    </div>
  );
}
