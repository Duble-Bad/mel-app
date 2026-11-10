import { photoLayout, type PosterV2Format } from "./PosterV2";

/**
 * Os quatro modelos de cartaz que o TUTOR escolhe em cada formato (código puro: roda no
 * servidor, que gera o PNG, e no celular, que desenha a moldura do editor com as mesmas
 * caixas). Nenhum modelo depende das fotos de um pet específico: o layout se adapta à
 * quantidade e à orientação das fotos que existirem.
 */

export type PosterModel = 1 | 2 | 3 | 4;
export const POSTER_MODEL_IDS: PosterModel[] = [1, 2, 3, 4];
export const isPosterModel = (v: unknown): v is PosterModel => v === 1 || v === 2 || v === 3 || v === 4;

export const POSTER_MODELS: Record<PosterModel, { name: string; summary: string }> = {
  1: { name: "Foto em destaque", summary: "Uma foto grande, com o nome sobre ela." },
  2: { name: "Várias fotos", summary: "A foto principal e até duas complementares." },
  3: { name: "Clássico de poste", summary: "Fundo claro, fotos lado a lado, descrição e chamada em destaque." },
  4: { name: "Cartaz completo", summary: "PROCURA-SE com o nome, mosaico de até 6 fotos, características, local e contato." },
};

/** Máximo de fotos de cada modelo no formato (o layout pode usar menos se alguma ficar estreita demais). */
export function modelCapacity(format: PosterV2Format, model: PosterModel): number {
  if (model === 1) return 1;
  if (model === 4) return format === "impressao" ? 6 : format === "landscape" ? 3 : 5;
  return 3;
}

/** Para que serve cada formato (passo 1 do fluxo). */
export const FORMAT_PURPOSE: Record<PosterV2Format, { title: string; purpose: string }> = {
  impressao: { title: "A4", purpose: "Imprimir" },
  square: { title: "Quadrado", purpose: "Compartilhar em redes sociais" },
  portrait: { title: "Feed 4:5", purpose: "Publicar no feed" },
  story: { title: "Stories / Status", purpose: "Stories e Status do WhatsApp" },
  landscape: { title: "Horizontal", purpose: "Links e publicações horizontais" },
};

type Box = { width: number; height: number };

export interface ModelLayout {
  model: PosterModel;
  /** Caixas das fotos, a principal primeiro (o gerador recorta cada foto nesse tamanho). */
  boxes: Box[];
  /**
   * Modelo 1: "stack" = foto larga em cima e texto embaixo; "side" = foto alta ao lado do texto.
   * Modelo 2: layout das propostas (principal + complementares).
   * Modelo 3: "row" = fotos lado a lado; `card` = espaço que sobra na linha vira o quadro da descrição.
   */
  arrangement: "stack" | "side" | "classic" | "row" | "collage";
  /** Modelo 2: complementares empilhadas ou lado a lado. */
  extrasDirection?: "column" | "row";
  /** Modelo 2 (horizontal): complementares embaixo da principal, não ao lado. */
  below?: boolean;
  /** Quadro "Como reconhecer" no espaço que sobraria vazio (ao lado das fotos, ou embaixo da complementar). */
  card?: Box;
  /** Modelo 2: o quadro vai embaixo da complementar, na mesma coluna. */
  cardBelowExtras?: boolean;
  /**
   * Modelo 4: as complementares ficam em colunas à direita da principal (`columns` = quantas
   * fotos em cada coluna) e, no A4, a última foto vai ao lado das características (`bottom`).
   */
  columns?: number[];
  bottom?: boolean;
  /** Fotos consideradas pelo modelo (as demais ficam de fora). */
  used: number;
}

const VERTICAL = 0.9;

