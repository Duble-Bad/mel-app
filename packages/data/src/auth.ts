import type { Credentials } from "@mel/core";
import type { User } from "@supabase/supabase-js";
import { DataError, type MelClient } from "./client";

const SESSION_EXPIRED = "Sua sessão expirou. Recarregue a página e tente de novo.";

/** Mensagens humanas para os erros mais comuns do Supabase Auth. */
const AUTH_MESSAGES: Record<string, string> = {
  invalid_credentials: "E-mail ou senha não conferem. Confira e tente de novo.",
  user_already_exists: "Já existe uma conta com este e-mail. Tente entrar.",
  email_exists: "Já existe uma conta com este e-mail. Tente entrar.",
  weak_password: "Essa senha é fácil de adivinhar. Tente uma mais longa.",
  same_password: "A nova senha precisa ser diferente da atual.",
  email_address_invalid: "Não conseguimos usar este e-mail. Confira se está certo.",
  over_request_rate_limit: "Muitas tentativas seguidas. Espere um minuto e tente de novo.",
  over_email_send_rate_limit: "Já enviamos e-mails demais agora. Tente de novo em alguns minutos.",
  anonymous_provider_disabled: "Não foi possível continuar sem cadastro agora. Tente entrar com e-mail.",
  user_banned: "Esta conta está suspensa. Fale com a equipe MEL.",
  session_missing: SESSION_EXPIRED,
  session_not_found: SESSION_EXPIRED,
  session_expired: SESSION_EXPIRED,
  bad_jwt: SESSION_EXPIRED,
  user_not_found: SESSION_EXPIRED,
  // Conversão da sessão sem cadastro (veja signUpWithPassword).
  anonymous_email_exists:
    "Já existe uma conta com este e-mail. Você pode entrar nela, mas o que enviou sem conta neste aparelho continua publicado e não passa para essa conta.",
  conversion_session_refresh_failed: "Sua conta foi criada e suas contribuições foram mantidas. Entre com seu e-mail e senha para continuar.",
};

const FALLBACK = "Não deu certo agora. Verifique sua conexão e tente novamente.";

export class AuthError extends DataError {
  constructor(code: string | undefined) {
    super((code && AUTH_MESSAGES[code]) || FALLBACK, code);
    this.name = "AuthError";
  }
}

function fail(error: { code?: string; name?: string } | null): never {
  // Sem sessão no cliente, o supabase-js não manda código, só o nome do erro.
  throw new AuthError(error?.code ?? (error?.name === "AuthSessionMissingError" ? "session_missing" : undefined));
}

export async function signInWithPassword(client: MelClient, { email, password }: Credentials) {
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error || !data.user) fail(error);
  return data.user;
}

export type SignUpResult = {
  user: User;
  /** Já há sessão de conta real para seguir (onboarding/destino). */
  hasSession: boolean;
  /** Com "Confirm email" ligado: a conta só vale depois do link enviado por e-mail. */
  needsEmailConfirmation: boolean;
  /** A conta nasceu da sessão sem cadastro: mesmo id, contribuições mantidas. */
  convertedFromAnonymous: boolean;
};

/**
 * Cria a conta por e-mail e senha.
 *
 * Com sessão anônima no aparelho, NÃO cria outro usuário: adiciona e-mail e
 * senha ao próprio usuário anônimo (`updateUser`), que vira conta real com o
 * MESMO id. Avistamentos, "encontrei", conversas e denúncias continuam dele.
 * O Supabase faz isso numa transação: com "Confirm email" desligado o e-mail
 * é confirmado na hora e `is_anonymous` passa a false (dispara
 * on_auth_user_converted); ligado, a conversão só acontece no link do e-mail.
 *
 * `emailRedirectTo`: para onde o link de confirmação leva (quando houver).
 */
