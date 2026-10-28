import type { ComponentProps } from "react";

/** Filtro em pílula (liga/desliga). Estado anunciado por aria-pressed, não só por cor. */
export function FilterChip({ pressed, className, children, ...props }: ComponentProps<"button"> & { pressed: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      {...props}
      className={`inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-sm font-semibold whitespace-nowrap transition-[background-color,border-color,color,transform] duration-200 ease-mel active:scale-[.97] ${
        pressed
          ? "border-focus bg-primary-soft text-primary-soft-foreground"
          : "border-border bg-surface text-text-secondary hover:border-border-strong hover:text-text-primary"
      } ${className ?? ""}`}
    >
      {children}
    </button>
  );
}
