import { type NextRequest } from "next/server";
import { sightingInputSchema } from "@mel/core";
import { createSighting, DataError } from "@mel/data";
import { getSessionUser } from "@/lib/session";
import { createSessionClient } from "@/lib/supabase/server";
import { verifyTurnstile } from "@/lib/turnstile";

const json = (status: number, body: Record<string, unknown>) => Response.json(body, { status });

/**
 * "Eu vi este pet". Fluxo: captcha verificado aqui → grava com a sessão da
 * própria pessoa (anônima ou não), então RLS e limites do banco valem.
 */
export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return json(400, { error: "Não entendemos o envio. Tente de novo." });
  }

  const parsed = sightingInputSchema.safeParse(body);
  if (!parsed.success) {
    return json(422, { error: parsed.error.issues[0]?.message ?? "Confira os dados do avistamento." });
  }

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  if (!(await verifyTurnstile(body.turnstileToken as string | undefined, ip))) {
    return json(403, { error: "Não conseguimos confirmar que você não é um robô. Tente enviar de novo." });
  }

  const user = await getSessionUser();
  if (!user) return json(401, { error: "Sua sessão expirou. Recarregue a página e envie de novo." });

  try {
    const id = await createSighting(await createSessionClient(), parsed.data);
    return json(201, { id });
  } catch (err) {
    if (err instanceof DataError && err.code === "P0429") return json(429, { error: err.message });
    if (err instanceof DataError && (err.code === "22023" || err.code === "42501")) return json(422, { error: err.message });
    console.error("[api/avistamentos] falhou", err);
    return json(500, { error: "Não conseguimos enviar agora. Verifique a conexão e tente de novo." });
  }
}
