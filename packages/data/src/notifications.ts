import { DataError, type MelClient } from "./client";

export interface AppNotification {
  id: string;
  kind: "sighting_new" | "message_new";
  /** Texto pronto para exibir. */
  title: string;
  body: string;
  href: string;
  readAt: string | null;
  createdAt: string;
}

interface Row {
  id: string;
  kind: string;
  payload: Record<string, unknown>;
  read_at: string | null;
  created_at: string;
}

/** Converte a notificação do banco em texto humano. */
export function toAppNotification(row: Row): AppNotification {
  const p = row.payload as {
    code?: string;
    pet_name?: string;
    place_label?: string | null;
    conversation_id?: string;
    to_owner?: boolean;
    count?: number;
  };
  const pet = p.pet_name ?? "seu pet";
  if (row.kind === "message_new") {
    const count = p.count ?? 1;
    return {
      id: row.id,
      kind: "message_new",
      title: p.to_owner ? `💬 Mensagem sobre ${pet}` : `💬 O tutor de ${pet} respondeu`,
      body: count > 1 ? `${count} mensagens novas. Toque para responder.` : "Toque para ver e responder.",
      href: `/conversas/${p.conversation_id}`,
      readAt: row.read_at,
      createdAt: row.created_at,
    };
  }
  return {
    id: row.id,
    kind: "sighting_new",
    title: `🟡 Novo avistamento de ${pet}`,
    body: p.place_label ? `Visto perto de ${p.place_label}.` : "Alguém viu seu pet. Confira no mapa.",
    href: `/alerta/${p.code}#linha-do-tempo`,
    readAt: row.read_at,
    createdAt: row.created_at,
  };
}

export async function listNotifications(client: MelClient, userId: string, limit = 30): Promise<AppNotification[]> {
  const { data, error } = await client
    .from("notifications")
    .select("id, kind, payload, read_at, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new DataError(error.message, error.code);
  return (data as Row[]).map(toAppNotification);
}

export async function countUnreadNotifications(client: MelClient, userId: string): Promise<number> {
  const { count, error } = await client
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .is("read_at", null);
  if (error) throw new DataError(error.message, error.code);
  return count ?? 0;
}

export async function markAllNotificationsRead(client: MelClient, userId: string): Promise<void> {
  const { error } = await client
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", userId)
    .is("read_at", null);
  if (error) throw new DataError(error.message, error.code);
}

/** Avisa em tempo real quando chega uma notificação nova (Supabase Realtime + RLS). */
export function subscribeToNotifications(client: MelClient, userId: string, onNew: (n: AppNotification) => void) {
  const channel = client
    // Nome único por assinatura: duas telas ouvindo o mesmo usuário (sininho e
    // página do alerta) com o mesmo nome reaproveitariam o canal já assinado e
    // a biblioteca lança erro ao adicionar outra escuta.
    .channel(`notifications:${userId}:${crypto.randomUUID()}`)
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
      (msg) => onNew(toAppNotification(msg.new as Row)),
    );
  // O Realtime aplica RLS: precisa do token da sessão ANTES de assinar, senão
  // conecta como visitante e o banco (corretamente) não entrega nada.
  void client.realtime
    .setAuth()
    .then(() => channel.subscribe())
    .catch((err: unknown) => console.error("[notifications] tempo real indisponível", err));
  return () => {
    void client.removeChannel(channel);
  };
}
