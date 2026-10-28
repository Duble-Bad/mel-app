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

/**
 * Baixa a foto do pet e devolve PNG em data URL, já recortada no tamanho do
 * cartaz (o gerador de imagens não lê WebP). null se não houver/falhar.
 */
export async function photoDataUrl(url: string | undefined, width: number, height: number): Promise<string | null> {
  if (!url) return null;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const png = await sharp(Buffer.from(await res.arrayBuffer()))
      .resize(Math.round(width), Math.round(height), { fit: "cover", position: "attention" })
      .png()
      .toBuffer();
    return `data:image/png;base64,${png.toString("base64")}`;
  } catch (err) {
    console.error("[poster] foto indisponível", err);
    return null;
  }
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
