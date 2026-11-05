import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { adoptionInputSchema, interestSchema, seekerInputSchema } from "@mel/core";
import { createAdoption, getAdoption, reviewAdoption, setAdoptionStatus, submitAdoptionInterest, withdrawAdoptionInterest } from "../src/adoption";
import {
  getMyAdoptionSeeker,
  listAdoptionSeekersForReview,
  listPublicAdoptionSeekers,
  renewMyAdoptionSeeker,
  reviewAdoptionSeeker,
  runAdoptionRetention,
  saveMyAdoptionSeeker,
  setMyAdoptionSeekerNotify,
  withdrawMyAdoptionSeeker,
} from "../src/adoptionSeekers";
import { listMessages } from "../src/chat";
import { anonClient, createTestUser, serviceClient } from "./helpers";

// Fila de interessados (migrations 20261106121000–125000): privacidade, moderação,
// avisos de compatível, cancelamento de interesse e retenção.

type U = Awaited<ReturnType<typeof createTestUser>>;
let donor: U, moderator: U, ana: U, quiet: U, catPerson: U, far: U, pending: U, limited: U;
const tag = crypto.randomUUID().slice(0, 6);
const name = (s: string) => `${s}${tag}`;
const HERE = { lat: -25.4284, lng: -49.2733 };

const seeker = (o: Record<string, unknown> = {}) =>
  seekerInputSchema.parse({
    species: "dog",
    sizes: ["mini", "small"],
    ages: ["puppy"],
    area: HERE,
    areaLabel: "Centro, Curitiba – PR",
    radiusM: 3000,
    housing: "apartment",
    otherPets: "none",
    routine: "Trabalho em casa e passeio com calma todos os dias.",
    whatsapp: "(41) 99999-0000",
    consent: true,
    ...o,
  });

const listing = (u: U, o: Record<string, unknown> = {}) =>
  adoptionInputSchema.parse({
    name: "Pipoca",
    species: "dog",
    size: "small",
    ageMonths: 4,
    description: "Filhote carinhosa, brincalhona e muito curiosa com tudo.",
    position: { lat: HERE.lat + 0.002, lng: HERE.lng },
    areaLabel: "Centro, Curitiba – PR",
    photoPaths: [`${u.id}/adocao/pipoca.webp`],
    ...o,
  });

const matchesFor = async (u: U) => {
  const { data, error } = await serviceClient()
    .from("notifications")
    .select("id, payload")
    .eq("user_id", u.id)
    .eq("kind", "adoption_match");
  if (error) throw error;
  return data as Array<{ id: string; payload: { code?: string } }>;
};

beforeAll(async () => {
  const users = await Promise.all(["s-donor", "s-mod", "s-ana", "s-quiet", "s-cat", "s-far", "s-pending", "s-limited"].map((l) => createTestUser(l)));
  [donor, moderator, ana, quiet, catPerson, far, pending, limited] = users as [U, U, U, U, U, U, U, U];
  const svc = serviceClient();
  await svc.from("profiles").update({ role: "moderator" } as never).eq("id", moderator.id);
  const names: Array<[U, string]> = [
    [ana, `${name("Ana")} Souza`],
    [quiet, `${name("Quieta")} Lima`],
    [catPerson, `${name("Gatoso")} Reis`],
    [far, `${name("Longe")} Dias`],
    [pending, `${name("Espera")} Melo`],
    [limited, `${name("Cheio")} Alves`],
  ];
  await Promise.all(names.map(([u, n]) => svc.from("profiles").update({ display_name: n } as never).eq("id", u.id)));
});

afterAll(async () => {
  await Promise.all([donor, moderator, ana, quiet, catPerson, far, pending, limited].map((u) => u?.cleanup()));
});

