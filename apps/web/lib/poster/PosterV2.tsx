/* eslint-disable @next/next/no-img-element -- Satori (next/og) só desenha <img>, não <Image> */
import type { PosterContent } from "@mel/core";

// PROPOSTA de cartaz (aguarda aprovação do proprietário; os modelos atuais continuam
// valendo). Hierarquia: 1) PROCURA-SE (faixa no topo, nunca sobre a foto) 2) a foto
// grande 3) o nome 4) região e data 5) como avisar (QR). Satori: só flexbox e estilos inline.

export type PosterV2Format = "impressao" | "square" | "portrait" | "story" | "landscape";

export const V2_FORMATS: Record<PosterV2Format, { width: number; height: number; label: string; hint: string }> = {
  // A4 (210×297 mm) em 200 dpi. Chave "impressao": /cartaz/a4 já é a página de impressão atual.
  impressao: { width: 1654, height: 2339, label: "A4 para imprimir", hint: "Folha A4 em 200 dpi, fundo branco (economiza tinta)" },
  square: { width: 1080, height: 1080, label: "Quadrado", hint: "Feed e WhatsApp (1:1)" },
  portrait: { width: 1080, height: 1350, label: "Feed 4:5", hint: "Feed do Instagram (4:5)" },
  story: { width: 1080, height: 1920, label: "Stories / Status", hint: "Stories, Status e TikTok (9:16)" },
  landscape: { width: 1200, height: 630, label: "Horizontal", hint: "Prévias e compartilhamento horizontal (1200×630)" },
};

export const isV2Format = (v: string): v is PosterV2Format => v in V2_FORMATS;

type Box = { width: number; height: number };
/** Onde entram as fotos: a principal e, se houver, até duas complementares. */
export interface PhotoLayout {
  main: Box;
  extras: Box[];
  /** Complementares (sempre ao lado da principal) empilhadas (coluna) ou lado a lado (linha). */
  extrasDirection: "column" | "row";
  /** Complementares embaixo da principal (horizontal com principal larga). */
  below?: boolean;
}

export const NAVY = "#0a111d";
export const PANEL = "#111c2e";
export const GOLD = "#f6b928";
export const TEXT = "#f5f2ea";
export const MUTED = "#b3bdcc";

/** Faixa do status no topo (px). */
const BAND: Record<PosterV2Format, number> = { impressao: 230, square: 92, portrait: 104, story: 300, landscape: 0 };

/** Área de fotos de cada formato (abaixo da faixa do status). */
const AREA: Record<PosterV2Format, { width: number; height: number; gap: number }> = {
  square: { width: 1080, height: 610, gap: 0 },
  portrait: { width: 1080, height: 800, gap: 0 },
  // Stories: 1920 − faixa 300 − painel ~670 − área segura de baixo 220 (conferido: nada cortado).
  story: { width: 1080, height: 760, gap: 0 },
  landscape: { width: 700, height: 630, gap: 0 },
  impressao: { width: 1654 - 2 * 90, height: 1000, gap: 24 },
};

/** Altura que a área de fotos cede ao selo da bonificação (os demais formatos têm folga). */
const REWARD_ROOM: Record<PosterV2Format, number> = { impressao: 0, square: 44, portrait: 52, story: 48, landscape: 0 };

/**
 * Distribuição das fotos por formato, quantidade (1, 2 ou 3) e orientação da principal.
 * Principal VERTICAL com complementares: coluna alta à esquerda e as outras numa coluna
 * ao lado (sem faixas desfocadas). Principal horizontal: larga, com as outras ao lado
 * (quadrado/4:5) ou embaixo (Stories, A4, horizontal). A principal nunca fica pequena.
 */
