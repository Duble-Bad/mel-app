import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { computeMatchScore, foundInputSchema, petInputSchema, type MatchSide } from "@mel/core";
import { ensureSession } from "../src/auth";
import { getConversation, listMyConversations, sendMessage } from "../src/chat";
import {
  closeFoundCase,
  createFoundCase,
  dismissMatch,
  getPublicFoundCase,
  listMyMatches,
  openConversationFromMatch,
} from "../src/found";
import { activateLostCase, startLostCase, updateLostCase } from "../src/lostCases";
import { listNotifications } from "../src/notifications";
import { createPet } from "../src/pets";
import { anonClient, createTestUser, serviceClient } from "./helpers";

const SE = { lat: -23.55052, lng: -46.633308 };
const NEAR = { lat: -23.5489, lng: -46.6388 }; // ~600 m
const minutesAgo = (m: number) => new Date(Date.now() - m * 60_000).toISOString();

let tutor: Awaited<ReturnType<typeof createTestUser>>;
let stranger: Awaited<ReturnType<typeof createTestUser>>;
const anonUsers: string[] = [];

async function anonymousFinder() {
  const client = anonClient();
  const user = await ensureSession(client);
  anonUsers.push(user.id);
  return { client, id: user.id };
}

const yorkie = { species: "dog", size: "mini", sex: "female", colorPrimary: "caramelo", breed: "Yorkshire Terrier" } as const;

async function lostYorkie(name: string, activate = true) {
  const pet = await createPet(tutor.client, tutor.id, petInputSchema.parse({ name, ...yorkie }));
  const c = await startLostCase(tutor.client, tutor.id, pet.id);
  await updateLostCase(tutor.client, c.id, { lastSeen: SE, lostAt: minutesAgo(90), publicAreaLabel: "Sé, São Paulo – SP" });
  return activate ? (await activateLostCase(tutor.client, c.id)).code : c.id;
}

const found = (o: Record<string, unknown> = {}) =>
  foundInputSchema.parse({
    species: "dog",
    size: "mini",
    sex: "female",
    colorPrimary: "caramelo",
    breedGuess: "Yorkshire Terrier",
    position: NEAR,
    areaLabel: "Sé, São Paulo – SP",
    foundAt: minutesAgo(10),
    custody: "with_me",
    verificationHint: "Tem uma mancha branca no peito.",
    ...o,
  });

beforeAll(async () => {
  tutor = await createTestUser("found-tutor");
  stranger = await createTestUser("found-stranger");
});

afterAll(async () => {
  for (const id of anonUsers) await serviceClient().auth.admin.deleteUser(id);
  await tutor?.cleanup();
  await stranger?.cleanup();
});

describe("publishing a found pet without an account", () => {
  it("is public without the exact point; the ownership hint is visible only to the finder", async () => {
    const finder = await anonymousFinder();
    const code = await createFoundCase(finder.client, finder.id, found({ species: "cat", breedGuess: null }));
    expect(code).toMatch(/^[a-z2-9]{6}$/);

    const pub = (await getPublicFoundCase(anonClient(), code))!;
    expect(pub).toMatchObject({ species: "cat", custody: "with_me", isReporter: false, verificationHint: null, areaLabel: "Sé, São Paulo – SP" });
    expect(pub.point).not.toEqual(NEAR); // aproximado
    const mine = (await getPublicFoundCase(finder.client, code))!;
    expect(mine).toMatchObject({ isReporter: true, verificationHint: "Tem uma mancha branca no peito." });

    // A tabela base (com o ponto exato) não é legível por outros.
    const { data } = await stranger.client.from("found_cases").select("lat, lng").eq("short_code", code);
    expect(data).toEqual([]);
    expect((await anonClient().from("found_cases").select("lat").eq("short_code", code)).data ?? []).toEqual([]);
  });

  it("rejects a photo in someone else's folder and dates in the future", async () => {
    const finder = await anonymousFinder();
    await expect(createFoundCase(finder.client, finder.id, found({ photoPath: `${tutor.id}/x.webp` }))).rejects.toThrow("Foto inválida.");
    await expect(
      createFoundCase(finder.client, finder.id, found({ foundAt: new Date(Date.now() + 3_600_000).toISOString() })),
    ).rejects.toThrow("A data não pode estar no futuro.");
    // Ninguém publica em nome de outra pessoa.
    await expect(createFoundCase(finder.client, tutor.id, found())).rejects.toThrow();
  });
});

