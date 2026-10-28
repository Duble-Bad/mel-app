import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { getMyProfile } from "@mel/data";
import { needsOnboarding, type Profile } from "@mel/core";
import { createSessionClient } from "@/lib/supabase/server";

export interface SessionUser {
  id: string;
  isAnonymous: boolean;
}

/** Usuário da requisição (JWT verificado), ou null. Deduplicado por requisição. */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const supabase = await createSessionClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims?.sub) return null;
  return { id: data.claims.sub, isAnonymous: data.claims.is_anonymous === true };
});

export const getCurrentProfile = cache(async (): Promise<Profile | null> => {
  const user = await getSessionUser();
  if (!user) return null;
  return getMyProfile(await createSessionClient());
});

/**
 * Exige conta real com onboarding concluído. Visitantes anônimos (que só
 * enviaram avistamentos) também são levados ao login.
 */
export async function requireOnboardedProfile(nextPath: string): Promise<Profile> {
  const user = await getSessionUser();
  if (!user || user.isAnonymous) redirect(`/entrar?next=${encodeURIComponent(nextPath)}`);
  const profile = await getCurrentProfile();
  if (needsOnboarding(profile)) redirect(`/onboarding?next=${encodeURIComponent(nextPath)}`);
  return profile!;
}
