import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database, MelClient } from "@mel/data";
import { publicEnv } from "@/lib/env";

/**
 * Cliente sem sessão, para leituras públicas no servidor (health check,
 * páginas públicas de alerta). Sujeito a RLS como visitante anônimo.
 */
export function createPublicClient(): MelClient {
  const { supabaseUrl, supabasePublishableKey } = publicEnv();
  return createClient<Database>(supabaseUrl, supabasePublishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
