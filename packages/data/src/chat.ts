import type { ChatMessage, Conversation, LostStatus, ReportInput } from "@mel/core";
import { DataError, type MelClient } from "./client";

interface ConversationJson {
  id: string;
  context?: "lost" | "adoption";
  code: string;
  case_status: LostStatus;
  pet_name: string;
  pet_thumb_path: string | null;
  my_role: "owner" | "helper";
  peer_id: string;
  peer_name: string | null;
  peer_is_anonymous: boolean;
  from_sighting: boolean;
  from_found?: boolean;
  blocked_by_me: boolean;
  can_send: boolean;
  created_at: string;
  last_message: { body: string; created_at: string; mine: boolean } | null;
  unread: number;
}

interface MessageRow {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  created_at: string;
}

// Mensagens das funções/triggers do banco (limites, bloqueio, alerta encerrado) já são humanas.
function fail(error: { message: string; code?: string }): never {
  throw new DataError(error.message, error.code);
}

const thumbUrl = (client: MelClient, path: string) => client.storage.from("pet-photos").getPublicUrl(path).data.publicUrl;

function toConversation(client: MelClient, c: ConversationJson): Conversation {
  return {
    id: c.id,
    context: c.context ?? "lost",
    code: c.code,
    caseStatus: c.case_status,
    petName: c.pet_name,
    petThumbUrl: c.pet_thumb_path ? thumbUrl(client, c.pet_thumb_path) : null,
    myRole: c.my_role,
    peerId: c.peer_id,
    peerName: c.peer_name || null,
    peerIsAnonymous: c.peer_is_anonymous,
    fromSighting: c.from_sighting,
    fromFound: c.from_found === true,
    blockedByMe: c.blocked_by_me,
    canSend: c.can_send,
    createdAt: c.created_at,
    lastMessage: c.last_message
      ? { body: c.last_message.body, createdAt: c.last_message.created_at, mine: c.last_message.mine }
      : null,
    unread: c.unread,
  };
}

export const toChatMessage = (m: MessageRow): ChatMessage => ({
  id: m.id,
  conversationId: m.conversation_id,
  senderId: m.sender_id,
  body: m.body,
  createdAt: m.created_at,
});

/** Quem quer ajudar abre (ou retoma) a conversa com o tutor, já com a 1ª mensagem. */
export async function startConversation(client: MelClient, code: string, body: string): Promise<string> {
  const { data, error } = await client.rpc("start_conversation", { p_code: code, p_body: body });
  if (error) fail(error);
  return data as string;
}

/** Tutor responde a quem enviou um avistamento. */
export async function openConversationFromSighting(client: MelClient, sightingId: string): Promise<string> {
  const { data, error } = await client.rpc("open_conversation_from_sighting", { p_sighting_id: sightingId });
  if (error) fail(error);
  return data as string;
}

export async function listMyConversations(client: MelClient): Promise<Conversation[]> {
  const { data, error } = await client.rpc("get_my_conversations");
  if (error) fail(error);
  return ((data as unknown as ConversationJson[]) ?? []).map((c) => toConversation(client, c));
}

/** null quando não existe ou a pessoa não participa. */
export async function getConversation(client: MelClient, id: string): Promise<Conversation | null> {
  const { data, error } = await client.rpc("get_conversation", { p_id: id });
  if (error) fail(error);
  return data ? toConversation(client, data as unknown as ConversationJson) : null;
}

export async function myConversationForCase(client: MelClient, code: string): Promise<string | null> {
  const { data, error } = await client.rpc("my_conversation_for_case", { p_code: code });
  if (error) fail(error);
  return (data as string | null) ?? null;
}

export async function listMessages(client: MelClient, conversationId: string, limit = 200): Promise<ChatMessage[]> {
  const { data, error } = await client
    .from("messages")
    .select("id, conversation_id, sender_id, body, created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) fail(error);
  return (data as MessageRow[]).map(toChatMessage).reverse();
}

export async function sendMessage(client: MelClient, conversationId: string, senderId: string, body: string): Promise<ChatMessage> {
  const { data, error } = await client
    .from("messages")
    .insert({ conversation_id: conversationId, sender_id: senderId, body })
    .select("id, conversation_id, sender_id, body, created_at")
    .single();
  if (error) fail(error);
  return toChatMessage(data as MessageRow);
}

export async function markConversationRead(client: MelClient, conversationId: string): Promise<void> {
  const { error } = await client.rpc("mark_conversation_read", { p_id: conversationId });
  if (error) fail(error);
}

export async function setConversationBlocked(client: MelClient, conversationId: string, blocked: boolean): Promise<void> {
  const { error } = await client.rpc("set_conversation_block", { p_id: conversationId, p_blocked: blocked });
  if (error) fail(error);
}

export async function reportConversation(client: MelClient, conversationId: string, input: ReportInput): Promise<string> {
  const { data, error } = await client.rpc("report_conversation", {
    p_id: conversationId,
    p_reason: input.reason,
    p_details: input.details ?? undefined,
    p_block: input.block,
  });
  if (error) fail(error);
  return data as string;
}

/**
 * Mensagens novas em tempo real. Sem `conversationId`, recebe as de todas as
 * conversas da pessoa (o RLS do Realtime só entrega as que ela pode ler).
 */
export function subscribeToMessages(client: MelClient, conversationId: string | null, onNew: (m: ChatMessage) => void) {
  const channel = client.channel(`messages:${conversationId ?? "all"}:${crypto.randomUUID()}`).on(
    "postgres_changes",
    {
      event: "INSERT",
      schema: "public",
      table: "messages",
      ...(conversationId ? { filter: `conversation_id=eq.${conversationId}` } : {}),
    },
    (msg) => onNew(toChatMessage(msg.new as MessageRow)),
  );
  // Token antes de assinar: sem ele o Realtime conecta como visitante (ver notifications.ts).
  void client.realtime
    .setAuth()
    .then(() => channel.subscribe())
    .catch((err: unknown) => console.error("[chat] tempo real indisponível", err));
  return () => {
    void client.removeChannel(channel);
  };
}
