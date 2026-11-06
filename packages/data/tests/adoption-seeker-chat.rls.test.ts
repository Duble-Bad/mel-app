import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { adoptionInputSchema, seekerInputSchema } from "@mel/core";
import { createAdoption, reviewAdoption, setAdoptionStatus } from "../src/adoption";
import {
  getMyAdoptionSeeker,
  listMyListingsForSeekerContact,
  listPublicAdoptionSeekers,
  reviewAdoptionSeeker,
  saveMyAdoptionSeeker,
  setMyAdoptionSeekerContact,
  startAdoptionSeekerConversation,
} from "../src/adoptionSeekers";
import { listMyConversations, sendMessage, setConversationBlocked } from "../src/chat";
import { anonClient, createTestUser, serviceClient } from "./helpers";

// Chat com a fila "Querem adotar" (migration 20261106150000): quem pode iniciar,
// consentimento, dados mínimos, um par = uma conversa, limites e aviso.

type U = Awaited<ReturnType<typeof createTestUser>>;
let donor: U, donor2: U, moderator: U, stranger: U, sOk: U, sOk2: U, sNoConsent: U, sRejected: U, sExpired: U, sBlocker: U;
const tag = crypto.randomUUID().slice(0, 6);
const name = (s: string) => `${s}${tag}`;
const HERE = { lat: -25.4284, lng: -49.2733 };
const WHATSAPP_DIGITS = "41988887777";
let L1: string, L2: string, L3: string, pendingCode: string, closedCode: string;
const refs = new Map<string, string>();

const seeker = (o: Record<string, unknown> = {}) =>
  seekerInputSchema.parse({
    species: "dog",
    sizes: [],
    ages: [],
    area: HERE,
    areaLabel: "Centro, Curitiba – PR",
    radiusM: 3000,
    housing: "apartment",
    otherPets: "none",
    routine: "Trabalho em casa e passeio com calma todos os dias.",
    whatsapp: WHATSAPP_DIGITS,
    showPublic: true,
    consent: true,
    ...o,
  });

const listing = (u: U, petName: string) =>
  adoptionInputSchema.parse({
    name: petName,
    species: "dog",
    size: "small",
    ageMonths: 4,
    description: "Filhote carinhosa, brincalhona e muito curiosa com tudo.",
    position: { lat: HERE.lat + 0.002, lng: HERE.lng },
    areaLabel: "Centro, Curitiba – PR",
    photoPaths: [`${u.id}/adocao/${petName.toLowerCase()}.webp`],
  });

const HELLO = "Olá! Sou protetora e a Pipoca combina com o que você procura. Quer conhecer?";

async function refOf(u: U): Promise<string> {
  const { data, error } = await serviceClient().from("adoption_seekers").select("contact_ref").eq("user_id", u.id).single();
  if (error) throw error;
  return (data as { contact_ref: string }).contact_ref;
}

async function messageNotifications(u: U) {
  const { data, error } = await serviceClient().from("notifications").select("id, payload").eq("user_id", u.id).eq("kind", "message_new");
  if (error) throw error;
  return data as Array<{ id: string; payload: { conversation_id: string; count: number; context: string } }>;
}

async function fakeQueueConversations(code: string, helpers: U[]) {
  const svc = serviceClient();
  const { data: l } = await svc.from("adoption_listings").select("id").eq("short_code", code).single();
  const rows = helpers.map((h) => ({ adoption_listing_id: (l as { id: string }).id, owner_id: donor.id, helper_id: h.id, created_by: donor.id }));
  const { error } = await svc.from("conversations").insert(rows as never);
  if (error) throw error;
}

