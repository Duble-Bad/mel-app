import { randomBytes } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { partnerInputSchema, partnerRecord } from "@mel/core";
import { openPii, parsePiiKeyring, partnerCpfAad, type PiiKeyring } from "../../../apps/web/lib/pii/crypto";
import { type CpfDeps, readPartnerCpf, writePartnerCpf } from "../../../apps/web/lib/pii/partnerCpf";
import { rotatePartnerDocuments } from "../../../scripts/lib/pii-rotation.mjs";
import {
  canRevealPartnerDocuments,
  getPartnerDocument,
  logPartnerDocumentAccess,
  markPartnerDocumentState,
  partnerDocumentHmacExists,
  recentDuplicateRejections,
  savePartnerDocument,
} from "../src/partnerDocuments";
import { getMyPersonalData, setMySeekerWhatsapp, updateMyPartnerContact } from "../src/personalData";
import { createPartner, getBusiness, reviewBusiness } from "../src/partners";
import { anonClient, createTestUser, serviceClient } from "./helpers";

// Segurança e qualidade de dados pessoais (decisão do proprietário, 2026-11-06):
// CPF só para titular e ADMIN autorizado; ilegível/indisponível sem perder a
// conta; perda de chave; rotação; duplicidade entre versões; correção pelo
// titular; troca de e-mail. Região própria (Florianópolis).
const FLN = { lat: -27.5953778, lng: -48.5480499 };
const key = () => randomBytes(32).toString("base64");

function randomCpf(): string {
  const d = Array.from({ length: 9 }, () => Math.floor(Math.random() * 10));
  for (const len of [9, 10]) {
    const sum = d.slice(0, len).reduce((acc, n, i) => acc + n * (len + 1 - i), 0);
    d.push(((sum * 10) % 11) % 10);
  }
  return d.join("");
}

// Chaves efêmeras (nada do ambiente). v1 = antes da rotação.
const E1 = key();
const H1 = key();
const ringV1 = parsePiiKeyring({ MEL_PII_ENC_KEY: E1, MEL_PII_HMAC_KEY: H1 })!;
const E2 = key();
const H2 = key();
const ringV2 = parsePiiKeyring({
  MEL_PII_ENC_KEY: E2, MEL_PII_ENC_KEY_VERSION: "2", MEL_PII_ENC_KEYS_PREVIOUS: `1:${E1}`,
  MEL_PII_HMAC_KEY: H2, MEL_PII_HMAC_KEY_VERSION: "2", MEL_PII_HMAC_KEYS_PREVIOUS: `1:${H1}`,
})!;

const deps = (): CpfDeps => {
  const s = serviceClient();
  return {
    save: (d) => savePartnerDocument(s, d),
    hmacExists: (l, except) => partnerDocumentHmacExists(s, l, except),
    duplicateRejections: (a) => recentDuplicateRejections(s, a),
    logDuplicate: (a) => logPartnerDocumentAccess(s, { businessId: null, businessCode: null, actorId: a, action: "duplicate_rejected" }),
    markState: (b, st, a) => markPartnerDocumentState(s, b, st, a),
  };
};

type U = Awaited<ReturnType<typeof createTestUser>>;
let owner: U, other: U, moderator: U, admin: U;

const independent = () =>
  partnerRecord(
    partnerInputSchema.parse({
      kind: "independent",
      name: "Protetora da Ilha Teste",
      description: "Resgato cães e gatos no bairro e tenho lar temporário para três animais.",
      position: FLN,
      neighborhood: "Trindade",
      city: "Florianópolis – SC",
      cpf: randomCpf(),
    }),
  );

async function newProtector(u: U, ring: PiiKeyring, cpf = randomCpf()) {
  const p = await createPartner(u.client, u.id, independent());
  const out = await writePartnerCpf(deps(), ring, { businessId: p.id, actorId: u.id, cpf, mode: "signup" });
  expect(out).toEqual({ ok: true, result: "stored" });
  return { ...p, cpf };
}

async function statusOf(id: string) {
  const { data } = await serviceClient().from("businesses").select("status").eq("id", id).single();
  return (data as { status: string }).status;
}

