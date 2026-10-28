import type { Direction, SightingInput, SightingState, TimelineSighting } from "@mel/core";
import { DataError, type MelClient } from "./client";

const BUCKET = "sighting-media";

/** Envia a foto do avistamento (já reduzida, sem EXIF) na pasta da sessão. */
export async function uploadSightingPhoto(client: MelClient, userId: string, image: Blob): Promise<string> {
  const ext = image.type === "image/jpeg" ? "jpg" : image.type === "image/png" ? "png" : "webp";
  const path = `${userId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await client.storage.from(BUCKET).upload(path, image, {
    contentType: image.type,
    cacheControl: "31536000",
    upsert: false,
  });
  if (error) throw new DataError(error.message);
  return path;
}

/**
 * Grava o avistamento. Chamado pelo servidor (rota com captcha) com a sessão
 * da pessoa — o RLS garante que ela só envia em seu próprio nome.
 */
export async function createSighting(client: MelClient, input: SightingInput): Promise<string> {
  const { data, error } = await client.rpc("submit_sighting", {
    p_code: input.code,
    p_lat: input.position.lat,
    p_lng: input.position.lng,
    p_seen_at: input.seenAt,
    p_direction: input.direction,
    p_states: input.states,
    p_place_label: input.placeLabel ?? undefined,
    p_notes: input.notes ?? undefined,
    p_photo_path: input.photoPath ?? undefined,
  });
  if (error) throw new DataError(error.message, error.code);
  return data as string;
}

const mediaUrl = (client: MelClient, path: string) => client.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;

interface TimelineJson {
  id: string;
  seen_at: string;
  lat: number;
  lng: number;
  place_label: string | null;
  direction: Direction;
  states: SightingState[];
  notes: string | null;
  photo_path: string | null;
  hidden: boolean;
  mine: boolean | null;
}

/** Avistamentos de um alerta, em ordem cronológica (ocultos só para o tutor). */
export async function getTimeline(client: MelClient, code: string): Promise<TimelineSighting[]> {
  const { data, error } = await client.rpc("get_lost_case_timeline", { p_code: code });
  if (error) throw new DataError(error.message, error.code);
  return ((data as unknown as TimelineJson[]) ?? []).map((s) => ({
    id: s.id,
    seenAt: s.seen_at,
    position: { lat: s.lat, lng: s.lng },
    placeLabel: s.place_label,
    direction: s.direction,
    states: s.states,
    notes: s.notes,
    photoUrl: s.photo_path ? mediaUrl(client, s.photo_path) : null,
    hidden: s.hidden,
    mine: s.mine === true,
  }));
}

/** Tutor oculta (ex.: spam) ou reexibe um avistamento do seu alerta. */
export async function setSightingHidden(client: MelClient, sightingId: string, hidden: boolean): Promise<void> {
  const { error, count } = await client
    .from("sightings")
    .update({ status: hidden ? "HIDDEN" : "VISIBLE" }, { count: "exact" })
    .eq("id", sightingId);
  if (error) throw new DataError(error.message, error.code);
  if (!count) throw new DataError("Você não pode alterar este avistamento.", "42501");
}
