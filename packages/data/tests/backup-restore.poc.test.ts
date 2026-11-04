// Prova de backup e restauração (Launch Readiness 2E). Só roda no workflow
// manual backup-restore-drill.yml, contra dois Supabase LOCAIS e descartáveis:
//   MEL_BACKUP_POC=seed   → no banco A cria dados SINTÉTICOS (contas fictícias,
//                           pet, fotos, alerta, avistamento anônimo, encontrado,
//                           conversa, Guardião) e grava o gabarito em
//                           $MEL_BACKUP_POC_DIR/expected.json (fora do backup);
//   MEL_BACKUP_POC=verify → no banco B (recriado do zero e restaurado do backup)
//                           confere Auth, RLS, funções, privacidade e arquivos.
// Nenhum dado real: e-mails @exemplo.com, senhas geradas na hora.
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { foundInputSchema, guardianSettingsSchema, petInputSchema, sightingInputSchema } from "@mel/core";
import { ensureSession } from "../src/auth";
import { listMessages, startConversation } from "../src/chat";
import type { MelClient } from "../src/client";
import { createFoundCase, getPublicFoundCase } from "../src/found";
import { saveGuardianSettings } from "../src/guardian";
import { activateLostCase, getPublicLostCase, nearbyLostCases, startLostCase, updateLostCase } from "../src/lostCases";
import { addPetPhoto, createPet, getPet, getPetPrivateDetails, savePetPrivateDetails } from "../src/pets";
import { uploadAvatar } from "../src/profiles";
import { createSighting, getTimeline, uploadSightingPhoto } from "../src/sightings";
import { anonClient, serviceClient } from "./helpers";

const phase = process.env.MEL_BACKUP_POC;
const dir = process.env.MEL_BACKUP_POC_DIR ?? "/tmp/mel-backup-poc";
const PLACE = { lat: -19.9245, lng: -43.9352 }; // Praça Sete, Belo Horizonte (lugar público)
const minutesAgo = (m: number) => new Date(Date.now() - m * 60_000).toISOString();
// PNGs diferentes (1×1, cores distintas) para cada arquivo: o hash prova que cada um voltou no lugar certo.
const PNGS = [
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==",
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==",
].map((b) => Uint8Array.from(atob(b), (c) => c.charCodeAt(0)));
const png = (i: number) => new Blob([PNGS[i % PNGS.length]!], { type: "image/png" });
const sha = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
/** "pet-photos/<caminho>" a partir da URL pública do Storage. */
const storageKey = (url: string) => decodeURIComponent(url.split("/storage/v1/object/public/")[1]!.split("?")[0]!);

interface Account {
  id: string;
  email: string;
  password: string;
}

interface Expected {
  tutor: Account;
  finder: Account;
  stranger: Account;
  anon: { id: string; refreshToken: string };
  petId: string;
  lostCode: string;
  foundCode: string;
  sightingId: string;
  conversationId: string;
  privateMarks: string;
  /** bucket/caminho → sha256 do conteúdo enviado. */
  files: Record<string, string>;
}

const options = { auth: { persistSession: false, autoRefreshToken: false } };
const newClient = (): MelClient => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, options);

async function account(label: string): Promise<Account & { client: MelClient }> {
  const email = `backup-poc+${label}@exemplo.com`;
  const password = `Poc-${crypto.randomUUID()}`;
  const { data, error } = await serviceClient().auth.admin.createUser({ email, password, email_confirm: true });
  if (error || !data.user) throw error ?? new Error("createUser falhou");
  const client = newClient();
  const { error: e } = await client.auth.signInWithPassword({ email, password });
  if (e) throw e;
  return { id: data.user.id, email, password, client };
}

async function signIn(a: Account): Promise<MelClient> {
  const client = newClient();
  const { data, error } = await client.auth.signInWithPassword({ email: a.email, password: a.password });
  expect(error).toBeNull();
  expect(data.user?.id).toBe(a.id);
  return client;
}

