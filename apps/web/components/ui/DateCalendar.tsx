"use client";

import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { controlClasses } from "./Field";

const MONTHS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const WEEKDAYS = [
  ["D", "domingo"],
  ["S", "segunda"],
  ["T", "terça"],
  ["Q", "quarta"],
  ["Q", "quinta"],
  ["S", "sexta"],
  ["S", "sábado"],
] as const;

const pad = (n: number) => String(n).padStart(2, "0");
/** Data local no formato do campo (AAAA-MM-DD), sem fuso. */
export const isoDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fromIso = (s: string) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
};
const toBr = (s: string) => {
  const d = fromIso(s);
  return d ? `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}` : "";
};
/** "1011" → "10/11"; "10112026" → "10/11/2026". */
const maskBr = (raw: string) => {
  const d = raw.replace(/\D/g, "").slice(0, 8);
  return [d.slice(0, 2), d.slice(2, 4), d.slice(4, 8)].filter(Boolean).join("/");
};
const monthTitle = (m: Date) => `${MONTHS[m.getMonth()]!.charAt(0).toUpperCase()}${MONTHS[m.getMonth()]!.slice(1)} de ${m.getFullYear()}`;

/**
 * Campo de data com o mesmo visual dos outros campos: digita-se dd/mm/aaaa ou abre-se o
 * calendário pelo botão do próprio campo (o painel aparece logo abaixo e fecha ao escolher, com
 * Esc ou clicando fora). Não aceita datas depois de `max`. No calendário, as setas andam pelos
 * dias e PageUp/PageDown trocam o mês. Valor AAAA-MM-DD ("" = nenhuma data).
 */