beforeAll(async () => {
  [owner, other, moderator, admin] = (await Promise.all(["pii-owner", "pii-other", "pii-mod", "pii-admin"].map((l) => createTestUser(l)))) as [U, U, U, U];
  await serviceClient().from("profiles").update({ role: "moderator" } as never).eq("id", moderator.id);
  await serviceClient().from("profiles").update({ role: "admin" } as never).eq("id", admin.id);
});

afterAll(async () => {
  await Promise.all([owner, other, moderator, admin].map((u) => u?.cleanup()));
});

describe("CPF: admin-only reveal, moderation sees only the state", () => {
  it("grants only for admins (DB trigger); moderators never, even with an old grant; admin needs the grant too", async () => {
    const s = serviceClient();
    const { error: modGrant } = await s.from("pii_access_grants").insert({ user_id: moderator.id } as never);
    expect(modGrant?.message).toContain("Só administradores podem receber acesso ao CPF");
    expect(await canRevealPartnerDocuments(s, admin.id)).toEqual({ moderator: true, admin: true, granted: false });
    const { error: adminGrant } = await s.from("pii_access_grants").insert({ user_id: admin.id, note: "teste" } as never);
    expect(adminGrant).toBeNull();
    expect(await canRevealPartnerDocuments(s, admin.id)).toEqual({ moderator: true, admin: true, granted: true });
    expect(await canRevealPartnerDocuments(s, moderator.id)).toMatchObject({ granted: false });
  });

  it("moderation reads the masked state (informado/ilegível/pendente), never the number, ciphertext or HMAC", async () => {
    const p = await newProtector(owner, ringV1);
    const asMod = (await getBusiness(moderator.client, p.code))!;
    expect(asMod.private).toMatchObject({ hasDocument: true, documentState: "ok" });
    const { data } = await moderator.client.rpc("get_business", { p_code: p.code });
    const text = JSON.stringify(data);
    for (const s of [p.cpf, "ciphertext", "lookup_hmac", "auth_tag", "\"iv\"", "key_version"]) expect(text).not.toContain(s);
    // Nem moderador nem dono leem a tabela de documentos; nem chamam as RPCs do servidor.
    for (const c of [moderator.client, owner.client, admin.client]) {
      expect((await c.from("partner_documents").select("*")).data ?? []).toEqual([]);
      const { error } = await c.rpc("save_partner_document", {
        p_business_id: p.id, p_actor: owner.id, p_ciphertext: "AAAA", p_iv: "AAAAAAAAAAAAAAAA", p_auth_tag: "AAAAAAAAAAAAAAAAAAAAAA==",
        p_key_version: 1, p_lookups: [{ v: 1, h: "0".repeat(64) }] as never, p_mode: "change",
      });
      expect(error).not.toBeNull();
      expect((await c.rpc("mark_partner_document_state", { p_business_id: p.id, p_state: "ok", p_actor: owner.id })).error).not.toBeNull();
    }
    await serviceClient().from("businesses").delete().eq("id", p.id);
  });
});