export async function signUpWithPassword(
  client: MelClient,
  { email, password, displayName }: Credentials & { displayName?: string },
  { emailRedirectTo }: { emailRedirectTo?: string } = {},
): Promise<SignUpResult> {
  // Sessão guardada no aparelho (sem rede): decide o caminho. Se o servidor não
  // aceitar mais essa sessão, a conversão falha com erro claro — nunca cai em
  // silêncio num cadastro novo que deixaria as contribuições para trás.
  const { data: stored } = await client.auth.getSession();
  if (stored.session?.user.is_anonymous) return convertAnonymousUser(client, { email, password, displayName }, emailRedirectTo);

  // O nome vai nos metadados: o trigger handle_new_user já o grava no perfil.
  const options = { ...(displayName ? { data: { full_name: displayName } } : {}), ...(emailRedirectTo ? { emailRedirectTo } : {}) };
  const { data, error } = await client.auth.signUp({ email, password, ...(Object.keys(options).length ? { options } : {}) });
  if (error || !data.user) fail(error);
  // Supabase devolve usuário "fantasma" (sem identidades) quando o e-mail já existe.
  if (data.user.identities?.length === 0) throw new AuthError("user_already_exists");
  const hasSession = Boolean(data.session);
  return { user: data.user, hasSession, needsEmailConfirmation: !hasSession, convertedFromAnonymous: false };
}

async function convertAnonymousUser(
  client: MelClient,
  { email, password, displayName }: Credentials & { displayName?: string },
  emailRedirectTo: string | undefined,
): Promise<SignUpResult> {
  const { data, error } = await client.auth.updateUser(
    { email, password, ...(displayName ? { data: { full_name: displayName } } : {}) },
    emailRedirectTo ? { emailRedirectTo } : undefined,
  );
  // E-mail de outra conta: nada mudou (transação), a sessão anônima segue intacta.
  if (error?.code === "email_exists" || error?.code === "user_already_exists") throw new AuthError("anonymous_email_exists");
  if (error || !data.user) fail(error);

  // "Confirm email" ligado: continua anônimo até o link; sem sessão de conta ainda.
  if (data.user.is_anonymous) return { user: data.user, hasSession: false, needsEmailConfirmation: true, convertedFromAnonymous: false };

  // O token atual ainda diz is_anonymous=true; sem renovar, o servidor e as
  // áreas de conta continuariam tratando a pessoa como visitante.
  const { error: refreshError } = await client.auth.refreshSession();
  if (refreshError) {
    // A conta já existe com o mesmo id; entrar com a senha recém-criada também resolve.
    const { error: signInError } = await client.auth.signInWithPassword({ email, password });
    if (signInError) throw new AuthError("conversion_session_refresh_failed");
  }

  // O perfil anônimo nasceu sem nome (on_auth_user_converted só tira a marca de
  // anônimo). Falhar aqui não desfaz a conta: o onboarding pede o nome de novo.
  if (displayName) await client.from("profiles").update({ display_name: displayName }).eq("id", data.user.id);

  return { user: data.user, hasSession: true, needsEmailConfirmation: false, convertedFromAnonymous: true };
}

export async function signInWithGoogle(client: MelClient, redirectTo: string) {
  const { error } = await client.auth.signInWithOAuth({ provider: "google", options: { redirectTo } });
  if (error) fail(error);
}

/**
 * Garante uma sessão para quem só quer ajudar (avistamento, "encontrei"),
 * sem pedir cadastro. Reaproveita a sessão existente, real ou anônima.
 */
export async function ensureSession(client: MelClient) {
  const { data } = await client.auth.getUser();
  if (data.user) return data.user;
  const { data: anon, error } = await client.auth.signInAnonymously();
  if (error || !anon.user) fail(error);
  return anon.user;
}

export async function requestPasswordReset(client: MelClient, email: string, redirectTo: string) {
  const { error } = await client.auth.resetPasswordForEmail(email, { redirectTo });
  if (error) fail(error);
}

export async function updatePassword(client: MelClient, password: string) {
  const { error } = await client.auth.updateUser({ password });
  if (error) fail(error);
}

export async function signOut(client: MelClient) {
  const { error } = await client.auth.signOut();
  if (error) fail(error);
}
