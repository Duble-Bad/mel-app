"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent, type ReactNode } from "react";
import { Camera, ClipboardList, Lock, PawPrint, ScanEye, type LucideIcon } from "lucide-react";
import {
  AGE_OPTIONS,
  BR_STATES,
  fieldErrors,
  isValidBreed,
  parseDecimal,
  PET_COLORS,
  PET_SEXES,
  PET_SIZES,
  petInputSchema,
  petPrivateInputSchema,
  SEX_LABELS,
  SIZE_LABELS,
  SPECIES,
  SPECIES_LABELS,
  type Pet,
  type PetColor,
  type PetPrivateDetails,
  type PetSex,
  type PetSize,
  type Species,
} from "@mel/core";
import {
  addPetPhoto,
  createPet,
  removePetPhoto,
  savePetPrivateDetails,
  setPrimaryPetPhoto,
  updatePet,
} from "@mel/data";
import { getBrowserClient } from "@/lib/supabase/browser";
import { preparePhotoSet } from "@/lib/images";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { ChoiceGroup, MultiChoiceGroup, YesNoUnknown } from "@/components/ui/Choice";
import { SelectField, TextField } from "@/components/ui/Field";
import { InfoTip } from "@/components/ui/InfoTip";
import { StepCard, SteppedForm, type Step } from "@/components/ui/SteppedForm";
import { FillCityFromLocation } from "@/components/location/FillCityFromLocation";
import { BreedField } from "./BreedField";
import { PhotoManager } from "./PhotoManager";
import { PET_DESCRIPTION_COPY, PublicDescriptionField } from "./PublicDescriptionField";
import { limitedTextarea } from "@/components/ui/limitedText";
import { DateCalendar, isoDate } from "@/components/ui/DateCalendar";

interface PetFormProps {
  ownerId: string;
  /** Edição quando presente; cadastro quando ausente. */
  pet?: Pet;
  privateDetails?: PetPrivateDetails;
  /** Cidade/estado do tutor como sugestão no cadastro. */
  defaultCity?: string | null;
  defaultState?: string | null;
  /** Conteúdo extra no fim do menu lateral (ex.: excluir o pet). */
  asideFooter?: ReactNode;
}

type SectionId = "fotos" | "basico" | "aparencia" | "detalhes" | "privado";

const SECTIONS: { id: SectionId; title: string; Icon: LucideIcon }[] = [
  { id: "fotos", title: "Fotos", Icon: Camera },
  { id: "basico", title: "Identificação", Icon: PawPrint },
  { id: "aparencia", title: "Como reconhecer", Icon: ScanEye },
  { id: "detalhes", title: "Mais detalhes", Icon: ClipboardList },
  { id: "privado", title: "Privacidade", Icon: Lock },
];

/** Em qual etapa fica cada campo (para abrir a etapa certa quando há erro). */
const FIELD_SECTION: Record<string, SectionId> = {
  name: "basico",
  species: "basico",
  breed: "basico",
  sex: "basico",
  size: "basico",
  colorPrimary: "aparencia",
  colorsSecondary: "aparencia",
  uniqueMarks: "aparencia",
  birthDate: "detalhes",
  ageEstimateMonths: "detalhes",
  weightKg: "detalhes",
  description: "detalhes",
  city: "detalhes",
  state: "detalhes",
  microchipNumber: "privado",
  hiddenMarks: "privado",
  ownershipNotes: "privado",
};

const textarea =
  "block w-full rounded-md border-2 border-border-strong bg-surface px-4 py-3 text-base focus:border-focus focus:outline-none";

/**
 * Cadastro e edição do pet. Celular: uma coluna, seções em cartões, um botão no fim.
 * Desktop (lg): menu de etapas à esquerda (fixo, com o botão de salvar sempre à mão) e uma etapa
 * por vez à direita, com os campos lado a lado — nada de formulário estreito e comprido.
 */
