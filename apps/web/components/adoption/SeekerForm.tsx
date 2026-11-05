"use client";

import { useRouter } from "next/navigation";
import { useState, useSyncExternalStore } from "react";
import { Lock } from "lucide-react";
import {
  type AdoptionSeeker,
  fieldErrors,
  GUARDIAN_RADII_M,
  type GuardianRadius,
  publicAreaFrom,
  radiusLabel,
  SEEKER_AGE_LABELS,
  SEEKER_AGES,
  SEEKER_DELETE_AFTER_EXPIRY_DAYS,
  SEEKER_HOUSING,
  SEEKER_HOUSING_LABELS,
  SEEKER_OTHER_PETS,
  SEEKER_OTHER_PETS_LABELS,
  SEEKER_SIZE_GROUPS,
  SEEKER_SIZE_LABELS,
  SEEKER_SPECIES,
  SEEKER_SPECIES_LABELS,
  SEEKER_VALID_DAYS,
  type SeekerAge,
  seekerInputSchema,
  type SeekerSizeGroup,
  sizeGroupsOf,
  userErrorMessage,
} from "@mel/core";
import { saveMyAdoptionSeeker } from "@mel/data";
import { getBrowserClient } from "@/lib/supabase/browser";
import { LocationPicker, type PickedLocation } from "@/components/location/LocationPicker";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { SelectField, TextareaField, TextField } from "@/components/ui/Field";
import { FilterChip } from "@/components/ui/FilterChip";
import { Switch } from "@/components/ui/Switch";
import { useToast } from "@/components/ui/Toast";

const SEEKER_PATH = "/adocao/quero-adotar";
// Rascunho na aba (sessionStorage) para sobreviver ao login; o WhatsApp não entra.
const DRAFT_KEY = "mel:quero-adotar";

/** Situação de quem está vendo: sem conta, conta sem cadastro completo, ou pronto para enviar. */
export type Viewer = "visitor" | "onboarding" | "ready";

interface Draft {
  species: string;
  size: "" | SeekerSizeGroup;
  age: "" | SeekerAge;
  area: PickedLocation | null;
  areaLabel: string;
  radiusM: GuardianRadius;
  housing: string;
  otherPets: string;
  children: "" | "yes" | "no";
  routine: string;
  notify: boolean;
  showPublic: boolean;
  consent: boolean;
}

function fromSeeker(s: AdoptionSeeker | null): Draft {
  return {
    species: s?.species ?? "",
    size: (s && sizeGroupsOf(s.sizes)[0]) ?? "",
    age: s?.ages[0] ?? "",
    area: s ? { position: s.area, label: s.areaLabel, source: "map" } : null,
    areaLabel: s?.areaLabel ?? "",
    radiusM: ((GUARDIAN_RADII_M as readonly number[]).includes(s?.radiusM ?? 0) ? s!.radiusM : 10000) as GuardianRadius,
    housing: s?.housing ?? "",
    otherPets: s?.otherPets ?? "",
    children: s?.children == null ? "" : s.children ? "yes" : "no",
    routine: s?.routine ?? "",
    notify: s?.notify ?? true,
    showPublic: s?.showPublic ?? false,
    consent: false,
  };
}

const noSubscribe = () => () => {};
function readDraft(): string | null {
  try {
    return sessionStorage.getItem(DRAFT_KEY);
  } catch {
    // Sem armazenamento (aba privada): segue com o formulário vazio.
    return null;
  }
}

interface SeekerFormProps {
  viewer: Viewer;
  firstName: string | null;
  initial: AdoptionSeeker | null;
  onSaved?: () => void;
  onCancel?: () => void;
}

/**
 * Formulário do perfil de adoção (fila de interessados). Explica tudo antes de
 * pedir login; na volta do login, recupera o rascunho da aba (o servidor não o
 * conhece, então o formulário é remontado com ele depois da hidratação).
 */
export function SeekerForm(props: SeekerFormProps) {
  const raw = useSyncExternalStore(noSubscribe, readDraft, () => null);
  let draft: Partial<Draft> | null = null;
  if (raw && !props.initial) {
    try {
      draft = JSON.parse(raw) as Partial<Draft>;
    } catch {
      draft = null;
    }
  }
  return <SeekerFormFields key={draft ? "rascunho" : "novo"} {...props} draft={draft} />;
}

