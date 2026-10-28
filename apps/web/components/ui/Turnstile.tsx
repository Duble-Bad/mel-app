"use client";

import { useCallback, useEffect, useRef, useState } from "react";

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opts: Record<string, unknown>) => string;
      reset: (id?: string) => void;
      remove: (id: string) => void;
    };
  }
}

const SCRIPT = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

function loadScript(): Promise<void> {
  if (window.turnstile) return Promise.resolve();
  const existing = document.querySelector<HTMLScriptElement>(`script[src="${SCRIPT}"]`);
  return new Promise((resolve, reject) => {
    const script = existing ?? Object.assign(document.createElement("script"), { src: SCRIPT, async: true });
    script.addEventListener("load", () => resolve());
    script.addEventListener("error", () => reject(new Error("Não foi possível carregar a verificação antirrobô.")));
    if (!existing) document.head.appendChild(script);
  });
}

/**
 * Verificação antirrobô do Cloudflare (geralmente invisível para pessoas).
 * Entrega o token via onToken; o servidor confere antes de gravar.
 */
export function Turnstile({ onToken, onError }: { onToken: (token: string | null) => void; onError: (msg: string) => void }) {
  const el = useRef<HTMLDivElement>(null);
  const cb = useRef({ onToken, onError });
  useEffect(() => {
    cb.current = { onToken, onError };
  });

  useEffect(() => {
    const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
    if (!siteKey) {
      cb.current.onError("Envio temporariamente indisponível (verificação antirrobô não configurada).");
      return;
    }
    let widgetId: string | undefined;
    let cancelled = false;
    loadScript()
      .then(() => {
        if (cancelled || !el.current || !window.turnstile) return;
        widgetId = window.turnstile.render(el.current, {
          sitekey: siteKey,
          language: "pt-br",
          appearance: "interaction-only",
          callback: (token: string) => cb.current.onToken(token),
          "expired-callback": () => cb.current.onToken(null),
          "error-callback": () => cb.current.onError("A verificação antirrobô falhou. Recarregue a página e tente de novo."),
        });
      })
      .catch((err: Error) => cb.current.onError(err.message));
    return () => {
      cancelled = true;
      if (widgetId) window.turnstile?.remove(widgetId);
    };
  }, []);

  return <div ref={el} data-testid="turnstile" />;
}

/**
 * Estado do token para formulários com <Turnstile>. O token é de uso único:
 * `reset()` remonta o widget (via `key`) para a próxima tentativa.
 */
export function useCaptchaToken() {
  const [token, setTokenState] = useState<string | null>(null);
  const tokenRef = useRef<string | null>(null);
  const [key, setKey] = useState(0);
  const setToken = useCallback((t: string | null) => {
    tokenRef.current = t;
    setTokenState(t);
  }, []);
  /** A verificação antirrobô costuma levar 1–2 s: espera por ela em vez de dar erro. */
  const waitForToken = useCallback(async (timeoutMs = 15_000): Promise<string | null> => {
    const started = Date.now();
    while (!tokenRef.current && Date.now() - started < timeoutMs) {
      await new Promise((r) => setTimeout(r, 250));
    }
    return tokenRef.current;
  }, []);
  const reset = useCallback(() => {
    setToken(null);
    setKey((k) => k + 1);
  }, [setToken]);
  return { token, setToken, waitForToken, reset, key };
}
