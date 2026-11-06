import "server-only";
import type { BusinessOffer } from "@mel/core";

/**
 * Ofertas "Patrocinado" (decisão 10): desligadas no piloto. Sem a flag, o selo,
 * a ordem de destaque e o botão da moderação somem; o dado (is_sponsored)
 * continua no banco. Liga com MEL_SPONSORED_OFFERS=on.
 */
export const sponsoredOffersEnabled = () => process.env.MEL_SPONSORED_OFFERS === "on";

/** Ofertas como o público vê: com a flag, patrocinadas primeiro; sem, nenhuma marcada. */
export function visibleOffers(offers: BusinessOffer[], sponsored = sponsoredOffersEnabled()): BusinessOffer[] {
  if (!sponsored) return offers.map((o) => (o.isSponsored ? { ...o, isSponsored: false } : o));
  return [...offers].sort((a, b) => Number(b.isSponsored) - Number(a.isSponsored));
}
