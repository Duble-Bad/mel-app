/** Versão vigente dos Termos de uso + Política de privacidade. Mudou o texto, mude a versão. */
export const TERMS_VERSION = "2026-10-29";

/** Frase que a pessoa digita para confirmar a exclusão da conta. */
export const DELETE_CONFIRMATION = "EXCLUIR";

export const isDeleteConfirmed = (typed: string) => typed.trim().toUpperCase() === DELETE_CONFIRMATION;

export interface Consent {
  kind: "terms_privacy";
  version: string;
  granted: boolean;
  createdAt: string;
}

/** Precisa (re)aceitar quando nunca aceitou ou quando a versão mudou. */
export function needsTermsAcceptance(consents: Consent[]): boolean {
  const last = consents.filter((c) => c.kind === "terms_privacy").sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  return !last || !last.granted || last.version !== TERMS_VERSION;
}
