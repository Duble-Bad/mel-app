import type { DocumentReadState, PartnerKind } from "@mel/core";
import { DataError, type MelClient } from "./client";

// Documentos privados de parceiros (CPF do protetor, sempre CIFRADO pelo
// servidor). Todas as funções daqui exigem o cliente de SERVIÇO: anon e
// authenticated não têm acesso nenhum a estas tabelas. Nunca registrar em log
// o conteúdo das linhas nem os detalhes de erro do banco (podem conter o HMAC).

function fail(error: { message: string; code?: string }): never {
  throw new DataError(error.message, error.code);
}

/** Erro sem o texto do Postgres (que poderia trazer o HMAC): só o código. */
function failOpaque(error: { code?: string }, message: string): never {
  throw new DataError(message, error.code, { trusted: true });
}

export interface StoredPartnerDocument {
  businessId: string;
  ownerId: string;
  ciphertext: string;
  iv: string;
  authTag: string;
  keyVersion: number;
  lookupHmac: string;
  hmacKeyVersion: number;
  readState?: DocumentReadState;
}

/** HMAC do CPF em uma versão de chave (a primeira da lista é a atual). */
export interface DocumentLookup {
  v: number;
  h: string;
}

export type PartnerDocumentAction =
  | "stored"
  | "owner_view"
  | "moderator_view"
  | "admin_view"
  | "denied"
  | "duplicate_rejected"
  | "deleted_rejected"
  | "reregistered";

export type SaveDocumentResult = "stored" | "changed" | "re_registered" | "unchanged";

export interface PartnerRef {
  id: string;
  code: string;
  ownerId: string;
  kind: PartnerKind;
  name: string;
  status: string;
}

export async function findPartnerByCode(service: MelClient, code: string): Promise<PartnerRef | null> {
  const { data, error } = await service
    .from("businesses")
    .select("id, short_code, owner_id, partner_kind, name, status")
    .eq("short_code", code.toLowerCase())
    .maybeSingle();
  if (error) fail(error);
  if (!data) return null;
  const r = data as { id: string; short_code: string; owner_id: string; partner_kind: PartnerKind; name: string; status: string };
  return { id: r.id, code: r.short_code, ownerId: r.owner_id, kind: r.partner_kind, name: r.name, status: r.status };
}

/**
 * Já existe CPF com algum destes HMACs (uma entrada por versão de chave)?
 * Checagem prévia; a garantia final é a RPC save_partner_document (atômica).
 */
export async function partnerDocumentHmacExists(service: MelClient, lookups: DocumentLookup[] | string, exceptBusinessId?: string): Promise<boolean> {
  const list = typeof lookups === "string" ? null : lookups;
  const hmacs = list ? list.map((l) => l.h) : [lookups as string];
  let q = service.from("partner_documents").select("business_id, lookup_hmac, hmac_key_version").eq("doc_type", "CPF").in("lookup_hmac", hmacs);
  if (exceptBusinessId) q = q.neq("business_id", exceptBusinessId);
  const { data, error } = await q;
  if (error) failOpaque(error, "Falha ao consultar documentos.");
  const rows = (data ?? []) as { lookup_hmac: string; hmac_key_version: number }[];
  if (!list) return rows.length > 0;
  return rows.some((r) => list.some((l) => l.v === r.hmac_key_version && l.h === r.lookup_hmac));
}

/**
 * Grava (inscrição) ou regrava (correção pelo titular) o CPF cifrado pela RPC
 * save_partner_document: duplicidade checada em todas as versões de HMAC
 * informadas, sob trava; regravação de parceiro aprovado volta para análise.
 * Duplicado → DataError com código 23505 e mensagem genérica.
 */
export async function savePartnerDocument(
  service: MelClient,
  d: Omit<StoredPartnerDocument, "lookupHmac" | "hmacKeyVersion" | "ownerId"> & { actorId: string; lookups: DocumentLookup[]; mode: "signup" | "change" },
): Promise<SaveDocumentResult> {
  const { data, error } = await service.rpc("save_partner_document", {
    p_business_id: d.businessId,
    p_actor: d.actorId,
    p_ciphertext: d.ciphertext,
    p_iv: d.iv,
    p_auth_tag: d.authTag,
    p_key_version: d.keyVersion,
    p_lookups: d.lookups as never,
    p_mode: d.mode,
  });
  if (error) {
    if (error.code === "23505") failOpaque(error, "Documento já cadastrado.");
    // As demais mensagens são as do próprio banco da MEL (sem valores).
    fail(error);
  }
  return data as SaveDocumentResult;
}

