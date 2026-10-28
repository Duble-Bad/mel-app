import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "md" | "lg";

const base =
  "inline-flex w-full items-center justify-center gap-2 rounded-md px-5 font-semibold transition-colors " +
  "disabled:cursor-not-allowed disabled:opacity-60 aria-disabled:pointer-events-none aria-disabled:opacity-60";

const variants: Record<Variant, string> = {
  primary: "bg-brand-primary text-brand-on-primary hover:bg-brand-primary-hover",
  secondary: "border-2 border-border-strong bg-surface text-text-primary hover:bg-surface-muted",
  ghost: "text-brand-primary underline-offset-4 hover:underline",
  danger: "bg-danger text-text-inverse hover:opacity-90",
};

// Áreas de toque generosas: 48px (md) e 56px (lg).
const sizes: Record<Size, string> = {
  md: "min-h-12 text-base",
  lg: "min-h-14 text-lg",
};

interface StyleProps {
  variant?: Variant;
  size?: Size;
}

const classes = ({ variant = "primary", size = "lg" }: StyleProps, extra?: string) =>
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
      className={classes({ variant, size }, className)}
    >
      {loading ? (loadingText ?? "Aguarde…") : children}
    </button>
  );
}

export function ButtonLink({ variant, size, className, ...props }: ComponentProps<typeof Link> & StyleProps) {
  return <Link {...props} className={classes({ variant, size }, className)} />;
}
