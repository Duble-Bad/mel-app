import { DataError, type MelClient } from "./client";

/** Formatos do fluxo "Criar cartaz" (os mesmos do gerador). */
export type PosterDesignFormat = "impressao" | "square" | "portrait" | "story" | "landscape";

/** Enquadramento de uma foto: ponto central (x, y em %) e tamanho (zoom 0,2–3; abaixo de 1 a foto fica menor que o espaço). */
export interface PosterFraming {
  x: number;
  y: number;
  zoom: number;
}

/** Cartaz salvo pelo tutor para um formato: modelo, fotos (a principal primeiro) e enquadramento de cada uma. */
export interface PosterDesign {
  format: PosterDesignFormat;
  model: 1 | 2 | 3 | 4;
  photoIds: string[];
  /** Enquadramento de cada foto, na ordem de `photoIds` (null = padrão do modelo). */
  framings: (PosterFraming | null)[];
  updatedAt: string;
}

const asFraming = (v: unknown): PosterFraming | null => {
  const f = v as Partial<PosterFraming> | null;
  return f && typeof f.x === "number" && typeof f.y === "number" && typeof f.zoom === "number" ? { x: f.x, y: f.y, zoom: f.zoom } : null;
};

// Mensagens das funções do banco são escritas para o tutor (42501 = sem permissão, 22023 = dado inválido).
function fail(error: { message: string; code?: string }): never {
  throw new DataError(error.message, error.code, { trusted: error.code === "42501" || error.code === "22023" });
}

/** Cartazes salvos do alerta (qualquer pessoa lê: são escolhas de layout sobre fotos públicas). */
export async function getPosterDesigns(client: MelClient, code: string): Promise<PosterDesign[]> {
  const { data, error } = await client.rpc("get_poster_designs", { p_code: code });
  if (error) fail(error);
  return (data ?? []).map((d) => {
    const photoIds = d.photo_ids ?? [];
    // Salvos antes da migration 48 só têm o enquadramento da principal (colunas focus_*).
    const legacy = d.focus_x != null && d.focus_y != null && d.zoom != null ? { x: d.focus_x, y: d.focus_y, zoom: Number(d.zoom) } : null;
    const list = Array.isArray(d.framings) ? d.framings.map(asFraming) : [legacy];
    return {
      format: d.format as PosterDesignFormat,
      model: d.model as PosterDesign["model"],
      photoIds,
      framings: photoIds.map((_, i) => list[i] ?? null),
      updatedAt: d.updated_at,
    };
  });
}

/** Salva o cartaz de um formato (só o tutor do alerta ativo; o banco confere). */
export async function savePosterDesign(client: MelClient, code: string, design: Omit<PosterDesign, "updatedAt">): Promise<void> {
  const round = (f: PosterFraming | null) => (f ? { x: Math.round(f.x), y: Math.round(f.y), zoom: Math.round(f.zoom * 100) / 100 } : null);
  const framings = design.photoIds.map((_, i) => round(design.framings[i] ?? null));
  const main = framings[0];
  const { error } = await client.rpc("save_poster_design", {
    p_code: code,
    p_format: design.format,
    p_model: design.model,
    p_photo_ids: design.photoIds,
    // Colunas antigas: o enquadramento da principal (compatibilidade com leituras anteriores à 48).
    p_focus_x: main ? main.x : undefined,
    p_focus_y: main ? main.y : undefined,
    p_zoom: main ? main.zoom : undefined,
    p_framings: framings.some(Boolean) ? framings : undefined,
  });
  if (error) fail(error);
}

/** Apaga o cartaz salvo de um formato (volta ao padrão). */
export async function resetPosterDesign(client: MelClient, code: string, format: PosterDesignFormat): Promise<void> {
  const { error } = await client.rpc("reset_poster_design", { p_code: code, p_format: format });
  if (error) fail(error);
}