describe("perfil da fila: dono, moderação e privacidade", () => {
  it("cria em análise, com validade de 90 dias e WhatsApp só em dígitos", async () => {
    const s = await saveMyAdoptionSeeker(ana.client, seeker({ showPublic: true }));
    expect(s).toMatchObject({ status: "PENDING_REVIEW", whatsapp: "41999990000", firstName: name("Ana"), children: null, notify: true });
    const days = (new Date(s.expiresAt).getTime() - Date.now()) / 86_400_000;
    expect(days).toBeGreaterThan(89);
    expect(days).toBeLessThan(91);
    // Área sempre aproximada (grade de 100 m): nunca o ponto enviado.
    expect(s.area).not.toEqual(HERE);
  });

  it("sem conta e sem consentimento não entra na fila; contato na rotina é recusado", async () => {
    const { error } = await anonClient().rpc("save_my_adoption_seeker", {
      p_species: "dog", p_sizes: [], p_ages: [], p_area_lat: HERE.lat, p_area_lng: HERE.lng, p_area_label: "Centro", p_radius_m: 3000,
      p_housing: "apartment", p_other_pets: "none", p_children: false, p_routine: "Rotina tranquila com bastante tempo livre.",
      p_whatsapp: "", p_notify: true, p_show_public: false, p_consent: true,
    });
    expect(error).not.toBeNull();
    const { error: noConsent } = await quiet.client.rpc("save_my_adoption_seeker", {
      p_species: "dog", p_sizes: [], p_ages: [], p_area_lat: HERE.lat, p_area_lng: HERE.lng, p_area_label: "Centro", p_radius_m: 3000,
      p_housing: "apartment", p_other_pets: "none", p_children: false, p_routine: "Rotina tranquila com bastante tempo livre.",
      p_whatsapp: "", p_notify: true, p_show_public: false, p_consent: false,
    });
    expect(noConsent?.message).toBe("Para entrar na fila, precisamos do seu consentimento.");
    const { error: phone } = await quiet.client.rpc("save_my_adoption_seeker", {
      p_species: "dog", p_sizes: [], p_ages: [], p_area_lat: HERE.lat, p_area_lng: HERE.lng, p_area_label: "Centro", p_radius_m: 3000,
      p_housing: "apartment", p_other_pets: "none", p_children: false, p_routine: "Me chama no 41 99999-0000 que eu respondo rápido.",
      p_whatsapp: "", p_notify: true, p_show_public: false, p_consent: true,
    });
    expect(phone?.message).toContain("Não escreva telefone");
  });

  it("cada um só vê o próprio perfil; WhatsApp nunca chega a outro usuário nem ao visitante", async () => {
    await saveMyAdoptionSeeker(quiet.client, seeker({ whatsapp: null, notify: false }));
    expect((await getMyAdoptionSeeker(quiet.client))!.whatsapp).toBeNull();
    expect((await getMyAdoptionSeeker(donor.client))).toBeNull();

    const { data: asStranger } = await donor.client.from("adoption_seekers").select("id, whatsapp_private").eq("user_id", ana.id);
    expect(asStranger).toEqual([]);
    const { data: asOther } = await quiet.client.from("adoption_seekers").select("user_id, whatsapp_private");
    expect((asOther ?? []).every((r) => (r as { user_id: string }).user_id === quiet.id)).toBe(true);
    const anon = await anonClient().from("adoption_seekers").select("whatsapp_private");
    expect(anon.data ?? []).toEqual([]);

    // A moderação vê (inclusive o WhatsApp).
    const { data: asMod } = await moderator.client.from("adoption_seekers").select("whatsapp_private").eq("user_id", ana.id).single();
    expect((asMod as { whatsapp_private: string }).whatsapp_private).toBe("41999990000");
  });

  it("sem escrita direta: nem o dono aprova o próprio perfil, nem outro usuário altera", async () => {
    const own = await ana.client.from("adoption_seekers").update({ status: "APPROVED" } as never).eq("user_id", ana.id).select();
    expect(own.error ?? (own.data ?? []).length === 0).toBeTruthy();
    const ins = await donor.client.from("adoption_seekers").insert({ user_id: donor.id } as never);
    expect(ins.error).not.toBeNull();
    const del = await donor.client.from("adoption_seekers").delete().eq("user_id", ana.id).select();
    expect(del.error ?? (del.data ?? []).length === 0).toBeTruthy();
    expect((await getMyAdoptionSeeker(ana.client))!.status).toBe("PENDING_REVIEW");
    await expect(listAdoptionSeekersForReview(ana.client)).rejects.toThrow("Acesso restrito à moderação.");
    await expect(reviewAdoptionSeeker(ana.client, (await getMyAdoptionSeeker(ana.client))!.id, true)).rejects.toThrow("Acesso restrito à moderação.");
  });

  it("a moderação aprova (com registro) e recusa só com motivo", async () => {
    const queue = await listAdoptionSeekersForReview(moderator.client);
    const mine = queue.find((s) => s.firstName === name("Ana"))!;
    expect(mine.whatsapp).toBe("41999990000");
    await expect(reviewAdoptionSeeker(moderator.client, mine.id, false)).rejects.toThrow("Explique o motivo da recusa.");
    await reviewAdoptionSeeker(moderator.client, mine.id, true);
    expect((await getMyAdoptionSeeker(ana.client))!.status).toBe("APPROVED");
    const { data: log } = await serviceClient().from("moderation_actions").select("action, target_type").eq("target_id", mine.id);
    expect(log).toEqual([{ action: "approve", target_type: "adoption_seeker" }]);
    await expect(reviewAdoptionSeeker(moderator.client, mine.id, true)).rejects.toThrow("Perfil não está aguardando revisão.");
  });

  it("editar o conteúdo volta para a análise; pausar avisos não", async () => {
    await setMyAdoptionSeekerNotify(ana.client, false);
    expect(await getMyAdoptionSeeker(ana.client)).toMatchObject({ status: "APPROVED", notify: false });
    await setMyAdoptionSeekerNotify(ana.client, true);
    await saveMyAdoptionSeeker(ana.client, seeker({ showPublic: true, routine: "Trabalho em casa, tenho tempo e muita paciência." }));
    const s = (await getMyAdoptionSeeker(ana.client))!;
    expect(s.status).toBe("PENDING_REVIEW");
    await reviewAdoptionSeeker(moderator.client, s.id, true);
  });
});

