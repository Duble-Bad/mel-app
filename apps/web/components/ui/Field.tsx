"use client";

import { CircleAlert, Eye, EyeOff } from "lucide-react";
import { useId, useState, type ComponentProps, type ReactNode } from "react";

interface FieldShellProps {
  label: string;
  hint?: ReactNode;
  /** Mostre só depois de interação (blur com conteúdo, envio): nunca ao abrir a tela. */
  error?: string;
  optional?: boolean;
  /** Ação à direita do rótulo (ex.: "Esqueci minha senha"). */
  labelAction?: ReactNode;
  children: (ids: { id: string; describedBy?: string; invalid: boolean }) => ReactNode;
}

/** Estilo dos controles: 52px, borda suave, foco com anel coral; erro só quando informado. */
export const controlClasses = (invalid: boolean, extra = "") =>
  "block min-h-13 w-full rounded-md border bg-input px-4 text-base text-text-primary " +
  "transition-[border-color,box-shadow] duration-200 ease-mel placeholder:text-text-muted " +
  "hover:border-border-strong focus:outline-none focus-visible:outline-none focus:ring-4 " +
  "disabled:cursor-not-allowed disabled:bg-surface-muted disabled:text-text-secondary " +
  (invalid
    ? "border-danger focus:border-danger focus:ring-status-lost-soft "
    : "border-border-input focus:border-focus focus:ring-primary-soft ") +
  extra;

function FieldShell({ label, hint, error, optional, labelAction, children }: FieldShellProps) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-sm font-semibold text-text-primary">
          {label}
          {optional && <span className="ml-1 font-medium text-text-secondary">(opcional)</span>}
        </label>
        {labelAction}
      </div>
      {children({ id, describedBy, invalid: Boolean(error) })}
      {error ? (
        <p id={errorId} className="flex items-start gap-1.5 text-sm font-medium text-danger">
          <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" strokeWidth={2} />
          {error}
        </p>
      ) : (
        hint && (
          <p id={hintId} className="text-sm text-text-secondary">
            {hint}
          </p>
        )
      )}
    </div>
  );
}

type FieldProps = {
  label: string;
  hint?: ReactNode;
  error?: string;
  optional?: boolean;
  labelAction?: ReactNode;
};

type TextFieldProps = Omit<ComponentProps<"input">, "id"> & FieldProps;

export function TextField({ label, hint, error, optional, labelAction, className, ...props }: TextFieldProps) {
  return (
    <FieldShell label={label} hint={hint} error={error} optional={optional} labelAction={labelAction}>
      {({ id, describedBy, invalid }) => (
        <input
          id={id}
          aria-describedby={describedBy}
          aria-invalid={invalid || undefined}
          className={controlClasses(invalid, className)}
          {...props}
        />
      )}
    </FieldShell>
  );
}

/** Senha com olho dentro do campo (mostrar/ocultar), sem checkbox. */
export function PasswordField({ label, hint, error, optional, labelAction, className, ...props }: Omit<TextFieldProps, "type">) {
  const [visible, setVisible] = useState(false);
  return (
    <FieldShell label={label} hint={hint} error={error} optional={optional} labelAction={labelAction}>
      {({ id, describedBy, invalid }) => (
        <div className="relative">
          <input
            id={id}
            type={visible ? "text" : "password"}
            aria-describedby={describedBy}
            aria-invalid={invalid || undefined}
            className={controlClasses(invalid, `pr-13 ${className ?? ""}`)}
            {...props}
          />
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            aria-label={visible ? "Ocultar senha" : "Mostrar senha"}
            aria-pressed={visible}
            aria-controls={id}
            className="absolute inset-y-0 right-1 my-auto inline-flex size-11 items-center justify-center rounded-sm text-text-secondary transition-colors duration-200 hover:text-text-primary"
          >
            {visible ? <EyeOff aria-hidden="true" className="size-5" strokeWidth={1.75} /> : <Eye aria-hidden="true" className="size-5" strokeWidth={1.75} />}
          </button>
        </div>
      )}
    </FieldShell>
  );
}

type TextareaFieldProps = Omit<ComponentProps<"textarea">, "id"> & FieldProps;

export function TextareaField({ label, hint, error, optional, labelAction, className, ...props }: TextareaFieldProps) {
  return (
    <FieldShell label={label} hint={hint} error={error} optional={optional} labelAction={labelAction}>
      {({ id, describedBy, invalid }) => (
        <textarea
          id={id}
          aria-describedby={describedBy}
          aria-invalid={invalid || undefined}
          className={controlClasses(invalid, `py-3.5 ${className ?? ""}`)}
          {...props}
        />
      )}
    </FieldShell>
  );
}

type SelectFieldProps = Omit<ComponentProps<"select">, "id"> & FieldProps;

export function SelectField({ label, hint, error, optional, labelAction, className, children, ...props }: SelectFieldProps) {
  return (
    <FieldShell label={label} hint={hint} error={error} optional={optional} labelAction={labelAction}>
      {({ id, describedBy, invalid }) => (
        <select
          id={id}
          aria-describedby={describedBy}
          aria-invalid={invalid || undefined}
          className={controlClasses(invalid, className)}
          {...props}
        >
          {children}
        </select>
      )}
    </FieldShell>
  );
}
