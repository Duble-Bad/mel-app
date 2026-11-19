/**
 * Força da senha, só como orientação visual. A regra que BLOQUEIA é
 * `passwordChecks` / `isPasswordAccepted` (8+ caracteres com minúscula,
 * maiúscula, número e símbolo), a mesma do Supabase
 * (password_requirements = lower_upper_letters_digits_symbols).
 * Sem dicionário nem biblioteca: tamanho, variedade e repetições óbvias.
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
  if (!hasSymbol(password)) return "Acrescente um símbolo (ex.: ! @ #).";
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
 * Símbolos aceitos: exatamente o conjunto que o Supabase conta como símbolo em
 * `lower_upper_letters_digits_symbols`. Acento, "ç" ou espaço NÃO contam, senão
 * o app aceitaria e o Supabase recusaria a mesma senha.
 */
export const PASSWORD_SYMBOLS = "!@#$%^&*()_+-=[]{};'\\:\"|<>?,./`~";

function hasSymbol(password: string): boolean {
  return [...password].some((ch) => PASSWORD_SYMBOLS.includes(ch));
}

/**
 * O que compõe a senha, item a item, para a lista ao lado do campo.
 * Todos são obrigatórios (decisão do dono em 2026-11-19), iguais no app e no
 * Supabase.
 */
export interface PasswordCheck {
  id: "length" | "lower" | "upper" | "number" | "symbol";
  label: string;
  ok: boolean;
}

export const PASSWORD_MIN_LENGTH = 8;

export function passwordChecks(password: string): PasswordCheck[] {
  return [
    { id: "length", label: `Pelo menos ${PASSWORD_MIN_LENGTH} caracteres`, ok: password.length >= PASSWORD_MIN_LENGTH },
    { id: "lower", label: "Uma letra minúscula (a–z)", ok: /[a-z]/.test(password) },
    { id: "upper", label: "Uma letra maiúscula (A–Z)", ok: /[A-Z]/.test(password) },
    { id: "number", label: "Um número (0–9)", ok: /\d/.test(password) },
    { id: "symbol", label: "Um símbolo (ex.: ! @ # $ %)", ok: hasSymbol(password) },
  ];
}

export function isPasswordAccepted(password: string): boolean {
  return passwordChecks(password).every((c) => c.ok);
}

/** Mensagem do primeiro requisito que falta (vazia quando a senha é aceita). */
export function passwordRequirementMessage(password: string): string {
  if (!password) return "Crie uma senha.";
  const missing = passwordChecks(password).find((c) => !c.ok);
  if (!missing) return "";
  if (missing.id === "length") return `A senha precisa ter pelo menos ${PASSWORD_MIN_LENGTH} caracteres.`;
  if (missing.id === "symbol") return "A senha precisa ter um símbolo, como ! @ # $ %. Acentos e espaço não contam.";
  return `A senha precisa ter ${missing.label.charAt(0).toLowerCase()}${missing.label.slice(1)}.`;
}
