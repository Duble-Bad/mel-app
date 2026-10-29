import { TERMS_VERSION, type Consent } from "@mel/core";
import { DataError, type MelClient } from "./client";

function fail(error: { message: string; code?: string }): never {
  throw new DataError(error.message, error.code);
}

export async function acceptTerms(client: MelClient, userId: string): Promise<void> {
  const { error } = await client.from("consents").insert({ user_id: userId, kind: "terms_privacy", version: TERMS_VERSION } as never);
  if (error) fail(error);
}

export async function listMyConsents(client: MelClient): Promise<Consent[]> {
  const { data, error } = await client.from("consents").select("kind, version, granted, created_at").order("created_at", { ascending: false });
  if (error) fail(error);
  return (data ?? []).map((r) => ({ kind: r.kind as Consent["kind"], version: r.version, granted: r.granted, createdAt: r.created_at }));
}

/** Cópia de tudo o que a MEL guarda sobre quem está logado (JSON). */
export async function exportMyData(client: MelClient): Promise<unknown> {
  const { data, error } = await client.rpc("export_my_data");
  if (error) fail(error);
  return data;
}

const BUCKETS = ["avatars", "pet-photos", "sighting-media"] as const;

async function listFilesDeep(client: MelClient, bucket: string, prefix: string): Promise<string[]> {
  const out: string[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await client.storage.from(bucket).list(prefix, { limit: 1000, offset });
    if (error) fail(error);
    for (const item of data ?? []) {
      const path = `${prefix}/${item.name}`;
      // Pastas vêm sem id.
      if (item.id) out.push(path);
      else out.push(...(await listFilesDeep(client, bucket, path)));
    }
    if (!data || data.length < 1000) return out;
  }
}

/**
 * Exclusão definitiva (LGPD). Só com o cliente de SERVIÇO, no servidor:
 * apaga arquivos da pessoa, tira a foto dos avistamentos que ela enviou
 * (o avistamento continua, anônimo) e remove o usuário — o resto sai em cascata.
 */
export async function deleteAccount(service: MelClient, userId: string): Promise<void> {
  for (const bucket of BUCKETS) {
    const files = await listFilesDeep(service, bucket, userId);
    for (let i = 0; i < files.length; i += 100) {
      const { error } = await service.storage.from(bucket).remove(files.slice(i, i + 100));
      if (error) fail(error);
    }
  }
  const { error: e1 } = await service.from("sightings").update({ photo_path: null } as never).eq("reporter_id", userId);
  if (e1) fail(e1);
  const { error } = await service.auth.admin.deleteUser(userId);
  if (error) fail(error);
}
