"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, HandHeart, Lock, Store, UserRound } from "lucide-react";
import { useEffect, useRef, useState, useSyncExternalStore, type FormEvent } from "react";
import {
  BUSINESS_CATEGORY_LABELS,
  COMPANY_CATEGORIES,
  formatCnpj,
  formatCpf,
  formatCnpjInput,
  formatCpfInput,
  formatPhoneInput,
  isValidCnpj,
  isValidCpf,
  NGO_ACTIVITY_AREAS,
  normalizeCnpj,
  normalizeCpf,
  optionalPhoneField,
  PARTNER_KIND_LABELS,
  partnerInputSchema,
  fieldErrors,
  userErrorMessage,
  type PartnerKind,
} from "@mel/core";
import { uploadBusinessLogo } from "@mel/data";
import { prepareImage } from "@/lib/images";
import { getBrowserClient } from "@/lib/supabase/browser";
import { LocationPicker, type PickedLocation } from "@/components/location/LocationPicker";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { SelectField, TextareaField, TextField } from "@/components/ui/Field";
import { Switch } from "@/components/ui/Switch";

const KINDS: { value: PartnerKind; icon: typeof Store; text: string }[] = [
  { value: "company", icon: Store, text: "Clínica, pet shop, banho e tosa, hotel, adestramento." },
  { value: "ngo", icon: HandHeart, text: "Organização de proteção animal com CNPJ." },
  { value: "independent", icon: UserRound, text: "Pessoa que resgata e cuida, sem CNPJ." },
];

type Values = Record<
  "name" | "category" | "description" | "cnpj" | "legalName" | "addressLabel" | "hours" | "activityArea" | "responsibleName"
  | "neighborhood" | "city" | "phone" | "whatsapp" | "website" | "instagram",
  string
>;
const EMPTY: Values = {
  name: "", category: "", description: "", cnpj: "", legalName: "", addressLabel: "", hours: "", activityArea: "",
  responsibleName: "", neighborhood: "", city: "", phone: "", whatsapp: "", website: "", instagram: "",
};

// Rascunho para quem ainda não tem conta: volta preenchido depois do login.
// Fica só nesta aba (sessionStorage) e NUNCA guarda o CPF nem o arquivo do logo.
const DRAFT_KEY = "mel:parceiro:rascunho";
const DRAFT_TTL_MS = 2 * 60 * 60_000;
interface Draft {
  kind: PartnerKind;
  values: Values;
  helpsLost: boolean;
  where: PickedLocation | null;
  savedAt: number;
}
function saveDraft(d: Omit<Draft, "savedAt">) {
  try {
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ ...d, savedAt: Date.now() }));
  } catch {
    // Sem armazenamento (modo privado restrito): segue sem rascunho.
  }
}
function takeDraft(): Draft | null {
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const d = JSON.parse(raw) as Draft;
    if (Date.now() - d.savedAt > DRAFT_TTL_MS || !["company", "ngo", "independent"].includes(d.kind)) return null;
    return { ...d, values: { ...EMPTY, ...d.values } };
  } catch {
    return null;
  }
}
function clearDraft() {
  try {
    sessionStorage.removeItem(DRAFT_KEY);
  } catch {}
}

const SIGN_IN_URL = `/entrar?next=${encodeURIComponent("/parceiros#cadastro")}&contexto=parceiro&criar=1`;
const ONBOARDING_URL = `/onboarding?next=${encodeURIComponent("/parceiros#cadastro")}`;

/**
 * Inscrição de parceiro na própria página /parceiros: lê e preenche sem conta;
 * no envio, sem conta real, guarda o rascunho e leva ao login com o contexto
 * de parceiro. O servidor revalida tudo e cifra o CPF.
 */
const noSubscribe = () => () => {};