beforeAll(async () => {
  const labels = ["c-donor", "c-donor2", "c-mod", "c-stranger", "c-ok", "c-ok2", "c-noconsent", "c-rejected", "c-expired", "c-blocker"];
  const users = await Promise.all(labels.map((l) => createTestUser(l)));
  [donor, donor2, moderator, stranger, sOk, sOk2, sNoConsent, sRejected, sExpired, sBlocker] = users as [U, U, U, U, U, U, U, U, U, U];
  const svc = serviceClient();
  await svc.from("profiles").update({ role: "moderator" } as never).eq("id", moderator.id);
  const named: Array<[U, string]> = [
    [donor, `${name("Carla")} Doadora`],
    [sOk, `${name("Ana")} Souza`],
    [sOk2, `${name("Bia")} Lima`],
    [sNoConsent, `${name("Caio")} Reis`],
    [sRejected, `${name("Dani")} Melo`],
    [sExpired, `${name("Eva")} Dias`],
    [sBlocker, `${name("Fabi")} Alves`],
  ];
  await Promise.all(named.map(([u, n]) => svc.from("profiles").update({ display_name: n } as never).eq("id", u.id)));

  // Fila: todos aparecem na lista pública; o consentimento de contato é à parte.
  const seekers = [sOk, sOk2, sNoConsent, sRejected, sExpired, sBlocker];
  await Promise.all(seekers.map((u) => saveMyAdoptionSeeker(u.client, seeker())));
  for (const u of seekers) {
    const id = (await getMyAdoptionSeeker(u.client))!.id;
    await reviewAdoptionSeeker(moderator.client, id, u !== sRejected, u === sRejected ? "Perfil incompleto." : undefined);
  }
  await Promise.all([sOk, sOk2, sRejected, sExpired, sBlocker].map((u) => setMyAdoptionSeekerContact(u.client, true)));
  await svc.from("adoption_seekers").update({ expires_at: new Date(Date.now() - 86_400_000).toISOString() } as never).eq("user_id", sExpired.id);
  await svc.from("blocks").insert({ blocker_id: sBlocker.id, blocked_id: donor.id } as never);
  for (const u of seekers) refs.set(u.id, await refOf(u));

  // Anúncios: três aprovados de quem doa; um em análise e um encerrado de outra pessoa.
  [L1, L2, L3] = (await Promise.all(["Pipoca", "Paçoca", "Quindim"].map((n) => createAdoption(donor.client, donor.id, listing(donor, n))))) as [
    string,
    string,
    string,
  ];
  for (const c of [L1, L2, L3]) await reviewAdoption(moderator.client, c, true);
  pendingCode = await createAdoption(donor2.client, donor2.id, listing(donor2, "Bolinha"));
  closedCode = await createAdoption(donor2.client, donor2.id, listing(donor2, "Tico"));
  await reviewAdoption(moderator.client, closedCode, true);
  await setAdoptionStatus(donor2.client, closedCode, "ADOPTED");
}, 120_000);

afterAll(async () => {
  await Promise.all([donor, donor2, moderator, stranger, sOk, sOk2, sNoConsent, sRejected, sExpired, sBlocker].map((u) => u?.cleanup()));
});

describe("consentimento e lista", () => {
  it("contato começa desligado (opt-in) e aparece no próprio perfil", async () => {
    expect((await getMyAdoptionSeeker(sNoConsent.client))!.contactOk).toBe(false);
    expect((await getMyAdoptionSeeker(sOk.client))!.contactOk).toBe(true);
  });

  it("só quem anuncia um animal disponível recebe a referência, e só de quem aceitou contato", async () => {
    const mine = (r: Awaited<ReturnType<typeof listPublicAdoptionSeekers>>) => r.items.filter((i) => i.firstName?.endsWith(tag));
    for (const c of [anonClient(), stranger.client, donor2.client]) {
      const r = mine(await listPublicAdoptionSeekers(c, { pageSize: 60 }));
      expect(r.length).toBeGreaterThan(0);
      expect(r.every((i) => i.contactRef === undefined)).toBe(true);
    }
    const forDonor = mine(await listPublicAdoptionSeekers(donor.client, { pageSize: 60 }));
    expect(forDonor.find((i) => i.firstName === name("Ana"))!.contactRef).toBe(refs.get(sOk.id));
    expect(forDonor.find((i) => i.firstName === name("Caio"))!.contactRef).toBeUndefined();
    // Recusado e vencido nem aparecem.
    expect(forDonor.some((i) => i.firstName === name("Dani") || i.firstName === name("Eva"))).toBe(false);
  });

  it("o payload da lista não leva e-mail, WhatsApp, área exata nem ids de perfil", async () => {
    const { data, error } = await donor.client.rpc("list_public_adoption_seekers", { p_limit: 60 });
    expect(error).toBeNull();
    const raw = JSON.stringify(data);
    for (const u of [sOk, sOk2, sNoConsent, sBlocker]) expect(raw).not.toContain(u.id);
    expect(raw).not.toContain(WHATSAPP_DIGITS);
    expect(raw).not.toContain("@");
    const keys = new Set((data as { items: Array<Record<string, unknown>> }).items.flatMap((i) => Object.keys(i)));
    expect(keys.has("contact_ref")).toBe(true);
    expect([...keys].every((k) => ["ages", "area_label", "contact_ref", "first_name", "sizes", "species"].includes(k))).toBe(true);
  });

  it("anúncios para escolher: só os DISPONÍVEIS da própria pessoa", async () => {
    expect((await listMyListingsForSeekerContact(donor.client)).map((l) => l.code).sort()).toEqual([L1, L2, L3].sort());
    expect(await listMyListingsForSeekerContact(donor2.client)).toEqual([]);
    expect(await listMyListingsForSeekerContact(stranger.client)).toEqual([]);
  });
});

