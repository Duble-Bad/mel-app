/** Progresso discreto de um fluxo em etapas: "Passo 2 de 4" + barra segmentada. */
export function ProgressSteps({ current, total, label }: { current: number; total: number; label?: string }) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-semibold text-text-secondary">
        Passo {current} de {total}
        {label && <span className="font-medium"> · {label}</span>}
      </p>
      <div
        role="progressbar"
        aria-valuemin={1}
        aria-valuemax={total}
        aria-valuenow={current}
        aria-label={`Passo ${current} de ${total}`}
        className="grid gap-1.5"
        style={{ gridTemplateColumns: `repeat(${total}, 1fr)` }}
      >
        {Array.from({ length: total }, (_, i) => (
          <span
            key={i}
            className={`h-1.5 rounded-full transition-colors duration-300 ease-mel ${i < current ? "bg-primary" : "bg-border"}`}
          />
        ))}
      </div>
    </div>
  );
}
