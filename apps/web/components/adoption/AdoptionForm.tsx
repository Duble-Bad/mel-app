"use client";

import { Camera, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { adoptionInputSchema, fieldErrors, PET_COLORS, PET_SEXES, PET_SIZES, type PetColor, type PetSex, type PetSize, publicAreaFrom, SEX_LABELS, SIZE_LABELS, type Species, SPECIES, SPECIES_LABELS, type Temperament, TEMPERAMENT_LABELS, TEMPERAMENTS, userErrorMessage } from "@mel/core";
import { createAdoption, uploadAdoptionPhoto } from "@mel/data";
import { prepareImage } from "@/lib/images";
import { getBrowserClient } from "@/lib/supabase/browser";
import { LocationPicker, type PickedLocation } from "@/components/location/LocationPicker";
import { BreedField } from "@/components/pets/BreedField";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { ChoiceGroup, MultiChoiceGroup, YesNoUnknown } from "@/components/ui/Choice";
import { SelectField, TextareaField, TextField } from "@/components/ui/Field";

const AGES: { months: number; label: string }[] = [
  { months: 3, label: "Filhote (até 6 meses)" },
  { months: 9, label: "Jovem (6 a 12 meses)" },
  { months: 24, label: "1 a 3 anos" },
  { months: 60, label: "4 a 7 anos" },
  { months: 108, label: "8 anos ou mais" },
];

const MAX_PHOTOS = 4;

/** Anúncio de adoção. Entra em análise da moderação antes de aparecer. */
export function AdoptionForm({ userId }: { userId: string }) {
  const [photos, setPhotos] = useState<{ file: File; url: string }[]>([]);
  const [name, setName] = useState("");
  const [species, setSpecies] = useState<Species | null>(null);
  const [sex, setSex] = useState<PetSex>("unknown");
  const [size, setSize] = useState<PetSize | null>(null);
  const [age, setAge] = useState("");
  const [breed, setBreed] = useState<string | null>(null);
  const [color, setColor] = useState<PetColor | null>(null);
  const [temperament, setTemperament] = useState<Temperament[]>([]);
  const [neutered, setNeutered] = useState<boolean | null>(null);
  const [vaccinated, setVaccinated] = useState<boolean | null>(null);
  const [dewormed, setDewormed] = useState<boolean | null>(null);
  const [description, setDescription] = useState("");
  const [requirements, setRequirements] = useState("");
  const [where, setWhere] = useState<PickedLocation | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const urls = useRef<string[]>([]);
  useEffect(() => () => urls.current.forEach((u) => URL.revokeObjectURL(u)), []);

  function addPhotos(files: FileList | null) {
    const list = [...(files ?? [])].slice(0, MAX_PHOTOS - photos.length).map((file) => {
      const url = URL.createObjectURL(file);
      urls.current.push(url);
      return { file, url };
    });
    setPhotos((p) => [...p, ...list]);
  }

  async function submit() {
    // Valida tudo antes de enviar fotos (photoPaths provisórios só para a checagem).
    const draft = {
      name,
      species: species ?? undefined,
      sex,
      size,
      ageMonths: age ? Number(age) : null,
      breed: breed ?? "",
      colorPrimary: color,
      temperament,
      neutered,
      vaccinated,
      dewormed,
      description,
      requirements,
      position: where?.position,
      areaLabel: where ? publicAreaFrom(where) : null,
    };
    const check = adoptionInputSchema.safeParse({ ...draft, photoPaths: photos.map((_, i) => `pending/${i}`) });
    if (!check.success) {
      const errs = fieldErrors(check.error);
      setErrors(errs);
      setError("Falta pouco: confira os campos destacados.");
      return;
    }
    setErrors({});
    setError(null);
    const client = getBrowserClient();
    try {
      setBusy("Enviando fotos…");
      const paths: string[] = [];
      for (const p of photos) paths.push(await uploadAdoptionPhoto(client, userId, await prepareImage(p.file)));
      setBusy("Publicando…");
      const code = await createAdoption(client, userId, adoptionInputSchema.parse({ ...draft, photoPaths: paths }));
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- página nova com o anúncio em análise
      window.location.assign(`/adocao/${code}?novo=1`);
    } catch (err) {
      setError(userErrorMessage(err, "Não conseguimos publicar agora. Tente de novo."));
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-col gap-7">
      <section aria-labelledby="fotos" className="flex flex-col gap-3">
        <h2 id="fotos" className="font-semibold">
          Fotos <span className="font-normal text-text-secondary">(1 a 4 — a primeira é a capa)</span>
        </h2>
        <div className="grid grid-cols-4 gap-2">
          {photos.map((p, i) => (
            <div key={p.url} className="relative aspect-square">
              {/* eslint-disable-next-line @next/next/no-img-element -- prévia local */}
              <img src={p.url} alt={`Foto ${i + 1}`} className="size-full rounded-md object-cover" />
              <button
                type="button"
                aria-label={`Remover foto ${i + 1}`}
                onClick={() => setPhotos((list) => list.filter((x) => x !== p))}
                className="absolute -top-1.5 -right-1.5 inline-flex size-8 items-center justify-center rounded-full border border-border bg-surface-elevated shadow-sm"
              >
                <X aria-hidden="true" className="size-3.5" strokeWidth={2} />
              </button>
            </div>
          ))}
          {photos.length < MAX_PHOTOS && (
            <label className="flex aspect-square cursor-pointer flex-col items-center justify-center gap-1 rounded-md border border-dashed border-border-strong bg-surface text-center text-sm text-text-secondary hover:bg-surface-muted has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-focus">
              <Camera aria-hidden="true" className="size-6 text-brand" strokeWidth={1.75} />
              Adicionar
              <input type="file" accept="image/*" multiple className="sr-only" aria-label="Fotos do animal" onChange={(e) => addPhotos(e.target.files)} />
            </label>
          )}
        </div>
        {errors.photoPaths && <p className="text-sm font-medium text-danger">{errors.photoPaths}</p>}
      </section>

      <TextField label="Nome" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} error={errors.name} />
      <ChoiceGroup name="ad-species" legend="É um…" value={species} onChange={(v) => { setSpecies(v); setBreed(null); }} error={errors.species} options={SPECIES.map((s) => ({ value: s, label: SPECIES_LABELS[s] }))} />
      <ChoiceGroup name="ad-sex" legend="Sexo" value={sex} onChange={setSex} options={PET_SEXES.map((s) => ({ value: s, label: SEX_LABELS[s] }))} />
      <ChoiceGroup name="ad-size" legend="Porte" optional value={size} onChange={setSize} options={PET_SIZES.map((s) => ({ value: s, label: SIZE_LABELS[s].label, hint: SIZE_LABELS[s].hint }))} />
      <SelectField label="Idade aproximada" optional value={age} onChange={(e) => setAge(e.target.value)}>
        <option value="">Não sei</option>
        {AGES.map((a) => (
          <option key={a.months} value={a.months}>
            {a.label}
          </option>
        ))}
      </SelectField>
      {species && species !== "other" && <BreedField species={species} value={breed} onChange={setBreed} />}
      <ChoiceGroup name="ad-color" legend="Cor principal" optional value={color} onChange={setColor} options={PET_COLORS.map((c) => ({ value: c.id, label: c.label }))} />
      <MultiChoiceGroup name="ad-temperament" legend="Jeito dele" optional columns={2} values={temperament} onChange={setTemperament} options={TEMPERAMENTS.map((t) => ({ value: t, label: TEMPERAMENT_LABELS[t] }))} />
      <YesNoUnknown name="ad-neutered" legend="É castrado?" value={neutered} onChange={setNeutered} />
      <YesNoUnknown name="ad-vaccinated" legend="Vacinas em dia?" value={vaccinated} onChange={setVaccinated} />
      <YesNoUnknown name="ad-dewormed" legend="Vermifugado?" value={dewormed} onChange={setDewormed} />
      <TextareaField
        label="Conte sobre ele"
        rows={5}
        maxLength={1500}
        placeholder="Como é o dia a dia dele, do que gosta, por que está para adoção…"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        error={errors.description}
      />
      <TextareaField
        label="Requisitos para adotar"
        optional
        rows={3}
        maxLength={500}
        placeholder="Ex.: casa com tela na janela; visita antes da adoção."
        value={requirements}
        onChange={(e) => setRequirements(e.target.value)}
      />
      <section aria-labelledby="regiao" className="flex flex-col gap-3">
        <h2 id="regiao" className="font-semibold">
          Região onde ele está
        </h2>
        <LocationPicker value={where} onChange={setWhere} privacyNote="Publicamos só o bairro e a cidade. O ponto exato fica privado." />
        {errors.position && <p className="text-sm font-medium text-danger">{errors.position}</p>}
      </section>

      <Alert tone="info">
        A equipe da MEL revisa cada anúncio antes de publicar. Nunca cobre pela adoção: a MEL não permite venda de animais.
      </Alert>
      {error && <Alert tone="error">{error}</Alert>}
      <Button onClick={submit} loading={Boolean(busy)} loadingText={busy}>
        Enviar para revisão
      </Button>
    </div>
  );
}
