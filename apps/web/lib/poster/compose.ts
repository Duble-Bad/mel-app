import "server-only";
import sharp from "sharp";
import { cropToDataUrl, fitToDataUrl, type PhotoFocus } from "./assets";
import type { Framing } from "./framing";
import { modelLayout, type ModelLayout, type PosterModel } from "./models";
import type { PhotoLayout, PosterV2Format } from "./PosterV2";

/** Como cada foto entrou no cartaz (avaliação interna; nunca vai para a arte). */
export interface PhotoDiagnostic {
  box: string;
  /** "recorte" ou "inteira" (foto inteira sobre fundo desfocado). */
  mode: "recorte" | "inteira";
  /** Fração da foto que aparece (1 = inteira). */
  kept: number;
  /** Ampliação aplicada à foto original (>2 tende a ficar borrada). */
  scale: number;
}

const MAIN_MIN_KEPT = 0.65;
const EXTRA_MIN_KEPT = 0.5;
const HERO_MIN_KEPT = 0.55;
/** Modelo 4: o mosaico já escolhe caixas perto da proporção de cada foto; aceita um pouco mais de corte. */
const COLLAGE_MIN_KEPT = 0.5;

/**
 * Monta as fotos de uma proposta de cartaz: o layout segue a orientação da foto
 * principal (vertical vira coluna alta, sem faixas desfocadas), a principal é
 * encaixada sem cortar o que identifica o animal e as complementares são
 * recortadas pelo centro (ou mostradas inteiras se o corte for grande). Cada formato faz o próprio recorte.
 */
export async function composePhotos(
  format: PosterV2Format,
  /** `framing`: enquadramento do tutor no editor (ponto + tamanho) para esta foto, neste formato. */
  sources: { source: Buffer; focus: PhotoFocus; framing?: Framing | null }[],
  {
    reward = false,
    model = 2,
  }: {
    /** Há selo de bonificação (protótipo): o quadrado e o 4:5 cedem uma linha da área de fotos. */
    reward?: boolean;
    /** Modelo escolhido pelo tutor (1 foto em destaque, 2 várias fotos, 3 clássico). */
    model?: PosterModel;
  } = {},
): Promise<{ layout: PhotoLayout; model: ModelLayout; photos: string[]; diagnostics: PhotoDiagnostic[] }> {
  const metas = await Promise.all(sources.map((s) => sharp(s.source).rotate().metadata()));
  const dims = metas.map((m) => ({ w: m.width ?? 1, h: m.height ?? 1 }));
  const chosen = modelLayout(format, model, dims.map((d) => d.w / d.h), { reward });
  const boxes = chosen.used ? chosen.boxes.slice(0, chosen.used) : [];
  // Forma do PosterV2 (modelo 2): principal + complementares.
  const layout: PhotoLayout = { main: chosen.boxes[0]!, extras: chosen.boxes.slice(1), extrasDirection: chosen.extrasDirection ?? "column", below: chosen.below };
  const diagnostics: PhotoDiagnostic[] = [];
  const photos = await Promise.all(
    boxes.map((b, i) => {
      const s = sources[i];
      if (!s) return Promise.resolve(null);
      // Modelo 1: a foto única pode perder um pouco mais nas bordas para ficar grande.
      const minKept = model === 4 ? COLLAGE_MIN_KEPT : i === 0 ? (model === 1 ? HERO_MIN_KEPT : MAIN_MIN_KEPT) : EXTRA_MIN_KEPT;
      const { w, h } = dims[i]!;
      const kept = Math.min(w / h / (b.width / b.height), b.width / b.height / (w / h));
      const crop = kept >= minKept;
      diagnostics[i] = {
        box: `${b.width}x${b.height}`,
        mode: crop ? "recorte" : "inteira",
        kept: crop ? Math.round(kept * 100) / 100 : 1,
        scale: Math.round((crop ? Math.max(b.width / w, b.height / h) : Math.min(b.width / w, b.height / h)) * 100) / 100,
      };
      // Enquadrada no editor (principal ou complementar): é a escolha do tutor, sem a troca
      // automática por foto inteira; com zoom < 1 a foto fica menor que o espaço.
      if (s.framing) return cropToDataUrl(s.source, b.width, b.height, { x: s.framing.x, y: s.framing.y }, "centre", s.framing.zoom);
      if (i === 0) return fitToDataUrl(s.source, b.width, b.height, s.focus, { minKept });
      // Complementares: recorte pelo enquadramento do tutor ou pelo centro ("attention" escolhia
      // o pelo, cortando os olhos). Foto vertical sem enquadramento: um pouco acima do meio, onde
      // costuma estar a cabeça. Só se o corte passar de metade da foto ela entra inteira.
      const focus = s.focus ?? (w / h < 0.9 ? { x: 50, y: 42 } : undefined);
      return fitToDataUrl(s.source, b.width, b.height, focus, { minKept, position: "centre" });
    }),
  );
  return { layout, model: chosen, photos: photos.filter((p): p is string => Boolean(p)), diagnostics };
}
