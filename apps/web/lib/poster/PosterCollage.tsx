/* eslint-disable @next/next/no-img-element -- Satori (next/og) só desenha <img>, não <Image> */
import type { CollageExtras, PosterContent } from "@mel/core";
import { COLLAGE_AREA, type ModelLayout } from "./models";
import { fitFont, fitText, V2_FORMATS, type PosterV2Format } from "./PosterV2";

// Modelo 4 — "Cartaz completo": PROCURA-SE e o NOME em destaque, faixa amarela com os dados
// do cadastro, mosaico de fotos sobre vermelho, características (texto do tutor), onde e quando,
// e o rodapé preto com o telefone — só quando o tutor autorizou publicá-lo — e o QR do alerta.
// Satori: só flexbox e estilos inline; funções simples (não componentes) para os pedaços.

type Box = { width: number; height: number };

interface Props {
  format: PosterV2Format;
  content: PosterContent;
  photos: string[];
  layout: ModelLayout;
  qr: string | null;
  url: string | null;
  dev: boolean;
  extras: CollageExtras;
  reward?: string | null;
}

const RED = "#d3141d";
const RED_DARK = "#a90f16";
const YELLOW = "#ffd21f";
const INK = "#111111";
const BLACK = "#0b0b0b";
const GREEN = "#1fae55";
const FOUND_GREEN = "#15895e";

/** Medidas por formato (px). O paisagem tem desenho próprio (texto à esquerda, mosaico à direita). */
const T = {
  impressao: {
    header: 380,
    top: 0,
    headline: 118,
    name: 190,
    paw: 96,
    strip: 94,
    stripFont: 44,
    reward: 116,
    rewardFont: 62,
    frame: 36,
    lowerPad: 36,
    gap: 24,
    boxPad: 28,
    title: 44,
    featMin: 24,
    featMax: 40,
    placeText: 34,
    footer: 262,
    safe: 0,
    label: 40,
    phone: 116,
    qr: 196,
  },
  portrait: {
    header: 230,
    top: 0,
    headline: 66,
    name: 112,
    paw: 56,
    strip: 58,
    stripFont: 27,
    reward: 66,
    rewardFont: 34,
    frame: 20,
    lowerPad: 20,
    gap: 16,
    boxPad: 18,
    title: 26,
    featMin: 16,
    featMax: 26,
    placeText: 21,
    footer: 190,
    safe: 0,
    label: 25,
    phone: 62,
    qr: 128,
  },
  story: {
    header: 390,
    top: 130,
    headline: 76,
    name: 128,
    paw: 62,
    strip: 64,
    stripFont: 29,
    reward: 70,
    rewardFont: 36,
    frame: 20,
    lowerPad: 20,
    gap: 16,
    boxPad: 18,
    title: 28,
    featMin: 17,
    featMax: 26,
    placeText: 22,
    footer: 230,
    safe: 190,
    label: 27,
    phone: 68,
    qr: 148,
  },
  square: {
    header: 176,
    top: 0,
    headline: 50,
    name: 86,
    paw: 44,
    strip: 50,
    stripFont: 23,
    reward: 56,
    rewardFont: 28,
    frame: 20,
    lowerPad: 20,
    gap: 14,
    boxPad: 16,
    title: 22,
    featMin: 15,
    featMax: 22,
    placeText: 18,
    footer: 150,
    safe: 0,
    label: 21,
    phone: 50,
    qr: 104,
  },
};
type Tokens = (typeof T)["impressao"];

