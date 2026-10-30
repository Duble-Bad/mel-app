import { NextResponse, type NextRequest } from "next/server";
import { emailLinkAction, safeErrorCode } from "@mel/core";
import { createSessionClient } from "@/lib/supabase/server";

/**
 * Confirma o link do e-mail (botão de /auth/confirmar): verifica o token no
 * Supabase, grava a sessão nos cookies e segue para um destino interno.
 * Vale em qualquer navegador (não depende do PKCE do cadastro). O token é de
 * uso único: repetir o envio cai em /entrar com "link expirou ou já foi usado".
 */
export async function POST(request: NextRequest) {
  const { origin } = request.nextUrl;
  const form = await request.formData();
  const link = emailLinkAction({ get: (name) => (typeof form.get(name) === "string" ? (form.get(name) as string) : null) });
  // 303: depois de um POST, o navegador segue com GET.
  if (!link.ok) return NextResponse.redirect(`${origin}/entrar?erro=link`, 303);

  const supabase = await createSessionClient();
  const { error } = await supabase.auth.verifyOtp({ type: link.type, token_hash: link.tokenHash });
  if (!error) return NextResponse.redirect(`${origin}${link.next}`, 303);

  const code = safeErrorCode(error.code ?? "link");
  console.error("[auth/confirmar] verificação falhou", code);
  return NextResponse.redirect(`${origin}/entrar?erro=${code}`, 303);
}
