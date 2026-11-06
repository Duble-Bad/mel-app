import "server-only";
import {
  logPartnerDocumentAccess,
  markPartnerDocumentState,
  type MelClient,
  partnerDocumentHmacExists,
  recentDuplicateRejections,
  savePartnerDocument,
} from "@mel/data";
import type { CpfDeps } from "./partnerCpf";

/** Dependências reais (service role) das regras de CPF de partnerCpf.ts. */
export function serviceCpfDeps(service: MelClient): CpfDeps {
  return {
    save: (d) => savePartnerDocument(service, d),
    hmacExists: (lookups, except) => partnerDocumentHmacExists(service, lookups, except),
    duplicateRejections: (actorId) => recentDuplicateRejections(service, actorId),
    logDuplicate: (actorId) => logPartnerDocumentAccess(service, { businessId: null, businessCode: null, actorId, action: "duplicate_rejected" }),
    markState: (businessId, state, actorId) => markPartnerDocumentState(service, businessId, state, actorId),
  };
}
