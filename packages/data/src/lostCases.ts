import type { LatLng, LostCase, LostStatus, PetColor, PublicLostCase, Wearing } from "@mel/core";
import { DataError, type MelClient } from "./client";
import type { Database } from "./database.types";

type Row = Database["public"]["Tables"]["lost_cases"]["Row"];

const COLUMNS =
  "id, short_code, pet_id, owner_id, status, last_seen_lat, last_seen_lng, last_seen_label, public_point_exact, " +
  "public_area_label, city, state, lost_at, lost_at_uncertain, wearing, notes, contact_chat, contact_whatsapp_public, " +
  "contact_phone_public, contact_phone, published_at";

type CaseRow = Pick<
  Row,
  | "id"
  | "short_code"
  | "pet_id"
  | "owner_id"
  | "status"
  | "last_seen_lat"
  | "last_seen_lng"
  | "last_seen_label"
  | "public_point_exact"
  | "public_area_label"
  | "city"
  | "state"
  | "lost_at"
  | "lost_at_uncertain"
  | "wearing"
  | "notes"
  | "contact_chat"
  | "contact_whatsapp_public"
  | "contact_phone_public"
  | "contact_phone"
  | "published_at"
>;

function toCase(r: CaseRow): LostCase {
  return {
    id: r.id,
    code: r.short_code,
    petId: r.pet_id,
    ownerId: r.owner_id,
    status: r.status,
    lastSeen: r.last_seen_lat != null && r.last_seen_lng != null ? { lat: r.last_seen_lat, lng: r.last_seen_lng } : null,
    lastSeenLabel: r.last_seen_label,
    publicPointExact: r.public_point_exact,
    publicAreaLabel: r.public_area_label,
    city: r.city,
    state: r.state,
    lostAt: r.lost_at,
    lostAtUncertain: r.lost_at_uncertain,
    wearing: r.wearing as Wearing[],
    notes: r.notes,
    contactChat: r.contact_chat,
    contactWhatsappPublic: r.contact_whatsapp_public,
    contactPhonePublic: r.contact_phone_public,
    contactPhone: r.contact_phone,
    publishedAt: r.published_at,
  };
}

/** Mensagens humanas para erros do banco neste fluxo. */
function fail(error: { message: string; code?: string }): never {
  if (error.code === "23505") throw new DataError("Este pet já tem um alerta aberto.", error.code);
  if (error.code === "22023") throw new DataError(error.message, error.code); // mensagens do trigger já são humanas
  throw new DataError(error.message, error.code);
}

export interface LostCasePatch {
  lastSeen?: LatLng;
  lastSeenLabel?: string | null;
  publicAreaLabel?: string | null;
  publicPointExact?: boolean;
  city?: string | null;
  state?: string | null;
  lostAt?: string;
  lostAtUncertain?: boolean;
  wearing?: Wearing[];
  notes?: string | null;
  contactChat?: boolean;
  contactWhatsappPublic?: boolean;
  contactPhonePublic?: boolean;
  contactPhone?: string | null;
}

function patchToRow(p: LostCasePatch) {
  return {
    ...(p.lastSeen ? { last_seen_lat: p.lastSeen.lat, last_seen_lng: p.lastSeen.lng } : {}),
    ...(p.lastSeenLabel !== undefined ? { last_seen_label: p.lastSeenLabel } : {}),
    ...(p.publicAreaLabel !== undefined ? { public_area_label: p.publicAreaLabel } : {}),
    ...(p.publicPointExact !== undefined ? { public_point_exact: p.publicPointExact } : {}),
    ...(p.city !== undefined ? { city: p.city } : {}),
    ...(p.state !== undefined ? { state: p.state } : {}),
    ...(p.lostAt !== undefined ? { lost_at: p.lostAt } : {}),
    ...(p.lostAtUncertain !== undefined ? { lost_at_uncertain: p.lostAtUncertain } : {}),
    ...(p.wearing !== undefined ? { wearing: p.wearing } : {}),
    ...(p.notes !== undefined ? { notes: p.notes } : {}),
    ...(p.contactChat !== undefined ? { contact_chat: p.contactChat } : {}),
    ...(p.contactWhatsappPublic !== undefined ? { contact_whatsapp_public: p.contactWhatsappPublic } : {}),
    ...(p.contactPhonePublic !== undefined ? { contact_phone_public: p.contactPhonePublic } : {}),
    ...(p.contactPhone !== undefined ? { contact_phone: p.contactPhone } : {}),
  };
}