export function DateCalendar({
  label,
  value,
  onChange,
  max,
  invalid,
  describedBy,
}: {
  label: string;
  value: string;
  onChange: (iso: string) => void;
  max: string;
  invalid?: boolean;
  describedBy?: string;
}) {
  const id = useId();
  const maxDate = fromIso(max)!;
  const selected = fromIso(value);
  const [text, setText] = useState(toBr(value));
  const [shownValue, setShownValue] = useState(value);
  if (value !== shownValue) {
    // O valor mudou por fora (ex.: clique no calendário): o campo de texto acompanha.
    setShownValue(value);
    setText(toBr(value));
  }
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(() => {
    const d = selected ?? maxDate;
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [focusDay, setFocusDay] = useState<string>(value || max);
  const [typedError, setTypedError] = useState<string | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);
  const grid = useRef<HTMLDivElement>(null);

  // Fecha ao clicar fora ou com Esc (o foco volta ao botão do calendário).
  useEffect(() => {
    if (!open) return;
    const outside = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        toggle.current?.focus();
      }
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  const first = month.getDay();
  const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const canNext = new Date(month.getFullYear(), month.getMonth() + 1, 1) <= maxDate;
  const shift = (n: number) => setMonth((m) => new Date(m.getFullYear(), m.getMonth() + n, 1));

  const openCalendar = () => {
    const d = selected ?? maxDate;
    setMonth(new Date(d.getFullYear(), d.getMonth(), 1));
    setFocusDay(value || max);
    setOpen(true);
    requestAnimationFrame(() => grid.current?.querySelector<HTMLButtonElement>(`[data-day="${value || max}"]`)?.focus());
  };
  const choose = (iso: string) => {
    setTypedError(null);
    setFocusDay(iso);
    onChange(iso);
    setOpen(false);
    toggle.current?.focus();
  };
  const moveFocus = (iso: string) => {
    const d = fromIso(iso)!;
    const bounded = d > maxDate ? maxDate : d;
    const next = isoDate(bounded);
    setFocusDay(next);
    setMonth(new Date(bounded.getFullYear(), bounded.getMonth(), 1));
    requestAnimationFrame(() => grid.current?.querySelector<HTMLButtonElement>(`[data-day="${next}"]`)?.focus());
  };
  const onKeyDown = (e: React.KeyboardEvent, iso: string) => {
    const d = fromIso(iso)!;
    const step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[e.key];
    if (step) moveFocus(isoDate(new Date(d.getFullYear(), d.getMonth(), d.getDate() + step)));
    else if (e.key === "PageUp" || e.key === "PageDown") moveFocus(isoDate(new Date(d.getFullYear(), d.getMonth() + (e.key === "PageUp" ? -1 : 1), d.getDate())));
    else return;
    e.preventDefault();
  };
  const inMonth = (iso: string) => {
    const d = fromIso(iso);
    return d && d.getFullYear() === month.getFullYear() && d.getMonth() === month.getMonth();
  };
  // Dia que recebe o Tab dentro do mês mostrado: o focado, o escolhido, hoje ou o dia 1.
  const tabDay = [focusDay, value, max].find((s) => s && inMonth(s)) ?? isoDate(month);
  const bad = Boolean(invalid || typedError);

  return (
    <div ref={root} className="relative flex flex-col gap-2">
      <label htmlFor={`${id}-data`} className="text-sm font-semibold text-text-primary">
        {label}
      </label>
      <div className="relative">
        <input
          id={`${id}-data`}
          inputMode="numeric"
          autoComplete="off"
          placeholder="dd/mm/aaaa"
          value={text}
          aria-invalid={bad || undefined}
          aria-describedby={[describedBy, typedError ? `${id}-erro` : null].filter(Boolean).join(" ") || undefined}
          onChange={(e) => {
            const t = maskBr(e.target.value);
            setText(t);
            const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(t);
            if (!m) {
              setTypedError(null);
              if (value) {
                // Ainda digitando: a data sai, mas o texto parcial fica.
                setShownValue("");
                onChange("");
              }
              return;
            }
            const d = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
            if (d.getDate() !== Number(m[1]) || d.getMonth() !== Number(m[2]) - 1) return setTypedError("Essa data não existe.");
            if (d > maxDate) return setTypedError("A data não pode estar no futuro.");
            setTypedError(null);
            setMonth(new Date(d.getFullYear(), d.getMonth(), 1));
            setShownValue(isoDate(d));
            onChange(isoDate(d));
          }}
          className={controlClasses(bad, "pr-14 tabular-nums")}
          data-testid="data-digitada"
        />
        <button
          ref={toggle}
          type="button"
          onClick={() => (open ? setOpen(false) : openCalendar())}
          aria-expanded={open}
          aria-controls={`${id}-calendario`}
          aria-label={open ? "Fechar o calendário" : "Abrir o calendário"}
          className="absolute inset-y-0 right-1 my-auto inline-flex size-11 items-center justify-center rounded-md text-text-secondary transition-colors duration-200 ease-mel hover:bg-surface-muted hover:text-text-primary"
        >
          <CalendarDays aria-hidden="true" className="size-5" strokeWidth={1.9} />
        </button>
      </div>
      {typedError && (
        <p id={`${id}-erro`} role="alert" className="text-sm font-semibold text-danger">
          {typedError}
        </p>
      )}
      {open && (
        <div
          id={`${id}-calendario`}
          role="dialog"
          aria-label={`Calendário: ${label}`}
          className="absolute top-full animate-pop left-0 z-30 mt-2 w-full min-w-72 max-w-sm rounded-lg border border-border-strong bg-surface-elevated p-3 shadow-lg"
          data-testid="calendario"
        >
          <div className="mb-2 flex items-center justify-between">
            <button type="button" onClick={() => shift(-1)} className="inline-flex size-11 items-center justify-center rounded-md hover:bg-surface-muted" aria-label="Mês anterior">
              <ChevronLeft aria-hidden="true" className="size-5" />
            </button>
            <p className="font-bold" aria-live="polite">
              {monthTitle(month)}
            </p>
            <button type="button" onClick={() => shift(1)} disabled={!canNext} className="inline-flex size-11 items-center justify-center rounded-md hover:bg-surface-muted disabled:opacity-35" aria-label="Próximo mês">
              <ChevronRight aria-hidden="true" className="size-5" />
            </button>
          </div>
          <div className="grid grid-cols-7 text-center text-xs font-semibold text-text-secondary" aria-hidden="true">
            {WEEKDAYS.map(([s, full]) => (
              <span key={full} className="py-1">
                {s}
              </span>
            ))}
          </div>
          <div ref={grid} className="grid grid-cols-7 gap-1" role="group" aria-label={`Dias de ${monthTitle(month)}`}>
            {Array.from({ length: first }, (_, i) => (
              <span key={`v${i}`} />
            ))}
            {Array.from({ length: days }, (_, i) => {
              const d = new Date(month.getFullYear(), month.getMonth(), i + 1);
              const iso = isoDate(d);
              const future = d > maxDate;
              const isSel = value === iso;
              const isToday = iso === max;
              return (
                <button
                  key={iso}
                  type="button"
                  data-day={iso}
                  disabled={future}
                  tabIndex={iso === tabDay ? 0 : -1}
                  aria-pressed={isSel}
                  aria-label={`${i + 1} de ${MONTHS[d.getMonth()]} de ${d.getFullYear()}, ${WEEKDAYS[d.getDay()]![1]}${isToday ? " (hoje)" : ""}`}
                  onClick={() => choose(iso)}
                  onKeyDown={(e) => onKeyDown(e, iso)}
                  onFocus={() => setFocusDay(iso)}
                  className={`relative flex h-10 items-center justify-center rounded-md text-sm font-semibold tabular-nums transition-colors duration-150 ease-mel disabled:cursor-not-allowed disabled:opacity-30 ${
                    isSel ? "bg-primary text-primary-foreground" : isToday ? "ring-2 ring-primary ring-inset hover:bg-primary-soft" : "hover:bg-surface-muted"
                  }`}
                >
                  {i + 1}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
