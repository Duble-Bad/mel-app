import { itemTitle, type MapPin, type PublicCaseItem } from "@mel/core";

/** Zoom inicial por raio de busca (o mesmo no /mapa e na prévia da home). */
export const ZOOM_BY_RADIUS: Record<number, number> = { 1: 15, 3: 13.5, 5: 12.8, 10: 11.8 };

/**
 * Casos na mesma célula aproximada (grade de 100 m) cairiam no mesmo ponto e
 * só o de cima seria clicável: abre-os num círculo (~45 m, dentro da célula), só na tela.
 */
export function toPins(items: PublicCaseItem[]): MapPin[] {
  const groups = new Map<string, PublicCaseItem[]>();
  for (const i of items) {
    const k = `${i.position.lat},${i.position.lng}`;
    groups.set(k, [...(groups.get(k) ?? []), i]);
  }
  return [...groups.values()].flatMap((group) =>
    group.map((i, n) => {
      const angle = (2 * Math.PI * n) / group.length;
      const r = group.length > 1 ? 0.0004 : 0;
      return {
        id: `${i.kind}-${i.code}`,
        kind: i.kind,
        position: { lat: i.position.lat + r * Math.sin(angle), lng: i.position.lng + r * Math.cos(angle) },
        area: i.position,
        label: itemTitle(i),
      };
    }),
  );
}
