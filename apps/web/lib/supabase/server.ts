import "server-only";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { createServerClient } from "@supabase/ssr";
import type { Database, MelClient } from "@mel/data";
import { publicEnv } from "@/lib/env";

/** Cliente com a sessão do usuário (cookies). Criar um por requisição. */
export async function createSessionClient(): Promise<MelClient> {
  // A sessão é sempre por requisição (o auth-js usa Date.now() para checar
  // expiração); nunca entra em pré-renderização nem em prefetch.
  await connection();
  const { supabaseUrl, supabasePublishableKey } = publicEnv();
  const cookieStore = await cookies();
  return createServerClient<Database>(supabaseUrl, supabasePublishableKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (cookiesToSet) => {
        try {
          for (const { name, value, options } of cookiesToSet) cookieStore.set(name, value, options);
        } catch {
          // Server Components não podem gravar cookies; o proxy renova a sessão.
        }
      },
    },
  });
}
