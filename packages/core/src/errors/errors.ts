import { SERVER_MESSAGES } from "./serverMessages";

/**
 * Erros que chegam à pessoa: sempre em português, sem SQL, RLS, nomes de
 * tabela, códigos internos ou stack. O detalhe técnico fica no próprio erro
 * (`detail`/`cause`) e nos logs — nunca na tela.
 */
export type ErrorKind =
  | "permission"
  | "session"
  | "rate_limit"
  | "network"
  | "not_found"
  | "conflict"
  | "validation"
  | "upload"
  | "unavailable"
  | "unexpected";

export const ERROR_MESSAGES: Record<ErrorKind, string> = {
  permission: "Você não tem permissão para fazer isso.",
  session: "Sua sessão expirou. Entre novamente para continuar.",
  rate_limit: "Muitas tentativas em pouco tempo. Aguarde um pouco e tente novamente.",
  network: "Não foi possível conectar agora. Verifique sua internet e tente novamente.",
  not_found: "Não encontramos o que você procurava. Pode ter sido removido.",
  conflict: "Isso já foi registrado.",
  validation: "Algumas informações não foram aceitas. Confira e tente novamente.",
  upload: "Não foi possível enviar a foto. Tente novamente.",
  unavailable: "A MEL está com instabilidade agora. Tente novamente em instantes.",
  unexpected: "Algo deu errado. Tente novamente em instantes.",
};

const SERVER_MESSAGE_SET = new Set(SERVER_MESSAGES);

/** Mensagem escrita pelo próprio banco da MEL para a pessoa (raise exception). */
export function isServerMessage(message: string | null | undefined): boolean {
  return !!message && SERVER_MESSAGE_SET.has(message.trim());
}

export interface ErrorLike {
  code?: string | null;
  message?: string | null;
  status?: number | null;
  name?: string | null;
}

const NETWORK = /failed to fetch|fetch failed|networkerror|network request failed|load failed|err_internet_disconnected|econn(refused|reset)|etimedout|timed? ?out|socket hang up|the internet connection appears to be offline/i;
const SESSION = /jwt|token (is )?expired|session (not found|expired|missing)|auth session missing|refresh token/i;
const PERMISSION = /row-level security|permission denied|not authorized|unauthorized|forbidden/i;
const NOT_FOUND = /0 rows|no rows|not found|does not exist/i;
const RATE = /rate limit|too many requests/i;
const UNAVAILABLE = /service unavailable|bad gateway|gateway timeout|could not connect|connection refused|upstream/i;

/** Categoria do erro a partir de códigos estáveis (Postgres, PostgREST, Auth, HTTP). */
export function classifyError(e: ErrorLike): ErrorKind {
  const code = (e.code ?? "").toString();
  const msg = e.message ?? "";
  const status = e.status ?? 0;

  if (code === "P0429" || code === "over_request_rate_limit" || code === "over_email_send_rate_limit" || status === 429 || RATE.test(msg)) return "rate_limit";
  if (e.name === "AuthRetryableFetchError" || (e.name === "TypeError" && NETWORK.test(msg)) || NETWORK.test(msg)) return "network";
  if (
    ["PGRST301", "PGRST302", "PGRST303", "session_not_found", "session_expired", "bad_jwt", "no_authorization", "refresh_token_not_found"].includes(code) ||
    e.name === "AuthSessionMissingError" ||
    status === 401 ||
    SESSION.test(msg)
  ) {
    return "session";
  }
  if (code === "42501" || code === "PGRST300" || status === 403 || PERMISSION.test(msg)) return "permission";
  if (code === "PGRST116" || code === "P0002" || status === 404 || NOT_FOUND.test(msg)) return "not_found";
  if (code === "23505") return "conflict";
  if (/^(22|23)/.test(code) || code === "PGRST204" || status === 400 || status === 422) return "validation";
  if (/^(08|53|57)/.test(code) || code === "PGRST000" || code === "PGRST001" || code === "PGRST002" || status >= 500 || UNAVAILABLE.test(msg)) return "unavailable";
  return "unexpected";
}

/**
 * Texto para a pessoa a partir de um erro técnico. Mensagens que o banco da
 * MEL escreve de propósito passam como estão; todo o resto vira uma mensagem
 * da categoria. `context: "upload"` troca falhas genéricas por "não foi
 * possível enviar a foto".
 */
export function friendlyMessage(e: ErrorLike, context?: "upload"): string {
  if (isServerMessage(e.message)) return e.message!.trim();
  const kind = classifyError(e);
  if (context === "upload" && ["unexpected", "permission", "validation", "unavailable"].includes(kind)) return ERROR_MESSAGES.upload;
  return ERROR_MESSAGES[kind];
}

/**
 * Erro cuja mensagem JÁ é para a pessoa (português, sem detalhe técnico).
 * Base de DataError/AuthError e dos erros do app (foto, localização, push…).
 */
export class UserFacingError extends Error {
  readonly userFacing = true;
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "UserFacingError";
  }
}

function isUserFacing(err: unknown): err is Error {
  return err instanceof UserFacingError || (err instanceof Error && (err as { userFacing?: unknown }).userFacing === true);
}

/**
 * O que mostrar quando uma ação falha. Só erros marcados como "para a pessoa"
 * mostram o próprio texto; falha de rede vira a mensagem de conexão; qualquer
 * outra coisa (exceção do navegador, biblioteca, Postgres cru) vira `fallback`.
 * Em desenvolvimento, registra o erro original no console para diagnóstico.
 */
export function userErrorMessage(err: unknown, fallback: string = ERROR_MESSAGES.unexpected): string {
  if (isUserFacing(err)) return err.message;
  if (typeof process !== "undefined" && process.env?.NODE_ENV !== "production") {
    console.warn("[MEL] erro mostrado como mensagem amigável:", err);
  }
  const like: ErrorLike = err instanceof Error ? { name: err.name, message: err.message, code: (err as { code?: string }).code } : {};
  const kind = classifyError(like);
  if (kind === "network" || kind === "session" || kind === "rate_limit") return ERROR_MESSAGES[kind];
  return fallback;
}
