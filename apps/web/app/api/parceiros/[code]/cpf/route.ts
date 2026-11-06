import { type NextRequest } from "next/server";
import { formatCpf, maskCpf } from "@mel/core";
import { canRevealPartnerDocuments, findPartnerByCode, getPartnerDocument, logPartnerDocumentAccess } from "@mel/data";
import { getSessionUser } from "@/lib/session";
import { createServiceClient } from "@/lib/supabase/service";
import { getPiiKeyringSafe } from "@/lib/pii/keys";
import { readPartnerCpf, UNREADABLE_CPF_MESSAGE } from "@/lib/pii/partnerCpf";
import { serviceCpfDeps } from "@/lib/pii/server";

const json = (status: number, body: Record<string, unknown>) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store, private", "X-Robots-Tag": "noindex" } });

const NOT_FOUND = "Não encontramos este cadastro.";

/**
 * CPF de um protetor: só o próprio TITULAR e ADMINISTRADORES com concessão
 * explícita (papel admin + pii_access_grants). Moderador comum nunca recebe o
 * número (nem mascarado): vê só o estado do documento na fila de moderação.
 * Mascarado por padrão; completo só com { completo: true }. TODA leitura (e
 * toda negativa) fica registrada em partner_document_access_log. POST (não
 * GET) para não ser pré-carregado, guardado em cache nem disparado por link.
 * Se o cifrado não abrir: marca "ilegível"/"indisponível" (nada é apagado) e
 * o titular recebe o caminho para cadastrar de novo.
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
  const ring = getPiiKeyringSafe("api/parceiros/cpf");
  if (!service || !ring) return json(503, { error: "Consulta indisponível no momento." });

  try {
    const partner = await findPartnerByCode(service, code);
    if (!partner || partner.kind !== "independent") return json(404, { error: NOT_FOUND });

    const isOwner = partner.ownerId === user.id;
    if (!isOwner) {
      const access = await canRevealPartnerDocuments(service, user.id);
      if (!access.moderator) return json(404, { error: NOT_FOUND });
      if (!access.granted) {
        await logPartnerDocumentAccess(service, { businessId: partner.id, businessCode: partner.code, actorId: user.id, action: "denied", full });
        return json(403, { error: "Só administradores autorizados veem o CPF. A moderação vê apenas se ele foi informado." });
      }
    }

    const doc = await getPartnerDocument(service, partner.id);
    if (!doc) return json(404, { error: "Nenhum CPF guardado para este cadastro." });
    const opened = await readPartnerCpf(serviceCpfDeps(service), ring, doc, user.id);
    if (!opened.ok) {
      return json(409, {
        error: isOwner ? UNREADABLE_CPF_MESSAGE[opened.state] : "CPF ilegível ou indisponível: peça ao protetor para cadastrar de novo.",
        state: opened.state,
        reregister: isOwner,
      });
    }
    // Registra ANTES de devolver: sem registro, sem CPF.
    await logPartnerDocumentAccess(service, {
      businessId: partner.id,
      businessCode: partner.code,
      actorId: user.id,
      action: isOwner ? "owner_view" : "admin_view",
      full,
    });
    return json(200, { cpf: full ? formatCpf(opened.cpf) : maskCpf(opened.cpf), full });
  } catch (err) {
    console.error("[api/parceiros/cpf] falhou", (err as Error).name);
    return json(500, { error: "Não conseguimos consultar agora." });
  }
}
