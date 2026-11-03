// P0 privacidade dos avistamentos (migration 29): quem chama a RPC diretamente
// não obtém o ponto exato de quem ajudou nem um identificador estável dela pela
// foto — e o tutor continua recebendo a pista exata.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { distanceMeters, fuzzPoint, petInputSchema, reunionSchema, sightingInputSchema } from "@mel/core";
import { ensureSession } from "../src/auth";
import type { MelClient } from "../src/client";
import { activateLostCase, closeLostCase, confirmReunion, startLostCase, updateLostCase } from "../src/lostCases";
import { moderate, reportContent } from "../src/moderation";
import { createPet } from "../src/pets";
import { createSighting, getTimeline, uploadSightingPhoto } from "../src/sightings";
import { anonClient, createTestUser, serviceClient } from "./helpers";

// Região própria (Belo Horizonte) para não cruzar com outros testes.
const BH = { lat: -19.9191, lng: -43.9386 };
// "Vi da esquina": o ponto que o tutor precisa receber intacto.
const CORNER = { lat: -19.917123, lng: -43.934567 };
const minutesAgo = (m: number) => new Date(Date.now() - m * 60_000).toISOString();
const PNG = Uint8Array.from(atob("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="), (c) => c.charCodeAt(0));
const png = () => new Blob([PNG], { type: "image/png" });

type U = Awaited<ReturnType<typeof createTestUser>>;
let tutor: U, stranger: U, moderator: U;
const anonIds: string[] = [];
const uploaded: string[] = [];

interface RawItem {
  id: string;
  lat: number;
  lng: number;
  point_is_exact: boolean;
  photo_path: string | null;
}

async function anonymous() {
  const client = anonClient();
  const user = await ensureSession(client);
  anonIds.push(user.id);
  return { id: user.id, client };
}

async function alert(name: string) {
  const pet = await createPet(tutor.client, tutor.id, petInputSchema.parse({ name, species: "dog" }));
  const c = await startLostCase(tutor.client, tutor.id, pet.id);
  await updateLostCase(tutor.client, c.id, { lastSeen: BH, lostAt: minutesAgo(120), publicAreaLabel: "Centro, Belo Horizonte – MG" });
  return (await activateLostCase(tutor.client, c.id)).code;
}

const sighting = (code: string, o: Record<string, unknown> = {}) =>
  sightingInputSchema.parse({ code, position: CORNER, placeLabel: "Rua da Bahia, Centro, Belo Horizonte – MG", seenAt: minutesAgo(15), ...o });

async function raw(client: MelClient, code: string): Promise<RawItem[]> {
  const { data, error } = await client.rpc("get_lost_case_timeline", { p_code: code });
  if (error) throw error;
  return data as unknown as RawItem[];
}

async function upload(client: MelClient) {
  const path = await uploadSightingPhoto(client, png());
  uploaded.push(path);
  return path;
}

const PUBLIC = fuzzPoint(CORNER, 250);
const isExact = (i: RawItem) => i.lat === CORNER.lat && i.lng === CORNER.lng;
const isPublic = (i: RawItem) => Math.abs(i.lat - PUBLIC.lat) < 1e-6 && Math.abs(i.lng - PUBLIC.lng) < 1e-6 && !i.point_is_exact;

let code: string;
let author: { id: string; client: MelClient };
let sightingId: string;
let photoPath: string;

beforeAll(async () => {
  [tutor, stranger, moderator] = await Promise.all([createTestUser("sp-tutor"), createTestUser("sp-stranger"), createTestUser("sp-mod")]);
  await serviceClient().from("profiles").update({ role: "moderator" } as never).eq("id", moderator.id);
  code = await alert("Esquina");
  author = await anonymous();
  photoPath = await upload(author.client);
  sightingId = await createSighting(author.client, sighting(code, { photoPath, notes: "Entrou no terreno ao lado da padaria." }));
}, 60_000);

afterAll(async () => {
  if (uploaded.length) await serviceClient().storage.from("sighting-media").remove(uploaded);
  for (const id of anonIds) await serviceClient().auth.admin.deleteUser(id);
  await Promise.all([tutor, stranger, moderator].map((u) => u?.cleanup()));
}, 60_000);

