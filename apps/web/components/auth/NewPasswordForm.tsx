"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { passwordSchema } from "@mel/core";
import { updatePassword } from "@mel/data";
import { getBrowserClient } from "@/lib/supabase/browser";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/Field";

export function NewPasswordForm() {
  const router = useRouter();
  const [error, setError] = useState<string | undefined>();
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    const form = new FormData(event.currentTarget);
    const parsed = passwordSchema.safeParse(form.get("password"));
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message);
      return;
    }
    if (form.get("confirm") !== parsed.data) {
      setError("As duas senhas precisam ser iguais.");
      return;
    }
    setError(undefined);
    setPending(true);
    try {
      await updatePassword(getBrowserClient(), parsed.data);
      router.replace("/perfil");
      router.refresh();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Não deu certo agora. Tente novamente.");
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
      {formError && <Alert tone="error">{formError}</Alert>}
      <TextField label="Nova senha" name="password" type="password" autoComplete="new-password" required error={error} />
      <TextField label="Repita a nova senha" name="confirm" type="password" autoComplete="new-password" required />
      <Button type="submit" loading={pending} loadingText="Salvando…">
        Salvar senha
      </Button>
    </form>
  );
}
