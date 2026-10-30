import type { SupabaseClient } from "@supabase/supabase-js";
import { classifyError, friendlyMessage, UserFacingError, type ErrorKind } from "@mel/core";
import type { Database } from "./database.types";

/** Cliente tipado. Quem cria (browser, server, Expo) é a aplicação; o data layer só consome. */
export type MelClient = SupabaseClient<Database>;

/**
 * Erro do data layer. A MENSAGEM é sempre para a pessoa: o texto cru do
 * Postgres/Supabase (SQL, RLS, constraint, código) nunca vira `message` — só
 * as mensagens que o próprio banco da MEL escreve passam; o resto vira a
 * mensagem da categoria (ver @mel/core errors.ts). O original fica em
 * `detail` (e `code`/`kind`) para logs e diagnóstico.
 *
 * `trusted`: o texto já foi escrito para a pessoa aqui no código.
 * `context: "upload"`: falha de envio de foto.
 */
export class DataError extends UserFacingError {
  readonly kind: ErrorKind;
  readonly detail: string;

  constructor(
    rawMessage: string,
    readonly code?: string,
    options: { trusted?: boolean; context?: "upload"; status?: number } = {},
  ) {
    super(options.trusted ? rawMessage : friendlyMessage({ code, message: rawMessage, status: options.status }, options.context));
    this.name = "DataError";
    this.detail = rawMessage;
    this.kind = classifyError({ code, message: rawMessage, status: options.status });
  }
}
