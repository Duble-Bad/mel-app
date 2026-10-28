import { NextResponse, type NextRequest } from "next/server";
import { safeNextPath } from "@mel/core";
import { createSessionClient } from "@/lib/supabase/server";

/** Retorno de login social (Google) e de links de recuperação de senha. */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const next = safeNextPath(searchParams.get("next"));

  const providerError = searchParams.get("error_code") ?? searchParams.get("error");
  if (providerError) {
    console.error("[auth/callback] provedor retornou erro", providerError);
    return NextResponse.redirect(`${origin}/entrar?erro=${encodeURIComponent(providerError)}`);
  }

  if (code) {
    const supabase = await createSessionClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${next}`);
    console.error("[auth/callback] troca de código falhou", error.code);
    return NextResponse.redirect(`${origin}/entrar?erro=${encodeURIComponent(error.code ?? "link")}`);
  }

  return NextResponse.redirect(`${origin}/entrar?erro=link`);
}
