/**
 * Proteção contra envio a partir de outro site (CSRF) nas rotas que mudam algo.
 * Função pura: a rota passa a origem que o navegador mandou, a origem do site e
 * o Content-Type; os testes passam os mesmos valores.
 *
 * - `Origin` presente e diferente do site → 403. Sem `Origin` (mesmo site em
 *   navegadores antigos, agendador, testes) → aceito, como em `isSameOrigin`.
 * - `requireJson`: só `application/json`. Formulário de outro site só consegue
 *   mandar `text/plain`, `multipart/form-data` ou `x-www-form-urlencoded` sem
 *   pedir permissão ao servidor; exigir JSON fecha essa porta.
 */
export interface CrossSiteCheck {
  origin: string | null | undefined;
  siteOrigin: string;
  contentType?: string | null;
  requireJson?: boolean;
}

export type CrossSiteRejection = { status: 403 | 415; error: string } | null;

export function crossSiteRejection({ origin, siteOrigin, contentType, requireJson = false }: CrossSiteCheck): CrossSiteRejection {
  if (origin && origin !== siteOrigin) return { status: 403, error: "Origem não permitida." };
  if (requireJson && (contentType ?? "").toLowerCase().split(";")[0]!.trim() !== "application/json") {
    return { status: 415, error: "Formato inválido." };
  }
  return null;
}
