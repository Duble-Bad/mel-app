import "server-only";
import sharp from "sharp";
import { fitToDataUrl, type PhotoFocus } from "./assets";
import { photoLayout, type PhotoLayout, type PosterV2Format } from "./PosterV2";

/**
 * Monta as fotos de uma proposta de cartaz: o layout segue a orientação da foto
 * principal (vertical vira coluna alta, sem faixas desfocadas), a principal é
 * encaixada sem cortar o que identifica o animal e as complementares são
 * recortadas pelo centro (ou mostradas inteiras se o corte for grande). Cada formato faz o próprio recorte.
 */
export async function composePhotos(format: PosterV2Format, sources: { source: Buffer; focus: PhotoFocus }[]): Promise<{ layout: PhotoLayout; photos: string[] }> {
  const main = sources[0];
  let aspect: number | null = null;
  if (main) {
    const meta = await sharp(main.source).rotate().metadata();
    if (meta.width && meta.height) aspect = meta.width / meta.height;
  }
  const layout = photoLayout(format, sources.length, aspect);
  const boxes = [layout.main, ...layout.extras];
  const photos = await Promise.all(
    boxes.map((b, i) => {
      const s = sources[i];
      if (!s) return Promise.resolve(null);
      // Complementares: recorte pelo centro ("attention" escolhia o pelo, cortando os olhos);
      // se o corte passar de 45% da foto, mostra a foto inteira.
      return i === 0 ? fitToDataUrl(s.source, b.width, b.height, s.focus) : fitToDataUrl(s.source, b.width, b.height, s.focus, { minKept: 0.55, position: "centre" });
    }),
  );
  return { layout, photos: photos.filter((p): p is string => Boolean(p)) };
}
