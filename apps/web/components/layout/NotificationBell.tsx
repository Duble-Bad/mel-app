"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { subscribeToNotifications } from "@mel/data";
import { getBrowserClient } from "@/lib/supabase/browser";

/** Sininho com contador de não lidas, atualizado em tempo real. */
export function NotificationBell({ userId, initialUnread }: { userId: string; initialUnread: number }) {
  const [unread, setUnread] = useState(initialUnread);
  useEffect(() => subscribeToNotifications(getBrowserClient(), userId, (_n, { grouped }) => {
        if (!grouped) setUnread((n) => n + 1);
      }), [userId]);

  const label = unread > 0 ? `Notificações: ${unread} não lida${unread > 1 ? "s" : ""}` : "Notificações";
  return (
    <Link
      href="/notificacoes"
      aria-label={label}
      className="relative inline-flex size-11 items-center justify-center rounded-md text-text-primary hover:bg-surface-muted"
    >
      <Bell aria-hidden="true" className="size-5" strokeWidth={2} />
      {unread > 0 && (
        <span
          aria-hidden="true"
          data-testid="unread-count"
          className="absolute top-1 right-1 flex min-w-5 items-center justify-center rounded-full bg-status-lost-solid px-1 text-xs font-bold text-text-inverse"
        >
          {unread > 9 ? "9+" : unread}
        </span>
      )}
    </Link>
  );
}
