import type { ReactNode } from "react";

export interface ChoiceOption<T extends string> {
  value: T;
  label: ReactNode;
  hint?: ReactNode;
}

const chip =
  "flex min-h-12 cursor-pointer flex-col justify-center rounded-md border-2 border-border-strong bg-surface px-4 py-2 " +
  "has-[:checked]:border-primary has-[:checked]:bg-primary-soft has-[:checked]:text-primary-soft-foreground " +
  "has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-focus";

interface GroupProps {
  legend: string;
  hint?: ReactNode;
  error?: string;
  optional?: boolean;
  columns?: 1 | 2 | 3;
  children: ReactNode;
}

function Group({ legend, hint, error, optional, columns = 3, children }: GroupProps) {
  return (
    <fieldset className="flex flex-col gap-2" aria-invalid={error ? true : undefined}>
      <legend className="mb-1.5 font-semibold">
        {legend}
        {optional && <span className="ml-1 font-normal text-text-secondary">(opcional)</span>}
      </legend>
      {hint && <p className="-mt-1 text-sm text-text-secondary">{hint}</p>}
      <div className={`grid gap-2 ${columns === 1 ? "grid-cols-1" : columns === 2 ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-3"}`}>{children}</div>
      {error && <p className="text-sm font-medium text-danger">{error}</p>}
    </fieldset>
  );
}

/** Escolha única com botões grandes (rádio nativo — teclado e leitor de tela funcionam). */
export function ChoiceGroup<T extends string>({
  name,
  options,
  value,
  onChange,
  ...group
}: Omit<GroupProps, "children"> & {
  name: string;
  options: ChoiceOption<T>[];
  value: T | null;
  onChange: (value: T) => void;
}) {
  return (
    <Group {...group}>
      {options.map((o) => (
        <label key={o.value} className={chip}>
          <input
            type="radio"
            name={name}
            value={o.value}
            checked={value === o.value}
            onChange={() => onChange(o.value)}
            className="sr-only"
          />
          <span className="font-semibold">{o.label}</span>
          {o.hint && <span className="text-sm text-text-secondary">{o.hint}</span>}
        </label>
      ))}
    </Group>
  );
}

/** Múltipla escolha com chips (checkbox nativo). */
export function MultiChoiceGroup<T extends string>({
  name,
  options,
  values,
  onChange,
  ...group
}: Omit<GroupProps, "children"> & {
  name: string;
  options: ChoiceOption<T>[];
  values: T[];
  onChange: (values: T[]) => void;
}) {
  return (
    <Group {...group}>
      {options.map((o) => (
        <label key={o.value} className={chip}>
          <input
            type="checkbox"
            name={name}
            value={o.value}
            checked={values.includes(o.value)}
            onChange={(e) => onChange(e.target.checked ? [...values, o.value] : values.filter((v) => v !== o.value))}
            className="sr-only"
          />
          <span className="font-semibold">{o.label}</span>
        </label>
      ))}
    </Group>
  );
}

/** Sim / Não / Não sei — para campos que o tutor pode não saber. */
export function YesNoUnknown({
  name,
  legend,
  value,
  onChange,
}: {
  name: string;
  legend: string;
  value: boolean | null;
  onChange: (value: boolean | null) => void;
}) {
  const current = value === null ? "unknown" : value ? "yes" : "no";
  return (
    <ChoiceGroup
      name={name}
      legend={legend}
      columns={3}
      value={current}
      onChange={(v) => onChange(v === "unknown" ? null : v === "yes")}
      options={[
        { value: "yes", label: "Sim" },
        { value: "no", label: "Não" },
        { value: "unknown", label: "Não sei" },
      ]}
    />
  );
}
