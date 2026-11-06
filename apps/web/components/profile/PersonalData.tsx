"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  CONTACT_FIELD_STATE_LABELS,
  cnpjField,
  cpfField,
  emailField,
  formatCnpjInput,
  formatCpfInput,
  formatPhoneInput,
  type MaskedPersonalData,
  type MaskedValue,
  optionalPhoneField,
  PARTNER_KIND_LABELS,
  userErrorMessage,
} from "@mel/core";
import { signInWithGoogle } from "@mel/data";
import { getBrowserClient } from "@/lib/supabase/browser";
import { CpfReveal } from "@/components/partners/CpfReveal";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { PasswordField, TextField } from "@/components/ui/Field";
import { Card, Divider } from "@/components/ui/Surface";
import { takeCaptchaToken, Turnstile, useCaptchaToken } from "@/components/ui/Turnstile";

type Kind = "cpf" | "cnpj" | "phone" | "email";

/** Corpo enviado a /api/perfil/dados (o valor entra no envio). */
type Target =
  | { campo: "cpf"; parceiro: string }
  | { campo: "cnpj"; parceiro: string }
  | { campo: "telefone_parceiro"; ref: string; tipo: "phone" | "whatsapp" }
  | { campo: "telefone_adocao" }
  | { campo: "telefone_alerta"; ref: string }
  | { campo: "email" };

type SaveResult = { ok: true; message: string } | { ok: false; error: string; field?: string; reauth?: boolean };

const STATUS_LABELS: Record<string, string> = {
  PENDING_REVIEW: "Em análise",
  APPROVED: "Aprovado",
  REJECTED: "Recusado",
  SUSPENDED: "Suspenso",
};

const INPUT: Record<Kind, { format: (v: string) => string; validate: (v: string) => string | null; inputMode: "numeric" | "tel" | "email" | "text"; placeholder: string }> = {
  cpf: { format: formatCpfInput, validate: (v) => issue(cpfField, v), inputMode: "numeric", placeholder: "000.000.000-00" },
  cnpj: { format: formatCnpjInput, validate: (v) => issue(cnpjField, v), inputMode: "text", placeholder: "00.000.000/0000-00" },
  phone: { format: formatPhoneInput, validate: (v) => issue(optionalPhoneField, v), inputMode: "tel", placeholder: "(11) 99999-9999" },
  email: { format: (v) => v, validate: (v) => issue(emailField, v), inputMode: "email", placeholder: "nome@provedor.com.br" },
};

function issue(schema: { safeParse: (v: unknown) => { success: boolean; error?: { issues: { message: string }[] } } }, v: string): string | null {
  const r = schema.safeParse(v);
  return r.success ? null : (r.error?.issues[0]?.message ?? "Confira o valor.");
}

/**
 * Página "Dados pessoais e documentos": tudo chega MASCARADO do servidor.
 * Para corrigir, a pessoa digita o valor novo (com máscara de digitação); o
 * servidor valida de novo, exige login recente e grava. Se o login não for
 * recente, a tela pede a senha (ou o Google) e repete o envio.
 */
