/* eslint-disable @next/next/no-img-element -- Satori (next/og) só desenha <img>, não <Image> */
import type { PosterContent } from "@mel/core";
import { CLASSIC_ROW, HERO_SIDE_GAP, type ModelLayout } from "./models";
import { fitFont, fitText, GOLD, MUTED, NAVY, PANEL, recognizeText, TEXT, V2_FORMATS, type PosterV2Format } from "./PosterV2";

// Modelos 1 (foto em destaque) e 3 (clássico de poste) — o modelo 2 é o PosterV2.
// Mesma hierarquia em todos: PROCURA-SE, a foto, o nome, região e data, como avisar (QR).
// Satori: só flexbox e estilos inline; funções simples (não componentes) para os pedaços.

type Box = { width: number; height: number };

interface Props {
  format: PosterV2Format;
  content: PosterContent;
  /** Fotos já recortadas nas caixas do layout (principal primeiro). */
  photos: string[];
  layout: ModelLayout;
  qr: string | null;
  url: string | null;
  dev: boolean;
  reward?: string | null;
}

const PAPER = "#fbfaf7";
const CARD = "#efe9de";
const INK_MUTED = "#475467";

function photoEl(src: string | undefined, box: Box, radius = 0, dark = true) {
  return src ? (
    <img src={src} alt="" width={box.width} height={box.height} style={{ objectFit: "cover", borderRadius: radius }} />
  ) : (
    <div style={{ display: "flex", width: box.width, height: box.height, alignItems: "center", justifyContent: "center", background: dark ? "#1d2b44" : CARD, borderRadius: radius }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
        <div style={{ display: "flex", fontSize: Math.round(Math.min(box.width, box.height) * 0.25) }}>🐾</div>
        <div style={{ display: "flex", color: dark ? MUTED : INK_MUTED, fontSize: Math.max(22, Math.round(box.height * 0.05)), fontWeight: 700 }}>Sem foto</div>
      </div>
    </div>
  );
}

function qrCard(qr: string | null, size: number, label: number, found: boolean, border = false) {
  return (
    <div style={{ display: "flex", flexShrink: 0, flexDirection: "column", alignItems: "center", gap: Math.round(size * 0.04), background: "#fff", padding: Math.round(size * 0.06), borderRadius: Math.round(size * 0.08), border: border ? `3px solid ${NAVY}` : "none" }}>
      {qr ? (
        <img src={qr} alt="QR Code do alerta" width={size} height={size} />
      ) : (
        <div style={{ display: "flex", width: size, height: size, alignItems: "center", justifyContent: "center", textAlign: "center", border: `4px dashed ${NAVY}`, color: NAVY, fontSize: Math.round(size * 0.1), fontWeight: 800, padding: Math.round(size * 0.08) }}>
          QR do alerta: gerado ao publicar
        </div>
      )}
      <div style={{ display: "flex", color: NAVY, fontSize: label, fontWeight: 800 }}>{found ? "Abrir o alerta" : "Escaneie e avise"}</div>
    </div>
  );
}

/** Código/endereço do alerta; em DEV marcado como ambiente de teste (sem o endereço técnico). */
function codeLine(content: PosterContent, url: string | null, dev: boolean, size: number, color: string, strong: string, badge = true) {
  const shown = url?.replace(/^https?:\/\//, "") ?? null;
  const prefix = shown ? shown.slice(0, shown.length - content.code.length) : "";
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {dev && badge && (
        <div style={{ display: "flex", alignSelf: "flex-start", background: GOLD, color: NAVY, fontSize: Math.round(size * 0.85), fontWeight: 800, padding: `2px ${Math.round(size * 0.4)}px`, borderRadius: 6 }}>AMBIENTE DE TESTE — DEV</div>
      )}
      {shown ? (
        <div style={{ display: "flex", alignItems: "baseline", flexWrap: "wrap", color }}>
          <span style={{ fontSize: size }}>{dev ? "Código do alerta: " : prefix}</span>
          <span style={{ fontSize: Math.round(size * 1.3), fontWeight: 800, color: strong, letterSpacing: 2 }}>{content.displayCode}</span>
        </div>
      ) : (
        <div style={{ display: "flex", color, fontSize: size }}>Link do alerta: gerado ao publicar</div>
      )}
    </div>
  );
}

function rewardBadge(reward: string | null | undefined, size: number) {
  return reward ? (
    <div style={{ display: "flex", flexShrink: 0, alignSelf: "flex-start", background: GOLD, color: NAVY, fontSize: size, fontWeight: 800, padding: `${Math.round(size * 0.2)}px ${Math.round(size * 0.5)}px`, borderRadius: Math.round(size * 0.3) }}>
      {reward}
    </div>
  ) : null;
}

const nameSize = (name: string, base: number) => (name.length > 16 ? Math.round(base * 0.68) : name.length > 11 ? Math.round(base * 0.82) : base);
const one = (text: string, max: number) => (text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`);

// ===================================================================================
// Modelo 1 — Foto em destaque
// ===================================================================================

export function PosterHero({ format, content, photos, layout, qr, url, dev, reward }: Props) {
  const { width, height } = V2_FORMATS[format];
  const accent = content.found ? "#15895e" : "#e5484d";
  const box = layout.boxes[0]!;
  const lastSeen = content.lastSeen;

  /** Foto com o nome por cima (degradê escuro na base da foto). */
  const heroPhoto = (nameBase: number, detailsSize: number, pad: number, radius = 0) => (
    <div style={{ display: "flex", position: "relative", width: box.width, height: box.height, flexShrink: 0 }}>
      {photoEl(photos[0], box, radius)}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          display: "flex",
          flexDirection: "column",
          padding: `${pad * 3}px ${pad}px ${pad}px`,
          backgroundImage: "linear-gradient(to bottom, rgba(10,17,29,0), rgba(10,17,29,0.92))",
          borderRadius: radius,
        }}
      >
        <div style={{ display: "flex", fontSize: nameSize(content.name, nameBase), fontWeight: 800, color: "#fff", lineHeight: 1 }}>{content.name}</div>
        <div style={{ display: "flex", fontSize: detailsSize, fontWeight: 700, color: "#e7eaf0", marginTop: 8 }}>{content.details}</div>
      </div>
    </div>
  );

  const band = (size: number, h: number, alignBottom = false) => (
    <div style={{ display: "flex", flexShrink: 0, height: h, alignItems: alignBottom ? "flex-end" : "center", justifyContent: "center", paddingBottom: alignBottom ? 26 : 0, background: accent, color: "#fff", fontSize: size, fontWeight: 800, letterSpacing: Math.round(size * 0.08) }}>
      {content.headline}
    </div>
  );

  // ---------- A4: fundo branco, foto grande, nome grande embaixo ----------
  const second = layout.boxes[1] && photos[1] ? layout.boxes[1] : null;
  /** Descrição na coluna ao lado da foto: o espaço que sobra entre os dados e a 2ª foto (ou o pé da coluna). */
  // Com 2ª foto, os dados ficam um pouco menores para sobrar espaço para a descrição.
  const SIDE = second ? { det: 40, seen: 38, when: 34 } : { det: 46, seen: 44, when: 40 };
  const sideMarks = (marks: string) => {
    const colW = 1474 - box.width - HERO_SIDE_GAP;
    // Figtree: ~0,5 da letra por caractere (média de texto corrido).
    const perLine = (size: number) => Math.max(8, Math.floor(colW / (size * 0.5)));
    const lines = (text: string | null, size: number) => (text ? Math.ceil(text.length / perLine(size)) : 0);
    const items = [content.details, lastSeen, content.when].filter(Boolean).length + (reward ? 1 : 0) + (second ? 2 : 1);
    const used =
      nameSize(content.name, 132) +
      lines(content.details, SIDE.det) * SIDE.det * 1.2 +
      lines(lastSeen, SIDE.seen) * SIDE.seen * 1.25 +
      lines(content.when, SIDE.when) * SIDE.when * 1.25 +
      (reward ? 64 : 0) +
      18 * items +
      12 + 20 + 3;
    const room = box.height - used - (second ? second.height : 0) - 8;
    // Maior letra (26–38) em que a descrição inteira cabe; se não couber, a 26 e corta numa palavra com "…".
    for (let size = 38; size >= 26; size -= 2) {
      const max = perLine(size) * Math.floor(room / (size * 1.3));
      if (marks.length <= max || size === 26) {
        if (max < perLine(size) * 2) return null;
        const text = marks.length <= max ? marks : `${marks.slice(0, max - 1).replace(/\s+\S*$/, "")}…`;
        return <div style={{ display: "flex", fontSize: size, lineHeight: 1.3, marginTop: 12, paddingTop: 20, borderTop: "3px solid #e4e0d8" }}>{text}</div>;
      }
    }
    return null;
  };
  if (format === "impressao") {
    return (
      <div style={{ width, height, display: "flex", flexDirection: "column", background: "#fff", fontFamily: "Figtree", color: NAVY }}>
        {band(168, 230)}
        {layout.arrangement === "side" ? (
          // Foto vertical: alta à esquerda; ao lado, nome, dados, a descrição inteira do tutor
          // (letra ajustada ao espaço) e, se houver, uma 2ª foto no pé da coluna.
          <div style={{ display: "flex", flex: 1, padding: "56px 90px 0", gap: HERO_SIDE_GAP }}>
            {photoEl(photos[0], box, 28)}
            <div style={{ display: "flex", flexDirection: "column", width: 1474 - box.width - HERO_SIDE_GAP, height: box.height, gap: 18 }}>
              <div style={{ display: "flex", fontSize: nameSize(content.name, 132), fontWeight: 800, lineHeight: 1 }}>{content.name}</div>
              <div style={{ display: "flex", fontSize: SIDE.det, fontWeight: 700, color: INK_MUTED, lineHeight: 1.2 }}>{content.details}</div>
              {lastSeen && <div style={{ display: "flex", fontSize: SIDE.seen, fontWeight: 700, lineHeight: 1.25 }}>{lastSeen}</div>}
              {content.when && <div style={{ display: "flex", fontSize: SIDE.when, color: INK_MUTED, lineHeight: 1.25 }}>{content.when}</div>}
              {rewardBadge(reward, 40)}
              {content.marks && sideMarks(content.marks)}
              {second && <div style={{ display: "flex", marginTop: "auto" }}>{photoEl(photos[1], second, 24)}</div>}
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
            <div style={{ display: "flex", flexShrink: 0, padding: "56px 90px 0" }}>{photoEl(photos[0], box, 28)}</div>
            <div style={{ display: "flex", flexDirection: "column", padding: "32px 90px 0", gap: 12, flex: 1 }}>
              <div style={{ display: "flex", fontSize: nameSize(content.name, 150), fontWeight: 800, lineHeight: 1 }}>{content.name}</div>
              <div style={{ display: "flex", fontSize: 52, fontWeight: 700, color: INK_MUTED }}>{content.details}</div>
              {lastSeen && <div style={{ display: "flex", fontSize: 46, fontWeight: 700 }}>{lastSeen}</div>}
              {content.when && <div style={{ display: "flex", fontSize: 42, color: INK_MUTED }}>{content.when}</div>}
              {rewardBadge(reward, 44)}
            </div>
          </div>
        )}
        <div style={{ display: "flex", flexShrink: 0, alignItems: "center", gap: 48, padding: "0 90px 56px" }}>
          {qrCard(qr, 300, 30, content.found, true)}
          <div style={{ display: "flex", flexDirection: "column", gap: 12, flex: 1 }}>
            <div style={{ display: "flex", fontSize: 86, fontWeight: 800, color: accent, lineHeight: 1 }}>{content.cta}</div>
            {content.action && <div style={{ display: "flex", fontSize: 40, fontWeight: 700, lineHeight: 1.2 }}>{content.action}</div>}
            {content.contact && <div style={{ display: "flex", fontSize: 50, fontWeight: 800 }}>{content.contact}</div>}
            {codeLine(content, url, dev, 34, INK_MUTED, NAVY)}
            <div style={{ display: "flex", fontSize: 34, fontWeight: 800, color: "#9a6a10" }}>MEL · Uma rede inteira procurando com você.</div>
          </div>
        </div>
      </div>
    );
  }

  // ---------- Horizontal: texto à esquerda, foto à direita ----------
  if (format === "landscape") {
    return (
      <div style={{ width, height, display: "flex", background: NAVY, fontFamily: "Figtree", color: TEXT }}>
        <div style={{ display: "flex", flexDirection: "column", flex: 1, padding: "30px 32px", justifyContent: "space-between" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ display: "flex", alignSelf: "flex-start", background: accent, color: "#fff", fontSize: 30, fontWeight: 800, letterSpacing: 2, padding: "4px 16px", borderRadius: 8 }}>{content.headline}</div>
            <div style={{ display: "flex", fontSize: nameSize(content.name, 92), fontWeight: 800, lineHeight: 1 }}>{content.name}</div>
            <div style={{ display: "flex", fontSize: 22, fontWeight: 700, color: MUTED }}>{content.details}</div>
            {lastSeen && <div style={{ display: "flex", fontSize: 24, fontWeight: 700, lineHeight: 1.2 }}>{lastSeen.replace(/^Visto por último: /, "")}</div>}
            {content.when && <div style={{ display: "flex", fontSize: 22, color: MUTED }}>{content.when}</div>}
            {rewardBadge(reward, 18)}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
            {qrCard(qr, 140, 15, content.found)}
            <div style={{ display: "flex", flexDirection: "column", gap: 6, flex: 1 }}>
              <div style={{ display: "flex", fontSize: 36, fontWeight: 800, color: GOLD, lineHeight: 1 }}>{content.cta}</div>
              {codeLine(content, url, dev, 17, MUTED, TEXT)}
            </div>
          </div>
        </div>
        <div style={{ display: "flex", flexShrink: 0, borderLeft: `8px solid ${accent}` }}>{photoEl(photos[0], box)}</div>
      </div>
    );
  }

  // ---------- Quadrado / 4:5 com foto vertical: foto alta ao lado do texto ----------
  if (layout.arrangement === "side") {
    const S =
      format === "portrait"
        ? { band: 72, bandH: 104, name: 108, det: 32, line: 34, small: 28, cta: 50, act: 24, qr: 236, qrL: 22, url: 20, pad: "36px 30px" }
        : { band: 64, bandH: 92, name: 92, det: 27, line: 28, small: 24, cta: 44, act: 21, qr: 196, qrL: 19, url: 18, pad: "28px 26px" };
    return (
      <div style={{ width, height, display: "flex", flexDirection: "column", background: NAVY, fontFamily: "Figtree", color: TEXT }}>
        {band(S.band, S.bandH)}
        <div style={{ display: "flex", flex: 1 }}>
          {photoEl(photos[0], box)}
          <div style={{ display: "flex", flexDirection: "column", flex: 1, padding: S.pad, justifyContent: "space-between", borderLeft: `8px solid ${accent}`, background: PANEL }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ display: "flex", fontSize: nameSize(content.name, S.name), fontWeight: 800, lineHeight: 1 }}>{content.name}</div>
              <div style={{ display: "flex", fontSize: SIDE.det, fontWeight: 700, color: MUTED }}>{content.details}</div>
              {lastSeen && <div style={{ display: "flex", fontSize: S.line, fontWeight: 700, lineHeight: 1.25 }}>{lastSeen}</div>}
              {content.when && <div style={{ display: "flex", fontSize: S.small, color: MUTED }}>{content.when}</div>}
              {rewardBadge(reward, S.small)}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ display: "flex", fontSize: S.cta, fontWeight: 800, color: GOLD, lineHeight: 1 }}>{content.cta}</div>
              {content.action && <div style={{ display: "flex", fontSize: S.act, fontWeight: 700, lineHeight: 1.2 }}>{content.action}</div>}
              {content.contact && <div style={{ display: "flex", fontSize: S.act, fontWeight: 800 }}>{content.contact}</div>}
              <div style={{ display: "flex", alignSelf: "flex-start" }}>{qrCard(qr, S.qr, S.qrL, content.found)}</div>
              {codeLine(content, url, dev, S.url, MUTED, TEXT)}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ---------- Stories: faixa na área segura, foto com o nome, painel, base segura ----------
  if (format === "story") {
    const compact = box.height > 960;
    return (
      <div style={{ width, height, display: "flex", flexDirection: "column", background: NAVY, fontFamily: "Figtree", color: TEXT }}>
        {band(96, 300, true)}
        {heroPhoto(112, 36, 44)}
        <div style={{ display: "flex", flex: 1, alignItems: "center", gap: 32, padding: "0 52px", borderTop: `8px solid ${accent}`, background: PANEL }}>
          <div style={{ display: "flex", flexDirection: "column", flex: 1, gap: 10 }}>
            {lastSeen && <div style={{ display: "flex", fontSize: 32, fontWeight: 700, lineHeight: 1.2 }}>{lastSeen}</div>}
            {content.when && <div style={{ display: "flex", fontSize: 28, color: MUTED }}>{content.when}</div>}
            {rewardBadge(reward, 28)}
            <div style={{ display: "flex", fontSize: 58, fontWeight: 800, color: GOLD, lineHeight: 1 }}>{content.cta}</div>
            {!compact && content.action && <div style={{ display: "flex", fontSize: 26, fontWeight: 700, lineHeight: 1.2 }}>{content.action}</div>}
            {codeLine(content, url, dev, 22, MUTED, TEXT)}
          </div>
          {qrCard(qr, 200, 22, content.found)}
        </div>
        <div style={{ display: "flex", flexShrink: 0, height: 220, alignItems: "center", justifyContent: "center", background: PANEL, color: "#8f9bb0", fontSize: 30, fontWeight: 700 }}>
          MEL · Uma rede inteira procurando com você.
        </div>
      </div>
    );
  }

  // ---------- Quadrado / 4:5 com foto horizontal: foto larga com o nome ----------
  const T = format === "portrait" ? { band: 72, bandH: 104, name: 96, det: 32, line: 30, small: 26, cta: 48, url: 20, qr: 210, qrL: 21, pad: "26px 40px" } : { band: 64, bandH: 92, name: 84, det: 28, line: 26, small: 22, cta: 42, url: 18, qr: 160, qrL: 17, pad: "20px 36px" };
  return (
    <div style={{ width, height, display: "flex", flexDirection: "column", background: NAVY, fontFamily: "Figtree", color: TEXT }}>
      {band(T.band, T.bandH)}
      {heroPhoto(T.name, T.det, 36)}
      <div style={{ display: "flex", flex: 1, alignItems: "center", gap: 28, padding: T.pad, borderTop: `8px solid ${accent}`, background: PANEL }}>
        <div style={{ display: "flex", flexDirection: "column", flex: 1, gap: 6 }}>
          {lastSeen && <div style={{ display: "flex", fontSize: T.line, fontWeight: 700, lineHeight: 1.2 }}>{lastSeen}</div>}
          {content.when && <div style={{ display: "flex", fontSize: T.small, color: MUTED }}>{content.when}</div>}
          {rewardBadge(reward, T.small)}
          <div style={{ display: "flex", fontSize: T.cta, fontWeight: 800, color: GOLD, lineHeight: 1, marginTop: 4 }}>{content.cta}</div>
          {codeLine(content, url, dev, T.url, MUTED, TEXT)}
        </div>
        {qrCard(qr, T.qr, T.qrL, content.found)}
      </div>
    </div>
  );
}

// ===================================================================================
// Modelo 3 — Clássico de poste (fundo claro, fotos lado a lado, descrição, faixa de chamada)
// ===================================================================================

export function PosterClassic({ format, content, photos, layout, qr, url, dev, reward }: Props) {
  const { width, height } = V2_FORMATS[format];
  const accent = content.found ? "#15895e" : "#e5484d";
  const row = CLASSIC_ROW[format];
  const marks = content.marks;

  const tiles = (radius: number, fontSize: number) => (
    <div style={{ display: "flex", flexShrink: 0, gap: row.gap }}>
      {layout.boxes.map((b, i) => (
        <div key={i} style={{ display: "flex" }}>
          {photoEl(photos[i], b, radius, false)}
        </div>
      ))}
      {layout.card && recognize(layout.card, radius, fontSize)}
    </div>
  );

  /** Quadro "Como reconhecer" no espaço que sobra na linha de fotos. */
  function recognize(box: Box, radius: number, base: number) {
    const pad = Math.round(base * 1.1);
    const { lead, detail } = recognizeText(content);
    const inner = { width: box.width - 2 * pad, height: box.height - 2 * pad - Math.round(base * 4.2) };
    const size = fitFont(lead, inner, base, base * 2);
    return (
      <div style={{ display: "flex", flexDirection: "column", width: box.width, height: box.height, padding: pad, gap: Math.round(base * 0.6), background: CARD, borderRadius: radius, overflow: "hidden" }}>
        <div style={{ display: "flex", fontSize: Math.round(base * 0.85), fontWeight: 800, color: accent, letterSpacing: 1 }}>COMO RECONHECER</div>
        <div style={{ display: "flex", flexShrink: 1, minHeight: 0, overflow: "hidden", fontSize: size, fontWeight: 700, lineHeight: 1.3, color: NAVY }}>{fitText(lead, inner, size)}</div>
        {detail && <div style={{ display: "flex", flexShrink: 0, fontSize: base, color: INK_MUTED }}>{detail}</div>}
      </div>
    );
  }

  /** Descrição embaixo das fotos, quando não foi para o quadro ao lado. */
  const marksBlock = (size: number, lines: number, w: number) =>
    marks && !layout.card && lines > 0 ? <div style={{ display: "flex", fontSize: size, lineHeight: 1.3, color: NAVY }}>{fitText(marks, { width: w, height: size * 1.3 * lines }, size)}</div> : null;

  const header = (size: number, h: number, alignBottom = false) => (
    <div style={{ display: "flex", flexShrink: 0, height: h, alignItems: alignBottom ? "flex-end" : "center", justifyContent: "center", paddingBottom: alignBottom ? 22 : 0, color: accent, fontSize: size, fontWeight: 800, letterSpacing: Math.round(size * 0.06), borderBottom: `${Math.max(6, Math.round(size * 0.08))}px solid ${accent}` }}>
      {content.headline}
    </div>
  );

  /** Faixa de chamada (cor do status) com o QR em cartão branco. */
  const ctaBar = (h: number, qrSize: number, qrLabel: number, cta: number, act: number, code: number, padX: number) => (
    <div style={{ display: "flex", flexShrink: 0, height: h, alignItems: "center", gap: Math.round(padX * 0.8), padding: `0 ${padX}px`, background: accent, color: "#fff" }}>
      {qrCard(qr, qrSize, qrLabel, content.found)}
      <div style={{ display: "flex", flexDirection: "column", flex: 1, gap: Math.round(act * 0.4) }}>
        <div style={{ display: "flex", fontSize: cta, fontWeight: 800, lineHeight: 1 }}>{content.cta}</div>
        {content.action && <div style={{ display: "flex", fontSize: act, fontWeight: 700, lineHeight: 1.2 }}>{content.action}</div>}
        {content.contact && <div style={{ display: "flex", fontSize: act, fontWeight: 800 }}>{content.contact}</div>}
        {codeLine(content, url, dev, code, "#ffe9e9", "#fff")}
      </div>
    </div>
  );

  // ---------- Horizontal ----------
  if (format === "landscape") {
    return (
      <div style={{ width, height, display: "flex", background: PAPER, fontFamily: "Figtree", color: NAVY }}>
        <div style={{ display: "flex", flexShrink: 0, padding: 20 }}>{tiles(16, 20)}</div>
        <div style={{ display: "flex", flexDirection: "column", flex: 1, padding: "26px 28px 24px 8px", justifyContent: "space-between" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", fontSize: 40, fontWeight: 800, color: accent, letterSpacing: 2 }}>{content.headline}</div>
            <div style={{ display: "flex", fontSize: nameSize(content.name, 72), fontWeight: 800, lineHeight: 1 }}>{content.name}</div>
            <div style={{ display: "flex", fontSize: 20, fontWeight: 700, color: INK_MUTED }}>{content.details}</div>
            {content.lastSeen && <div style={{ display: "flex", fontSize: 22, fontWeight: 700, lineHeight: 1.2 }}>{content.lastSeen.replace(/^Visto por último: /, "")}</div>}
            {content.when && <div style={{ display: "flex", fontSize: 20, color: INK_MUTED }}>{content.when}</div>}
            {rewardBadge(reward, 20)}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 16, background: accent, color: "#fff", padding: 14, borderRadius: 16 }}>
            {qrCard(qr, 120, 14, content.found)}
            <div style={{ display: "flex", flexDirection: "column", gap: 6, flex: 1 }}>
              <div style={{ display: "flex", fontSize: 30, fontWeight: 800, lineHeight: 1 }}>{content.cta}</div>
              {codeLine(content, url, dev, 15, "#ffe9e9", "#fff")}
            </div>
          </div>
        </div>
      </div>
    );
  }

  const F = {
    impressao: { pad: 90, header: 170, headerH: 240, name: 130, det: 50, line: 46, small: 40, marks: 38, lines: 4, card: 40, cta: { h: 420, qr: 300, qrL: 30, cta: 84, act: 40, code: 32 }, footer: 0, gap: 28, radius: 24 },
    square: { pad: 36, header: 76, headerH: 110, name: 64, det: 24, line: 24, small: 22, marks: 21, lines: 1, card: 24, cta: { h: 236, qr: 170, qrL: 17, cta: 46, act: 20, code: 18 }, footer: 0, gap: 14, radius: 16 },
    portrait: { pad: 36, header: 84, headerH: 124, name: 76, det: 28, line: 28, small: 24, marks: 24, lines: 2, card: 28, cta: { h: 262, qr: 192, qrL: 19, cta: 52, act: 22, code: 20 }, footer: 0, gap: 16, radius: 18 },
    story: { pad: 36, header: 96, headerH: 300, name: 92, det: 32, line: 30, small: 26, marks: 26, lines: 0, card: 30, cta: { h: 300, qr: 200, qrL: 20, cta: 58, act: 24, code: 22 }, footer: 220, gap: 16, radius: 20 },
  }[format];

  return (
    <div style={{ width, height, display: "flex", flexDirection: "column", background: PAPER, fontFamily: "Figtree", color: NAVY }}>
      {header(F.header, F.headerH, format === "story")}
      <div style={{ display: "flex", flexDirection: "column", flex: 1, padding: `${F.gap}px ${F.pad}px`, gap: F.gap }}>
        <div style={{ display: "flex", flexDirection: "column", gap: Math.round(F.det * 0.2) }}>
          <div style={{ display: "flex", fontSize: nameSize(content.name, F.name), fontWeight: 800, lineHeight: 1.05 }}>{content.name}</div>
          <div style={{ display: "flex", fontSize: F.det, fontWeight: 700, color: INK_MUTED }}>{content.details}</div>
        </div>
        {tiles(F.radius, F.card)}
        <div style={{ display: "flex", flexDirection: "column", gap: Math.round(F.small * 0.3) }}>
          {content.lastSeen && <div style={{ display: "flex", fontSize: F.line, fontWeight: 700, lineHeight: 1.2 }}>{one(content.lastSeen, 120)}</div>}
          {content.when && <div style={{ display: "flex", fontSize: F.small, color: INK_MUTED }}>{content.when}</div>}
          {rewardBadge(reward, F.small)}
          {marksBlock(F.marks, F.lines, row.width)}
        </div>
      </div>
      {ctaBar(F.cta.h, F.cta.qr, F.cta.qrL, F.cta.cta, F.cta.act, F.cta.code, F.pad)}
      {F.footer > 0 && (
        <div style={{ display: "flex", flexShrink: 0, height: F.footer, alignItems: "center", justifyContent: "center", color: INK_MUTED, fontSize: 30, fontWeight: 700 }}>MEL · Uma rede inteira procurando com você.</div>
      )}
    </div>
  );
}