export function PetForm({ ownerId, pet, privateDetails, defaultCity, defaultState, asideFooter }: PetFormProps) {
  const router = useRouter();
  const isEdit = Boolean(pet);

  const [name, setName] = useState(pet?.name ?? "");
  const [species, setSpecies] = useState<Species | null>(pet?.species ?? null);
  const [sex, setSex] = useState<PetSex>(pet?.sex ?? "unknown");
  const [size, setSize] = useState<PetSize | null>(pet?.size ?? null);
  const [breed, setBreed] = useState<string | null>(pet?.breed ?? null);
  const [colorPrimary, setColorPrimary] = useState<PetColor | null>(pet?.colorPrimary ?? null);
  const [colorsSecondary, setColorsSecondary] = useState<PetColor[]>(pet?.colorsSecondary ?? []);
  const [uniqueMarks, setUniqueMarks] = useState(pet?.uniqueMarks ?? "");
  const [birthDate, setBirthDate] = useState(pet?.birthDate ?? "");
  const [ageEstimate, setAgeEstimate] = useState(pet?.ageEstimateMonths?.toString() ?? "");
  const [weight, setWeight] = useState(pet?.weightKg?.toString().replace(".", ",") ?? "");
  const [neutered, setNeutered] = useState<boolean | null>(pet?.neutered ?? null);
  const [hasMicrochip, setHasMicrochip] = useState<boolean | null>(pet?.hasMicrochip ?? null);
  const [description, setDescription] = useState(pet?.description ?? "");
  const [city, setCity] = useState(pet?.city ?? defaultCity ?? "");
  const [state, setState] = useState(pet?.state ?? defaultState ?? "");
  const [isPublic, setIsPublic] = useState(pet?.isPublic ?? false);
  const [microchipNumber, setMicrochipNumber] = useState(privateDetails?.microchipNumber ?? "");
  const [hiddenMarks, setHiddenMarks] = useState(privateDetails?.hiddenMarks ?? "");
  const [ownershipNotes, setOwnershipNotes] = useState(privateDetails?.ownershipNotes ?? "");

  const [pendingPhotos, setPendingPhotos] = useState<File[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Etapa visível no desktop (no celular todas aparecem).
  const [active, setActive] = useState<SectionId>(isEdit ? "basico" : "fotos");

  const photoCount = (pet?.photos.length ?? 0) + pendingPhotos.length;
  const filled: Record<SectionId, boolean> = {
    fotos: photoCount > 0,
    basico: Boolean(name.trim() && species),
    aparencia: Boolean(colorPrimary || uniqueMarks.trim()),
    detalhes: Boolean(birthDate || ageEstimate || weight || neutered != null || hasMicrochip != null || description.trim() || city.trim()),
    privado: Boolean(microchipNumber || hiddenMarks.trim() || ownershipNotes.trim() || isPublic),
  };
  const sectionErrors = new Set(Object.keys(errors).map((k) => FIELD_SECTION[k]).filter(Boolean));


  async function handlePhotoAction(action: () => Promise<void>) {
    setBusy(true);
    setFormError(null);
    try {
      await action();
      router.refresh();
    } catch {
      setFormError("Não conseguimos atualizar a foto agora. Tente de novo.");
    } finally {
      setBusy(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    const parsed = petInputSchema.safeParse({
      name,
      species,
      breed,
      sex,
      birthDate: birthDate || null,
      ageEstimateMonths: ageEstimate ? Number(ageEstimate) : null,
      size,
      weightKg: parseDecimal(weight),
      colorPrimary,
      colorsSecondary,
      description,
      uniqueMarks,
      neutered,
      hasMicrochip,
      city,
      state: state || null,
      isPublic,
    });
    const parsedPrivate = petPrivateInputSchema.safeParse({ microchipNumber, hiddenMarks, ownershipNotes });
    if (!parsed.success || !parsedPrivate.success) {
      const errs = {
        ...(parsed.success ? {} : fieldErrors(parsed.error)),
        ...(parsedPrivate.success ? {} : fieldErrors(parsedPrivate.error)),
      };
      setErrors(errs);
      setFormError("Confira os campos destacados.");
      const first = Object.keys(errs)[0];
      // Desktop: abre a etapa do primeiro erro antes de rolar até o campo.
      if (first && FIELD_SECTION[first]) setActive(FIELD_SECTION[first]);
      requestAnimationFrame(() => document.getElementById(`field-${first}`)?.scrollIntoView({ block: "center" }));
      return;
    }
    setErrors({});
    setBusy(true);

    const supabase = getBrowserClient();
    let saved: Pet;
    try {
      setProgress(isEdit ? "Salvando…" : "Cadastrando…");
      saved = pet ? await updatePet(supabase, pet.id, parsed.data) : await createPet(supabase, ownerId, parsed.data);
      const priv = parsedPrivate.data;
      if (pet || priv.microchipNumber || priv.hiddenMarks || priv.ownershipNotes) {
        await savePetPrivateDetails(supabase, saved, priv);
      }
    } catch (error) {
      console.error("[PetForm] falhou ao salvar", error);
      setFormError("Não conseguimos salvar agora. Verifique sua conexão e tente de novo.");
      setProgress(null);
      setBusy(false);
      return;
    }

    // Fotos depois do pet: se alguma falhar, o cadastro não se perde.
    let failedPhotos = 0;
    for (const [i, file] of pendingPhotos.entries()) {
      setProgress(`Enviando foto ${i + 1} de ${pendingPhotos.length}…`);
      try {
        // Sem fotos anteriores, a primeira enviada (posição 0) vira a principal.
        await addPetPhoto(supabase, saved, await preparePhotoSet(file), saved.photos.length + i);
      } catch (error) {
        console.error("[PetForm] foto falhou", error);
        failedPhotos += 1;
      }
    }

    const params = new URLSearchParams({ [isEdit ? "salvo" : "novo"]: "1" });
    if (failedPhotos) params.set("fotos_falharam", String(failedPhotos));
    router.replace(`/perfil/pets/${saved.id}?${params}`);
    router.refresh();
    setPendingPhotos([]);
    setProgress(null);
    setBusy(false);
  }

  const submitLabel = isEdit ? "Salvar alterações" : "Cadastrar pet";
  const steps: Step<SectionId>[] = SECTIONS.map((sec) => ({
    ...sec,
    done: filled[sec.id],
    error: sectionErrors.has(sec.id),
    status: sec.id === "basico" ? "Obrigatório" : sec.id === "fotos" ? `${photoCount} de 6` : filled[sec.id] ? "Preenchido" : "Opcional",
  }));
  const step = (id: SectionId) => SECTIONS.find((x) => x.id === id)!;

  return (
    <form onSubmit={handleSubmit} noValidate>
      <SteppedForm
        steps={steps}
        active={active}
        onActiveChange={setActive}
        asideFooter={asideFooter}
        before={formError && <Alert tone="error">{formError}</Alert>}
        submit={(where) => (
          <Button
            type="submit"
            size={where === "last" ? "md" : "lg"}
            className={where === "last" ? "w-auto" : "w-full"}
            loading={busy}
            loadingText={progress ?? "Salvando…"}
          >
            {submitLabel}
          </Button>
        )}
      >
        <StepCard {...step("fotos")}>
          <PhotoManager
            existing={pet?.photos ?? []}
            pending={pendingPhotos}
            onPendingChange={setPendingPhotos}
            busy={busy}
            compact
            onMakePrimary={pet ? (id) => handlePhotoAction(() => setPrimaryPetPhoto(getBrowserClient(), pet.id, id)) : undefined}
            onRemoveExisting={pet ? (id) => handlePhotoAction(() => removePetPhoto(getBrowserClient(), id)) : undefined}
          />
        </StepCard>

        <StepCard {...step("basico")}>
          <div className="grid gap-5 lg:grid-cols-2 lg:gap-x-6">
            <div id="field-name">
              <TextField label="Nome" name="name" value={name} onChange={(e) => setName(e.target.value)} required error={errors.name} />
            </div>
            <div id="field-species">
              <ChoiceGroup
                name="species"
                legend="Espécie"
                value={species}
                onChange={(next) => {
                  setSpecies(next);
                  // Raça de cachorro não serve para gato (e vice-versa).
                  if (breed && !isValidBreed(next, breed)) setBreed(null);
                }}
                error={errors.species}
                options={SPECIES.map((s) => ({ value: s, label: SPECIES_LABELS[s] }))}
              />
            </div>
            {/* Raça logo depois da espécie: a lista depende dela. */}
            <div id="field-breed">
              <BreedField species={species} value={breed} onChange={setBreed} error={errors.breed} />
            </div>
            <ChoiceGroup
              name="sex"
              legend="Sexo"
              value={sex}
              onChange={setSex}
              options={PET_SEXES.map((s) => ({ value: s, label: SEX_LABELS[s] }))}
            />
            <div className="lg:col-span-2">
              <ChoiceGroup
                name="size"
                legend="Porte"
                optional
                columns={5}
                value={size}
                onChange={setSize}
                options={PET_SIZES.map((s) => ({ value: s, label: SIZE_LABELS[s].label, hint: SIZE_LABELS[s].hint }))}
              />
            </div>
          </div>
        </StepCard>

        <StepCard {...step("aparencia")}>
          <div className="flex flex-col gap-5">
            <ChoiceGroup
              name="colorPrimary"
              legend="Cor principal"
              optional
              columns={6}
              value={colorPrimary}
              onChange={setColorPrimary}
              options={PET_COLORS.map((c) => ({ value: c.id, label: c.label }))}
            />
            {colorPrimary && (
              <MultiChoiceGroup
                name="colorsSecondary"
                legend="Outras cores"
                optional
                columns={6}
                values={colorsSecondary}
                onChange={setColorsSecondary}
                error={errors.colorsSecondary}
                options={PET_COLORS.filter((c) => c.id !== colorPrimary).map((c) => ({ value: c.id, label: c.label }))}
              />
            )}
            <div id="field-uniqueMarks">
              <PublicDescriptionField
                id="uniqueMarks"
                label={PET_DESCRIPTION_COPY.label}
                guidance={PET_DESCRIPTION_COPY.guidance}
                placeholder={PET_DESCRIPTION_COPY.placeholder}
                rows={4}
                className={textarea}
                value={uniqueMarks}
                onChange={setUniqueMarks}
                error={errors.uniqueMarks}
              />
            </div>
          </div>
        </StepCard>

        <StepCard {...step("detalhes")} aside={<span className="text-sm text-text-secondary">· pode completar depois</span>}>
          <div className="grid gap-5 lg:grid-cols-2 lg:gap-x-6">
            <div id="field-birthDate">
              <DateCalendar
                label="Data de nascimento"
                name="birthDate"
                optional
                max={isoDate(new Date())}
                value={birthDate}
                onChange={setBirthDate}
                error={errors.birthDate}
              />
            </div>
            {!birthDate && (
              <SelectField label="Idade aproximada" name="ageEstimate" optional value={ageEstimate} onChange={(e) => setAgeEstimate(e.target.value)}>
                <option value="">Não sei</option>
                {AGE_OPTIONS.map((a) => (
                  <option key={a.months} value={a.months}>
                    {a.label}
                  </option>
                ))}
              </SelectField>
            )}
            <div id="field-weightKg">
              <TextField
                label="Peso aproximado (kg)"
                name="weight"
                inputMode="decimal"
                optional
                placeholder="Ex.: 3,5"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                error={errors.weightKg}
              />
            </div>
            <YesNoUnknown name="neutered" legend="É castrado(a)?" value={neutered} onChange={setNeutered} />
            <YesNoUnknown name="hasMicrochip" legend="Tem microchip?" value={hasMicrochip} onChange={setHasMicrochip} />
            <div className="flex flex-col gap-1.5 lg:col-span-2">
              <label htmlFor="description" className="text-sm font-semibold">
                Sobre o pet <span className="font-normal text-text-secondary">(opcional)</span>
              </label>
              <textarea
                id="description"
                rows={3}
                className={textarea}
                placeholder="Jeito, se é medroso, se atende pelo nome…"
                {...limitedTextarea(description, setDescription, 1000)}
              />
              <p className="text-right text-xs text-text-secondary tabular-nums">{description.length}/1000</p>
              {errors.description && <p className="text-sm font-medium text-danger">{errors.description}</p>}
            </div>
            <div className="flex flex-col gap-2">
              <TextField label="Cidade" name="city" optional value={city} onChange={(e) => setCity(e.target.value)} error={errors.city} />
              <FillCityFromLocation
                onFill={(c, uf) => {
                  setCity(c);
                  if (uf) setState(uf);
                }}
              />
            </div>
            <SelectField label="Estado" name="state" optional value={state} onChange={(e) => setState(e.target.value)}>
              <option value="">Escolha o estado</option>
              {BR_STATES.map((s) => (
                <option key={s.uf} value={s.uf}>
                  {s.name}
                </option>
              ))}
            </SelectField>
          </div>
        </StepCard>

        <StepCard
          {...step("privado")}
          aside={
            <InfoTip label="Quem vê estas informações">
              Os campos de &quot;Só para você&quot; ninguém mais vê. Eles ajudam a provar que o pet é seu se alguém o encontrar.
            </InfoTip>
          }
        >
          <div className="flex flex-col gap-5 rounded-xl bg-surface-muted p-4 sm:p-5">
            <p className="flex items-center gap-2 font-semibold">
              <Lock aria-hidden="true" className="size-4 text-text-secondary" strokeWidth={2.25} />
              Só para você
            </p>
            <div className="grid gap-5 lg:grid-cols-2 lg:gap-x-6">
              <div className="lg:col-span-2 lg:max-w-[calc(50%-12px)]">
                <TextField
                  label="Número do microchip"
                  name="microchipNumber"
                  inputMode="numeric"
                  optional
                  value={microchipNumber}
                  onChange={(e) => setMicrochipNumber(e.target.value)}
                  error={errors.microchipNumber}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="hiddenMarks" className="text-sm font-semibold">
                  Sinais que só você conhece <span className="font-normal text-text-secondary">(opcional)</span>
                </label>
                <textarea
                  id="hiddenMarks"
                  rows={3}
                  className={textarea}
                  placeholder="Ex.: cicatriz na barriga, unha diferente, manchinha escondida."
                  {...limitedTextarea(hiddenMarks, setHiddenMarks, 500)}
                />
                <p className="text-right text-xs text-text-secondary tabular-nums">{hiddenMarks.length}/500</p>
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="ownershipNotes" className="text-sm font-semibold">
                  Outras provas de posse <span className="font-normal text-text-secondary">(opcional)</span>
                </label>
                <textarea
                  id="ownershipNotes"
                  rows={3}
                  className={textarea}
                  placeholder="Ex.: carteira de vacinação, fotos antigas, nota da adoção."
                  {...limitedTextarea(ownershipNotes, setOwnershipNotes, 1000)}
                />
                <p className="text-right text-xs text-text-secondary tabular-nums">{ownershipNotes.length}/1000</p>
              </div>
            </div>
          </div>

          <div className="mt-5 flex items-start gap-1">
            <label className="flex min-h-12 items-start gap-3">
              <input
                type="checkbox"
                checked={isPublic}
                onChange={(e) => setIsPublic(e.target.checked)}
                className="mt-1 size-5 shrink-0 accent-primary"
              />
              <span className="font-semibold">Deixar a página do pet visível para qualquer pessoa</span>
            </label>
            <InfoTip label="Para que serve a página pública">
              Útil para plaquinha com QR Code. Se ele se perder, o alerta é publicado de qualquer forma.
            </InfoTip>
          </div>
        </StepCard>
      </SteppedForm>
    </form>
  );
}
