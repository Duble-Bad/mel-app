import { ImageResponse } from "next/og";
import { alertPath, isPosterFormat, POSTER_FORMATS, posterContent } from "@mel/core";
import { getPublicLostCase } from "@mel/data";
import { fetchPhoto, photoDataUrl, posterFonts, qrDataUrl } from "@/lib/poster/assets";
import { composePhotos } from "@/lib/poster/compose";
import { OG_PHOTO, OG_SIZE, OgCard } from "@/lib/poster/OgCard";
import { photoBox, Poster } from "@/lib/poster/Poster";
import { isV2Format, PosterV2, V2_FORMATS } from "@/lib/poster/PosterV2";
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
  // Propostas em avaliação: só no ambiente de teste (DEV), nunca no endereço público.
  if (proposal && process.env.MEL_DEV_ROUTES !== "1") return new Response("Cartaz não encontrado.", { status: 404 });
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
    // ?fotos=índices (capa primeiro) para comparar combinações; padrão: até 3 a partir da capa.
    const wanted = params.get("fotos");
    const order = wanted && /^\d(,\d){0,2}$/.test(wanted) ? wanted.split(",").map(Number) : [0, 1, 2];
    const picked = order.map((i) => photos[i]).filter((p): p is (typeof photos)[number] => Boolean(p));
    // ?foco=x,y (só nesta avaliação em DEV): simula o enquadramento do tutor na foto principal,
    // sem gravar nada, para conferir se um ponto único serve aos cinco formatos.
    const simulated = /^(\d{1,3}),(\d{1,3})$/.exec(params.get("foco") ?? "");
    const fetched = await Promise.all(
      picked.map(async (p, i) => ({
        source: await fetchPhoto(p.url),
        focus: i === 0 && simulated ? { x: Math.min(100, Number(simulated[1])), y: Math.min(100, Number(simulated[2])) } : p.focus,
      })),
    );
    const sources = fetched.filter((f): f is { source: Buffer; focus: (typeof picked)[number]["focus"] } => f.source !== null);
    // ?zoom=1..3 (protótipo do editor, DEV): enquadramento explícito da principal neste formato
    // (ponto do ?foco + aproximação), aplicado só nesta imagem — nada é gravado.
    const zoom = Number(params.get("zoom"));
    const framing =
      params.has("zoom") && zoom >= 1 && zoom <= 3
        ? { focus: simulated ? { x: Math.min(100, Number(simulated[1])), y: Math.min(100, Number(simulated[2])) } : { x: 50, y: 50 }, zoom }
        : undefined;
    const [{ layout, photos: ready, diagnostics }, qr] = await Promise.all([
      composePhotos(formato, sources, { framing }),
      qrDataUrl(url, formato === "impressao" ? 860 : 600),
    ]);
    const { width, height } = V2_FORMATS[formato];
    // Sem o domínio oficial configurado (DEV), o link vai marcado como ambiente de teste.
    const dev = !process.env.NEXT_PUBLIC_SITE_URL;
    // Horário marcado como aproximado pelo tutor: "por volta das 22:00".
    const proposalContent =
      c.lostAtUncertain && content.when ? { ...content, when: content.when.replace(/ às (\d{1,2}:\d{2})$/, ", por volta das $1") } : content;
    return new ImageResponse(<PosterV2 format={formato} content={proposalContent} photos={ready} layout={layout} qr={qr} url={url} dev={dev} />, {
      width,
      height,
      fonts: posterFonts,
      // Diagnóstico do encaixe das fotos (avaliação interna em DEV; nunca vai para a arte).
      headers: { ...headers, "X-Robots-Tag": "noindex, nofollow", "X-Mel-Diagnostico": JSON.stringify(diagnostics) },
    });
  }

  if (!isPosterFormat(formato)) return new Response("Cartaz não encontrado.", { status: 404 });
  const box = photoBox(formato);
  const [photo, qr] = await Promise.all([photoDataUrl(photos[0]?.url, box.width, box.height, photos[0]?.focus), qrDataUrl(url, 440)]);
  const { width, height } = POSTER_FORMATS[formato];
  return new ImageResponse(<Poster format={formato} content={content} photo={photo} qr={qr} url={url} />, { width, height, fonts: posterFonts, headers });
}