/** Modelo 1 — uma foto grande. Vertical no quadrado/4:5: foto alta ao lado do texto. */
function heroLayout(format: PosterV2Format, a: number): ModelLayout {
  const vertical = a < VERTICAL;
  switch (format) {
    case "square":
      return vertical ? { model: 1, arrangement: "side", boxes: [{ width: 640, height: 988 }], used: 1 } : { model: 1, arrangement: "stack", boxes: [{ width: 1080, height: 728 }], used: 1 };
    case "portrait":
      return vertical ? { model: 1, arrangement: "side", boxes: [{ width: 680, height: 1246 }], used: 1 } : { model: 1, arrangement: "stack", boxes: [{ width: 1080, height: 900 }], used: 1 };
    case "story":
      // Faixa de 300 (área segura do topo) + foto + painel + base segura de 220.
      return { model: 1, arrangement: "stack", boxes: [{ width: 1080, height: vertical ? 1060 : 900 }], used: 1 };
    case "impressao":
      // Vertical: foto alta à esquerda e o nome ao lado (uma faixa larga cortaria demais).
      return vertical
        ? { model: 1, arrangement: "side", boxes: [{ width: Math.min(900, Math.max(760, Math.round((1500 * a) / 0.75))), height: 1500 }], used: 1 }
        : { model: 1, arrangement: "stack", boxes: [{ width: 1474, height: 1000 }], used: 1 };
    case "landscape": {
      // Foto à direita, o mais perto possível da proporção dela.
      const w = Math.min(720, Math.max(470, Math.round(630 * Math.max(a, 0.75))));
      return { model: 1, arrangement: "side", boxes: [{ width: w, height: 630 }], used: 1 };
    }
  }
}

/** Modelo 3: área da linha de fotos por formato (largura útil × altura). */
export const CLASSIC_ROW: Record<PosterV2Format, { width: number; height: number; gap: number }> = {
  square: { width: 1008, height: 470, gap: 16 },
  portrait: { width: 1008, height: 680, gap: 16 },
  story: { width: 1008, height: 780, gap: 16 },
  impressao: { width: 1474, height: 1040, gap: 24 },
  landscape: { width: 620, height: 590, gap: 12 },
};
/** Menor sobra aceitável de cada foto ao estreitar (35% de corte nas laterais, no máximo). */
const ROW_MIN_KEPT = 0.65;
/** Nenhuma foto da linha mais estreita que isso (fração da largura): tira fina não ajuda a reconhecer. */
const TILE_MIN = 0.22;
/** Abaixo disso a sobra da linha não vira quadro (fica estreito demais para texto). */
const CARD_MIN = 260;

/**
 * Modelo 3 — fotos lado a lado, cada uma perto da própria proporção. Se forem estreitas demais
 * para caber, usa menos fotos; se sobrar espaço, ele vira o quadro da descrição (nada vazio).
 */
function classicLayout(format: PosterV2Format, aspects: number[], room = 0): ModelLayout {
  const { width: W, gap } = CLASSIC_ROW[format];
  const H = CLASSIC_ROW[format].height - room;
  for (let k = Math.min(3, aspects.length); k >= 1; k--) {
    const natural = aspects.slice(0, k).map((a) => H * a);
    const total = natural.reduce((s, w) => s + w, 0) + gap * (k - 1);
    if (total > W) {
      const scale = (W - gap * (k - 1)) / (total - gap * (k - 1));
      const widths = natural.map((w) => Math.floor(w * scale));
      // Corte demais ou uma foto em tira estreita: melhor mostrar uma foto a menos.
      if (k > 1 && (scale < ROW_MIN_KEPT || Math.min(...widths) < W * TILE_MIN)) continue;
      widths[k - 1]! += W - gap * (k - 1) - widths.reduce((s, w) => s + w, 0);
      return { model: 3, arrangement: "row", boxes: widths.map((w) => ({ width: w, height: H })), used: k };
    }
    const exact = natural.map((w) => Math.floor(w));
    const card = W - exact.reduce((s, w) => s + w, 0) - gap * k;
    if (card >= CARD_MIN) return { model: 3, arrangement: "row", boxes: exact.map((w) => ({ width: w, height: H })), card: { width: card, height: H }, used: k };
    // Sobra pequena: as fotos alargam um pouco (corte leve em cima e embaixo).
    const grow = (W - gap * (k - 1)) / (total - gap * (k - 1));
    const widths = natural.map((w) => Math.floor(w * grow));
    widths[k - 1]! += W - gap * (k - 1) - widths.reduce((s, w) => s + w, 0);
    return { model: 3, arrangement: "row", boxes: widths.map((w) => ({ width: w, height: H })), used: k };
  }
  // Sem foto: um quadro "Sem foto" do tamanho da linha.
  return { model: 3, arrangement: "row", boxes: [{ width: W, height: H }], used: 0 };
}

/**
 * Larguras para fotos lado a lado preenchendo W×H sem cortar mais que 35% de nenhuma
 * (usa menos fotos se preciso). null = nem uma foto preenche bem a linha.
 */
