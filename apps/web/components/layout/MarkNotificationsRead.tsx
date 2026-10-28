"use client";

import { useEffect } from "react";
import { markAllNotificationsRead } from "@mel/data";
import { getBrowserClient } from "@/lib/supabase/browser";

/** Ao abrir a central, marca tudo como lido (o destaque visual continua nesta visita). */
export function MarkNotificationsRead({ userId, hasUnread }: { userId: string; hasUnread: boolean }) {
  useEffect(() => {
    if (!hasUnread) return;
    markAllNotificationsRead(getBrowserClient(), userId).catch((err) =>
      console.error("[notificacoes] não foi possível marcar como lidas", err),
    );
  }, [userId, hasUnread]);
  return null;
}
