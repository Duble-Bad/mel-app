import { type NextRequest } from "next/server";
import { fieldErrors, maskEmail, personalDataChangeSchema, REAUTH_REQUIRED_MESSAGE, userErrorMessage } from "@mel/core";
import {
  DataError,
  findPartnerByCode,
  getMyPersonalData,
  logPersonalDataChange,
  requestEmailChange,
  setMySeekerWhatsapp,
  updateMyLostCasePhone,
  updateMyPartnerContact,
} from "@mel/data";
import { getSessionUser } from "@/lib/session";
import { getAuthFreshness } from "@/lib/reauth";
import { createSessionClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { getPiiKeyringSafe } from "@/lib/pii/keys";
import { writePartnerCpf } from "@/lib/pii/partnerCpf";
import { serviceCpfDeps } from "@/lib/pii/server";
import { isSameOrigin, requestOrigin } from "@/lib/origin";

const json = (status: number, body: Record<string, unknown>) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store, private", "X-Robots-Tag": "noindex" } });

const requestSchema = personalDataChangeSchema;

/**
 * Correção de dados pelo TITULAR (/perfil/dados): CPF, CNPJ, telefones e
 * e-mail. Regras, nesta ordem:
 *  1. conta real e login RECENTE (claim amr do JWT, até 10 min) — senão 401
 *     com { reauth: true } e a tela pede a senha (ou o Google) de novo;
 *  2. validação central (@mel/core), a mesma dos formulários;
 *  3. gravação com a sessão da própria pessoa (RLS + triggers: validação no
 *     banco, login recente, volta para análise, auditoria) — exceto o CPF,
 *     cifrado aqui e gravado pela RPC do service role (duplicidade atômica em
 *     todas as versões de HMAC; aprovação nunca é transferida);
 *  4. e-mail: só pelo fluxo seguro do Supabase Auth (confirmação nos dois
 *     endereços). Nada de e-mail é gravado em tabela da MEL.
 * Respostas e logs nunca trazem o valor (nem o antigo nem o novo).
 */
export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) return json(403, { error: "Origem não permitida." });
  if (!request.headers.get("content-type")?.includes("application/json")) return json(415, { error: "Formato inválido." });

  const user = await getSessionUser();
  if (!user || user.isAnonymous) return json(401, { error: "Entre na sua conta." });
  if (!(await getAuthFreshness()).recent) return json(401, { error: REAUTH_REQUIRED_MESSAGE, reauth: true });

  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return json(422, { error: "Confira o campo destacado.", fields: fieldErrors(parsed.error) });
  const input = parsed.data;
  const session = await createSessionClient();

  try {
    switch (input.campo) {
      case "cpf": {
        const service = createServiceClient();
        const ring = getPiiKeyringSafe("api/perfil/dados");
        if (!service || !ring) return json(503, { error: "A correção do CPF está indisponível no momento. Tente mais tarde." });
        const partner = await findPartnerByCode(service, input.parceiro);
        if (!partner || partner.ownerId !== user.id || partner.kind !== "independent") return json(404, { error: "Não encontramos este cadastro." });
        const saved = await writePartnerCpf(serviceCpfDeps(service), ring, { businessId: partner.id, actorId: user.id, cpf: input.valor, mode: "change" });
        if (!saved.ok) return json(saved.status, { error: saved.error, ...(saved.field ? { fields: { valor: saved.field } } : {}) });
        if (saved.result === "unchanged") return json(200, { ok: true, message: "Este já é o CPF guardado. Nada mudou." });
        return json(200, {
          ok: true,
          message:
            partner.status === "APPROVED"
              ? "CPF guardado com segurança. Seu cadastro voltou para análise da moderação."
              : "CPF guardado com segurança. A moderação vai analisar seu cadastro.",
        });
      }
      case "cnpj": {
        await updateMyPartnerContact(session, input.parceiro, { cnpj: input.valor });
        return json(200, { ok: true, message: "CNPJ atualizado. A verificação ficou pendente e o cadastro passa pela moderação de novo." });
      }
      case "telefone_parceiro":
      case "telefone_adocao":
      case "telefone_alerta": {
        if (input.campo === "telefone_parceiro") {
          if (input.valor === null) {
            const mine = (await getMyPersonalData(session)).partners.find((p) => p.code === input.ref.toLowerCase());
            const other = input.tipo === "phone" ? mine?.whatsapp : mine?.phone;
            if (mine && mine.kind !== "independent" && !other) {
              return json(422, { error: "Mantenha ao menos um telefone ou WhatsApp no cadastro.", fields: { valor: "Mantenha ao menos um telefone ou WhatsApp." } });
            }
          }
          await updateMyPartnerContact(session, input.ref, { [input.tipo]: input.valor });
        } else if (input.campo === "telefone_adocao") {
          await setMySeekerWhatsapp(session, input.valor);
        } else {
          await updateMyLostCasePhone(session, input.ref, input.valor);
        }
        return json(200, { ok: true, message: input.valor ? "Telefone atualizado (formato válido, não confirmado por SMS)." : "Telefone removido." });
      }
      case "email": {
        const { data } = await session.auth.getUser();
        const current = data.user?.email ?? null;
        if (current && current.toLowerCase() === input.valor.toLowerCase()) {
          return json(422, { error: "Este já é o e-mail da sua conta.", fields: { valor: "Este já é o e-mail da sua conta." } });
        }
        await requestEmailChange(session, input.valor, `${requestOrigin(request)}/auth/callback?next=${encodeURIComponent("/perfil/dados")}`);
        const service = createServiceClient();
        if (service) {
          await logPersonalDataChange(service, { actorId: user.id, subject: "account", field: "email", action: "email_change_requested" }).catch(() =>
            console.error("[api/perfil/dados] falha ao registrar auditoria de e-mail"),
          );
        }
        return json(200, {
          ok: true,
          pending: maskEmail(input.valor),
          message: "Enviamos um link para o e-mail atual e outro para o novo. A troca só vale depois de confirmar nos dois.",
        });
      }
    }
  } catch (err) {
    if (err instanceof DataError) {
      if (err.message === REAUTH_REQUIRED_MESSAGE) return json(401, { error: REAUTH_REQUIRED_MESSAGE, reauth: true });
      if (err.code === "42501") return json(403, { error: userErrorMessage(err, "Você não pode alterar este dado.") });
      if (err.code === "P0002") return json(404, { error: err.message });
      if (err.code === "22023" || err.code === "23514") return json(422, { error: userErrorMessage(err, "Confira o valor informado."), fields: { valor: userErrorMessage(err, "Confira o valor informado.") } });
      if (err.kind === "rate_limit" || err.code === "429" || err.code === "over_email_send_rate_limit") return json(429, { error: "Muitas tentativas agora. Tente de novo mais tarde." });
      if (err.code === "email_exists" || err.code === "422") return json(422, { error: "Não conseguimos usar este e-mail. Confira ou tente outro.", fields: { valor: "Não conseguimos usar este e-mail." } });
      console.error("[api/perfil/dados] falhou", input.campo, err.code ?? err.kind);
    } else {
      console.error("[api/perfil/dados] falhou", input.campo, (err as Error)?.name ?? "erro");
    }
    return json(500, { error: "Não conseguimos salvar agora. Tente de novo." });
  }
}
