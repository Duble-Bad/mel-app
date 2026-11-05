import { type NextRequest } from "next/server";
import { formatCpf, maskCpf } from "@mel/core";
import { canViewPartnerDocuments, findPartnerByCode, getPartnerDocument, logPartnerDocumentAccess } from "@mel/data";
import { getSessionUser } from "@/lib/session";
import { createServiceClient } from "@/lib/supabase/service";
import { getPiiKeyring } from "@/lib/pii/keys";
import { openPii, partnerCpfAad } from "@/lib/pii/crypto";

const json = (status: number, body: Record<string, unknown>) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store, private", "X-Robots-Tag": "noindex" } });

const NOT_FOUND = "Não encontramos este cadastro.";

/**
 * CPF de um protetor: só o próprio dono e moderadores com concessão explícita
 * (pii_access_grants). Mascarado por padrão; completo só com { completo: true }.
 * TODA leitura (e toda negativa a moderador) fica registrada em
 * partner_document_access_log. POST (não GET) para não ser pré-carregado,
 * guardado em cache nem disparado por link de outro site.
 */
export async function POST(request: NextRequest, { params }: RouteContext<"/api/parceiros/[code]/cpf">) {
  const origin = request.headers.get("origin");
  if (origin && origin !== request.nextUrl.origin) return json(403, { error: "Origem não permitida." });
  if (!request.headers.get("content-type")?.includes("application/json")) return json(415, { error: "Formato inválido." });

  const { code } = await params;
  if (!/^[a-z2-9]{6}$/i.test(code)) return json(404, { error: NOT_FOUND });
  const user = await getSessionUser();
  if (!user || user.isAnonymous) return json(401, { error: "Entre na sua conta." });
  const body = (await request.json().catch(() => null)) as { completo?: unknown } | null;
  const full = body?.completo === true;

  const service = createServiceClient();
  let ring;
  try {
    ring = getPiiKeyring();
  } catch {
    ring = null;
  }
  if (!service || !ring) return json(503, { error: "Consulta indisponível no momento." });

  try {
    const partner = await findPartnerByCode(service, code);
    if (!partner || partner.kind !== "independent") return json(404, { error: NOT_FOUND });

    const isOwner = partner.ownerId === user.id;
    if (!isOwner) {
      const access = await canViewPartnerDocuments(service, user.id);
      if (!access.moderator) return json(404, { error: NOT_FOUND });
      if (!access.granted) {
        await logPartnerDocumentAccess(service, { businessId: partner.id, businessCode: partner.code, actorId: user.id, action: "denied", full });
        return json(403, { error: "Seu perfil de moderação não tem autorização para ver CPF. Peça ao responsável pela MEL." });
      }
    }

    const doc = await getPartnerDocument(service, partner.id);
    if (!doc) return json(404, { error: "Nenhum CPF guardado para este cadastro." });
    // Registra ANTES de devolver: sem registro, sem CPF.
    await logPartnerDocumentAccess(service, {
      businessId: partner.id,
      businessCode: partner.code,
      actorId: user.id,
      action: isOwner ? "owner_view" : "moderator_view",
      full,
    });
    const cpf = openPii(ring, { ciphertext: doc.ciphertext, iv: doc.iv, authTag: doc.authTag, keyVersion: doc.keyVersion }, partnerCpfAad(partner.id));
    return json(200, { cpf: full ? formatCpf(cpf) : maskCpf(cpf), full });
  } catch (err) {
    console.error("[api/parceiros/cpf] falhou", (err as Error).name);
    return json(500, { error: "Não conseguimos consultar agora." });
  }
}
