import type { NextRequest } from "next/server";
import { getPublicLostCase } from "@mel/data";
import { createPublicClient } from "@/lib/supabase/public";

/**
 * Fotos públicas de um alerta (carrossel da gaveta do mapa). Mesma leitura da página do alerta,
 * como visitante anônimo: só alerta publicado, só fotos (nada de contato ou ponto exato).
 */
export async function GET(_request: NextRequest, { params }: RouteContext<"/api/alertas/[code]/fotos">) {
  const { code } = await params;
  if (!/^[a-z0-9]{4,16}$/i.test(code)) return Response.json({ photos: [] }, { status: 404 });
  try {
    const c = await getPublicLostCase(createPublicClient(), code);
    if (!c) return Response.json({ photos: [] }, { status: 404 });
    const photos = c.pet.photos.map((p) => ({ url: p.url, thumbUrl: p.thumbUrl, focus: p.focus }));
    return Response.json({ photos }, { headers: { "Cache-Control": "public, max-age=60, s-maxage=60" } });
  } catch (err) {
    console.error("[api/alertas/fotos] falhou", err);
    return Response.json({ photos: [] }, { status: 500 });
  }
}