/** Rascunho em andamento do tutor (o mais recente), para retomar o fluxo. */
export async function getMyDraft(client: MelClient, ownerId: string): Promise<LostCase | null> {
  const { data, error } = await client
    .from("lost_cases")
    .select(COLUMNS)
    .eq("owner_id", ownerId)
    .eq("status", "DRAFT")
    .order("updated_at", { ascending: false })
    .limit(1)
    .returns<CaseRow[]>()
    .maybeSingle();
  if (error) fail(error);
  return data ? toCase(data) : null;
}

export async function listMyLostCases(client: MelClient, ownerId: string): Promise<LostCase[]> {
  const { data, error } = await client
    .from("lost_cases")
    .select(COLUMNS)
    .eq("owner_id", ownerId)
    .in("status", ["DRAFT", "ACTIVE", "FOUND"])
    .order("created_at", { ascending: false })
    .returns<CaseRow[]>();
  if (error) fail(error);
  return data.map(toCase);
}

/** Abre (ou reaproveita) o rascunho do pet. */
export async function startLostCase(client: MelClient, ownerId: string, petId: string): Promise<LostCase> {
  const { data: existing, error: findError } = await client
    .from("lost_cases")
    .select(COLUMNS)
    .eq("pet_id", petId)
    .in("status", ["DRAFT", "ACTIVE"])
    .returns<CaseRow[]>()
    .maybeSingle();
  if (findError) fail(findError);
  if (existing) return toCase(existing);

  const { data, error } = await client
    .from("lost_cases")
    .insert({ owner_id: ownerId, pet_id: petId })
    .select(COLUMNS)
    .returns<CaseRow[]>()
    .single();
  if (error) fail(error);
  return toCase(data);
}

export async function updateLostCase(client: MelClient, id: string, patch: LostCasePatch): Promise<LostCase> {
  const { data, error } = await client
    .from("lost_cases")
    .update(patchToRow(patch))
    .eq("id", id)
    .select(COLUMNS)
    .returns<CaseRow[]>()
    .single();
  if (error) fail(error);
  return toCase(data);
}

/** Troca o pet de um rascunho: apaga o rascunho atual e abre outro para o novo pet. */
export async function discardDraft(client: MelClient, id: string): Promise<void> {
  const { error } = await client.from("lost_cases").delete().eq("id", id).eq("status", "DRAFT");
  if (error) fail(error);
}

/** ATIVAR ALERTA MEL: o banco valida onde/quando e registra a publicação. */
export async function activateLostCase(client: MelClient, id: string): Promise<LostCase> {
  const { data, error } = await client
    .from("lost_cases")
    .update({ status: "ACTIVE" satisfies LostStatus })
    .eq("id", id)
    .select(COLUMNS)
    .returns<CaseRow[]>()
    .single();
  if (error) fail(error);
  return toCase(data);
}

// ---------------------------------------------------------------------------
// Leitura pública
// ---------------------------------------------------------------------------

