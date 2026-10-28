import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { timeAgo } from "@mel/core";
import { listNotifications } from "@mel/data";
import { getSessionUser } from "@/lib/session";
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
  // Sessões anônimas também: quem enviou avistamento/mensagem sem cadastro recebe respostas.
  const user = await getSessionUser();
  if (!user) redirect("/entrar?next=%2Fnotificacoes");
  let items;
  try {
    items = await listNotifications(await createSessionClient(), user.id);
  } catch (error) {
    console.error("[notificacoes] falha", error);
    return <ErrorState>Não conseguimos carregar suas notificações agora. Atualize a página.</ErrorState>;
  }
  if (items.length === 0) {
    return <EmptyState title="Nada por aqui ainda">Avistamentos do seu pet e mensagens novas aparecem aqui na hora.</EmptyState>;
  }
  return (
    <>
      <MarkNotificationsRead userId={user.id} hasUnread={items.some((n) => !n.readAt)} />
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