export function PersonalDataPanel({ data }: { data: MaskedPersonalData }) {
  const router = useRouter();
  const [reauth, setReauth] = useState<null | { retry: () => Promise<void>; cancel: () => void }>(null);
  const [notice, setNotice] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  async function save(target: Target, value: string | null): Promise<SaveResult> {
    try {
      const res = await fetch("/api/perfil/dados", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...target, valor: value }),
        cache: "no-store",
      });
      const body = (await res.json().catch(() => ({}))) as { message?: string; error?: string; reauth?: boolean; fields?: Record<string, string> };
      if (res.ok) return { ok: true, message: body.message ?? "Salvo." };
      return { ok: false, error: body.error ?? "Não conseguimos salvar agora.", field: body.fields?.valor, reauth: body.reauth === true };
    } catch {
      return { ok: false, error: "Não conseguimos salvar agora. Verifique a conexão." };
    }
  }

  /** Envia; se o servidor pedir login recente, abre a confirmação e repete depois. */
  async function submit(target: Target, value: string | null): Promise<SaveResult> {
    const r = await save(target, value);
    if (!r.ok && r.reauth) {
      return new Promise<SaveResult>((resolve) => {
        setReauth({
          retry: async () => {
            setReauth(null);
            resolve(await save(target, value));
          },
          cancel: () => {
            setReauth(null);
            resolve({ ok: false, error: "Alteração não enviada: confirme sua identidade para continuar." });
          },
        });
      });
    }
    return r;
  }

  function done(r: SaveResult) {
    if (r.ok) {
      setNotice({ tone: "success", text: r.message });
      router.refresh();
    }
  }

  return (
    <div className="flex flex-col gap-8" data-testid="personal-data">
      {notice && (
        <div role="status">
          <Alert tone={notice.tone}>{notice.text}</Alert>
        </div>
      )}
      {reauth && <ReauthCard data={data} onConfirmed={reauth.retry} onCancel={reauth.cancel} />}

      <section aria-labelledby="dados-email" className="flex flex-col gap-3">
        <h2 id="dados-email" className="text-xl font-bold">
          E-mail da conta
        </h2>
        <EditableValue
          label="E-mail"
          kind="email"
          current={data.account.email}
          onSave={(v) => submit({ campo: "email" }, v)}
          onDone={done}
          note={
            data.account.emailPending
              ? `Troca pendente para ${data.account.emailPending}: confirme pelos links enviados ao e-mail atual e ao novo. Até lá, o e-mail da conta continua o mesmo.`
              : "A troca só vale depois de confirmar pelos links enviados ao e-mail atual e ao novo."
          }
        />
      </section>

      {data.partners.map((p) => (
        <section key={p.code} aria-labelledby={`dados-parceiro-${p.code}`} className="flex flex-col gap-3">
          <div className="flex flex-col gap-0.5">
            <h2 id={`dados-parceiro-${p.code}`} className="text-xl font-bold">
              {p.name}
            </h2>
            <p className="text-sm text-text-secondary">
              {PARTNER_KIND_LABELS[p.kind]} · {STATUS_LABELS[p.status] ?? p.status}
            </p>
          </div>
          {p.kind === "independent" ? (
            <CpfBlock partner={p} onSave={(v) => submit({ campo: "cpf", parceiro: p.code }, v)} onDone={done} />
          ) : (
            <EditableValue
              label="CNPJ"
              kind="cnpj"
              current={p.cnpj}
              onSave={(v) => submit({ campo: "cnpj", parceiro: p.code }, v)}
              onDone={done}
              note="Ao trocar, a verificação volta para pendente e o cadastro passa pela moderação de novo."
            />
          )}
          <EditableValue
            label="Telefone"
            kind="phone"
            current={p.phone}
            removable
            onSave={(v) => submit({ campo: "telefone_parceiro", ref: p.code, tipo: "phone" }, v)}
            onDone={done}
          />
          <EditableValue
            label="WhatsApp"
            kind="phone"
            current={p.whatsapp}
            removable
            onSave={(v) => submit({ campo: "telefone_parceiro", ref: p.code, tipo: "whatsapp" }, v)}
            onDone={done}
            note={p.status === "APPROVED" ? "Cadastro aprovado: mudar um contato público leva o cadastro para nova análise." : undefined}
          />
        </section>
      ))}

      {data.seeker && (
        <section aria-labelledby="dados-adocao" className="flex flex-col gap-3">
          <h2 id="dados-adocao" className="text-xl font-bold">
            Fila de adoção
          </h2>
          <EditableValue
            label="WhatsApp (só a moderação vê)"
            kind="phone"
            current={data.seeker.whatsapp}
            removable
            onSave={(v) => submit({ campo: "telefone_adocao" }, v)}
            onDone={done}
          />
        </section>
      )}

      {data.lostCases.length > 0 && (
        <section aria-labelledby="dados-alertas" className="flex flex-col gap-3">
          <h2 id="dados-alertas" className="text-xl font-bold">
            Alertas de pet perdido
          </h2>
          {data.lostCases.map((c) => (
            <EditableValue
              key={c.code}
              label={`Celular do alerta de ${c.petName}`}
              kind="phone"
              current={c.phone}
              removable
              onSave={(v) => submit({ campo: "telefone_alerta", ref: c.code }, v)}
              onDone={done}
              note={c.phone ? "Sem telefone, o alerta deixa de mostrar WhatsApp e ligação (o chat da MEL continua)." : undefined}
            />
          ))}
        </section>
      )}

      <p className="text-sm text-text-secondary">
        Telefones têm o formato conferido, mas não são confirmados por SMS. Cada mudança fica registrada (quem, o quê e quando — nunca o valor).
      </p>
    </div>
  );
}

