import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

/** Cliente tipado. Quem cria (browser, server, Expo) é a aplicação; o data layer só consome. */
export type MelClient = SupabaseClient<Database>;

export class DataError extends Error {
  constructor(
    message: string,
    readonly code?: string,
  ) {
    super(message);
    this.name = "DataError";
  }
}
