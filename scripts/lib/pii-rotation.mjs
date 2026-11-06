// Rotação (recifragem) dos CPFs de protetores — lógica compartilhada pelo
// script scripts/pii-rotate.mjs e pelos testes de banco.
//
// Para cada linha de partner_documents:
//   - abre com a versão de chave gravada na linha (chaves anteriores vêm de
//     MEL_PII_ENC_KEYS_PREVIOUS);
//   - se a cifra ou o HMAC não estão na versão ATUAL: recifra com a chave atual
//     e recalcula o HMAC com a chave atual do HMAC (RPC reencrypt_partner_document,
//     que só troca se o cifrado ainda for o lido — nunca sobrescreve uma
//     regravação feita pelo titular no meio do caminho);
//   - se não abre: marca "ilegível"/"indisponível" (nunca apaga). Trava de
//     segurança: se NADA abriu, ou mais da metade falhou, é quase certo que as
//     chaves do ambiente estão erradas — não marca nada (a menos de forceMark).
//   - linha marcada que voltou a abrir (chave restaurada): volta para "ok".
// Nunca imprime nem devolve o valor, o HMAC ou o cifrado: só contagens.
import { partnerCpfAad, planReencryption } from "../../apps/web/lib/pii/crypto.ts";

const COLUMNS = "business_id, ciphertext, iv, auth_tag, key_version, lookup_hmac, hmac_key_version, read_state";

/**
 * @param {{ service: any, ring: any, apply?: boolean, forceMark?: boolean, businessIds?: string[] | null, pageSize?: number }} opts
 */
export async function rotatePartnerDocuments({ service, ring, apply = false, forceMark = false, businessIds = null, pageSize = 200 }) {
  const counts = { total: 0, current: 0, toReencrypt: 0, reencrypted: 0, conflicts: 0, unreadable: 0, key_unavailable: 0, restored: 0, marked: 0, aborted: false };
  /** @type {{ id: string, readState: string, plan: ReturnType<typeof planReencryption>, expected: string }[]} */
  const work = [];
  let last = "00000000-0000-0000-0000-000000000000";
  for (;;) {
    let q = service.from("partner_documents").select(COLUMNS).gt("business_id", last).order("business_id").limit(pageSize);
    if (businessIds) q = q.in("business_id", businessIds);
    const { data, error } = await q;
    if (error) throw new Error(`Falha ao ler partner_documents (${error.code ?? "erro"}).`);
    if (!data || data.length === 0) break;
    for (const r of data) {
      const doc = {
        ciphertext: r.ciphertext, iv: r.iv, authTag: r.auth_tag, keyVersion: r.key_version,
        lookupHmac: r.lookup_hmac, hmacKeyVersion: r.hmac_key_version,
      };
      const plan = planReencryption(ring, doc, partnerCpfAad(r.business_id), "cpf");
      work.push({ id: r.business_id, readState: r.read_state, plan, expected: r.ciphertext });
      counts.total++;
      if (plan.kind === "current") counts.current++;
      else if (plan.kind === "reencrypt") counts.toReencrypt++;
      else counts[plan.state]++;
    }
    last = data[data.length - 1].business_id;
    if (data.length < pageSize) break;
  }
  if (!apply) return counts;

  const failed = counts.unreadable + counts.key_unavailable;
  const opened = counts.total - failed;
  const suspicious = failed > 0 && (opened === 0 || failed * 2 > counts.total);
  if (suspicious && !forceMark) counts.aborted = true;

  for (const w of work) {
    if (w.plan.kind === "reencrypt") {
      const s = w.plan.sealed;
      const { data, error } = await service.rpc("reencrypt_partner_document", {
        p_business_id: w.id, p_expected_ciphertext: w.expected, p_ciphertext: s.ciphertext, p_iv: s.iv, p_auth_tag: s.authTag,
        p_key_version: s.keyVersion, p_lookup_hmac: w.plan.lookupHmac, p_hmac_key_version: w.plan.hmacKeyVersion,
      });
      if (error) throw new Error(`Falha ao recifrar (${error.code ?? "erro"}).`);
      if (data === true) counts.reencrypted++;
      else counts.conflicts++;
    } else if (w.plan.kind === "current" && w.readState !== "ok") {
      const { data, error } = await service.rpc("mark_partner_document_state", { p_business_id: w.id, p_state: "ok", p_actor: null });
      if (error) throw new Error(`Falha ao marcar estado (${error.code ?? "erro"}).`);
      if (data === true) counts.restored++;
    } else if (w.plan.kind === "failed" && !counts.aborted) {
      const { data, error } = await service.rpc("mark_partner_document_state", { p_business_id: w.id, p_state: w.plan.state, p_actor: null });
      if (error) throw new Error(`Falha ao marcar estado (${error.code ?? "erro"}).`);
      if (data === true) counts.marked++;
    }
  }
  return counts;
}
