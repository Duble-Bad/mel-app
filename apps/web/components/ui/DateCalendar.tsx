"use client";

import { DatePicker, parseDate, useDatePickerContext, type DateValue } from "@ark-ui/react/date-picker";
import { Portal } from "@ark-ui/react/portal";
import { CalendarDays, ChevronLeft, ChevronRight, CircleAlert, X } from "lucide-react";
import { MotionConfig, motion } from "motion/react";
import { useEffect, useId, useState, type ReactNode } from "react";
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
const MONTHS_SHORT = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const MONTHS_LONG = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const WEEK = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
/** Dia: círculo; escolhido preenchido com a cor da marca, hoje com contorno, fora do mês apagado. */
const dayCls =
  "mx-auto flex size-10 items-center justify-center rounded-full text-sm tabular-nums transition-colors duration-150 ease-mel cursor-pointer select-none hover:bg-surface-muted " +
  "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary " +
  "data-[today]:ring-2 data-[today]:ring-inset data-[today]:ring-primary " +
  "data-[outside-range]:text-text-muted data-[outside-range]:opacity-60 " +
  "data-[disabled]:cursor-not-allowed data-[disabled]:text-text-muted data-[disabled]:opacity-40 data-[disabled]:hover:bg-transparent " +
  "data-[selected]:bg-primary data-[selected]:font-bold data-[selected]:text-primary-foreground data-[selected]:opacity-100 data-[selected]:ring-0 data-[selected]:hover:bg-primary-hover";
/** Mês ou ano nas grades: retângulo arredondado; o atual preenchido. */
const gridBtn = (on: boolean) =>
  `flex h-12 items-center justify-center rounded-xl text-sm transition-colors duration-150 ease-mel focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary disabled:cursor-not-allowed disabled:text-text-muted disabled:opacity-40 disabled:hover:bg-transparent ${
    on ? "bg-primary font-bold text-primary-foreground hover:bg-primary-hover" : "hover:bg-surface-muted"
  }`;
/** Mês e ano no cabeçalho: texto clicável; o da grade aberta ganha fundo. */
const pill = (on: boolean) =>
  `min-h-9 rounded-lg px-2.5 text-base font-bold transition-colors duration-150 ease-mel hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-primary ${on ? "bg-surface-muted" : ""}`;

/**
 * Campo de data no padrão brasileiro: digita-se dd/mm/aaaa (a máscara põe as barras) ou abre-se o
 * calendário pelo botão do campo. O calendário segue o desenho da referência "calendar" do 21st.dev
 * (cabeçalho "‹ Novembro | 2026 ›"; clicar no mês ou no ano abre a grade de meses ou de anos), em
 * pt-BR e com o Ark UI por trás para teclado e acessibilidade. Respeita `min`/`max`:
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
      fixedWeeks
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
            className="w-[min(calc(100vw-2rem),22rem)] rounded-2xl border border-border-strong bg-surface-elevated p-3 text-text-primary shadow-lg outline-none data-[state=open]:animate-pop"
            data-testid="calendario"
          >
            <CalendarPanel minIso={minIso} max={max} />
          </DatePicker.Content>
        </DatePicker.Positioner>
      </Portal>
    </DatePicker.Root>
  );
}

type View = "day" | "month" | "year";

/**
 * O painel do calendário. Dias pela tabela do Ark (setas do teclado, PageUp/PageDown, leitor de
 * tela); meses e anos em grades próprias de 3 colunas, como na referência. A troca de mês desliza
 * de leve (motion; com "reduzir movimento", sem deslizar).
 */
