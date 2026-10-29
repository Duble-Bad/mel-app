import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database, MelClient } from "@mel/data";
import { publicEnv } from "@/lib/env";

/**
 * Cliente com a chave SECRETA (ignora RLS). Só para tarefas do servidor que
 * não pertencem a um usuário — hoje, o despachante de push. Nunca no navegador.
 */
export function createServiceClient(): MelClient | null {
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!key) return null;
  const { supabaseUrl } = publicEnv();
  return createClient<Database>(supabaseUrl, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