/** Grava o CPF cifrado na inscrição (atalho de savePartnerDocument). Duplicado → 23505. */
export async function storePartnerDocument(service: MelClient, d: StoredPartnerDocument & { extraLookups?: DocumentLookup[] }): Promise<void> {
  await savePartnerDocument(service, {
    businessId: d.businessId,
    actorId: d.ownerId,
    ciphertext: d.ciphertext,
    iv: d.iv,
    authTag: d.authTag,
    keyVersion: d.keyVersion,
    lookups: [{ v: d.hmacKeyVersion, h: d.lookupHmac }, ...(d.extraLookups ?? [])],
    mode: "signup",
  });
}

export async function getPartnerDocument(service: MelClient, businessId: string): Promise<StoredPartnerDocument | null> {
  const { data, error } = await service
    .from("partner_documents")
    .select("business_id, owner_id, ciphertext, iv, auth_tag, key_version, lookup_hmac, hmac_key_version, read_state")
    .eq("business_id", businessId)
    .maybeSingle();
  if (error) failOpaque(error, "Falha ao ler o documento.");
  if (!data) return null;
  const r = data as {
    business_id: string; owner_id: string; ciphertext: string; iv: string; auth_tag: string;
    key_version: number; lookup_hmac: string; hmac_key_version: number; read_state: DocumentReadState;
  };
  return {
    businessId: r.business_id, ownerId: r.owner_id, ciphertext: r.ciphertext, iv: r.iv, authTag: r.auth_tag,
    keyVersion: r.key_version, lookupHmac: r.lookup_hmac, hmacKeyVersion: r.hmac_key_version, readState: r.read_state,
  };
}

/** Marca o estado de leitura (ilegível/indisponível, ou de volta a ok). Nunca apaga nada. */
export async function markPartnerDocumentState(service: MelClient, businessId: string, state: DocumentReadState, actorId: string | null): Promise<boolean> {
  const { data, error } = await service.rpc("mark_partner_document_state", { p_business_id: businessId, p_state: state, p_actor: actorId as string });
  if (error) fail(error);
  return data === true;
}

/** Registro de auditoria (quem, quando, qual parceiro; nunca o valor). */
export async function logPartnerDocumentAccess(
  service: MelClient,
  e: { businessId: string | null; businessCode: string | null; actorId: string; action: PartnerDocumentAction; full?: boolean },
): Promise<void> {
  const { error } = await service.from("partner_document_access_log").insert({
    business_id: e.businessId,
    business_code: e.businessCode,
    actor_id: e.actorId,
    action: e.action,
    full_value: e.full ?? false,
  } as never);
  if (error) fail(error);
}

/** Tentativas recusadas por CPF duplicado nas últimas 24 h (freio contra enumeração). */
export async function recentDuplicateRejections(service: MelClient, actorId: string): Promise<number> {
  const since = new Date(Date.now() - 24 * 60 * 60_000).toISOString();
  const { count, error } = await service
    .from("partner_document_access_log")
    .select("id", { count: "exact", head: true })
    .eq("actor_id", actorId)
    .eq("action", "duplicate_rejected")
    .gte("created_at", since);
  if (error) fail(error);
  return count ?? 0;
}

/**
 * Quem pode ver o CPF COMPLETO de outra pessoa: só ADMINISTRADOR com
 * concessão explícita (papel admin + linha em pii_access_grants). Moderador
 * comum nunca, mesmo com concessão antiga (decisão do proprietário, 2026-11-06).
 */
export async function canRevealPartnerDocuments(
  service: MelClient,
  userId: string,
): Promise<{ moderator: boolean; admin: boolean; granted: boolean }> {
  const [{ data: profile, error: e1 }, { data: grant, error: e2 }] = await Promise.all([
    service.from("profiles").select("role").eq("id", userId).maybeSingle(),
    service.from("pii_access_grants").select("user_id").eq("user_id", userId).maybeSingle(),
  ]);
  if (e1) fail(e1);
  if (e2) fail(e2);
  const role = (profile as { role?: string } | null)?.role;
  const admin = role === "admin";
  return { moderator: role === "moderator" || admin, admin, granted: admin && Boolean(grant) };
}

/** Desfaz um cadastro que não pôde guardar o documento (compensação no servidor). */
export async function deletePartnerById(service: MelClient, businessId: string): Promise<void> {
  const { error } = await service.from("businesses").delete().eq("id", businessId);
  if (error) fail(error);
}
