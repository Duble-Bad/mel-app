"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { Database, MelClient } from "@mel/data";

let client: MelClient | undefined;

/** Cliente do navegador (singleton). A sessão fica em cookies, compartilhada com o servidor. */
export function getBrowserClient(): MelClient {
  // Literais NEXT_PUBLIC_* para o Next embutir os valores no bundle.
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("Supabase não configurado (veja .env.example).");
  client ??= createBrowserClient<Database>(url, key);
  return client;
}