export function PartnerSignupForm() {
  const router = useRouter();
  // Antes da hidratação o botão faria um envio HTML puro (sem validação, perdendo o
  // preenchido): fica desabilitado até o formulário estar pronto (celular lento).
  const ready = useSyncExternalStore(noSubscribe, () => true, () => false);
  const [kind, setKind] = useState<PartnerKind>("company");
  const [v, setV] = useState<Values>(EMPTY);
  const [cpf, setCpf] = useState("");
  const [helpsLost, setHelpsLost] = useState(false);
  // Empresa/ONG: endereço comercial/institucional público e autorizado (o administrador ainda valida).
  const [addressPublic, setAddressPublic] = useState(false);
  const [where, setWhere] = useState<PickedLocation | null>(null);
  const [logo, setLogo] = useState<File | null>(null);
  const [terms, setTerms] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [restored, setRestored] = useState(false);
  const [done, setDone] = useState<{ code: string; name: string } | null>(null);
  const doneRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    // Depois da hidratação: o servidor não conhece o rascunho desta aba.
    Promise.resolve().then(() => {
      const d = takeDraft();
      if (!d) return;
      setKind(d.kind);
      setV(d.values);
      setHelpsLost(d.helpsLost);
      setWhere(d.where);
      setRestored(true);
    });
  }, []);

  useEffect(() => {
    if (done) doneRef.current?.focus();
  }, [done]);

  const set = (key: keyof Values) => (e: { target: { value: string } }) => setV((cur) => ({ ...cur, [key]: e.target.value }));
  // Ponto aproximado e só bairro/cidade: protetor sempre; ONG sem endereço institucional autorizado.
  const approximate = kind === "independent" || (kind === "ngo" && !addressPublic);

  function draftInput(logoPath: string | null) {
    const common = {
      kind,
      name: v.name,
      description: v.description,
      position: where?.position,
      phone: v.phone,
      whatsapp: v.whatsapp,
      website: v.website,
      instagram: v.instagram,
      helpsLost,
      logoPath,
    };
    if (kind === "company")
      return { ...common, category: v.category || undefined, cnpj: v.cnpj, legalName: v.legalName, addressLabel: v.addressLabel || where?.label || "", hours: v.hours,
        neighborhood: v.neighborhood, city: v.city, addressPublic };
    const place = { neighborhood: v.neighborhood, city: v.city };
    if (kind === "ngo")
      return { ...common, ...place, cnpj: v.cnpj, legalName: v.legalName, activityArea: v.activityArea || undefined, responsibleName: v.responsibleName,
        addressPublic, addressLabel: addressPublic ? v.addressLabel || where?.label || "" : undefined };
    return { ...common, ...place, cpf };
  }

  function invalid(fields: Record<string, string>) {
    setErrors(fields);
    setError("Falta pouco: confira os campos destacados.");
    // Leva ao primeiro campo com erro.
    requestAnimationFrame(() => document.querySelector<HTMLElement>("#cadastro [aria-invalid='true']")?.focus());
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    const parsed = partnerInputSchema.safeParse(draftInput(null));
    const fields = parsed.success ? {} : fieldErrors(parsed.error);
    if (!terms) fields.terms = "Aceite as regras para enviar.";
    if (!parsed.success || !terms) return invalid(fields);
    setErrors({});
    setError(null);

    const client = getBrowserClient();
    const { data } = await client.auth.getSession();
    const user = data.session?.user;
    if (!user || user.is_anonymous) {
      saveDraft({ kind, values: v, helpsLost, where });
      setBusy("Abrindo o login…");
      router.push(SIGN_IN_URL);
      return;
    }

    try {
      let logoPath: string | null = null;
      if (logo) {
        setBusy("Enviando logo…");
        logoPath = await uploadBusinessLogo(client, user.id, await prepareImage(logo, 512));
      }
      setBusy("Enviando inscrição…");
      const res = await fetch("/api/parceiros", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draftInput(logoPath)),
      });
      const body = (await res.json().catch(() => ({}))) as { code?: string; error?: string; fields?: Record<string, string>; needsAccount?: boolean; needsOnboarding?: boolean };
      if (res.status === 401 || body.needsAccount) {
        saveDraft({ kind, values: v, helpsLost, where });
        router.push(SIGN_IN_URL);
        return;
      }
      if (body.needsOnboarding) {
        saveDraft({ kind, values: v, helpsLost, where });
        router.push(ONBOARDING_URL);
        return;
      }
      if (!res.ok || !body.code) {
        setBusy(null);
        if (body.fields) setErrors(body.fields);
        setError(body.error ?? "Não conseguimos enviar agora. Tente de novo.");
        return;
      }
      clearDraft();
      setCpf("");
      setDone({ code: body.code, name: v.name.trim() });
    } catch (err) {
      setError(userErrorMessage(err, "Não conseguimos enviar agora. Verifique a conexão e tente de novo."));
      setBusy(null);
    }
  }

  if (done) {
    return (
      <div className="flex flex-col items-center gap-4 py-3 text-center" data-testid="partner-success">
        <span className="flex size-19 items-center justify-center rounded-full bg-status-found-soft text-status-found">
          <Check aria-hidden="true" className="size-10" strokeWidth={2.6} />
        </span>
        <h2 ref={doneRef} tabIndex={-1} className="text-[28px] font-extrabold tracking-[-0.02em] outline-none">
          Enviado para moderação
        </h2>
        <p className="max-w-prose text-text-secondary">
          <strong className="text-text-primary">{done.name}</strong> está em análise. Respondemos em até 3 dias úteis pelas notificações da MEL.
          Enquanto isso, nada fica público.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <Link href={`/parceiros/${done.code}`} className="inline-flex min-h-12 items-center rounded-full bg-primary px-6 font-bold text-primary-foreground shadow-primary">
            Acompanhar meu cadastro
          </Link>
          <Link href="/" className="inline-flex min-h-12 items-center rounded-full border border-border-strong px-6 font-bold">
            Voltar ao início
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-5">
      {restored && (
        <Alert tone="info">
          Recuperamos sua inscrição. Confira os dados e envie.{kind === "independent" && " Por segurança, o CPF não fica salvo: digite de novo."}
        </Alert>
      )}
      <fieldset className="m-0 border-0 p-0">
        <legend className="mb-2.5 font-bold">
          Tipo de parceiro <span className="text-primary">*</span>
        </legend>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {KINDS.map(({ value, icon: Icon, text }) => (
            <label
              key={value}
              className="group relative grid cursor-pointer gap-2 rounded-[18px] border-[1.5px] border-border-strong bg-surface-muted/50 p-[18px] pr-12 transition-[border-color,background-color,transform] duration-200 ease-mel has-[:checked]:border-primary has-[:checked]:bg-primary/10 has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-3 has-[:focus-visible]:outline-focus motion-safe:hover:-translate-y-0.5"
            >
              <input
                type="radio"
                name="partner-kind"
                value={value}
                checked={kind === value}
                onChange={() => {
                  setKind(value);
                  setErrors({});
                  setError(null);
                }}
                className="sr-only"
              />
              <Icon aria-hidden="true" className="size-[30px] text-primary" strokeWidth={1.75} />
              <strong className="text-[17px]">{PARTNER_KIND_LABELS[value]}</strong>
              <span className="text-sm text-text-secondary">{text}</span>
              <span
                aria-hidden="true"
                className="absolute top-3.5 right-3.5 size-[22px] rounded-full border-2 border-border-strong transition-[border-width,border-color] duration-200 group-has-[:checked]:border-[7px] group-has-[:checked]:border-primary"
              />
            </label>
          ))}
        </div>
      </fieldset>

      <div key={kind} className="grid min-w-0 grid-cols-1 gap-4 motion-safe:animate-enter">
        {kind === "company" && (
          <>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <TextField label="Nome público" placeholder="Ex.: Clínica Pet Vida" maxLength={80} value={v.name} onChange={set("name")} error={errors.name} />
              <SelectField label="Categoria" value={v.category} onChange={set("category")} error={errors.category}>
                <option value="">Selecione</option>
                {COMPANY_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {BUSINESS_CATEGORY_LABELS[c]}
                  </option>
                ))}
              </SelectField>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <CnpjField value={v.cnpj} onChange={(cnpj) => setV((c) => ({ ...c, cnpj }))} error={errors.cnpj} onError={(m) => setErrors((x) => ({ ...x, cnpj: m }))} />
              <TextField label="Razão social" placeholder="Como está no CNPJ" maxLength={150} value={v.legalName} onChange={set("legalName")} error={errors.legalName} hint="Visível só para a moderação." />
            </div>
          </>
        )}
        {kind === "ngo" && (
          <>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <TextField label="Nome da ONG" placeholder="Ex.: Patinhas do Bem" maxLength={80} value={v.name} onChange={set("name")} error={errors.name} />
              <CnpjField value={v.cnpj} onChange={(cnpj) => setV((c) => ({ ...c, cnpj }))} error={errors.cnpj} onError={(m) => setErrors((x) => ({ ...x, cnpj: m }))} />
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <SelectField label="Área de atuação" value={v.activityArea} onChange={set("activityArea")} error={errors.activityArea}>
                <option value="">Selecione</option>
                {NGO_ACTIVITY_AREAS.map((a) => (
                  <option key={a}>{a}</option>
                ))}
              </SelectField>
              <TextField label="Pessoa responsável" placeholder="Nome de quem responde pela ONG" maxLength={120} value={v.responsibleName} onChange={set("responsibleName")} error={errors.responsibleName} hint="Visível só para a moderação." />
            </div>
            <TextField label="Razão social" optional maxLength={150} value={v.legalName} onChange={set("legalName")} error={errors.legalName} hint="Visível só para a moderação." />
          </>
        )}
        {kind === "independent" && (
          <>
            <TextField label="Seu nome ou apelido público" placeholder="Ex.: Tia Lu dos Gatos" maxLength={80} value={v.name} onChange={set("name")} error={errors.name} />
            <TextField
              label="CPF"
              inputMode="numeric"
              autoComplete="off"
              placeholder="000.000.000-00"
              maxLength={14}
              value={cpf}
              onChange={(e) => setCpf(formatCpfInput(e.target.value))}
              onBlur={() => {
                const n = normalizeCpf(cpf);
                if (!n) return;
                if (isValidCpf(n)) {
                  setCpf(formatCpf(n));
                  setErrors((x) => ({ ...x, cpf: "" }));
                } else setErrors((x) => ({ ...x, cpf: "Confira os 11 números do CPF." }));
              }}
              error={errors.cpf || undefined}
              hint="Obrigatório e privado: cifrado, visto só por você e por administradores autorizados (cada acesso fica registrado). Nunca é publicado."
            />
          </>
        )}

        <TextareaField
          label={kind === "independent" ? "Como você atua" : kind === "ngo" ? "Sobre a ONG" : "Sobre a empresa"}
          rows={4}
          maxLength={800}
          placeholder={kind === "independent" ? "Ex.: resgato gatos da região, tenho lar temporário para até 4 animais…" : "Serviços, como ajuda a comunidade…"}
          value={v.description}
          onChange={set("description")}
          error={errors.description}
        />

        {/* Bairro e cidade: o que aparece em público enquanto o endereço não for liberado. */}
        {(approximate || kind === "company" || addressPublic) && (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <TextField label="Bairro" placeholder="Ex.: Tatuapé" maxLength={80} value={v.neighborhood} onChange={set("neighborhood")} error={errors.neighborhood} />
            <TextField label="Cidade" placeholder="Ex.: São Paulo – SP" maxLength={80} value={v.city} onChange={set("city")} error={errors.city} />
          </div>
        )}

        <section aria-labelledby="parceiro-local" className="flex flex-col gap-3">
          <h3 id="parceiro-local" className="text-sm font-semibold">
            {approximate ? "Região no mapa" : kind === "ngo" ? "Endereço institucional" : "Endereço do estabelecimento"}
          </h3>
          <LocationPicker
            value={where}
            onChange={(p) => {
              setWhere(p);
              setV((c) => ({
                ...c,
                addressLabel: c.addressLabel || p.label || "",
                neighborhood: c.neighborhood || p.neighborhood || "",
                city: c.city || (p.city ? `${p.city}${p.state ? ` – ${p.state}` : ""}` : ""),
              }));
            }}
            privacyNote={
              approximate
                ? "Guardamos só um ponto aproximado (cerca de 1 km). Em público aparecem apenas o bairro e a cidade, nunca o endereço."
                : addressPublic
                  ? "O endereço exato só aparece depois que a equipe da MEL validar. Até lá, em público, só o bairro e a cidade."
                  : "Sem a autorização abaixo, em público aparecem só o bairro, a cidade e um ponto aproximado (~1 km)."
            }
          />
          {errors.position && <p className="text-sm font-medium text-danger">{errors.position}</p>}
          {kind !== "independent" && (
            <label className="flex items-start gap-3 rounded-md border border-border p-3 text-sm" data-testid="partner-address-public">
              <input
                type="checkbox"
                className="mt-1 size-5 shrink-0 accent-[#f6b928]"
                checked={addressPublic}
                onChange={(e) => setAddressPublic(e.target.checked)}
                aria-labelledby="endereco-publico-titulo"
                aria-describedby="endereco-publico-ajuda"
              />
              <span>
                <span id="endereco-publico-titulo" className="font-semibold">
                  Este é um endereço {kind === "ngo" ? "institucional (sede ou unidade de atendimento)" : "comercial"} aberto ao público e autorizo a MEL a mostrá-lo no mapa
                </span>
                <span id="endereco-publico-ajuda" className="mt-1 block text-text-secondary">
                  Não marque se for residência, atendimento em casa ou lar temporário: nesse caso aparecem só o bairro e a cidade. A equipe da MEL valida antes de publicar.
                </span>
              </span>
            </label>
          )}
          {!approximate && (
            <TextField label="Endereço como aparece no perfil" maxLength={200} value={v.addressLabel} onChange={set("addressLabel")} error={errors.addressLabel} />
          )}
        </section>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {(["phone", "whatsapp"] as const).map((f) => (
            <TextField
              key={f}
              label={f === "phone" ? "Telefone" : "WhatsApp"}
              optional
              type="tel"
              inputMode="tel"
              autoComplete="tel-national"
              placeholder={f === "phone" ? "(11) 3333-3333" : "(11) 99999-9999"}
              value={v[f]}
              onChange={(e) => setV((c) => ({ ...c, [f]: formatPhoneInput(e.target.value) }))}
              onBlur={() => {
                // Mesma regra do servidor e do banco (DDD existente, 9 no celular, fixo 2–5).
                const r = optionalPhoneField.safeParse(v[f]);
                setErrors((x) => ({ ...x, [f]: r.success ? "" : (r.error.issues[0]?.message ?? "") }));
              }}
              error={errors[f] || undefined}
            />
          ))}
          <TextField label="Site" optional type="url" placeholder="https://" value={v.website} onChange={set("website")} error={errors.website} />
          <TextField label="Instagram" optional placeholder="@seuperfil" value={v.instagram} onChange={set("instagram")} error={errors.instagram} />
        </div>
        <p className="-mt-2 text-sm text-text-secondary">
          {kind === "independent" ? "Contatos são opcionais: sem eles, as pessoas falam com você pelo chat da MEL." : "Informe ao menos um contato público."}
        </p>
        {kind === "company" && (
          <TextField label="Horário de funcionamento" optional placeholder="Seg. a sáb., 8h às 18h" maxLength={200} value={v.hours} onChange={set("hours")} />
        )}
        <Switch checked={helpsLost} onChange={setHelpsLost} label="Ajudo com pets perdidos" description="Ex.: leitor de microchip, lar temporário para animais encontrados." />
        <label className="flex flex-col gap-2 text-sm">
          <span className="font-semibold">
            {kind === "company" ? "Logo" : "Logo ou foto"} <span className="font-normal text-text-secondary">(opcional{kind !== "company" && ", sem rosto de pessoas"})</span>
          </span>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => setLogo(e.target.files?.[0] ?? null)}
            className="max-w-full text-sm file:mr-3 file:min-h-11 file:rounded-md file:border file:border-border file:bg-surface file:px-3 file:font-semibold"
          />
        </label>
      </div>

      <label className="flex cursor-pointer items-start gap-3 text-[14.5px]">
        <input
          type="checkbox"
          checked={terms}
          onChange={(e) => setTerms(e.target.checked)}
          aria-invalid={errors.terms ? true : undefined}
          aria-describedby={errors.terms ? "parceiro-termos-erro" : undefined}
          className="mt-0.5 size-[22px] shrink-0 accent-primary"
        />
        <span>Li e aceito as regras do programa: nada de venda de animais e informações verdadeiras.</span>
      </label>
      {errors.terms && (
        <p id="parceiro-termos-erro" className="-mt-2 text-sm font-medium text-danger">
          {errors.terms}
        </p>
      )}

      <div role="note" className="flex gap-3 rounded-md border border-status-info/40 bg-status-info-soft px-4 py-3.5 text-[14.5px]">
        <Lock aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-status-info" strokeWidth={2} />
        <span>
          Documentos e dados de contato da moderação ficam só com a equipe. Publicamos apenas o nome público, a categoria, o bairro (ou o
          endereço, se for estabelecimento) e os canais que você escolher mostrar.
          {kind === "independent" &&
            " O CPF cifrado é apagado se o cadastro for recusado ou se você excluir a conta. CPF válido não é verificação de identidade: a moderação analisa cada cadastro."}
        </span>
      </div>
      {error && <Alert tone="error">{error}</Alert>}
      <Button type="submit" disabled={!ready} loading={Boolean(busy)} loadingText={busy} className="rounded-full">
        Enviar para moderação
      </Button>
    </form>
  );
}

/** CNPJ obrigatório: confere os dígitos ao sair do campo (o servidor confere de novo). */
function CnpjField({ value, onChange, error, onError }: { value: string; onChange: (v: string) => void; error?: string; onError: (m: string) => void }) {
  return (
    <TextField
      label="CNPJ"
      placeholder="00.000.000/0000-00"
      autoCapitalize="characters"
      maxLength={18}
      value={value}
      onChange={(e) => onChange(formatCnpjInput(e.target.value))}
      onBlur={() => {
        const n = normalizeCnpj(value);
        if (!n) return;
        if (isValidCnpj(n)) {
          onChange(formatCnpj(n));
          onError("");
        } else onError("Confira os 14 caracteres do CNPJ.");
      }}
      error={error || undefined}
      hint="Obrigatório. Validamos o número; não é publicado."
    />
  );
}
