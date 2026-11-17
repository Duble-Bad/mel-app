import { CircleAlert, CircleCheck, Info } from "lucide-react";
import type { ReactNode } from "react";
import { SuccessCheck } from "@/components/ui/motion/SuccessCheck";

type Tone = "error" | "success" | "info";

const tones: Record<Tone, { box: string; icon: typeof Info; iconClass: string; label: string }> = {
  error: { box: "border-status-lost/20 bg-status-lost-soft", icon: CircleAlert, iconClass: "text-status-lost", label: "Atenção" },
  success: { box: "border-status-found/20 bg-status-found-soft", icon: CircleCheck, iconClass: "text-status-found", label: "Tudo certo" },
  info: { box: "border-border bg-surface-muted", icon: Info, iconClass: "text-text-secondary", label: "Informação" },
};

/**
 * Mensagem de feedback na página. Ícone + texto, não só cor.
 * `celebrate` (só com `success`): no lugar do ícone, o selo animado de sucesso
 * (anel, preenchimento e check), para momentos de conclusão (publicou, enviou).
 */
export function Alert({
  tone = "info",
  celebrate,
  children,
}: {
  tone?: Tone;
  celebrate?: "found" | "brand" | "sighting";
  children: ReactNode;
}) {
  const t = tones[tone];
  const Icon = t.icon;
  return (
    <div role={tone === "error" ? "alert" : "status"} className={`flex animate-enter gap-3 rounded-md border px-4 py-3.5 text-sm ${t.box} ${celebrate ? "items-center" : ""}`}>
      {celebrate && tone === "success" ? (
        <SuccessCheck tone={celebrate} size={36} />
      ) : (
        <Icon aria-hidden="true" className={`mt-px size-5 shrink-0 ${t.iconClass}`} strokeWidth={2} />
      )}
      <span className="sr-only">{t.label}:</span>
      <div className="font-medium text-text-primary">{children}</div>
    </div>
  );
}
