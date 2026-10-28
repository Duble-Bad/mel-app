"use client";

import { useState } from "react";
import {
  fieldErrors,
  PET_COLORS,
  PET_SIZES,
  petInputSchema,
  SIZE_LABELS,
  SPECIES,
  SPECIES_LABELS,
  type Pet,
  type PetColor,
  type PetSize,
  type Species,
} from "@mel/core";
import { addPetPhoto, createPet, getPet } from "@mel/data";
import { getBrowserClient } from "@/lib/supabase/browser";
import { preparePhotoSet } from "@/lib/images";
import { Button } from "@/components/ui/Button";
import { ChoiceGroup } from "@/components/ui/Choice";
import { TextField } from "@/components/ui/Field";

/**
 * Cadastro relâmpago dentro do "Perdi meu pet": só foto, nome, espécie, porte
 * e cor. O resto pode ser completado depois, com calma.
 */
export function QuickPetForm({
  ownerId,
  city,
  state,
  onCreated,
}: {
  ownerId: string;
  city: string | null;
  state: string | null;
  /** `warning`: algo não impediu o cadastro, mas a pessoa precisa saber. */
  onCreated: (pet: Pet, warning?: string) => void;
}) {
  const [photo, setPhoto] = useState<File | null>(null);
  const [name, setName] = useState("");
  const [species, setSpecies] = useState<Species | null>(null);
  const [size, setSize] = useState<PetSize | null>(null);
  const [color, setColor] = useState<PetColor | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function submit() {
    setError(null);
    const parsed = petInputSchema.safeParse({ name, species, size, colorPrimary: color, city, state });
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      return;
    }
    setErrors({});
    const supabase = getBrowserClient();
    try {
      setBusy("Cadastrando…");
      let pet = await createPet(supabase, ownerId, parsed.data);
      let warning: string | undefined;
      if (photo) {
        setBusy("Enviando foto…");
        try {
          await addPetPhoto(supabase, pet, await preparePhotoSet(photo), 0);
          pet = (await getPet(supabase, pet.id)) ?? pet;
        } catch (err) {
          // A foto pode ser adicionada depois; o alerta não pode esperar.
          console.error("[QuickPetForm] foto falhou", err);
          warning = "O pet foi cadastrado, mas a foto não foi enviada. Você pode adicioná-la depois em Meus pets.";
        }
      }
      onCreated(pet, warning);
    } catch (err) {
      console.error("[QuickPetForm] falhou", err);
      setError("Não conseguimos cadastrar agora. Verifique a conexão e tente de novo.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-col gap-5 rounded-lg border-2 border-border bg-surface p-4">
      <div className="flex flex-col gap-1.5">
        <span className="font-semibold">
          Foto <span className="font-normal text-text-secondary">(ajuda muito)</span>
        </span>
        <label className="flex min-h-14 cursor-pointer items-center justify-center gap-2 rounded-md border-2 border-dashed border-border-strong font-semibold has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-focus">
          <span aria-hidden="true">📷</span> {photo ? `Foto escolhida: ${photo.name}` : "Tirar ou escolher foto"}
          <input
            type="file"
            accept="image/*"
            className="sr-only"
            aria-label="Foto do pet"
            onChange={(e) => setPhoto(e.target.files?.[0] ?? null)}
          />
        </label>
      </div>
      <TextField label="Nome do pet" value={name} onChange={(e) => setName(e.target.value)} error={errors.name} />
      <ChoiceGroup
        name="quick-species"
        legend="Espécie"
        value={species}
        onChange={setSpecies}
        error={errors.species}
        options={SPECIES.map((s) => ({ value: s, label: SPECIES_LABELS[s] }))}
      />
      <ChoiceGroup
        name="quick-size"
        legend="Porte"
        optional
        value={size}
        onChange={setSize}
        options={PET_SIZES.map((s) => ({ value: s, label: SIZE_LABELS[s].label, hint: SIZE_LABELS[s].hint }))}
      />
      <ChoiceGroup
        name="quick-color"
        legend="Cor principal"
        optional
        value={color}
        onChange={setColor}
        options={PET_COLORS.map((c) => ({ value: c.id, label: c.label }))}
      />
      {error && (
        <p role="alert" className="font-medium text-danger">
          {error}
        </p>
      )}
      <Button onClick={submit} loading={Boolean(busy)} loadingText={busy ?? "Aguarde…"}>
        Cadastrar e continuar
      </Button>
    </div>
  );
}
