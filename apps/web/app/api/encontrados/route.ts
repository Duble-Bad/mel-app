import { type NextRequest } from "next/server";
import { foundInputSchema } from "@mel/core";
import { createFoundCase, DataError } from "@mel/data";
import { getSessionUser } from "@/lib/session";
import { createSessionClient } from "@/lib/supabase/server";
import { verifyTurnstile } from "@/lib/turnstile";

const json = (status: number, body: Record<string, unknown>) => Response.json(body, { status });

/**
 * "Encontrei / Vi um pet". Captcha verificado aqui → grava com a sessão da
 * própria pessoa (anônima ou não): RLS, limites e o Radar MEL rodam no banco.
 */
export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return json(400, { error: "Não entendemos o envio. Tente de novo." });
  }
  const parsed = foundInputSchema.safeParse(body);
  if (!parsed.success) return json(422, { error: parsed.error.issues[0]?.message ?? "Confira os dados." });

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  if (!(await verifyTurnstile(body.turnstileToken as string | undefined, ip))) {
    return json(403, { error: "Não conseguimos confirmar que você não é um robô. Tente publicar de novo." });
  }
  const user = await getSessionUser();
  if (!user) return json(401, { error: "Sua sessão expirou. Recarregue a página e publique de novo." });

  try {
    const code = await createFoundCase(await createSessionClient(), user.id, parsed.data);
    return json(201, { code });
  } catch (err) {
    if (err instanceof DataError && err.code === "P0429") return json(429, { error: err.message });
    if (err instanceof DataError && (err.code === "22023" || err.code === "42501")) return json(422, { error: err.message });
    console.error("[api/encontrados] falhou", err);
    return json(500, { error: "Não conseguimos publicar agora. Verifique a conexão e tente de novo." });
  }
}
