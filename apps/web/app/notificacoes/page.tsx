import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { timeAgo } from "@mel/core";
import { listNotifications } from "@mel/data";
import { requireOnboardedProfile } from "@/lib/session";
import { createSessionClient } from "@/lib/supabase/server";
import { MarkNotificationsRead } from "@/components/layout/MarkNotificationsRead";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/States";

export const metadata: Metadata = { title: "Notificações", robots: { index: false } };

export default function NotificationsPage() {
  return (
    <main className="mx-auto w-full max-w-md flex-1 px-4 pt-6 pb-10">
      <h1 className="mb-6 text-2xl font-bold">Notificações</h1>
      <Suspense fallback={<LoadingState />}>
        <NotificationsContent />
      </Suspense>
    </main>
  );
}

async function NotificationsContent() {
  const profile = await requireOnboardedProfile("/notificacoes");
  let items;
  try {
    items = await listNotifications(await createSessionClient(), profile.id);
  } catch (error) {
    console.error("[notificacoes] falha", error);
    return <ErrorState>Não conseguimos carregar suas notificações agora. Atualize a página.</ErrorState>;
  }
  if (items.length === 0) {
    return <EmptyState title="Nada por aqui ainda">Quando alguém enviar um avistamento do seu pet, você vê aqui na hora.</EmptyState>;
  }
  return (
    <>
      <MarkNotificationsRead userId={profile.id} hasUnread={items.some((n) => !n.readAt)} />
      <ul className="flex flex-col gap-3">
        {items.map((n) => (
          <li key={n.id}>
            <Link
              href={n.href}
              className={`block rounded-lg border p-4 ${n.readAt ? "border-border bg-surface" : "border-status-sighting bg-status-sighting-soft"}`}
            >
              {!n.readAt && <span className="sr-only">Nova: </span>}
              <p className="font-bold">{n.title}</p>
              <p>{n.body}</p>
              <p className="text-sm text-text-secondary">{timeAgo(n.createdAt)}</p>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
