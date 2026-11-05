import { type NextRequest } from "next/server";
import { fieldErrors, needsOnboarding, partnerInputSchema, partnerRecord, userErrorMessage } from "@mel/core";
import {
  createPartner,
  DataError,
  deletePartnerById,
  logPartnerDocumentAccess,
  partnerDocumentHmacExists,
  recentDuplicateRejections,
  storePartnerDocument,
} from "@mel/data";
import { getCurrentProfile, getSessionUser } from "@/lib/session";
import { createSessionClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { getPiiKeyring } from "@/lib/pii/keys";
import { partnerCpfAad, piiLookupHmac, type PiiKeyring, sealPii } from "@/lib/pii/crypto";

const json = (status: number, body: Record<string, unknown>) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

const DUPLICATE = "Este CPF já está em outro cadastro de protetor. Se é você, fale com a equipe da MEL pelo e-mail de contato.";
const MAX_DUPLICATES_PER_DAY = 5;

/**
 * Inscrição de parceiro (empresa, ONG ou protetor independente).
 * - Valida tudo de novo no servidor (CPF/CNPJ com dígitos).
 * - O cadastro entra com a sessão da própria pessoa (RLS e trigger valem).
 * - Protetor: o CPF é cifrado AQUI (AES-256-GCM, chave só no ambiente do
 *   servidor) e gravado pelo service role numa tabela que ninguém mais lê.
 *   Se não der para guardar o CPF, o cadastro é desfeito.
 * Nunca registra em log o corpo da requisição nem o CPF.
 */
export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (origin && origin !== request.nextUrl.origin) return json(403, { error: "Origem não permitida." });
  if (!request.headers.get("content-type")?.includes("application/json")) return json(415, { error: "Formato inválido." });

  const user = await getSessionUser();
  if (!user || user.isAnonymous) return json(401, { error: "Entre ou crie sua conta para enviar a inscrição.", needsAccount: true });
  const profile = await getCurrentProfile();
  if (needsOnboarding(profile)) return json(403, { error: "Complete seu perfil para enviar a inscrição.", needsOnboarding: true });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json(400, { error: "Não entendemos o envio. Tente de novo." });
  }
  const parsed = partnerInputSchema.safeParse(body);
  if (!parsed.success) return json(422, { error: "Falta pouco: confira os campos destacados.", fields: fieldErrors(parsed.error) });
  const input = parsed.data;

  const service = createServiceClient();
  let pii: { hmac: string; ring: PiiKeyring } | null = null;
  if (input.kind === "independent") {
    let ring;
    try {
      ring = getPiiKeyring();
    } catch (err) {
      console.error("[api/parceiros] chaves de PII mal configuradas", (err as Error).message);
      ring = null;
    }
    if (!ring || !service) return json(503, { error: "O cadastro de protetores está indisponível no momento. Tente mais tarde." });
    if ((await recentDuplicateRejections(service, user.id)) >= MAX_DUPLICATES_PER_DAY) {
      return json(429, { error: "Muitas tentativas hoje. Fale com a equipe da MEL." });
    }
    const hmac = piiLookupHmac(ring, "cpf", input.cpf);
    if (await partnerDocumentHmacExists(service, hmac)) {
      await logPartnerDocumentAccess(service, { businessId: null, businessCode: null, actorId: user.id, action: "duplicate_rejected" });
      return json(409, { error: DUPLICATE, fields: { cpf: "Este CPF já está em outro cadastro." } });
    }
    pii = { hmac, ring };
  }

  let created: { code: string; id: string };
  try {
    created = await createPartner(await createSessionClient(), user.id, partnerRecord(input));
  } catch (err) {
    if (err instanceof DataError && err.code === "P0429") return json(429, { error: err.message });
    if (err instanceof DataError && (err.code === "22023" || err.code === "42501")) return json(422, { error: userErrorMessage(err, "Confira os dados.") });
    console.error("[api/parceiros] falha ao cadastrar", err instanceof DataError ? err.code : "erro");
    return json(500, { error: "Não conseguimos enviar agora. Tente de novo." });
  }

  if (input.kind === "independent" && pii && service) {
    try {
      const box = sealPii(pii.ring, input.cpf, partnerCpfAad(created.id));
      await storePartnerDocument(service, {
        businessId: created.id,
        ownerId: user.id,
        ciphertext: box.ciphertext,
        iv: box.iv,
        authTag: box.authTag,
        keyVersion: box.keyVersion,
        lookupHmac: pii.hmac,
        hmacKeyVersion: pii.ring.hmacVersion,
      });
      await logPartnerDocumentAccess(service, { businessId: created.id, businessCode: created.code, actorId: user.id, action: "stored" });
    } catch (err) {
      // Sem CPF guardado, o cadastro de protetor não fica.
      await deletePartnerById(service, created.id).catch(() => console.error("[api/parceiros] compensação falhou", created.code));
      if (err instanceof DataError && err.code === "23505") {
        await logPartnerDocumentAccess(service, { businessId: null, businessCode: null, actorId: user.id, action: "duplicate_rejected" }).catch(() => {});
        return json(409, { error: DUPLICATE, fields: { cpf: "Este CPF já está em outro cadastro." } });
      }
      console.error("[api/parceiros] falha ao guardar documento", err instanceof DataError ? err.code : (err as Error).name);
      return json(500, { error: "Não conseguimos enviar agora. Tente de novo." });
    }
  }

  return json(201, { code: created.code });
}
