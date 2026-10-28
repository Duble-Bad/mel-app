import { DataError, type MelClient } from "./client";

export interface Health {
  ok: boolean;
  postgis: string;
  checkedAt: string;
}

/** Confirma que o banco responde e que o PostGIS está habilitado. */
export async function getHealth(client: MelClient): Promise<Health> {
  const { data, error } = await client.rpc("health_check");
  if (error) throw new DataError(error.message, error.code);
  const row = data as { ok: boolean; postgis: string; checked_at: string };
  return { ok: row.ok, postgis: row.postgis, checkedAt: row.checked_at };
}
