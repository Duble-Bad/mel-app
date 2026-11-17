"use client";

import { PASSWORD_STRENGTH_LABEL, passwordHint, passwordStrength, type PasswordStrength } from "@mel/core";

/** Cor de cada nível nas cores da MEL (fraca → forte), nos dois temas. */
const COLOR: Record<PasswordStrength, string> = {
  0: "var(--color-border-strong)",
  1: "var(--color-status-lost-solid)",
  2: "var(--color-brand)",
  3: "var(--color-status-sighting-solid)",
  4: "var(--color-status-found-solid)",
};

/**
 * "Flow Fill" (ui-motion-prompts, Password Strength 1): um único preenchimento
 * "escorre" de um segmento para o outro, pulando os vãos, enquanto a cor passa
 * para a do novo nível. Só orienta: quem bloqueia é a regra dos 8 caracteres.
 * Texto do nível e a dica ao lado (não depende só da cor). Com "reduzir
 * movimento", troca sem escorrer (motion-reduce).
 */
export function PasswordStrengthMeter({ password, id }: { password: string; id?: string }) {
  const level = passwordStrength(password);
  const hint = passwordHint(password, level);
  const color = COLOR[level];
  return (
    <div id={id} className="flex flex-col gap-1.5" data-testid="password-strength" data-level={level}>
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
      {level > 0 && (
        <p className="text-xs text-text-secondary" aria-live="polite">
          {/* Texto sempre na cor de texto (contraste nos dois temas); a cor fica nas barras. */}
          <span className="font-semibold text-text-primary">
            Força da senha: {PASSWORD_STRENGTH_LABEL[level]}
          </span>
          {hint && <span> · {hint}</span>}
        </p>
      )}
    </div>
  );
}