function rowWidths(W: number, H: number, aspects: number[]): number[] | null {
  for (let k = aspects.length; k >= 1; k--) {
    const natural = aspects.slice(0, k).map((a) => H * a);
    const total = natural.reduce((s, w) => s + w, 0);
    const ratio = W / total;
    if (ratio < ROW_MIN_KEPT || 1 / ratio < ROW_MIN_KEPT) continue;
    const widths = natural.map((w) => Math.floor(w * ratio));
    widths[k - 1]! += W - widths.reduce((s, w) => s + w, 0);
    return widths;
  }
  return null;
}

/** Modelo 4: área do mosaico (dentro da moldura vermelha) e a foto ao lado das características (A4). */
export const COLLAGE_AREA: Record<PosterV2Format, { width: number; height: number; gap: number; bottom?: Box }> = {
  impressao: { width: 1582, height: 900, gap: 22, bottom: { width: 420, height: 560 } },
  portrait: { width: 1040, height: 520, gap: 12 },
  story: { width: 1040, height: 700, gap: 12 },
  square: { width: 1040, height: 400, gap: 10 },
  landscape: { width: 640, height: 590, gap: 10 },
};
/** Sobra ao lado de uma foto única: abaixo disso não vira o quadro do QR. */
const COLLAGE_CARD_MIN = 300;

/**
 * Modelo 4 — "Cartaz completo": principal grande à esquerda e as complementares em colunas
 * (1 → uma alta; 2 → empilhadas; 3 → 2 + 1 alta; 4 → 2 × 2). Com uma foto só, ela fica na
 * própria proporção e o resto vira o quadro do QR (nada vazio, nada desfocado).
 */
function collageLayout(format: PosterV2Format, aspects: number[], reward: boolean): ModelLayout {
  const { width: W, gap, bottom } = COLLAGE_AREA[format];
  // Com a faixa da bonificação, o mosaico cede a altura dela.
  const H = COLLAGE_AREA[format].height - (reward ? COLLAGE_REWARD_ROOM[format] : 0);
  const n = Math.min(aspects.length, modelCapacity(format, 4));
  if (n === 0) return { model: 4, arrangement: "collage", boxes: [{ width: W, height: H }], columns: [], used: 0 };
  const main = aspects[0]!;
  if (n === 1) {
    const w = Math.min(W, Math.max(Math.round(W * 0.42), Math.round(H * main)));
    const card = W - w - gap;
    return card >= COLLAGE_CARD_MIN
      ? { model: 4, arrangement: "collage", boxes: [{ width: w, height: H }], card: { width: card, height: H }, columns: [], used: 1 }
      : { model: 4, arrangement: "collage", boxes: [{ width: W, height: H }], columns: [], used: 1 };
  }
  // A foto ao lado das características (A4) só entra com 6 fotos; o mosaico leva até 4 complementares.
  const withBottom = Boolean(bottom) && n >= 6;
  let mainW = Math.min(Math.round(W * 0.52), Math.max(Math.round(W * 0.36), Math.round(H * main)));
  // Principal horizontal numa área baixa (paisagem): alarga até onde as complementares ainda cabem.
  if (keptRatio(main, { width: mainW, height: H }) < COLLAGE_MIN_KEPT) mainW = Math.min(W - gap - 140, Math.round(H * main));
  // Nem assim: fica só a principal, na proporção dela (o resto vira o quadro ao lado).
  if (keptRatio(main, { width: mainW, height: H }) < COLLAGE_MIN_KEPT) return collageLayout(format, aspects.slice(0, 1), reward);
  const EW = W - mainW - gap;
  // Entre as disposições possíveis (colunas de 1 ou 2 fotos), fica a que corta menos a foto mais
  // cortada; se nem assim todas aparecem bem, usa uma complementar a menos (nada desfocado).
  for (let k = Math.min(4, n - 1 - (withBottom ? 1 : 0), format === "landscape" ? 2 : 4); k >= 1; k--) {
    const extras = aspects.slice(1, 1 + k);
    let best: { columns: number[]; boxes: Box[]; kept: number } | null = null;
    for (const columns of COLLAGE_COLUMNS[k]!) {
      const boxes = collageColumns(columns, extras, EW, H, gap);
      if (!boxes) continue;
      const kept = Math.min(...boxes.map((b, i) => keptRatio(extras[i]!, b)));
      if (!best || kept > best.kept + 0.02) best = { columns, boxes, kept };
    }
    if (best && best.kept >= COLLAGE_MIN_KEPT) {
      // A 6ª foto (ao lado das características, no A4) na largura que a orientação dela pede.
      const last = withBottom ? { width: Math.min(700, Math.max(320, Math.round(bottom!.height * aspects[1 + k]!))), height: bottom!.height } : null;
      if (last && keptRatio(aspects[1 + k]!, last) < COLLAGE_MIN_KEPT) return collageLayout(format, aspects.slice(0, 5), reward);
      const boxes = [{ width: mainW, height: H }, ...best.boxes, ...(last ? [last] : [])];
      return { model: 4, arrangement: "collage", boxes, columns: best.columns, bottom: withBottom, used: boxes.length };
    }
  }
  // Nenhuma complementar cabe bem ao lado: só a principal (o resto vira o quadro ao lado dela).
  return collageLayout(format, aspects.slice(0, 1), reward);
}

