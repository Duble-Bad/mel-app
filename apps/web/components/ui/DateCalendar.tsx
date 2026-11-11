"use client";

import { DatePicker, parseDate, type DateValue } from "@ark-ui/react/date-picker";
import { Portal } from "@ark-ui/react/portal";
import { CalendarDays, ChevronLeft, ChevronRight, CircleAlert, X } from "lucide-react";
import { useId, useState, type ReactNode } from "react";
import { controlClasses } from "./Field";

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
const toValue = (iso: string): DateValue[] => (fromIso(iso) ? [parseDate(iso)] : []);

/** Textos do calendário em português (o padrão da biblioteca é inglês). */
const TRANSLATIONS = {
  dayCell: (s: { selected: boolean; unavailable: boolean; today: boolean; valueText: string }) =>
    `${s.unavailable ? "Indisponível: " : s.selected ? "Data escolhida: " : "Escolher "}${s.valueText}${s.today ? " (hoje)" : ""}`,
  trigger: (open: boolean) => (open ? "Fechar o calendário" : "Abrir o calendário"),
  viewTrigger: (_view: string, next?: string) => (next === "month" ? "Escolher o mês" : next === "year" ? "Escolher o ano" : "Voltar aos dias"),
  prevTrigger: (view: string) => (view === "year" ? "Década anterior" : view === "month" ? "Ano anterior" : "Mês anterior"),
  nextTrigger: (view: string) => (view === "year" ? "Próxima década" : view === "month" ? "Próximo ano" : "Próximo mês"),
  presetTrigger: () => "",
  placeholder: () => ({ day: "dd", month: "mm", year: "aaaa" }),
  content: "calendário",
  monthSelect: "Mês",
  yearSelect: "Ano",
  clearTrigger: "Limpar a data",
};

const iconBtn =
  "inline-flex size-10 shrink-0 items-center justify-center rounded-md text-text-secondary transition-colors duration-200 ease-mel hover:bg-surface-muted hover:text-text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:pointer-events-none disabled:opacity-35";
const selectCls =
  "min-h-10 min-w-0 flex-1 rounded-md border border-border-input bg-input px-2 text-sm font-semibold text-text-primary hover:border-border-strong focus:border-focus focus:outline-none focus:ring-4 focus:ring-primary-soft";
const cellBase =
  "flex items-center justify-center rounded-md font-semibold tabular-nums transition-colors duration-150 ease-mel cursor-pointer select-none hover:bg-surface-muted " +
  "data-[focus]:outline-2 data-[focus]:-outline-offset-2 data-[focus]:outline-primary " +
  "data-[today]:ring-2 data-[today]:ring-inset data-[today]:ring-primary " +
  "data-[selected]:bg-primary data-[selected]:text-primary-foreground data-[selected]:hover:bg-primary-hover " +
  "data-[disabled]:cursor-not-allowed data-[disabled]:opacity-30 data-[disabled]:hover:bg-transparent " +
  "data-[outside-range]:text-text-muted data-[outside-range]:opacity-50";

/**
 * Campo de data no padrão brasileiro: digita-se dd/mm/aaaa (a máscara põe as barras) ou abre-se o
 * calendário pelo botão do campo. O calendário (Ark UI, em pt-BR, semana começando no domingo) tem
 * setas nas laterais das listas de mês e de ano (sem título repetido) e respeita `min`/`max`:
 * datas fora ficam desabilitadas. A data digitada é conferida aqui ("não existe", "no futuro"),
 * nunca trocada em silêncio. Valor AAAA-MM-DD ("" = nenhuma data).
 */
