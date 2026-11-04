/**
 * Agendador de manutenção (push que ficou para trás + faxina de fotos órfãs).
 * Funções puras: a rota do app passa os segredos e as tarefas; os testes passam
 * tarefas simuladas (nenhum push real).
 */

/** Segredos curtos demais não autorizam nada (evita "Bearer " ou valor de exemplo). */
export const SCHEDULER_SECRET_MIN_LENGTH = 32;

/** Comparação em tempo constante (não revela quantos caracteres batem). */
function sameText(a: string, b: string): boolean {
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}

/**
 * `Authorization: Bearer <segredo>` bate com algum segredo configurado? Só o
 * cabeçalho conta: segredo na URL (query string) nunca autoriza.
 */
export function isSchedulerAuthorized(authorization: string | null | undefined, secrets: (string | null | undefined)[]): boolean {
  const match = /^Bearer (.+)$/.exec(authorization ?? "");
  if (!match) return false;
  const token = match[1]!;
  let ok = false;
  for (const secret of secrets) {
    if (secret && secret.length >= SCHEDULER_SECRET_MIN_LENGTH && sameText(token, secret)) ok = true;
  }
  return ok;
}

export interface MaintenanceReport<T> {
  dispatch: T;
  /** Fotos órfãs apagadas; `null` quando a faxina falhou (o push segue mesmo assim). */
  orphansRemoved: number | null;
}

/**
 * Faxina primeiro, push depois. Falha na faxina é registrada e não impede o
 * push; falha no push sobe para a rota (responde 500).
 */
export async function runScheduledMaintenance<T>(tasks: {
  cleanOrphans: () => Promise<number>;
  dispatch: () => Promise<T>;
  log?: Pick<Console, "info" | "error">;
}): Promise<MaintenanceReport<T>> {
  const log = tasks.log ?? console;
  let orphansRemoved: number | null;
  try {
    orphansRemoved = await tasks.cleanOrphans();
    if (orphansRemoved) log.info("[manutenção] fotos órfãs apagadas", { removed: orphansRemoved });
  } catch (err) {
    orphansRemoved = null;
    log.error("[manutenção] limpeza de fotos órfãs falhou", err instanceof Error ? err.message : String(err));
  }
  return { dispatch: await tasks.dispatch(), orphansRemoved };
}
