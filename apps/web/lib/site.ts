import "server-only";
import { headers } from "next/headers";

/**
 * Endereço público do site, para links absolutos (QR Code, cartaz, Open Graph).
 * NEXT_PUBLIC_SITE_URL tem prioridade (produção); senão usa o host da requisição.
 */
export async function siteOrigin(): Promise<string> {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
  if (configured) return configured;
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}
