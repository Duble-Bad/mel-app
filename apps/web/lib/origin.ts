import type { NextRequest } from "next/server";

/**
 * Origem que o NAVEGADOR usou (protocolo + host), para redirecionamentos e para
 * a checagem de mesma origem. `request.nextUrl.origin` vem do endereço em que o
 * servidor escuta: com `next start -H 0.0.0.0` (celular na rede local) virava
 * `http://0.0.0.0:3000` — o login voltava para lá e as APIs recusavam o próprio
 * site. Atrás de proxy (Vercel, HTTPS local de teste) valem os cabeçalhos x-forwarded-*.
 */
export function requestOrigin(request: NextRequest): string {
  const first = (v: string | null) => v?.split(",")[0]?.trim() || null;
  const proto = first(request.headers.get("x-forwarded-proto")) ?? request.nextUrl.protocol.replace(/:$/, "");
  const host = first(request.headers.get("x-forwarded-host")) ?? request.headers.get("host") ?? request.nextUrl.host;
  return `${proto}://${host}`;
}

/** Requisição sem Origin (mesmo site, navegação) ou com Origin igual à do site. */
export function isSameOrigin(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  return !origin || origin === requestOrigin(request);
}
