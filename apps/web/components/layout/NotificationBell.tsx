"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { Bell } from "lucide-react";
import { subscribeToNotifications } from "@mel/data";
import { getBrowserClient } from "@/lib/supabase/browser";
import { useReducedMotion } from "@/components/ui/motion/useReducedMotion";

/**
 * Sininho com contador de não lidas, atualizado em tempo real.
 * "Bell Badge" (ui-motion-prompts, Notifications 5): quando chega um aviso com a
 * página aberta, o sino balança e o número "pula". Ao abrir a página, nada se
 * mexe (o número já vem do servidor). Parado com "reduzir movimento".
 */
export function NotificationBell({ userId, initialUnread }: { userId: string; initialUnread: number }) {
  const [unread, setUnread] = useState(initialUnread);
  // Conta quantos avisos chegaram ao vivo: cada um reinicia a animação (key).
  const [arrivals, setArrivals] = useState(0);
  const reduced = useReducedMotion();
  useEffect(
    () =>
      subscribeToNotifications(getBrowserClient(), userId, (_n, { grouped }) => {
        if (grouped) return;
        setUnread((n) => n + 1);
        setArrivals((n) => n + 1);
      }),
    [userId],
  );

  const ring = arrivals > 0 && !reduced;
  const label = unread > 0 ? `Notificações: ${unread} não lida${unread > 1 ? "s" : ""}` : "Notificações";
  return (
    <Link
      href="/notificacoes"
      aria-label={label}
      className="relative inline-flex size-11 items-center justify-center rounded-md text-text-primary hover:bg-surface-muted"
    >
      <motion.span
        key={`bell-${arrivals}`}
        aria-hidden="true"
        className="inline-flex"
        style={{ transformOrigin: "50% 8%" }}
        initial={ring ? undefined : false}
        animate={ring ? { rotate: [0, 18, -14, 10, -6, 3, 0] } : undefined}
        transition={{ duration: 0.9, ease: "easeInOut" }}
      >
        <Bell className="size-5" strokeWidth={2} />
      </motion.span>
      {unread > 0 && (
        <motion.span
          key={`badge-${arrivals}`}
          aria-hidden="true"
          data-testid="unread-count"
          className="absolute top-1 right-1 flex min-w-5 items-center justify-center rounded-full bg-status-lost-solid px-1 text-xs font-bold text-text-inverse"
          initial={ring ? undefined : false}
          animate={ring ? { scale: [0.3, 1.25, 0.92, 1], y: [4, -3, 0, 0] } : undefined}
          transition={{ duration: 0.55, delay: 0.15, ease: "easeOut" }}
        >
          {unread > 9 ? "9+" : unread}
        </motion.span>
      )}
    </Link>
  );
}
