import { DataError, type MelClient } from "./client";

/** Formatos do fluxo "Criar cartaz" (os mesmos do gerador). */
export type PosterDesignFormat = "impressao" | "square" | "portrait" | "story" | "landscape";

/** Cartaz salvo pelo tutor para um formato: modelo, fotos (a principal primeiro) e enquadramento. */
export interface PosterDesign {
  format: PosterDesignFormat;
  model: 1 | 2 | 3 | 4;
  photoIds: string[];
  framing: { x: number; y: number; zoom: number } | null;
  updatedAt: string;
}

// Mensagens das funções do banco são escritas para o tutor (42501 = sem permissão, 22023 = dado inválido).
function fail(error: { message: string; code?: string }): never {
  throw new DataError(error.message, error.code, { trusted: error.code === "42501" || error.code === "22023" });
}

/** Cartazes salvos do alerta (qualquer pessoa lê: são escolhas de layout sobre fotos públicas). */
export async function getPosterDesigns(client: MelClient, code: string): Promise<PosterDesign[]> {
  const { data, error } = await client.rpc("get_poster_designs", { p_code: code });
  if (error) fail(error);
  return (data ?? []).map((d) => ({
    format: d.format as PosterDesignFormat,
    model: d.model as PosterDesign["model"],
    photoIds: d.photo_ids ?? [],
    framing: d.focus_x != null && d.focus_y != null && d.zoom != null ? { x: d.focus_x, y: d.focus_y, zoom: Number(d.zoom) } : null,
    updatedAt: d.updated_at,
  }));
}

/** Salva o cartaz de um formato (só o tutor do alerta ativo; o banco confere). */
export async function savePosterDesign(client: MelClient, code: string, design: Omit<PosterDesign, "updatedAt">): Promise<void> {
  const { error } = await client.rpc("save_poster_design", {
    p_code: code,
    p_format: design.format,
    p_model: design.model,
    p_photo_ids: design.photoIds,
    p_focus_x: design.framing ? Math.round(design.framing.x) : undefined,
    p_focus_y: design.framing ? Math.round(design.framing.y) : undefined,
    p_zoom: design.framing ? Math.round(design.framing.zoom * 100) / 100 : undefined,
  });
  if (error) fail(error);
}

/** Apaga o cartaz salvo de um formato (volta ao padrão). */
export async function resetPosterDesign(client: MelClient, code: string, format: PosterDesignFormat): Promise<void> {
  const { error } = await client.rpc("reset_poster_design", { p_code: code, p_format: format });
  if (error) fail(error);
}