export function photoLayout(format: PosterV2Format, aspects: number[], { reward = false }: { reward?: boolean } = {}): PhotoLayout {
  // Horizontal (1200×630): só a foto principal — miniaturas não acrescentam nada nesse tamanho.
  const extras = format === "landscape" ? 0 : Math.min(2, Math.max(0, aspects.length - 1));
  const { width: W, gap } = AREA[format];
  // Selo da bonificação (protótipo): no quadrado e no 4:5 o painel não tem folga, a foto cede a linha.
  const H = AREA[format].height - (reward ? REWARD_ROOM[format] : 0);
  const mainAspect = aspects[0] ?? null;
  const vertical = mainAspect !== null && mainAspect < 0.9;
  const split = (total: number, n: number) => Array.from({ length: n }, () => Math.floor((total - gap * (n - 1)) / n));
  if (!extras) {
    // Foto única vertical: a área encolhe para a proporção da foto (mín. 0,66), centralizada
    // sobre o fundo do cartaz — sem laterais desfocadas. No horizontal o texto ganha o espaço.
    const mw = vertical ? Math.min(W, Math.round(H * Math.max(mainAspect, 0.66))) : W;
    return { main: { width: mw, height: H }, extras: [], extrasDirection: "column" };
  }
  // Coluna da principal: vertical → perto da proporção da foto (mín. 0,66, máx. 72% da largura);
  // horizontal → 740 px (quadrado, 4:5, Stories) ou 64% (A4).
  // No A4 a área é muito larga: a principal vertical ganha um pouco de largura (corte leve,
  // ~25%) para as complementares não ficarem em faixas largas demais para fotos verticais.
  const mw = vertical
    ? Math.min(Math.round(W * 0.72), Math.round(H * (format === "impressao" ? mainAspect / 0.7 : Math.max(mainAspect, 0.66))))
    : format === "impressao"
      ? Math.round(W * 0.64)
      : 740;
  const ew = W - mw - gap;
  // Complementares empilhadas (coluna) ou lado a lado (linha): a que corta menos as fotos.
  const keptIn = (boxes: Box[]) =>
    Math.min(...boxes.map((b, i) => {
      const a = aspects[i + 1] ?? b.width / b.height;
      const r = b.width / b.height;
      return Math.min(a / r, r / a);
    }));
  // Cada complementar ganha espaço proporcional ao seu formato (uma vertical e uma horizontal
  // empilhadas: a vertical fica mais alta), sem nenhuma passar de 70% do espaço.
  const share = (total: number, weights: number[]) => {
    const free = total - gap * (weights.length - 1);
    const sum = weights.reduce((s, x) => s + x, 0);
    const parts = weights.map((x) => Math.min(0.7, Math.max(0.3, x / sum)));
    return parts.map((p, i) => (i === parts.length - 1 ? free - parts.slice(0, -1).reduce((s, q) => s + Math.floor(q * free), 0) : Math.floor(p * free)));
  };
  const extraAspects = Array.from({ length: extras }, (_, i) => aspects[i + 1] ?? 1);
  const column = (extras > 1 ? share(H, extraAspects.map((a) => 1 / a)) : split(H, extras)).map((eh) => ({ width: ew, height: eh }));
  const row = share(ew, extraAspects).map((w) => ({ width: w, height: H }));
  const useRow = extras > 1 && keptIn(row) > keptIn(column) + 0.05;
  return { main: { width: mw, height: H }, extras: useRow ? row : column, extrasDirection: useRow ? "row" : "column" };
}

interface Props {
  format: PosterV2Format;
  content: PosterContent;
  /** Fotos já encaixadas nos tamanhos do layout (principal primeiro): ver composePhotos. */
  photos: string[];
  layout: PhotoLayout;
  /** QR do alerta; null = ainda não há alerta publicado (mostra o espaço reservado). */
  qr: string | null;
  /** Endereço do alerta; null = ainda não existe. */
  url: string | null;
  /** Prévia fora do domínio oficial: o link é marcado como AMBIENTE DE TESTE — DEV. */
  dev: boolean;
  /** PROTÓTIPO: "BONIFICAÇÃO OFERECIDA: R$ …" (rewardLine); null/ausente = nenhum bloco. */
  reward?: string | null;
  /** Foto única vertical: o espaço ao lado vira o quadro "Como reconhecer" (sem sobras). */
  card?: Box;
  /** O quadro vai embaixo da complementar (uma complementar horizontal numa coluna alta). */
  cardBelowExtras?: boolean;
}

