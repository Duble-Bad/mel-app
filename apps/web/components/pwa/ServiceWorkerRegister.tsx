"use client";

import { useEffect } from "react";

/** Registra o service worker (página offline + push). Só em produção: no dev ele atrapalharia o recarregamento. */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch((err) => console.warn("[sw] registro falhou", err));
  }, []);
  return null;
}
