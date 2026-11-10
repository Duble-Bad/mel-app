"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useId, useRef, useState } from "react";

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

/**
 * Calendário visual com a data também digitável (dd/mm/aaaa). Não aceita datas depois de
 * `max` (ex.: hoje). Teclado: setas andam pelos dias, PageUp/PageDown trocam o mês, Enter
 * escolhe. Valor no formato AAAA-MM-DD ("" = nenhuma data).
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
  const [month, setMonth] = useState(() => {
    const d = selected ?? maxDate;
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [focusDay, setFocusDay] = useState<string>(value || max);
  const grid = useRef<HTMLDivElement>(null);
  const [typedError, setTypedError] = useState<string | null>(null);

  const first = month.getDay();
  const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const canNext = new Date(month.getFullYear(), month.getMonth() + 1, 1) <= maxDate;
  const shift = (n: number) => setMonth((m) => new Date(m.getFullYear(), m.getMonth() + n, 1));

  const choose = (iso: string) => {
    setTypedError(null);
    setFocusDay(iso);
    onChange(iso);
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
  // Dia que recebe o Tab dentro do mês mostrado: o focado, o escolhido, hoje ou o dia 1.
  const inMonth = (iso: string) => {
    const d = fromIso(iso);
    return d && d.getFullYear() === month.getFullYear() && d.getMonth() === month.getMonth();
  };
  const tabDay = [focusDay, value, max].find((s) => s && inMonth(s)) ?? isoDate(month);

  return (
    <fieldset className="flex flex-col gap-2" aria-describedby={describedBy}>
      <legend className="mb-1.5 font-semibold">{label}</legend>
      <div className="flex flex-col gap-1.5">
        <label htmlFor={`${id}-texto`} className="text-sm text-text-secondary">
          Digite a data ou escolha no calendário
        </label>
        <input
          id={`${id}-texto`}
          inputMode="numeric"
          autoComplete="off"
          placeholder="dd/mm/aaaa"
          value={text}
          aria-invalid={invalid || typedError ? true : undefined}
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
            setMonth(new Date(d.getFullYear(), d.getMonth(), 1));
            choose(isoDate(d));
          }}
          className={`block min-h-12 w-full max-w-60 rounded-md border-2 bg-surface px-4 text-base tabular-nums focus:border-focus focus:outline-none ${invalid || typedError ? "border-danger-solid" : "border-border-strong"}`}
          data-testid="data-digitada"
        />
        {typedError && (
          <p role="alert" className="text-sm font-semibold text-danger">
            {typedError}
          </p>
        )}
      </div>
      <div className={`w-full max-w-sm rounded-lg border-2 bg-surface p-3 ${invalid ? "border-danger-solid" : "border-border"}`} data-testid="calendario">
        <div className="mb-2 flex items-center justify-between">
          <button type="button" onClick={() => shift(-1)} className="inline-flex size-11 items-center justify-center rounded-md hover:bg-surface-muted" aria-label="Mês anterior">
            <ChevronLeft aria-hidden="true" className="size-5" />
          </button>
          <p className="font-bold" aria-live="polite">
            {MONTHS[month.getMonth()]!.charAt(0).toUpperCase() + MONTHS[month.getMonth()]!.slice(1)} de {month.getFullYear()}
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
        <div ref={grid} className="grid grid-cols-7 gap-1" role="group" aria-label={`Dias de ${MONTHS[month.getMonth()]} de ${month.getFullYear()}`}>
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
                className={`relative flex aspect-square min-h-10 items-center justify-center rounded-md text-sm font-semibold tabular-nums transition-colors duration-150 ease-mel disabled:cursor-not-allowed disabled:opacity-30 ${
                  isSel ? "bg-primary text-primary-foreground" : isToday ? "ring-2 ring-primary ring-inset hover:bg-primary-soft" : "hover:bg-surface-muted"
                }`}
              >
                {i + 1}
                {isToday && !isSel && <span className="absolute bottom-0.5 text-[9px] leading-none font-bold text-primary">hoje</span>}
              </button>
            );
          })}
        </div>
      </div>
    </fieldset>
  );
}
