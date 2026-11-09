import { Check, TriangleAlert, type LucideIcon } from "lucide-react";

export type StepState = "current" | "done" | "skipped" | "pending" | "error";

const STATE_TEXT: Record<StepState, string> = {
  current: "Etapa atual",
  done: "Concluída",
  skipped: "Pulada (opcional)",
  pending: "Pendente",
  error: "Com erro",
};

/**
 * Etapas de um assistente: ícone, número, nome, conector e estado (atual, concluída, pulada,
 * pendente ou com erro). Etapas já percorridas viram botões para voltar a elas. No celular fica
 * compacto: círculos menores, nomes curtos e a linha "Passo N de M" com o nome da etapa atual.
 */
export function StepIndicator({
  steps,
  states,
  onSelect,
  label = "Etapas",
}: {
  steps: { label: string; icon: LucideIcon }[];
  states: StepState[];
  /** Chamado ao tocar numa etapa já percorrida (concluída ou pulada). */
  onSelect?: (index: number) => void;
  label?: string;
}) {
  const current = Math.max(
    0,
    states.findIndex((s) => s === "current" || s === "error"),
  );
  // O trecho entre duas etapas fica preenchido quando a da esquerda já foi percorrida.
  const passed = (i: number) => states[i] === "done" || states[i] === "skipped";
  return (
    <nav aria-label={label} className="flex flex-col gap-2" data-testid="etapas">
      <p className="text-sm font-semibold text-text-secondary sm:hidden" aria-hidden="true">
        Passo {current + 1} de {steps.length} · <span className="text-status-lost">{steps[current]?.label}</span>
        {states[current] === "error" && <span className="font-bold text-danger"> · com erro</span>}
      </p>
      <ol
        className="grid"
        style={{
          gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))`,
        }}
      >
        {steps.map((step, i) => {
          const state = states[i] ?? "pending";
          const Icon = state === "done" ? Check : state === "error" ? TriangleAlert : step.icon;
          const circle = {
            current: "bg-status-lost-solid text-white ring-4 ring-status-lost-solid/25",
            done: "border-2 border-status-lost-solid bg-status-lost-soft text-status-lost",
            skipped: "border-2 border-dashed border-border-strong bg-surface text-text-secondary",
            pending: "border border-border-strong bg-surface text-text-secondary",
            error: "bg-danger-solid text-white ring-4 ring-danger-solid/25",
          }[state];
          const clickable = Boolean(onSelect) && (state === "done" || state === "skipped");
          const content = (
            <>
              <span className="flex w-full items-center" aria-hidden="true">
                <span className={`h-0.5 flex-1 ${i === 0 ? "invisible" : passed(i - 1) ? "bg-status-lost-solid" : "bg-border-strong"}`} />
                <span className={`mx-1 flex size-9 shrink-0 items-center justify-center rounded-full transition-colors duration-200 ease-mel sm:size-11 ${circle}`}>
                  <Icon className="size-4 sm:size-5" strokeWidth={2.25} />
                </span>
                <span className={`h-0.5 flex-1 ${i === steps.length - 1 ? "invisible" : passed(i) ? "bg-status-lost-solid" : "bg-border-strong"}`} />
              </span>
              <span className="mt-1.5 flex flex-col items-center px-0.5 text-center leading-tight">
                <span className="hidden text-[11px] font-semibold tracking-wide text-text-secondary uppercase sm:block">Etapa {i + 1}</span>
                <span
                  className={`text-[11px] sm:text-sm ${state === "current" ? "font-bold text-status-lost" : state === "error" ? "font-bold text-danger" : state === "done" ? "font-semibold text-text-primary" : "text-text-secondary"}`}
                >
                  {step.label}
                </span>
                <span className={`hidden text-xs sm:block ${state === "error" ? "font-semibold text-danger" : "text-text-secondary"}`}>{STATE_TEXT[state]}</span>
                <span className="sr-only">
                  , etapa {i + 1} de {steps.length}: {STATE_TEXT[state]}
                </span>
              </span>
            </>
          );
          return (
            <li key={step.label} aria-current={i === current ? "step" : undefined} data-state={state} data-testid={`etapa-${i + 1}`}>
              {clickable ? (
                <button type="button" onClick={() => onSelect?.(i)} className="flex w-full flex-col items-center rounded-md py-1" title={`Voltar para ${step.label}`}>
                  {content}
                </button>
              ) : (
                <div className="flex w-full flex-col items-center py-1">{content}</div>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