function CalendarPanel({ minIso, max }: { minIso: string; max: string }) {
  const api = useDatePickerContext();
  const { month, year } = api.focusedValue;
  const view = api.view as View;
  const [minY, minM] = minIso.split("-").map(Number) as [number, number];
  const [maxY, maxM] = max.split("-").map(Number) as [number, number];
  const ym = (y: number, m: number) => y * 12 + m;
  const [pageStart, setPageStart] = useState(year - 5);
  const [dir, setDir] = useState(0);

  // Ao fechar, a próxima abertura começa pelos dias.
  useEffect(() => {
    if (!api.open && api.view !== "day") api.setView("day");
  }, [api, api.open]);

  const monthOut = (y: number, m: number) => ym(y, m) < ym(minY, minM) || ym(y, m) > ym(maxY, maxM);
  const step = (delta: number) => {
    setDir(delta);
    if (view === "day") return delta < 0 ? api.goToPrev() : api.goToNext();
    api.focusYear(Math.min(maxY, Math.max(minY, year + delta)));
  };
  const canPrev = view === "day" ? ym(year, month) > ym(minY, minM) : year > minY;
  const canNext = view === "day" ? ym(year, month) < ym(maxY, maxM) : year < maxY;
  const byMonth = view === "day";

  return (
    <MotionConfig reducedMotion="user">
      <div className="mb-2 flex items-center justify-between">
        <button type="button" onClick={() => step(-1)} disabled={!canPrev} aria-label={byMonth ? "Mês anterior" : "Ano anterior"} className={iconBtn}>
          <ChevronLeft aria-hidden="true" className="size-5" />
        </button>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => api.setView(view === "month" ? "day" : "month")}
            aria-expanded={view === "month"}
            aria-label={`${MONTHS_LONG[month - 1]}: escolher o mês`}
            className={pill(view === "month")}
            data-testid="calendario-botao-mes"
          >
            {MONTHS_LONG[month - 1]}
          </button>
          <span aria-hidden="true" className="h-5 w-px bg-border-strong" />
          <button
            type="button"
            onClick={() => {
              if (view !== "year") setPageStart(Math.min(year - 5, maxY - 11));
              api.setView(view === "year" ? "day" : "year");
            }}
            aria-expanded={view === "year"}
            aria-label={`${year}: escolher o ano`}
            className={`${pill(view === "year")} tabular-nums`}
            data-testid="calendario-botao-ano"
          >
            {year}
          </button>
        </div>
        <button type="button" onClick={() => step(1)} disabled={!canNext} aria-label={byMonth ? "Próximo mês" : "Próximo ano"} className={iconBtn}>
          <ChevronRight aria-hidden="true" className="size-5" />
        </button>
      </div>

      <DatePicker.View view="day">
        <motion.div key={`${year}-${month}`} initial={{ opacity: 0, x: dir * 18 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.22, ease: [0.2, 0.8, 0.2, 1] }}>
          <DatePicker.Table className="w-full border-separate border-spacing-y-1">
            <DatePicker.TableHead>
              <DatePicker.TableRow>
                {api.weekDays.map((w, i) => (
                  <DatePicker.TableHeader key={i} abbr={w.long} className="pb-1 text-xs font-semibold text-text-secondary">
                    {WEEK[i]}
                  </DatePicker.TableHeader>
                ))}
              </DatePicker.TableRow>
            </DatePicker.TableHead>
            <DatePicker.TableBody>
              {api.weeks.map((week, i) => (
                <DatePicker.TableRow key={i}>
                  {week.map((day, j) => (
                    <DatePicker.TableCell key={j} value={day} className="p-0">
                      <DatePicker.TableCellTrigger className={dayCls}>{day.day}</DatePicker.TableCellTrigger>
                    </DatePicker.TableCell>
                  ))}
                </DatePicker.TableRow>
              ))}
            </DatePicker.TableBody>
          </DatePicker.Table>
        </motion.div>
      </DatePicker.View>

      {view === "month" && (
        <div role="group" aria-label={`Meses de ${year}`} className="grid grid-cols-3 gap-2 pt-1" data-testid="calendario-meses">
          {MONTHS_SHORT.map((label, i) => (
            <button
              key={label}
              type="button"
              disabled={monthOut(year, i + 1)}
              aria-pressed={i + 1 === month}
              aria-label={`${MONTHS_LONG[i]} de ${year}`}
              onClick={() => {
                api.focusMonth(i + 1);
                api.setView("day");
              }}
              className={gridBtn(i + 1 === month)}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {view === "year" && (
        <div data-testid="calendario-anos">
          <div className="mb-1 flex items-center justify-between">
            <button type="button" onClick={() => setPageStart((p) => p - 12)} disabled={pageStart <= minY} aria-label="Anos anteriores" className={iconBtn}>
              <ChevronLeft aria-hidden="true" className="size-4" />
            </button>
            <span className="text-sm font-semibold text-text-secondary tabular-nums">
              {pageStart}–{pageStart + 11}
            </span>
            <button type="button" onClick={() => setPageStart((p) => p + 12)} disabled={pageStart + 11 >= maxY} aria-label="Próximos anos" className={iconBtn}>
              <ChevronRight aria-hidden="true" className="size-4" />
            </button>
          </div>
          <div role="group" aria-label={`Anos de ${pageStart} a ${pageStart + 11}`} className="grid grid-cols-3 gap-2">
            {Array.from({ length: 12 }, (_, i) => pageStart + i).map((y) => (
              <button
                key={y}
                type="button"
                disabled={y < minY || y > maxY}
                aria-pressed={y === year}
                onClick={() => {
                  api.focusYear(y);
                  api.setView("day");
                }}
                className={`${gridBtn(y === year)} tabular-nums`}
              >
                {y}
              </button>
            ))}
          </div>
        </div>
      )}
    </MotionConfig>
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