describe("lista pública 'Querem adotar'", () => {
  it("só opt-in + aprovado + dentro da validade, e só primeiro nome, bairro e preferências", async () => {
    // quiet: aprovado mas sem opt-in; pending: opt-in mas em análise.
    await reviewAdoptionSeeker(moderator.client, (await getMyAdoptionSeeker(quiet.client))!.id, true);
    await saveMyAdoptionSeeker(pending.client, seeker({ showPublic: true }));

    const { items } = await listPublicAdoptionSeekers(anonClient(), { pageSize: 60 });
    const ours = items.filter((i) => i.firstName?.endsWith(tag));
    expect(ours.map((i) => i.firstName)).toEqual([name("Ana")]);
    expect(Object.keys(ours[0]!).sort()).toEqual(["ages", "areaLabel", "firstName", "sizes", "species"]);
    const { data: raw } = await anonClient().rpc("list_public_adoption_seekers", { p_limit: 60 });
    const rawItem = (raw as { items: Array<Record<string, unknown>> }).items.find((i) => i.first_name === name("Ana"))!;
    expect(Object.keys(rawItem).sort()).toEqual(["ages", "area_label", "first_name", "sizes", "species"]);
    expect(JSON.stringify(raw)).not.toContain("41999990000");

    // Vencido sai da lista; renovar devolve.
    await serviceClient().from("adoption_seekers").update({ expires_at: new Date(Date.now() - 86_400_000).toISOString() } as never).eq("user_id", ana.id);
    expect((await listPublicAdoptionSeekers(anonClient(), { pageSize: 60 })).items.some((i) => i.firstName === name("Ana"))).toBe(false);
    const renewed = await renewMyAdoptionSeeker(ana.client);
    expect(new Date(renewed).getTime()).toBeGreaterThan(Date.now() + 89 * 86_400_000);
    expect((await listPublicAdoptionSeekers(anonClient(), { pageSize: 60 })).items.some((i) => i.firstName === name("Ana"))).toBe(true);
  });
});

describe("aviso de animal compatível", () => {
  let code: string;

  beforeAll(async () => {
    await saveMyAdoptionSeeker(catPerson.client, seeker({ species: "cat", whatsapp: null }));
    await saveMyAdoptionSeeker(far.client, seeker({ area: { lat: -23.5505, lng: -46.6333 }, areaLabel: "Sé, São Paulo – SP", whatsapp: null }));
    await saveMyAdoptionSeeker(limited.client, seeker({ whatsapp: null }));
    for (const u of [catPerson, far, limited]) await reviewAdoptionSeeker(moderator.client, (await getMyAdoptionSeeker(u.client))!.id, true);
    // limited já recebeu 3 avisos de adoção nas últimas 24 h.
    await serviceClient()
      .from("notifications")
      .insert([1, 2, 3].map(() => ({ user_id: limited.id, kind: "adoption_match", payload: { listing_id: crypto.randomUUID(), code: "zzzzzz" } })) as never);
  });

  it("anúncio em análise não avisa ninguém", async () => {
    code = await createAdoption(donor.client, donor.id, listing(donor));
    expect(await matchesFor(ana)).toEqual([]);
  });

  it("ao ser aprovado, avisa só quem combina, está no raio, aprovado, com avisos ligados e abaixo do limite", async () => {
    await reviewAdoption(moderator.client, code, true);
    const anaMatches = await matchesFor(ana);
    expect(anaMatches.map((m) => m.payload.code)).toEqual([code]);
    expect(await matchesFor(quiet)).toEqual([]); // avisos desligados
    expect(await matchesFor(catPerson)).toEqual([]); // espécie diferente
    expect(await matchesFor(far)).toEqual([]); // fora do raio
    expect(await matchesFor(pending)).toEqual([]); // ainda em análise
    expect(await matchesFor(limited)).toHaveLength(3); // limite diário
    expect(await matchesFor(donor)).toEqual([]);
    // O aviso vai para a fila de push existente.
    const { data: outbox } = await serviceClient().from("push_outbox").select("id").eq("notification_id", anaMatches[0]!.id);
    expect(outbox).toHaveLength(1);
  });

  it("um aviso por pessoa e anúncio, mesmo se voltar a ficar disponível", async () => {
    await setAdoptionStatus(donor.client, code, "IN_PROCESS");
    await setAdoptionStatus(donor.client, code, "AVAILABLE");
    expect(await matchesFor(ana)).toHaveLength(1);
  });

  it("porte ou idade fora da preferência não avisa", async () => {
    const big = await createAdoption(donor.client, donor.id, listing(donor, { name: "Trovão", size: "giant", ageMonths: 60 }));
    await reviewAdoption(moderator.client, big, true);
    expect((await matchesFor(ana)).some((m) => m.payload.code === big)).toBe(false);
  });
});

