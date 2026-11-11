"use client";

import { Popover } from "@ark-ui/react/popover";
import { Portal } from "@ark-ui/react/portal";
import { CircleAlert, Clock3 } from "lucide-react";
import { useId, useState } from "react";
import { controlClasses } from "./Field";

const pad = (n: number) => String(n).padStart(2, "0");
/** "2130" → "21:30". */
const maskTime = (raw: string) => {
  const d = raw.replace(/\D/g, "").slice(0, 4);
  return d.length > 2 ? `${d.slice(0, 2)}:${d.slice(2)}` : d;
};
const parse = (v: string) => {
  const m = /^(\d{2}):(\d{2})$/.exec(v);
  return m ? { h: Number(m[1]), m: Number(m[2]) } : null;
};
const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = Array.from({ length: 12 }, (_, i) => i * 5);

/** Mesmos estilos do calendário: texto clicável no cabeçalho e grades com o atual preenchido. */
const pill = (on: boolean) =>
  `min-h-10 min-w-12 rounded-lg px-2.5 text-xl font-bold tabular-nums transition-colors duration-150 ease-mel hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-primary ${on ? "bg-surface-muted" : ""}`;
const gridBtn = (on: boolean) =>
  `flex h-11 items-center justify-center rounded-xl text-sm tabular-nums transition-colors duration-150 ease-mel focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary disabled:cursor-not-allowed disabled:text-text-muted disabled:opacity-40 disabled:hover:bg-transparent ${
    on ? "bg-primary font-bold text-primary-foreground hover:bg-primary-hover" : "hover:bg-surface-muted"
  }`;

/**
 * Campo de horário no padrão brasileiro (24 horas): digita-se hh:mm (a máscara põe os dois-pontos)
 * ou abre-se o painel pelo botão do relógio. O painel segue o desenho do calendário: cabeçalho
 * "21 : 00" com hora e minuto clicáveis, grade das horas e, depois de escolher a hora, a dos minutos
 * (de 5 em 5); escolher o minuto fecha. Com `max` (ex.: a data escolhida é hoje), os horários depois
 * dele ficam desabilitados. Valor "HH:mm" ("" = nenhum horário).
 */
