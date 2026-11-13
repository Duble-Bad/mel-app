import Link from "next/link";
import { Suspense } from "react";
import { MessageCircle } from "lucide-react";
import { countUnreadNotifications } from "@mel/data";
import { getCurrentProfile, getSessionUser } from "@/lib/session";
import { createSessionClient } from "@/lib/supabase/server";
import { MelLogo } from "@/components/brand/MelLogo";
import { DesktopNav, DesktopNavList, MobileNav } from "./MainNav";
import { NotificationBell } from "./NotificationBell";

export function AppHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur-md supports-[backdrop-filter]:bg-background/75">
      <div className="flex h-16 mel-container items-center justify-between gap-2 sm:gap-4">
        <Link href="/" className="-ml-1 shrink-0 rounded-md p-1" aria-label="MEL — início">
          <MelLogo size={32} accent />
        </Link>
        <Suspense fallback={<DesktopNavList pathname="" />}>
          <DesktopNav />
        </Suspense>
        <div className="flex min-w-0 items-center gap-1 *:shrink-0 sm:gap-2">
          <Suspense fallback={<span className="min-h-11" aria-hidden="true" />}>
            <HeaderAccount />
          </Suspense>
        </div>
      </div>
    </header>
  );
}

const pill = "inline-flex min-h-11 items-center justify-center rounded-full px-5 font-bold transition-[background-color,transform] duration-200 active:scale-[.97]";
const ghostPill = `${pill} border border-border-strong text-text-primary hover:bg-surface-muted`;
const goldPill = `${pill} bg-primary text-primary-foreground shadow-primary hover:bg-primary-hover`;
const iconLink = "inline-flex size-11 items-center justify-center rounded-md text-text-primary hover:bg-surface-muted";

async function HeaderAccount() {
  const user = await getSessionUser();
  if (!user) {
    return (
      <>
        <Link href="/entrar" className={ghostPill}>
          Entrar
        </Link>
        <Link href="/entrar?criar=1" className={`${goldPill} max-sm:hidden`}>
          Criar conta
        </Link>
        <MobileNav
          account={
            <Link href="/entrar?criar=1" className={`${goldPill} min-h-12 w-full`}>
              Criar conta gratuitamente
            </Link>
          }
        />
      </>
    );
  }
  // Sessão anônima (enviou avistamento ou mensagem sem cadastro) também recebe respostas.
  const [profile, unread] = await Promise.all([
    user.isAnonymous ? null : getCurrentProfile(),
    createSessionClient()
      .then((client) => countUnreadNotifications(client, user.id))
      .catch(() => 0),
  ]);
  const firstName = profile?.displayName?.split(" ")[0];
  const accountLink = user.isAnonymous ? (
    <Link href="/entrar" className={ghostPill}>
      Entrar
    </Link>
  ) : (
    <Link href="/perfil" className={`${ghostPill} !block min-w-0 !shrink max-w-28 truncate px-3.5 leading-[42px] sm:max-w-40 sm:px-5`}>
      {firstName ? (
        <>
          {/* Celular estreito: só o nome, para caber ao lado dos ícones. */}
          <span className="max-[400px]:hidden">Olá, </span>
          {firstName}
        </>
      ) : (
        "Meu perfil"
      )}
    </Link>
  );
  return (
    <>
      <NotificationBell userId={user.id} initialUnread={unread} />
      <Link href="/conversas" aria-label="Conversas" className={iconLink}>
        <MessageCircle aria-hidden="true" className="size-5" strokeWidth={2} />
      </Link>
      {accountLink}
      <MobileNav />
    </>
  );
}
