"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { emailSchema, userErrorMessage } from "@mel/core";
import { requestPasswordReset } from "@mel/data";
import { getBrowserClient } from "@/lib/supabase/browser";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/Field";

export function ResetRequestForm() {
  const [error, setError] = useState<string | undefined>();
  const [formError, setFormError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    const parsed = emailSchema.safeParse(new FormData(event.currentTarget).get("email"));
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message);
      return;
    }
    setError(undefined);
    setPending(true);
    try {
      const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent("/perfil/nova-senha")}`;
      await requestPasswordReset(getBrowserClient(), parsed.data, redirectTo);
      setSentTo(parsed.data);
    } catch (err) {
      setFormError(userErrorMessage(err, "Não deu certo agora. Tente novamente."));
    } finally {
      setPending(false);
    }
  }

  if (sentTo) {
    return (
      <div className="flex flex-col gap-5">
        <Alert tone="success">
          Se existir uma conta com <strong>{sentTo}</strong>, o link chega em alguns minutos. Confira também a caixa de
          spam.
        </Alert>
        <Link href="/entrar" className="font-semibold text-link underline-offset-4 hover:underline">
          Voltar para entrar
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
      {formError && <Alert tone="error">{formError}</Alert>}
      <TextField
        label="E-mail"
        name="email"
        type="email"
        inputMode="email"
        autoComplete="email"
        autoCapitalize="none"
        required
        error={error}
      />
      <Button type="submit" loading={pending} loadingText="Enviando…">
        Enviar link
      </Button>
    </form>
  );
}
