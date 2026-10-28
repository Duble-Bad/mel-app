import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { getConversation, listMessages } from "@mel/data";
import { getSessionUser } from "@/lib/session";
import { createSessionClient } from "@/lib/supabase/server";
import { ChatThread } from "@/components/chat/ChatThread";
import { LoadingState } from "@/components/ui/States";

export const metadata: Metadata = { title: "Conversa", robots: { index: false } };

const isUuid = (id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

export default function ConversationPage({ params }: PageProps<"/conversas/[id]">) {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col">
      <Suspense fallback={<div className="px-4 pt-6"><LoadingState label="Carregando conversa…" /></div>}>
        {params.then(({ id }) => <Content id={id} />)}
      </Suspense>
    </main>
  );
}

async function Content({ id }: { id: string }) {
  const user = await getSessionUser();
  if (!user) redirect(`/entrar?next=${encodeURIComponent(`/conversas/${id}`)}`);
  if (!isUuid(id)) notFound();
  const supabase = await createSessionClient();
  // RLS: quem não participa recebe null → "não encontrada" (não revela que existe).
  const conversation = await getConversation(supabase, id);
  if (!conversation) notFound();
  const messages = await listMessages(supabase, id);
  return <ChatThread conversation={conversation} initialMessages={messages} myId={user.id} iAmAnonymous={user.isAnonymous} />;
}
