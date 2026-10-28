"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { subscribeToMessages } from "@mel/data";
import { getBrowserClient } from "@/lib/supabase/browser";

/** Lista de conversas: mensagem nova em qualquer conversa → atualiza a lista. */
export function LiveConversations() {
  const router = useRouter();
  useEffect(() => subscribeToMessages(getBrowserClient(), null, () => router.refresh()), [router]);
  return null;
}
