import type { Credentials } from "@mel/core";
import { DataError, type MelClient } from "./client";

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
};

const FALLBACK = "Não deu certo agora. Verifique sua conexão e tente novamente.";

export class AuthError extends DataError {
  constructor(code: string | undefined) {
    super((code && AUTH_MESSAGES[code]) || FALLBACK, code);
    this.name = "AuthError";
  }
}

function fail(error: { code?: string } | null): never {
  throw new AuthError(error?.code);
}

export async function signInWithPassword(client: MelClient, { email, password }: Credentials) {
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error || !data.user) fail(error);
  return data.user;
}

export async function signUpWithPassword(client: MelClient, { email, password, displayName }: Credentials & { displayName?: string }) {
  // O nome vai nos metadados: o trigger handle_new_user já o grava no perfil.
  const { data, error } = await client.auth.signUp({
    email,
    password,
    ...(displayName ? { options: { data: { full_name: displayName } } } : {}),
  });
  if (error || !data.user) fail(error);
  // Supabase devolve usuário "fantasma" (sem identidades) quando o e-mail já existe.
  if (data.user.identities?.length === 0) throw new AuthError("user_already_exists");
  return { user: data.user, hasSession: Boolean(data.session) };
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