const paw = (size: number, color: string) => (
  <svg width={size} height={size} viewBox="0 0 24 24">
    <g fill={color}>
      <ellipse cx="12" cy="16.2" rx="5.2" ry="4.4" />
      <circle cx="5.6" cy="10" r="2.3" />
      <circle cx="9.6" cy="6" r="2.3" />
      <circle cx="14.4" cy="6" r="2.3" />
      <circle cx="18.4" cy="10" r="2.3" />
    </g>
  </svg>
);
const pin = (size: number, color: string) => (
  <svg width={size} height={size} viewBox="0 0 24 24">
    <path fill={color} d="M12 1.5c-4.4 0-8 3.4-8 7.8 0 5.8 8 13.2 8 13.2s8-7.4 8-13.2c0-4.4-3.6-7.8-8-7.8zm0 10.8a3 3 0 1 1 0-6 3 3 0 0 1 0 6z" />
  </svg>
);
const star = (size: number, color: string) => (
  <svg width={size} height={size} viewBox="0 0 24 24">
    <path fill={color} d="M12 2l2.9 6.6 7.1.6-5.4 4.7 1.6 7-6.2-3.7-6.2 3.7 1.6-7L2 9.2l7.1-.6z" />
  </svg>
);
const heart = (size: number, color: string) => (
  <svg width={size} height={size} viewBox="0 0 24 24">
    <path fill={color} d="M12 21s-7.5-4.6-9.6-9.2C.9 8.3 3 4.5 6.7 4.5c2.1 0 3.6 1.2 5.3 3.1 1.7-1.9 3.2-3.1 5.3-3.1 3.7 0 5.8 3.8 4.3 7.3C19.5 16.4 12 21 12 21z" />
  </svg>
);
/** Telefone num círculo (verde quando é WhatsApp; sem logotipo de marca). */
const phoneIcon = (size: number, whatsapp: boolean) => (
  <div
    style={{
      display: "flex",
      width: size,
      height: size,
      borderRadius: size,
      background: whatsapp ? GREEN : "#ffffff",
      alignItems: "center",
      justifyContent: "center",
      flexShrink: 0,
    }}
  >
    <svg width={Math.round(size * 0.58)} height={Math.round(size * 0.58)} viewBox="0 0 24 24">
      <path
        fill={whatsapp ? "#ffffff" : BLACK}
        d="M6.6 10.8a15.1 15.1 0 0 0 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1A17 17 0 0 1 3 4c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1z"
      />
    </svg>
  </div>
);

const upper = (s: string) => s.toLocaleUpperCase("pt-BR");
const nameFont = (name: string, base: number) => (name.length > 14 ? Math.round(base * 0.58) : name.length > 9 ? Math.round(base * 0.74) : base);

function framed(src: string | undefined, box: Box, border: number, radius: number) {
  const inner = { width: box.width - 2 * border, height: box.height - 2 * border };
  return (
    <div style={{ display: "flex", width: box.width, height: box.height, background: "#ffffff", padding: border, borderRadius: radius, flexShrink: 0 }}>
      {src ? (
        <img src={src} alt="" width={inner.width} height={inner.height} style={{ objectFit: "cover", borderRadius: Math.max(0, radius - border) }} />
      ) : (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            width: inner.width,
            height: inner.height,
            alignItems: "center",
            justifyContent: "center",
            gap: 12,
            background: "#f3ece0",
            borderRadius: Math.max(0, radius - border),
          }}
        >
          {paw(Math.round(Math.min(inner.width, inner.height) * 0.22), "#c9b79c")}
          <div style={{ display: "flex", color: "#7a6a55", fontSize: Math.max(20, Math.round(inner.height * 0.05)), fontWeight: 700 }}>Sem foto</div>
        </div>
      )}
    </div>
  );
}

function qrBlock(qr: string | null, size: number, found: boolean) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        flexShrink: 0,
        gap: Math.round(size * 0.03),
        background: "#ffffff",
        padding: Math.round(size * 0.06),
        borderRadius: Math.round(size * 0.08),
      }}
    >
      {qr ? (
        <img src={qr} alt="QR Code do alerta" width={size} height={size} />
      ) : (
        <div
          style={{
            display: "flex",
            width: size,
            height: size,
            alignItems: "center",
            justifyContent: "center",
            textAlign: "center",
            border: `3px dashed ${INK}`,
            color: INK,
            fontSize: Math.round(size * 0.1),
            fontWeight: 800,
          }}
        >
          QR do alerta
        </div>
      )}
      <div style={{ display: "flex", color: INK, fontSize: Math.round(size * 0.11), fontWeight: 800 }}>{found ? "Abrir o alerta" : "Escaneie e avise"}</div>
    </div>
  );
}

