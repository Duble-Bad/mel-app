import type { AdoptionInput, AdoptionInstitution, AdoptionMapItem, AdoptionStatus, InterestInput, LatLng, PetSize, PublicAdoption, Species } from "@mel/core";
import { DataError, type MelClient } from "./client";
import { randomId } from "./randomId";

function fail(error: { message: string; code?: string }): never {
  throw new DataError(error.message, error.code);
}

const photoUrl = (client: MelClient, path: string) => client.storage.from("pet-photos").getPublicUrl(path).data.publicUrl;

/** Foto do anúncio (já reduzida, sem EXIF) na pasta de quem doa. */
export async function uploadAdoptionPhoto(client: MelClient, userId: string, image: Blob): Promise<string> {
  const ext = image.type === "image/jpeg" ? "jpg" : image.type === "image/png" ? "png" : "webp";
  const path = `${userId}/adocao/${randomId()}.${ext}`;
  const { error } = await client.storage.from("pet-photos").upload(path, image, { contentType: image.type, cacheControl: "31536000", upsert: false });
  if (error) throw new DataError(error.message, undefined, { context: "upload" });
  return path;
}

/** Publica (entra em análise da moderação). Devolve o código. */
export async function createAdoption(client: MelClient, ownerId: string, a: AdoptionInput): Promise<string> {
  const { data, error } = await client
    .from("adoption_listings")
    .insert({
      owner_id: ownerId,
      name: a.name,
      species: a.species,
      sex: a.sex,
      size: a.size,
      age_months: a.ageMonths,
      breed: a.breed,
      color_primary: a.colorPrimary,
      temperament: a.temperament,
      neutered: a.neutered,
      vaccinated: a.vaccinated,
      dewormed: a.dewormed,
      description: a.description,
      requirements: a.requirements,
      lat: a.position.lat,
      lng: a.position.lng,
      public_area_label: a.areaLabel,
      photo_paths: a.photoPaths,
    } as never)
    .select("short_code")
    .single();
  if (error) fail(error);
  return (data as { short_code: string }).short_code;
}

interface AdoptionJson {
  code: string;
  status: AdoptionStatus;
  name: string;
  species: Species;
  sex: PublicAdoption["sex"];
  size: PetSize | null;
  age_months: number | null;
  breed: string | null;
  color_primary: PublicAdoption["colorPrimary"];
  temperament: PublicAdoption["temperament"];
  neutered: boolean | null;
  vaccinated: boolean | null;
  dewormed: boolean | null;
  description: string;
  requirements: string | null;
  area_label: string | null;
  photo_paths: string[];
  published_at: string | null;
  is_owner: boolean;
  review_note: string | null;
  interests: number | null;
  my_interest?: boolean;
  institution?: InstitutionJson | null;
}

interface InstitutionJson {
  code: string;
  name: string;
  kind: "ngo" | "company";
  address_public: boolean;
}

const toInstitution = (i: InstitutionJson | null | undefined): AdoptionInstitution | null =>
  i ? { code: i.code, name: i.name, kind: i.kind, addressPublic: i.address_public === true } : null;

const toAdoption = (client: MelClient, a: AdoptionJson): PublicAdoption => ({
  code: a.code,
  status: a.status,
  name: a.name,
  species: a.species,
  sex: a.sex,
  size: a.size,
  ageMonths: a.age_months,
  breed: a.breed,
  colorPrimary: a.color_primary,
  temperament: a.temperament ?? [],
  neutered: a.neutered,
  vaccinated: a.vaccinated,
  dewormed: a.dewormed,
  description: a.description,
  requirements: a.requirements,
  areaLabel: a.area_label,
  photoUrls: (a.photo_paths ?? []).map((p) => photoUrl(client, p)),
  publishedAt: a.published_at,
  isOwner: a.is_owner,
  reviewNote: a.review_note,
  interests: a.interests,
  myInterest: a.my_interest === true,
  institution: toInstitution(a.institution),
});

export async function getAdoption(client: MelClient, code: string): Promise<PublicAdoption | null> {
  const { data, error } = await client.rpc("get_public_adoption", { p_code: code });
  if (error) fail(error);
  return data ? toAdoption(client, data as unknown as AdoptionJson) : null;
}