describe("coordenadas: quem recebe o quê", () => {
  it("A — visitante sem sessão chamando a RPC: só o ponto aproximado", async () => {
    const items = await raw(anonClient(), code);
    expect(items).toHaveLength(1);
    expect(isPublic(items[0]!)).toBe(true);
    expect(JSON.stringify(items)).not.toContain(String(CORNER.lat));
  });

  it("B — outra sessão anônima: só o ponto aproximado", async () => {
    const other = await anonymous();
    expect(isPublic((await raw(other.client, code))[0]!)).toBe(true);
  });

  it("C — conta comum que não é o tutor: só o ponto aproximado", async () => {
    expect(isPublic((await raw(stranger.client, code))[0]!)).toBe(true);
  });

  it("D — tutor: ponto exato", async () => {
    const [item] = await raw(tutor.client, code);
    expect(isExact(item!)).toBe(true);
    expect(item!.point_is_exact).toBe(true);
  });

  it("E — autor: exato só no próprio avistamento; aproximado no dos outros", async () => {
    const other = await anonymous();
    await createSighting(other.client, sighting(code, { position: { lat: CORNER.lat + 0.002, lng: CORNER.lng }, seenAt: minutesAgo(5) }));
    const items = await raw(author.client, code);
    const mine = items.find((i) => i.id === sightingId)!;
    const theirs = items.find((i) => i.id !== sightingId)!;
    expect(isExact(mine)).toBe(true);
    expect(theirs.point_is_exact).toBe(false);
  });

  it("F — moderação: ponto exato", async () => {
    const item = (await raw(moderator.client, code)).find((i) => i.id === sightingId)!;
    expect(isExact(item)).toBe(true);
  });
});

describe("status do alerta", () => {
  it("G — FOUND: depois do reencontro o visitante continua sem o ponto exato; o tutor mantém", async () => {
    const found = await alert("Reencontrado");
    const s = await anonymous();
    await createSighting(s.client, sighting(found));
    await confirmReunion(tutor.client, found, reunionSchema.parse({ how: "came_back" }));
    expect(isPublic((await raw(anonClient(), found))[0]!)).toBe(true);
    expect(isPublic((await raw(stranger.client, found))[0]!)).toBe(true);
    expect(isExact((await raw(tutor.client, found))[0]!)).toBe(true);
  });

  it("H — CLOSED e REMOVED: nenhum caminho histórico devolve o ponto ao público", async () => {
    const closed = await alert("Encerrado");
    const s = await anonymous();
    await createSighting(s.client, sighting(closed));
    await closeLostCase(tutor.client, closed);
    expect(await raw(anonClient(), closed)).toEqual([]);
    expect(await raw(stranger.client, closed)).toEqual([]);
    expect(isExact((await raw(tutor.client, closed))[0]!)).toBe(true);

    const removed = await alert("Removido");
    await createSighting(s.client, sighting(removed, { seenAt: minutesAgo(3) }));
    const reportId = await reportContent(stranger.client, { type: "lost_case", key: removed }, { reason: "scam", details: null });
    await moderate(moderator.client, reportId, "hide", "teste");
    expect(await raw(anonClient(), removed)).toEqual([]);
    expect(await raw(stranger.client, removed)).toEqual([]);
  });

  it("I — ninguém escreve o ponto público: coluna sem grant e sempre recalculada pelo banco", async () => {
    const { error: insertError } = await author.client.from("sightings").insert({
      lost_case_id: "00000000-0000-0000-0000-000000000000", reporter_id: author.id, lat: 0, lng: 0, seen_at: minutesAgo(1), public_lat: 1, public_lng: 1,
    } as never);
    expect(insertError).not.toBeNull();
    const { error: updateError } = await tutor.client.from("sightings").update({ public_lat: 0, public_lng: 0 } as never).eq("id", sightingId);
    expect(updateError).not.toBeNull();
    // Mesmo pela chave secreta, o trigger devolve o ponto derivado do exato.
    await serviceClient().from("sightings").update({ public_lat: 0, public_lng: 0 } as never).eq("id", sightingId);
    const { data } = await serviceClient().from("sightings").select("lat, lng, public_lat, public_lng").eq("id", sightingId).single();
    expect(data).toMatchObject({ lat: CORNER.lat, lng: CORNER.lng });
    expect(data!.public_lat).toBeCloseTo(PUBLIC.lat, 6);
    expect(data!.public_lng).toBeCloseTo(PUBLIC.lng, 6);
  });
});