/** Frases do tutor que cabem no quadro, na maior letra possível (a última pode terminar em "…"). */
function fitBullets(items: string[], box: Box, min: number, max: number): { font: number; items: string[] } {
  if (!items.length) return { font: max, items: [] };
  // Largura média de um caractere da Figtree ≈ 0,53 da letra; cada item ocupa linhas inteiras.
  const layout = (font: number) => {
    const perLine = Math.max(8, Math.floor(box.width / (font * 0.55)));
    const lineH = font * 1.25;
    let left = box.height;
    const out: string[] = [];
    for (const it of items) {
      const lines = Math.ceil(it.length / perLine);
      const need = lines * lineH + font * 0.35;
      if (need <= left) {
        out.push(it);
        left -= need;
        continue;
      }
      const room = Math.floor((left - font * 0.35) / lineH);
      if (room >= 1) out.push(`${it.slice(0, room * perLine - 2).trimEnd()}…`);
      return { out, all: false };
    }
    return { out, all: true };
  };
  // Maior letra em que tudo cabe; com texto longo, a maior que ainda mostra ~70% dele (o resto vira "…").
  const total = items.join("").length;
  for (let f = max; f > min; f -= 1) {
    const r = layout(f);
    if (r.all || r.out.join("").length >= total * 0.7) return { font: f, items: r.out };
  }
  return { font: min, items: layout(min).out };
}

function featuresBox(extras: CollageExtras, box: Box, t: Pick<Tokens, "boxPad" | "title" | "featMin" | "featMax">, accent: string) {
  const indent = Math.round(t.featMax * 1.3);
  const area = { width: box.width - 2 * t.boxPad - indent - 6, height: box.height - 2 * t.boxPad - Math.round(t.title * 1.3) - 8 };
  const fit = fitBullets(extras.features, area, t.featMin, t.featMax);
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: box.width,
        height: box.height,
        border: `4px solid ${accent}`,
        borderRadius: 18,
        padding: t.boxPad,
        gap: 8,
        background: "#ffffff",
        overflow: "hidden",
      }}
    >
      <div style={{ display: "flex", color: accent, fontSize: t.title, fontWeight: 800, letterSpacing: -0.5 }}>CARACTERÍSTICAS</div>
      {fit.items.map((it, i) => (
        <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: Math.round(fit.font * 0.45), marginTop: Math.round(fit.font * 0.2) }}>
          <div style={{ display: "flex", marginTop: Math.round(fit.font * 0.12), flexShrink: 0 }}>{paw(Math.round(fit.font * 0.95), accent)}</div>
          <div style={{ display: "flex", flex: 1, color: INK, fontSize: fit.font, lineHeight: 1.25 }}>{it}</div>
        </div>
      ))}
    </div>
  );
}