describe.runIf(phase === "seed")("backup PoC — dados sintéticos no banco A", () => {
  it("cria contas, pet, fotos, alerta, avistamento, encontrado, conversa e Guardião", async () => {
    const files: Record<string, string> = {};
    const tutor = await account("tutor");
    const finder = await account("finder");
    const stranger = await account("stranger");

    // Avatar (bucket avatars) referenciado por URL no perfil.
    const avatarUrl = await uploadAvatar(tutor.client, tutor.id, png(0));
    await tutor.client.from("profiles").update({ avatar_url: avatarUrl, display_name: "Tutora Sintética", city: "Belo Horizonte", state: "MG" } as never).eq("id", tutor.id);
    files[storageKey(avatarUrl)] = sha(PNGS[0]!);

    // Pet com dados privados e foto (bucket pet-photos: original + miniatura).
    const created = await createPet(tutor.client, tutor.id, petInputSchema.parse({ name: "Biscoito", species: "dog", size: "small", sex: "male", colorPrimary: "caramelo" }));
    const privateMarks = `marca-sintética-${crypto.randomUUID().slice(0, 6)}`;
    await savePetPrivateDetails(tutor.client, created, { microchipNumber: null, hiddenMarks: privateMarks, ownershipNotes: null });
    await addPetPhoto(tutor.client, created, { full: png(1), thumb: png(2), width: 1, height: 1 }, 0);
    const pet = (await getPet(tutor.client, created.id))!;
    files[storageKey(pet.photos[0]!.url)] = sha(PNGS[1]!);
    files[storageKey(pet.photos[0]!.thumbUrl)] = sha(PNGS[2]!);

    // Alerta ativo com o ponto exato (o público só vê o aproximado).
    const draft = await startLostCase(tutor.client, tutor.id, pet.id);
    await updateLostCase(tutor.client, draft.id, { lastSeen: PLACE, lostAt: minutesAgo(90), publicAreaLabel: "Centro, Belo Horizonte – MG", contactChat: true });
    const lost = await activateLostCase(tutor.client, draft.id);

    // Avistamento de visitante anônimo com foto (sighting-media, nome neutro, posse no owner_id).
    const anon = newClient();
    const anonUser = await ensureSession(anon);
    const sightingPhoto = await uploadSightingPhoto(anon, png(3));
    files[`sighting-media/${sightingPhoto}`] = sha(PNGS[3]!);
    const sightingId = await createSighting(
      anon,
      sightingInputSchema.parse({ code: lost.code, position: { lat: PLACE.lat + 0.0004, lng: PLACE.lng + 0.0003 }, placeLabel: "Rua da Bahia, Centro, Belo Horizonte – MG", seenAt: minutesAgo(30), photoPath: sightingPhoto }),
    );
    const { data: refreshed } = await anon.auth.getSession();

    // Encontrado com foto + conversa no alerta + Guardião.
    const foundPhoto = await uploadSightingPhoto(finder.client, png(4));
    files[`sighting-media/${foundPhoto}`] = sha(PNGS[4]!);
    const foundCode = await createFoundCase(
      finder.client,
      finder.id,
      foundInputSchema.parse({ species: "dog", size: "small", sex: "male", colorPrimary: "caramelo", position: { lat: PLACE.lat + 0.002, lng: PLACE.lng }, areaLabel: "Centro, Belo Horizonte – MG", foundAt: minutesAgo(20), custody: "with_me", photoPath: foundPhoto }),
    );
    const conversationId = await startConversation(finder.client, lost.code, "Mensagem sintética: acho que vi o Biscoito.");
    await saveGuardianSettings(stranger.client, stranger.id, guardianSettingsSchema.parse({ area: PLACE, radiusM: 3000 }));

    const expected: Expected = {
      tutor: { id: tutor.id, email: tutor.email, password: tutor.password },
      finder: { id: finder.id, email: finder.email, password: finder.password },
      stranger: { id: stranger.id, email: stranger.email, password: stranger.password },
      anon: { id: anonUser.id, refreshToken: refreshed.session!.refresh_token },
      petId: pet.id,
      lostCode: lost.code,
      foundCode,
      sightingId,
      conversationId,
      privateMarks,
      files,
    };
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "expected.json"), JSON.stringify(expected));
    expect(Object.keys(files)).toHaveLength(6);
  });
});

