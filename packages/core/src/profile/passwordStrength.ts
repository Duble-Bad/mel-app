/**
 * Força da senha, só como orientação (a regra que bloqueia continua sendo o
 * mínimo de 8 caracteres, igual no app e no Supabase). Sem dicionário nem
 * biblioteca: tamanho, variedade e repetições óbvias.
 *
 * 0 = vazia · 1 = fraca · 2 = razoável · 3 = boa · 4 = forte
 */
export type PasswordStrength = 0 | 1 | 2 | 3 | 4;

export const PASSWORD_STRENGTH_LABEL: Record<PasswordStrength, string> = {
  0: "",
  1: "Fraca",
  2: "Razoável",
  3: "Boa",
  4: "Forte",
};

/** Dica do que falta para subir de nível (vazia quando já está forte). */
export function passwordHint(password: string, level: PasswordStrength): string {
  if (level === 0 || level === 4) return "";
  if (password.length < 8) return "Use pelo menos 8 caracteres.";
  if (!/\d/.test(password)) return "Acrescente um número.";
  if (!/[^A-Za-z0-9]/.test(password)) return "Acrescente um símbolo (ex.: ! @ #).";
  if (!(/[a-z]/.test(password) && /[A-Z]/.test(password))) return "Misture letras maiúsculas e minúsculas.";
  return "Uma senha mais longa fica ainda mais forte.";
}

/** Sequências de teclado e do alfabeto: a senha inteira sendo um trecho delas é fraca. */
const OBVIOUS_RUNS = ["01234567890123456789", "98765432109876543210", "abcdefghijklmnopqrstuvwxyz", "qwertyuiopasdfghjklzxcvbnm"];

export function passwordStrength(password: string): PasswordStrength {
  if (!password) return 0;
  if (password.length < 8) return 1;
  // "aaaaaaaa", "12345678", "abcdefgh": tamanho certo, mas fácil de adivinhar.
  const lower = password.toLowerCase();
  if (new Set(lower).size <= 3 || OBVIOUS_RUNS.some((run) => run.includes(lower))) return 1;
  const classes = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((r) => r.test(password)).length;
  let score = 1;
  if (classes >= 2) score++;
  if (classes >= 3) score++;
  if (password.length >= 12 && classes >= 2) score++;
  if (password.length >= 16 && classes >= 3) score++;
  return Math.min(4, score) as PasswordStrength;
}

/**
 * O que compõe a senha, item a item, para a lista ao lado do campo.
 * `required`: o que a MEL exige (hoje só o tamanho, igual no Supabase);
 * os demais deixam a senha forte e aparecem como recomendação.
 */
export interface PasswordCheck {
  id: "length" | "number" | "symbol" | "case";
  label: string;
  required: boolean;
  ok: boolean;
}

export function passwordChecks(password: string): PasswordCheck[] {
  return [
    { id: "length", label: "Pelo menos 8 caracteres", required: true, ok: password.length >= 8 },
    { id: "number", label: "Um número (0–9)", required: false, ok: /\d/.test(password) },
    { id: "symbol", label: "Um símbolo (ex.: ! @ # $)", required: false, ok: /[^A-Za-z0-9]/.test(password) },
    { id: "case", label: "Letras maiúsculas e minúsculas", required: false, ok: /[a-z]/.test(password) && /[A-Z]/.test(password) },
  ];
}