describe("quem NÃO pode iniciar", () => {
  const start = (u: U, listingCode: string, s: U, body = HELLO) =>
    startAdoptionSeekerConversation(u.client, { listingCode, contactRef: refs.get(s.id)!, body });

  it("visitante sem conta não chama a função", async () => {
    const { error } = await anonClient().rpc("start_adoption_seeker_conversation", { p_listing_code: L1, p_seeker_ref: refs.get(sOk.id)!, p_body: HELLO });
    expect(error).not.toBeNull();
  });

  it("quem não é dono do anúncio, ou é dono de anúncio em análise/encerrado", async () => {
    const msg = "Só quem anuncia um animal disponível pode iniciar esta conversa.";
    await expect(start(stranger, L1, sOk)).rejects.toThrow(msg);
    await expect(start(donor2, pendingCode, sOk)).rejects.toThrow(msg);
    await expect(start(donor2, closedCode, sOk)).rejects.toThrow(msg);
  });

  it("alvo sem consentimento, recusado, vencido, suspenso ou que bloqueou: mesma resposta", async () => {
    const msg = "Esta pessoa não está recebendo contatos agora.";
    for (const s of [sNoConsent, sRejected, sExpired, sBlocker]) await expect(start(donor, L1, s)).rejects.toThrow(msg);
    const svc = serviceClient();
    await svc.from("profiles").update({ suspended_at: new Date().toISOString() } as never).eq("id", sOk2.id);
    await expect(start(donor, L1, sOk2)).rejects.toThrow(msg);
    await svc.from("profiles").update({ suspended_at: null } as never).eq("id", sOk2.id);
    await expect(startAdoptionSeekerConversation(donor.client, { listingCode: L1, contactRef: crypto.randomUUID(), body: HELLO })).rejects.toThrow(msg);
    // Nenhuma tentativa recusada avisou alguém.
    for (const s of [sNoConsent, sRejected, sExpired, sBlocker, sOk2]) expect(await messageNotifications(s)).toHaveLength(0);
  });

  it("1ª mensagem com link, telefone ou e-mail é recusada", async () => {
    for (const body of ["Veja as fotos em https://exemplo.com/pipoca", "Me chama no (41) 99999-0000", "Escreva para carla@exemplo.com"]) {
      await expect(start(donor, L1, sOk, body)).rejects.toThrow("Na primeira mensagem, não envie links, telefone nem e-mail.");
    }
    expect(await messageNotifications(sOk)).toHaveLength(0);
  });
});