function placeBox(extras: CollageExtras, content: PosterContent, box: Box, t: Pick<Tokens, "boxPad" | "title" | "placeText">, accent: string) {
  const icon = Math.round(t.title * 1.7);
  const textW = box.width - 2 * t.boxPad - icon - 16;
  const title = fitFont(extras.placeTitle, { width: textW, height: t.title * 2.6 }, Math.round(t.title * 0.6), t.title, 1.15);
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 16,
        width: box.width,
        height: box.height,
        border: `4px solid ${accent}`,
        borderRadius: 18,
        padding: t.boxPad,
        background: "#ffffff",
        overflow: "hidden",
      }}
    >
      <div style={{ display: "flex", flexShrink: 0 }}>{pin(icon, accent)}</div>
      <div style={{ display: "flex", flexDirection: "column", width: textW, gap: 6 }}>
        <div style={{ display: "flex", color: accent, fontSize: title, fontWeight: 800, lineHeight: 1.15 }}>{extras.placeTitle}</div>
        {extras.placeLine && (
          <div style={{ display: "flex", color: INK, fontSize: t.placeText, fontWeight: 700, lineHeight: 1.25 }}>
            {fitText(extras.placeLine, { width: textW, height: t.placeText * 2.6 }, t.placeText, 1.25)}
          </div>
        )}
        {content.when && <div style={{ display: "flex", color: INK, fontSize: t.placeText, fontWeight: 700, lineHeight: 1.25 }}>{content.when}</div>}
      </div>
    </div>
  );
}

function stripEl(items: string[], height: number, font: number, width: number) {
  // Some itens do fim se a faixa não couber numa linha (nunca corta uma palavra no meio).
  const shown = [...items];
  while (shown.length > 1 && shown.join(" • ").length * font * 0.62 > width - 60) shown.pop();
  return (
    <div style={{ display: "flex", height, width, flexShrink: 0, alignItems: "center", justifyContent: "center", background: YELLOW, borderTop: `4px solid ${BLACK}` }}>
      {shown.map((s, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center" }}>
          {i > 0 && <div style={{ display: "flex", color: RED, fontSize: font, fontWeight: 800, margin: `0 ${Math.round(font * 0.35)}px` }}>•</div>}
          <div style={{ display: "flex", color: INK, fontSize: font, fontWeight: 800 }}>{upper(s)}</div>
        </div>
      ))}
    </div>
  );
}

function rewardEl(reward: string, height: number, font: number) {
  return (
    <div style={{ display: "flex", height, flexShrink: 0, alignItems: "center", justifyContent: "center", gap: Math.round(font * 0.5), background: BLACK }}>
      {star(Math.round(font * 0.8), "#ffffff")}
      <div style={{ display: "flex", color: YELLOW, fontSize: font, fontWeight: 800 }}>{upper(reward)}</div>
      {star(Math.round(font * 0.8), "#ffffff")}
    </div>
  );
}

/** Rodapé: "VIU A MEL?" + telefone autorizado (ou o QR como forma de avisar) + o QR do alerta. */
function footerEl(
  content: PosterContent,
  extras: CollageExtras,
  qr: string | null,
  url: string | null,
  dev: boolean,
  width: number,
  t: Pick<Tokens, "footer" | "safe" | "label" | "phone" | "qr">,
  compact = false,
) {
  const who = `${extras.article ? `${upper(extras.article)} ` : ""}${upper(content.name)}`;
  const ask = content.found
    ? "OBRIGADO A TODOS QUE AJUDARAM!"
    : extras.phone
      ? `VIU ${who}? ${extras.phone.whatsapp ? "LIGUE OU WHATSAPP:" : "LIGUE:"}`
      : `VIU ${who}? AVISE A FAMÍLIA:`;
  const label = Math.min(t.label, fitFont(ask, { width: width - t.qr - 120, height: t.label * 1.3 }, Math.round(t.label * 0.6), t.label, 1.2));
  const shown = url?.replace(/^https?:\/\//, "") ?? null;
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        flexShrink: 0,
        background: BLACK,
        height: t.footer + t.safe,
        padding: `${Math.round(t.footer * 0.09)}px ${Math.round(t.label * 1.1)}px ${t.safe}px`,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 24, height: Math.round(t.footer * 0.82) }}>
        <div style={{ display: "flex", flexDirection: "column", flex: 1, gap: Math.round(t.label * 0.3) }}>
          <div style={{ display: "flex", color: "#ffffff", fontSize: label, fontWeight: 800 }}>{ask}</div>
          {!content.found && extras.phone ? (
            <div style={{ display: "flex", alignItems: "center", gap: Math.round(t.phone * 0.25) }}>
              {phoneIcon(Math.round(t.phone * 0.9), extras.phone.whatsapp)}
              <div style={{ display: "flex", color: YELLOW, fontSize: t.phone, fontWeight: 800, letterSpacing: 1 }}>{extras.phone.number}</div>
            </div>
          ) : (
            !content.found && <div style={{ display: "flex", color: YELLOW, fontSize: Math.round(t.label * 0.9), fontWeight: 700 }}>{content.action}</div>
          )}
          <div style={{ display: "flex", alignItems: "center", gap: 12, color: "#c9c9c9", fontSize: Math.round(t.label * 0.62) }}>
            {dev && <div style={{ display: "flex", background: YELLOW, color: INK, fontWeight: 800, padding: "2px 8px", borderRadius: 6 }}>AMBIENTE DE TESTE — DEV</div>}
            <div style={{ display: "flex" }}>{shown && !dev ? shown : `Código do alerta: ${content.displayCode}`}</div>
            {!content.found && !compact && (
              <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#ffffff", fontWeight: 800 }}>
                {heart(Math.round(t.label * 0.6), RED)}
                AJUDE {who} A VOLTAR PARA CASA!
              </div>
            )}
          </div>
        </div>
        {qrBlock(qr, t.qr, content.found)}
      </div>
    </div>
  );
}