describe("CPF preservation and recovery", () => {
  it("corrupted data → 'ilegível': marked, never deleted; account kept; approval refused (RPC and direct UPDATE); holder re-registers → back to review", async () => {
    const p = await newProtector(owner, ringV1);
    await reviewBusiness(moderator.client, p.code, true);
    expect(await statusOf(p.id)).toBe("APPROVED");

    // Corrompe a tag (simula dado danificado no banco/backup).
    await serviceClient().from("partner_documents").update({ auth_tag: Buffer.alloc(16, 9).toString("base64") } as never).eq("business_id", p.id);
    const doc = (await getPartnerDocument(serviceClient(), p.id))!;
    expect(await readPartnerCpf(deps(), ringV1, doc, owner.id)).toEqual({ ok: false, state: "unreadable" });
    expect((await getPartnerDocument(serviceClient(), p.id))!.readState).toBe("unreadable");
    const { data: log } = await serviceClient().from("partner_document_access_log").select("action").eq("business_id", p.id);
    expect(log).toContainEqual({ action: "marked_unreadable" });
    // Conta e cadastro continuam; aprovação existente não é apagada.
    expect((await serviceClient().from("profiles").select("id").eq("id", owner.id)).data).toHaveLength(1);
    expect(await statusOf(p.id)).toBe("APPROVED");
    expect((await getBusiness(moderator.client, p.code))!.private!.documentState).toBe("unreadable");
    const mine = await getMyPersonalData(owner.client);
    expect(mine.partners.find((x) => x.code === p.code)).toMatchObject({ documentState: "unreadable" });

    // Re-cadastro pelo titular: volta para análise (aprovação NÃO é transferida) e fica auditado sem valor.
    const newCpf = randomCpf();
    expect(await writePartnerCpf(deps(), ringV1, { businessId: p.id, actorId: owner.id, cpf: newCpf, mode: "change" })).toEqual({ ok: true, result: "re_registered" });
    expect(await statusOf(p.id)).toBe("PENDING_REVIEW");
    const fresh = (await getPartnerDocument(serviceClient(), p.id))!;
    expect(fresh.readState).toBe("ok");
    expect(openPii(ringV1, fresh, partnerCpfAad(p.id))).toBe(newCpf);
    const { data: audit } = await owner.client.from("personal_data_changes").select("subject, subject_ref, field, action").eq("subject_ref", p.code);
    expect(audit).toContainEqual({ subject: "partner", subject_ref: p.code, field: "cpf", action: "re_registered" });
    expect(JSON.stringify(audit)).not.toContain(newCpf);

    // Ilegível de novo: a moderação não aprova nem pela RPC nem por UPDATE direto.
    await serviceClient().from("partner_documents").update({ ciphertext: "AAAA" } as never).eq("business_id", p.id);
    await readPartnerCpf(deps(), ringV1, (await getPartnerDocument(serviceClient(), p.id))!, null);
    await expect(reviewBusiness(moderator.client, p.code, true)).rejects.toThrow("CPF ilegível ou indisponível");
    // (UPDATE direto: barrado pelos privilégios e, por trás, pelo trigger que exige CPF legível.)
    const { error: direct } = await moderator.client.from("businesses").update({ status: "APPROVED" } as never).eq("id", p.id);
    expect(direct).not.toBeNull();
    expect(await statusOf(p.id)).toBe("PENDING_REVIEW");
    await serviceClient().from("businesses").delete().eq("id", p.id);
  });

  it("simulated loss of key access: wrong-key run aborts without marking; forced run marks 'indisponível'; account preserved; re-registration works and never transfers approval", async () => {
    const p = await newProtector(owner, ringV1);
    await reviewBusiness(moderator.client, p.code, true);
    // Ambiente sem a chave v1 (perdida): só a v3.
    const lost = parsePiiKeyring({ MEL_PII_ENC_KEY: key(), MEL_PII_ENC_KEY_VERSION: "3", MEL_PII_HMAC_KEY: key(), MEL_PII_HMAC_KEY_VERSION: "3" })!;
    const dry = await rotatePartnerDocuments({ service: serviceClient(), ring: lost, apply: true, businessIds: [p.id] });
    expect(dry).toMatchObject({ total: 1, key_unavailable: 1, marked: 0, aborted: true });
    expect((await getPartnerDocument(serviceClient(), p.id))!.readState).toBe("ok");
    const forced = await rotatePartnerDocuments({ service: serviceClient(), ring: lost, apply: true, forceMark: true, businessIds: [p.id] });
    expect(forced).toMatchObject({ marked: 1 });
    expect((await getPartnerDocument(serviceClient(), p.id))!.readState).toBe("key_unavailable");
    expect(await statusOf(p.id)).toBe("APPROVED");
    expect((await serviceClient().from("profiles").select("id").eq("id", owner.id)).data).toHaveLength(1);

    // Re-cadastro com a chave nova (o mesmo CPF é aceito para o próprio cadastro).
    expect(await writePartnerCpf(deps(), lost, { businessId: p.id, actorId: owner.id, cpf: p.cpf, mode: "change" })).toEqual({ ok: true, result: "re_registered" });
    expect(await statusOf(p.id)).toBe("PENDING_REVIEW");
    const doc = (await getPartnerDocument(serviceClient(), p.id))!;
    expect(doc).toMatchObject({ keyVersion: 3, hmacKeyVersion: 3, readState: "ok" });
    expect(openPii(lost, doc, partnerCpfAad(p.id))).toBe(p.cpf);
    await serviceClient().from("businesses").delete().eq("id", p.id);
  });

  it("key rotation without data loss: v1 → v2 re-encrypts and re-HMACs; duplicates are caught across HMAC versions during the rotation", async () => {
    const p = await newProtector(owner, ringV1);
    // Durante a rotação (ambiente já em v2, linha ainda em v1): mesmo CPF em outro cadastro é recusado.
    const second = await createPartner(other.client, other.id, independent());
    const dup = await writePartnerCpf(deps(), ringV2, { businessId: second.id, actorId: other.id, cpf: p.cpf, mode: "signup" });
    expect(dup).toMatchObject({ ok: false, status: 409 });
    // Também na garantia final da RPC (sem o pré-cheque), sob trava.
    await expect(
      writePartnerCpf({ ...deps(), hmacExists: async () => false }, ringV2, { businessId: second.id, actorId: other.id, cpf: p.cpf, mode: "signup" }),
    ).resolves.toMatchObject({ ok: false, status: 409 });

    const plan = await rotatePartnerDocuments({ service: serviceClient(), ring: ringV2, businessIds: [p.id] });
    expect(plan).toMatchObject({ total: 1, toReencrypt: 1, reencrypted: 0 });
    expect((await getPartnerDocument(serviceClient(), p.id))!.keyVersion).toBe(1);
    const applied = await rotatePartnerDocuments({ service: serviceClient(), ring: ringV2, apply: true, businessIds: [p.id] });
    expect(applied).toMatchObject({ reencrypted: 1, aborted: false });
    const doc = (await getPartnerDocument(serviceClient(), p.id))!;
    expect(doc).toMatchObject({ keyVersion: 2, hmacKeyVersion: 2 });
    expect(openPii(ringV2, doc, partnerCpfAad(p.id))).toBe(p.cpf);
    // Depois da rotação, as chaves antigas podem sair do ambiente: a linha abre só com as atuais.
    const currentOnly = parsePiiKeyring({ MEL_PII_ENC_KEY: E2, MEL_PII_ENC_KEY_VERSION: "2", MEL_PII_HMAC_KEY: H2, MEL_PII_HMAC_KEY_VERSION: "2" })!;
    expect(openPii(currentOnly, doc, partnerCpfAad(p.id))).toBe(p.cpf);
    // E a duplicidade continua valendo na versão nova.
    expect(await writePartnerCpf(deps(), ringV2, { businessId: second.id, actorId: other.id, cpf: p.cpf, mode: "signup" })).toMatchObject({ ok: false, status: 409 });
    // Rodar de novo não muda nada.
    expect(await rotatePartnerDocuments({ service: serviceClient(), ring: ringV2, apply: true, businessIds: [p.id] })).toMatchObject({ current: 1, reencrypted: 0 });
    await serviceClient().from("businesses").delete().in("id", [p.id, second.id]);
  });
});

