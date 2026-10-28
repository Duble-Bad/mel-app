import Link from "next/link";
import { Suspense } from "react";
import { countUnreadNotifications } from "@mel/data";
import { getCurrentProfile, getSessionUser } from "@/lib/session";
import { createSessionClient } from "@/lib/supabase/server";
import { NotificationBell } from "./NotificationBell";

export function AppHeader() {
  return (
    <header className="border-b border-border bg-surface">
      <div className="mx-auto flex min-h-14 w-full max-w-xl items-center justify-between px-4">
        <Link href="/" className="text-2xl font-extrabold tracking-tight text-brand-primary" aria-label="MEL — início">
          MEL
        </Link>
        <Suspense fallback={<span className="min-h-12" aria-hidden="true" />}>
          <HeaderAccount />
        </Suspense>
      </div>
    </header>
  );
}

const linkClass =
  "inline-flex min-h-12 items-center rounded-md px-3 font-semibold text-brand-primary hover:bg-surface-muted";

async function HeaderAccount() {
  const user = await getSessionUser();
  if (!user || user.isAnonymous) {
    return (
      <Link href="/entrar" className={linkClass}>
        Entrar
      </Link>
    );
  }
  const [profile, unread] = await Promise.all([
    getCurrentProfile(),
    createSessionClient()
      .then((client) => countUnreadNotifications(client, user.id))
      .catch(() => 0),
  ]);
  const firstName = profile?.displayName?.split(" ")[0];
  return (
    <div className="flex items-center gap-1">
      <NotificationBell userId={user.id} initialUnread={unread} />
      <Link href="/perfil" className={linkClass}>
        {firstName ? `Olá, ${firstName}` : "Meu perfil"}
      </Link>
    </div>
  );
}