export function TimeField({
  label,
  value,
  onChange,
  max,
  error,
  invalid,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  /** Último horário aceito ("HH:mm"). */
  max?: string;
  error?: string;
  invalid?: boolean;
}) {
  const id = useId();
  const [text, setText] = useState(value);
  const [shown, setShown] = useState(value);
  if (value !== shown) {
    // Mudou por fora (painel): o texto acompanha.
    setShown(value);
    setText(value);
  }
  const [typedError, setTypedError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"hour" | "minute">("hour");
  const current = parse(value);
  const lim = max ? parse(max) : null;
  const [hour, setHour] = useState<number | null>(current?.h ?? null);
  const message = typedError ?? error ?? null;
  const bad = Boolean(invalid || message);
  const errorId = `${id}-erro`;

  const after = (h: number, m: number) => Boolean(lim && h * 60 + m > lim.h * 60 + lim.m);
  const commit = (v: string) => {
    setTypedError(null);
    setShown(v);
    setText(v);
    onChange(v);
  };

  function onType(raw: string) {
    const t = maskTime(raw);
    setText(t);
    const p = parse(t);
    if (!p) {
      setTypedError(null);
      if (value) {
        // Ainda digitando: o horário sai, mas o texto parcial fica.
        setShown("");
        onChange("");
      }
      return;
    }
    if (p.h > 23 || p.m > 59) return setTypedError("Esse horário não existe.");
    if (after(p.h, p.m)) return setTypedError("Esse horário ainda não chegou.");
    setHour(p.h);
    commit(t);
  }

  const shownHour = hour ?? current?.h ?? null;
  const shownMinute = current && shownHour === current.h ? current.m : null;

  return (
    <Popover.Root
      open={open}
      onOpenChange={(e) => {
        setOpen(e.open);
        if (e.open) {
          setHour(current?.h ?? null);
          setStep("hour");
        }
      }}
      positioning={{ placement: "bottom-start", gutter: 8 }}
      initialFocusEl={() => document.querySelector<HTMLElement>(`[data-hora-painel="${id}"] [aria-pressed="true"]:not(:disabled)`)}
    >
      <div className="flex flex-col gap-2">
        <label htmlFor={`${id}-hora`} className="text-sm font-semibold text-text-primary">
          {label}
        </label>
        <Popover.Anchor className="relative">
          <input
            id={`${id}-hora`}
            inputMode="numeric"
            autoComplete="off"
            placeholder="hh:mm"
            value={text}
            aria-invalid={bad || undefined}
            aria-describedby={message ? errorId : undefined}
            onChange={(e) => onType(e.target.value)}
            className={controlClasses(bad, "pr-14 tabular-nums")}
            data-testid="hora-digitada"
          />
          <Popover.Trigger
            aria-label={open ? "Fechar o seletor de horário" : "Abrir o seletor de horário"}
            className="absolute inset-y-0 right-1 my-auto inline-flex size-11 items-center justify-center rounded-md text-text-secondary transition-colors duration-200 ease-mel hover:bg-surface-muted hover:text-text-primary focus-visible:outline-2 focus-visible:outline-primary"
          >
            <Clock3 aria-hidden="true" className="size-5" strokeWidth={1.9} />
          </Popover.Trigger>
        </Popover.Anchor>
        {message && (
          <p id={errorId} role={typedError ? "alert" : undefined} className="flex items-start gap-1.5 text-sm font-medium text-danger">
            <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" strokeWidth={2} />
            {message}
          </p>
        )}
      </div>

      <Portal>
        <Popover.Positioner className="z-50">
          <Popover.Content
            aria-label={`Horário: ${label}`}
            data-hora-painel={id}
            className="w-[min(calc(100vw-2rem),20rem)] rounded-2xl border border-border-strong bg-surface-elevated p-3 text-text-primary shadow-lg outline-none data-[state=open]:animate-pop"
            data-testid="seletor-hora"
          >
            <div className="mb-2 flex items-center justify-center gap-1">
              <button type="button" onClick={() => setStep("hour")} aria-expanded={step === "hour"} aria-label="Escolher a hora" className={pill(step === "hour")}>
                {shownHour == null ? "--" : pad(shownHour)}
              </button>
              <span aria-hidden="true" className="text-xl font-bold text-text-secondary">
                :
              </span>
              <button
                type="button"
                onClick={() => shownHour != null && setStep("minute")}
                disabled={shownHour == null}
                aria-expanded={step === "minute"}
                aria-label="Escolher os minutos"
                className={`${pill(step === "minute")} disabled:opacity-50`}
              >
                {shownMinute == null ? "--" : pad(shownMinute)}
              </button>
            </div>
            <p className="mb-2 text-center text-xs font-semibold text-text-secondary">{step === "hour" ? "Hora" : "Minutos"}</p>

            {step === "hour" ? (
              <div role="group" aria-label="Horas" className="grid grid-cols-4 gap-1.5" data-testid="grade-horas">
                {HOURS.map((h) => (
                  <button
                    key={h}
                    type="button"
                    disabled={after(h, 0)}
                    aria-pressed={h === shownHour}
                    aria-label={`${pad(h)} horas`}
                    onClick={() => {
                      setHour(h);
                      setStep("minute");
                      // O botão clicado some com a troca de grade: o foco vai para os minutos.
                      requestAnimationFrame(() =>
                        document
                          .querySelector<HTMLElement>(`[data-hora-painel="${id}"] [data-testid="grade-minutos"] button:not(:disabled)`)
                          ?.focus(),
                      );
                      // Mantém os minutos que já havia, se ainda couberem; senão, zero.
                      const m = current && !after(h, current.m) ? current.m : 0;
                      commit(`${pad(h)}:${pad(m)}`);
                    }}
                    className={gridBtn(h === shownHour)}
                  >
                    {pad(h)}
                  </button>
                ))}
              </div>
            ) : (
              <div role="group" aria-label="Minutos" className="grid grid-cols-4 gap-1.5" data-testid="grade-minutos">
                {MINUTES.map((m) => (
                  <button
                    key={m}
                    type="button"
                    disabled={shownHour == null || after(shownHour, m)}
                    aria-pressed={m === shownMinute}
                    aria-label={`${pad(shownHour ?? 0)}:${pad(m)}`}
                    onClick={() => {
                      commit(`${pad(shownHour!)}:${pad(m)}`);
                      setOpen(false);
                    }}
                    className={gridBtn(m === shownMinute)}
                  >
                    :{pad(m)}
                  </button>
                ))}
              </div>
            )}
          </Popover.Content>
        </Popover.Positioner>
      </Portal>
    </Popover.Root>
  );
}