function SeekerFormFields({ viewer, firstName, initial, onSaved, onCancel, draft }: SeekerFormProps & { draft: Partial<Draft> | null }) {
  const router = useRouter();
  const toast = useToast();
  const [d, setD] = useState<Draft>(() => ({ ...fromSeeker(initial), ...draft }));
  const [whatsapp, setWhatsapp] = useState(initial?.whatsapp ?? "");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const restored = draft !== null;
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((prev) => ({ ...prev, [k]: v }));

  function pickArea(p: PickedLocation) {
    setD((prev) => ({ ...prev, area: p, areaLabel: publicAreaFrom(p) ?? prev.areaLabel }));
  }

  async function submit() {
    const parsed = seekerInputSchema.safeParse({
      species: d.species || undefined,
      sizes: d.size ? [...SEEKER_SIZE_GROUPS[d.size]] : [],
      ages: d.age ? [d.age] : [],
      area: d.area?.position,
      areaLabel: d.areaLabel,
      radiusM: d.radiusM,
      housing: d.housing || undefined,
      otherPets: d.otherPets || undefined,
      children: d.children === "" ? null : d.children === "yes",
      routine: d.routine,
      whatsapp: whatsapp || null,
      notify: d.notify,
      showPublic: d.showPublic,
      consent: d.consent,
    });
    if (!parsed.success) {
      const errs = fieldErrors(parsed.error);
      setErrors(errs);
      // Leva ao primeiro campo com erro (ordem do formulário).
      const first = ["species", "whatsapp", "area", "areaLabel", "housing", "otherPets", "routine", "consent"].find((k) => errs[k]);
      if (first) document.getElementById(`seeker-${first}`)?.scrollIntoView({ block: "center" });
      return;
    }
    setErrors({});
    setError(null);
    if (viewer !== "ready") {
      try {
        sessionStorage.setItem(DRAFT_KEY, JSON.stringify(d));
      } catch {
        // Sem armazenamento: a pessoa preenche de novo depois do login.
      }
      const next = encodeURIComponent(SEEKER_PATH);
      router.push(viewer === "visitor" ? `/entrar?next=${next}` : `/onboarding?next=${next}`);
      return;
    }
    setBusy(true);
    try {
      await saveMyAdoptionSeeker(getBrowserClient(), parsed.data);
      try {
        sessionStorage.removeItem(DRAFT_KEY);
      } catch {
        // nada a limpar
      }
      toast({ tone: "success", title: initial ? "Interesse atualizado." : "Você está na fila!" });
      onSaved?.();
      router.refresh();
    } catch (err) {
      setError(userErrorMessage(err, "Não conseguimos salvar agora. Tente de novo."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      noValidate
      className="grid gap-4.5"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      {restored && <Alert tone="info">Recuperamos o que você tinha preenchido. Confira e envie.</Alert>}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <p className="text-sm font-semibold">Como você aparece</p>
          <p className="flex min-h-12 items-center rounded-md border border-border bg-surface-muted px-4 text-text-secondary">
            {firstName ?? "Primeiro nome da sua conta"}
          </p>
          <p className="text-sm text-text-secondary">Só o primeiro nome. Nada de sobrenome.</p>
        </div>
        <div id="seeker-whatsapp">
          <TextField
            label="WhatsApp"
            optional
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="(11) 90000-0000"
            value={whatsapp}
            maxLength={20}
            onChange={(e) => setWhatsapp(e.target.value)}
            error={errors.whatsapp}
            hint="Nunca fica público. Só a moderação vê; o contato com quem doa é pelo chat."
          />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div id="seeker-species">
          <SelectField label="Espécie" value={d.species} onChange={(e) => set("species", e.target.value)} error={errors.species} required>
            <option value="">Selecione</option>
            {SEEKER_SPECIES.map((s) => (
              <option key={s} value={s}>
                {SEEKER_SPECIES_LABELS[s]}
              </option>
            ))}
          </SelectField>
        </div>
        <SelectField label="Porte" value={d.size} onChange={(e) => set("size", e.target.value as Draft["size"])}>
          <option value="">Tanto faz</option>
          {(Object.keys(SEEKER_SIZE_GROUPS) as SeekerSizeGroup[]).map((g) => (
            <option key={g} value={g}>
              {SEEKER_SIZE_LABELS[g]}
            </option>
          ))}
        </SelectField>
        <SelectField label="Idade preferida" value={d.age} onChange={(e) => set("age", e.target.value as Draft["age"])}>
          <option value="">Tanto faz</option>
          {SEEKER_AGES.map((a) => (
            <option key={a} value={a}>
              {SEEKER_AGE_LABELS[a]}
            </option>
          ))}
        </SelectField>
      </div>

      <fieldset id="seeker-area" className="flex flex-col gap-3">
        <legend className="mb-1.5 text-sm font-semibold">Bairro onde você mora</legend>
        <LocationPicker
          value={d.area}
          onChange={pickArea}
          privacyNote="Guardamos só uma área aproximada (cerca de 100 m) para calcular a distância. Nunca o seu endereço."
        />
        {errors.area && (
          <p role="alert" className="text-sm font-medium text-danger">
            {errors.area}
          </p>
        )}
      </fieldset>

      <div className="grid gap-4">
        <div id="seeker-areaLabel">
          <TextField
            label="Bairro e cidade"
            placeholder="Ex.: Itaquera, São Paulo – SP"
            value={d.areaLabel}
            maxLength={120}
            onChange={(e) => set("areaLabel", e.target.value)}
            error={errors.areaLabel}
            hint="Aparece assim para a moderação e, se você escolher, na lista pública. Não coloque rua nem número."
          />
        </div>
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1.5 text-sm font-semibold">Avisar sobre animais até</legend>
          <div className="flex flex-wrap gap-2">
            {GUARDIAN_RADII_M.map((r) => (
              <FilterChip key={r} pressed={d.radiusM === r} onClick={() => set("radiusM", r)} className="min-h-11">
                {radiusLabel(r)}
              </FilterChip>
            ))}
          </div>
        </fieldset>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div id="seeker-housing">
          <SelectField label="Tipo de moradia" value={d.housing} onChange={(e) => set("housing", e.target.value)} error={errors.housing} required>
            <option value="">Selecione</option>
            {SEEKER_HOUSING.map((h) => (
              <option key={h} value={h}>
                {SEEKER_HOUSING_LABELS[h]}
              </option>
            ))}
          </SelectField>
        </div>
        <div id="seeker-otherPets">
          <SelectField label="Já tem outros animais?" value={d.otherPets} onChange={(e) => set("otherPets", e.target.value)} error={errors.otherPets} required>
            <option value="">Selecione</option>
            {SEEKER_OTHER_PETS.map((o) => (
              <option key={o} value={o}>
                {SEEKER_OTHER_PETS_LABELS[o]}
              </option>
            ))}
          </SelectField>
        </div>
        <SelectField label="Crianças em casa?" optional value={d.children} onChange={(e) => set("children", e.target.value as Draft["children"])}>
          <option value="">Prefiro não dizer</option>
          <option value="yes">Sim</option>
          <option value="no">Não</option>
        </SelectField>
      </div>

      <div id="seeker-routine">
        <TextareaField
          label="Conte um pouco sobre sua rotina e o pet que procura"
          rows={4}
          maxLength={600}
          placeholder="Ex.: moro em apartamento, trabalho em home office, tenho tela nas janelas…"
          value={d.routine}
          onChange={(e) => set("routine", e.target.value)}
          error={errors.routine}
          hint="De 20 a 600 caracteres. Não escreva telefone, endereço nem documentos."
        />
      </div>

      <div className="grid gap-4 rounded-[14px] border border-border bg-surface-muted/60 p-4">
        <Switch
          checked={d.notify}
          onChange={(v) => set("notify", v)}
          label="Avisar quando houver um animal compatível"
          description="No máximo 3 avisos por dia, só de anúncios aprovados pela moderação."
        />
        <Switch
          checked={d.showPublic}
          onChange={(v) => set("showPublic", v)}
          label="Aparecer na lista pública “Querem adotar”"
          description="Mostra só o seu primeiro nome, o bairro e o que você procura. Desligado, seu perfil fica privado."
        />
      </div>

      <div id="seeker-consent" className="flex flex-col gap-1.5">
        <label className="flex cursor-pointer items-start gap-3 text-[14.5px]">
          <input
            type="checkbox"
            checked={d.consent}
            onChange={(e) => set("consent", e.target.checked)}
            aria-invalid={Boolean(errors.consent) || undefined}
            className="mt-0.5 size-5.5 shrink-0 accent-[var(--mel-primary)]"
          />
          <span>
            Concordo que a MEL guarde estas respostas para me avisar sobre animais compatíveis e que a moderação as revise. O interesse vale{" "}
            {SEEKER_VALID_DAYS} dias (posso renovar); sem renovação, é apagado {SEEKER_DELETE_AFTER_EXPIRY_DAYS} dias depois. Posso cancelar a qualquer
            momento, e aí apagamos tudo.
          </span>
        </label>
        {errors.consent && (
          <p role="alert" className="text-sm font-medium text-danger">
            {errors.consent}
          </p>
        )}
      </div>

      {error && <Alert tone="error">{error}</Alert>}
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button type="submit" loading={busy} loadingText="Enviando…">
          {viewer === "visitor"
            ? "Entrar e cadastrar meu interesse"
            : viewer === "onboarding"
              ? "Completar cadastro e continuar"
              : initial
                ? "Salvar alterações"
                : "Cadastrar meu interesse"}
        </Button>
        {onCancel && (
          <Button type="button" variant="secondary" onClick={onCancel} disabled={busy}>
            Voltar sem salvar
          </Button>
        )}
      </div>
      {viewer === "visitor" && (
        <p className="flex items-start gap-2 text-sm text-text-secondary">
          <Lock aria-hidden="true" className="mt-0.5 size-4 shrink-0" strokeWidth={2} />
          Para entrar na fila é preciso ter conta: assim só você edita, pausa ou cancela o seu interesse. O que você preencheu fica guardado nesta aba.
        </p>
      )}
    </form>
  );
}
