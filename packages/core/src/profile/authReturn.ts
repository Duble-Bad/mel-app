import { safeNextPath } from "./profile";

/**
 * O que fazer quando o Supabase devolve a pessoa para /auth/callback (login
 * com Google, vínculo do Google à sessão anônima, link de recuperação).
 * Erro do provedor tem prioridade; sem `code` é link inválido; o destino é
 * sempre um caminho interno.
 */
export type AuthCallbackAction = { kind: "error"; code: string } | { kind: "exchange"; code: string; next: string };

export function authCallbackAction(params: { get(name: string): string | null }): AuthCallbackAction {
  const providerError = params.get("error_code") ?? params.get("error");
  if (providerError) return { kind: "error", code: safeErrorCode(providerError) };
  const code = params.get("code");
  if (!code) return { kind: "error", code: "link" };
  return { kind: "exchange", code, next: safeNextPath(params.get("next")) };
}

/** Só códigos no formato do Supabase seguem adiante (nada de texto arbitrário na URL). */
export function safeErrorCode(code: string | null | undefined): string {
  return code && /^[a-z0-9_]{1,64}$/.test(code) ? code : "unknown";
}

export interface AuthReturnMessage {
  message: string;
  /**
   * A conta Google já é de outra conta MEL: dá para entrar nela, sabendo que o
   * que foi enviado sem conta NÃO passa para ela (nunca há merge automático).
   */
  offerGoogleSignIn: boolean;
}

const NOT_TRANSFERRED = "O que você enviou sem conta neste aparelho continua publicado, mas não passa para essa conta.";

/** Mensagem para quem volta de um login social ou link que falhou (?erro=…). */
export function authReturnMessage(code: string | null | undefined): AuthReturnMessage | null {
  if (!code) return null;
  const msg = (message: string, offerGoogleSignIn = false) => ({ message, offerGoogleSignIn });
  switch (code) {
    case "bad_oauth_state":
    case "bad_oauth_callback":
    case "flow_state_expired":
    case "flow_state_not_found":
      return msg("O login com Google demorou mais que o esperado e expirou. Tente de novo — leva só alguns segundos.");
    case "access_denied":
      return msg("O login com Google foi cancelado. Você pode tentar de novo ou usar seu e-mail.");
    case "link":
    case "otp_expired":
      return msg("Esse link expirou ou já foi usado. Entre de novo ou peça um novo link.");
    case "identity_already_exists":
      return msg(`Essa conta Google já está ligada a outra conta MEL. Você pode entrar nela com o Google. ${NOT_TRANSFERRED}`, true);
    case "email_exists":
      return msg(`Já existe uma conta MEL com o e-mail dessa conta Google. Você pode entrar nela. ${NOT_TRANSFERRED}`, true);
    case "manual_linking_disabled":
      return msg("Continuar com Google mantendo suas contribuições não está disponível agora. Crie a conta com e-mail e senha para manter o que você enviou.");
    case "session_not_found":
    case "session_expired":
    case "bad_jwt":
    case "no_authorization":
      return msg("Sua sessão expirou. Recarregue a página e tente de novo.");
    case "over_request_rate_limit":
      return msg("Muitas tentativas seguidas. Espere um minuto e tente de novo.");
    default:
      return msg("Não conseguimos concluir o login. Tente de novo ou use seu e-mail.");
  }
}

/**
 * Links dos e-mails do Auth (confirmação de cadastro, recuperação de senha,
 * troca de e-mail — inclusive a conversão da sessão anônima com "Confirm
 * email" ON). Os templates apontam para /auth/confirmar?token_hash=…&type=…:
 * funciona em qualquer navegador (o link costuma abrir no app de e-mail, longe
 * do navegador do cadastro, onde o fluxo PKCE falharia) e só vale depois de um
 * clique (leitores de e-mail que abrem links sozinhos não gastam o token).
 */
export const EMAIL_LINK_TYPES = ["email", "recovery", "email_change"] as const;
export type EmailLinkType = (typeof EMAIL_LINK_TYPES)[number];

export type EmailLink = { ok: true; tokenHash: string; type: EmailLinkType; next: string } | { ok: false; code: "link" };

export function emailLinkAction(params: { get(name: string): string | null }): EmailLink {
  const tokenHash = params.get("token_hash");
  const raw = params.get("type");
  // "signup" é o nome antigo do tipo de confirmação de cadastro.
  const type = raw === "signup" ? "email" : raw;
  if (!tokenHash || !/^[A-Za-z0-9_-]{8,256}$/.test(tokenHash) || !EMAIL_LINK_TYPES.includes(type as EmailLinkType)) {
    return { ok: false, code: "link" };
  }
  // Recuperação sempre termina em "criar senha nova"; os demais, no perfil (que leva ao onboarding se faltar).
  const next = type === "recovery" ? "/perfil/nova-senha" : safeNextPath(params.get("next"), "/perfil");
  return { ok: true, tokenHash, type: type as EmailLinkType, next };
}

export function emailLinkCopy(type: EmailLinkType): { title: string; body: string; action: string } {
  switch (type) {
    case "recovery":
      return { title: "Criar uma senha nova", body: "Toque no botão para continuar e escolher sua senha nova.", action: "Continuar" };
    case "email_change":
      return {
        title: "Confirmar seu e-mail",
        body: "Toque no botão para confirmar este e-mail na sua conta MEL. O que você já enviou continua com você.",
        action: "Confirmar e-mail",
      };
    default:
      return { title: "Confirmar seu cadastro", body: "Falta só um passo: toque no botão para ativar sua conta na MEL.", action: "Confirmar e entrar" };
  }
}
