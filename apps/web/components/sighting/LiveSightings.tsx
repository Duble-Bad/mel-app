"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { subscribeToNotifications } from "@mel/data";
import { getBrowserClient } from "@/lib/supabase/browser";

const VISIBLE_MS = 8000;

/** Para o tutor: novo avistamento chega → avisa na tela e atualiza linha do tempo e mapa. */
export function LiveSightings({ userId, code }: { userId: string; code: string }) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(
    () =>
      subscribeToNotifications(getBrowserClient(), userId, (n) => {
        if (!n.href.startsWith(`/alerta/${code}`)) return;
        setMessage(`${n.title}. ${n.body}`);
        router.refresh();
        // Some sozinho: um aviso fixo cobriria a página (e botões) no celular.
        clearTimeout(timer.current);
        timer.current = setTimeout(() => setMessage(null), VISIBLE_MS);
      }),
    [userId, code, router],
  );
  useEffect(() => () => clearTimeout(timer.current), []);

  if (!message) return null;
  return (
    <div role="status" className="fixed inset-x-4 bottom-4 z-30 mx-auto max-w-md rounded-lg bg-status-sighting-solid p-4 text-text-inverse shadow-card">
      <p className="font-bold">{message}</p>
      <div className="mt-1 flex gap-4">
        <a href="#linha-do-tempo" onClick={() => setMessage(null)} className="min-h-10 text-sm font-semibold underline">
          Ver na linha do tempo
        </a>
        <button type="button" onClick={() => setMessage(null)} className="min-h-10 text-sm font-semibold underline">
          Fechar
        </button>
      </div>
    </div>
  );
}
