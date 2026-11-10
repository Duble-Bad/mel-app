import { ImageResponse } from "next/og";
import { rewardLine, SIGHTING_BUTTON_LABEL, type PosterContent } from "@mel/core";
import { posterFonts } from "@/lib/poster/assets";
import { isPosterModel, modelLayout } from "@/lib/poster/models";
import { PosterCollage } from "@/lib/poster/PosterCollage";
import { PosterClassic, PosterHero } from "@/lib/poster/PosterModels";
import { isV2Format, photoLayout, PosterV2, V2_FORMATS } from "@/lib/poster/PosterV2";

/**
 * PROTÓTIPO INTERNO (só com MEL_DEV_ROUTES=1) da bonificação nos cartazes, com um caso
 * FICTÍCIO — nenhum pet, foto ou alerta real (a Mel não é usada aqui). Não grava nada.
 *   /dev/bonificacao/cartaz/{formato}?centavos=50000&status=ACTIVE|FOUND
 * Sem bonificação (centavos ausente/0) ou alerta não ativo: o cartaz sai sem o bloco.
 */
export async function GET(request: Request, ctx: RouteContext<"/dev/bonificacao/cartaz/[formato]">) {
  if (process.env.MEL_DEV_ROUTES !== "1") return new Response("Não encontrado.", { status: 404 });
  const { formato } = await ctx.params;
  if (!isV2Format(formato)) return new Response("Não encontrado.", { status: 404 });
  const q = new URL(request.url).searchParams;
  const status = q.get("status") === "FOUND" ? "FOUND" : "ACTIVE";
  const cents = Number(q.get("centavos") ?? 0);
  const found = status === "FOUND";

  const content: PosterContent = {
    headline: found ? "ENCONTRADO!" : "PROCURA-SE",
    name: "Pet de exemplo",
    details: "Cachorro · SRD · Porte médio",
    // Região longa de propósito (duas linhas): o pior caso de espaço no painel.
    lastSeen: "Visto por último: Jardim de Exemplo, Cidade Fictícia – SP (DEMONSTRAÇÃO)",
    when: "Desde 01/11, por volta das 18:00",
    marks: "Caso fictício para avaliar a bonificação: nenhum dado real.",
    contact: null,
    cta: found ? "Obrigado a todos que ajudaram!" : "VIU ESTE PET?",
    action: found ? null : `Escaneie o QR Code e toque em “${SIGHTING_BUTTON_LABEL}”.`,
    code: "demo00",
    displayCode: "DEMO00",
    found,
  };
  const { width, height } = V2_FORMATS[formato];
  const reward = Number.isInteger(cents) ? rewardLine(status, cents) : null;
  // ?estilo=1|2|3|4: o mesmo selo nos quatro modelos que o tutor pode escolher.
  const estilo = Number(q.get("estilo") ?? 2);
  const model = isPosterModel(estilo) ? estilo : 2;
  const layout = modelLayout(formato, model, [4 / 3], { reward: Boolean(reward) });
  const common = { format: formato, content, photos: [], qr: null, url: null, dev: true, reward };
  return new ImageResponse(
    model === 4 ? (
      <PosterCollage
        {...common}
        layout={layout}
        extras={{
          strip: ["SRD", "Porte médio", "Caso fictício"],
          features: ["Caso fictício para avaliar a bonificação.", "Nenhum dado real."],
          placeTitle: "DESAPARECEU EM CIDADE FICTÍCIA/SP",
          placeLine: "Jardim de Exemplo (DEMONSTRAÇÃO)",
          phone: null,
          article: "o",
        }}
      />
    ) : model === 1 ? (
      <PosterHero {...common} layout={layout} />
    ) : model === 3 ? (
      <PosterClassic {...common} layout={layout} />
    ) : (
      <PosterV2 {...common} layout={photoLayout(formato, [4 / 3], { reward: Boolean(reward) })} />
    ),
    { width, height, fonts: posterFonts, headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" } },
  );
}
