import type { BrState, Profile, ProfileInput } from "@mel/core";
import { DataError, type MelClient } from "./client";
import type { Database } from "./database.types";

type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];

const PROFILE_COLUMNS = "id, display_name, avatar_url, city, state, role, is_anonymous, onboarded_at";

function toProfile(row: Pick<ProfileRow, "id" | "display_name" | "avatar_url" | "city" | "state" | "role" | "is_anonymous" | "onboarded_at">): Profile {
  return {
    id: row.id,
    displayName: row.display_name,
    avatarUrl: row.avatar_url,
    city: row.city,
    state: row.state as BrState | null,
    role: row.role,
    isAnonymous: row.is_anonymous,
    onboardedAt: row.onboarded_at,
  };
}

/** Perfil do usuário logado, ou null sem sessão. */
export async function getMyProfile(client: MelClient): Promise<Profile | null> {
  const { data: auth } = await client.auth.getUser();
  if (!auth.user) return null;
  const { data, error } = await client.from("profiles").select(PROFILE_COLUMNS).eq("id", auth.user.id).maybeSingle();
  if (error) throw new DataError(error.message, error.code);
  return data ? toProfile(data) : null;
}

/** Salva nome/cidade/estado (e foto, se enviada) e marca o onboarding como concluído. */
export async function saveMyProfile(
  client: MelClient,
  userId: string,
  input: ProfileInput & { avatarUrl?: string | null },
): Promise<Profile> {
  const { data, error } = await client
    .from("profiles")
    .update({
      display_name: input.displayName,
      city: input.city,
      state: input.state,
      ...(input.avatarUrl !== undefined ? { avatar_url: input.avatarUrl } : {}),
      onboarded_at: new Date().toISOString(),
    })
    .eq("id", userId)
    .select(PROFILE_COLUMNS)
    .single();
  if (error) throw new DataError(error.message, error.code);
  return toProfile(data);
}

/**
 * Envia a foto de perfil (já redimensionada pelo app) e devolve a URL pública.
 * O nome do arquivo muda a cada envio para não ficar preso em cache de CDN.
 */
export async function uploadAvatar(client: MelClient, userId: string, image: Blob): Promise<string> {
  const ext = image.type === "image/png" ? "png" : image.type === "image/jpeg" ? "jpg" : "webp";
  const path = `${userId}/avatar-${Date.now()}.${ext}`;
  const { error } = await client.storage.from("avatars").upload(path, image, {
    contentType: image.type,
    cacheControl: "31536000",
    upsert: false,
  });
  if (error) throw new DataError(error.message, undefined, { context: "upload" });
  return client.storage.from("avatars").getPublicUrl(path).data.publicUrl;
}
