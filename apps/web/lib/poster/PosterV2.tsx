/* eslint-disable @next/next/no-img-element -- Satori (next/og) só desenha <img>, não <Image> */
import type { PosterContent } from "@mel/core";

// PROPOSTA de cartaz (aguarda aprovação do proprietário; os modelos atuais continuam
// valendo). Foto grande em primeiro lugar; com mais fotos, uma principal e até duas
// menores. Satori: só flexbox e estilos inline.

export type PosterV2Format = "impressao" | "square" | "portrait" | "story" | "landscape";

export const V2_FORMATS: Record<PosterV2Format, { width: number; height: number; label: string; hint: string }> = {
  // A4 (210×297 mm) em 200 dpi. Chave "impressao": /cartaz/a4 já é a página de impressão atual.
  impressao: { width: 1654, height: 2339, label: "A4 para imprimir", hint: "Folha A4 em 200 dpi, fundo branco (economiza tinta)" },
  square: { width: 1080, height: 1080, label: "Quadrado", hint: "Feed do Instagram/Facebook e WhatsApp (1:1)" },
  portrait: { width: 1080, height: 1350, label: "Feed 4:5", hint: "Feed do Instagram (4:5)" },
  story: { width: 1080, height: 1920, label: "Stories / Status", hint: "Stories, Status e TikTok (9:16)" },
  landscape: { width: 1920, height: 1080, label: "Horizontal", hint: "Grupos, telas e Facebook (16:9)" },
};

export const isV2Format = (v: string): v is PosterV2Format => v in V2_FORMATS;

type Box = { width: number; height: number };
/** Onde entram as fotos: a principal e, se houver, até duas secundárias. */
export interface PhotoLayout {
  main: Box;
  extras: Box[];
  /** Secundárias ao lado (coluna) ou embaixo (linha) da principal. */
  extrasDirection: "column" | "row";
}

const NAVY = "#0a111d";
const PANEL = "#111c2e";
const GOLD = "#f6b928";
const TEXT = "#f5f2ea";
const MUTED = "#b3bdcc";

/** Distribuição das fotos por formato e quantidade (1, 2 ou 3). */
export function photoLayout(format: PosterV2Format, count: number): PhotoLayout {
  const extras = Math.min(2, Math.max(0, count - 1));
  const { width } = V2_FORMATS[format];
  const split = (total: number, n: number) => Array.from({ length: n }, () => Math.floor(total / n));
  switch (format) {
    case "square": {
      const h = 640;
      if (!extras) return { main: { width, height: h }, extras: [], extrasDirection: "column" };
      return { main: { width: 720, height: h }, extras: split(h, extras).map((eh) => ({ width: 360, height: eh })), extrasDirection: "column" };
    }
    case "portrait": {
      const h = 820;
      if (!extras) return { main: { width, height: h }, extras: [], extrasDirection: "column" };
      return { main: { width: 720, height: h }, extras: split(h, extras).map((eh) => ({ width: 360, height: eh })), extrasDirection: "column" };
    }
    case "story": {
      if (!extras) return { main: { width, height: 980 }, extras: [], extrasDirection: "row" };
      return { main: { width, height: 760 }, extras: split(width, extras).map((ew) => ({ width: ew, height: 260 })), extrasDirection: "row" };
    }
    case "landscape": {
      const w = 1120;
      if (!extras) return { main: { width: w, height: 1080 }, extras: [], extrasDirection: "row" };
      return { main: { width: w, height: 760 }, extras: split(w, extras).map((ew) => ({ width: ew, height: 320 })), extrasDirection: "row" };
    }
    case "impressao": {
      const w = width - 2 * 90;
      // Altura que sobra para nome, dados e QR sem apertar o texto (A4 = 2339 px).
      if (!extras) return { main: { width: w, height: 1060 }, extras: [], extrasDirection: "row" };
      return { main: { width: w, height: 780 }, extras: split(w - 24 * (extras - 1), extras).map((ew) => ({ width: ew, height: 260 })), extrasDirection: "row" };
    }
  }
}

