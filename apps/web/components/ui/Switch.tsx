"use client";

import { useId, type ReactNode } from "react";

/** Liga/desliga acessível (role="switch"), com rótulo e descrição. */
export function Switch({
  checked,
  onChange,
  label,
  description,
  disabled,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  description?: ReactNode;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex min-w-0 flex-col gap-0.5">
        <label htmlFor={id} className="font-semibold">
          {label}
        </label>
        {description && (
          <p id={`${id}-desc`} className="text-sm text-text-secondary">
            {description}
          </p>
        )}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-describedby={description ? `${id}-desc` : undefined}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors duration-200 ease-mel disabled:opacity-55 ${
          checked ? "bg-primary" : "bg-border-strong"
        }`}
      >
        <span
          aria-hidden="true"
          className={`inline-block size-5 rounded-full bg-surface shadow-sm transition-transform duration-200 ease-mel ${checked ? "translate-x-6" : "translate-x-1"}`}
        />
      </button>
    </div>
  );
}
