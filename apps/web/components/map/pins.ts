import { itemTitle, type MapPin, type PinKind, type PublicCaseItem } from "@mel/core";

/** Zoom inicial por raio de busca (o mesmo no /mapa e na prévia da home). */
export const ZOOM_BY_RADIUS: Record<number, number> = { 1: 15, 3: 13.5, 5: 12.8, 10: 11.8 };

/** Ponto público (já aproximado) de um caso ou anúncio. */
export interface PublicPoint {
  id: string;
  kind: PinKind;
  position: { lat: number; lng: number };
  label: string;
}

/**
 * Itens na mesma célula aproximada (grade de 100 m) cairiam no mesmo ponto e
 * só o de cima seria clicável: abre-os num círculo (~45 m, dentro da célula), só na tela.
 */
export function spreadPins(points: PublicPoint[]): MapPin[] {
  const groups = new Map<string, PublicPoint[]>();
  for (const p of points) {
    const k = `${p.position.lat},${p.position.lng}`;
    groups.set(k, [...(groups.get(k) ?? []), p]);
  }
  return [...groups.values()].flatMap((group) =>
    group.map((p, n) => {
      const angle = (2 * Math.PI * n) / group.length;
      const r = group.length > 1 ? 0.0004 : 0;
      return {
        id: p.id,
        kind: p.kind,
        position: { lat: p.position.lat + r * Math.sin(angle), lng: p.position.lng + r * Math.cos(angle) },
        area: p.position,
        label: p.label,
      };
    }),
  );
}

export const casePoint = (i: PublicCaseItem): PublicPoint => ({ id: `${i.kind}-${i.code}`, kind: i.kind, position: i.position, label: itemTitle(i) });

export const toPins = (items: PublicCaseItem[]): MapPin[] => spreadPins(items.map(casePoint));
