import { PAGE_SIZE, sinceFrom, type PublicCaseItem, type SearchFilters } from "@mel/core";
import { DataError, type MelClient } from "./client";

interface ItemJson {
  kind: PublicCaseItem["kind"];
  code: string;
  title: string | null;
  species: PublicCaseItem["species"];
  breed: string | null;
  size: PublicCaseItem["size"];
  color_primary: string | null;
  photo_path: string | null;
  photo_bucket: "pet-photos" | "sighting-media";
  area_label: string | null;
  at: string;
  lat: number;
  lng: number;
  distance_m: number;
}

export interface PublicSearchResult {
  items: PublicCaseItem[];
  total: number;
}

/**
 * Perdidos, encontrados e vistos soltos perto de um ponto (mapa e listas
 * públicas). Só pontos aproximados; ordenado por distância.
 */
export async function searchPublicCases(
  client: MelClient,
  f: SearchFilters,
  { pageSize = PAGE_SIZE, now = new Date() }: { pageSize?: number; now?: Date } = {},
): Promise<PublicSearchResult> {
  const { data, error } = await client.rpc("search_public_cases", {
    p_lat: f.center.lat,
    p_lng: f.center.lng,
    p_radius_m: f.radiusKm * 1000,
    p_kinds: f.kinds,
    p_species: f.species.length ? f.species : undefined,
    p_since: sinceFrom(f.period, now) ?? undefined,
    p_limit: pageSize,
    p_offset: (f.page - 1) * pageSize,
  });
  if (error) throw new DataError(error.message, error.code);
  const res = data as unknown as { total: number; items: ItemJson[] };
  return {
    total: res.total,
    items: res.items.map((i) => ({
      kind: i.kind,
      code: i.code,
      title: i.title,
      species: i.species,
      breed: i.breed,
      size: i.size,
      colorPrimary: i.color_primary,
      photoUrl: i.photo_path ? client.storage.from(i.photo_bucket).getPublicUrl(i.photo_path).data.publicUrl : null,
      areaLabel: i.area_label,
      at: i.at,
      position: { lat: i.lat, lng: i.lng },
      distanceM: i.distance_m,
    })),
  };
}
