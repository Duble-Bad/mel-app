// Anti-abuso com sessões anônimas descartáveis. Ataques (A–F) e um alerta
// viral legítimo: trocar de uuid não torna as proteções inúteis, e a pista
// sempre chega. "Anônimo" aqui = perfil com is_anonymous (é o que o banco
// usa); duas sessões anônimas reais confirmam o caminho de verdade.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { foundInputSchema, guardianSettingsSchema, petInputSchema, sightingInputSchema } from "@mel/core";
import { ensureSession } from "../src/auth";
import { sendMessage, setConversationBlocked, startConversation } from "../src/chat";
import { createFoundCase } from "../src/found";
import { saveGuardianSettings } from "../src/guardian";
import { activateLostCase, startLostCase, updateLostCase } from "../src/lostCases";
import { reportContent } from "../src/moderation";
import { createPet } from "../src/pets";
import { createSighting, getTimeline } from "../src/sightings";
import { anonClient, createTestUser, serviceClient } from "./helpers";
import type { MelClient } from "../src/client";

// Região própria (Curitiba) para não cruzar com outros testes.
const CWB = { lat: -25.4284, lng: -49.2733 };
const near = (d: number) => ({ lat: CWB.lat + d, lng: CWB.lng + d });
const minutesAgo = (m: number) => new Date(Date.now() - m * 60_000).toISOString();
const PET = { species: "dog", size: "medium", sex: "male", colorPrimary: "preto", breed: "Vira-lata" } as const;
const PNG = Uint8Array.from(atob("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="), (c) => c.charCodeAt(0));
const png = () => new Blob([PNG], { type: "image/png" });

type U = Awaited<ReturnType<typeof createTestUser>>;
let tutor: U, guardian: U, account: U;
const crowd: U[] = []; // 21 "sessões anônimas" diferentes
const realAnon: { id: string; client: MelClient }[] = [];
const uploaded: string[] = [];

async function anonymous(label: string): Promise<U> {
  const u = await createTestUser(label);
  await serviceClient().from("profiles").update({ is_anonymous: true } as never).eq("id", u.id);
  return u;
}

async function realAnonymous() {
  const client = anonClient();
  const user = await ensureSession(client);
  const s = { id: user.id, client };
  realAnon.push(s);
  return s;
}

async function alert(name: string) {
  const pet = await createPet(tutor.client, tutor.id, petInputSchema.parse({ name, ...PET }));
  const c = await startLostCase(tutor.client, tutor.id, pet.id);
  await updateLostCase(tutor.client, c.id, { lastSeen: CWB, lostAt: minutesAgo(120), publicAreaLabel: "Centro, Curitiba – PR", contactChat: true });
  const a = await activateLostCase(tutor.client, c.id);
  return { id: a.id, code: a.code };
}

async function upload(client: MelClient, id: string) {
  const path = `${id}/${crypto.randomUUID()}.png`;
  const { error } = await client.storage.from("sighting-media").upload(path, png(), { contentType: "image/png" });
  if (!error) uploaded.push(path);
  return { path, error };
}

const sighting = (code: string, o: Record<string, unknown> = {}) =>
  sightingInputSchema.parse({ code, position: near(0.003), seenAt: minutesAgo(15), notes: "Vi na praça.", ...o });
const found = (d = 0.004) =>
  foundInputSchema.parse({ ...PET, breedGuess: PET.breed, position: near(d), areaLabel: "Centro, Curitiba – PR", foundAt: minutesAgo(10), custody: "with_me" });

const unread = async (userId: string, kind: string) =>
  (await serviceClient().from("notifications").select("payload").eq("user_id", userId).eq("kind", kind).is("read_at", null)).data ?? [];
const abuseEvents = async (rule: string, actor: string) =>
  (await serviceClient().from("events").select("props").eq("name", "abuse_guard").eq("user_id", actor)).data?.filter((e) => (e.props as { rule: string }).rule === rule) ?? [];

beforeAll(async () => {
  [tutor, guardian, account] = await Promise.all([createTestUser("aa-tutor"), createTestUser("aa-guardian"), createTestUser("aa-account")]);
  for (let i = 0; i < 21; i += 7) crowd.push(...(await Promise.all(Array.from({ length: 7 }, (_, k) => anonymous(`aa-anon-${i + k}`)))));
  await saveGuardianSettings(guardian.client, guardian.id, guardianSettingsSchema.parse({ area: CWB, radiusM: 5000, alertLost: false, alertFound: true, maxPerDay: 10 }));
}, 120_000);

afterAll(async () => {
  for (let i = 0; i < uploaded.length; i += 100) await serviceClient().storage.from("sighting-media").remove(uploaded.slice(i, i + 100));
  for (const s of realAnon) await serviceClient().auth.admin.deleteUser(s.id);
  await Promise.all([tutor, guardian, account, ...crowd].map((u) => u?.cleanup()));
}, 120_000);

