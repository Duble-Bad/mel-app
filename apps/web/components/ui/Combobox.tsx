"use client";

import { useId, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";

export interface ComboboxOption {
  value: string;
  label: string;
}

interface ComboboxProps {
  label: string;
  hint?: ReactNode;
  error?: string;
  optional?: boolean;
  placeholder?: string;
  /** Opções fixas no topo, sempre visíveis (ex.: "Sem raça definida"). */
  pinned?: ComboboxOption[];
  options: ComboboxOption[];
  /** Filtra as opções pelo texto digitado. */
  filter: (options: ComboboxOption[], query: string) => ComboboxOption[];
  value: string | null;
  onChange: (value: string | null) => void;
  emptyText?: string;
  /** Converte texto digitado em uma opção (apelidos, variações). Padrão: nome exato. */
  resolve?: (typed: string) => string | null;
}

/**
 * Lista suspensa com busca (padrão ARIA combobox). Com centenas de opções,
 * digitar 3 letras é muito mais rápido que rolar um <select> no celular.
 */
export function Combobox({
  label,
  hint,
  error,
  optional,
  placeholder,
  pinned = [],
  options,
  filter,
  value,
  onChange,
  emptyText = "Nada encontrado.",
  resolve,
}: ComboboxProps) {
  const id = useId();
  const listId = `${id}-list`;
  const inputRef = useRef<HTMLInputElement>(null);
  const all = useMemo(() => [...pinned, ...options], [pinned, options]);
  const selected = all.find((o) => o.value === value) ?? null;

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);

  const results = useMemo(() => {
    const matches = filter(options, query);
    const pinnedMatches = query ? filter(pinned, query) : pinned;
    return [...pinnedMatches, ...matches];
  }, [filter, options, pinned, query]);

  const [notice, setNotice] = useState<string | null>(null);

  function choose(option: ComboboxOption) {
    onChange(option.value);
    setQuery("");
    setNotice(null);
    setOpen(false);
  }

  /** Ao sair do campo: texto igual a uma opção é aceito; qualquer outro texto gera aviso — nunca some em silêncio. */
  function commitTyped() {
    const typed = query.trim();
    setOpen(false);
    setQuery("");
    if (!typed) return;
    const resolved = resolve?.(typed);
    const exact =
      all.find((o) => o.value === resolved) ?? all.find((o) => fold(o.label) === fold(typed));
    if (exact) choose(exact);
    else setNotice(`“${typed}” não está na lista. Escolha uma das opções.`);
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActive((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && open) {
      e.preventDefault();
      const option = results[active];
      if (option) choose(option);
    } else if (e.key === "Escape") {
      setOpen(false);
      setQuery("");
      setNotice(null);
    }
  }

  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const activeId = open && results[active] ? `${id}-opt-${active}` : undefined;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="font-semibold">
        {label}
        {optional && <span className="ml-1 font-normal text-text-secondary">(opcional)</span>}
      </label>
      {hint && (
        <p id={hintId} className="text-sm text-text-secondary">
          {hint}
        </p>
      )}
      <div className="relative">
        <input
          ref={inputRef}
          id={id}
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={activeId}
          aria-describedby={[hintId, errorId].filter(Boolean).join(" ") || undefined}
          aria-invalid={error ? true : undefined}
          autoComplete="off"
          placeholder={selected ? undefined : placeholder}
          value={open ? query : (selected?.label ?? "")}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
            setOpen(true);
            setNotice(null);
          }}
          onFocus={() => {
            setOpen(true);
            setActive(0);
          }}
          onBlur={commitTyped}
          onKeyDown={onKeyDown}
          className={`block min-h-12 w-full rounded-md border-2 bg-surface py-2 pr-24 pl-4 text-base focus:border-focus focus:outline-none ${
            error ? "border-danger" : "border-border-strong"
          }`}
        />
        <div className="absolute inset-y-0 right-1 flex items-center">
          {selected && !open && (
            <button
              type="button"
              onClick={() => {
                onChange(null);
                inputRef.current?.focus();
              }}
              className="min-h-10 rounded-sm px-2 text-sm font-semibold text-link"
            >
              Limpar
            </button>
          )}
          <span aria-hidden="true" className="px-2 text-text-secondary">
            ▾
          </span>
        </div>
        {open && (
          <ul
            id={listId}
            role="listbox"
            aria-label={label}
            className="absolute z-20 mt-1 max-h-72 w-full overflow-y-auto rounded-md border-2 border-border-strong bg-surface py-1 shadow-card"
          >
            {results.length === 0 && <li className="px-4 py-3 text-text-secondary">{emptyText}</li>}
            {results.map((option, i) => (
              <li
                key={option.value}
                id={`${id}-opt-${i}`}
                role="option"
                aria-selected={option.value === value}
                // mousedown + preventDefault: escolhe antes do blur fechar a lista.
                onMouseDown={(e) => {
                  e.preventDefault();
                  choose(option);
                }}
                // mousemove (não mouseenter): a lista abrir sob o cursor parado
                // não pode trocar a opção destacada para o teclado.
                onMouseMove={() => setActive(i)}
                className={`flex min-h-11 cursor-pointer items-center px-4 ${
                  i === active ? "bg-surface-muted" : ""
                } ${option.value === value ? "font-semibold text-link" : ""} ${
                  i === pinned.length - 1 && !query ? "border-b border-border" : ""
                }`}
              >
                {option.label}
              </li>
            ))}
          </ul>
        )}
      </div>
      {notice && !error && (
        <p role="alert" className="text-sm font-medium text-danger">
          {notice}
        </p>
      )}
      {error && (
        <p id={errorId} className="text-sm font-medium text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

const fold = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").trim().toLowerCase();