/** Corta o texto para caber num quadro (estimativa pela área; Satori não mede texto). */
export function fitText(text: string, box: Box, fontSize: number, lineHeight = 1.3): string {
  const perLine = Math.max(8, Math.floor(box.width / (fontSize * 0.6)) - 2);
  const lines = Math.max(1, Math.floor(box.height / (fontSize * lineHeight)));
  const max = perLine * lines;
  return text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`;
}

/** Maior fonte (entre min e max) em que o texto inteiro cabe no quadro (mesma estimativa do fitText). */
export function fitFont(text: string, box: Box, min: number, max: number, lineHeight = 1.3): number {
  for (let f = max; f > min; f -= 2) {
    const perLine = Math.floor(box.width / (f * 0.6)) - 2;
    const lines = Math.floor(box.height / (f * lineHeight));
    if (perLine * lines >= text.length * 1.15) return f;
  }
  return min;
}

/** Quadro "Como reconhecer": descrição do tutor (ou raça e porte) com a letra do maior tamanho que couber. */
export function recognizeText(content: PosterContent): { lead: string; detail: string | null } {
  return content.marks ? { lead: content.marks, detail: content.details } : { lead: content.details, detail: null };
}

export function PosterV2({ format, content, photos, layout, qr, url, dev, reward = null, card, cardBelowExtras = false }: Props) {
  const { width, height } = V2_FORMATS[format];
  const accent = content.found ? "#15895e" : "#e5484d";
  const nameSize = (base: number) => (content.name.length > 16 ? Math.round(base * 0.68) : content.name.length > 11 ? Math.round(base * 0.82) : base);
  const shown = url?.replace(/^https?:\/\//, "") ?? null;
  const urlPrefix = shown ? shown.slice(0, shown.length - content.code.length) : "";

  const photo = (src: string | undefined, box: Box, key: number, radius = 0) =>
    src ? (
      <img key={key} src={src} alt="" width={box.width} height={box.height} style={{ objectFit: "cover", borderRadius: radius }} />
    ) : (
      <div key={key} style={{ display: "flex", width: box.width, height: box.height, alignItems: "center", justifyContent: "center", background: "#1d2b44", fontSize: Math.round(box.height * 0.3), borderRadius: radius }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: Math.round(box.height * 0.03) }}>
          <div style={{ display: "flex" }}>🐾</div>
          {/* Sem foto: dizer, para não parecer uma imagem quebrada. */}
          <div style={{ display: "flex", color: MUTED, fontSize: Math.max(22, Math.round(box.height * 0.06)), fontWeight: 700 }}>Sem foto</div>
        </div>
      </div>
    );

  const gallery = (gap = 0, radius = 0) => (
    <div style={{ display: "flex", flexShrink: 0, flexDirection: layout.below ? "column" : "row", justifyContent: card ? "flex-start" : "center", gap }}>
      {photo(photos[0], layout.main, 0, radius)}
      {layout.extras.length > 0 && (
        <div style={{ display: "flex", flexDirection: layout.extrasDirection, gap }}>
          {layout.extras.map((b, i) => photo(photos[i + 1], b, i + 1, radius))}
          {card && cardBelowExtras && recognizeCard(card, radius)}
        </div>
      )}
      {card && !cardBelowExtras && recognizeCard(card, radius)}
    </div>
  );

  /** Quadro "Como reconhecer" ao lado de uma foto única vertical. */
  function recognizeCard(box: Box, radius: number) {
    const light = format === "impressao";
    const base = format === "impressao" ? 42 : format === "landscape" ? 20 : format === "square" ? 28 : 32;
    const pad = Math.round(base * 1.1);
    const { lead, detail } = recognizeText(content);
    const inner = { width: box.width - 2 * pad, height: box.height - 2 * pad - Math.round(base * 4.2) };
    const size = fitFont(lead, inner, base, base * 2);
    return (
      <div style={{ display: "flex", flexDirection: "column", width: box.width, height: box.height, padding: pad, gap: Math.round(base * 0.6), background: light ? "#f3f1ec" : "#1d2b44", borderRadius: radius, overflow: "hidden" }}>
        <div style={{ display: "flex", fontSize: Math.round(base * 0.9), fontWeight: 800, color: light ? "#9a6a10" : GOLD, letterSpacing: 1 }}>COMO RECONHECER</div>
        <div style={{ display: "flex", flexShrink: 1, minHeight: 0, overflow: "hidden", fontSize: size, fontWeight: 700, lineHeight: 1.3, color: light ? NAVY : TEXT }}>{fitText(lead, inner, size)}</div>
        {detail && <div style={{ display: "flex", flexShrink: 0, fontSize: base, color: light ? "#475467" : MUTED }}>{detail}</div>}
      </div>
    );
  }

  /** Bonificação do tutor (protótipo): selo dourado; sem valor, nada é desenhado. */
  const rewardBadge = (size: number) =>
    reward ? (
      <div style={{ display: "flex", flexShrink: 0, alignSelf: "flex-start", background: GOLD, color: NAVY, fontSize: size, fontWeight: 800, padding: `${Math.round(size * 0.2)}px ${Math.round(size * 0.5)}px`, borderRadius: Math.round(size * 0.3) }}>
        {reward}
      </div>
    ) : null;

  const band = (size: number, h: number) => (
    <div style={{ display: "flex", flexShrink: 0, height: h, alignItems: "center", justifyContent: "center", background: accent, color: "#fff", fontSize: size, fontWeight: 800, letterSpacing: Math.round(size * 0.08) }}>
      {content.headline}
    </div>
  );

  /** QR do alerta, ou o espaço reservado honesto quando o alerta ainda não existe. */
  const qrBlock = (size: number, label: number, light = false) => (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: Math.round(size * 0.04), background: "#fff", padding: Math.round(size * 0.06), borderRadius: Math.round(size * 0.08), border: light ? `3px solid ${NAVY}` : "none" }}>
      {qr ? (
        <img src={qr} alt="QR Code do alerta" width={size} height={size} />
      ) : (
        <div style={{ display: "flex", width: size, height: size, alignItems: "center", justifyContent: "center", textAlign: "center", border: `4px dashed ${NAVY}`, color: NAVY, fontSize: Math.round(size * 0.1), fontWeight: 800, padding: Math.round(size * 0.08), lineHeight: 1.15 }}>
          QR do alerta: gerado ao publicar
        </div>
      )}
      <div style={{ display: "flex", color: NAVY, fontSize: label, fontWeight: 800 }}>{content.found ? "Abrir o alerta" : "Escaneie e avise"}</div>
    </div>
  );

  /** Endereço do alerta; em DEV, marcado como ambiente de teste (não é endereço público). */
  const urlLine = (size: number, color = MUTED, strong = TEXT) => (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {dev && (
        <div style={{ display: "flex", alignSelf: "flex-start", background: GOLD, color: NAVY, fontSize: Math.round(size * 0.85), fontWeight: 800, padding: `2px ${Math.round(size * 0.4)}px`, borderRadius: 6 }}>
          AMBIENTE DE TESTE — DEV
        </div>
      )}
      {dev && shown ? (
        // Em DEV o endereço técnico (sslip.io) não vai para o cartaz: só o código do alerta.
        <div style={{ display: "flex", alignItems: "baseline", flexWrap: "wrap", color }}>
          <span style={{ fontSize: size }}>Código do alerta:&nbsp;</span>
          <span style={{ fontSize: Math.round(size * 1.3), fontWeight: 800, color: strong, letterSpacing: 2 }}>{content.displayCode}</span>
        </div>
      ) : shown ? (
        <div style={{ display: "flex", alignItems: "baseline", flexWrap: "wrap", color }}>
          <span style={{ fontSize: size }}>{urlPrefix}</span>
          <span style={{ fontSize: Math.round(size * 1.3), fontWeight: 800, color: strong, letterSpacing: 2 }}>{content.displayCode}</span>
        </div>
      ) : (
        <div style={{ display: "flex", color, fontSize: size }}>Link do alerta: gerado ao publicar</div>
      )}
    </div>
  );

  // ---------------- A4 (impressão, fundo branco) ----------------
  if (format === "impressao") {
    return (
      <div style={{ width, height, display: "flex", flexDirection: "column", background: "#ffffff", fontFamily: "Figtree", color: NAVY }}>
        {band(168, BAND.impressao)}
        <div style={{ display: "flex", flexShrink: 0, justifyContent: "center", padding: "56px 90px 0" }}>{gallery(24, 28)}</div>
        <div style={{ display: "flex", flexDirection: "column", padding: "36px 90px 0", gap: 14, flex: 1 }}>
          <div style={{ display: "flex", flexShrink: 0, fontSize: nameSize(136), fontWeight: 800, lineHeight: 1.05 }}>{content.name}</div>
          <div style={{ display: "flex", flexShrink: 0, fontSize: 52, fontWeight: 700, color: "#475467" }}>{content.details}</div>
          {content.lastSeen && <div style={{ display: "flex", flexShrink: 0, fontSize: 48, fontWeight: 700 }}>{content.lastSeen}</div>}
          {content.when && <div style={{ display: "flex", flexShrink: 0, fontSize: 42, color: "#475467" }}>{content.when}</div>}
          {rewardBadge(46)}
          {content.marks && !reward && (
            <div style={{ display: "flex", flexShrink: 0, fontSize: 36, lineHeight: 1.25 }}>{content.marks.length > 118 ? `${content.marks.slice(0, 117).trimEnd()}…` : content.marks}</div>
          )}
        </div>
        <div style={{ display: "flex", flexShrink: 0, alignItems: "center", gap: 48, padding: "0 90px 60px" }}>
          {qrBlock(340, 32, true)}
          <div style={{ display: "flex", flexDirection: "column", gap: 14, flex: 1 }}>
            <div style={{ display: "flex", fontSize: 86, fontWeight: 800, color: accent, lineHeight: 1 }}>{content.cta}</div>
            {content.action && <div style={{ display: "flex", fontSize: 42, fontWeight: 700, lineHeight: 1.2 }}>{content.action}</div>}
            {content.contact && <div style={{ display: "flex", fontSize: 54, fontWeight: 800 }}>{content.contact}</div>}
            {urlLine(36, "#475467", NAVY)}
            <div style={{ display: "flex", fontSize: 36, fontWeight: 800, color: "#9a6a10" }}>MEL · Uma rede inteira procurando com você.</div>
          </div>
        </div>
      </div>
    );
  }

  // ---------------- Horizontal (1200×630) ----------------
  if (format === "landscape") {
    return (
      <div style={{ width, height, display: "flex", background: NAVY, fontFamily: "Figtree", color: TEXT }}>
        {gallery(0)}
        <div style={{ display: "flex", flexDirection: "column", flex: 1, padding: "30px 32px", justifyContent: "space-between", borderLeft: `8px solid ${accent}` }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ display: "flex", alignSelf: "flex-start", background: accent, color: "#fff", fontSize: 30, fontWeight: 800, letterSpacing: 2, padding: "4px 16px", borderRadius: 8 }}>{content.headline}</div>
            <div style={{ display: "flex", fontSize: nameSize(84), fontWeight: 800, lineHeight: 1 }}>{content.name}</div>
            <div style={{ display: "flex", fontSize: 22, fontWeight: 700, color: MUTED }}>{content.details}</div>
            {content.lastSeen && <div style={{ display: "flex", fontSize: 24, fontWeight: 700, lineHeight: 1.2 }}>{content.lastSeen.replace(/^Visto por último: /, "")}</div>}
            {content.when && <div style={{ display: "flex", fontSize: 22, color: MUTED }}>{content.when}</div>}
            {rewardBadge(22)}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
            {qrBlock(150, 16)}
            <div style={{ display: "flex", flexDirection: "column", gap: 6, flex: 1 }}>
              <div style={{ display: "flex", fontSize: 38, fontWeight: 800, color: GOLD, lineHeight: 1 }}>{content.cta}</div>
              {content.contact && <div style={{ display: "flex", fontSize: 20, fontWeight: 800 }}>{content.contact}</div>}
              {urlLine(17)}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ---------------- Stories (9:16) ----------------
  // Áreas seguras dos apps: o topo (~250 px: barra de progresso e perfil) e a base
  // (~220 px: campo de resposta) ficam sem nada essencial. O PROCURA-SE fica logo abaixo
  // da área do topo; a base só leva a assinatura da MEL (pode ser coberta sem perda).
  if (format === "story") {
    return (
      <div style={{ width, height, display: "flex", flexDirection: "column", background: NAVY, fontFamily: "Figtree", color: TEXT }}>
        <div style={{ display: "flex", flexShrink: 0, height: 300, alignItems: "flex-end", justifyContent: "center", paddingBottom: 26, background: accent, color: "#fff", fontSize: 96, fontWeight: 800, letterSpacing: 8 }}>
          {content.headline}
        </div>
        {gallery(0)}
        <div style={{ display: "flex", flexDirection: "column", flex: 1, padding: "30px 52px 0", gap: 18, borderTop: `8px solid ${accent}`, background: PANEL }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", fontSize: nameSize(108), fontWeight: 800, lineHeight: 1 }}>{content.name}</div>
            <div style={{ display: "flex", fontSize: 36, fontWeight: 700, color: MUTED }}>{content.details}</div>
            {content.lastSeen && <div style={{ display: "flex", fontSize: 36, fontWeight: 700, lineHeight: 1.2 }}>{content.lastSeen}</div>}
            {content.when && <div style={{ display: "flex", fontSize: 32, color: MUTED }}>{content.when}</div>}
            {rewardBadge(32)}
          </div>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 32 }}>
            <div style={{ display: "flex", flexDirection: "column", flex: 1, gap: 10 }}>
              <div style={{ display: "flex", fontSize: 60, fontWeight: 800, color: GOLD, lineHeight: 1 }}>{content.cta}</div>
              {content.action && <div style={{ display: "flex", fontSize: 28, fontWeight: 700, lineHeight: 1.2 }}>{content.action}</div>}
              {content.contact && <div style={{ display: "flex", fontSize: 34, fontWeight: 800 }}>{content.contact}</div>}
              {urlLine(24)}
            </div>
            {qrBlock(200, 24)}
          </div>
        </div>
        <div style={{ display: "flex", flexShrink: 0, height: 220, alignItems: "center", justifyContent: "center", background: PANEL, color: "#8f9bb0", fontSize: 30, fontWeight: 700 }}>
          MEL · Uma rede inteira procurando com você.
        </div>
      </div>
    );
  }

  // ---------------- Quadrado e Feed 4:5 ----------------
  const T =
    format === "portrait"
      ? { band: 72, name: 92, details: 32, line: 32, small: 28, qr: 220, qrLabel: 22, cta: 50, contact: 28, url: 21, pad: "30px 40px 32px" }
      : { band: 64, name: 80, details: 28, line: 28, small: 24, qr: 190, qrLabel: 20, cta: 44, contact: 26, url: 19, pad: "24px 36px 26px" };
  return (
    <div style={{ width, height, display: "flex", flexDirection: "column", background: NAVY, fontFamily: "Figtree", color: TEXT }}>
      {band(T.band, BAND[format])}
      {gallery(0)}
      <div style={{ display: "flex", flex: 1, padding: T.pad, gap: 28, borderTop: `8px solid ${accent}`, background: PANEL }}>
        <div style={{ display: "flex", flexDirection: "column", flex: 1, gap: 6, justifyContent: "space-between" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ display: "flex", fontSize: nameSize(T.name), fontWeight: 800, lineHeight: 1 }}>{content.name}</div>
            <div style={{ display: "flex", fontSize: T.details, fontWeight: 700, color: MUTED }}>{content.details}</div>
            {content.lastSeen && <div style={{ display: "flex", fontSize: T.line, fontWeight: 700 }}>{content.lastSeen}</div>}
            {content.when && <div style={{ display: "flex", fontSize: T.small, color: MUTED }}>{content.when}</div>}
            {rewardBadge(T.small)}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <div style={{ display: "flex", fontSize: T.cta, fontWeight: 800, color: GOLD, lineHeight: 1 }}>{content.cta}</div>
            {content.contact && <div style={{ display: "flex", fontSize: T.contact, fontWeight: 800 }}>{content.contact}</div>}
            {urlLine(T.url)}
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>{qrBlock(T.qr, T.qrLabel)}</div>
      </div>
    </div>
  );
}