function stateLabel(v: MaskedValue | null): string {
  return v ? CONTACT_FIELD_STATE_LABELS[v.state] : "Não informado";
}

function EditableValue({
  label,
  kind,
  current,
  removable = false,
  note,
  onSave,
  onDone,
}: {
  label: string;
  kind: Kind;
  current: MaskedValue | null;
  removable?: boolean;
  note?: string;
  onSave: (value: string | null) => Promise<SaveResult>;
  onDone: (r: SaveResult) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [busy, setBusy] = useState<"save" | "remove" | null>(null);
  const cfg = INPUT[kind];

  async function send(v: string | null, mode: "save" | "remove") {
    setBusy(mode);
    setError(undefined);
    const r = await onSave(v);
    setBusy(null);
    if (r.ok) {
      setEditing(false);
      setValue("");
    } else setError(r.field ?? r.error);
    onDone(r);
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const problem = value.trim() ? cfg.validate(value) : "Digite o novo valor.";
    if (problem) {
      setError(problem);
      return;
    }
    void send(value.trim(), "save");
  }

  const needsFix = current?.state === "needs_fix";
  return (
    <Card className="flex flex-col gap-3 !p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold">{label}</p>
          <p className="font-mono text-sm tabular-nums" data-testid={`dados-valor-${kind}`}>
            {current?.masked ?? "—"}
          </p>
          <p className={`text-caption ${needsFix ? "font-semibold text-status-lost" : "text-text-secondary"}`}>{stateLabel(current)}</p>
        </div>
        {!editing && (
          <Button size="md" variant="secondary" className="w-auto" onClick={() => setEditing(true)}>
            {current ? "Corrigir" : "Informar"}
          </Button>
        )}
      </div>
      {editing && (
        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-3">
          <TextField
            label={`Novo ${label.toLowerCase().startsWith("e-mail") ? "e-mail" : label.split(" (")[0]!.toLowerCase()}`}
            type={kind === "email" ? "email" : kind === "phone" ? "tel" : "text"}
            inputMode={cfg.inputMode}
            autoComplete={kind === "email" ? "email" : kind === "phone" ? "tel" : "off"}
            placeholder={cfg.placeholder}
            value={value}
            onChange={(e) => {
              setValue(cfg.format(e.target.value));
              if (error) setError(undefined);
            }}
            onBlur={() => value.trim() && setError(cfg.validate(value) ?? undefined)}
            error={error}
            hint={note}
          />
          <div className="flex flex-wrap gap-2">
            <Button type="submit" size="md" className="w-auto" loading={busy === "save"} loadingText="Salvando…" disabled={busy !== null}>
              Salvar
            </Button>
            {removable && current && (
              <Button size="md" variant="ghost" className="w-auto" loading={busy === "remove"} loadingText="Removendo…" disabled={busy !== null} onClick={() => void send(null, "remove")}>
                Remover
              </Button>
            )}
            <Button
              size="md"
              variant="ghost"
              className="w-auto"
              disabled={busy !== null}
              onClick={() => {
                setEditing(false);
                setValue("");
                setError(undefined);
              }}
            >
              Cancelar
            </Button>
          </div>
        </form>
      )}
      {!editing && note && <p className="text-caption text-text-secondary">{note}</p>}
    </Card>
  );
}

function CpfBlock({
  partner,
  onSave,
  onDone,
}: {
  partner: MaskedPersonalData["partners"][number];
  onSave: (value: string | null) => Promise<SaveResult>;
  onDone: (r: SaveResult) => void;
}) {
  const state = partner.cpf?.state ?? null;
  // O número nunca vem para a página: só o estado. "Ver CPF" pede ao servidor (e registra).
  const current: MaskedValue | null =
    state === null
      ? null
      : { masked: state === "ok" ? "guardado com segurança" : state === "unreadable" ? "ilegível" : "indisponível", state: state === "ok" ? "format_ok_unconfirmed" : "needs_fix" };
  return (
    <div className="flex flex-col gap-3">
      {state === "unreadable" || state === "key_unavailable" ? (
        <Alert tone="error">
          {state === "unreadable" ? "Não conseguimos ler o CPF guardado." : "O CPF guardado está indisponível no momento."} Sua conta e seu cadastro continuam.
          Cadastre o CPF de novo abaixo: o cadastro passa pela moderação outra vez (a aprovação anterior não é transferida).
        </Alert>
      ) : null}
      {state === "ok" && <CpfReveal code={partner.code} audience="owner" />}
      <EditableValue
        label="CPF"
        kind="cpf"
        current={current}
        onSave={onSave}
        onDone={onDone}
        note="O CPF é cifrado no servidor. Ao trocar, o cadastro volta para análise da moderação."
      />
    </div>
  );
}

/** Confirmar identidade: senha (contas com senha) ou Google (contas Google). */
function ReauthCard({ data, onConfirmed, onCancel }: { data: MaskedPersonalData; onConfirmed: () => Promise<void>; onCancel: () => void }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [busy, setBusy] = useState<"password" | "google" | null>(null);
  const captcha = useCaptchaToken();
  const headingRef = useRef<HTMLHeadingElement>(null);
  // Leva o foco (e o leitor de tela) para o pedido de confirmação.
  useEffect(() => headingRef.current?.focus(), []);

  async function confirmPassword(e: FormEvent) {
    e.preventDefault();
    if (!password) {
      setError("Digite sua senha.");
      return;
    }
    setBusy("password");
    setError(undefined);
    try {
      const captchaToken = await takeCaptchaToken(captcha);
      const res = await fetch("/api/perfil/reautenticar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ senha: password, captchaToken }),
        cache: "no-store",
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(body.error ?? "Não conseguimos confirmar agora.");
        setBusy(null);
        return;
      }
      setPassword("");
      await onConfirmed();
    } catch (err) {
      setError(userErrorMessage(err, "Não conseguimos confirmar agora."));
    }
    setBusy(null);
  }

  async function confirmGoogle() {
    setBusy("google");
    try {
      await signInWithGoogle(getBrowserClient(), `${window.location.origin}/auth/callback?next=${encodeURIComponent("/perfil/dados")}`);
    } catch (err) {
      setError(userErrorMessage(err, "Não conseguimos abrir o Google agora."));
      setBusy(null);
    }
  }

  return (
    <Card className="flex flex-col gap-4" data-testid="reauth">
      <div>
        <h2 ref={headingRef} tabIndex={-1} className="text-xl font-bold focus:outline-none">
          Confirme que é você
        </h2>
        <p className="text-text-secondary">Para mudar documentos, telefones ou e-mail, confirme sua identidade (vale por 10 minutos).</p>
      </div>
      {data.account.canUsePassword && (
        <form onSubmit={confirmPassword} noValidate className="flex flex-col gap-3">
          <PasswordField label="Sua senha" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} error={error} />
          <Turnstile key={captcha.key} onToken={captcha.setToken} onError={setError} />
          <Button type="submit" size="md" loading={busy === "password"} loadingText="Confirmando…" disabled={busy !== null}>
            Confirmar com senha
          </Button>
        </form>
      )}
      {data.account.canUsePassword && data.account.canUseGoogle && <Divider>ou</Divider>}
      {data.account.canUseGoogle && (
        <>
          <Button variant="secondary" size="md" loading={busy === "google"} loadingText="Abrindo o Google…" disabled={busy !== null} onClick={() => void confirmGoogle()}>
            Confirmar com o Google
          </Button>
          <p className="text-caption text-text-secondary">Depois de confirmar, você volta para esta página; envie a alteração de novo.</p>
        </>
      )}
      {!data.account.canUsePassword && !data.account.canUseGoogle && (
        <p className="text-sm text-text-secondary">Saia e entre de novo na sua conta para confirmar sua identidade.</p>
      )}
      {!data.account.canUsePassword && error && (
        <p role="alert" className="text-sm font-medium text-danger">
          {error}
        </p>
      )}
      <Button variant="ghost" size="md" disabled={busy !== null} onClick={onCancel}>
        Cancelar
      </Button>
    </Card>
  );
}
