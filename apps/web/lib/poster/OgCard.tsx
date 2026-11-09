/* eslint-disable @next/next/no-img-element -- Satori (next/og) só desenha <img>, não <Image> */
import type { PosterContent } from "@mel/core";

// Prévia do link (Facebook, WhatsApp, X…): 1200×630, a FOTO do animal em destaque e
// pouco texto (status, nome, região). O cartaz completo continua nos downloads.
export const OG_SIZE = { width: 1200, height: 630 } as const;
/** Área da foto (recorte feito antes, com o enquadramento escolhido). */
export const OG_PHOTO = { width: 780, height: 630 } as const;

export function OgCard({ content, photo, areaLabel }: { content: PosterContent; photo: string | null; areaLabel: string | null }) {
  const accent = content.found ? "#15895e" : "#e5484d";
  return (
    <div style={{ width: OG_SIZE.width, height: OG_SIZE.height, display: "flex", background: "#0a111d", fontFamily: "Figtree" }}>
      <div style={{ display: "flex", width: OG_PHOTO.width, height: OG_PHOTO.height, alignItems: "center", justifyContent: "center", background: "#15223a", fontSize: 220 }}>
        {photo ? <img src={photo} alt={`Foto de ${content.name}`} width={OG_PHOTO.width} height={OG_PHOTO.height} style={{ objectFit: "cover" }} /> : "🐾"}
      </div>
      <div style={{ display: "flex", flexDirection: "column", flex: 1, padding: "52px 44px", justifyContent: "space-between", borderLeft: `10px solid ${accent}` }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
          <div style={{ display: "flex", alignSelf: "flex-start", background: accent, color: "#fff", fontSize: 40, fontWeight: 800, letterSpacing: 2, padding: "8px 22px", borderRadius: 999 }}>
            {content.found ? "ENCONTRADO" : "PERDIDO"}
          </div>
          <div style={{ display: "flex", color: "#f5f2ea", fontSize: content.name.length > 14 ? 58 : 72, fontWeight: 800, lineHeight: 1.02 }}>{content.name}</div>
          {areaLabel && <div style={{ display: "flex", color: "#c9d1dc", fontSize: 32, lineHeight: 1.2 }}>{areaLabel}</div>}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ display: "flex", color: "#f6b928", fontSize: 34, fontWeight: 800 }}>{content.found ? "Reencontrado!" : "Viu este pet? Avise."}</div>
          <div style={{ display: "flex", color: "#8f9bb0", fontSize: 26, fontWeight: 700 }}>MEL · rede de busca de pets</div>
        </div>
      </div>
    </div>
  );
}