describe("foto sem pseudônimo", () => {
  it("J — o caminho público da foto não contém nenhum identificador de quem enviou", async () => {
    expect(photoPath).toMatch(/^[0-9a-f-]{36}\.png$/);
    const item = (await raw(anonClient(), code)).find((i) => i.id === sightingId)!;
    expect(item.photo_path).toBe(photoPath);
    const timeline = JSON.stringify(await getTimeline(anonClient(), code));
    for (const id of anonIds) expect(timeline).not.toContain(id);
  });

  it("J — foto antiga (<sessão>/…) não sai para o público; tutor e autor continuam vendo", async () => {
    const legacy = `${author.id}/${crypto.randomUUID()}.png`;
    await serviceClient().storage.from("sighting-media").upload(legacy, png(), { contentType: "image/png" });
    uploaded.push(legacy);
    const s = await anonymous();
    const id = await createSighting(s.client, sighting(code, { seenAt: minutesAgo(8) }));
    await serviceClient().from("sightings").update({ photo_path: legacy } as never).eq("id", id);
    expect((await raw(anonClient(), code)).find((i) => i.id === id)!.photo_path).toBeNull();
    expect((await raw(stranger.client, code)).find((i) => i.id === id)!.photo_path).toBeNull();
    expect((await raw(tutor.client, code)).find((i) => i.id === id)!.photo_path).toBe(legacy);
  });

  it("K — não dá para listar o bucket, usar a foto de outra pessoa nem gravar no formato antigo", async () => {
    const { data: listed } = await anonClient().storage.from("sighting-media").list("", { limit: 100 });
    expect(listed ?? []).toEqual([]);
    const { data: strangerList } = await stranger.client.storage.from("sighting-media").list("", { limit: 1000 });
    expect((strangerList ?? []).map((f) => f.name)).not.toContain(photoPath);
    // Foto de outra sessão (nome conhecido): recusada.
    const thief = await anonymous();
    await expect(createSighting(thief.client, sighting(code, { photoPath, seenAt: minutesAgo(4) }))).rejects.toThrow("Foto inválida");
    // Arquivo inexistente: recusado.
    await expect(createSighting(thief.client, sighting(code, { photoPath: `${crypto.randomUUID()}.png`, seenAt: minutesAgo(4) }))).rejects.toThrow("Foto inválida");
    // Formato antigo, com a própria sessão no caminho: o Storage recusa.
    const { error } = await thief.client.storage.from("sighting-media").upload(`${thief.id}/${crypto.randomUUID()}.png`, png(), { contentType: "image/png" });
    expect(error).not.toBeNull();
  });
});

describe("utilidade da pista", () => {
  it("tutor recebe o ponto original; visitante, a célula aproximada a até ~180 m", async () => {
    const [forTutor] = (await getTimeline(tutor.client, code)).filter((s) => s.id === sightingId);
    const [forPublic] = (await getTimeline(anonClient(), code)).filter((s) => s.id === sightingId);
    expect(forTutor!.position).toEqual(CORNER);
    expect(forTutor!.pointIsExact).toBe(true);
    expect(forPublic!.pointIsExact).toBe(false);
    expect(forPublic!.position).not.toEqual(CORNER);
    const offset = distanceMeters(CORNER, forPublic!.position);
    expect(offset).toBeGreaterThan(0);
    expect(offset).toBeLessThanOrEqual(180); // meia diagonal da célula de 250 m
    // Rua exata só para o tutor; o público fica com bairro e cidade (migration 30).
    expect(forTutor!.placeLabel).toBe("Rua da Bahia, Centro, Belo Horizonte – MG");
    expect(forPublic!.placeLabel).toBe("Centro, Belo Horizonte – MG");
  });
});

describe("rótulo do local (migration 30)", () => {
  it("avistamento dentro de um condomínio: tutor e autor veem o lugar; visitante e outras contas, só bairro e cidade (RPC direta)", async () => {
    const poi = "Condomínio Residencial Jardim das Acácias, Savassi, Belo Horizonte – MG";
    const s = await anonymous();
    const id = await createSighting(s.client, sighting(code, { placeLabel: poi, seenAt: minutesAgo(2) }));
    const label = async (client: MelClient) =>
      ((await raw(client, code)) as unknown as { id: string; place_label: string | null }[]).find((i) => i.id === id)!.place_label;

    expect(await label(tutor.client)).toBe(poi);
    expect(await label(s.client)).toBe(poi);
    expect(await label(moderator.client)).toBe(poi);
    for (const client of [anonClient(), stranger.client, (await anonymous()).client]) {
      const shown = await label(client);
      expect(shown).toBe("Savassi, Belo Horizonte – MG");
      expect(shown).not.toMatch(/Condomínio|Acácias/);
    }
    // Nem a linha do tempo inteira do visitante menciona o condomínio.
    expect(JSON.stringify(await raw(anonClient(), code))).not.toMatch(/Condomínio|Acácias/);
  });

  it("sem bairro, só a cidade; nome solto (pode ser o lugar exato) não sai", async () => {
    const s = await anonymous();
    const a = await createSighting(s.client, sighting(code, { placeLabel: "Edifício Solar, Belo Horizonte – MG", seenAt: minutesAgo(1) }));
    const b = await createSighting(s.client, sighting(code, { placeLabel: "Edifício Solar", seenAt: minutesAgo(1) }));
    const items = (await raw(anonClient(), code)) as unknown as { id: string; place_label: string | null }[];
    expect(items.find((i) => i.id === a)!.place_label).toBe("Belo Horizonte – MG");
    expect(items.find((i) => i.id === b)!.place_label).toBeNull();
    const { data } = await serviceClient().from("sightings").select("place_label").eq("id", b).single();
    expect(data!.place_label).toBe("Edifício Solar"); // o dado original não muda
  });
});
