import { type NextRequest } from "next/server";
import { isDeleteConfirmed } from "@mel/core";
import { deleteAccount } from "@mel/data";
import { getSessionUser } from "@/lib/session";
import { createSessionClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

/**
 * Exclusão definitiva da conta de quem está logado (LGPD). Exige JSON com a
 * palavra de confirmação e origem do próprio site (formulários de outros sites
 * não conseguem enviar JSON sem CORS). Apaga arquivos, o usuário e, em cascata,
 * tudo o que é dele; depois limpa os cookies da sessão.
 */
export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (origin && origin !== request.nextUrl.origin) return Response.json({ error: "Origem não permitida." }, { status: 403 });
  if (!request.headers.get("content-type")?.includes("application/json")) return Response.json({ error: "Formato inválido." }, { status: 415 });

  const user = await getSessionUser();
  if (!user) return Response.json({ error: "Entre na sua conta para excluí-la." }, { status: 401 });
  const body = (await request.json().catch(() => null)) as { confirm?: unknown } | null;
  if (typeof body?.confirm !== "string" || !isDeleteConfirmed(body.confirm)) {
    return Response.json({ error: "Digite EXCLUIR para confirmar." }, { status: 400 });
  }

  const service = createServiceClient();
  if (!service) return Response.json({ error: "Exclusão indisponível no momento. Escreva para a equipe da MEL." }, { status: 503 });
  try {
    await deleteAccount(service, user.id);
  } catch (err) {
    console.error("[api/conta/excluir] falhou", err);
    return Response.json({ error: "Não conseguimos excluir agora. Tente de novo em alguns minutos." }, { status: 500 });
  }
  // O usuário já não existe; só limpamos os cookies desta sessão.
  await (await createSessionClient()).auth.signOut({ scope: "local" }).catch(() => {});
  return Response.json({ ok: true });
}
