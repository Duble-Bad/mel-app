/**
 * Serviços oficiais de push dos navegadores. O servidor do MEL só envia para
 * eles: endereço livre faria do servidor um "carteiro" para qualquer site (SSRF).
 * Espelho exato da regra do banco (migrations 52 e 53, `push_subscriptions`).
 */
export const PUSH_ENDPOINT_MAX_LENGTH = 1000;

const OFFICIAL_PUSH_HOST = /^(fcm\.googleapis\.com|updates\.push\.services\.mozilla\.com|web\.push\.apple\.com|[a-z0-9-]+\.notify\.windows\.com)$/;

export function isAllowedPushEndpoint(endpoint: string | null | undefined): boolean {
  if (!endpoint || endpoint.length > PUSH_ENDPOINT_MAX_LENGTH) return false;
  // Mesma forma que o banco exige: https://<host>/ sem usuário, senha nem porta.
  const match = /^https:\/\/([^/]+)\//.exec(endpoint);
  return Boolean(match && OFFICIAL_PUSH_HOST.test(match[1]!));
}
