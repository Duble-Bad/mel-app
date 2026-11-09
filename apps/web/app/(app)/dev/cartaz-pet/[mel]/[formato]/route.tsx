import { ImageResponse } from "next/og";
import { posterContent } from "@mel/core";
import { getPetByMelId } from "@mel/data";
import { fetchPhoto, posterFonts } from "@/lib/poster/assets";
import { composePhotos } from "@/lib/poster/compose";
import { isV2Format, PosterV2, V2_FORMATS } from "@/lib/poster/PosterV2";
import { createPublicClient } from "@/lib/supabase/public";

/**
 * PRÉVIA INTERNA (só com MEL_DEV_ROUTES=1, nunca em produção) das propostas de cartaz
 * com um pet REAL do cadastro, quando ainda não há alerta publicado. Só lê dados
 * públicos do pet; não grava nada.
 *   /dev/cartaz-pet/{MEL-XXXXXX}/{impressao|square|portrait|story|landscape}?fotos=0,3,1
 * Sem alerta não há QR nem link (espaço reservado) e região/data aparecem como ausentes.
 */
export async function GET(request: Request, ctx: RouteContext<"/dev/cartaz-pet/[mel]/[formato]">) {
  if (process.env.MEL_DEV_ROUTES !== "1") return new Response("Não encontrado.", { status: 404 });
  const { mel, formato } = await ctx.params;
  if (!/^MEL-[A-Z0-9]{6}$/.test(mel) || !isV2Format(formato)) return new Response("Não encontrado.", { status: 404 });

  const client = createPublicClient();
  const pet = await getPetByMelId(client, mel);
  if (!pet) return new Response("Pet não encontrado ou não público.", { status: 404 });

  // Enquadramento escolhido pelo tutor (público como a própria foto).
  const { data: focusRows } = await client.from("pet_photos").select("id, focus_x, focus_y").eq("pet_id", pet.id);
  const focusById = new Map((focusRows ?? []).map((r) => [r.id, r.focus_x != null && r.focus_y != null ? { x: r.focus_x, y: r.focus_y } : null]));

  // ?fotos=índices na ordem do cadastro (capa primeiro); padrão: até 3, começando pela capa.
  const wanted = new URL(request.url).searchParams.get("fotos");
  const order = wanted ? wanted.split(",").map(Number).filter((n) => Number.isInteger(n) && pet.photos[n]) : [0, 1, 2];
  const picked = order.slice(0, 3).map((i) => pet.photos[i]).filter((p): p is NonNullable<typeof p> => Boolean(p));

  const fetched = await Promise.all(picked.map(async (p) => ({ source: await fetchPhoto(p.url), focus: focusById.get(p.id) ?? null })));
  const sources = fetched.filter((f): f is { source: Buffer; focus: { x: number; y: number } | null } => f.source !== null);
  const { layout, photos } = await composePhotos(formato, sources);

  // Texto pelo mesmo gerador dos cartazes; o que só o alerta tem fica marcado como ausente.
  const base = posterContent({
    status: "ACTIVE",
    pet: { ...pet, photos: [] } as never,
    areaLabel: null,
    lostAt: null,
    contactWhatsapp: null,
    contactPhone: null,
    notes: null,
    code: "",
  });
  const content = {
    ...base,
    lastSeen: "Região: ausente (vem do alerta, ainda não publicado)",
    when: "Data do desaparecimento: ausente (vem do alerta)",
  };

  const { width, height } = V2_FORMATS[formato];
  return new ImageResponse(<PosterV2 format={formato} content={content} photos={photos} layout={layout} qr={null} url={null} dev />, {
    width,
    height,
    fonts: posterFonts,
    headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" },
  });
}
