import "server-only";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import QRCode from "qrcode";
import sharp from "sharp";
import { colors } from "@mel/ui-tokens";

// Fontes lidas uma vez (não dependem da requisição).
const fontDir = join(process.cwd(), "assets", "fonts");
const [regular, bold, extraBold] = await Promise.all(
  ["Figtree-400.woff", "Figtree-700.woff", "Figtree-800.woff"].map((f) => readFile(join(fontDir, f))),
);

export const posterFonts = [
  { name: "Figtree", data: regular, weight: 400 as const, style: "normal" as const },
  { name: "Figtree", data: bold, weight: 700 as const, style: "normal" as const },
  { name: "Figtree", data: extraBold, weight: 800 as const, style: "normal" as const },
];

/** Ponto da foto (0–100%) que deve continuar visível no recorte; null = automático. */
export type PhotoFocus = { x: number; y: number } | null | undefined;

/** Baixa a foto original (sem recortar); null se não houver/falhar. */
export async function fetchPhoto(url: string | undefined): Promise<Buffer | null> {
  if (!url) return null;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return Buffer.from(await res.arrayBuffer());
  } catch (err) {
    console.error("[poster] foto indisponível", err);
    return null;
  }
}

/**
 * Recorta a foto no tamanho pedido e devolve PNG em data URL (o gerador de imagens
 * não lê WebP). Com `focus`, o recorte mantém aquele ponto o mais centralizado
 * possível (enquadramento escolhido pelo tutor); sem ele, o sharp escolhe a região
 * de mais interesse ("attention"), como antes.
 */
export async function cropToDataUrl(source: Buffer, width: number, height: number, focus?: PhotoFocus, position: "attention" | "centre" = "attention"): Promise<string | null> {
  try {
    const w = Math.round(width);
    const h = Math.round(height);
    // Gira pela orientação da câmera (EXIF) antes de medir e recortar.
    const upright = await sharp(source).rotate().toBuffer();
    let img = sharp(upright);
    if (focus) {
      const meta = await sharp(upright).metadata();
      const iw = meta.width ?? w;
      const ih = meta.height ?? h;
      const scale = Math.max(w / iw, h / ih);
      const rw = Math.max(w, Math.round(iw * scale));
      const rh = Math.max(h, Math.round(ih * scale));
      const left = Math.min(rw - w, Math.max(0, Math.round((focus.x / 100) * rw - w / 2)));
      const top = Math.min(rh - h, Math.max(0, Math.round((focus.y / 100) * rh - h / 2)));
      img = img.resize(rw, rh).extract({ left, top, width: w, height: h });
    } else {
      img = img.resize(w, h, { fit: "cover", position });
    }
    return `data:image/png;base64,${(await img.png().toBuffer()).toString("base64")}`;
  } catch (err) {
    console.error("[poster] recorte falhou", err);
    return null;
  }
}

/**
 * Encaixa a foto no espaço do cartaz SEM cortar o que identifica o animal:
 * - recorte grande demais (sobraria menos que `minKept`): foto INTEIRA, mesmo com
 *   enquadramento do tutor (o ponto não salva orelhas/rosto num corte de 50%);
 * - com enquadramento do tutor: recorta em volta do ponto escolhido;
 * - se o recorte manteria ao menos `minKept` da foto (65%): recorte normal;
 * - senão (ex.: foto vertical num espaço largo): mostra a foto INTEIRA, sem
 *   distorcer, sobre um fundo escurecido da própria foto. Isso também evita
 *   ampliar demais fotos pequenas (o que deixaria a imagem borrada).
 */
export async function fitToDataUrl(
  source: Buffer,
  width: number,
  height: number,
  focus?: PhotoFocus,
  { minKept = 0.65, position = "attention" }: { minKept?: number; position?: "attention" | "centre" } = {},
): Promise<string | null> {
  try {
    const w = Math.round(width);
    const h = Math.round(height);
    const upright = await sharp(source).rotate().toBuffer();
    const meta = await sharp(upright).metadata();
    const ir = (meta.width ?? w) / (meta.height ?? h);
    const br = w / h;
    const kept = Math.min(ir / br, br / ir);
    if (kept >= minKept) return cropToDataUrl(upright, w, h, focus ?? null, position);
    const backdrop = await sharp(upright).resize(w, h, { fit: "cover" }).blur(28).modulate({ brightness: 0.45 }).toBuffer();
    const fg = await sharp(upright).resize(w, h, { fit: "inside" }).toBuffer();
    const fm = await sharp(fg).metadata();
    const png = await sharp(backdrop)
      .composite([{ input: fg, left: Math.round((w - (fm.width ?? w)) / 2), top: Math.round((h - (fm.height ?? h)) / 2) }])
      .png()
      .toBuffer();
    return `data:image/png;base64,${png.toString("base64")}`;
  } catch (err) {
    console.error("[poster] encaixe falhou", err);
    return null;
  }
}

/** Baixa e recorta a foto do pet (atalho dos dois passos). */
export async function photoDataUrl(url: string | undefined, width: number, height: number, focus?: PhotoFocus): Promise<string | null> {
  const source = await fetchPhoto(url);
  return source ? cropToDataUrl(source, width, height, focus) : null;
}

/** QR Code que abre o alerta. */
export function qrDataUrl(url: string, size: number): Promise<string> {
  return QRCode.toDataURL(url, {
    width: size,
    margin: 1,
    errorCorrectionLevel: "M",
    color: { dark: colors["text-primary"], light: colors.surface },
  });
}
