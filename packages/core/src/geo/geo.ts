export interface LatLng {
  lat: number;
  lng: number;
}

export interface BBox {
  south: number;
  west: number;
  north: number;
  east: number;
}

const EARTH_RADIUS_M = 6_371_008.8;
const METERS_PER_DEGREE_LAT = 111_320;

const toRad = (deg: number) => (deg * Math.PI) / 180;

export function isValidLatLng(p: LatLng): boolean {
  return (
    Number.isFinite(p.lat) &&
    Number.isFinite(p.lng) &&
    p.lat >= -90 &&
    p.lat <= 90 &&
    p.lng >= -180 &&
    p.lng <= 180
  );
}

/** Distância em metros (haversine). Suficiente para exibição; consultas usam PostGIS. */
export function distanceMeters(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Aproxima um ponto ao centro de uma célula de grade de `cellMeters`.
 * Usado para nunca publicar a localização exata (muitas vezes a casa do tutor).
 * Determinístico: o mesmo ponto sempre cai na mesma célula, então não dá para
 * "triangular" o local real publicando várias vezes.
 * Deve espelhar a função SQL `private.fuzz_point`.
 */
export function fuzzPoint(p: LatLng, cellMeters = 250): LatLng {
  const latStep = cellMeters / METERS_PER_DEGREE_LAT;
  const lat = (Math.floor(p.lat / latStep) + 0.5) * latStep;
  const lngStep = cellMeters / (METERS_PER_DEGREE_LAT * Math.cos(toRad(lat)));
  const lng = (Math.floor(p.lng / lngStep) + 0.5) * lngStep;
  return { lat: round6(lat), lng: round6(lng) };
}

/** "350 m", "1,2 km", "12 km" — formato pt-BR. */
export function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.max(10, Math.round(meters / 10) * 10)} m`;
  const km = meters / 1000;
  const value = km < 10 ? km.toFixed(1).replace(".", ",") : String(Math.round(km));
  return `${value} km`;
}

const round6 = (n: number) => Math.round(n * 1e6) / 1e6;
