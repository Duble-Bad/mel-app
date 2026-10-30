"use client";

import { createMapTilerGeocoder, geolocationErrorMessage, UserFacingError, type Geocoder, type LatLng } from "@mel/core";

let geocoder: Geocoder | undefined;

/** Geocoder do app (MapTiler). Trocar de fornecedor = trocar esta linha. */
export function getGeocoder(): Geocoder {
  const apiKey = process.env.NEXT_PUBLIC_MAPTILER_KEY;
  if (!apiKey) throw new Error("NEXT_PUBLIC_MAPTILER_KEY ausente (veja .env.example).");
  geocoder ??= createMapTilerGeocoder({ apiKey });
  return geocoder;
}

export interface CurrentPosition {
  position: LatLng;
  accuracyMeters: number;
}

/** Mensagem de localização já escrita para a pessoa (permissão, sinal, aparelho). */
export class GeolocationError extends UserFacingError {}

/**
 * Posição atual pelo GPS do aparelho, uma única vez (sem rastreamento contínuo —
 * a MEL não guarda localização em segundo plano).
 */
export function getCurrentPosition(): Promise<CurrentPosition> {
  return new Promise((resolve, reject) => {
    if (!("geolocation" in navigator)) {
      reject(new GeolocationError(geolocationErrorMessage("unsupported")));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          position: { lat: pos.coords.latitude, lng: pos.coords.longitude },
          accuracyMeters: pos.coords.accuracy,
        }),
      (err) => reject(new GeolocationError(geolocationErrorMessage(err.code))),
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 60_000 },
    );
  });
}