export function PosterCollage({ format, content, photos, layout, qr, url, dev, extras, reward = null }: Props) {
  const { width, height } = V2_FORMATS[format];
  const accent = content.found ? FOUND_GREEN : RED;
  const accentDark = content.found ? "#0e6b49" : RED_DARK;
  const area = COLLAGE_AREA[format];
  const [main, ...rest] = layout.boxes;
  const bottomBox = layout.bottom ? rest[rest.length - 1] : undefined;
  const extrasBoxes = layout.bottom ? rest.slice(0, -1) : rest;
  const border = format === "impressao" ? 7 : 5;
  const radius = format === "impressao" ? 18 : 12;

  // Mosaico: principal + colunas de complementares (ou o quadro ao lado de uma foto única).
  let p = 1;
  const mosaic = (t: { boxPad: number; title: number; featMin: number; featMax: number }) => (
    <div style={{ display: "flex", gap: area.gap }}>
      {framed(photos[0], main!, border, radius)}
      {layout.card &&
        (format === "landscape" ? (
          <div
            style={{
              display: "flex",
              width: layout.card.width,
              height: layout.card.height,
              alignItems: "center",
              justifyContent: "center",
              background: "#ffffff",
              borderRadius: radius,
            }}
          >
            {qrBlock(qr, Math.round(Math.min(layout.card.width, layout.card.height) * 0.6), content.found)}
          </div>
        ) : (
          featuresBox(extras, layout.card, t, accent)
        ))}
      {(layout.columns ?? []).map((count, c) => (
        <div key={c} style={{ display: "flex", flexDirection: "column", gap: area.gap }}>
          {Array.from({ length: count }, () => {
            const i = p++;
            return (
              <div key={i} style={{ display: "flex" }}>
                {framed(photos[i], extrasBoxes[i - 1]!, border, radius)}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );

  const header = (headline: number, name: number, pawSize: number, h: number, top: number) => (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        height: h,
        flexShrink: 0,
        paddingTop: top,
        backgroundImage: `linear-gradient(180deg, ${accent}, ${accentDark})`,
      }}
    >
      <div style={{ display: "flex", color: "#ffffff", fontSize: headline, fontWeight: 800, letterSpacing: -1, lineHeight: 1, textShadow: "0 4px 0 rgba(0,0,0,.25)" }}>
        {content.headline}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: Math.round(pawSize * 0.6), marginTop: Math.round(headline * 0.12) }}>
        {paw(pawSize, "#ffffff")}
        <div
          style={{
            display: "flex",
            color: YELLOW,
            fontSize: nameFont(content.name, name),
            fontWeight: 800,
            letterSpacing: -2,
            lineHeight: 1,
            textShadow: "0 5px 0 rgba(0,0,0,.3)",
          }}
        >
          {upper(content.name)}
        </div>
        {paw(pawSize, "#ffffff")}
      </div>
    </div>
  );

  if (format === "landscape") {
    // Paisagem: à esquerda o texto (PROCURA-SE, nome, faixa, onde e contato); à direita o mosaico.
    const L = 1200 - area.width - 40;
    const t = { boxPad: 14, title: 20, featMin: 14, featMax: 20, placeText: 17 };
    return (
      <div style={{ display: "flex", width, height, background: "#ffffff", fontFamily: "Figtree" }}>
        <div style={{ display: "flex", flexDirection: "column", width: L, height }}>
          {header(40, 76, 36, 172, 0)}
          {stripEl(extras.strip.slice(0, 3), 44, 18, L)}
          {reward && rewardEl(reward, 44, 22)}
          <div style={{ display: "flex", flex: 1, padding: 14 }}>{placeBox(extras, content, { width: L - 28, height: reward ? 166 : 210 }, t, accent)}</div>
          {footerEl(content, extras, qr, url, dev, L, { footer: 150, safe: 0, label: 18, phone: 40, qr: 96 }, true)}
        </div>
        <div style={{ display: "flex", width: area.width + 40, height, alignItems: "center", justifyContent: "center", background: accent }}>{mosaic(t)}</div>
      </div>
    );
  }

  const t = T[format];
  const lowerW = width - 2 * t.lowerPad;
  // Quadros de baixo: no A4 empilhados (com a 6ª foto ao lado, se houver); nos outros, lado a lado.
  const lowerH = height - t.header - t.strip - (reward ? t.reward : 0) - (main!.height + 2 * t.frame) - t.footer - t.safe - 2 * t.lowerPad;
  const features = layout.card ? null : extras.features.length ? extras.features : null;
  let lower;
  if (format === "impressao") {
    const colW = bottomBox ? lowerW - bottomBox.width - t.gap : lowerW;
    const featH = features ? Math.round((lowerH - t.gap) * 0.6) : 0;
    lower = (
      <div style={{ display: "flex", gap: t.gap }}>
        <div style={{ display: "flex", flexDirection: "column", gap: t.gap, width: colW }}>
          {features && featuresBox({ ...extras, features }, { width: colW, height: featH }, t, accent)}
          {placeBox(extras, content, { width: colW, height: features ? lowerH - featH - t.gap : lowerH }, t, accent)}
        </div>
        {bottomBox && framed(photos[photos.length - 1], { width: bottomBox.width, height: Math.min(bottomBox.height, lowerH) }, border, radius)}
      </div>
    );
  } else {
    const featW = features ? Math.round((lowerW - t.gap) * 0.56) : 0;
    lower = (
      <div style={{ display: "flex", gap: t.gap }}>
        {features && featuresBox({ ...extras, features }, { width: featW, height: lowerH }, t, accent)}
        {placeBox(extras, content, { width: features ? lowerW - featW - t.gap : lowerW, height: lowerH }, t, accent)}
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", width, height, background: "#ffffff", fontFamily: "Figtree" }}>
      {header(t.headline, t.name, t.paw, t.header, t.top)}
      {stripEl(extras.strip, t.strip, t.stripFont, width)}
      {reward && rewardEl(reward, t.reward, t.rewardFont)}
      <div style={{ display: "flex", flexShrink: 0, justifyContent: "center", padding: t.frame, background: accent, borderBottom: `4px solid ${BLACK}` }}>{mosaic(t)}</div>
      <div style={{ display: "flex", flex: 1, padding: t.lowerPad }}>{lower}</div>
      {footerEl(content, extras, qr, url, dev, width, t)}
    </div>
  );
}
