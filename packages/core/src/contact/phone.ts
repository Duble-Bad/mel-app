// Telefone brasileiro: uma só regra para o app e o banco
// (private.is_valid_br_phone espelha esta função).
//
// Forma canônica GUARDADA: DDD + número, só dígitos ("11987654321"). Todos os
// números da MEL são do Brasil, então o E.164 é sempre "+55" + a forma
// canônica (phoneToE164) — usado em links (wa.me, tel:). Guardar sem o +55
// mantém compatíveis as linhas e restrições que já existiam (10–11 dígitos).
//
// "Formato válido" NÃO é "confirmado": a MEL não envia SMS, então nenhum
// telefone é confirmado (PHONE_CONFIRMATION = "nao_confirmado").

/** DDDs em uso no Brasil (plano de numeração da Anatel). */
export const BR_DDDS: ReadonlySet<string> = new Set(
  [
    11, 12, 13, 14, 15, 16, 17, 18, 19, 21, 22, 24, 27, 28, 31, 32, 33, 34, 35, 37, 38, 41, 42, 43, 44, 45, 46, 47, 48, 49, 51, 53,
    54, 55, 61, 62, 63, 64, 65, 66, 67, 68, 69, 71, 73, 74, 75, 77, 79, 81, 82, 83, 84, 85, 86, 87, 88, 89, 91, 92, 93, 94, 95, 96,
    97, 98, 99,
  ].map(String),
);

export type PhoneKind = "mobile" | "landline";
export type PhoneProblem = "empty" | "length" | "ddd" | "mobile_prefix" | "landline_prefix";

export type PhoneParse =
  | { ok: true; national: string; e164: string; kind: PhoneKind }
  | { ok: false; problem: PhoneProblem };

export const PHONE_MESSAGES: Record<PhoneProblem, string> = {
  empty: "Informe o telefone com DDD.",
  length: "Use DDD + número: 11 dígitos no celular, 10 no fixo.",
  ddd: "Confira o DDD: ele não existe no Brasil.",
  mobile_prefix: "Celular tem 9 na frente: (11) 9XXXX-XXXX.",
  landline_prefix: "Telefone fixo começa com 2, 3, 4 ou 5 depois do DDD.",
};

/** Só os dígitos nacionais (tira +55, o 0 de longa distância e a pontuação). */
function nationalDigits(raw: string): string {
  let d = raw.replace(/\D/g, "");
  if (d.startsWith("55") && (d.length === 12 || d.length === 13)) d = d.slice(2);
  else if (d.startsWith("0") && (d.length === 11 || d.length === 12)) d = d.slice(1);
  return d;
}

/** Valida e normaliza. Aceita com ou sem pontuação, com +55 ou 0 na frente. */
export function parseBrPhone(raw: string | null | undefined): PhoneParse {
  const d = nationalDigits(raw ?? "");
  if (!d) return { ok: false, problem: "empty" };
  if (d.length !== 10 && d.length !== 11) return { ok: false, problem: "length" };
  if (!BR_DDDS.has(d.slice(0, 2))) return { ok: false, problem: "ddd" };
  if (d.length === 11) {
    if (d[2] !== "9") return { ok: false, problem: "mobile_prefix" };
    return { ok: true, national: d, e164: `+55${d}`, kind: "mobile" };
  }
  if (!/[2-5]/.test(d[2]!)) return { ok: false, problem: "landline_prefix" };
  return { ok: true, national: d, e164: `+55${d}`, kind: "landline" };
}

export const isValidBrPhone = (raw: string) => parseBrPhone(raw).ok;

/** "11987654321" → "+5511987654321". */
export const phoneToE164 = (national: string) => `+55${national.replace(/\D/g, "")}`;

/** Confirmação por SMS não existe na MEL: todo telefone fica "não confirmado". */
export const PHONE_CONFIRMATION = "nao_confirmado" as const;
