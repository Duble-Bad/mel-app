import { randomBytes } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { partnerInputSchema, partnerRecord } from "@mel/core";
import { openPii, parsePiiKeyring, partnerCpfAad, piiLookupHmac, sealPii } from "../../../apps/web/lib/pii/crypto";
import { canViewPartnerDocuments, getPartnerDocument, logPartnerDocumentAccess, storePartnerDocument } from "../src/partnerDocuments";
import { createPartner, getBusiness, listBusinesses, reviewBusiness } from "../src/partners";
import { anonClient, createTestUser, serviceClient } from "./helpers";

// Privacidade dos documentos de parceiros (decisões 8–10). Região própria (Curitiba).
const CWB = { lat: -25.4284567, lng: -49.2732891 };
// Chaves efêmeras, geradas aqui: nada vem do ambiente.
const ring = parsePiiKeyring({ MEL_PII_ENC_KEY: randomBytes(32).toString("base64"), MEL_PII_HMAC_KEY: randomBytes(32).toString("base64") })!;
// CPF válido gerado por execução (não colide com outras rodadas no índice único).
function randomCpf(): string {
  const d = Array.from({ length: 9 }, () => Math.floor(Math.random() * 10));
  for (const len of [9, 10]) {
    const sum = d.slice(0, len).reduce((acc, n, i) => acc + n * (len + 1 - i), 0);
    d.push(((sum * 10) % 11) % 10);
  }
  return d.join("");
}
const CPF = randomCpf();
const SENSITIVE = ["ciphertext", "lookup_hmac", "auth_tag", "cpf", "legal_name", "responsible_name", CPF];

type U = Awaited<ReturnType<typeof createTestUser>>;
let owner: U, moderator: U, stranger: U;
let protetor: { code: string; id: string };
let empresa: { code: string; id: string };
let hmac: string;

const independent = () =>
  partnerInputSchema.parse({
    kind: "independent",
    name: "Protetora da Vila Teste",
    description: "Resgato gatos da região e tenho lar temporário para até quatro animais.",
    position: CWB,
    neighborhood: "Centro",
    city: "Curitiba – PR",
    cpf: CPF,
  });

async function storeCpf(businessId: string, ownerId: string, cpf = CPF) {
  const box = sealPii(ring, cpf, partnerCpfAad(businessId));
  await storePartnerDocument(serviceClient(), {
    businessId, ownerId, ciphertext: box.ciphertext, iv: box.iv, authTag: box.authTag, keyVersion: box.keyVersion,
    lookupHmac: piiLookupHmac(ring, "cpf", cpf), hmacKeyVersion: ring.hmacVersion,
  });
}

beforeAll(async () => {
  const users = await Promise.all(["pd-owner", "pd-mod", "pd-stranger"].map((l) => createTestUser(l)));
  [owner, moderator, stranger] = users as [U, U, U];
  await serviceClient().from("profiles").update({ role: "moderator" } as never).eq("id", moderator.id);
  hmac = piiLookupHmac(ring, "cpf", CPF);
});

afterAll(async () => {
  await Promise.all([owner, moderator, stranger].map((u) => u?.cleanup()));
});

