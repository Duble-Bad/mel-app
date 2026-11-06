import type { DocumentLookup, SaveDocumentResult, StoredPartnerDocument } from "@mel/data";
import { type DocumentReadState, partnerCpfAad, type PiiKeyring, piiLookupHmacs, sealPii, tryOpenPii } from "./crypto";

/**
 * Regras do CPF do protetor no servidor, sem depender de Next nem do banco
 * (as dependências entram por parâmetro: testáveis com dublês).
 *
 * - Gravar/regravar: HMAC em TODAS as versões de chave configuradas (rotação
 *   sem brecha de duplicidade), cifra com a chave atual e grava pela RPC
 *   atômica. Duplicado → 409 com mensagem que não repete o número.
 * - Ler: nunca lança; se não abrir, marca "ilegível"/"indisponível" (a conta e
 *   o cadastro ficam) e devolve o estado para a tela oferecer novo cadastro.
 * - Logs só com códigos/nomes de erro: nunca o CPF, o HMAC ou o cifrado.
 */

export const DUPLICATE_CPF = "Este CPF já está em outro cadastro de protetor. Se é você, fale com a equipe da MEL pelo e-mail de contato.";
export const DUPLICATE_CPF_FIELD = "Este CPF já está em outro cadastro.";
const MAX_DUPLICATES_PER_DAY = 5;

export interface CpfDeps {
  save(d: {
    businessId: string; actorId: string; ciphertext: string; iv: string; authTag: string; keyVersion: number;
    lookups: DocumentLookup[]; mode: "signup" | "change";
  }): Promise<SaveDocumentResult>;
  hmacExists(lookups: DocumentLookup[], exceptBusinessId?: string): Promise<boolean>;
  duplicateRejections(actorId: string): Promise<number>;
  logDuplicate(actorId: string): Promise<void>;
  markState(businessId: string, state: DocumentReadState, actorId: string | null): Promise<unknown>;
}

export type CpfWriteOutcome =
  | { ok: true; result: SaveDocumentResult }
  | { ok: false; status: number; error: string; field?: string };

const errorCode = (err: unknown) => (err && typeof err === "object" && "code" in err ? String((err as { code?: unknown }).code ?? "") : "");

/**
 * Pré-cheque (freio contra enumeração + duplicidade em todas as versões de
 * HMAC). Na inscrição roda antes de criar o cadastro; na correção ignora o
 * próprio cadastro (regravar o mesmo CPF não é duplicidade).
 */
export async function precheckCpf(
  deps: CpfDeps,
  ring: PiiKeyring,
  actorId: string,
  cpf: string,
  exceptBusinessId?: string,
): Promise<Extract<CpfWriteOutcome, { ok: false }> | null> {
  if ((await deps.duplicateRejections(actorId)) >= MAX_DUPLICATES_PER_DAY) {
    return { ok: false, status: 429, error: "Muitas tentativas hoje. Fale com a equipe da MEL." };
  }
  if (await deps.hmacExists(piiLookupHmacs(ring, "cpf", cpf), exceptBusinessId)) {
    await deps.logDuplicate(actorId).catch(() => {});
    return { ok: false, status: 409, error: DUPLICATE_CPF, field: DUPLICATE_CPF_FIELD };
  }
  return null;
}

/** Grava (inscrição) ou regrava (correção/novo cadastro do CPF ilegível). `cpf` já validado e normalizado. */
export async function writePartnerCpf(
  deps: CpfDeps,
  ring: PiiKeyring,
  input: { businessId: string; actorId: string; cpf: string; mode: "signup" | "change" },
): Promise<CpfWriteOutcome> {
  if (input.mode === "change") {
    const pre = await precheckCpf(deps, ring, input.actorId, input.cpf, input.businessId);
    if (pre) return pre;
  }
  try {
    const box = sealPii(ring, input.cpf, partnerCpfAad(input.businessId));
    const result = await deps.save({
      businessId: input.businessId,
      actorId: input.actorId,
      ciphertext: box.ciphertext,
      iv: box.iv,
      authTag: box.authTag,
      keyVersion: box.keyVersion,
      lookups: piiLookupHmacs(ring, "cpf", input.cpf),
      mode: input.mode,
    });
    return { ok: true, result };
  } catch (err) {
    const code = errorCode(err);
    if (code === "23505") {
      await deps.logDuplicate(input.actorId).catch(() => {});
      return { ok: false, status: 409, error: DUPLICATE_CPF, field: DUPLICATE_CPF_FIELD };
    }
    if (code === "22023") return { ok: false, status: 409, error: "Este cadastro não aceita alterações agora." };
    console.error("[pii/cpf] falha ao gravar documento", code || (err as Error)?.name || "erro");
    return { ok: false, status: 500, error: "Não conseguimos guardar o CPF agora. Tente de novo." };
  }
}

export type CpfReadOutcome = { ok: true; cpf: string } | { ok: false; state: Exclude<DocumentReadState, "ok"> };

/**
 * Abre o CPF guardado. Falhou → marca o estado (sem apagar nada) e devolve-o.
 * Abriu uma linha marcada como ilegível/indisponível (chave restaurada) →
 * volta a "ok".
 */
export async function readPartnerCpf(deps: Pick<CpfDeps, "markState">, ring: PiiKeyring, doc: StoredPartnerDocument, actorId: string | null): Promise<CpfReadOutcome> {
  const opened = tryOpenPii(ring, doc, partnerCpfAad(doc.businessId));
  if (!opened.ok) {
    await deps.markState(doc.businessId, opened.state, actorId).catch((err: unknown) => console.error("[pii/cpf] falha ao marcar estado", errorCode(err) || "erro"));
    return { ok: false, state: opened.state };
  }
  if (doc.readState && doc.readState !== "ok") {
    await deps.markState(doc.businessId, "ok", actorId).catch(() => {});
  }
  return { ok: true, cpf: opened.value };
}

/** Texto para o titular quando o CPF guardado não abre. Nunca promete recuperar o número. */
export const UNREADABLE_CPF_MESSAGE: Record<Exclude<DocumentReadState, "ok">, string> = {
  unreadable: "Não conseguimos ler o CPF guardado. Sua conta e seu cadastro continuam; cadastre o CPF de novo em Dados pessoais.",
  key_unavailable: "O CPF guardado está indisponível no momento. Sua conta e seu cadastro continuam; se preferir, cadastre o CPF de novo em Dados pessoais.",
};