describe("Ataque A: uma sessão anônima repete a mesma ação", () => {
  it("avistamentos: o limite da sessão vale e a mensagem é amigável (sessão anônima real)", async () => {
    const a = await alert("Repete");
    const s = await realAnonymous();
    for (let i = 0; i < 3; i++) await createSighting(s.client, sighting(a.code, { seenAt: minutesAgo(20 + i) }));
    await expect(createSighting(s.client, sighting(a.code))).rejects.toThrow("Você já enviou avistamentos para este alerta agora há pouco. Obrigado!");
  });

  it("upload: no máximo 3 fotos sem envio por sessão; usar a foto num avistamento libera outra", async () => {
    const a = await alert("Fotos");
    const s = await realAnonymous();
    const ok = [await upload(s.client, s.id), await upload(s.client, s.id), await upload(s.client, s.id)];
    expect(ok.map((r) => r.error)).toEqual([null, null, null]);
    expect((await upload(s.client, s.id)).error).not.toBeNull();
    await createSighting(s.client, sighting(a.code, { photoPath: ok[0]!.path }));
    expect((await upload(s.client, s.id)).error).toBeNull();
  });
});

describe("Ataques B e C: muitas sessões contra o mesmo alerta/tutor", () => {
  it("conversas: até 20 sessões anônimas por hora; a 21ª recebe aviso amigável; avistamento e contas continuam", async () => {
    const a = await alert("Conversas");
    for (const u of crowd.slice(0, 20)) await startConversation(u.client, a.code, `Oi, acho que vi o pet (${u.id.slice(0, 4)}).`);
    const last = crowd[20]!;
    await expect(startConversation(last.client, a.code, "Vi o pet!")).rejects.toThrow(/Muitas pessoas estão escrevendo para este tutor agora/);
    // A pista da mesma pessoa continua chegando…
    await expect(createSighting(last.client, sighting(a.code))).resolves.toBeTruthy();
    // …e quem tem conta continua falando com o tutor.
    await expect(startConversation(account.client, a.code, "Tenho uma pista.")).resolves.toBeTruthy();
    // Conversa já aberta segue normal para quem estava dentro do teto.
    const { data: conv } = await serviceClient().from("conversations").select("id").eq("lost_case_id", a.id).eq("helper_id", crowd[0]!.id).single();
    await expect(sendMessage(crowd[0]!.client, conv!.id, crowd[0]!.id, "Era um cachorro preto, coleira azul.")).resolves.toBeTruthy();
  });

  it("denúncias: a partir de 5 anônimas abertas sobre o mesmo conteúdo, as seguintes são agrupadas sem erro", async () => {
    const a = await alert("Denunciado");
    const ids = [];
    for (const u of crowd.slice(0, 7)) ids.push(await reportContent(u.client, { type: "lost_case", key: a.code }, { reason: "spam", details: null }));
    const { data: rows } = await serviceClient().from("reports").select("id").eq("target_id", a.id);
    expect(rows).toHaveLength(5);
    expect(new Set(ids).size).toBe(5); // as duas últimas devolvem uma denúncia existente
    expect(await abuseEvents("report_folded", crowd[6]!.id)).toHaveLength(1);
    // Conta continua registrando a própria denúncia.
    await reportContent(account.client, { type: "lost_case", key: a.code }, { reason: "scam", details: null });
    expect((await serviceClient().from("reports").select("id").eq("target_id", a.id)).data).toHaveLength(6);
  });
});

describe("Ataque D: spam de conversa/mensagem", () => {
  it("mensagem idêntica repetida é recusada; mensagens diferentes passam; bloqueio continua valendo", async () => {
    const a = await alert("Mensagens");
    const spammer = crowd[1]!;
    const convId = await startConversation(spammer.client, a.code, "COMPRE AGORA");
    await expect(sendMessage(spammer.client, convId, spammer.id, "COMPRE AGORA")).rejects.toThrow("Você acabou de enviar esta mesma mensagem.");
    await expect(sendMessage(spammer.client, convId, spammer.id, "Vi o pet perto do mercado.")).resolves.toBeTruthy();
    await setConversationBlocked(tutor.client, convId, true);
    await expect(sendMessage(spammer.client, convId, spammer.id, "outra coisa")).rejects.toThrow("Esta conversa não aceita novas mensagens.");
    // O tutor recebe UM aviso por conversa, não um por mensagem.
    const msgs = (await unread(tutor.id, "message_new")).filter((n) => (n.payload as { conversation_id: string }).conversation_id === convId);
    expect(msgs).toHaveLength(1);
  });
});