describe("Radar MEL", () => {
  it("found after lost: both sides are notified and see the match; outsiders see nothing", async () => {
    const lostCode = await lostYorkie("Mel");
    const finder = await anonymousFinder();
    const foundCode = await createFoundCase(finder.client, finder.id, found());

    const [ownerMatch] = (await listMyMatches(tutor.client)).filter((m) => m.lost.code === lostCode);
    expect(ownerMatch).toMatchObject({ role: "owner", lost: { petName: "Mel" }, found: { code: foundCode, custody: "with_me" } });
    expect(ownerMatch!.score).toBeGreaterThanOrEqual(85);
    expect(ownerMatch!.reasons).toMatchObject({ size: "same", sex: "same", color: "same", breed: "same" });

    const finderMatches = await listMyMatches(finder.client, foundCode);
    expect(finderMatches).toHaveLength(1);
    expect(finderMatches[0]).toMatchObject({ role: "finder", lost: { code: lostCode, contactChat: true } });

    expect(await listMyMatches(stranger.client)).toEqual([]);
    const ownerN = (await listNotifications(tutor.client, tutor.id)).find((n) => n.kind === "match_new");
    expect(ownerN).toMatchObject({ title: "Radar MEL: possível correspondência para Mel", href: "/perfil/correspondencias" });
    const [finderN] = await listNotifications(finder.client, finder.id);
    expect(finderN).toMatchObject({ kind: "match_new", href: `/encontrado/${foundCode}#radar` });

    // O tutor fala com quem encontrou; a pessoa vê a conversa depois da 1ª mensagem.
    const convId = await openConversationFromMatch(tutor.client, ownerMatch!.id);
    await expect(openConversationFromMatch(stranger.client, ownerMatch!.id)).rejects.toThrow("Correspondência não encontrada.");
    expect((await getConversation(tutor.client, convId))!).toMatchObject({ fromFound: true, peerIsAnonymous: true });
    await sendMessage(tutor.client, convId, tutor.id, "Oi! Acho que é a Mel. Ela tem alguma marca?");
    const [c] = await listMyConversations(finder.client);
    expect(c).toMatchObject({ id: convId, myRole: "helper" });

    // "Não é o meu": some só para quem dispensou.
    await dismissMatch(tutor.client, ownerMatch!.id);
    expect((await listMyMatches(tutor.client)).some((m) => m.id === ownerMatch!.id)).toBe(false);
    expect(await listMyMatches(finder.client, foundCode)).toHaveLength(1);
    await expect(dismissMatch(stranger.client, ownerMatch!.id)).rejects.toThrow();
  });

  it("lost after found: activating an alert near an existing found pet creates the match", async () => {
    const finder = await anonymousFinder();
    const foundCode = await createFoundCase(finder.client, finder.id, found({ position: { lat: -23.552, lng: -46.635 } }));
    const luna = async () => (await listMyMatches(finder.client, foundCode)).find((m) => m.lost.petName === "Luna");
    const draftId = await lostYorkie("Luna", false);
    expect(await luna()).toBeUndefined(); // rascunho não entra no Radar
    await activateLostCase(tutor.client, draftId);
    expect(await luna()).toMatchObject({ role: "finder" });
  });

  it("does not match a cat with a dog, nor animals far away", async () => {
    const lostCode = await lostYorkie("Thor");
    const finder = await anonymousFinder();
    const catCode = await createFoundCase(finder.client, finder.id, found({ species: "cat", breedGuess: null }));
    const farCode = await createFoundCase(finder.client, finder.id, found({ position: { lat: -23.7, lng: -46.633308 } }));
    const codes = (await listMyMatches(tutor.client)).filter((m) => m.lost.code === lostCode).map((m) => m.found.code);
    expect(codes).not.toContain(catCode);
    expect(codes).not.toContain(farCode);
  });

  it("the SQL score is identical to the TypeScript score (parity)", async () => {
    const base: MatchSide = { ...yorkie, colorsSecondary: ["preto"], position: SE, at: "2026-10-28T12:00:00-03:00" };
    const cases: [MatchSide, MatchSide][] = [
      [base, { ...base, colorsSecondary: [], position: NEAR, at: "2026-10-28T14:00:00-03:00" }],
      [base, { ...base, sex: "male", size: "small", colorPrimary: "preto", colorsSecondary: [], position: { lat: -23.58, lng: -46.62 }, at: "2026-11-05T09:30:00-03:00" }],
      [base, { ...base, sex: "unknown", size: null, colorPrimary: null, breed: null, colorsSecondary: [], position: { lat: -23.6, lng: -46.7 }, at: "2026-11-20T00:00:00-03:00" }],
      [{ ...base, breed: null, size: "large" }, { ...base, size: "giant", breed: "SRD", colorPrimary: "branco", colorsSecondary: ["caramelo"], position: { lat: -23.555, lng: -46.64 }, at: "2026-10-27T13:00:00-03:00" }],
    ];
    for (const [l, f] of cases) {
      const { data, error } = await tutor.client.rpc("debug_match_score", {
        p: {
          l_species: l.species, l_size: l.size, l_sex: l.sex, l_color: l.colorPrimary, l_colors: l.colorsSecondary, l_breed: l.breed,
          l_lat: l.position.lat, l_lng: l.position.lng, l_lost_at: l.at,
          f_species: f.species, f_size: f.size, f_sex: f.sex, f_color: f.colorPrimary, f_colors: f.colorsSecondary, f_breed: f.breed,
          f_lat: f.position.lat, f_lng: f.position.lng, f_found_at: f.at,
        },
      });
      expect(error).toBeNull();
      expect(data).toEqual(computeMatchScore(l, f));
    }
  });
});

describe("closing a found case", () => {
  it("only the finder closes it", async () => {
    const finder = await anonymousFinder();
    const code = await createFoundCase(finder.client, finder.id, found({ species: "other", breedGuess: null }));
    await expect(closeFoundCase(stranger.client, code, "REUNITED")).rejects.toThrow("Publicação não encontrada.");
    await closeFoundCase(finder.client, code, "REUNITED");
    expect((await getPublicFoundCase(anonClient(), code))!.status).toBe("REUNITED");
  });
});
