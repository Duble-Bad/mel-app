"use client";

import { Check, ChevronDown, type LucideIcon } from "lucide-react";
import { type KeyboardEvent, useEffect, useId, useRef, useState } from "react";

export interface SelectMenuOption {
  value: string;
  label: string;
}

/** Caixa da lista suspensa (busca de lugar e seleções): cantos redondos que a barra de rolagem não corta. */
export const popoverBox = "absolute top-full z-40 mt-1.5 origin-top animate-pop overflow-hidden rounded-2xl border border-border-strong bg-surface-elevated shadow-lg";
/** Parte que rola, dentro da caixa (a barra fica por dentro da borda arredondada). */
export const popoverScroll = "mel-scroll-thin max-h-72 overflow-y-auto overscroll-contain p-1.5";

/**
 * Seleção em pílula com lista própria (a nativa do navegador destoava do app: cantos retos, azul do
 * sistema). Teclado como no padrão de listbox: ↑/↓/Home/End movem, Enter/Espaço escolhem, Esc fecha,
 * Tab sai. Letras pulam para a opção que começa com elas.
 */
export function SelectMenu({
  id,
  label,
  Icon,
  value,
  options,
  active,
  onChange,
  align = "left",
}: {
  id: string;
  /** Nome acessível ("Distância"); o texto visível é a opção escolhida. */
  label: string;
  Icon: LucideIcon;
  value: string;
  options: SelectMenuOption[];
  /** Diferente do padrão: borda dourada, como uma pílula marcada. */
  active: boolean;
  onChange: (v: string) => void;
  align?: "left" | "right";
}) {
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState(0);
  const box = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const listId = useId();
  const selected = Math.max(0, options.findIndex((o) => o.value === value));
  const current = options[selected];

  useEffect(() => {
    if (!open) return;
    list.current?.focus({ preventScroll: true });
    const onDown = (e: PointerEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  // Mantém a opção do cursor visível quando a lista rola.
  useEffect(() => {
    if (open) document.getElementById(`${listId}-${cursor}`)?.scrollIntoView({ block: "nearest" });
  }, [open, cursor, listId]);

  const show = (at = selected) => {
    setCursor(at);
    setOpen(true);
  };
  const close = (refocus = true) => {
    setOpen(false);
    if (refocus) button.current?.focus();
  };
  const pick = (i: number) => {
    const o = options[i];
    close();
    if (o && o.value !== value) onChange(o.value);
  };

  const onListKey = (e: KeyboardEvent) => {
    const last = options.length - 1;
    if (e.key === "ArrowDown") setCursor((c) => Math.min(last, c + 1));
    else if (e.key === "ArrowUp") setCursor((c) => Math.max(0, c - 1));
    else if (e.key === "Home") setCursor(0);
    else if (e.key === "End") setCursor(last);
    else if (e.key === "Enter" || e.key === " ") pick(cursor);
    else if (e.key === "Escape") close();
    else if (e.key === "Tab") return close(false);
    else if (e.key.length === 1 && /\S/.test(e.key)) {
      const k = e.key.toLocaleLowerCase("pt-BR");
      const n = options.length;
      for (let s = 1; s <= n; s++) {
        const i = (cursor + s) % n;
        if (options[i]!.label.toLocaleLowerCase("pt-BR").startsWith(k)) {
          setCursor(i);
          break;
        }
      }
    } else return;
    e.preventDefault();
  };

  return (
    <div ref={box} className="relative flex">
      <button
        ref={button}
        id={id}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-label={`${label}: ${current?.label ?? ""}`}
        onClick={() => (open ? close() : show())}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault();
            show();
          }
        }}
        className={`flex h-10 w-full items-center gap-1.5 rounded-full border pr-2.5 pl-3 text-left sm:gap-2 text-[13px] font-semibold whitespace-nowrap text-text-primary shadow-xs transition-colors hover:bg-surface-muted focus-visible:border-primary focus-visible:outline-none sm:pr-3.5 sm:pl-3.5 sm:text-sm ${active || open ? "border-primary" : "border-border-strong"} ${active ? "bg-primary/12" : "bg-surface-elevated"}`}
      >
        <Icon aria-hidden="true" className={`size-4 shrink-0 ${active ? "text-primary" : "text-text-secondary"}`} strokeWidth={2.25} />
        <span className="min-w-0 flex-1 truncate">{current?.label}</span>
        <ChevronDown
          aria-hidden="true"
          // Em telas bem estreitas (< 380 px) a seta sai para o texto caber inteiro.
          className={`size-4 shrink-0 text-text-secondary transition-transform duration-200 max-[379px]:hidden ${open ? "rotate-180" : ""}`}
          strokeWidth={2.25}
        />
      </button>
      {open && (
        <div className={`${popoverBox} min-w-full ${align === "right" ? "right-0" : "left-0"}`}>
          <ul
            ref={list}
            id={listId}
            role="listbox"
            tabIndex={-1}
            aria-label={label}
            aria-activedescendant={`${listId}-${cursor}`}
            onKeyDown={onListKey}
            className={`${popoverScroll} outline-none`}
          >
            {options.map((o, i) => (
              <li
                key={o.value}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={i === selected}
                onPointerDown={(e) => e.preventDefault()}
                onPointerEnter={() => setCursor(i)}
                onClick={() => pick(i)}
                className={`flex cursor-pointer items-center gap-2 rounded-xl py-2 pr-3 pl-2.5 text-sm whitespace-nowrap transition-colors ${i === cursor ? "bg-surface-muted" : ""} ${i === selected ? "font-semibold text-primary" : "font-medium text-text-primary"}`}
              >
                <Check aria-hidden="true" className={`size-4 shrink-0 ${i === selected ? "opacity-100" : "opacity-0"}`} strokeWidth={2.5} />
                {o.label}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
