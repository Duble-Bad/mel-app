import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

// Áreas que exigem conta real (não anônima).
const PROTECTED_PREFIXES = ["/perfil", "/onboarding", "/publicar/perdido"];

/**
 * Renova a sessão do Supabase a cada requisição e barra áreas protegidas.
 * É uma checagem otimista; páginas e RLS verificam de novo perto dos dados.
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet, headers) => {
          for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
          for (const [key, value] of Object.entries(headers)) response.headers.set(key, value);
        },
      },
    },
  );

  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  const isRealUser = Boolean(claims?.sub) && claims?.is_anonymous !== true;

  const { pathname, search, searchParams } = request.nextUrl;

  // Falhas de OAuth voltam do Supabase como ?error_code=… em qualquer URL
  // (normalmente a raiz). Nunca deixar passar em silêncio: levar ao /entrar.
  const authError = searchParams.get("error_code") ?? (searchParams.get("error") ? "unknown" : null);
  if (authError && pathname !== "/entrar" && pathname !== "/auth/callback") {
    const url = request.nextUrl.clone();
    url.pathname = "/entrar";
    url.search = `?erro=${encodeURIComponent(authError)}`;
    return NextResponse.redirect(url);
  }

  const isProtected = PROTECTED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  if (isProtected && !isRealUser) {
    const url = request.nextUrl.clone();
    url.pathname = "/entrar";
    url.search = `?next=${encodeURIComponent(pathname + search)}`;
    const redirect = NextResponse.redirect(url);
    for (const cookie of response.cookies.getAll()) redirect.cookies.set(cookie);
    return redirect;
  }

  return response;
}

export const config = {
  // Tudo, exceto arquivos estáticos, imagens e a API de health.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/health|vendor/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
