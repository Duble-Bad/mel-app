"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";
import { authReturnMessage, credentialsSchema, fieldErrors, needsOnboarding, safeNextPath, signUpSchema } from "@mel/core";
import { getMyProfile, linkGoogleToAnonymous, signInWithGoogle, signInWithPassword, signUpWithPassword } from "@mel/data";
import { getBrowserClient } from "@/lib/supabase/browser";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { PasswordField, TextField } from "@/components/ui/Field";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Divider } from "@/components/ui/Surface";

type Mode = "signin" | "signup";
type FieldName = "displayName" | "email" | "password";

const MODES = [
  { value: "signin", label: "Entrar" },
  { value: "signup", label: "Criar conta" },
] as const;

// Google só aparece depois de configurado no Supabase (ver README).
const GOOGLE_ENABLED = process.env.NEXT_PUBLIC_AUTH_GOOGLE === "on";

/**
 * `anonymous`: há sessão sem cadastro neste aparelho (a pessoa já ajudou).
 * Criar conta (e-mail ou Google) mantém o mesmo usuário e as contribuições;
 * entrar numa conta que já existe troca de usuário e não leva nada junto (sem
 * merge automático).
 */
export function SignInForm({ anonymous = false }: { anonymous?: boolean }) {
  const params = useSearchParams();
  const next = safeNextPath(params.get("next"));
  // Volta de um login social/link que falhou (?erro=…).
  const [returned] = useState(() => authReturnMessage(params.get("erro")));

  const [mode, setMode] = useState<Mode>("signin");
  const [values, setValues] = useState<Record<FieldName, string>>({ displayName: "", email: "", password: "" });
  const [errors, setErrors] = useState<Partial<Record<FieldName, string>>>({});
  // Depois da 1ª tentativa de envio, os erros acompanham a digitação.
  const [submitted, setSubmitted] = useState(false);
  const [formError, setFormError] = useState<string | null>(returned?.message ?? null);
  const [pending, setPending] = useState<"form" | "google" | null>(null);
  // Com "Confirm email" ligado no Supabase, a conta só vale depois do link.
  const [confirmEmailFor, setConfirmEmailFor] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const isSignup = mode === "signup";
  const schema = isSignup ? signUpSchema : credentialsSchema;

  /** Erro de um campo com os valores atuais (undefined = válido). */
  function validate(field: FieldName, all = values): string | undefined {
    const parsed = schema.safeParse(all);
    return parsed.success ? undefined : fieldErrors(parsed.error)[field];
  }

  function change(field: FieldName, value: string) {
    const all = { ...values, [field]: value };
    setValues(all);
    // Só corrige/atualiza um erro que já está na tela; nunca cria erro enquanto a pessoa digita.
    if (errors[field] || submitted) setErrors((e) => ({ ...e, [field]: submitted ? validate(field, all) : undefined }));
  }

  /** Ao sair do campo: valida só se a pessoa escreveu algo (campo vazio não vira vermelho). */
  function blur(field: FieldName) {
    if (!values[field].trim() && !submitted) return;
    setErrors((e) => ({ ...e, [field]: validate(field) }));
  }

  function switchMode(m: Mode) {
    setMode(m);
    setErrors({});
    setSubmitted(false);
    setFormError(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setSubmitted(true);
    const parsed = schema.safeParse(values);
    if (!parsed.success) {
      const errs = fieldErrors(parsed.error) as Partial<Record<FieldName, string>>;
      setErrors(errs);
      const first = (["displayName", "email", "password"] as const).find((f) => errs[f]);
      formRef.current?.querySelector<HTMLInputElement>(`[name="${first}"]`)?.focus();
      return;
    }
    setErrors({});
    setConfirmEmailFor(null);
    setPending("form");
    try {
      const supabase = getBrowserClient();
      if (isSignup) {
        const emailRedirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;
        const result = await signUpWithPassword(supabase, parsed.data, { emailRedirectTo });
        if (!result.hasSession) {
          setConfirmEmailFor(parsed.data.email);
          setPending(null);
          return;
        }
      } else await signInWithPassword(supabase, parsed.data);

      const profile = await getMyProfile(supabase);
      const destination = needsOnboarding(profile) ? `/onboarding?next=${encodeURIComponent(next)}` : next;
      // Navegação completa (não o router do cliente): o Next pode ter guardado
      // em cache, de antes do login, um redirecionamento da página protegida
      // de volta para /entrar — a tela ficaria presa em "Entrando…".
      window.location.assign(destination);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Não deu certo agora. Tente novamente.");
      setPending(null);
    }
  }

  /**
   * "keep" (padrão): anônimo liga o Google ao próprio usuário (linkIdentity) e
   * mantém as contribuições; sem sessão anônima é o login normal.
   * "switch": entrar na conta Google que já existe — troca de usuário, nada é
   * transferido (só oferecido depois do aviso de identity_already_exists).
   */
  async function handleGoogle(intent: "keep" | "switch" = "keep") {
    setFormError(null);
    setPending("google");
    try {
      const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;
      if (anonymous && intent === "keep") await linkGoogleToAnonymous(getBrowserClient(), redirectTo);
      else await signInWithGoogle(getBrowserClient(), redirectTo);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Não deu certo agora. Tente novamente.");
      setPending(null);
    }
  }

  const offerGoogleSignIn = GOOGLE_ENABLED && returned?.offerGoogleSignIn === true && formError === returned.message;

  return (
    <div className="flex flex-col gap-6">
      {GOOGLE_ENABLED && (
        <>
          <Button variant="secondary" onClick={() => handleGoogle("keep")} disabled={pending !== null} loading={pending === "google"} loadingText="Abrindo o Google…">
            <GoogleIcon />
            {anonymous ? "Manter contribuições com o Google" : "Continuar com Google"}
          </Button>
          <Divider>ou continue com e-mail</Divider>
        </>
      )}

      <SegmentedControl label="Entrar ou criar conta" options={MODES} value={mode} onChange={switchMode} controls="auth-form" />

      <form id="auth-form" ref={formRef} onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
        {formError && <Alert tone="error">{formError}</Alert>}
        {offerGoogleSignIn && (
          <Button variant="secondary" onClick={() => handleGoogle("switch")} disabled={pending !== null}>
            <GoogleIcon />
            Entrar na conta Google existente
          </Button>
        )}
        {confirmEmailFor && (
          <Alert tone="success">
            Enviamos um link para <strong className="break-all">{confirmEmailFor}</strong>. Abra o e-mail para confirmar sua conta e continuar.
          </Alert>
        )}

        {anonymous && !confirmEmailFor && !offerGoogleSignIn && (
          <Alert tone="info">
            {isSignup ? (
              <>
                <strong>Crie sua conta e mantenha suas contribuições.</strong> O que você já enviou sem conta neste aparelho passa a ser da sua conta.
              </>
            ) : (
              <>
                Você já ajudou sem conta neste aparelho. Se entrar numa conta que já existe, o que enviou continua publicado, mas não passa
                para ela. Para manter,{" "}
                <button type="button" onClick={() => switchMode("signup")} className="font-semibold text-link underline underline-offset-2">
                  crie sua conta
                </button>
                .
              </>
            )}
          </Alert>
        )}

        {isSignup && (
          <div className="animate-enter">
            <TextField
              label="Seu nome"
              name="displayName"
              autoComplete="name"
              autoCapitalize="words"
              placeholder="Como podemos te chamar?"
              value={values.displayName}
              onChange={(e) => change("displayName", e.target.value)}
              onBlur={() => blur("displayName")}
              error={errors.displayName}
            />
          </div>
        )}

        <TextField
          label="E-mail"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          placeholder="voce@exemplo.com"
          value={values.email}
          onChange={(e) => change("email", e.target.value)}
          onBlur={() => blur("email")}
          error={errors.email}
        />

        <PasswordField
          label="Senha"
          name="password"
          autoComplete={isSignup ? "new-password" : "current-password"}
          placeholder={isSignup ? "Crie uma senha" : "Sua senha"}
          hint={isSignup ? "Pelo menos 8 caracteres." : undefined}
          value={values.password}
          onChange={(e) => change("password", e.target.value)}
          onBlur={() => blur("password")}
          error={errors.password}
          labelAction={
            !isSignup && (
              <Link href="/entrar/recuperar" className="text-sm font-semibold text-link underline-offset-4 hover:underline">
                Esqueci minha senha
              </Link>
            )
          }
        />

        <Button
          type="submit"
          className="mt-1"
          disabled={pending !== null}
          loading={pending === "form"}
          loadingText={isSignup ? "Criando sua conta…" : "Entrando…"}
        >
          {isSignup ? "Criar conta" : "Entrar"}
        </Button>
      </form>

      {isSignup && (
        <p className="text-center text-xs text-text-secondary">
          Ao continuar, você vai aceitar os{" "}
          <Link href="/termos" target="_blank" className="font-semibold underline underline-offset-2">
            Termos de uso
          </Link>{" "}
          e a{" "}
          <Link href="/privacidade" target="_blank" className="font-semibold underline underline-offset-2">
            Política de privacidade
          </Link>
          .
        </p>
      )}

      <p className="text-center text-sm text-text-secondary">
        {isSignup ? "Já tem conta? " : "Primeira vez na MEL? "}
        <button
          type="button"
          onClick={() => switchMode(isSignup ? "signin" : "signup")}
          className="inline-flex min-h-11 items-center font-semibold text-link underline-offset-4 hover:underline"
        >
          {isSignup ? "Entre aqui" : "Crie sua conta grátis"}
        </button>
      </p>
    </div>
  );
}

/** "G" do Google nas cores oficiais (exigência da marca Google para o botão). */
function GoogleIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5 shrink-0">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1Z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z" />
      <path fill="#FBBC05" d="M5.84 14.1A6.6 6.6 0 0 1 5.5 12c0-.73.13-1.44.34-2.1V7.06H2.18A11 11 0 0 0 1 12c0 1.77.43 3.45 1.18 4.94l3.66-2.84Z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.3 9.14 5.38 12 5.38Z" />
    </svg>
  );
}
