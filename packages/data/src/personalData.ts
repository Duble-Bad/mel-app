import type { BusinessStatus, CnpjCheckStatus, DocumentReadState, PartnerKind, PersonalData } from "@mel/core";
import { DataError, type MelClient } from "./client";

// Correção de dados pelo TITULAR (/perfil/dados). Tudo com a sessão da própria
// pessoa: RLS, triggers (validação, volta para análise, login recente,
// auditoria) valem do mesmo jeito que para qualquer outro cliente.

function fail(error: { message: string; code?: string }): never {
  throw new DataError(error.message, error.code);
}

interface PersonalDataJson {
  account: { email: string | null; email_pending: string | null; email_confirmed: boolean; providers: string[] } | null;
  partners: Array<{
    code: string; kind: PartnerKind; name: string; status: BusinessStatus; phone: string | null; whatsapp: string | null;
    cnpj: string | null; cnpj_status: CnpjCheckStatus | null; document_state: DocumentReadState | null;
  }>;
  seeker: { status: string; whatsapp: string | null } | null;
  lost_cases: Array<{ code: string; status: string; pet_name: string; contact_phone: string | null; whatsapp_public: boolean; phone_public: boolean }>;
}

/** Dados do próprio titular, com valores inteiros: o servidor mascara antes de mandar ao navegador. */
export async function getMyPersonalData(client: MelClient): Promise<PersonalData> {
  const { data, error } = await client.rpc("my_personal_data");
  if (error) fail(error);
  const d = data as unknown as PersonalDataJson;
  return {
    account: {
      email: d.account?.email ?? null,
      emailPending: d.account?.email_pending ?? null,
      emailConfirmed: d.account?.email_confirmed === true,
      providers: Array.isArray(d.account?.providers) ? d.account!.providers : [],
    },
    partners: (d.partners ?? []).map((b) => ({
      code: b.code, kind: b.kind, name: b.name, status: b.status, phone: b.phone, whatsapp: b.whatsapp,
      cnpj: b.cnpj, cnpjStatus: b.cnpj_status, documentState: b.document_state,
    })),
    seeker: d.seeker ? { status: d.seeker.status, whatsapp: d.seeker.whatsapp } : null,
    lostCases: (d.lost_cases ?? []).map((c) => ({
      code: c.code, status: c.status, petName: c.pet_name, contactPhone: c.contact_phone, whatsappPublic: c.whatsapp_public, phonePublic: c.phone_public,
    })),
  };
}

/** Troca CNPJ/telefone/WhatsApp de um parceiro do titular (trigger: valida, exige login recente, volta para análise, audita). */
export async function updateMyPartnerContact(
  client: MelClient,
  code: string,
  patch: { cnpj?: string; phone?: string | null; whatsapp?: string | null },
): Promise<void> {
  const { data, error } = await client.from("businesses").update(patch as never).eq("short_code", code.toLowerCase()).select("id");
  if (error) fail(error);
  if (!data || data.length === 0) throw new DataError("Cadastro não encontrado.", "P0002", { trusted: true });
}

/** Telefone de contato de um alerta ativo/rascunho do titular. Sem telefone, WhatsApp/ligação deixam de aparecer. */
export async function updateMyLostCasePhone(client: MelClient, code: string, phone: string | null): Promise<void> {
  const patch = phone ? { contact_phone: phone } : { contact_phone: null, contact_whatsapp_public: false, contact_phone_public: false };
  const { data, error } = await client
    .from("lost_cases")
    .update(patch as never)
    .eq("short_code", code.toLowerCase())
    .in("status", ["DRAFT", "ACTIVE"])
    .select("id");
  if (error) fail(error);
  if (!data || data.length === 0) throw new DataError("Alerta não encontrado.", "P0002", { trusted: true });
}

/** WhatsApp da fila de adoção (o status não muda). */
export async function setMySeekerWhatsapp(client: MelClient, whatsapp: string | null): Promise<void> {
  const { error } = await client.rpc("set_my_adoption_seeker_whatsapp", { p_whatsapp: whatsapp as string });
  if (error) fail(error);
}

/**
 * Troca de e-mail pelo fluxo SEGURO do Supabase Auth: o e-mail só muda depois
 * da confirmação nos DOIS endereços (double_confirm_changes). Nada de e-mail é
 * gravado em tabela da MEL (profiles não guarda e-mail; a fonte é auth.users).
 */
export async function requestEmailChange(client: MelClient, email: string, emailRedirectTo: string): Promise<void> {
  const { error } = await client.auth.updateUser({ email }, { emailRedirectTo });
  if (error) throw new DataError(error.message, error.code ?? (error.status ? String(error.status) : undefined), { status: error.status });
}

/** Auditoria (service role) de mudança feita fora do banco (ex.: pedido de troca de e-mail). Nunca o valor. */
export async function logPersonalDataChange(
  service: MelClient,
  e: { actorId: string; subject: "account" | "partner" | "adoption_seeker" | "lost_case"; subjectRef?: string | null; field: "cpf" | "cnpj" | "phone" | "whatsapp" | "email"; action: "changed" | "re_registered" | "removed" | "email_change_requested" },
): Promise<void> {
  const { error } = await service.from("personal_data_changes").insert({
    actor_id: e.actorId,
    subject: e.subject,
    subject_ref: e.subjectRef ?? null,
    field: e.field,
    action: e.action,
  } as never);
  if (error) fail(error);
}