describe("interesse num anúncio: crianças opcional e cancelamento", () => {
  let code: string;

  it("crianças em casa pode ficar sem resposta", async () => {
    code = await createAdoption(donor.client, donor.id, listing(donor, { name: "Farofa", species: "cat", size: null, ageMonths: null }));
    await reviewAdoption(moderator.client, code, true);
    const conv = await submitAdoptionInterest(ana.client, code, interestSchema.parse({ housing: "apartment", otherPets: false, message: "Tenho tempo e tela nas janelas." }));
    const [m] = await listMessages(donor.client, conv);
    expect(m!.body).toContain("Crianças em casa: não informado");
    expect((await getAdoption(ana.client, code))!.myInterest).toBe(true);
    expect((await getAdoption(quiet.client, code))!.myInterest).toBe(false);
    expect((await getAdoption(anonClient(), code))!.myInterest).toBe(false);
  });

  it("só quem enviou cancela o próprio interesse; a linha é apagada", async () => {
    expect(await withdrawAdoptionInterest(quiet.client, code)).toBe(false);
    expect((await getAdoption(donor.client, code))!.interests).toBe(1);
    const { error } = await anonClient().rpc("withdraw_adoption_interest", { p_code: code });
    expect(error).not.toBeNull();
    expect(await withdrawAdoptionInterest(ana.client, code)).toBe(true);
    expect((await getAdoption(donor.client, code))!.interests).toBe(0);
    expect((await getAdoption(ana.client, code))!.myInterest).toBe(false);
  });
});

describe("retenção (agendador)", () => {
  it("só a chave secreta roda; apaga interesses de anúncio encerrado há 30 dias e perfis vencidos há 30 dias", async () => {
    const { error } = await ana.client.rpc("run_adoption_retention", {});
    expect(error).not.toBeNull();

    const code = await createAdoption(donor.client, donor.id, listing(donor, { name: "Paçoca", species: "cat" }));
    await reviewAdoption(moderator.client, code, true);
    await submitAdoptionInterest(quiet.client, code, interestSchema.parse({ housing: "house", otherPets: true, children: true, message: "Tenho quintal grande e telado." }));
    await setAdoptionStatus(donor.client, code, "ADOPTED");
    const svc = serviceClient();
    const { data: row } = await svc.from("adoption_listings").select("id, closed_at").eq("short_code", code).single();
    const listingRow = row as { id: string; closed_at: string | null };
    expect(listingRow.closed_at).not.toBeNull();

    // Encerrado há pouco: fica.
    await runAdoptionRetention(svc);
    expect((await getAdoption(donor.client, code))!.interests).toBe(1);

    await svc.from("adoption_listings").update({ closed_at: new Date(Date.now() - 31 * 86_400_000).toISOString() } as never).eq("id", listingRow.id);
    await svc.from("adoption_seekers").update({ expires_at: new Date(Date.now() - 31 * 86_400_000).toISOString() } as never).eq("user_id", far.id);
    await svc.from("adoption_seekers").update({ expires_at: new Date(Date.now() + 3 * 86_400_000).toISOString() } as never).eq("user_id", catPerson.id);
    const r = await runAdoptionRetention(svc);
    expect(r.interestsRemoved).toBeGreaterThanOrEqual(1);
    expect((await getAdoption(donor.client, code))!.interests).toBe(0);
    expect(await getMyAdoptionSeeker(far.client)).toBeNull();
    // Lembrete "Ainda procura?" uma vez só.
    await runAdoptionRetention(svc);
    const { data: reminders } = await svc.from("notifications").select("id").eq("user_id", catPerson.id).eq("kind", "adoption_seeker_expiring");
    expect(reminders).toHaveLength(1);
  });

  it("cancelar o perfil apaga na hora", async () => {
    expect(await withdrawMyAdoptionSeeker(ana.client)).toBe(true);
    expect(await getMyAdoptionSeeker(ana.client)).toBeNull();
    const { data } = await serviceClient().from("adoption_seekers").select("id").eq("user_id", ana.id);
    expect(data).toEqual([]);
    expect(await withdrawMyAdoptionSeeker(ana.client)).toBe(false);
  });
});
