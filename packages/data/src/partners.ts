import type { BusinessCategory, BusinessInput, OfferInput, PublicBusiness } from "@mel/core";
import { DataError, type MelClient } from "./client";

function fail(error: { message: string; code?: string }): never {
  throw new DataError(error.message, error.code);
}

const logoUrl = (client: MelClient, path: string) => client.storage.from("pet-photos").getPublicUrl(path).data.publicUrl;

export async function uploadBusinessLogo(client: MelClient, userId: string, image: Blob): Promise<string> {
  const ext = image.type === "image/jpeg" ? "jpg" : image.type === "image/png" ? "png" : "webp";
  const path = `${userId}/parceiros/${crypto.randomUUID()}.${ext}`;
  const { error } = await client.storage.from("pet-photos").upload(path, image, { contentType: image.type, cacheControl: "31536000", upsert: false });
  if (error) throw new DataError(error.message);
  return path;
}

/** Cadastra (entra em análise). Devolve o código. */
export async function createBusiness(client: MelClient, ownerId: string, b: BusinessInput): Promise<string> {
  const { data, error } = await client
    .from("businesses")
    .insert({
      owner_id: ownerId,
      name: b.name,
      category: b.category,
      description: b.description,
      address_label: b.addressLabel,
      lat: b.position.lat,
      lng: b.position.lng,
      phone: b.phone,
      whatsapp: b.whatsapp,
      website: b.website,
      instagram: b.instagram,
      hours: b.hours,
      helps_lost: b.helpsLost,
      logo_path: b.logoPath,
    } as never)
    .select("short_code")
    .single();
  if (error) fail(error);
  return (data as { short_code: string }).short_code;
}

interface BusinessJson {
  code: string;
  status: PublicBusiness["status"];
  name: string;
  category: BusinessCategory;
  description: string;
  address_label: string;
  lat: number;
  lng: number;
  phone: string | null;
  whatsapp: string | null;
  website: string | null;
  instagram: string | null;
  hours: string | null;
  helps_lost: boolean;
  logo_path: string | null;
  plan_code: string;
  distance_m: number | null;
  is_owner: boolean;
  review_note: string | null;
  offers: { id: string; title: string; description: string | null; starts_at: string | null; ends_at: string | null; is_sponsored: boolean }[];
}

const toBusiness = (client: MelClient, b: BusinessJson): PublicBusiness => ({
  code: b.code,
  status: b.status,
  name: b.name,
  category: b.category,
  description: b.description,
  addressLabel: b.address_label,
  position: { lat: b.lat, lng: b.lng },
  phone: b.phone,
  whatsapp: b.whatsapp,
  website: b.website,
  instagram: b.instagram,
  hours: b.hours,
  helpsLost: b.helps_lost,
  logoUrl: b.logo_path ? logoUrl(client, b.logo_path) : null,
  planCode: b.plan_code,
  distanceM: b.distance_m,
  isOwner: b.is_owner,
  reviewNote: b.review_note,
  offers: (b.offers ?? []).map((o) => ({
    id: o.id,
    title: o.title,
    description: o.description,
    startsAt: o.starts_at,
    endsAt: o.ends_at,
    isSponsored: o.is_sponsored,
  })),
});

export async function getBusiness(client: MelClient, code: string): Promise<PublicBusiness | null> {
  const { data, error } = await client.rpc("get_business", { p_code: code });
  if (error) fail(error);
  return data ? toBusiness(client, data as unknown as BusinessJson) : null;
}

export async function listBusinesses(
  client: MelClient,
  origin: { lat: number; lng: number },
  f: { radiusM?: number; categories?: BusinessCategory[] } = {},
): Promise<PublicBusiness[]> {
  const { data, error } = await client.rpc("list_businesses", {
    p_lat: origin.lat,
    p_lng: origin.lng,
    p_radius_m: f.radiusM ?? 10000,
    p_categories: f.categories?.length ? f.categories : undefined,
  });
  if (error) fail(error);
  return ((data as unknown as BusinessJson[]) ?? []).map((b) => toBusiness(client, b));
}

/** Oferta (empresa aprovada). Nunca patrocinada por quem cadastra. */
export async function addOffer(client: MelClient, businessCode: string, o: OfferInput): Promise<void> {
  const { data: b, error: e1 } = await client.from("businesses").select("id").eq("short_code", businessCode).single();
  if (e1) fail(e1);
  const { error } = await client
    .from("business_offers")
    .insert({ business_id: (b as { id: string }).id, title: o.title, description: o.description, ends_at: o.endsAt } as never);
  if (error) fail(error);
}

export async function deleteOffer(client: MelClient, offerId: string): Promise<void> {
  const { error } = await client.from("business_offers").delete().eq("id", offerId);
  if (error) fail(error);
}

export async function setOfferSponsored(client: MelClient, offerId: string, sponsored: boolean): Promise<void> {
  const { error } = await client.from("business_offers").update({ is_sponsored: sponsored } as never).eq("id", offerId);
  if (error) fail(error);
}

export async function listBusinessesForReview(client: MelClient): Promise<PublicBusiness[]> {
  const { data, error } = await client.rpc("admin_list_businesses_for_review");
  if (error) fail(error);
  return ((data as unknown as BusinessJson[]) ?? []).map((b) => toBusiness(client, b));
}

export async function reviewBusiness(client: MelClient, code: string, approve: boolean, note?: string): Promise<void> {
  const { error } = await client.rpc("admin_review_business", { p_code: code, p_approve: approve, p_note: note });
  if (error) fail(error);
}
