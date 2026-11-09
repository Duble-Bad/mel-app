/**
 * Bonificação oferecida pelo tutor a quem encontrar o pet (PROTÓTIPO, ainda sem coluna no banco).
 * A MEL só exibe o valor informado: não intermedeia pagamento nem garante a bonificação.
 * Valores em centavos para não haver arredondamento de ponto flutuante.
 */

/** Limite de digitação (R$ 100.000,00): evita erro de digitação virar oferta absurda. */
export const REWARD_MAX_CENTS = 10_000_000;

export type RewardParse = { ok: true; cents: number } | { ok: false; error: string };

/** Lê o valor digitado ("500", "500,00", "1.250,50", "R$ 80") e devolve em centavos. */
export function parseRewardBRL(input: string): RewardParse {
  const text = input.replace(/R\$/i, "").replace(/\s/g, "");
  if (!text) return { ok: false, error: "Informe o valor da bonificação." };
  if (!/^\d{1,3}(\.\d{3})*(,\d{1,2})?$|^\d+(,\d{1,2})?$/.test(text)) return { ok: false, error: "Use só números, como 500 ou 1.250,00." };
  const [reais, centavos = ""] = text.replace(/\./g, "").split(",");
  const cents = Number(reais) * 100 + Number(centavos.padEnd(2, "0"));
  if (cents <= 0) return { ok: false, error: "O valor precisa ser maior que zero." };
  if (cents > REWARD_MAX_CENTS) return { ok: false, error: "Confira o valor: o máximo é R$ 100.000,00." };
  return { ok: true, cents };
}

/** "R$ 1.250,50". */
export function formatRewardBRL(cents: number): string {
  const reais = Math.floor(cents / 100).toLocaleString("pt-BR");
  return `R$ ${reais},${String(cents % 100).padStart(2, "0")}`;
}

/** Máscara enquanto digita: só dígitos, interpretados como centavos ("50000" → "500,00"). */
export function maskRewardInput(raw: string): string {
  const digits = raw.replace(/\D/g, "").replace(/^0+/, "").slice(0, 8);
  if (!digits) return "";
  return formatRewardBRL(Number(digits)).replace(/^R\$ /, "");
}

/**
 * Linha exibida no alerta e nos cartazes. Só aparece com alerta ATIVO e valor informado:
 * alerta encerrado ou reencontrado não mostra oferta (nem bloco vazio).
 */
export function rewardLine(status: "ACTIVE" | "FOUND" | "CLOSED", cents: number | null | undefined): string | null {
  if (status !== "ACTIVE" || !cents || cents <= 0) return null;
  return `BONIFICAÇÃO OFERECIDA: ${formatRewardBRL(cents)}`;
}

/** Aviso que acompanha a bonificação no alerta (a MEL não paga nem garante). */
export const REWARD_DISCLAIMER =
  "Oferecida pelo tutor. A MEL não intermedeia pagamentos nem garante a bonificação. Nunca pague nada antes de estar com o animal.";