interface PublicCaseJson {
  code: string;
  status: LostStatus;
  lost_at: string | null;
  lost_at_uncertain: boolean;
  published_at: string | null;
  found_at: string | null;
  public_lat: number | null;
  public_lng: number | null;
  public_point_exact: boolean;
  area_label: string | null;
  city: string | null;
  state: string | null;
  wearing: Wearing[];
  notes: string | null;
  contact_chat: boolean;
  contact_whatsapp: string | null;
  contact_phone: string | null;
  indexable: boolean;
  is_owner: boolean;
  pet: {
    name: string;
    species: PublicLostCase["pet"]["species"];
    breed: string | null;
    sex: PublicLostCase["pet"]["sex"];
    size: PublicLostCase["pet"]["size"];
    color_primary: string | null;
    colors_secondary: string[];
    unique_marks: string | null;
    description: string | null;
    mel_id: string;
    birth_date: string | null;
    age_estimate_months: number | null;
    weight_kg: number | null;
    photos: { path: string; thumb_path: string; is_primary: boolean }[];
  };
}

const photoUrl = (client: MelClient, path: string) => client.storage.from("pet-photos").getPublicUrl(path).data.publicUrl;

/** Página pública do alerta. null quando não existe ou não está publicado. */
export async function getPublicLostCase(client: MelClient, code: string): Promise<PublicLostCase | null> {
  const { data, error } = await client.rpc("get_public_lost_case", { p_code: code });
  if (error) fail(error);
  const c = data as unknown as PublicCaseJson | null;
  if (!c) return null;
  return {
    code: c.code,
    status: c.status,
    lostAt: c.lost_at,
    lostAtUncertain: c.lost_at_uncertain,
    publishedAt: c.published_at,
    foundAt: c.found_at,
    point: c.public_lat != null && c.public_lng != null ? { lat: c.public_lat, lng: c.public_lng } : null,
    pointIsExact: c.public_point_exact,
    areaLabel: c.area_label,
    city: c.city,
    state: c.state,
    wearing: c.wearing,
    notes: c.notes,
    contactChat: c.contact_chat,
    contactWhatsapp: c.contact_whatsapp,
    contactPhone: c.contact_phone,
    indexable: c.indexable,
    isOwner: c.is_owner,
    pet: {
      name: c.pet.name,
      species: c.pet.species,
      breed: c.pet.breed,
      sex: c.pet.sex,
      size: c.pet.size,
      colorPrimary: c.pet.color_primary as PetColor | null,
      colorsSecondary: c.pet.colors_secondary as PetColor[],
      uniqueMarks: c.pet.unique_marks,
      description: c.pet.description,
      melId: c.pet.mel_id,
      birthDate: c.pet.birth_date,
      ageEstimateMonths: c.pet.age_estimate_months,
      weightKg: c.pet.weight_kg,
      photos: c.pet.photos.map((p) => ({
        url: photoUrl(client, p.path),
        thumbUrl: photoUrl(client, p.thumb_path),
        isPrimary: p.is_primary,
      })),
    },
  };
}

export interface NearbyLostCase {
  code: string;
  petName: string;
  species: PublicLostCase["pet"]["species"];
  breed: string | null;
  photoThumbUrl: string | null;
  areaLabel: string | null;
  lostAt: string | null;
  point: LatLng;
  distanceMeters: number;
}

/** Alertas ativos num raio (máx. 50 km), do mais perto ao mais longe. */
export async function nearbyLostCases(client: MelClient, origin: LatLng, radiusMeters = 5000, limit = 20): Promise<NearbyLostCase[]> {
  const { data, error } = await client.rpc("nearby_lost_cases", {
    p_lat: origin.lat,
    p_lng: origin.lng,
    p_radius_m: radiusMeters,
    p_limit: limit,
  });
  if (error) fail(error);
  return (data ?? []).map((r) => ({
    code: r.code,
    petName: r.pet_name,
    species: r.species,
    breed: r.breed,
    photoThumbUrl: r.photo_thumb_path ? photoUrl(client, r.photo_thumb_path) : null,
    areaLabel: r.area_label,
    lostAt: r.lost_at,
    point: { lat: r.public_lat, lng: r.public_lng },
    distanceMeters: r.distance_m,
  }));
}
