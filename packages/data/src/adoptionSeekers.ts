import type { AdoptionSeeker, PetSize, PublicSeeker, SeekerAge, SeekerForReview, SeekerInput, SeekerSpecies } from "@mel/core";
import { DataError, type MelClient } from "./client";

/** Fila de interessados ("Quero adotar") — escrita só pelas funções do banco (migration 20261106122000). */

function fail(error: { message: string; code?: string }): never {
  throw new DataError(error.message, error.code);
}

interface SeekerJson {
  id: string;
  status: AdoptionSeeker["status"];
  species: SeekerSpecies;
  sizes: PetSize[] | null;
  ages: SeekerAge[] | null;
  area_lat: number;
  area_lng: number;
  area_label: string;
  radius_m: number;
  housing: AdoptionSeeker["housing"];
  other_pets: AdoptionSeeker["otherPets"];
  children: boolean | null;
  routine: string;
  whatsapp?: string | null;
  notify: boolean;
  show_public: boolean;
  review_note: string | null;
  reviewed_at: string | null;
  expires_at: string;
  created_at: string;
  first_name: string | null;
}

const toSeeker = (s: SeekerJson): AdoptionSeeker => ({
  id: s.id,
  status: s.status,
  species: s.species,
  sizes: s.sizes ?? [],
  ages: s.ages ?? [],
  area: { lat: s.area_lat, lng: s.area_lng },
  areaLabel: s.area_label,
  radiusM: s.radius_m,
  housing: s.housing,
  otherPets: s.other_pets,
  children: s.children,
  routine: s.routine,
  whatsapp: s.whatsapp ?? null,
  notify: s.notify,
  showPublic: s.show_public,
  reviewNote: s.review_note,
  reviewedAt: s.reviewed_at,
  expiresAt: s.expires_at,
  createdAt: s.created_at,
  firstName: s.first_name || null,
});

/** O próprio perfil na fila, ou null. */
export async function getMyAdoptionSeeker(client: MelClient): Promise<AdoptionSeeker | null> {
  const { data, error } = await client.rpc("get_my_adoption_seeker");
  if (error) fail(error);
  return data ? toSeeker(data as unknown as SeekerJson) : null;
}

/** Cria ou edita (mudança de conteúdo volta para a moderação). */
export async function saveMyAdoptionSeeker(client: MelClient, s: SeekerInput): Promise<AdoptionSeeker> {
  const { data, error } = await client.rpc("save_my_adoption_seeker", {
    p_species: s.species,
    p_sizes: s.sizes,
    p_ages: s.ages,
    p_area_lat: s.area.lat,
    p_area_lng: s.area.lng,
    p_area_label: s.areaLabel,
    p_radius_m: s.radiusM,
    p_housing: s.housing,
    p_other_pets: s.otherPets,
    // Opcionais: null = não informado (o tipo gerado não expressa argumento nulo).
    p_children: s.children as boolean,
    p_routine: s.routine,
    p_whatsapp: s.whatsapp as string,
    p_notify: s.notify,
    p_show_public: s.showPublic,
    p_consent: s.consent,
  });
  if (error) fail(error);
  return toSeeker(data as unknown as SeekerJson);
}

/** "Pausar avisos" / "Retomar avisos". */
export async function setMyAdoptionSeekerNotify(client: MelClient, enabled: boolean): Promise<void> {
  const { error } = await client.rpc("set_my_adoption_seeker_notify", { p_enabled: enabled });
  if (error) fail(error);
}

/** "Renovar": mais 90 dias. Devolve a nova validade. */
export async function renewMyAdoptionSeeker(client: MelClient): Promise<string> {
  const { data, error } = await client.rpc("renew_my_adoption_seeker");
  if (error) fail(error);
  return data as string;
}

/** "Cancelar meu interesse": apaga o perfil. */
export async function withdrawMyAdoptionSeeker(client: MelClient): Promise<boolean> {
  const { data, error } = await client.rpc("withdraw_my_adoption_seeker");
  if (error) fail(error);
  return data === true;
}

/** Lista pública "Querem adotar": só primeiro nome, bairro/cidade e preferências. */
export async function listPublicAdoptionSeekers(
  client: MelClient,
  f: { species?: "dog" | "cat"; page?: number; pageSize?: number } = {},
): Promise<{ items: PublicSeeker[]; total: number }> {
  const pageSize = f.pageSize ?? 24;
  const { data, error } = await client.rpc("list_public_adoption_seekers", {
    p_species: f.species,
    p_limit: pageSize,
    p_offset: ((f.page ?? 1) - 1) * pageSize,
  });
  if (error) fail(error);
  const res = data as unknown as {
    total: number;
    items: Array<{ first_name: string | null; area_label: string; species: SeekerSpecies; sizes: PetSize[] | null; ages: SeekerAge[] | null }>;
  };
  return {
    total: res.total,
    items: res.items.map((i) => ({ firstName: i.first_name, areaLabel: i.area_label, species: i.species, sizes: i.sizes ?? [], ages: i.ages ?? [] })),
  };
}

/** Moderação: perfis em análise (com o WhatsApp privado). */
export async function listAdoptionSeekersForReview(client: MelClient): Promise<SeekerForReview[]> {
  const { data, error } = await client.rpc("admin_list_adoption_seekers_for_review");
  if (error) fail(error);
  return ((data as unknown as SeekerJson[]) ?? []).map(toSeeker);
}

/** Moderação: aprovar ou recusar (recusar exige motivo). */
export async function reviewAdoptionSeeker(client: MelClient, id: string, approve: boolean, note?: string): Promise<void> {
  const { error } = await client.rpc("admin_review_adoption_seeker", { p_id: id, p_approve: approve, p_note: note });
  if (error) fail(error);
}

/** Agendador (chave secreta): apaga o que venceu e manda o lembrete "Ainda procura?". */
export async function runAdoptionRetention(
  service: MelClient,
): Promise<{ interestsRemoved: number; seekersRemoved: number; reminded: number }> {
  const { data, error } = await service.rpc("run_adoption_retention", {});
  if (error) fail(error);
  const r = data as { interests_removed: number; seekers_removed: number; reminded: number };
  return { interestsRemoved: r.interests_removed, seekersRemoved: r.seekers_removed, reminded: r.reminded };
}
