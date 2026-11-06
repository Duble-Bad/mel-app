// Duas coisas diferentes, que não se misturam:
//
// 1. Máscara de DIGITAÇÃO (format*Input): só aparência no campo, enquanto a
//    pessoa digita. O valor guardado é sempre o canônico, sem pontuação.
// 2. Máscara de PRIVACIDADE (mask*): esconde parte do valor. Quem não pode ver
//    o valor inteiro recebe do SERVIDOR só a versão mascarada (nunca o valor
//    inteiro em HTML, JSON ou props para esconder no navegador).

const only = (raw: string, re: RegExp, max: number) => (raw.match(re) ?? []).join("").slice(0, max);

/** "52998224725" → "529.982.247-25", progressivo (sem pontuação sobrando no fim). */
export function formatCpfInput(raw: string): string {
  const d = only(raw, /\d/g, 11);
  return [d.slice(0, 3), d.slice(3, 6), d.slice(6, 9)].filter(Boolean).join(".") + (d.length > 9 ? `-${d.slice(9)}` : "");
}

/** CNPJ numérico ou alfanumérico: "12ABC34501DE35" → "12.ABC.345/01DE-35", progressivo. */
export function formatCnpjInput(raw: string): string {
  const c = only(raw.toUpperCase(), /[0-9A-Z]/g, 14);
  let out = c.slice(0, 2);
  if (c.length > 2) out += `.${c.slice(2, 5)}`;
  if (c.length > 5) out += `.${c.slice(5, 8)}`;
  if (c.length > 8) out += `/${c.slice(8, 12)}`;
  if (c.length > 12) out += `-${c.slice(12)}`;
  return out;
}

/** Celular "(11) 99999-9999", fixo "(11) 3333-3333", progressivo. Aceita +55 colado. */
export function formatPhoneInput(raw: string): string {
  let d = raw.replace(/\D/g, "");
  if (d.startsWith("55") && d.length > 11) d = d.slice(2);
  d = d.slice(0, 11);
  if (!d) return "";
  if (d.length <= 2) return `(${d}`;
  const ddd = `(${d.slice(0, 2)}) `;
  const rest = d.slice(2);
  if (rest.length <= 4) return ddd + rest;
  if (d.length <= 10) return `${ddd}${rest.slice(0, 4)}-${rest.slice(4)}`;
  return `${ddd}${rest.slice(0, 5)}-${rest.slice(5)}`;
}

/** Privacidade: "***.***.**9-00" (só os 3 últimos dígitos). */
export const maskCpf = (cpf: string) => (/^\d{11}$/.test(cpf) ? `***.***.**${cpf[8]}-${cpf.slice(9)}` : "***.***.***-**");

// Privacidade do CNPJ: mostra só a filial e os dígitos verificadores (ex.: final 0001-81).
export const maskCnpj = (cnpj: string) => (/^[0-9A-Z]{12}\d{2}$/.test(cnpj) ? `**.***.***/${cnpj.slice(8, 12)}-${cnpj.slice(12)}` : "**.***.***/****-**");

/** Privacidade: "(11) *****-4321" / "(11) ****-4321". */
export function maskPhone(national: string): string {
  const d = national.replace(/\D/g, "");
  if (d.length !== 10 && d.length !== 11) return "(**) ****-****";
  return `(${d.slice(0, 2)}) ${"*".repeat(d.length - 6)}-${d.slice(-4)}`;
}

/** Privacidade: "m***@provedor.com.br". */
export function maskEmail(email: string): string {
  const at = email.lastIndexOf("@");
  if (at <= 0) return "***";
  return `${email[0]}***${email.slice(at)}`;
}

/** Estados de um dado de contato/documento mostrados nos formulários. */
export type ContactFieldState = "invalid" | "needs_fix" | "pending_confirmation" | "format_ok_unconfirmed" | "confirmed" | "pending_review";

export const CONTACT_FIELD_STATE_LABELS: Record<ContactFieldState, string> = {
  invalid: "Inválido",
  needs_fix: "Precisa ser corrigido",
  pending_confirmation: "Pendente de confirmação",
  format_ok_unconfirmed: "Formato válido · não confirmado",
  confirmed: "Confirmado",
  pending_review: "Em análise pela moderação",
};
