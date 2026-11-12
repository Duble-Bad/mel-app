"use client";

import { createContext, useContext, type ReactNode } from "react";
import { Check, ChevronLeft, ChevronRight, type LucideIcon } from "lucide-react";
import { Button } from "./Button";

export interface Step<T extends string = string> {
  id: T;
  title: string;
  Icon: LucideIcon;
  /** Texto curto abaixo do título no menu ("Obrigatório", "2 de 4"…). */
  status?: string;
  done?: boolean;
  error?: boolean;
}

const ActiveStep = createContext<string | null>(null);

/**
 * Formulário longo em etapas. Celular: tudo em uma coluna, cada etapa num cartão, botão no fim.
 * Desktop (lg): menu de etapas fixo à esquerda (com o botão principal sempre à mão) e só a etapa
 * ativa à direita, com "Voltar / Próximo". Todas as etapas ficam no DOM (só escondidas no desktop):
 * o envio, a validação e os testes no celular continuam iguais.
 */
export function SteppedForm<T extends string>({
  steps,
  active,
  onActiveChange,
  submit,
  asideFooter,
  before,
  children,
}: {
  steps: Step<T>[];
  active: T;
  onActiveChange: (id: T) => void;
  /** Botão principal (o mesmo aparece no menu, no fim da última etapa e no celular). */
  submit: (where: "aside" | "last" | "mobile") => ReactNode;
  asideFooter?: ReactNode;
  /** Antes das etapas (ex.: alerta de erro geral). */
  before?: ReactNode;
  children: ReactNode;
}) {
  const index = steps.findIndex((s) => s.id === active);

  function goTo(id: T) {
    onActiveChange(id);
    const top = document.getElementById("stepped-form")?.getBoundingClientRect().top ?? 0;
    if (top < 0) document.getElementById("stepped-form")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div id="stepped-form" className="scroll-mt-24 lg:grid lg:grid-cols-[260px_minmax(0,1fr)] lg:items-start lg:gap-8">
      <aside className="hidden lg:sticky lg:top-24 lg:flex lg:flex-col lg:gap-4">
        <nav aria-label="Etapas" className="rounded-2xl border border-border bg-surface p-2">
          <ol className="flex flex-col gap-1">
            {steps.map((s, i) => {
              const on = s.id === active;
              return (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => goTo(s.id)}
                    aria-current={on ? "step" : undefined}
                    className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors duration-200 ease-mel ${
                      on ? "bg-primary-soft text-primary-soft-foreground" : "hover:bg-surface-muted"
                    }`}
                  >
                    <span
                      aria-hidden="true"
                      className={`flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                        s.error
                          ? "bg-danger text-white"
                          : s.done
                            ? "bg-primary text-primary-foreground"
                            : on
                              ? "border-2 border-primary text-primary"
                              : "border-2 border-border-strong text-text-secondary"
                      }`}
                    >
                      {s.error ? "!" : s.done ? <Check className="size-4" strokeWidth={3} /> : i + 1}
                    </span>
                    <span className="flex min-w-0 flex-col leading-tight">
                      <span className="font-semibold">{s.title}</span>
                      {(s.error || s.status) && <span className="text-xs text-text-secondary">{s.error ? "Confira os campos" : s.status}</span>}
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        </nav>
        {submit("aside")}
        {asideFooter}
      </aside>

      {/* Abaixo de lg: um único cartão centralizado (como "Cadastrar minha organização"), seções separadas
          por linha e o botão dentro dele. No desktop: cada etapa é um cartão e só a ativa aparece. */}
      <div className="mx-auto flex w-full max-w-[880px] min-w-0 flex-col gap-6 rounded-2xl border border-border bg-surface p-5 sm:p-8 lg:max-w-none lg:gap-5 lg:border-0 lg:bg-transparent lg:p-0">
        {before}
        <ActiveStep.Provider value={active}>{children}</ActiveStep.Provider>

        <div className="hidden items-center justify-between gap-3 lg:flex">
          {index > 0 ? (
            <Button type="button" variant="ghost" size="md" className="w-auto" onClick={() => goTo(steps[index - 1].id)}>
              <ChevronLeft aria-hidden="true" className="size-4" strokeWidth={2.5} />
              {steps[index - 1].title}
            </Button>
          ) : (
            <span />
          )}
          {index < steps.length - 1 ? (
            <Button type="button" variant="secondary" size="md" className="w-auto" onClick={() => goTo(steps[index + 1].id)}>
              Próximo: {steps[index + 1].title}
              <ChevronRight aria-hidden="true" className="size-4" strokeWidth={2.5} />
            </Button>
          ) : (
            submit("last")
          )}
        </div>

        <div className="border-t border-border pt-6 lg:hidden">{submit("mobile")}</div>
        {asideFooter && <div className="lg:hidden">{asideFooter}</div>}
      </div>
    </div>
  );
}

/** Cartão de uma etapa: sempre visível no celular; no desktop só quando é a etapa ativa. */
export function StepCard({ id, title, Icon, aside, children }: { id: string; title: string; Icon: LucideIcon; aside?: ReactNode; children: ReactNode }) {
  const active = useContext(ActiveStep);
  return (
    <section
      aria-labelledby={`etapa-${id}`}
      className={`scroll-mt-24 border-border [&+&]:border-t [&+&]:pt-6 lg:rounded-2xl lg:border lg:bg-surface lg:p-7 lg:[&+&]:pt-7 ${active === id ? "" : "lg:hidden"}`}
    >
      <div className="mb-5 flex items-center gap-2.5">
        <span aria-hidden="true" className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/12 text-primary">
          <Icon className="size-5" strokeWidth={2} />
        </span>
        <h2 id={`etapa-${id}`} className="text-lg font-bold">
          {title}
        </h2>
        {aside}
      </div>
      {children}
    </section>
  );
}