interface Props {
  format: PosterV2Format;
  content: PosterContent;
  /** Fotos já recortadas nos tamanhos de photoLayout (principal primeiro). */
  photos: string[];
  qr: string;
  url: string;
}

export function PosterV2({ format, content, photos, qr, url }: Props) {
  const { width, height } = V2_FORMATS[format];
  const layout = photoLayout(format, photos.length);
  const accent = content.found ? "#15895e" : "#e5484d";
  const status = content.found ? "ENCONTRADO" : "PERDIDO";
  const shown = url.replace(/^https?:\/\//, "");
  const urlPrefix = shown.slice(0, shown.length - content.code.length);
  const nameSize = (base: number) => (content.name.length > 16 ? Math.round(base * 0.68) : content.name.length > 11 ? Math.round(base * 0.82) : base);

  const photo = (src: string | undefined, box: Box, key: number, radius = 0) =>
    src ? (
      <img key={key} src={src} alt="" width={box.width} height={box.height} style={{ objectFit: "cover", borderRadius: radius }} />
    ) : (
      <div key={key} style={{ display: "flex", width: box.width, height: box.height, alignItems: "center", justifyContent: "center", background: "#1d2b44", fontSize: Math.round(box.height * 0.35), borderRadius: radius }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: Math.round(box.height * 0.03) }}>
          <div style={{ display: "flex" }}>🐾</div>
          {/* Sem foto: dizer, para não parecer uma imagem quebrada. */}
          <div style={{ display: "flex", color: MUTED, fontSize: Math.max(22, Math.round(box.height * 0.06)), fontWeight: 700 }}>Sem foto</div>
        </div>
      </div>
    );

  /** Foto principal + secundárias, com o selo PERDIDO/ENCONTRADO sobre a principal. */
  const gallery = ({ gap = 0, radius = 0, badge = 64 }: { gap?: number; radius?: number; badge?: number }) => (
    <div style={{ display: "flex", flexDirection: layout.extrasDirection === "column" ? "row" : "column", gap }}>
      <div style={{ display: "flex", position: "relative" }}>
        {photo(photos[0], layout.main, 0, radius)}
        {badge > 0 && (
        <div
          style={{
            display: "flex",
            position: "absolute",
            top: Math.round(badge * 0.45),
            left: Math.round(badge * 0.45),
            background: accent,
            color: "#fff",
            fontSize: badge,
            fontWeight: 800,
            letterSpacing: Math.round(badge * 0.06),
            padding: `${Math.round(badge * 0.14)}px ${Math.round(badge * 0.4)}px`,
            borderRadius: 999,
            boxShadow: "0 6px 24px rgba(0,0,0,.35)",
          }}
        >
          {status}
        </div>
        )}
      </div>
      {layout.extras.length > 0 && (
        <div style={{ display: "flex", flexDirection: layout.extrasDirection, gap }}>{layout.extras.map((b, i) => photo(photos[i + 1], b, i + 1, radius))}</div>
      )}
    </div>
  );

  const qrBlock = ({ size, label }: { size: number; label: number }) => (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: Math.round(size * 0.04), background: "#fff", padding: Math.round(size * 0.06), borderRadius: Math.round(size * 0.08) }}>
      <img src={qr} alt="QR Code do alerta" width={size} height={size} />
      <div style={{ display: "flex", color: NAVY, fontSize: label, fontWeight: 800 }}>{content.found ? "Abrir o alerta" : "Escaneie e avise"}</div>
    </div>
  );

  const urlLine = ({ size }: { size: number }) => (
    <div style={{ display: "flex", alignItems: "baseline", flexWrap: "wrap", color: MUTED }}>
      <span style={{ fontSize: size }}>{urlPrefix}</span>
      <span style={{ fontSize: Math.round(size * 1.3), fontWeight: 800, color: TEXT, letterSpacing: 2 }}>{content.displayCode}</span>
    </div>
  );

  // ---------------- A4 (impressão, fundo branco) ----------------
  if (format === "impressao") {
    return (
      <div style={{ width, height, display: "flex", flexDirection: "column", background: "#ffffff", fontFamily: "Figtree", color: NAVY }}>
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: 230, background: accent, color: "#fff", fontSize: 168, fontWeight: 800, letterSpacing: 10 }}>
          {content.headline}
        </div>
        <div style={{ display: "flex", flexDirection: "column", padding: "60px 90px 0", gap: 24 }}>
          {gallery({ gap: 24, radius: 28, badge: 0 })}
        </div>
        <div style={{ display: "flex", flexDirection: "column", padding: "40px 90px 0", gap: 14, flex: 1 }}>
          <div style={{ display: "flex", flexShrink: 0, fontSize: nameSize(136), fontWeight: 800, lineHeight: 1.05 }}>{content.name}</div>
          <div style={{ display: "flex", flexShrink: 0, fontSize: 52, fontWeight: 700, color: "#475467" }}>{content.details}</div>
          {content.lastSeen && <div style={{ display: "flex", flexShrink: 0, fontSize: 48, fontWeight: 700 }}>{content.lastSeen}</div>}
          {content.when && <div style={{ display: "flex", flexShrink: 0, fontSize: 42, color: "#475467" }}>{content.when}</div>}
          {content.marks && <div style={{ display: "flex", flexShrink: 0, fontSize: 38, lineHeight: 1.25, color: NAVY }}>{content.marks}</div>}
        </div>
        <div style={{ display: "flex", flexShrink: 0, alignItems: "center", gap: 48, padding: "0 90px 64px" }}>
          <img src={qr} alt="QR Code do alerta" width={390} height={390} />
          <div style={{ display: "flex", flexDirection: "column", gap: 14, flex: 1 }}>
            <div style={{ display: "flex", fontSize: 86, fontWeight: 800, color: accent, lineHeight: 1 }}>{content.cta}</div>
            {content.action && <div style={{ display: "flex", fontSize: 42, fontWeight: 700, lineHeight: 1.2 }}>{content.action}</div>}
            {content.contact && <div style={{ display: "flex", fontSize: 54, fontWeight: 800 }}>{content.contact}</div>}
            <div style={{ display: "flex", alignItems: "baseline", flexWrap: "wrap", color: "#475467" }}>
              <span style={{ fontSize: 36 }}>{urlPrefix}</span>
              <span style={{ fontSize: 48, fontWeight: 800, color: NAVY, letterSpacing: 3 }}>{content.displayCode}</span>
            </div>
            <div style={{ display: "flex", fontSize: 36, fontWeight: 800, color: "#9a6a10" }}>MEL · Uma rede inteira procurando com você.</div>
          </div>
        </div>
      </div>
    );
  }

  // ---------------- Horizontal ----------------
  if (format === "landscape") {
    return (
      <div style={{ width, height, display: "flex", background: NAVY, fontFamily: "Figtree", color: TEXT }}>
        {gallery({ gap: 0, badge: 64 })}
        <div style={{ display: "flex", flexDirection: "column", flex: 1, padding: "60px 56px", justifyContent: "space-between", borderLeft: `12px solid ${accent}` }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "flex", fontSize: nameSize(112), fontWeight: 800, lineHeight: 1 }}>{content.name}</div>
            <div style={{ display: "flex", fontSize: 38, fontWeight: 700, color: MUTED }}>{content.details}</div>
            {content.lastSeen && <div style={{ display: "flex", fontSize: 38, fontWeight: 700 }}>{content.lastSeen}</div>}
            {content.when && <div style={{ display: "flex", fontSize: 32, color: MUTED }}>{content.when}</div>}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 32 }}>
            {qrBlock({ size: 250, label: 26 })}
            <div style={{ display: "flex", flexDirection: "column", gap: 10, flex: 1 }}>
              <div style={{ display: "flex", fontSize: 58, fontWeight: 800, color: GOLD, lineHeight: 1 }}>{content.cta}</div>
              {content.contact && <div style={{ display: "flex", fontSize: 34, fontWeight: 800 }}>{content.contact}</div>}
              {urlLine({ size: 26 })}
              <div style={{ display: "flex", fontSize: 28, fontWeight: 800, color: GOLD }}>MEL</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ---------------- Stories (9:16): texto na largura toda, QR na linha de baixo ----------------
  if (format === "story") {
    const marks = content.marks && content.marks.length > 96 ? `${content.marks.slice(0, 95).trimEnd()}…` : content.marks;
    return (
      <div style={{ width, height, display: "flex", flexDirection: "column", background: NAVY, fontFamily: "Figtree", color: TEXT }}>
        {gallery({ gap: 0, badge: 72 })}
        <div style={{ display: "flex", flexDirection: "column", flex: 1, padding: "44px 52px", justifyContent: "space-between", borderTop: `12px solid ${accent}`, background: PANEL }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ display: "flex", fontSize: nameSize(112), fontWeight: 800, lineHeight: 1 }}>{content.name}</div>
            <div style={{ display: "flex", fontSize: 40, fontWeight: 700, color: MUTED }}>{content.details}</div>
            {content.lastSeen && <div style={{ display: "flex", fontSize: 40, fontWeight: 700 }}>{content.lastSeen}</div>}
            {content.when && <div style={{ display: "flex", fontSize: 34, color: MUTED }}>{content.when}</div>}
            {marks && <div style={{ display: "flex", fontSize: 32, lineHeight: 1.25 }}>{marks}</div>}
          </div>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 36 }}>
            <div style={{ display: "flex", flexDirection: "column", flex: 1, gap: 10 }}>
              <div style={{ display: "flex", fontSize: 64, fontWeight: 800, color: GOLD, lineHeight: 1 }}>{content.cta}</div>
              {content.action && <div style={{ display: "flex", fontSize: 30, fontWeight: 700, lineHeight: 1.2 }}>{content.action}</div>}
              {content.contact && <div style={{ display: "flex", fontSize: 36, fontWeight: 800 }}>{content.contact}</div>}
              {urlLine({ size: 26 })}
            </div>
            {qrBlock({ size: 250, label: 28 })}
          </div>
        </div>
      </div>
    );
  }

  // ---------------- Quadrado e Feed 4:5 ----------------
  const T = format === "portrait"
    ? { name: 96, details: 34, line: 34, small: 30, marks: 0, qr: 230, qrLabel: 24, cta: 52, contact: 30, url: 24, pad: 44, gap: 10 }
    : { name: 84, details: 30, line: 30, small: 26, marks: 0, qr: 200, qrLabel: 22, cta: 46, contact: 28, url: 22, pad: 40, gap: 8 };
  return (
    <div style={{ width, height, display: "flex", flexDirection: "column", background: NAVY, fontFamily: "Figtree", color: TEXT }}>
      {gallery({ gap: 0, badge: 56 })}
      <div style={{ display: "flex", flex: 1, padding: T.pad, gap: 32, borderTop: `12px solid ${accent}`, background: PANEL }}>
        <div style={{ display: "flex", flexDirection: "column", flex: 1, gap: T.gap, justifyContent: "space-between" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: T.gap }}>
            <div style={{ display: "flex", fontSize: nameSize(T.name), fontWeight: 800, lineHeight: 1 }}>{content.name}</div>
            <div style={{ display: "flex", fontSize: T.details, fontWeight: 700, color: MUTED }}>{content.details}</div>
            {content.lastSeen && <div style={{ display: "flex", fontSize: T.line, fontWeight: 700 }}>{content.lastSeen}</div>}
            {content.when && <div style={{ display: "flex", fontSize: T.small, color: MUTED }}>{content.when}</div>}
            {T.marks > 0 && content.marks && <div style={{ display: "flex", fontSize: T.marks, lineHeight: 1.25 }}>{content.marks}</div>}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ display: "flex", fontSize: T.cta, fontWeight: 800, color: GOLD, lineHeight: 1 }}>{content.cta}</div>
            {content.contact && <div style={{ display: "flex", fontSize: T.contact, fontWeight: 800 }}>{content.contact}</div>}
            {urlLine({ size: T.url })}
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
          {qrBlock({ size: T.qr, label: T.qrLabel })}
        </div>
      </div>
    </div>
  );
}
