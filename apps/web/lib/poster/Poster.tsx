/* eslint-disable @next/next/no-img-element -- Satori (next/og) só desenha <img>, não <Image> */
import type { PosterContent, PosterFormat } from "@mel/core";
import { POSTER_FORMATS } from "@mel/core";
import { colors } from "@mel/ui-tokens";

// Layout do cartaz para o gerador de imagens (Satori): só flexbox e estilos
// inline. Cores sempre dos tokens.

interface PosterProps {
  format: PosterFormat;
  content: PosterContent;
  photo: string | null;
  qr: string;
  url: string;
}

const SPECIES_FALLBACK = "🐾";

/** Dimensões da foto em cada formato (usadas também para recortar a imagem). */
export function photoBox(format: PosterFormat): { width: number; height: number } {
  const { width, height } = POSTER_FORMATS[format];
  if (format === "landscape" || format === "og") return { width: Math.round(width * 0.42), height };
  if (format === "story") return { width, height: Math.round(height * 0.5) };
  return { width, height: Math.round(height * 0.38) };
}

/** Tamanhos de texto (px na base 1080) por formato — o quadrado precisa caber tudo. */
const TYPE = {
  square: { headline: 76, name: 84, details: 34, line: 34, small: 30, marks: 28, qr: 170, cta: 36, contact: 30, url: 24, brand: 26, pad: 40, gap: 8 },
  story: { headline: 96, name: 120, details: 40, line: 40, small: 36, marks: 32, qr: 230, cta: 42, contact: 36, url: 26, brand: 30, pad: 48, gap: 14 },
  landscape: { headline: 84, name: 104, details: 40, line: 40, small: 36, marks: 32, qr: 220, cta: 40, contact: 34, url: 26, brand: 30, pad: 48, gap: 12 },
  og: { headline: 84, name: 104, details: 40, line: 40, small: 36, marks: 32, qr: 170, cta: 40, contact: 34, url: 26, brand: 30, pad: 48, gap: 12 },
} as const;

export function Poster({ format, content, photo, qr, url }: PosterProps) {
  const { width, height } = POSTER_FORMATS[format];
  const horizontal = format === "landscape" || format === "og";
  const scale = horizontal ? height / 1080 : width / 1080;
  const s = (n: number) => Math.round(n * scale);
  const accent = content.found ? colors["status-found"] : colors["status-lost"];
  const box = photoBox(format);
  const t = TYPE[format];

  const Photo = (
    <div
      style={{
        display: "flex",
        width: box.width,
        height: box.height,
        background: colors["surface-muted"],
        alignItems: "center",
        justifyContent: "center",
        fontSize: s(220),
      }}
    >
      {photo ? <img src={photo} alt={`Foto de ${content.name}`} width={box.width} height={box.height} style={{ objectFit: "cover" }} /> : SPECIES_FALLBACK}
    </div>
  );

  const Text = (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, padding: s(t.pad), gap: s(t.gap), justifyContent: "space-between", overflow: "hidden" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: s(t.gap) }}>
        <div
          style={{
            display: "flex",
            alignSelf: "flex-start",
            background: accent,
            color: colors["text-inverse"],
            fontSize: s(t.headline),
            fontWeight: 800,
            letterSpacing: s(3),
            padding: `${s(6)}px ${s(24)}px`,
            borderRadius: s(12),
          }}
        >
          {content.headline}
        </div>
        <div style={{ display: "flex", fontSize: s(t.name), fontWeight: 800, color: colors["text-primary"], lineHeight: 1 }}>
          {content.name}
        </div>
        <div style={{ display: "flex", fontSize: s(t.details), fontWeight: 700, color: colors["text-secondary"] }}>{content.details}</div>
        {content.lastSeen && <div style={{ display: "flex", fontSize: s(t.line), color: colors["text-primary"] }}>{content.lastSeen}</div>}
        {content.when && <div style={{ display: "flex", fontSize: s(t.small), color: colors["text-secondary"] }}>{content.when}</div>}
        {content.marks && format !== "og" && (
          <div style={{ display: "flex", fontSize: s(t.marks), color: colors["text-primary"], lineHeight: 1.25 }}>{content.marks}</div>
        )}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: s(28) }}>
        <img src={qr} alt="QR Code do alerta" width={s(t.qr)} height={s(t.qr)} />
        <div style={{ display: "flex", flexDirection: "column", gap: s(8), flex: 1 }}>
          <div style={{ display: "flex", fontSize: s(t.cta), fontWeight: 800, color: accent }}>{content.cta}</div>
          {content.contact && <div style={{ display: "flex", fontSize: s(t.contact), fontWeight: 700, color: colors["text-primary"] }}>{content.contact}</div>}
          <div style={{ display: "flex", fontSize: s(26), color: colors["text-secondary"] }}>{url.replace(/^https?:\/\//, "")}</div>
          <div style={{ display: "flex", fontSize: s(t.brand), fontWeight: 800, color: colors["brand-primary"] }}>
            MEL · Uma rede inteira procurando com você.
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div
      style={{
        width,
        height,
        display: "flex",
        flexDirection: horizontal ? "row" : "column",
        background: colors.surface,
        fontFamily: "Figtree",
        border: `${s(14)}px solid ${accent}`,
        overflow: "hidden",
      }}
    >
      {Photo}
      {Text}
    </div>
  );
}