describe.runIf(phase === "verify")("backup PoC — banco B restaurado", () => {
  const e = (): Expected => JSON.parse(readFileSync(join(dir, "expected.json"), "utf8"));

  it("Auth: as contas entram com a MESMA senha e o MESMO id; a sessão anônima continua (refresh token)", async () => {
    const x = e();
    for (const a of [x.tutor, x.finder, x.stranger]) await signIn(a);
    const anon = newClient();
    const { data, error } = await anon.auth.refreshSession({ refresh_token: x.anon.refreshToken });
    expect(error).toBeNull();
    expect(data.user?.id).toBe(x.anon.id);
    expect(data.user?.is_anonymous).toBe(true);
  });

  it("RLS: só a dona lê os dados privados do pet; outra conta e visitante não", async () => {
    const x = e();
    const tutor = await signIn(x.tutor);
    expect((await getPetPrivateDetails(tutor, x.petId)).hiddenMarks).toBe(x.privateMarks);
    const stranger = await signIn(x.stranger);
    expect((await stranger.from("pet_private_details").select("hidden_marks").eq("pet_id", x.petId)).data).toEqual([]);
    expect((await anonClient().from("pet_private_details").select("hidden_marks").eq("pet_id", x.petId)).data ?? []).toEqual([]);
  });

  it("funções e privacidade: alerta público com ponto aproximado; linha do tempo exata só para a tutora; Radar por distância", async () => {
    const x = e();
    const pub = (await getPublicLostCase(anonClient(), x.lostCode))!;
    expect(pub.areaLabel).toBe("Centro, Belo Horizonte – MG");
    const visitor = await getTimeline(anonClient(), x.lostCode);
    const forTutor = await getTimeline(await signIn(x.tutor), x.lostCode);
    expect(visitor.map((s) => s.id)).toEqual([x.sightingId]);
    expect(visitor[0]).toMatchObject({ pointIsExact: false, placeLabel: "Centro, Belo Horizonte – MG" });
    expect(forTutor[0]).toMatchObject({ pointIsExact: true, placeLabel: "Rua da Bahia, Centro, Belo Horizonte – MG" });
    expect((await nearbyLostCases(anonClient(), PLACE, 5000)).some((c) => c.code === x.lostCode)).toBe(true);
    expect(await getPublicFoundCase(anonClient(), x.foundCode)).not.toBeNull();
  });

  it("relações: a conversa e a mensagem voltaram para os participantes, e só para eles", async () => {
    const x = e();
    const finder = await signIn(x.finder);
    expect((await listMessages(finder, x.conversationId)).map((m) => m.body)).toEqual(["Mensagem sintética: acho que vi o Biscoito."]);
    const stranger = await signIn(x.stranger);
    expect((await stranger.from("messages").select("id").eq("conversation_id", x.conversationId)).data).toEqual([]);
  });

  it("arquivos: cada foto voltou no MESMO caminho com o MESMO conteúdo", async () => {
    const x = e();
    for (const [key, hash] of Object.entries(x.files)) {
      const [bucket, ...rest] = key.split("/");
      const { data, error } = await serviceClient().storage.from(bucket!).download(rest.join("/"));
      expect(error, key).toBeNull();
      expect(sha(new Uint8Array(await data!.arrayBuffer())), key).toBe(hash);
    }
    // A foto do pet continua acessível pelo caminho gravado no banco (referência íntegra).
    const pet = (await getPet(await signIn(x.tutor), x.petId))!;
    expect(storageKey(pet.photos[0]!.url) in x.files).toBe(true);
  });
});