export async function listAdoptions(
  client: MelClient,
  f: { species?: Species[]; sizes?: PetSize[]; page?: number; pageSize?: number } = {},
): Promise<{ items: PublicAdoption[]; total: number }> {
  const pageSize = f.pageSize ?? 24;
  const { data, error } = await client.rpc("list_adoptions", {
    p_species: f.species?.length ? f.species : undefined,
    p_size: f.sizes?.length ? f.sizes : undefined,
    p_limit: pageSize,
    p_offset: ((f.page ?? 1) - 1) * pageSize,
  });
  if (error) fail(error);
  const res = data as unknown as { total: number; items: AdoptionJson[] };
  return { total: res.total, items: res.items.map((a) => toAdoption(client, a)) };
}

/** Quem doa: disponível ⇄ em processo ⇄ adotado. */
export async function setAdoptionStatus(client: MelClient, code: string, status: "AVAILABLE" | "IN_PROCESS" | "ADOPTED"): Promise<void> {
  const { error, count } = await client.from("adoption_listings").update({ status } as never, { count: "exact" }).eq("short_code", code);
  if (error) fail(error);
  if (!count) throw new DataError("Você não pode alterar este anúncio.", "42501", { trusted: true });
}

/** Interesse (conta real): abre/retoma a conversa com quem doa. Devolve o id da conversa. */
export async function submitAdoptionInterest(client: MelClient, code: string, i: InterestInput): Promise<string> {
  const { data, error } = await client.rpc("submit_adoption_interest", {
    p_code: code,
    p_housing: i.housing,
    p_other_pets: i.otherPets,
    // Opcional: null = não informado (o tipo gerado não expressa argumento nulo).
    p_children: i.children as boolean,
    p_message: i.message,
  });
  if (error) fail(error);
  return data as string;
}

/** Cancela o próprio interesse num anúncio (a linha é apagada). false = não havia interesse. */
export async function withdrawAdoptionInterest(client: MelClient, code: string): Promise<boolean> {
  const { data, error } = await client.rpc("withdraw_adoption_interest", { p_code: code });
  if (error) fail(error);
  return data === true;
}

export async function listAdoptionsForReview(client: MelClient): Promise<PublicAdoption[]> {
  const { data, error } = await client.rpc("admin_list_adoptions_for_review");
  if (error) fail(error);
  return ((data as unknown as AdoptionJson[]) ?? []).map((a) => toAdoption(client, a));
}

export async function reviewAdoption(client: MelClient, code: string, approve: boolean, note?: string): Promise<void> {
  const { error } = await client.rpc("admin_review_adoption", { p_code: code, p_approve: approve, p_note: note });
  if (error) fail(error);
}

interface AdoptionMapJson {
  code: string;
  name: string;
  species: Species;
  size: PetSize | null;
  sex: AdoptionMapItem["sex"];
  age_months: number | null;
  area_label: string | null;
  photo_path: string | null;
  published_at: string | null;
  lat: number;
  lng: number;
  distance_m: number | null;
  institution: InstitutionJson | null;
}

/**
 * Anúncios no mapa da rede, pelo ponto público aproximado. Vazio quando o
 * administrador não ligou "mostrar adoção no mapa" (o banco decide).
 */
export async function searchAdoptionsOnMap(
  client: MelClient,
  f: { center: LatLng; radiusKm: number; species?: Species[] },
): Promise<AdoptionMapItem[]> {
  const { data, error } = await client.rpc("search_adoptions_on_map", {
    p_lat: f.center.lat,
    p_lng: f.center.lng,
    p_radius_m: Math.round(f.radiusKm * 1000),
    p_species: f.species?.length ? f.species : undefined,
  });
  if (error) fail(error);
  return ((data as unknown as AdoptionMapJson[]) ?? []).map((a) => ({
    code: a.code,
    name: a.name,
    species: a.species,
    size: a.size,
    sex: a.sex,
    ageMonths: a.age_months,
    areaLabel: a.area_label,
    photoUrl: a.photo_path ? photoUrl(client, a.photo_path) : null,
    publishedAt: a.published_at,
    position: { lat: a.lat, lng: a.lng },
    distanceM: a.distance_m,
    institution: toInstitution(a.institution),
  }));
}
