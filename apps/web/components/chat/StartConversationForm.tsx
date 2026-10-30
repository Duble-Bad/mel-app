"use client";

import { useState } from "react";
import { MESSAGE_MAX, messageBodySchema, userErrorMessage, UserFacingError } from "@mel/core";
import { ensureSession } from "@mel/data";
import { getBrowserClient } from "@/lib/supabase/browser";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Turnstile, useCaptchaToken } from "@/components/ui/Turnstile";

/** 1ª mensagem para o tutor. Sem cadastro: sessão anônima + captcha. */
export function StartConversationForm({ code, petName, needsCaptcha }: { code: string; petName: string; needsCaptcha: boolean }) {
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const captcha = useCaptchaToken();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const parsed = messageBodySchema.safeParse(body);
    if (!parsed.success) {
      setError(parsed.error.issues[0]!.message);
      return;
    }
    let turnstileToken: string | null = null;
    if (needsCaptcha) {
      setBusy("Confirmando que você não é um robô…");
      turnstileToken = await captcha.waitForToken();
      if (!turnstileToken) {
        setBusy(null);
        setError("Não conseguimos confirmar que você não é um robô. Verifique a conexão e toque em enviar de novo.");
        captcha.reset();
        return;
      }
    }
    setBusy("Enviando…");
    try {
      await ensureSession(getBrowserClient());
      const res = await fetch("/api/conversas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, body: parsed.data, turnstileToken }),
      });
      const data = (await res.json().catch(() => ({}))) as { id?: string; error?: string };
      if (!res.ok || !data.id) throw new UserFacingError(data.error ?? "Não conseguimos enviar agora. Tente de novo.");
      // Navegação completa: a sessão pode ter acabado de ser criada (anônima), e o
      // cabeçalho/telas pré-carregadas antes dela ficariam desatualizados.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- intencional, ver acima
      window.location.assign(`/conversas/${data.id}`);
    } catch (err) {
      setError(userErrorMessage(err, "Não conseguimos enviar agora. Tente de novo."));
      if (needsCaptcha) captcha.reset();
      setBusy(null);
    }
  }

  return (
    <form noValidate onSubmit={submit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="first-message" className="font-semibold">
          Sua mensagem
        </label>
        <textarea
          id="first-message"
          rows={5}
          maxLength={MESSAGE_MAX}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder={`Ex.: Acho que vi ${petName} hoje à tarde perto do mercado.`}
          aria-describedby={error ? "first-message-error" : undefined}
          aria-invalid={Boolean(error) || undefined}
          className="block w-full rounded-md border-2 border-border-strong bg-surface px-4 py-3 focus:border-focus focus:outline-none"
        />
      </div>
      {error && (
        <div id="first-message-error">
          <Alert tone="error">{error}</Alert>
        </div>
      )}
      {needsCaptcha && (
        <div data-testid="captcha-state" data-state={captcha.token ? "ok" : "pending"}>
          <Turnstile key={captcha.key} onToken={captcha.setToken} onError={setError} />
        </div>
      )}
      <Button type="submit" loading={Boolean(busy)} loadingText={busy}>
        Enviar mensagem
      </Button>
      <p className="text-center text-sm text-text-secondary">
        Seu telefone e o do tutor não aparecem.{needsCaptcha && " Não precisa criar conta."}
      </p>
    </form>
  );
}
