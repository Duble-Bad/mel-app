import type { CnpjCheckStatus } from "./partners";

/**
 * Consulta automática de CNPJ — PREPARADA, mas DESLIGADA (MEL_CNPJ_LOOKUP=off).
 *
 * Pesquisa (2026-11-05): não há acesso oficial gratuito autorizado para um
 * projeto privado. A API "Consulta CNPJ" da Receita no Conecta gov.br é só para
 * órgãos públicos; a do Serpro é paga; a consulta web da Receita tem CAPTCHA
 * (não fazemos raspagem); BrasilAPI/CNPJ.ws/CNPJá são terceiros, não fontes
 * oficiais. Os dados abertos mensais da Receita são oficiais e gratuitos, mas
 * em lote (vários GB) — opção futura via importação offline só das colunas
 * necessárias.
 *
 * Fila (tabela business_cnpj_checks, uma linha por cadastro = dedupe):
 *  - entra PENDING com next_attempt_at = agora quando o CNPJ é gravado/trocado;
 *  - um worker do servidor (service role) pega as linhas vencidas, consulta UMA
 *    vez por CNPJ (resultados recentes do mesmo CNPJ são reaproveitados) e grava
 *    só razão social, situação cadastral, data e fonte;
 *  - falha temporária → ERROR, attempts+1, nova tentativa em backoff
 *    exponencial (cnpjRetryDelayMs) até CNPJ_LOOKUP_MAX_ATTEMPTS; depois fica
 *    para a moderação conferir manualmente.
 * O selo "CNPJ verificado" só aparece com VERIFIED + cadastro APROVADO.
 */
export interface CnpjLookupResult {
  status: Exclude<CnpjCheckStatus, "PENDING" | "ERROR">;
  officialName: string | null;
  registrationStatus: string | null;
  source: string;
  checkedAt: string;
}

export interface CnpjLookupAdapter {
  readonly enabled: boolean;
  readonly source: string;
  lookup(cnpj: string): Promise<CnpjLookupResult>;
}

export const CNPJ_LOOKUP_MAX_ATTEMPTS = 5;
const BASE_DELAY_MS = 15 * 60_000; // 15 min
const MAX_DELAY_MS = 24 * 60 * 60_000; // 1 dia

/** Espera antes da tentativa `attempt` (1, 2, …): 15 min, 30 min, 1 h… até 1 dia. */
export function cnpjRetryDelayMs(attempt: number): number {
  return Math.min(BASE_DELAY_MS * 2 ** Math.max(0, attempt - 1), MAX_DELAY_MS);
}

/** Tenta de novo? Só falhas temporárias e dentro do limite. */
export const shouldRetryCnpjLookup = (attempts: number) => attempts < CNPJ_LOOKUP_MAX_ATTEMPTS;

/** Adaptador desligado: nunca consulta nada (piloto). */
export const disabledCnpjLookup: CnpjLookupAdapter = {
  enabled: false,
  source: "nenhuma",
  lookup: () => Promise.reject(new Error("Consulta de CNPJ desligada (MEL_CNPJ_LOOKUP=off).")),
};

/** Lê a flag. Qualquer valor diferente de "on" mantém desligado. */
export function cnpjLookupEnabled(flag: string | undefined): boolean {
  return flag === "on";
}
