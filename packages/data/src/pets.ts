import type { BrState, Pet, PetColor, PetInput, PetPhoto, PetPrivateDetails, PetPrivateInput } from "@mel/core";
import { DataError, type MelClient } from "./client";
import type { Database } from "./database.types";

type PetRow = Database["public"]["Tables"]["pets"]["Row"];
type PhotoRow = Database["public"]["Tables"]["pet_photos"]["Row"];

const BUCKET = "pet-photos";
const PET_COLUMNS =
  "id, owner_id, mel_id, name, species, breed, sex, birth_date, age_estimate_months, size, weight_kg, " +
  "color_primary, colors_secondary, description, unique_marks, neutered, has_microchip, city, state, is_public, " +
  "pet_photos (id, storage_path, thumb_path, is_primary, position)";

type PetWithPhotos = PetRow & { pet_photos: Pick<PhotoRow, "id" | "storage_path" | "thumb_path" | "is_primary" | "position">[] };

function publicUrl(client: MelClient, path: string) {
  return client.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

function toPet(client: MelClient, row: PetWithPhotos): Pet {
  const photos: PetPhoto[] = [...row.pet_photos]
    .sort((a, b) => Number(b.is_primary) - Number(a.is_primary) || a.position - b.position)
    .map((p) => ({
      id: p.id,
      url: publicUrl(client, p.storage_path),
      thumbUrl: publicUrl(client, p.thumb_path),
      isPrimary: p.is_primary,
      position: p.position,
    }));
  return {
    id: row.id,
    ownerId: row.owner_id,
    melId: row.mel_id,
    name: row.name,
    species: row.species,
    breed: row.breed,
    sex: row.sex,
    birthDate: row.birth_date,
    ageEstimateMonths: row.age_estimate_months,
    size: row.size,
    weightKg: row.weight_kg,
    colorPrimary: row.color_primary as PetColor | null,
    colorsSecondary: row.colors_secondary as PetColor[],
    description: row.description,
    uniqueMarks: row.unique_marks,
    neutered: row.neutered,
    hasMicrochip: row.has_microchip,
    city: row.city,
    state: row.state as BrState | null,
    isPublic: row.is_public,
    photos,
  };
}

function toRow(input: PetInput) {
  return {
    name: input.name,
    species: input.species,
    breed: input.breed,
    sex: input.sex,
    birth_date: input.birthDate,
    // Data de nascimento conhecida dispensa a estimativa.
    age_estimate_months: input.birthDate ? null : input.ageEstimateMonths,
    size: input.size,
    weight_kg: input.weightKg,
    color_primary: input.colorPrimary,
    colors_secondary: input.colorsSecondary,
    description: input.description,
    unique_marks: input.uniqueMarks,
    neutered: input.neutered,
    has_microchip: input.hasMicrochip,
    city: input.city,
    state: input.state,
    is_public: input.isPublic,
  };
}

export async function listMyPets(client: MelClient, ownerId: string): Promise<Pet[]> {
  const { data, error } = await client
    .from("pets")
    .select(PET_COLUMNS)
    .eq("owner_id", ownerId)
    .order("created_at", { ascending: false })
    .returns<PetWithPhotos[]>();
  if (error) throw new DataError(error.message, error.code);
  return data.map((row) => toPet(client, row));
}

/** Pet por id, se visível para quem consulta (dono ou pet público). */
export async function getPet(client: MelClient, id: string): Promise<Pet | null> {
  const { data, error } = await client.from("pets").select(PET_COLUMNS).eq("id", id).returns<PetWithPhotos[]>().maybeSingle();
  if (error) throw new DataError(error.message, error.code);
  return data ? toPet(client, data) : null;
}

/** Página pública /pet/[melId]. RLS só devolve pets públicos para quem não é o dono. */
export async function getPetByMelId(client: MelClient, melId: string): Promise<Pet | null> {
  const { data, error } = await client
    .from("pets")
    .select(PET_COLUMNS)
    .eq("mel_id", melId)
    .returns<PetWithPhotos[]>()
    .maybeSingle();
  if (error) throw new DataError(error.message, error.code);
  return data ? toPet(client, data) : null;
}

export async function createPet(client: MelClient, ownerId: string, input: PetInput): Promise<Pet> {
  const { data, error } = await client
    .from("pets")
    .insert({ owner_id: ownerId, ...toRow(input) })
    .select(PET_COLUMNS)
    .returns<PetWithPhotos[]>()
    .single();
  if (error) throw new DataError(error.message, error.code);
  return toPet(client, data);
}

export async function updatePet(client: MelClient, id: string, input: PetInput): Promise<Pet> {
  const { data, error } = await client
    .from("pets")
    .update(toRow(input))
    .eq("id", id)
    .select(PET_COLUMNS)
    .returns<PetWithPhotos[]>()
    .single();
  if (error) throw new DataError(error.message, error.code);
  return toPet(client, data);
}

/** Remove o pet, suas fotos no Storage e (por cascade) os registros ligados. */
export async function deletePet(client: MelClient, pet: Pick<Pet, "id" | "ownerId">): Promise<void> {
  const { data: files } = await client.storage.from(BUCKET).list(`${pet.ownerId}/${pet.id}`);
  if (files?.length) {
    await client.storage.from(BUCKET).remove(files.map((f) => `${pet.ownerId}/${pet.id}/${f.name}`));
  }
  const { error } = await client.from("pets").delete().eq("id", pet.id);
  if (error) throw new DataError(error.message, error.code);
}

// ---------------------------------------------------------------------------
// Dados privados (só o dono lê e escreve)
// ---------------------------------------------------------------------------

export async function getPetPrivateDetails(client: MelClient, petId: string): Promise<PetPrivateDetails> {
  const { data, error } = await client
    .from("pet_private_details")
    .select("microchip_number, hidden_marks, ownership_notes")
    .eq("pet_id", petId)
    .maybeSingle();
  if (error) throw new DataError(error.message, error.code);
  return {
    microchipNumber: data?.microchip_number ?? null,
    hiddenMarks: data?.hidden_marks ?? null,
    ownershipNotes: data?.ownership_notes ?? null,
  };
}

export async function savePetPrivateDetails(
  client: MelClient,
  pet: Pick<Pet, "id" | "ownerId">,
  input: PetPrivateInput,
): Promise<void> {
  const { error } = await client.from("pet_private_details").upsert({
    pet_id: pet.id,
    owner_id: pet.ownerId,
    microchip_number: input.microchipNumber,
    hidden_marks: input.hiddenMarks,
    ownership_notes: input.ownershipNotes,
  });
  if (error) throw new DataError(error.message, error.code);
}

// ---------------------------------------------------------------------------
// Fotos
// ---------------------------------------------------------------------------

export interface PreparedPhoto {
  full: Blob;
  thumb: Blob;
  width?: number;
  height?: number;
}

const ext = (blob: Blob) => (blob.type === "image/jpeg" ? "jpg" : blob.type === "image/png" ? "png" : "webp");

/** Envia uma foto (versão grande + miniatura). A primeira foto do pet vira a principal. */
export async function addPetPhoto(
  client: MelClient,
  pet: Pick<Pet, "id" | "ownerId" | "photos">,
  photo: PreparedPhoto,
  position: number,
): Promise<void> {
  const base = `${pet.ownerId}/${pet.id}/${crypto.randomUUID()}`;
  const fullPath = `${base}.${ext(photo.full)}`;
  const thumbPath = `${base}-thumb.${ext(photo.thumb)}`;
  const storage = client.storage.from(BUCKET);

  const opts = (blob: Blob) => ({ contentType: blob.type, cacheControl: "31536000", upsert: false });
  const [full, thumb] = await Promise.all([
    storage.upload(fullPath, photo.full, opts(photo.full)),
    storage.upload(thumbPath, photo.thumb, opts(photo.thumb)),
  ]);
  if (full.error || thumb.error) {
    await storage.remove([fullPath, thumbPath]);
    throw new DataError((full.error ?? thumb.error)!.message, undefined, { context: "upload" });
  }

  const { error } = await client.from("pet_photos").insert({
    pet_id: pet.id,
    owner_id: pet.ownerId,
    storage_path: fullPath,
    thumb_path: thumbPath,
    is_primary: pet.photos.length === 0 && position === 0,
    position,
    width: photo.width,
    height: photo.height,
  });
  if (error) {
    await storage.remove([fullPath, thumbPath]);
    throw new DataError(error.message, error.code);
  }
}

export async function removePetPhoto(client: MelClient, photoId: string): Promise<void> {
  const { data, error } = await client
    .from("pet_photos")
    .delete()
    .eq("id", photoId)
    .select("pet_id, storage_path, thumb_path, is_primary")
    .single();
  if (error) throw new DataError(error.message, error.code);
  await client.storage.from(BUCKET).remove([data.storage_path, data.thumb_path]);

  // Se a principal saiu, a próxima foto assume.
  if (data.is_primary) {
    const { data: next } = await client
      .from("pet_photos")
      .select("id")
      .eq("pet_id", data.pet_id)
      .order("position")
      .limit(1)
      .maybeSingle();
    if (next) await setPrimaryPetPhoto(client, data.pet_id, next.id);
  }
}

export async function setPrimaryPetPhoto(client: MelClient, petId: string, photoId: string): Promise<void> {
  // Desmarca antes de marcar: o índice único permite uma principal por pet.
  const clear = await client.from("pet_photos").update({ is_primary: false }).eq("pet_id", petId).eq("is_primary", true);
  if (clear.error) throw new DataError(clear.error.message, clear.error.code);
  const set = await client.from("pet_photos").update({ is_primary: true }).eq("id", photoId);
  if (set.error) throw new DataError(set.error.message, set.error.code);
}