describe("partner documents: privacy", () => {
  it("independent protector: only neighborhood/city and a ~1 km point are stored; no CNPJ allowed", async () => {
    protetor = await createPartner(owner.client, owner.id, partnerRecord(independent()));
    const { data } = await serviceClient().from("businesses").select("lat, lng, address_label, cnpj, partner_kind").eq("id", protetor.id).single();
    expect(data).toEqual({ lat: -25.43, lng: -49.27, address_label: "Centro, Curitiba – PR", cnpj: null, partner_kind: "independent" });
    // Direto no banco (sem o app): CNPJ em protetor é recusado; o tipo não muda depois.
    const { error: e1 } = await owner.client.from("businesses").update({ cnpj: "11222333000181" } as never).eq("id", protetor.id);
    expect(e1?.message).toContain("Protetor independente não informa CNPJ");
    const { error: e2 } = await owner.client.from("businesses").update({ partner_kind: "company" } as never).eq("id", protetor.id);
    expect(e2).not.toBeNull();
  });

  it("anon and authenticated (even the owner) cannot read or write the private tables", async () => {
    await storeCpf(protetor.id, owner.id);
    for (const client of [anonClient(), owner.client, stranger.client, moderator.client]) {
      const { data, error } = await client.from("partner_documents").select("*");
      expect(error?.code ?? (data ?? []).length).not.toBe(1);
      expect(data ?? []).toEqual([]);
      const { error: insertError } = await client.from("partner_documents").insert({
        business_id: protetor.id, owner_id: owner.id, ciphertext: "AAAA", iv: "AAAAAAAAAAAAAAAA", auth_tag: "AAAAAAAAAAAAAAAAAAAAAA==",
        key_version: 1, lookup_hmac: "0".repeat(64),
      } as never);
      expect(insertError).not.toBeNull();
      const { data: grants } = await client.from("pii_access_grants").select("*");
      expect(grants ?? []).toEqual([]);
      const { error: grantInsert } = await client.from("pii_access_grants").insert({ user_id: (await client.auth.getUser()).data.user?.id ?? owner.id } as never);
      expect(grantInsert).not.toBeNull();
    }
    // Só o service role lê; o cifrado abre com a chave e o AAD do próprio registro.
    const doc = (await getPartnerDocument(serviceClient(), protetor.id))!;
    expect(doc.ciphertext).not.toContain(CPF);
    expect(doc.lookupHmac).toBe(hmac);
    expect(openPii(ring, doc, partnerCpfAad(protetor.id))).toBe(CPF);
    expect(() => openPii(ring, doc, partnerCpfAad(randomBytes(8).toString("hex")))).toThrow();
  });

  it("the same CPF cannot be stored twice (unique HMAC)", async () => {
    const other = await createPartner(owner.client, owner.id, partnerRecord(independent()));
    await expect(storeCpf(other.id, owner.id)).rejects.toMatchObject({ code: "23505" });
    await serviceClient().from("businesses").delete().eq("id", other.id);
  });

  it("access log: only moderators read it; it never holds the value", async () => {
    await logPartnerDocumentAccess(serviceClient(), { businessId: protetor.id, businessCode: protetor.code, actorId: owner.id, action: "stored" });
    const { data: asStranger } = await stranger.client.from("partner_document_access_log").select("*");
    expect(asStranger).toEqual([]);
    const { data: asOwner } = await owner.client.from("partner_document_access_log").select("*");
    expect(asOwner).toEqual([]);
    const { data: asMod } = await moderator.client.from("partner_document_access_log").select("*").eq("business_id", protetor.id);
    expect(asMod!.length).toBeGreaterThan(0);
    expect(JSON.stringify(asMod)).not.toContain(CPF);
    const { error } = await moderator.client.from("partner_document_access_log").insert({ actor_id: moderator.id, action: "moderator_view" } as never);
    expect(error).not.toBeNull();
  });

  it("CPF access needs moderator role AND an explicit grant", async () => {
    expect(await canViewPartnerDocuments(serviceClient(), stranger.id)).toEqual({ moderator: false, granted: false });
    expect(await canViewPartnerDocuments(serviceClient(), moderator.id)).toEqual({ moderator: true, granted: false });
    await serviceClient().from("pii_access_grants").insert({ user_id: moderator.id, note: "teste" } as never);
    expect(await canViewPartnerDocuments(serviceClient(), moderator.id)).toEqual({ moderator: true, granted: true });
  });

  it("owner and moderator see registration data; strangers and the public never do", async () => {
    const asOwner = (await getBusiness(owner.client, protetor.code))!;
    expect(asOwner.private).toMatchObject({ hasDocument: true, cnpj: null });
    expect(await getBusiness(stranger.client, protetor.code)).toBeNull();
    // Aprovado: aparece no público sem nenhum dado sensível.
    await reviewBusiness(moderator.client, protetor.code, true);
    const raw = await anonClient().rpc("get_business", { p_code: protetor.code });
    const text = JSON.stringify(raw.data);
    for (const s of SENSITIVE) expect(text).not.toContain(s);
    expect((raw.data as { private: unknown }).private).toBeNull();
    const asStranger = (await getBusiness(stranger.client, protetor.code))!;
    expect(asStranger).toMatchObject({ kind: "independent", private: null, cnpjVerified: false, addressLabel: "Centro, Curitiba – PR" });
    const list = await listBusinesses(anonClient(), CWB, { radiusM: 3000 });
    const listed = list.find((b) => b.code === protetor.code)!;
    expect(listed.position).toEqual({ lat: -25.43, lng: -49.27 });
    expect(JSON.stringify(list)).not.toContain(CPF);
  });

  it("company: the database requires a valid CNPJ; lookup stays pending; 'verified' only with a valid lookup + approval", async () => {
    const base = {
      kind: "company", name: "Pet Shop Teste CWB", category: "petshop", legalName: "Pet Shop Teste Ltda",
      description: "Banho, tosa e leitor de microchip para animais encontrados no bairro.", addressLabel: "Rua XV de Novembro, 100 – Centro, Curitiba – PR",
      position: CWB, phone: "(41) 3333-4444",
    };
    const record = partnerRecord(partnerInputSchema.parse({ ...base, cnpj: "11.222.333/0001-81" }));
    // Sem o app: CNPJ inválido ou ausente é recusado pelo trigger.
    await expect(createPartner(owner.client, owner.id, { ...record, cnpj: "11222333000182" } as unknown as typeof record)).rejects.toThrow();
    await expect(createPartner(owner.client, owner.id, { ...record, cnpj: null } as unknown as typeof record)).rejects.toThrow();
    await expect(createPartner(owner.client, owner.id, { ...record, phone: null } as unknown as typeof record)).rejects.toThrow();
    // Formato alfanumérico (IN RFB 2.229/2024) também passa no banco.
    const alnum = await createPartner(owner.client, owner.id, { ...record, cnpj: "12ABC34501DE35" } as unknown as typeof record);
    await serviceClient().from("businesses").delete().eq("id", alnum.id);

    empresa = await createPartner(owner.client, owner.id, record);
    const { data: check } = await serviceClient().from("business_cnpj_checks").select("status, attempts, cnpj").eq("business_id", empresa.id).single();
    expect(check).toEqual({ status: "PENDING", attempts: 0, cnpj: "11222333000181" });
    // Dono não lê a fila (só a moderação); ninguém além do service role grava.
    expect((await owner.client.from("business_cnpj_checks").select("*")).data).toEqual([]);
    expect((await moderator.client.from("business_cnpj_checks").select("status").eq("business_id", empresa.id)).data).toEqual([{ status: "PENDING" }]);
    const { error } = await moderator.client.from("business_cnpj_checks").update({ status: "VERIFIED" } as never).eq("business_id", empresa.id);
    expect(error).not.toBeNull();

    const asMod = (await getBusiness(moderator.client, empresa.code))!;
    expect(asMod.private).toMatchObject({ cnpj: "11222333000181", legalName: "Pet Shop Teste Ltda", cnpjStatus: "PENDING" });
    // Consulta válida (simulada pelo service role) ainda não basta: precisa da aprovação.
    await serviceClient().from("business_cnpj_checks").update({ status: "VERIFIED", source: "teste", checked_at: new Date().toISOString() } as never).eq("business_id", empresa.id);
    expect((await getBusiness(owner.client, empresa.code))!.cnpjVerified).toBe(false);
    await reviewBusiness(moderator.client, empresa.code, true);
    const pub = (await getBusiness(anonClient(), empresa.code))!;
    expect(pub).toMatchObject({ cnpjVerified: true, private: null });
    expect(JSON.stringify(pub)).not.toContain("11222333000181");
    // Trocar o CNPJ volta para análise e para "pendente".
    await owner.client.from("businesses").update({ cnpj: "12ABC34501DE35" } as never).eq("id", empresa.id);
    const after = (await getBusiness(owner.client, empresa.code))!;
    expect(after).toMatchObject({ status: "PENDING_REVIEW", cnpjVerified: false });
    expect(after.private!.cnpjStatus).toBe("PENDING");
  });

  it("retention: rejecting a protector deletes the encrypted CPF (and logs it); no approval without a CPF", async () => {
    const second = await createPartner(owner.client, owner.id, partnerRecord(independent()));
    await expect(reviewBusiness(moderator.client, second.code, true)).rejects.toThrow("Protetor sem CPF guardado");
    await storeCpf(second.id, owner.id, randomCpf());
    await reviewBusiness(moderator.client, second.code, false, "Dados incompletos");
    expect(await getPartnerDocument(serviceClient(), second.id)).toBeNull();
    const { data } = await serviceClient().from("partner_document_access_log").select("action, actor_id").eq("business_id", second.id);
    expect(data).toContainEqual({ action: "deleted_rejected", actor_id: moderator.id });
  });

  it("retention: deleting the account deletes the encrypted CPF in cascade; the log survives without the link", async () => {
    await owner.cleanup();
    expect(await getPartnerDocument(serviceClient(), protetor.id)).toBeNull();
    const { count } = await serviceClient().from("partner_documents").select("business_id", { count: "exact", head: true }).eq("lookup_hmac", hmac);
    expect(count).toBe(0);
    const { data } = await serviceClient().from("partner_document_access_log").select("business_id, actor_id").eq("business_code", protetor.code);
    expect(data!.length).toBeGreaterThan(0);
    expect(data!.every((r) => r.business_id === null && r.actor_id === null)).toBe(true);
  });
});
