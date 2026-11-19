"use client";

import { Check, Circle } from "lucide-react";
import { PASSWORD_STRENGTH_LABEL, passwordChecks, passwordStrength, type PasswordCheck, type PasswordStrength } from "@mel/core";

/** Cor de cada nível nas cores da MEL (fraca → forte), nos dois temas. */
const COLOR: Record<PasswordStrength, string> = {
  0: "var(--color-border-strong)",
  1: "var(--color-status-lost-solid)",
  2: "var(--color-brand)",
  3: "var(--color-status-sighting-solid)",
  4: "var(--color-status-found-solid)",
};

/**
 * Força da senha ("Flow Fill", ui-motion-prompts, Password Strength 1) e a
 * composição da senha item a item: o OBRIGATÓRIO (8 caracteres, a mesma regra
 * do Supabase) separado do que a deixa forte (número, símbolo, maiúsculas e
 * minúsculas). Assim nada aparece "cumprido" enquanto a força diz "fraca" sem
 * explicar o porquê. Texto e ícone em cada item (não depende só da cor).
 */
export function PasswordStrengthMeter({ password, id }: { password: string; id?: string }) {
  const level = passwordStrength(password);
  const color = COLOR[level];
  const checks = passwordChecks(password);
  const required = checks.filter((c) => c.required);
  const recommended = checks.filter((c) => !c.required);

  return (
    <div id={id} className="flex flex-col gap-2" data-testid="password-strength" data-level={level}>
      <div aria-hidden="true" className="grid grid-cols-4 gap-1.5">
        {[0, 1, 2, 3].map((i) => {
          const filled = level > i;
          return (
            <span key={i} className="relative h-1.5 overflow-hidden rounded-full bg-surface-muted">
              <span
                className="absolute inset-0 origin-left rounded-full transition-[transform,background-color] ease-[cubic-bezier(0.65,0,0.35,1)] motion-reduce:transition-none"
                style={{
                  backgroundColor: color,
                  transform: `scaleX(${filled ? 1 : 0})`,
                  // A frente do líquido passa de um segmento para o próximo, em sequência (subindo e descendo).
                  transitionDuration: "220ms, 280ms",
                  transitionDelay: `${(filled ? i : 3 - i) * 90}ms, 0ms`,
                }}
              />
            </span>
          );
        })}
      </div>
      <p className="text-xs text-text-secondary" aria-live="polite">
        <span className="font-semibold text-text-primary">Força da senha: {level ? PASSWORD_STRENGTH_LABEL[level] : "—"}</span>
      </p>
      <div className="grid gap-x-4 gap-y-1 text-xs sm:grid-cols-2">
        <CheckList title="Obrigatório" items={required} />
        <CheckList title="Para uma senha forte" items={recommended} />
      </div>
    </div>
  );
}

function CheckList({ title, items }: { title: string; items: PasswordCheck[] }) {
  return (
    <div className="flex flex-col gap-1">
      <p className="font-semibold text-text-secondary">{title}</p>
      <ul className="flex flex-col gap-1">
        {items.map((c) => (
          <li key={c.id} className={`inline-flex items-center gap-1.5 transition-colors duration-200 ${c.ok ? "text-success" : "text-text-secondary"}`}>
            {c.ok ? (
              <Check aria-hidden="true" className="size-3.5 animate-pop motion-reduce:animate-none" strokeWidth={3} />
            ) : (
              <Circle aria-hidden="true" className="size-3.5" strokeWidth={2} />
            )}
            {c.label}
            <span className="sr-only">{c.ok ? " (cumprido)" : " (pendente)"}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
