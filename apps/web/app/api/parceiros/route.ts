import { type NextRequest } from "next/server";
import { fieldErrors, needsOnboarding, partnerInputSchema, partnerRecord, userErrorMessage } from "@mel/core";
import { createPartner, DataError, deletePartnerById } from "@mel/data";
import { getCurrentProfile, getSessionUser } from "@/lib/session";
import { createSessionClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { getPiiKeyringSafe } from "@/lib/pii/keys";
import { precheckCpf, writePartnerCpf } from "@/lib/pii/partnerCpf";
import { serviceCpfDeps } from "@/lib/pii/server";

const json = (status: number, body: Record<string, unknown>) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

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
  const ring = input.kind === "independent" ? getPiiKeyringSafe("api/parceiros") : null;
  if (input.kind === "independent") {
    if (!ring || !service) return json(503, { error: "O cadastro de protetores está indisponível no momento. Tente mais tarde." });
    // Duplicidade em todas as versões de HMAC configuradas (rotação sem brecha).
    const blocked = await precheckCpf(serviceCpfDeps(service), ring, user.id, input.cpf);
    if (blocked) return json(blocked.status, { error: blocked.error, ...(blocked.field ? { fields: { cpf: blocked.field } } : {}) });
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

  if (input.kind === "independent" && ring && service) {
    // Cifra AQUI e grava pela RPC atômica (checa duplicidade de novo, sob trava, e registra o acesso).
    const saved = await writePartnerCpf(serviceCpfDeps(service), ring, { businessId: created.id, actorId: user.id, cpf: input.cpf, mode: "signup" });
    if (!saved.ok) {
      // Sem CPF guardado, o cadastro de protetor não fica.
      await deletePartnerById(service, created.id).catch(() => console.error("[api/parceiros] compensação falhou", created.code));
      return json(saved.status === 409 && saved.field ? 409 : 500, saved.field
        ? { error: saved.error, fields: { cpf: saved.field } }
        : { error: "Não conseguimos enviar agora. Tente de novo." });
    }
  }

  return json(201, { code: created.code });
}
