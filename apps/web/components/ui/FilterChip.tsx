import type { ComponentProps } from "react";

/** Filtro em pílula (liga/desliga). Estado anunciado por aria-pressed, não só por cor. `small`: linha secundária. */
export function FilterChip({ pressed, small = false, className, children, ...props }: ComponentProps<"button"> & { pressed: boolean; small?: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      {...props}
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border font-semibold whitespace-nowrap transition-[background-color,border-color,color,transform] duration-200 ease-mel active:scale-[.96] ${
        small ? "min-h-9 px-3.5 text-[13px]" : "min-h-10 px-4 text-sm"
      } ${
        pressed
          ? "border-primary bg-primary text-primary-foreground shadow-primary"
          : "border-border-strong bg-surface text-text-primary hover:border-text-muted"
      } ${className ?? ""}`}
    >
      {children}
    </button>
  );
}