describe("quem anuncia inicia a conversa", () => {
  let convId: string;

  it("abre uma vez por par (anúncio, pessoa); repetir retoma a mesma conversa", async () => {
    convId = await startAdoptionSeekerConversation(donor.client, { listingCode: L1, contactRef: refs.get(sOk.id)!, body: HELLO });
    const again = await startAdoptionSeekerConversation(donor.client, { listingCode: L1, contactRef: refs.get(sOk.id)!, body: "Esqueci de dizer: ela é vacinada." });
    expect(again).toBe(convId);
    const { count } = await serviceClient()
      .from("conversations")
      .select("id", { count: "exact", head: true })
      .eq("owner_id", donor.id)
      .eq("helper_id", sOk.id);
    expect(count).toBe(1);
  });

  it("aparece em /conversas para os dois, com o contexto do anúncio e sem ids de perfil", async () => {
    const forSeeker = (await listMyConversations(sOk.client)).find((c) => c.id === convId)!;
    expect(forSeeker).toMatchObject({ context: "adoption", code: L1, petName: "Pipoca", myRole: "helper", peerId: null, peerName: null, fromSeekerQueue: true });
    const forDonor = (await listMyConversations(donor.client)).find((c) => c.id === convId)!;
    expect(forDonor).toMatchObject({ myRole: "owner", peerId: null, peerName: name("Ana"), fromSeekerQueue: true, canSend: true });

    const { data: donorRaw } = await donor.client.rpc("get_my_conversations");
    const d = JSON.stringify(donorRaw);
    expect(d).not.toContain(sOk.id);
    expect(d).not.toContain(WHATSAPP_DIGITS);
    expect(d).not.toContain("@");
    const { data: seekerRaw } = await sOk.client.rpc("get_my_conversations");
    const s = JSON.parse(JSON.stringify(seekerRaw)) as Array<Record<string, unknown>>;
    const mine = s.find((c) => c.id === convId)!;
    expect(mine.peer_id).toBeNull();
    // O id de quem doa só aparece no caminho público da foto do animal (pasta do anúncio).
    expect(JSON.stringify({ ...mine, pet_thumb_path: null })).not.toContain(donor.id);
    expect(JSON.stringify(mine)).not.toContain("@");
  });

  it("quem quer adotar recebe UM aviso agrupado (com push)", async () => {
    const ns = (await messageNotifications(sOk)).filter((n) => n.payload.conversation_id === convId);
    expect(ns).toHaveLength(1);
    expect(ns[0]!.payload).toMatchObject({ context: "adoption", count: 2 });
    const { count } = await serviceClient()
      .from("push_outbox")
      .select("id", { count: "exact", head: true })
      .eq("user_id", sOk.id)
      .eq("notification_id", ns[0]!.id);
    expect(count).toBe(1);
  });

  it("bloqueio vale nos dois sentidos: quem quer adotar bloqueia e nada mais chega", async () => {
    await sendMessage(sOk.client, convId, sOk.id, "Oi! Quero conhecer sim.");
    await setConversationBlocked(sOk.client, convId, true);
    await expect(sendMessage(donor.client, convId, donor.id, "Que bom! Quando pode?")).rejects.toThrow("Esta conversa não aceita novas mensagens.");
    await expect(
      startAdoptionSeekerConversation(donor.client, { listingCode: L1, contactRef: refs.get(sOk.id)!, body: "Ainda está aí?" }),
    ).rejects.toThrow("Esta pessoa não está recebendo contatos agora.");
  });

  it("desligar o contato invalida a referência antiga", async () => {
    const old = refs.get(sOk2.id)!;
    await setMyAdoptionSeekerContact(sOk2.client, false);
    await expect(startAdoptionSeekerConversation(donor.client, { listingCode: L1, contactRef: old, body: HELLO })).rejects.toThrow(
      "Esta pessoa não está recebendo contatos agora.",
    );
    await setMyAdoptionSeekerContact(sOk2.client, true);
    const fresh = await refOf(sOk2);
    expect(fresh).not.toBe(old);
    refs.set(sOk2.id, fresh);
  });
});

describe("limites", () => {
  it("até 5 conversas novas por anúncio por dia", async () => {
    await fakeQueueConversations(L2, [stranger, donor2, sNoConsent, sRejected, sExpired]);
    await expect(startAdoptionSeekerConversation(donor.client, { listingCode: L2, contactRef: refs.get(sOk2.id)!, body: HELLO })).rejects.toThrow(
      "Este anúncio já iniciou muitas conversas hoje. Tente amanhã.",
    );
  });

  it("até 10 conversas novas com a fila por dia para quem anuncia", async () => {
    await fakeQueueConversations(L3, [stranger, donor2, sNoConsent, sRejected, sExpired]);
    await expect(startAdoptionSeekerConversation(donor.client, { listingCode: L1, contactRef: refs.get(sOk2.id)!, body: HELLO })).rejects.toThrow(
      "Você já iniciou muitas conversas com a fila hoje. Tente amanhã.",
    );
    expect(await messageNotifications(sOk2)).toHaveLength(0);
  });
});