/** Disposições das complementares: quantas fotos em cada coluna (da esquerda para a direita). */
const COLLAGE_COLUMNS: Record<number, number[][]> = {
  1: [[1]],
  2: [[2], [1, 1]],
  3: [[2, 1], [1, 2], [1, 1, 1]],
  4: [[2, 2], [1, 1, 1, 1]],
};
/** Fração mínima de cada complementar que continua visível no recorte. */
const COLLAGE_MIN_KEPT = 0.55;
const keptRatio = (a: number, b: Box) => Math.min(a / (b.width / b.height), b.width / b.height / a);

/** Caixas das colunas: largura de cada coluna proporcional à largura natural das fotos dela. */
function collageColumns(columns: number[], aspects: number[], W: number, H: number, gap: number): Box[] | null {
  let i = 0;
  const cols = columns.map((count) => {
    const h = (H - gap * (count - 1)) / count;
    const items = aspects.slice(i, (i += count));
    return { count, h, natural: h * (items.reduce((s, a) => s + a, 0) / items.length) };
  });
  const free = W - gap * (columns.length - 1);
  const total = cols.reduce((s, c) => s + c.natural, 0);
  const widths = cols.map((c) => Math.floor((c.natural / total) * free));
  widths[widths.length - 1]! += free - widths.reduce((s, w) => s + w, 0);
  // Coluna estreita demais não ajuda a reconhecer.
  if (Math.min(...widths) < 120) return null;
  const boxes: Box[] = [];
  cols.forEach((c, k) => {
    const first = Math.floor(c.h);
    for (let r = 0; r < c.count; r++) boxes.push({ width: widths[k]!, height: r === c.count - 1 ? H - (first + gap) * (c.count - 1) : first });
  });
  return boxes;
}

/** Altura que o mosaico do modelo 4 cede à faixa da bonificação (protótipo). */
const COLLAGE_REWARD_ROOM: Record<PosterV2Format, number> = { impressao: 116, square: 56, portrait: 66, story: 70, landscape: 0 };

/** Altura que as fotos cedem ao selo da bonificação (modelos 1 e 3; o 2 usa a do PosterV2). */
const MODEL_REWARD_ROOM: Record<PosterV2Format, number> = { impressao: 0, square: 44, portrait: 48, story: 60, landscape: 0 };

/** Fotos um pouco mais baixas (para o selo da bonificação caber no painel). */
function shrink(l: ModelLayout, room: number): ModelLayout {
  // Foto ao lado do texto ("side"): a coluna de texto já tem folga.
  return room && l.arrangement === "stack" ? { ...l, boxes: l.boxes.map((b) => ({ width: b.width, height: b.height - room })) } : l;
}

/** Largura da área de fotos do modelo 2 (a mesma do PosterV2). */
const MODEL2_AREA_WIDTH: Record<PosterV2Format, number> = { square: 1080, portrait: 1080, story: 1080, landscape: 700, impressao: 1474 };

/** Caixas de foto do modelo escolhido para as fotos disponíveis (proporções largura/altura). */
export function modelLayout(format: PosterV2Format, model: PosterModel, aspects: number[], opts: { reward?: boolean } = {}): ModelLayout {
  const main = aspects[0] ?? 4 / 3;
  const room = opts.reward ? MODEL_REWARD_ROOM[format] : 0;
  if (model === 1) return shrink(heroLayout(format, main), room);
  if (model === 3) return classicLayout(format, aspects, room);
  if (model === 4) return collageLayout(format, aspects, Boolean(opts.reward));
  return singleExtraFits(manyPhotosLayout(format, main, aspects, opts), aspects[1], format === "impressao" ? 24 : 0);
}

