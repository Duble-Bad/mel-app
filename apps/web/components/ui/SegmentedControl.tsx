"use client";

import { useRef, type KeyboardEvent } from "react";

interface Option<T extends string> {
  value: T;
  label: string;
}

/**
 * Abas em pílula com indicador deslizante (tablist ARIA: setas ←/→ trocam).
 * O conteúdo de cada aba é responsabilidade de quem usa (`aria-controls`).
 * Aba ativa no dourado oficial da MEL (#f6b928, texto #1c1404: contraste 10:1) nos dois temas;
 * a inativa fica sem fundo, em texto secundário: a diferença não depende só de nuance.
 */
export function SegmentedControl<T extends string>({
  label,
  options,
  value,
  onChange,
  controls,
}: {
  label: string;
  options: readonly Option<T>[];
  value: T;
  onChange: (value: T) => void;
  controls?: string;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const index = Math.max(0, options.findIndex((o) => o.value === value));

  function onKeyDown(e: KeyboardEvent) {
    const delta = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!delta) return;
    e.preventDefault();
    const next = (index + delta + options.length) % options.length;
    onChange(options[next]!.value);
    refs.current[next]?.focus();
  }

  return (
    <div role="tablist" aria-label={label} onKeyDown={onKeyDown} className="relative grid rounded-md border border-border bg-surface-muted p-1" style={{ gridTemplateColumns: `repeat(${options.length}, 1fr)` }}>
      <span
        aria-hidden="true"
        className="absolute inset-y-1 left-1 rounded-[11px] bg-[#f6b928] shadow-[0_4px_14px_-4px_rgb(246_185_40/0.55)] transition-transform duration-300 ease-mel"
        style={{ width: `calc((100% - 8px) / ${options.length})`, transform: `translateX(${index * 100}%)` }}
      />
      {options.map((o, i) => {
        const selected = o.value === value;
        return (
          <button
            key={o.value}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="tab"
            aria-selected={selected}
            aria-controls={controls}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(o.value)}
            className={`relative z-10 min-h-11 rounded-[11px] text-sm transition-colors duration-200 focus-visible:outline-offset-2 ${
              selected ? "font-bold text-[#1c1404]" : "font-semibold text-text-secondary hover:text-text-primary"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
