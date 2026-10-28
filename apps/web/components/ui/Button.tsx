import Link from "next/link";
import { LoaderCircle } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "soft";
type Size = "md" | "lg";

// Estados: hover, pressed (scale .985), focus visível (global), disabled e loading.
const base =
  "inline-flex w-full select-none items-center justify-center gap-2 rounded-md px-5 font-semibold " +
  "transition-[background-color,border-color,color,transform,box-shadow] duration-200 ease-mel " +
  "active:scale-[.985] disabled:cursor-not-allowed disabled:opacity-55 disabled:active:scale-100 " +
  "aria-disabled:pointer-events-none aria-disabled:opacity-55";

const variants: Record<Variant, string> = {
  primary: "bg-primary text-primary-foreground shadow-primary hover:bg-primary-hover",
  secondary: "border border-border-strong bg-surface-elevated text-text-primary shadow-xs hover:bg-surface-muted",
  ghost: "text-link hover:bg-primary-soft",
  danger: "bg-danger-solid text-text-inverse shadow-xs hover:brightness-95",
  soft: "bg-primary-soft text-primary-soft-foreground hover:bg-brand-ring",
};

// Áreas de toque: 48px (md) e 52px (lg, padrão do Design System).
const sizes: Record<Size, string> = {
  md: "min-h-12 text-[15px] leading-5",
  lg: "min-h-13 text-[15px] leading-5",
};

interface StyleProps {
  variant?: Variant;
  size?: Size;
}

export const buttonClasses = ({ variant = "primary", size = "lg" }: StyleProps, extra?: string) =>
  [base, variants[variant], sizes[size], extra].filter(Boolean).join(" ");

export function Button({
  variant,
  size,
  loading,
  loadingText,
  className,
  children,
  disabled,
  ...props
}: ComponentProps<"button"> & StyleProps & { loading?: boolean; loadingText?: ReactNode }) {
  return (
    <button
      type="button"
      {...props}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={buttonClasses({ variant, size }, className)}
    >
      {loading ? (
        <>
          <LoaderCircle aria-hidden="true" className="size-[18px] animate-spin" strokeWidth={2} />
          {loadingText ?? "Aguarde…"}
        </>
      ) : (
        children
      )}
    </button>
  );
}

export function ButtonLink({ variant, size, className, ...props }: ComponentProps<typeof Link> & StyleProps) {
  return <Link {...props} className={buttonClasses({ variant, size }, className)} />;
}

/** Botão só de ícone (44×44): o rótulo acessível é obrigatório. */
export function IconButton({
  label,
  className,
  children,
  ...props
}: Omit<ComponentProps<"button">, "aria-label"> & { label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      {...props}
      className={
        "inline-flex size-11 shrink-0 items-center justify-center rounded-md text-text-secondary " +
        "transition-[background-color,color,transform] duration-200 ease-mel hover:bg-surface-muted hover:text-text-primary " +
        `active:scale-95 disabled:opacity-55 ${className ?? ""}`
      }
    >
      {children}
    </button>
  );
}