export function DateCalendar({
  label,
  value,
  onChange,
  max,
  min,
  invalid,
  describedBy,
  optional,
  error,
  hint,
  name,
}: {
  label: string;
  value: string;
  onChange: (iso: string) => void;
  /** Última data aceita (AAAA-MM-DD), em geral hoje. */
  max: string;
  /** Primeira data aceita; padrão: 40 anos antes de `max`. */
  min?: string;
  invalid?: boolean;
  describedBy?: string;
  optional?: boolean;
  /** Mensagem de erro de quem usa o campo (aparece abaixo, como nos outros campos). */
  error?: string;
  hint?: ReactNode;
  /** Nome para o envio de formulário (campo escondido com AAAA-MM-DD). */
  name?: string;
}) {
  const id = useId();
  const maxDate = fromIso(max)!;
  const minIso = min ?? `${maxDate.getFullYear() - 40}-01-01`;
  const minDate = fromIso(minIso)!;
  const [text, setText] = useState(toBr(value));
  const [shownValue, setShownValue] = useState(value);
  if (value !== shownValue) {
    // O valor mudou por fora (calendário, limpar): o campo de texto acompanha.
    setShownValue(value);
    setText(toBr(value));
  }
  const [typedError, setTypedError] = useState<string | null>(null);
  const message = typedError ?? error ?? null;
  const bad = Boolean(invalid || message);
  const errorId = `${id}-erro`;
  const hintId = hint && !message ? `${id}-dica` : undefined;

  function onType(raw: string) {
    const t = maskBr(raw);
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
    if (d < minDate) return setTypedError(`A data não pode ser antes de ${toBr(minIso)}.`);
    setTypedError(null);
    setShownValue(isoDate(d));
    onChange(isoDate(d));
  }

  return (
    <DatePicker.Root
      locale="pt-BR"
      startOfWeek={0}
      value={toValue(value)}
      max={parseDate(max)}
      min={parseDate(minIso)}
      onValueChange={(e) => {
        const iso = e.value[0]?.toString() ?? "";
        setTypedError(null);
        setShownValue(iso);
        setText(toBr(iso));
        onChange(iso);
      }}
      translations={TRANSLATIONS}
      positioning={{ placement: "bottom-start", gutter: 8 }}
      className="flex flex-col gap-2"
    >
      <label htmlFor={`${id}-data`} className="text-sm font-semibold text-text-primary">
        {label}
        {optional && <span className="ml-1 font-medium text-text-secondary">(opcional)</span>}
      </label>
      <DatePicker.Control className="relative">
        <input
          id={`${id}-data`}
          inputMode="numeric"
          autoComplete="off"
          placeholder="dd/mm/aaaa"
          value={text}
          aria-invalid={bad || undefined}
          aria-describedby={[describedBy, message ? errorId : null, hintId].filter(Boolean).join(" ") || undefined}
          onChange={(e) => onType(e.target.value)}
          className={controlClasses(bad, `${value ? "pr-24" : "pr-14"} tabular-nums`)}
          data-testid="data-digitada"
        />
        {name && <input type="hidden" name={name} value={value} />}
        <div className="absolute inset-y-0 right-1 my-auto flex h-11 items-center">
          {value && (
            <DatePicker.ClearTrigger className={iconBtn}>
              <X aria-hidden="true" className="size-4" strokeWidth={2.25} />
            </DatePicker.ClearTrigger>
          )}
          <DatePicker.Trigger className={`${iconBtn} size-11`}>
            <CalendarDays aria-hidden="true" className="size-5" strokeWidth={1.9} />
          </DatePicker.Trigger>
        </div>
      </DatePicker.Control>
      {message ? (
        <p id={errorId} role={typedError ? "alert" : undefined} className="flex items-start gap-1.5 text-sm font-medium text-danger">
          <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" strokeWidth={2} />
          {message}
        </p>
      ) : (
        hint && (
          <p id={hintId} className="text-sm text-text-secondary">
            {hint}
          </p>
        )
      )}

      <Portal>
        <DatePicker.Positioner className="z-50">
          <DatePicker.Content
            aria-label={`Calendário: ${label}`}
            className="w-[min(calc(100vw-2rem),22rem)] rounded-lg border border-border-strong bg-surface-elevated p-3 text-text-primary shadow-lg outline-none data-[state=open]:animate-pop"
            data-testid="calendario"
          >
            <DatePicker.View view="day">
              <DatePicker.Context>
                {(api) => (
                  <>
                    {/* Uma linha só: ‹ [Mês] [Ano] ›. O mês e o ano aparecem só nas listas, sem título repetido. */}
                    <DatePicker.ViewControl className="mb-2 flex items-center gap-1.5">
                      <DatePicker.PrevTrigger className={iconBtn}>
                        <ChevronLeft aria-hidden="true" className="size-5" />
                      </DatePicker.PrevTrigger>
                      <select
                        aria-label="Mês"
                        value={api.focusedValue.month}
                        onChange={(e) => api.focusMonth(Number(e.target.value))}
                        className={selectCls}
                        data-testid="calendario-mes"
                      >
                        {api.getMonths().map((m) => (
                          <option key={m.value} value={m.value} disabled={m.disabled}>
                            {m.label.charAt(0).toUpperCase() + m.label.slice(1)}
                          </option>
                        ))}
                      </select>
                      <select
                        aria-label="Ano"
                        value={api.focusedValue.year}
                        onChange={(e) => api.focusYear(Number(e.target.value))}
                        className={`${selectCls} max-w-24 flex-none`}
                        data-testid="calendario-ano"
                      >
                        {/* Mais recente primeiro: as datas do app são de agora para trás. */}
                        {api
                          .getYears()
                          .filter((y) => !y.disabled)
                          .reverse()
                          .map((y) => (
                            <option key={y.value} value={y.value}>
                              {y.label}
                            </option>
                          ))}
                      </select>
                      <DatePicker.NextTrigger className={iconBtn}>
                        <ChevronRight aria-hidden="true" className="size-5" />
                      </DatePicker.NextTrigger>
                    </DatePicker.ViewControl>
                    <DatePicker.Table className="w-full border-separate border-spacing-1">
                      <DatePicker.TableHead>
                        <DatePicker.TableRow>
                          {api.weekDays.map((w, i) => (
                            <DatePicker.TableHeader key={i} abbr={w.long} className="py-1 text-xs font-semibold text-text-secondary uppercase">
                              {w.narrow}
                            </DatePicker.TableHeader>
                          ))}
                        </DatePicker.TableRow>
                      </DatePicker.TableHead>
                      <DatePicker.TableBody>
                        {api.weeks.map((week, i) => (
                          <DatePicker.TableRow key={i}>
                            {week.map((day, j) => (
                              <DatePicker.TableCell key={j} value={day} className="p-0">
                                <DatePicker.TableCellTrigger className={`${cellBase} h-10 w-full text-sm`}>{day.day}</DatePicker.TableCellTrigger>
                              </DatePicker.TableCell>
                            ))}
                          </DatePicker.TableRow>
                        ))}
                      </DatePicker.TableBody>
                    </DatePicker.Table>
                  </>
                )}
              </DatePicker.Context>
            </DatePicker.View>
          </DatePicker.Content>
        </DatePicker.Positioner>
      </Portal>
    </DatePicker.Root>
  );
}

