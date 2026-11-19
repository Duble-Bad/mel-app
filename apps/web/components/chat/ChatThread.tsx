"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { type ChatMessage, type Conversation, formatChatTime, mentionsPayment, MESSAGE_MAX, messageBodySchema, PAYMENT_WARNING, peerLabel, userErrorMessage } from "@mel/core";
import { getPeerLastReadAt, markConversationRead, sendMessage, setConversationBlocked, subscribeToMessages } from "@mel/data";
import { motion } from "motion/react";
import { useReducedMotion } from "@/components/ui/motion/useReducedMotion";
import { getBrowserClient } from "@/lib/supabase/browser";
import { Alert } from "@/components/ui/Alert";
import { kickPushDispatch } from "@/lib/push/client";
import { AntiScamNotice } from "./AntiScamNotice";
import { ReportDialog } from "./ReportDialog";
import { HydratedSubmit } from "@/components/ui/HydratedSubmit";

interface ChatThreadProps {
  conversation: Conversation;
  initialMessages: ChatMessage[];
  myId: string;
  iAmAnonymous: boolean;
}

const BLOCKED_MESSAGE = "Esta conversa não aceita novas mensagens.";

/** O mais recente de dois instantes (formatos do banco e do tempo real podem diferir: compara como data). */
const latest = (a: string | null, b: string) => (a && Date.parse(a) >= Date.parse(b) ? a : b);

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
  const reduced = useReducedMotion();
  // Mensagens que já estavam na tela ao abrir não animam; as novas sobem ("Bubble Rise").
  const [initialIds] = useState(() => new Set(initialMessages.map((m) => m.id)));
  // Até quando a outra pessoa leu: "Visto" na minha última mensagem ("Read Receipts").
  const [peerReadAt, setPeerReadAt] = useState<string | null>(null);

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
      if (m.senderId !== myId) {
        if (document.visibilityState === "visible") void markRead();
        // Quem respondeu leu tudo até aqui.
        setPeerReadAt((prev) => latest(prev, m.createdAt));
      }
    });
  }, [c.id, myId, router]);

  // "Visto": consulta leve ao abrir, ao voltar para a aba e a cada 20 s com a aba visível.
  useEffect(() => {
    const client = getBrowserClient();
    let alive = true;
    const refresh = () => {
      if (document.visibilityState !== "visible") return;
      getPeerLastReadAt(client, c.id, myId)
        .then((at) => alive && at && setPeerReadAt((prev) => latest(prev, at)))
        .catch(() => {}); // sem o "Visto", a conversa segue normal
    };
    refresh();
    const timer = window.setInterval(refresh, 20_000);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      alive = false;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [c.id, myId]);

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
      // Conversa de alerta: o banco enfileirou o push de quem recebe; pede o envio.
      if (c.context !== "adoption") kickPushDispatch();
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
  const lastMineId = [...messages].reverse().find((m) => m.senderId === myId)?.id;
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
        <AntiScamNotice canReport />
      </header>

      <div className="flex flex-1 flex-col gap-3 px-4 py-4">
        {messages.length === 0 && <p className="rounded-md bg-surface-muted p-3 text-text-secondary">{emptyHint}</p>}
        <ol aria-label="Mensagens" aria-live="polite" className="flex flex-col gap-3">
          {messages.map((m) => {
            const mine = m.senderId === myId;
            const isNew = !reduced && !initialIds.has(m.id);
            const isLastMine = mine && m.id === lastMineId;
            return (
              <motion.li
                key={m.id}
                data-testid="chat-message"
                className={`flex flex-col ${mine ? "items-end" : "items-start"}`}
                // "Bubble Rise" (ui-motion-prompts, Send 1): a minha sobe do campo e cresce até o lugar; a recebida só entra suave.
                initial={isNew ? (mine ? { opacity: 0, y: 28, scale: 0.92 } : { opacity: 0, y: 10 }) : false}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ type: "spring", stiffness: 380, damping: 28 }}
                style={{ transformOrigin: mine ? "100% 100%" : "0% 100%" }}
              >
                <span className="sr-only">{mine ? "Você" : peer}: </span>
                <p
                  className={`max-w-[85%] rounded-lg px-4 py-2 break-words whitespace-pre-line ${
                    mine ? "rounded-br-sm bg-primary text-primary-foreground" : "rounded-bl-sm border border-border bg-surface"
                  }`}
                >
                  {m.body}
                </p>
                <span className="mt-0.5 inline-flex items-center gap-1 text-xs text-text-secondary">
                  {formatChatTime(m.createdAt)}
                  {isLastMine && <ReadReceipt read={Boolean(peerReadAt && Date.parse(peerReadAt) >= Date.parse(m.createdAt))} reduced={reduced} />}
                </span>
                {!mine && mentionsPayment(m.body, { fromTutor: c.myRole === "helper" && c.context !== "adoption" }) && (
                  <p data-testid="payment-warning" className="mt-1 max-w-[85%] text-sm font-semibold text-status-lost">
                    ⚠️ {PAYMENT_WARNING}
                  </p>
                )}
              </motion.li>
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

      <div className="sticky bottom-[var(--mel-tabbar-h)] border-t border-border bg-surface px-4 py-3">
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
            <HydratedSubmit
              
              disabled={sending || !canSend}
              aria-busy={sending || undefined}
              className="min-h-12 shrink-0 rounded-md bg-primary px-4 font-semibold text-primary-foreground disabled:opacity-60"
            >
              {sending ? "Enviando…" : "Enviar"}
            </HydratedSubmit>
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

/**
 * "Read Receipts" (ui-motion-prompts, Send 2): "Enviada ✓" e, quando a outra
 * pessoa abre a conversa, o segundo ✓ desliza para o lado e os dois ficam na
 * cor da MEL: "Vista ✓✓". O texto também muda (não depende só da cor).
 */
function ReadReceipt({ read, reduced }: { read: boolean; reduced: boolean }) {
  return (
    <span data-testid="read-receipt" data-read={read || undefined} className={`inline-flex items-center gap-0.5 font-semibold transition-colors duration-300 ${read ? "text-primary" : ""}`}>
      <span>{read ? "Vista" : "Enviada"}</span>
      <svg aria-hidden="true" viewBox="0 0 22 12" className="h-3 w-[22px]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <motion.path d="M1 6.5 4.5 10 11 2" initial={reduced ? false : { pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.25 }} />
        {read && (
          <motion.path
            d="M8 10 14.5 2"
            initial={reduced ? false : { pathLength: 0, x: -5, opacity: 0 }}
            animate={{ pathLength: 1, x: 0, opacity: 1 }}
            transition={{ type: "spring", stiffness: 420, damping: 24 }}
          />
        )}
      </svg>
    </span>
  );
}
