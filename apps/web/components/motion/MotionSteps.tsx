"use client";

import { TriangleAlert, type LucideIcon } from "lucide-react";
import type { StepState } from "@/components/ui/StepIndicator";
import { s } from "./classes";

export type MotionVariant = "a" | "b";

const STATE_TEXT: Record<StepState, string> = {
  current: "Etapa atual",
  done: "Concluída",
  skipped: "Pulada (opcional)",
  pending: "Pendente",
  error: "Com erro",
};

/** ✓ como traço (o CSS desenha o traço quando a etapa fica concluída). */
function CheckDraw() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.75} strokeLinecap="round" strokeLinejoin="round" className={s.check} aria-hidden="true">
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  );
}

/**
 * PROTÓTIPO (DEV): indicador de etapas com movimento, mesma interface do `StepIndicator`
 * (etapas, estados, voltar tocando numa etapa percorrida) e duas linguagens de movimento:
 * "a" (progressão elegante) e "b" (progressão dinâmica). Deve ficar dentro de um
 * `MotionRoot` com a mesma variante. Com 5+ etapas fica denso no celular: só a atual mostra
 * o nome embaixo, e a linha "Passo N de M · nome" diz onde o tutor está.
 */
export function MotionSteps({
  steps,
  states,
  onSelect,
  label = "Etapas",
  variant,
  direction = "forward",
  prefix,
}: {
  /** Texto antes de "Passo N de M" (ex.: "Editar alerta · "). */
  prefix?: string;
  steps: { label: string; icon: LucideIcon }[];
  states: StepState[];
  onSelect?: (index: number) => void;
  label?: string;
  variant: MotionVariant;
  /** Sentido da última troca: o número do "Passo N de M" rola para cima ou para baixo. */
  direction?: "forward" | "back";
}) {
  const n = steps.length;
  const current = Math.max(
    0,
    states.findIndex((st) => st === "current" || st === "error"),
  );
  const passed = (i: number) => states[i] === "done" || states[i] === "skipped";
  const dense = n >= 5;
  const progress = n > 1 ? current / (n - 1) : 0;
  const hasError = states[current] === "error";

  return (
    <nav aria-label={label} className="flex flex-col gap-2" data-testid="etapas">
      <p className={s.compact} aria-hidden="true">
        <span key={`n-${current}`} className={s.compactSwap} data-dir={direction}>
          {prefix}Passo {current + 1} de {n} ·<span className={hasError ? "text-danger" : "text-status-lost"}>{steps[current]?.label}</span>
          {hasError && <span className="font-bold text-danger"> · com erro</span>}
        </span>
      </p>
      <div className={s.steps} style={{ "--n": n } as React.CSSProperties} data-dense={dense || undefined}>
        {variant === "b" && (
          <>
            <span className={s.rail} aria-hidden="true" style={{ "--p": progress } as React.CSSProperties}>
              <span className={s.railFill} />
              <span className={s.bead} data-hidden={current === 0 || undefined} />
            </span>
            <span className={s.spot} aria-hidden="true" style={{ "--i": current } as React.CSSProperties} data-error={hasError || undefined} />
          </>
        )}
        <ol className={s.stepList}>
        {steps.map((step, i) => {
          const state = states[i] ?? "pending";
          const Icon = step.icon;
          const clickable = Boolean(onSelect) && (state === "done" || state === "skipped");
          const content = (
            <>
              <span className={s.circleRow} aria-hidden="true">
                {variant === "a" && (
                  <>
                    <span className={s.seg} data-side="left" data-edge={i === 0 || undefined} data-on={passed(i - 1)} style={{ "--fill-delay": "120ms" } as React.CSSProperties}>
                      <span className={s.segFill} />
                    </span>
                    <span className={s.seg} data-side="right" data-edge={i === n - 1 || undefined} data-on={passed(i)}>
                      <span className={s.segFill} />
                    </span>
                  </>
                )}
                {/* A chave muda quando a etapa vira atual: o "pop" da opção B toca só ao chegar. */}
                <span key={variant === "b" && state === "current" ? `c-${i}` : `s-${i}`} className={`${s.circle} ${variant === "b" && state === "current" ? s.pop : ""}`} data-state={state}>
                  {variant === "a" && <span className={s.halo} />}
                  <span className={s.glyph} data-on={state !== "done" && state !== "error"}>
                    <Icon strokeWidth={2.25} />
                  </span>
                  <span className={s.glyph} data-on={state === "done"}>
                    <CheckDraw />
                  </span>
                  <span className={s.glyph} data-on={state === "error"}>
                    <TriangleAlert strokeWidth={2.25} />
                  </span>
                </span>
              </span>
              <span className={s.label}>
                <span className="hidden text-[11px] font-semibold tracking-wide text-text-secondary uppercase sm:block">Etapa {i + 1}</span>
                <span className={s.name} data-state={state}>
                  {step.label}
                </span>
                <span className={s.status} data-state={state}>
                  {STATE_TEXT[state]}
                </span>
                <span className="sr-only">
                  , etapa {i + 1} de {n}: {STATE_TEXT[state]}
                </span>
              </span>
            </>
          );
          return (
            <li key={step.label} className={s.step} aria-current={i === current ? "step" : undefined} data-state={state} data-testid={`etapa-${i + 1}`}>
              {clickable ? (
                <button type="button" onClick={() => onSelect?.(i)} className={s.stepButton} title={`Voltar para ${step.label}`}>
                  {content}
                </button>
              ) : (
                <div className={s.stepButton}>{content}</div>
              )}
            </li>
          );
        })}
        </ol>
      </div>
    </nav>
  );
}
