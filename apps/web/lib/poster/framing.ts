/**
 * Enquadramento de uma foto no espaço que ela ocupa no cartaz: o ponto da foto que fica no
 * centro (x, y em %) e o tamanho (zoom). zoom 1 = a foto cobre o espaço inteiro; acima de 1
 * aproxima; abaixo de 1 a foto fica menor que o espaço (a sobra fica com o fundo do cartaz),
 * até caber inteira. Usado pelo editor (navegador), pelo gerador (servidor) e pelo banco
 * (migration 48: x/y 0–100, zoom 0,2–3).
 */
export interface Framing {
  x: number;
  y: number;
  zoom: number;
}

export const ZOOM_MAX = 3;
/** Piso absoluto (o banco aceita a partir daqui); o piso real de cada foto é `containZoom`. */
export const ZOOM_FLOOR = 0.2;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Zoom em que a foto inteira cabe no espaço (relação entre "caber" e "cobrir"). */
export function containZoom(photoAspect: number, boxAspect: number): number {
  return Math.max(ZOOM_FLOOR, Math.min(photoAspect / boxAspect, boxAspect / photoAspect));
}

export function clampFraming(f: Framing, minZoom = ZOOM_FLOOR): Framing {
  return { x: clamp(f.x, 0, 100), y: clamp(f.y, 0, 100), zoom: clamp(f.zoom, Math.max(ZOOM_FLOOR, minZoom), ZOOM_MAX) };
}

/** Na URL: "x,y,zoom" por foto, na ordem do cartaz, separados por "_"; "-" = padrão do modelo. */
export function formatFramings(list: (Framing | null | undefined)[]): string {
  if (!list.some(Boolean)) return "";
  return list.map((f) => (f ? `${Math.round(f.x)},${Math.round(f.y)},${f.zoom.toFixed(2)}` : "-")).join("_");
}

export function parseFramings(value: string | null | undefined): (Framing | null)[] {
  if (!value) return [];
  return value
    .split("_")
    .slice(0, 6)
    .map((item) => {
      const m = /^(\d{1,3}),(\d{1,3}),(\d(?:\.\d{1,2})?)$/.exec(item);
      return m ? clampFraming({ x: Number(m[1]), y: Number(m[2]), zoom: Number(m[3]) }) : null;
    });
}