describe("correction by the holder", () => {
  it("my_personal_data: only the holder's own data; anon refused; profiles keeps no e-mail copy", async () => {
    const p = await newProtector(owner, ringV1);
    const mine = await getMyPersonalData(owner.client);
    expect(mine.partners.map((x) => x.code)).toContain(p.code);
    expect(mine.account.email).toMatch(/^test\+pii-owner-/);
    expect((await getMyPersonalData(other.client)).partners.map((x) => x.code)).not.toContain(p.code);
    expect((await anonClient().rpc("my_personal_data")).error).not.toBeNull();
    const { error } = await owner.client.from("profiles").select("email" as never).eq("id", owner.id);
    expect(error).not.toBeNull();
    await serviceClient().from("businesses").delete().eq("id", p.id);
  });

  it("CNPJ change: validated in the DB, verification back to pending, approved partner back to review, audited without values", async () => {
    const record = partnerRecord(
      partnerInputSchema.parse({
        kind: "company", name: "Pet Ilha Teste", category: "petshop", legalName: "Pet Ilha Teste Ltda",
        description: "Banho, tosa e leitor de microchip para animais encontrados no bairro.", addressLabel: "Rua Lauro Linhares, 100 – Trindade",
        position: FLN, phone: "(48) 3333-4444", cnpj: "11.222.333/0001-81",
      }),
    );
    const b = await createPartner(owner.client, owner.id, record);
    await serviceClient().from("business_cnpj_checks").update({ status: "VERIFIED", source: "teste" } as never).eq("business_id", b.id);
    await reviewBusiness(moderator.client, b.code, true);
    await expect(updateMyPartnerContact(owner.client, b.code, { cnpj: "11222333000182" })).rejects.toThrow("Confira os 14 caracteres do CNPJ");
    await expect(updateMyPartnerContact(other.client, b.code, { cnpj: "12ABC34501DE35" })).rejects.toThrow();
    await updateMyPartnerContact(owner.client, b.code, { cnpj: "12ABC34501DE35" });
    const after = (await getBusiness(owner.client, b.code))!;
    expect(after).toMatchObject({ status: "PENDING_REVIEW", cnpjVerified: false });
    expect(after.private!.cnpjStatus).toBe("PENDING");

    // Telefone: o banco recusa DDD inexistente e celular sem 9 (mesmo sem o app).
    await expect(updateMyPartnerContact(owner.client, b.code, { phone: "2333334444" })).rejects.toThrow("Telefone inválido");
    await expect(updateMyPartnerContact(owner.client, b.code, { whatsapp: "48887654321" })).rejects.toThrow("Telefone inválido");
    await updateMyPartnerContact(owner.client, b.code, { whatsapp: "48987654321" });

    const { data: audit } = await owner.client.from("personal_data_changes").select("field, action, subject_ref").eq("subject_ref", b.code);
    expect(audit).toEqual(expect.arrayContaining([{ field: "cnpj", action: "changed", subject_ref: b.code }, { field: "whatsapp", action: "changed", subject_ref: b.code }]));
    const text = JSON.stringify(audit);
    for (const v of ["12ABC34501DE35", "11222333000181", "48987654321", "4333"]) expect(text).not.toContain(v);
    // Auditoria: só o titular (e admin) lê; ninguém grava direto.
    expect((await other.client.from("personal_data_changes").select("id").eq("subject_ref", b.code)).data).toEqual([]);
    expect((await moderator.client.from("personal_data_changes").select("id").eq("subject_ref", b.code)).data).toEqual([]);
    expect((await admin.client.from("personal_data_changes").select("id").eq("subject_ref", b.code)).data!.length).toBeGreaterThan(0);
    const { error: forged } = await owner.client.from("personal_data_changes").insert({ actor_id: owner.id, subject: "account", field: "email", action: "changed" } as never);
    expect(forged).not.toBeNull();
    await serviceClient().from("businesses").delete().eq("id", b.id);
  });

  it("adoption seeker WhatsApp: validated by the same rule; needs a registration", async () => {
    await expect(setMySeekerWhatsapp(other.client, "(23) 99999-0000")).rejects.toThrow("Telefone inválido");
    await expect(setMySeekerWhatsapp(other.client, "(48) 99999-0000")).rejects.toThrow("Você ainda não cadastrou seu interesse");
  });

  it("e-mail change: pending state comes from Supabase Auth (no e-mail sent here); the account e-mail only changes after confirmation", async () => {
    const admin_ = serviceClient().auth.admin;
    const { data: u } = await admin_.getUserById(owner.id);
    const current = u.user!.email!;
    const next = `test+pii-novo-${randomBytes(4).toString("hex")}@exemplo.com`;
    // generateLink cria o pedido de troca sem enviar e-mail (o envio no mel-dev é limitado a 2/h).
    const { error } = await admin_.generateLink({ type: "email_change_new", email: current, newEmail: next });
    expect(error).toBeNull();
    const mine = await getMyPersonalData(owner.client);
    expect(mine.account.email).toBe(current);
    expect(mine.account.emailPending).toBe(next);
  });
});
