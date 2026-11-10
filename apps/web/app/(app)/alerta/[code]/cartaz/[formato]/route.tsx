import { ImageResponse } from "next/og";
import { alertPath, collageExtras, isPosterFormat, POSTER_FORMATS, posterContent } from "@mel/core";
import { getPublicLostCase } from "@mel/data";
import { fetchPhoto, photoDataUrl, posterFonts, qrDataUrl } from "@/lib/poster/assets";
import { composePhotos } from "@/lib/poster/compose";
import { clampFraming, type Framing, parseFramings, ZOOM_FLOOR } from "@/lib/poster/framing";
import { isPosterModel, modelCapacity } from "@/lib/poster/models";
import { PosterCollage } from "@/lib/poster/PosterCollage";
import { PosterClassic, PosterHero } from "@/lib/poster/PosterModels";
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
  // Os quatro modelos do "Criar cartaz" (?estilo=1–4) são públicos desde 2026-11-10; as demais
  // propostas em avaliação (sem estilo) seguem só no ambiente de teste (DEV).
  if (proposal && !isPosterModel(Number(params.get("estilo"))) && process.env.MEL_DEV_ROUTES !== "1") return new Response("Cartaz não encontrado.", { status: 404 });
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
  const estiloParam = params.get("estilo");
  const filename = `MEL-${c.status === "FOUND" ? "encontrado" : "procura-se"}-${c.pet.name}-${formato}${proposal ? (estiloParam ? `-modelo-${estiloParam}` : "-proposta") : ""}.png`
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
    // ?estilo=1|2|3|4: modelo escolhido pelo tutor (1 foto em destaque, 2 várias fotos, 3 clássico, 4 cartaz completo).
    const estilo = Number(params.get("estilo") ?? 2);
    const model = isPosterModel(estilo) ? estilo : 2;
    // Até a capacidade do modelo (3, ou até 6 no cartaz completo); o layout se ajusta às que de
    // fato chegaram (uma foto que falha não deixa buraco).
    // ?fotos=índices (capa primeiro) para comparar combinações; padrão: a partir da capa.
    const cap = modelCapacity(formato, model);
    const wanted = params.get("fotos");
    const order = (wanted && /^\d(,\d){0,5}$/.test(wanted) ? wanted.split(",").map(Number) : Array.from({ length: cap }, (_, i) => i)).slice(0, cap);
    const picked = order.map((i) => photos[i]).filter((p): p is (typeof photos)[number] => Boolean(p));
    // ?foco=x,y (só nesta avaliação em DEV): simula o enquadramento do tutor na foto principal,
    // sem gravar nada, para conferir se um ponto único serve aos cinco formatos.
    const simulated = /^(\d{1,3}),(\d{1,3})$/.exec(params.get("foco") ?? "");
    // ?quadros=x,y,zoom_x,y,zoom…: enquadramento do editor para cada foto, na ordem do cartaz
    // ("-" = padrão do modelo). Endereços antigos: ?foco + ?zoom valem para a principal.
    const framings = parseFramings(params.get("quadros"));
    const zoom = Number(params.get("zoom"));
    if (!framings.length && params.has("zoom") && zoom >= ZOOM_FLOOR && zoom <= 3)
      framings[0] = clampFraming({ x: simulated ? Number(simulated[1]) : 50, y: simulated ? Number(simulated[2]) : 50, zoom });
    const fetched = await Promise.all(
      picked.map(async (p, i) => ({
        source: await fetchPhoto(p.url),
        focus: i === 0 && simulated ? { x: Math.min(100, Number(simulated[1])), y: Math.min(100, Number(simulated[2])) } : p.focus,
        framing: framings[i] ?? null,
      })),
    );
    // Uma foto que não chega sai junto com o seu enquadramento (as outras não mudam de lugar).
    const sources = fetched.filter((f): f is { source: Buffer; focus: (typeof picked)[number]["focus"]; framing: Framing | null } => f.source !== null);
    const [{ layout, model: chosen, photos: ready, diagnostics }, qr] = await Promise.all([
      composePhotos(formato, sources, { model }),
      qrDataUrl(url, formato === "impressao" ? 860 : 600),
    ]);
    const { width, height } = V2_FORMATS[formato];
    // Sem o domínio oficial configurado (DEV), o link vai marcado como ambiente de teste.
    const dev = !process.env.NEXT_PUBLIC_SITE_URL;
    // Horário marcado como aproximado pelo tutor: "por volta das 22:00".
    // Nos modelos novos vai a descrição INTEIRA do tutor (os cartazes atuais cortam em 140
    // caracteres); cada modelo ajusta a letra e só corta com "…" se não couber no espaço dele.
    const fullMarks = [c.pet.uniqueMarks, c.notes].filter(Boolean).join(" ") || null;
    const proposalContent = {
      ...content,
      marks: fullMarks,
      ...(c.lostAtUncertain && content.when ? { when: content.when.replace(/ às (\d{1,2}:\d{2})$/, ", por volta das $1") } : {}),
    };
    const art =
      model === 4 ? (
        <PosterCollage format={formato} content={proposalContent} photos={ready} layout={chosen} qr={qr} url={url} dev={dev} extras={collageExtras(c)} />
      ) : model === 1 ? (
        <PosterHero format={formato} content={proposalContent} photos={ready} layout={chosen} qr={qr} url={url} dev={dev} />
      ) : model === 3 ? (
        <PosterClassic format={formato} content={proposalContent} photos={ready} layout={chosen} qr={qr} url={url} dev={dev} />
      ) : (
        <PosterV2 format={formato} content={proposalContent} photos={ready} layout={layout} qr={qr} url={url} dev={dev} card={chosen.card} cardBelowExtras={chosen.cardBelowExtras} />
      );
    return new ImageResponse(art, {
      width,
      height,
      fonts: posterFonts,
      // Diagnóstico do encaixe das fotos (avaliação interna em DEV; nunca vai para a arte).
      headers: {
        ...headers,
        "X-Robots-Tag": "noindex, nofollow",
        ...(process.env.MEL_DEV_ROUTES === "1" ? { "X-Mel-Diagnostico": JSON.stringify(diagnostics) } : {}),
      },
    });
  }

  if (!isPosterFormat(formato)) return new Response("Cartaz não encontrado.", { status: 404 });
  const box = photoBox(formato);
  const [photo, qr] = await Promise.all([photoDataUrl(photos[0]?.url, box.width, box.height, photos[0]?.focus), qrDataUrl(url, 440)]);
  const { width, height } = POSTER_FORMATS[formato];
  return new ImageResponse(<Poster format={formato} content={content} photo={photo} qr={qr} url={url} />, { width, height, fonts: posterFonts, headers });
}
