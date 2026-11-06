import { DataError, type MelClient } from "./client";

/** Configurações públicas do mapa da rede (padrão: adoção fora do mapa). */
export interface MapSettings {
  showAdoptionOnMap: boolean;
}

const read = (data: unknown): MapSettings => ({ showAdoptionOnMap: (data as { show_adoption_on_map?: boolean } | null)?.show_adoption_on_map === true });

export async function getMapSettings(client: MelClient): Promise<MapSettings> {
  const { data, error } = await client.rpc("get_map_settings");
  if (error) throw new DataError(error.message, error.code);
  return read(data);
}

/** Só administradores (o banco recusa os demais, não só a tela). */
export async function setShowAdoptionOnMap(client: MelClient, on: boolean): Promise<MapSettings> {
  const { data, error } = await client.rpc("admin_set_map_setting", { p_key: "show_adoption_on_map", p_value: on });
  if (error) throw new DataError(error.message, error.code);
  return read(data);
}
