"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { credentialsSchema, fieldErrors, needsOnboarding, safeNextPath } from "@mel/core";
import { getMyProfile, signInWithGoogle, signInWithPassword, signUpWithPassword } from "@mel/data";
import { getBrowserClient } from "@/lib/supabase/browser";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/Field";

type Mode = "signin" | "signup";

// Google só aparece depois de configurado no Supabase (ver README).
const GOOGLE_ENABLED = process.env.NEXT_PUBLIC_AUTH_GOOGLE === "on";

export function SignInForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNextPath(params.get("next"));

  const [mode, setMode] = useState<Mode>("signin");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(
    params.get("erro") === "link" ? "Esse link expirou ou já foi usado. Entre de novo ou peça um novo link." : null,
  );
  const [pending, setPending] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    const form = new FormData(event.currentTarget);
    const parsed = credentialsSchema.safeParse({ email: form.get("email"), password: form.get("password") });
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      return;
    }
    setErrors({});
    setPending(true);
    try {
      const supabase = getBrowserClient();
      if (mode === "signin") await signInWithPassword(supabase, parsed.data);
      else await signUpWithPassword(supabase, parsed.data);

      const profile = await getMyProfile(supabase);
      const destination = needsOnboarding(profile) ? `/onboarding?next=${encodeURIComponent(next)}` : next;
      router.replace(destination);
      router.refresh();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Não deu certo agora. Tente novamente.");
      setPending(false);
    }
  }

  async function handleGoogle() {
    setFormError(null);
    setPending(true);
    try {
      const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;
      await signInWithGoogle(getBrowserClient(), redirectTo);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Não deu certo agora. Tente novamente.");
      setPending(false);
    }
  }

  const isSignup = mode === "signup";

  return (
    <div className="flex flex-col gap-6">
      {GOOGLE_ENABLED && (
        <>
          <Button variant="secondary" onClick={handleGoogle} disabled={pending}>
            Continuar com Google
          </Button>
          <p className="text-center text-sm text-text-secondary">ou use seu e-mail</p>
        </>
      )}

      <div role="tablist" aria-label="Tenho conta ou sou novo" className="grid grid-cols-2 rounded-md bg-surface-muted p-1">
        {(["signin", "signup"] as const).map((m) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={mode === m}
            onClick={() => {
              setMode(m);
              setFormError(null);
            }}
            className={`min-h-12 rounded-sm font-semibold ${mode === m ? "bg-surface shadow-card" : "text-text-secondary"}`}
          >
            {m === "signin" ? "Já tenho conta" : "Criar conta"}
          </button>
        ))}
      </div>

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
          error={errors.email}
        />

        <div className="flex flex-col gap-2">
          <TextField
            label="Senha"
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete={isSignup ? "new-password" : "current-password"}
            hint={isSignup ? "Pelo menos 8 caracteres." : undefined}
            required
            error={errors.password}
          />
          <label className="flex min-h-11 items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={showPassword}
              onChange={(e) => setShowPassword(e.target.checked)}
              className="size-5 accent-brand-primary"
            />
            Mostrar senha
          </label>
        </div>

        <Button type="submit" loading={pending} loadingText={isSignup ? "Criando sua conta…" : "Entrando…"}>
          {isSignup ? "Criar conta" : "Entrar"}
        </Button>
      </form>

      {!isSignup && (
        <Link href="/entrar/recuperar" className="text-center font-semibold text-brand-primary underline-offset-4 hover:underline">
          Esqueci minha senha
        </Link>
      )}
    </div>
  );
}
