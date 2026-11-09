import { ImageResponse } from "next/og";
import { alertPath, isPosterFormat, POSTER_FORMATS, posterContent } from "@mel/core";
import { getPublicLostCase } from "@mel/data";
import { cropToDataUrl, fetchPhoto, photoDataUrl, posterFonts, qrDataUrl } from "@/lib/poster/assets";
import { OG_PHOTO, OG_SIZE, OgCard } from "@/lib/poster/OgCard";
import { photoBox, Poster } from "@/lib/poster/Poster";
import { isV2Format, photoLayout, PosterV2, V2_FORMATS } from "@/lib/poster/PosterV2";
import { siteOrigin } from "@/lib/site";
import { createPublicClient } from "@/lib/supabase/public";

/**
 * PNG do cartaz: /alerta/{code}/cartaz/{square|portrait|story|landscape|og}
 * ?baixar=1 → força download com nome amigável.
 * ?modelo=proposta → novos modelos em avaliação (também "impressao", o A4), sem substituir os atuais.
 * Usa só dados públicos do alerta (mesmos da página).
 */
export async function GET(request: Request, ctx: RouteContext<"/alerta/[code]/cartaz/[formato]">) {
  const { code, formato } = await ctx.params;
  const params = new URL(request.url).searchParams;
  const proposal = params.get("modelo") === "proposta";
  if (!/^[a-z2-9]{6}$/i.test(code) || !(proposal ? isV2Format(formato) : isPosterFormat(formato))) {
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
  const content = posterContent(c);
  // Capa (escolhida pelo tutor) primeiro; cada foto com o enquadramento dele.
  const photos = c.pet.photos;
  const filename = `MEL-${c.status === "FOUND" ? "encontrado" : "procura-se"}-${c.pet.name}-${formato}${proposal ? "-proposta" : ""}.png`
    .normalize("NFD")
    .replace(/[^\w.-]/g, "");
  const headers = {
    // Curto: o cartaz muda quando o alerta muda (ex.: ENCONTRADO).
    "Cache-Control": "public, max-age=300, s-maxage=300",
    ...(params.has("baixar") ? { "Content-Disposition": `attachment; filename="${filename}"` } : {}),
  };

  // Prévia do link (Facebook, WhatsApp…): a foto em destaque, pouco texto.
  if (formato === "og") {
    const photo = await photoDataUrl(photos[0]?.url, OG_PHOTO.width, OG_PHOTO.height, photos[0]?.focus);
    return new ImageResponse(<OgCard content={content} photo={photo} areaLabel={c.areaLabel} />, { ...OG_SIZE, fonts: posterFonts, headers });
  }

  if (proposal && isV2Format(formato)) {
    // Até 3 fotos; o layout se ajusta às que de fato chegaram (uma foto que falha não deixa buraco).
    const picked = photos.slice(0, 3);
    const fetched = await Promise.all(picked.map(async (p) => ({ source: await fetchPhoto(p.url), focus: p.focus })));
    const sources = fetched.filter((f): f is { source: Buffer; focus: (typeof picked)[number]["focus"] } => f.source !== null);
    const layout = photoLayout(formato, sources.length);
    const boxes = [layout.main, ...layout.extras];
    const [crops, qr] = await Promise.all([
      Promise.all(boxes.map((b, i) => (sources[i] ? cropToDataUrl(sources[i]!.source, b.width, b.height, sources[i]!.focus) : Promise.resolve(null)))),
      qrDataUrl(url, formato === "impressao" ? 860 : 600),
    ]);
    const ready = crops.filter((p): p is string => Boolean(p));
    const { width, height } = V2_FORMATS[formato];
    return new ImageResponse(<PosterV2 format={formato} content={content} photos={ready} qr={qr} url={url} />, { width, height, fonts: posterFonts, headers });
  }

  if (!isPosterFormat(formato)) return new Response("Cartaz não encontrado.", { status: 404 });
  const box = photoBox(formato);
  const [photo, qr] = await Promise.all([photoDataUrl(photos[0]?.url, box.width, box.height, photos[0]?.focus), qrDataUrl(url, 440)]);
  const { width, height } = POSTER_FORMATS[formato];
  return new ImageResponse(<Poster format={formato} content={content} photo={photo} qr={qr} url={url} />, { width, height, fonts: posterFonts, headers });
}
