"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { type ChatMessage, type Conversation, formatChatTime, mentionsPayment, MESSAGE_MAX, messageBodySchema, peerLabel, userErrorMessage } from "@mel/core";
import { markConversationRead, sendMessage, setConversationBlocked, subscribeToMessages } from "@mel/data";
import { getBrowserClient } from "@/lib/supabase/browser";
import { Alert } from "@/components/ui/Alert";
import { AntiScamNotice } from "./AntiScamNotice";
import { ReportDialog } from "./ReportDialog";

interface ChatThreadProps {
  conversation: Conversation;
  initialMessages: ChatMessage[];
  myId: string;
  iAmAnonymous: boolean;
}

const BLOCKED_MESSAGE = "Esta conversa não aceita novas mensagens.";

export function ChatThread({ conversation: c, initialMessages, myId, iAmAnonymous }: ChatThreadProps) {
  const [messages, setMessages] = useState(initialMessages);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [blockedByMe, setBlockedByMe] = useState(c.blockedByMe);
  const [closed, setClosed] = useState(!c.canSend && !c.blockedByMe);
  const [confirmBlock, setConfirmBlock] = useState(false);
  const [blockBusy, setBlockBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const hadUnread = useRef(c.unread > 0);
  const peer = peerLabel(c);

  const append = (m: ChatMessage) => setMessages((list) => (list.some((x) => x.id === m.id) ? list : [...list, m]));

  useEffect(() => {
    const client = getBrowserClient();
    const markRead = () =>
      markConversationRead(client, c.id).catch((err) => console.error("[chat] não foi possível marcar como lida", err));
    void markRead().then(() => {
      // Atualiza o sininho do cabeçalho (a notificação desta conversa foi lida).
      if (hadUnread.current) router.refresh();
      hadUnread.current = false;
    });
    return subscribeToMessages(client, c.id, (m) => {
      append(m);
      if (m.senderId !== myId && document.visibilityState === "visible") void markRead();
    });
  }, [c.id, myId, router]);

  useEffect(() => {
    end.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  async function send(e?: React.FormEvent) {
    e?.preventDefault();
    const parsed = messageBodySchema.safeParse(body);
    if (!parsed.success) {
      setError(parsed.error.issues[0]!.message);
      return;
    }
    setSending(true);
    setError(null);
    try {
      append(await sendMessage(getBrowserClient(), c.id, myId, parsed.data));
      setBody("");
    } catch (err) {
      const message = userErrorMessage(err, "Não conseguimos enviar. Verifique a conexão e tente de novo.");
      if (message === BLOCKED_MESSAGE) setClosed(true);
      else setError(message);
    } finally {
      setSending(false);
    }
  }

  async function toggleBlock(blocked: boolean) {
    setBlockBusy(true);
    setError(null);
    try {
      await setConversationBlocked(getBrowserClient(), c.id, blocked);
      setBlockedByMe(blocked);
      setConfirmBlock(false);
    } catch (err) {
      setError(userErrorMessage(err, "Não conseguimos atualizar. Tente de novo."));
    } finally {
      setBlockBusy(false);
    }
  }

  const canSend = !blockedByMe && !closed;
  const emptyHint =
    c.myRole === "owner"
      ? c.peerIsAnonymous
        ? "Esta pessoa enviou sem cadastro: ela verá sua mensagem quando voltar à MEL no mesmo aparelho."
        : `Escreva para ${peer}.`
      : c.context === "adoption"
        ? `Escreva para quem está doando ${c.petName}.`
        : `Escreva para o tutor de ${c.petName}.`;

  return (
    <div className="flex flex-1 flex-col">
      <header className="sticky top-0 z-10 flex flex-col gap-2 border-b border-border bg-surface px-4 py-3">
        <div className="flex items-center gap-3">
          <Link href="/conversas" aria-label="Voltar para as conversas" className="-ml-2 inline-flex size-11 shrink-0 items-center justify-center rounded-md text-xl hover:bg-surface-muted">
            ←
          </Link>
          {c.petThumbUrl && (
            // eslint-disable-next-line @next/next/no-img-element -- miniatura já otimizada
            <img src={c.petThumbUrl} alt="" className="size-10 shrink-0 rounded-full object-cover" />
          )}
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-lg font-bold">{peer}</h1>
            <Link
              href={c.context === "adoption" ? `/adocao/${c.code}` : `/alerta/${c.code}`}
              className="text-sm font-semibold text-link underline-offset-4 hover:underline"
            >
              {c.context === "adoption" ? `Adoção de ${c.petName}` : `Alerta de ${c.petName}`}
              {c.context === "lost" && c.caseStatus === "FOUND" && " · encontrado ❤️"}
            </Link>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1">
          <ReportDialog conversationId={c.id} onReported={(blocked) => blocked && setBlockedByMe(true)} />
          {blockedByMe ? (
            <button
              type="button"
              disabled={blockBusy}
              onClick={() => toggleBlock(false)}
              className="inline-flex min-h-11 items-center rounded-md px-3 text-sm font-semibold text-link hover:bg-surface-muted"
            >
              Desbloquear
            </button>
          ) : confirmBlock ? (
            <span className="flex flex-wrap items-center gap-1 text-sm">
              <span className="font-semibold">Bloquear {c.myRole === "owner" ? "esta pessoa" : "o tutor"}?</span>
              <button
                type="button"
                disabled={blockBusy}
                onClick={() => toggleBlock(true)}
                className="inline-flex min-h-11 items-center rounded-md bg-danger-solid px-3 font-semibold text-text-inverse"
              >
                Sim, bloquear
              </button>
              <button type="button" onClick={() => setConfirmBlock(false)} className="inline-flex min-h-11 items-center rounded-md px-3 font-semibold">
                Cancelar
              </button>
            </span>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmBlock(true)}
              className="inline-flex min-h-11 items-center gap-1 rounded-md px-3 text-sm font-semibold hover:bg-surface-muted"
            >
              <span aria-hidden="true">⊘</span> Bloquear
            </button>
          )}
        </div>
        <AntiScamNotice />
      </header>

      <div className="flex flex-1 flex-col gap-3 px-4 py-4">
        {messages.length === 0 && <p className="rounded-md bg-surface-muted p-3 text-text-secondary">{emptyHint}</p>}
        <ol aria-label="Mensagens" aria-live="polite" className="flex flex-col gap-3">
          {messages.map((m) => {
            const mine = m.senderId === myId;
            return (
              <li key={m.id} data-testid="chat-message" className={`flex flex-col ${mine ? "items-end" : "items-start"}`}>
                <span className="sr-only">{mine ? "Você" : peer}: </span>
                <p
                  className={`max-w-[85%] rounded-lg px-4 py-2 break-words whitespace-pre-line ${
                    mine ? "rounded-br-sm bg-primary text-primary-foreground" : "rounded-bl-sm border border-border bg-surface"
                  }`}
                >
                  {m.body}
                </p>
                <span className="mt-0.5 text-xs text-text-secondary">{formatChatTime(m.createdAt)}</span>
                {!mine && mentionsPayment(m.body) && (
                  <p data-testid="payment-warning" className="mt-1 max-w-[85%] text-sm font-semibold text-status-lost">
                    ⚠️ Pedido de dinheiro? Nunca pague antes de ver o animal pessoalmente. Se suspeitar, toque em Denunciar.
                  </p>
                )}
              </li>
            );
          })}
        </ol>
        {iAmAnonymous && c.myRole === "helper" && (
          <p className="text-sm text-text-secondary">
            Você está sem cadastro. Para ver as respostas, volte à MEL neste aparelho e toque em 💬 no topo.
          </p>
        )}
        <div ref={end} />
      </div>

      <div className="sticky bottom-0 border-t border-border bg-surface px-4 py-3">
        {blockedByMe ? (
          <p className="text-text-secondary">Você bloqueou esta pessoa. Ela não consegue mais mandar mensagens para você.</p>
        ) : closed ? (
          <p className="text-text-secondary">{BLOCKED_MESSAGE}</p>
        ) : (
          <form noValidate onSubmit={send} className="flex items-end gap-2">
            <label htmlFor="chat-message" className="sr-only">
              Mensagem
            </label>
            <textarea
              id="chat-message"
              rows={2}
              maxLength={MESSAGE_MAX}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) void send();
              }}
              placeholder="Escreva uma mensagem"
              className="block min-h-12 w-full resize-none rounded-md border-2 border-border-strong bg-surface px-3 py-2 focus:border-focus focus:outline-none"
            />
            <button
              type="submit"
              disabled={sending || !canSend}
              aria-busy={sending || undefined}
              className="min-h-12 shrink-0 rounded-md bg-primary px-4 font-semibold text-primary-foreground disabled:opacity-60"
            >
              {sending ? "Enviando…" : "Enviar"}
            </button>
          </form>
        )}
        {error && (
          <div className="mt-2">
            <Alert tone="error">{error}</Alert>
          </div>
        )}
      </div>
    </div>
  );
}
