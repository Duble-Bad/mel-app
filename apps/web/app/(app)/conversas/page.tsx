import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { formatChatTime, peerLabel } from "@mel/core";
import { listMyConversations } from "@mel/data";
import { getSessionUser } from "@/lib/session";
import { createSessionClient } from "@/lib/supabase/server";
import { LiveConversations } from "@/components/chat/LiveConversations";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/States";

export const metadata: Metadata = { title: "Conversas", robots: { index: false } };

export default function ConversationsPage() {
  return (
    <main className="mx-auto w-full max-w-md flex-1 px-4 pt-6 pb-10">
      <h1 className="mb-6 text-2xl font-bold">Conversas</h1>
      <Suspense fallback={<LoadingState />}>
        <Content />
      </Suspense>
    </main>
  );
}

async function Content() {
  const user = await getSessionUser();
  if (!user) redirect("/entrar?next=%2Fconversas");
  let items;
  try {
    items = await listMyConversations(await createSessionClient());
  } catch (error) {
    console.error("[conversas] falha", error);
    return <ErrorState>Não conseguimos carregar suas conversas agora. Atualize a página.</ErrorState>;
  }
  if (items.length === 0) {
    return (
      <>
        <LiveConversations />
        <EmptyState title="Nenhuma conversa ainda">
          Quando você falar com o tutor de um pet perdido — ou alguém escrever sobre o seu alerta — a conversa aparece aqui.
        </EmptyState>
      </>
    );
  }
  return (
    <>
      <LiveConversations />
      <ul className="flex flex-col gap-3">
        {items.map((c) => (
          <li key={c.id}>
            <Link
              href={`/conversas/${c.id}`}
              data-testid="conversation-item"
              className={`flex items-center gap-3 rounded-lg border p-3 ${c.unread ? "border-brand-primary bg-brand-secondary" : "border-border bg-surface"}`}
            >
              {c.petThumbUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- miniatura já otimizada
                <img src={c.petThumbUrl} alt="" className="size-12 shrink-0 rounded-full object-cover" />
              ) : (
                <span aria-hidden="true" className="flex size-12 shrink-0 items-center justify-center rounded-full bg-surface-muted text-xl">
                  🐾
                </span>
              )}
              <div className="min-w-0 flex-1">
                <p className="flex items-baseline justify-between gap-2">
                  <span className="truncate font-bold">{peerLabel(c)}</span>
                  {c.lastMessage && <span className="shrink-0 text-xs text-text-secondary">{formatChatTime(c.lastMessage.createdAt)}</span>}
                </p>
                <p className="text-sm text-text-secondary">Sobre {c.petName}</p>
                <p className="truncate text-sm">
                  {c.lastMessage ? `${c.lastMessage.mine ? "Você: " : ""}${c.lastMessage.body}` : "Nenhuma mensagem ainda"}
                </p>
              </div>
              {c.unread > 0 && (
                <span className="flex min-w-6 shrink-0 items-center justify-center rounded-full bg-status-lost px-1.5 text-sm font-bold text-text-inverse">
                  {c.unread}
                  <span className="sr-only"> não lida{c.unread > 1 ? "s" : ""}</span>
                </span>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
