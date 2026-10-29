import { NextResponse, type NextRequest } from "next/server";
import { authCallbackAction, safeErrorCode } from "@mel/core";
import { createSessionClient } from "@/lib/supabase/server";

/**
 * Retorno do Supabase: login com Google, vínculo do Google à sessão anônima
 * (mesmo usuário, vira conta) e links de recuperação de senha. Sempre termina
 * dentro do site: erro → /entrar?erro=<código>; sucesso → `next` interno.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const action = authCallbackAction(searchParams);

  if (action.kind === "error") {
    // Só o código (nunca a descrição do provedor) vai para o log e para a URL.
    console.error("[auth/callback] retorno com erro", action.code);
    return NextResponse.redirect(`${origin}/entrar?erro=${action.code}`);
  }

  const supabase = await createSessionClient();
  const { error } = await supabase.auth.exchangeCodeForSession(action.code);
  if (!error) return NextResponse.redirect(`${origin}${action.next}`);
  const code = safeErrorCode(error.code ?? "link");
  console.error("[auth/callback] troca de código falhou", code);
  return NextResponse.redirect(`${origin}/entrar?erro=${code}`);
}
