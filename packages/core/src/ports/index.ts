// Interfaces que a lógica de negócio usa sem conhecer o fornecedor.
// Implementações concretas vivem em apps/web (mapa) e packages/data (Supabase).
import type { BBox, LatLng } from "../geo/geo";

export type PinKind = "lost" | "found" | "sighting" | "adoption" | "business";

export interface MapPin {
  id: string;
  kind: PinKind;
  position: LatLng;
  label: string;
}

export interface MapOptions {
  center: LatLng;
  zoom: number;
  interactive?: boolean;
}

export type Unsubscribe = () => void;

export interface MapHandle {
  setCenter(p: LatLng, zoom?: number): void;
  setPins(pins: MapPin[]): void;
  drawPath(points: LatLng[]): void;
  onMove(cb: (bbox: BBox) => void): Unsubscribe;
  onPinClick(cb: (id: string) => void): Unsubscribe;
  enablePicker(cb: (p: LatLng) => void): Unsubscribe;
  destroy(): void;
}

export interface MapProvider {
  mount(el: HTMLElement, opts: MapOptions): MapHandle;
}

export interface GeocodeResult {
  label: string;
  position: LatLng;
  city?: string;
  state?: string;
}

export interface Geocoder {
  search(query: string, near?: LatLng): Promise<GeocodeResult[]>;
  reverse(p: LatLng): Promise<GeocodeResult | null>;
}

export type AnalyticsEventName =
  | "signup_completed"
  | "pet_created"
  | "lost_alert_created"
  | "found_case_created"
  | "sighting_created"
  | "alert_shared"
  | "poster_downloaded"
  | "match_viewed"
  | "contact_started"
  | "pet_reunited"
  | "adoption_created"
  | "adoption_interest"
  | "guardian_enabled"
  | "business_viewed"
  | "offer_clicked";

/** Props nunca devem conter dados pessoais (nome, e-mail, telefone, coordenadas exatas). */
export type AnalyticsProps = Record<string, string | number | boolean | null>;

export interface Analytics {
  track(name: AnalyticsEventName, props?: AnalyticsProps): Promise<void>;
}
