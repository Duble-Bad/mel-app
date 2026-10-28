"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
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
import { BreedField } from "./BreedField";
import { PhotoManager } from "./PhotoManager";

interface PetFormProps {
  ownerId: string;
  /** Edição quando presente; cadastro quando ausente. */
  pet?: Pet;
  privateDetails?: PetPrivateDetails;
  /** Cidade/estado do tutor como sugestão no cadastro. */
  defaultCity?: string | null;
  defaultState?: string | null;
}

const textarea =
  "block w-full rounded-md border-2 border-border-strong bg-surface px-4 py-3 text-base focus:border-focus focus:outline-none";

export function PetForm({ ownerId, pet, privateDetails, defaultCity, defaultState }: PetFormProps) {
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
      document.getElementById(`field-${Object.keys(errs)[0]}`)?.scrollIntoView({ block: "center" });
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

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-8">
      {formError && <Alert tone="error">{formError}</Alert>}

      <section className="flex flex-col gap-5" aria-labelledby="sec-basico">
        <h2 id="sec-basico" className="text-lg font-bold">
          O básico
        </h2>
        <PhotoManager
          existing={pet?.photos ?? []}
          pending={pendingPhotos}
          onPendingChange={setPendingPhotos}
          busy={busy}
          onMakePrimary={pet ? (id) => handlePhotoAction(() => setPrimaryPetPhoto(getBrowserClient(), pet.id, id)) : undefined}
          onRemoveExisting={pet ? (id) => handlePhotoAction(() => removePetPhoto(getBrowserClient(), id)) : undefined}
        />
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
        <ChoiceGroup
          name="size"
          legend="Porte"
          optional
          value={size}
          onChange={setSize}
          options={PET_SIZES.map((s) => ({ value: s, label: SIZE_LABELS[s].label, hint: SIZE_LABELS[s].hint }))}
        />
      </section>

      <section className="flex flex-col gap-5" aria-labelledby="sec-aparencia">
        <h2 id="sec-aparencia" className="text-lg font-bold">
          Como reconhecer
        </h2>
        <ChoiceGroup
          name="colorPrimary"
          legend="Cor principal"
          optional
          value={colorPrimary}
          onChange={setColorPrimary}
          options={PET_COLORS.map((c) => ({ value: c.id, label: c.label }))}
        />
        {colorPrimary && (
          <MultiChoiceGroup
            name="colorsSecondary"
            legend="Outras cores"
            optional
            values={colorsSecondary}
            onChange={setColorsSecondary}
            error={errors.colorsSecondary}
            options={PET_COLORS.filter((c) => c.id !== colorPrimary).map((c) => ({ value: c.id, label: c.label }))}
          />
        )}
        <div className="flex flex-col gap-1.5" id="field-uniqueMarks">
          <label htmlFor="uniqueMarks" className="font-semibold">
            Características marcantes <span className="font-normal text-text-secondary">(opcional)</span>
          </label>
          <p className="text-sm text-text-secondary">Visíveis para todos. Ex.: orelha caída, mancha no olho, rabo curto.</p>
          <textarea
            id="uniqueMarks"
            rows={3}
            className={textarea}
            value={uniqueMarks}
            onChange={(e) => setUniqueMarks(e.target.value)}
          />
          {errors.uniqueMarks && <p className="text-sm font-medium text-danger">{errors.uniqueMarks}</p>}
        </div>
      </section>

      <section className="flex flex-col gap-5" aria-labelledby="sec-detalhes">
        <h2 id="sec-detalhes" className="text-lg font-bold">
          Mais detalhes <span className="text-base font-normal text-text-secondary">(pode completar depois)</span>
        </h2>
        <div id="field-birthDate">
          <TextField
            label="Data de nascimento"
            name="birthDate"
            type="date"
            optional
            max={new Date().toISOString().slice(0, 10)}
            value={birthDate}
            onChange={(e) => setBirthDate(e.target.value)}
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
        <div className="flex flex-col gap-1.5">
          <label htmlFor="description" className="font-semibold">
            Sobre o pet <span className="font-normal text-text-secondary">(opcional)</span>
          </label>
          <p className="text-sm text-text-secondary">Jeito, se é medroso, se atende pelo nome…</p>
          <textarea id="description" rows={4} className={textarea} value={description} onChange={(e) => setDescription(e.target.value)} />
          {errors.description && <p className="text-sm font-medium text-danger">{errors.description}</p>}
        </div>
        <TextField label="Cidade" name="city" optional value={city} onChange={(e) => setCity(e.target.value)} error={errors.city} />
        <SelectField label="Estado" name="state" optional value={state} onChange={(e) => setState(e.target.value)}>
          <option value="">Escolha o estado</option>
          {BR_STATES.map((s) => (
            <option key={s.uf} value={s.uf}>
              {s.name}
            </option>
          ))}
        </SelectField>
      </section>

      <section className="flex flex-col gap-4 rounded-lg bg-surface-muted p-4" aria-labelledby="sec-privado">
        <div>
          <h2 id="sec-privado" className="text-lg font-bold">
            <span aria-hidden="true">🔒 </span>Só para você
          </h2>
          <p className="text-sm text-text-secondary">
            Ninguém mais vê estas informações. Elas ajudam a provar que o pet é seu se alguém o encontrar.
          </p>
        </div>
        <TextField
          label="Número do microchip"
          name="microchipNumber"
          inputMode="numeric"
          optional
          value={microchipNumber}
          onChange={(e) => setMicrochipNumber(e.target.value)}
          error={errors.microchipNumber}
        />
        <div className="flex flex-col gap-1.5">
          <label htmlFor="hiddenMarks" className="font-semibold">
            Sinais que só você conhece <span className="font-normal text-text-secondary">(opcional)</span>
          </label>
          <p className="text-sm text-text-secondary">Ex.: cicatriz na barriga, unha diferente, manchinha escondida.</p>
          <textarea id="hiddenMarks" rows={3} className={textarea} value={hiddenMarks} onChange={(e) => setHiddenMarks(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="ownershipNotes" className="font-semibold">
            Outras provas de posse <span className="font-normal text-text-secondary">(opcional)</span>
          </label>
          <p className="text-sm text-text-secondary">Ex.: tenho carteira de vacinação, fotos antigas, nota da adoção.</p>
          <textarea id="ownershipNotes" rows={3} className={textarea} value={ownershipNotes} onChange={(e) => setOwnershipNotes(e.target.value)} />
        </div>
      </section>

      <label className="flex min-h-12 items-start gap-3">
        <input
          type="checkbox"
          checked={isPublic}
          onChange={(e) => setIsPublic(e.target.checked)}
          className="mt-1 size-5 shrink-0 accent-brand-primary"
        />
        <span>
          <span className="font-semibold">Deixar a página do pet visível para qualquer pessoa</span>
          <span className="block text-sm text-text-secondary">
            Útil para plaquinha com QR Code. Se ele se perder, o alerta é publicado de qualquer forma.
          </span>
        </span>
      </label>

      <Button type="submit" loading={busy} loadingText={progress ?? "Salvando…"}>
        {isEdit ? "Salvar alterações" : "Cadastrar pet"}
      </Button>
    </form>
  );
}
