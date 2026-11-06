import type { DocumentReadState } from "../partners/documents";
import { isValidCnpj } from "../partners/documents";
import type { BusinessStatus, CnpjCheckStatus, PartnerKind } from "../partners/partners";
import { parseEmail } from "./email";
import { type ContactFieldState, maskCnpj, maskEmail, maskPhone } from "./masks";
import { parseBrPhone } from "./phone";

// Página "Dados pessoais e documentos" (/perfil/dados). O banco devolve os
// valores do PRÓPRIO titular (my_personal_data); o servidor mascara aqui
// ANTES de mandar ao navegador. A página nunca recebe o valor inteiro: para
// corrigir, a pessoa digita o novo valor.

export interface PersonalData {
  account: { email: string | null; emailPending: string | null; emailConfirmed: boolean; providers: string[] };
  partners: Array<{
    code: string;
    kind: PartnerKind;
    name: string;
    status: BusinessStatus;
    phone: string | null;
    whatsapp: string | null;
    cnpj: string | null;
    cnpjStatus: CnpjCheckStatus | null;
    documentState: DocumentReadState | null;
  }>;
  seeker: { status: string; whatsapp: string | null } | null;
  lostCases: Array<{ code: string; status: string; petName: string; contactPhone: string | null; whatsappPublic: boolean; phonePublic: boolean }>;
}

export interface MaskedValue {
  masked: string;
  state: ContactFieldState;
}

export interface MaskedPersonalData {
  account: {
    email: MaskedValue | null;
    /** Troca pedida e ainda não confirmada (mascarado). */
    emailPending: string | null;
    canUsePassword: boolean;
    canUseGoogle: boolean;
  };
  partners: Array<{
    code: string;
    kind: PartnerKind;
    name: string;
    status: BusinessStatus;
    phone: MaskedValue | null;
    whatsapp: MaskedValue | null;
    cnpj: MaskedValue | null;
    /** Protetor: estado do CPF guardado (null = nenhum CPF guardado). */
    cpf: { state: DocumentReadState } | null;
  }>;
  seeker: { status: string; whatsapp: MaskedValue | null } | null;
  lostCases: Array<{ code: string; petName: string; status: string; phone: MaskedValue | null }>;
}

/** Telefone guardado: "formato válido · não confirmado" (não há SMS) ou "precisa ser corrigido" (linha antiga fora do padrão). */
export function maskStoredPhone(v: string | null): MaskedValue | null {
  if (!v) return null;
  const p = parseBrPhone(v);
  // Só a forma canônica guardada conta como válida (ex.: "+55" colado é linha antiga a corrigir).
  return p.ok && p.national === v ? { masked: maskPhone(p.national), state: "format_ok_unconfirmed" } : { masked: maskPhone(p.ok ? p.national : v), state: "needs_fix" };
}

export function maskPersonalData(d: PersonalData): MaskedPersonalData {
  const email = d.account.email;
  return {
    account: {
      email: email ? { masked: maskEmail(email), state: !parseEmail(email).ok ? "needs_fix" : d.account.emailConfirmed ? "confirmed" : "pending_confirmation" } : null,
      emailPending: d.account.emailPending ? maskEmail(d.account.emailPending) : null,
      canUsePassword: d.account.providers.includes("email"),
      canUseGoogle: d.account.providers.includes("google"),
    },
    partners: d.partners.map((b) => ({
      code: b.code,
      kind: b.kind,
      name: b.name,
      status: b.status,
      phone: maskStoredPhone(b.phone),
      whatsapp: maskStoredPhone(b.whatsapp),
      cnpj: b.cnpj
        ? { masked: maskCnpj(b.cnpj), state: !isValidCnpj(b.cnpj) ? "needs_fix" : b.cnpjStatus === "VERIFIED" ? "confirmed" : "pending_confirmation" }
        : null,
      cpf: b.kind === "independent" && b.documentState ? { state: b.documentState } : null,
    })),
    seeker: d.seeker ? { status: d.seeker.status, whatsapp: maskStoredPhone(d.seeker.whatsapp) } : null,
    lostCases: d.lostCases.map((c) => ({ code: c.code, petName: c.petName, status: c.status, phone: maskStoredPhone(c.contactPhone) })),
  };
}