/**
 * Data e hora lado a lado (substitui o `datetime-local` do navegador, que segue o idioma do
 * aparelho). Valor "AAAA-MM-DDTHH:mm" só quando os dois estão preenchidos; senão "".
 */
export function DateTimeFields({
  dateLabel,
  timeLabel = "Que horas?",
  value,
  onChange,
  max,
  error,
}: {
  dateLabel: string;
  timeLabel?: string;
  value: string;
  onChange: (v: string) => void;
  max: string;
  error?: string;
}) {
  const timeId = useId();
  const [date, setDate] = useState(value.slice(0, 10));
  const [time, setTime] = useState(value.slice(11, 16));
  const emit = (d: string, t: string) => onChange(d && t ? `${d}T${t}` : "");
  return (
    // A data leva mais espaço que a hora: tem os botões de limpar e de calendário dentro do campo.
    <div className="grid items-start gap-5 sm:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <DateCalendar
        label={dateLabel}
        value={date}
        max={max}
        error={error}
        onChange={(d) => {
          setDate(d);
          emit(d, time);
        }}
      />
      <div className="flex flex-col gap-2">
        <label htmlFor={timeId} className="text-sm font-semibold text-text-primary">
          {timeLabel}
        </label>
        <input
          id={timeId}
          type="time"
          value={time}
          onChange={(e) => {
            setTime(e.target.value);
            emit(date, e.target.value);
          }}
          className={controlClasses(false, "tabular-nums")}
        />
      </div>
    </div>
  );
}
