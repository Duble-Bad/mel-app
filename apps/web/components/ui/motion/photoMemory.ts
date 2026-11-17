import { casePhotoName } from "./SharedPhoto";

/**
 * Guarda, no navegador, a foto do cartão que a pessoa acabou de tocar. A
 * página do caso abre primeiro o esqueleto; ele mostra essa mesma foto no
 * lugar da foto grande, e é para ela que a miniatura "voa" (SkeletonPhoto).
 * O toque é lido por um único ouvinte de clique: o link vai para /alerta/x?
 * então a foto marcada com `data-vt-photo` = nome do voo de /alerta/x é a dela.
 * Só no navegador: no servidor nada é guardado.
 */
let pending: { name: string; src: string; at: number } | null = null;
let installed = false;

function onClick(e: MouseEvent) {
  const link = (e.target as Element | null)?.closest?.("a[href]");
  const href = link?.getAttribute("href");
  if (!href?.startsWith("/")) return;
  const name = casePhotoName(href.split(/[?#]/)[0]!);
  const img = document.querySelector<HTMLImageElement>(`img[data-vt-photo="${CSS.escape(name)}"]`);
  pending = img ? { name, src: img.currentSrc || img.src, at: Date.now() } : null;
}

/** Chamado por cada foto com voo; liga o ouvinte uma vez só. */
export function watchPhotoTaps(): void {
  if (installed || typeof document === "undefined") return;
  installed = true;
  document.addEventListener("click", onClick, true);
}

/** A foto do último toque, se foi há pouco (a navegação acabou de começar). */
export function takeTappedPhoto(): { name: string; src: string } | null {
  if (!pending || Date.now() - pending.at > 5000) return null;
  const p = pending;
  pending = null;
  return p;
}