/**
 * Modelo 2 com UMA complementar numa coluna alta: se ela for horizontal, ocupar a coluna toda
 * cortaria quase metade. Ela fica na própria proporção e o resto da coluna vira o quadro
 * "Como reconhecer" (nada vazio, nada desfocado).
 */
function singleExtraFits(l: ModelLayout, extraAspect: number | undefined, gap: number): ModelLayout {
  if (l.boxes.length !== 2 || l.extrasDirection !== "column" || l.below || extraAspect === undefined) return l;
  const box = l.boxes[1]!;
  const natural = Math.round(box.width / extraAspect);
  const cardH = box.height - natural - gap;
  if (natural >= box.height * 0.8 || cardH < 180) return l;
  return { ...l, boxes: [l.boxes[0]!, { width: box.width, height: natural }], card: { width: box.width, height: cardH }, cardBelowExtras: true };
}

function manyPhotosLayout(format: PosterV2Format, main: number, aspects: number[], opts: { reward?: boolean }): ModelLayout {
  if (format === "landscape" && aspects.length > 1) {
    // Horizontal com várias fotos: principal + coluna de até duas complementares (o modelo 1 é só uma foto).
    const n = Math.min(2, aspects.length - 1);
    if (main >= VERTICAL) {
      // Principal horizontal: larga em cima, complementares em linha embaixo (largura pela proporção).
      const widths = rowWidths(640, 210, aspects.slice(1, 1 + n));
      if (!widths) return { model: 2, arrangement: "classic", boxes: [{ width: 640, height: 630 }], extrasDirection: "column", used: 1 };
      return { model: 2, arrangement: "classic", boxes: [{ width: 640, height: 420 }, ...widths.map((w) => ({ width: w, height: 210 }))], extrasDirection: "row", below: true, used: 1 + widths.length };
    }
    const extras = Array.from({ length: n }, () => ({ width: 250, height: 630 / n }));
    return { model: 2, arrangement: "classic", boxes: [{ width: 480, height: 630 }, ...extras], extrasDirection: "column", used: 1 + n };
  }
  const l = photoLayout(format, aspects.length ? aspects : [main], opts);
  // Modelo 2 com uma foto vertical: o espaço ao lado dela vira o quadro "Como reconhecer".
  const area = MODEL2_AREA_WIDTH[format];
  const spare = area - l.main.width - (format === "impressao" ? 24 : 0);
  const card = l.extras.length === 0 && format !== "landscape" && spare >= CARD_MIN ? { width: spare, height: l.main.height } : undefined;
  return { model: 2, arrangement: "classic", boxes: [l.main, ...l.extras], extrasDirection: l.extrasDirection, card, used: 1 + l.extras.length };
}

/** Lado menor abaixo disso: a foto tende a sair borrada quando ampliada (mesmo critério do cadastro). */
const LOW_RES_SHORT_SIDE = 640;

/**
 * Sugestão "Recomendado pela MEL" com critérios verificáveis (quantidade, orientação e
 * resolução das fotos, e a finalidade do formato). Não há análise do conteúdo das fotos.
 */
export function recommendModel(format: PosterV2Format, photos: { width: number; height: number }[]): { model: PosterModel; reason: string } {
  const n = photos.length;
  const main = photos[0];
  const lowRes = main ? Math.min(main.width, main.height) < LOW_RES_SHORT_SIDE : false;
  if (n === 0) return { model: 3, reason: "Sem fotos: o modelo com descrição em destaque ajuda mais." };
  if (format === "impressao") {
    if (lowRes) return { model: 3, reason: "A foto principal é pequena para uma folha inteira: fotos menores saem mais nítidas na impressão." };
    return n >= 2 ? { model: 3, reason: "Impressão: fundo claro (economiza tinta), mais de uma foto e a descrição." } : { model: 1, reason: "Uma foto boa: em destaque na folha." };
  }
  if (format === "landscape") return { model: 1, reason: "Formato baixo: uma foto grande é reconhecida melhor." };
  if (lowRes && n >= 2) return { model: 2, reason: "A foto principal é pequena: várias fotos menores ficam mais nítidas que uma ampliada." };
  if (n >= 3 && (format === "story" || format === "portrait")) return { model: 2, reason: `${n} fotos disponíveis: mostra a principal e mais duas.` };
  return { model: 1, reason: n === 1 ? "Há uma foto: ela aparece o maior possível." : "Foto principal grande, fácil de reconhecer." };
}
