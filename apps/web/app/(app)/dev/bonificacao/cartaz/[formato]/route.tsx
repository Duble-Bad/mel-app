import { ImageResponse } from "next/og";
import { rewardLine, SIGHTING_BUTTON_LABEL, type PosterContent } from "@mel/core";
import { posterFonts } from "@/lib/poster/assets";
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
  return new ImageResponse(
    <PosterV2
      format={formato}
      content={content}
      photos={[]}
      layout={photoLayout(formato, [4 / 3], { reward: Boolean(reward) })}
      qr={null}
      url={null}
      dev
      reward={reward}
    />,
    { width, height, fonts: posterFonts, headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" } },
  );
}