describe("Ataque E: spam de upload", () => {
  it("só imagem pequena, com nome de arquivo do app, na própria pasta", async () => {
    const u = crowd[2]!;
    const bad = [
      await u.client.storage.from("sighting-media").upload(`${u.id}/qualquer-nome.png`, png(), { contentType: "image/png" }),
      await u.client.storage.from("sighting-media").upload(`${u.id}/${crypto.randomUUID()}.html`, new Blob(["<h1>x</h1>"], { type: "text/html" }), { contentType: "text/html" }),
      await u.client.storage.from("sighting-media").upload(`${u.id}/${crypto.randomUUID()}.png`, new Blob([new Uint8Array(2 * 1024 * 1024 + 1)], { type: "image/png" }), { contentType: "image/png" }),
    ];
    expect(bad.map((r) => r.error !== null)).toEqual([true, true, true]);
  });

  it("trocar de sessão não dá armazenamento ilimitado: 60 fotos sem envio por hora somando as anônimas", async () => {
    // 20 sessões × 3 fotos sem envio = 60; a próxima sessão anônima (sem nada pendente) já não consegue.
    const results = await Promise.all(crowd.slice(0, 20).map(async (u) => [await upload(u.client, u.id), await upload(u.client, u.id), await upload(u.client, u.id)]));
    const okCount = results.flat().filter((r) => !r.error).length;
    expect(okCount).toBeGreaterThanOrEqual(57); // outras sessões anônimas do mesmo teste podem ter pendências
    expect((await upload(crowd[20]!.client, crowd[20]!.id)).error).not.toBeNull();
    // Quem tem conta não entra no teto das anônimas.
    expect((await upload(account.client, account.id)).error).toBeNull();
    // Libera para os outros testes: apaga as fotos órfãs desta rodada.
    const mine = results.flat().filter((r) => !r.error).map((r) => r.path);
    await serviceClient().storage.from("sighting-media").remove(mine);
  });
});

describe("Ataque F: tempestade de notificações/push", () => {
  it("Guardião: no máximo 2 avisos por dia vindos de autores anônimos; o encontrado é publicado mesmo assim", async () => {
    const before = (await unread(guardian.id, "guardian_alert")).length;
    const codes = [];
    for (const u of crowd.slice(3, 7)) codes.push(await createFoundCase(u.client, u.id, found(0.004 + codes.length * 0.001)));
    expect(codes).toHaveLength(4); // tudo publicado
    const alerts = await unread(guardian.id, "guardian_alert");
    expect(alerts.length - before).toBe(2);
    expect((await serviceClient().from("push_outbox").select("id").eq("user_id", guardian.id)).data?.length).toBe(2);
    expect((await abuseEvents("guardian_anon_budget", crowd[5]!.id)).length + (await abuseEvents("guardian_anon_budget", crowd[6]!.id)).length).toBe(2);
    // Encontrado de quem tem conta ainda chega ao Guardião.
    await createFoundCase(account.client, account.id, found(0.01));
    expect((await unread(guardian.id, "guardian_alert")).length - before).toBe(3);
  });

  it("Radar: o tutor recebe UM aviso de correspondência por alerta, com contador", async () => {
    const a = await alert("Radar");
    for (const u of crowd.slice(7, 10)) await createFoundCase(u.client, u.id, found(0.002));
    const owner = (await unread(tutor.id, "match_new")).filter((n) => (n.payload as { lost_code: string }).lost_code === a.code);
    const matches = (await serviceClient().from("case_matches").select("id").eq("lost_case_id", a.id)).data ?? [];
    expect(matches.length).toBeGreaterThanOrEqual(3); // os 3 novos (e os encontrados anteriores deste arquivo)
    expect(owner).toHaveLength(1);
    expect((owner[0]!.payload as { count: number }).count).toBe(matches.length);
  });
});

describe("Caso legítimo: alerta viral com muita gente ajudando", () => {
  it("todas as pistas (com foto) chegam; o tutor vê tudo na linha do tempo e recebe UM aviso agrupado", async () => {
    const a = await alert("Viral");
    const helpers = [...crowd, account];
    const ids = await Promise.all(
      helpers.map(async (u, i) => {
        const photo = await upload(u.client, u.id);
        expect(photo.error).toBeNull();
        return createSighting(u.client, sighting(a.code, { seenAt: minutesAgo(5 + i), photoPath: photo.path, position: near(0.001 * (i % 5)) }));
      }),
    );
    expect(ids).toHaveLength(22);
    expect((await getTimeline(tutor.client, a.code)).length).toBe(22);
    const bell = (await unread(tutor.id, "sighting_new")).filter((n) => (n.payload as { code: string }).code === a.code);
    expect(bell).toHaveLength(1);
    expect((bell[0]!.payload as { count: number }).count).toBe(22);
    // Várias pessoas sem cadastro conversando com o tutor ao mesmo tempo.
    for (const u of crowd.slice(10, 15)) await expect(startConversation(u.client, a.code, "Vi agora na rua XV.")).resolves.toBeTruthy();
  });
});
