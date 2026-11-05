import type { PartnerKind } from "@mel/core";
import { DataError, type MelClient } from "./client";

// Documentos privados de parceiros (CPF do protetor, sempre CIFRADO pelo
// servidor). Todas as funções daqui exigem o cliente de SERVIÇO: anon e
// authenticated não têm acesso nenhum a estas tabelas. Nunca registrar em log
// o conteúdo das linhas nem os detalhes de erro do banco (podem conter o HMAC).

function fail(error: { message: string; code?: string }): never {
  throw new DataError(error.message, error.code);
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
}

export type PartnerDocumentAction = "stored" | "owner_view" | "moderator_view" | "denied" | "duplicate_rejected" | "deleted_rejected";

export interface PartnerRef {
  id: string;
  code: string;
  ownerId: string;
  kind: PartnerKind;
  name: string;
}

export async function findPartnerByCode(service: MelClient, code: string): Promise<PartnerRef | null> {
  const { data, error } = await service
    .from("businesses")
    .select("id, short_code, owner_id, partner_kind, name")
    .eq("short_code", code.toLowerCase())
    .maybeSingle();
  if (error) fail(error);
  if (!data) return null;
  const r = data as { id: string; short_code: string; owner_id: string; partner_kind: PartnerKind; name: string };
  return { id: r.id, code: r.short_code, ownerId: r.owner_id, kind: r.partner_kind, name: r.name };
}

/** Já existe CPF com este HMAC? (checagem prévia; o índice único é a garantia final). */
export async function partnerDocumentHmacExists(service: MelClient, lookupHmac: string): Promise<boolean> {
  const { count, error } = await service
    .from("partner_documents")
    .select("business_id", { count: "exact", head: true })
    .eq("doc_type", "CPF")
    .eq("lookup_hmac", lookupHmac);
  if (error) fail(error);
  return (count ?? 0) > 0;
}

/** Grava o CPF cifrado. Duplicado → DataError com código 23505. */
export async function storePartnerDocument(service: MelClient, d: StoredPartnerDocument): Promise<void> {
  const { error } = await service.from("partner_documents").insert({
    business_id: d.businessId,
    owner_id: d.ownerId,
    doc_type: "CPF",
    ciphertext: d.ciphertext,
    iv: d.iv,
    auth_tag: d.authTag,
    key_version: d.keyVersion,
    lookup_hmac: d.lookupHmac,
    hmac_key_version: d.hmacKeyVersion,
  } as never);
  // Mensagem genérica: o detalhe do Postgres traria o HMAC.
  if (error) throw new DataError(error.code === "23505" ? "Documento já cadastrado." : "Falha ao gravar o documento.", error.code);
}

export async function getPartnerDocument(service: MelClient, businessId: string): Promise<StoredPartnerDocument | null> {
  const { data, error } = await service
    .from("partner_documents")
    .select("business_id, owner_id, ciphertext, iv, auth_tag, key_version, lookup_hmac, hmac_key_version")
    .eq("business_id", businessId)
    .maybeSingle();
  if (error) fail(error);
  if (!data) return null;
  const r = data as {
    business_id: string; owner_id: string; ciphertext: string; iv: string; auth_tag: string;
    key_version: number; lookup_hmac: string; hmac_key_version: number;
  };
  return {
    businessId: r.business_id, ownerId: r.owner_id, ciphertext: r.ciphertext, iv: r.iv, authTag: r.auth_tag,
    keyVersion: r.key_version, lookupHmac: r.lookup_hmac, hmacKeyVersion: r.hmac_key_version,
  };
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

/** Moderador com concessão explícita para ver CPF (papel + linha em pii_access_grants). */
export async function canViewPartnerDocuments(service: MelClient, userId: string): Promise<{ moderator: boolean; granted: boolean }> {
  const [{ data: profile, error: e1 }, { data: grant, error: e2 }] = await Promise.all([
    service.from("profiles").select("role").eq("id", userId).maybeSingle(),
    service.from("pii_access_grants").select("user_id").eq("user_id", userId).maybeSingle(),
  ]);
  if (e1) fail(e1);
  if (e2) fail(e2);
  const role = (profile as { role?: string } | null)?.role;
  const moderator = role === "moderator" || role === "admin";
  return { moderator, granted: moderator && Boolean(grant) };
}

/** Desfaz um cadastro que não pôde guardar o documento (compensação no servidor). */
export async function deletePartnerById(service: MelClient, businessId: string): Promise<void> {
  const { error } = await service.from("businesses").delete().eq("id", businessId);
  if (error) fail(error);
}
