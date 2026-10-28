import type { FoundInput, MatchView, PublicFoundCase } from "@mel/core";
import { DataError, type MelClient } from "./client";

// Fotos de "encontrei" usam o mesmo bucket dos avistamentos (pasta da sessão).
const mediaUrl = (client: MelClient, path: string) => client.storage.from("sighting-media").getPublicUrl(path).data.publicUrl;
const petPhotoUrl = (client: MelClient, path: string) => client.storage.from("pet-photos").getPublicUrl(path).data.publicUrl;

// Mensagens do banco (limites, datas, foto) já são humanas.
function fail(error: { message: string; code?: string }): never {
  throw new DataError(error.message, error.code);
}

/**
 * Publica "Encontrei / Vi um pet". Chamado pelo servidor (rota com captcha)
 * com a sessão da pessoa. O banco cria o código, o ponto aproximado e roda o Radar.
 */
export async function createFoundCase(client: MelClient, reporterId: string, input: FoundInput): Promise<string> {
  const { data, error } = await client
    .from("found_cases")
    .insert({
      reporter_id: reporterId,
      species: input.species,
      size: input.size,
      sex: input.sex,
      color_primary: input.colorPrimary,
      colors_secondary: input.colorsSecondary,
      breed_guess: input.breedGuess,
      description: input.description,
      lat: input.position.lat,
      lng: input.position.lng,
      public_area_label: input.areaLabel,
      found_at: input.foundAt,
      custody: input.custody,
      custody_notes: input.custodyNotes,
      verification_hint: input.verificationHint,
      photo_path: input.photoPath,
    } as never)
    .select("short_code")
    .single();
  if (error) fail(error);
  return (data as { short_code: string }).short_code;
}

interface FoundJson {
  code: string;
  status: PublicFoundCase["status"];
  species: PublicFoundCase["species"];
  breed_guess: string | null;
  sex: PublicFoundCase["sex"];
  size: PublicFoundCase["size"];
  color_primary: PublicFoundCase["colorPrimary"];
  colors_secondary: PublicFoundCase["colorsSecondary"];
  description: string | null;
  public_lat: number | null;
  public_lng: number | null;
  area_label: string | null;
  found_at: string;
  custody: PublicFoundCase["custody"];
  photo_path: string | null;
  is_reporter: boolean;
  verification_hint: string | null;
}

export async function getPublicFoundCase(client: MelClient, code: string): Promise<PublicFoundCase | null> {
  const { data, error } = await client.rpc("get_public_found_case", { p_code: code });
  if (error) fail(error);
  const f = data as unknown as FoundJson | null;
  if (!f) return null;
  return {
    code: f.code,
    status: f.status,
    species: f.species,
    breedGuess: f.breed_guess,
    sex: f.sex,
    size: f.size,
    colorPrimary: f.color_primary,
    colorsSecondary: f.colors_secondary ?? [],
    description: f.description,
    point: f.public_lat != null && f.public_lng != null ? { lat: f.public_lat, lng: f.public_lng } : null,
    areaLabel: f.area_label,
    foundAt: f.found_at,
    custody: f.custody,
    photoUrl: f.photo_path ? mediaUrl(client, f.photo_path) : null,
    isReporter: f.is_reporter,
    verificationHint: f.verification_hint,
  };
}

/** Quem publicou encerra: devolvido ao tutor ou não está mais com a pessoa. */
export async function closeFoundCase(client: MelClient, code: string, status: "REUNITED" | "CLOSED"): Promise<void> {
  const { error } = await client.rpc("close_found_case", { p_code: code, p_status: status });
  if (error) fail(error);
}

interface MatchJson {
  id: string;
  role: MatchView["role"];
  score: number;
  reasons: MatchView["reasons"];
  created_at: string;
  lost: {
    code: string;
    status: string;
    pet_name: string;
    species: MatchView["lost"]["species"];
    breed: string | null;
    area_label: string | null;
    lost_at: string | null;
    contact_chat: boolean;
    photo_path: string | null;
  };
  found: {
    code: string;
    status: string;
    species: MatchView["found"]["species"];
    breed_guess: string | null;
    size: MatchView["found"]["size"];
    color_primary: string | null;
    area_label: string | null;
    found_at: string;
    custody: string;
    photo_path: string | null;
  };
}

/** Correspondências do Radar que eu posso ver (tutor ou quem encontrou). */
export async function listMyMatches(client: MelClient, foundCode?: string): Promise<MatchView[]> {
  const { data, error } = await client.rpc("get_my_matches", foundCode ? { p_found_code: foundCode } : {});
  if (error) fail(error);
  return ((data as unknown as MatchJson[]) ?? []).map((m) => ({
    id: m.id,
    role: m.role,
    score: m.score,
    reasons: m.reasons,
    createdAt: m.created_at,
    lost: {
      code: m.lost.code,
      status: m.lost.status,
      petName: m.lost.pet_name,
      species: m.lost.species,
      breed: m.lost.breed,
      areaLabel: m.lost.area_label,
      lostAt: m.lost.lost_at,
      contactChat: m.lost.contact_chat,
      photoUrl: m.lost.photo_path ? petPhotoUrl(client, m.lost.photo_path) : null,
    },
    found: {
      code: m.found.code,
      status: m.found.status,
      species: m.found.species,
      breedGuess: m.found.breed_guess,
      size: m.found.size,
      colorPrimary: m.found.color_primary,
      areaLabel: m.found.area_label,
      foundAt: m.found.found_at,
      custody: m.found.custody,
      photoUrl: m.found.photo_path ? mediaUrl(client, m.found.photo_path) : null,
    },
  }));
}

export async function dismissMatch(client: MelClient, id: string): Promise<void> {
  const { error } = await client.rpc("dismiss_match", { p_id: id });
  if (error) fail(error);
}

/** Tutor abre (ou retoma) a conversa com quem encontrou um pet parecido. */
export async function openConversationFromMatch(client: MelClient, id: string): Promise<string> {
  const { data, error } = await client.rpc("open_conversation_from_match", { p_id: id });
  if (error) fail(error);
  return data as string;
}
