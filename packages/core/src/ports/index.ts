// Interfaces que a lógica de negócio usa sem conhecer o fornecedor.
// Implementações concretas vivem em apps/web (mapa) e packages/data (Supabase).
import type { BBox, LatLng } from "../geo/geo";
import type { BrState } from "../profile/profile";

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
  /** Estilo do mapa conforme o tema da tela (padrão: claro). */
  theme?: "light" | "dark";
}

export type Unsubscribe = () => void;

export interface MapHandle {
  setCenter(p: LatLng, zoom?: number): void;
  setPins(pins: MapPin[]): void;
  drawPath(points: LatLng[]): void;
  /** Enquadra todos os pontos (com margem). */
  fitTo(points: LatLng[], maxZoom?: number): void;
  onMove(cb: (bbox: BBox) => void): Unsubscribe;
  onPinClick(cb: (id: string) => void): Unsubscribe;
  /** Marcador arrastável; tocar no mapa também move o marcador. */
  enablePicker(initial: LatLng, onPick: (p: LatLng) => void): Picker;
  destroy(): void;
}

export interface Picker {
  /** Reposiciona o marcador (ex.: após GPS ou busca) sem disparar onPick. */
  set(p: LatLng): void;
  remove(): void;
}

export interface MapProvider {
  /** Resolve quando o mapa está pronto para uso; rejeita se não puder ser exibido. */
  mount(el: HTMLElement, opts: MapOptions): Promise<MapHandle>;
}

/**
 * Contrato que todo fornecedor de geocodificação precisa cumprir (ver
 * docs/13-mapas-fornecedores.md). A privacidade depende do FORMATO:
 * - `label`: só o 1º trecho antes da vírgula pode ser o lugar exato (rua com
 *   número, condomínio, loja). O banco publica o rótulo sem esse trecho
 *   (private.public_area_from_label, migration 30): número em trecho próprio
 *   ("Rua X, 123, …") vazaria.
 * - `neighborhood`, `city`, `state`: só área (bairro, cidade, UF), nunca rua ou
 *   lugar — viram o rótulo público do alerta (publicAreaFrom).
 */
export interface GeocodeResult {
  /** Endereço curto para exibir ("Rua X, Bairro, Cidade – UF"). */
  label: string;
  position: LatLng;
  neighborhood?: string;
  city?: string;
  state?: BrState;
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
