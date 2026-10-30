import { ImageResponse } from "next/og";
import { alertPath, isPosterFormat, POSTER_FORMATS, posterContent } from "@mel/core";
import { getPublicLostCase } from "@mel/data";
import { photoDataUrl, posterFonts, qrDataUrl } from "@/lib/poster/assets";
import { photoBox, Poster } from "@/lib/poster/Poster";
import { siteOrigin } from "@/lib/site";
import { createPublicClient } from "@/lib/supabase/public";

/**
 * PNG do cartaz: /alerta/{code}/cartaz/{square|story|landscape|og}
 * ?baixar=1 → força download com nome amigável.
 * Usa só dados públicos do alerta (mesmos da página).
 */
export async function GET(request: Request, ctx: RouteContext<"/alerta/[code]/cartaz/[formato]">) {
  const { code, formato } = await ctx.params;
  if (!/^[a-z2-9]{6}$/i.test(code) || !isPosterFormat(formato)) {
    return new Response("Cartaz não encontrado.", { status: 404 });
  }

  let c;
  try {
    c = await getPublicLostCase(createPublicClient(), code);
  } catch (err) {
    console.error("[cartaz] falha ao carregar alerta", err);
    return new Response("Não conseguimos gerar o cartaz agora.", { status: 503 });
  }
  // Encerrado pelo tutor: não há mais "procura-se" para divulgar.
  if (!c || c.status === "CLOSED") return new Response("Cartaz não encontrado.", { status: 404 });

  const url = `${await siteOrigin()}${alertPath(c.code)}`;
  const box = photoBox(formato);
  const [photo, qr] = await Promise.all([
    photoDataUrl(c.pet.photos[0]?.url, box.width, box.height),
    qrDataUrl(url, 440),
  ]);
  const { width, height } = POSTER_FORMATS[formato];
  const download = new URL(request.url).searchParams.has("baixar");
  const filename = `MEL-${c.status === "FOUND" ? "encontrado" : "procura-se"}-${c.pet.name}-${formato}.png`
    .normalize("NFD")
    .replace(/[^\w.-]/g, "");

  return new ImageResponse(<Poster format={formato} content={posterContent(c)} photo={photo} qr={qr} url={url} />, {
    width,
    height,
    fonts: posterFonts,
    headers: {
      // Curto: o cartaz muda quando o alerta muda (ex.: ENCONTRADO).
      "Cache-Control": "public, max-age=300, s-maxage=300",
      ...(download ? { "Content-Disposition": `attachment; filename="${filename}"` } : {}),
    },
  });
}
