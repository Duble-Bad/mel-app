"use client";

interface Rendered {
  blob: Blob;
  width: number;
  height: number;
}

async function render(bitmap: ImageBitmap, maxSide: number, quality: number): Promise<Rendered> {
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Seu navegador não conseguiu processar a imagem.");
  ctx.drawImage(bitmap, 0, 0, width, height);

  const toBlob = (type: string) => new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));
  const webp = await toBlob("image/webp");
  if (webp && webp.type === "image/webp") return { blob: webp, width, height };
  // Safari antigo não gera WebP: cai para JPEG.
  const jpeg = await toBlob("image/jpeg");
  if (!jpeg) throw new Error("Não foi possível preparar a imagem.");
  return { blob: jpeg, width, height };
}

async function load(file: File): Promise<ImageBitmap> {
  if (!file.type.startsWith("image/")) throw new Error("Escolha um arquivo de imagem.");
  return createImageBitmap(file, { imageOrientation: "from-image" });
}

/**
 * Redimensiona e re-codifica uma foto no navegador antes do upload.
 * - reduz o tamanho (conexões móveis);
 * - remove metadados EXIF, incluindo GPS — a foto não revela onde foi tirada.
 */
export async function prepareImage(file: File, maxSide = 1280, quality = 0.85): Promise<Blob> {
  const bitmap = await load(file);
  try {
    return (await render(bitmap, maxSide, quality)).blob;
  } finally {
    bitmap.close();
  }
}

/** Foto de pet: versão grande (página/cartaz) + miniatura (listas e mapa). */
export async function preparePhotoSet(file: File) {
  const bitmap = await load(file);
  try {
    const full = await render(bitmap, 1280, 0.85);
    const thumb = await render(bitmap, 400, 0.8);
    return { full: full.blob, thumb: thumb.blob, width: full.width, height: full.height };
  } finally {
    bitmap.close();
  }
}
