"use client";

import { Check, Crop, ImagePlus, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
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
import { PhotoCropDialog } from "@/components/pets/PhotoCropDialog";

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
  // `original`: o arquivo escolhido (para ajustar de novo); `photo`: o que será enviado (recortado ou não).
  const [original, setOriginal] = useState<File | null>(null);
  const [photo, setPhoto] = useState<File | null>(null);
  const [cropping, setCropping] = useState<File | null>(null);
  // Miniatura: o endereço é criado e o anterior revogado no mesmo ponto em que a foto muda (com
  // useMemo + limpeza de efeito, o StrictMode revogava o endereço e a miniatura ficava quebrada).
  const [preview, setPreview] = useState<string | null>(null);
  const previewRef = useRef<string | null>(null);
  useEffect(() => () => void (previewRef.current && URL.revokeObjectURL(previewRef.current)), []);
  const setPhotos = (orig: File | null, final: File | null) => {
    setOriginal(orig);
    setPhoto(final);
    if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    previewRef.current = final ? URL.createObjectURL(final) : null;
    setPreview(previewRef.current);
  };
  /** Arquivo escolhido: abre o recorte (a foto só entra depois de "Usar"; cancelar mantém a anterior). */
  const pick = (input: HTMLInputElement) => {
    const f = input.files?.[0];
    input.value = "";
    if (f) setCropping(f);
  };
  const small =
    "inline-flex min-h-11 items-center gap-1.5 rounded-md border border-border-strong bg-surface-elevated px-3 text-sm font-semibold transition-colors duration-200 ease-mel hover:bg-surface-muted";
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
        {photo && preview ? (
          // Miniatura: confirma que a foto foi carregada (já com o recorte escolhido).
          <div className="flex items-center gap-3 rounded-md border-2 border-border bg-surface p-2" data-testid="foto-escolhida">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={preview} alt="Foto escolhida do pet" className="size-24 shrink-0 rounded-md object-cover" />
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <p role="status" className="flex items-center gap-1.5 text-sm font-semibold text-status-found">
                <Check aria-hidden="true" className="size-4" /> Foto carregada
              </p>
              <div className="flex flex-wrap gap-2">
                <button type="button" className={small} onClick={() => setCropping(original ?? photo)}>
                  <Crop aria-hidden="true" className="size-4" /> Ajustar
                </button>
                <label className={`${small} cursor-pointer has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-focus`}>
                  <ImagePlus aria-hidden="true" className="size-4" /> Trocar
                  <input type="file" accept="image/*" className="sr-only" aria-label="Trocar a foto do pet" onChange={(e) => pick(e.target)} />
                </label>
                <button type="button" className={small} onClick={() => setPhotos(null, null)}>
                  <Trash2 aria-hidden="true" className="size-4" /> Remover
                </button>
              </div>
            </div>
          </div>
        ) : (
          // Sem "tirar": o próprio celular oferece câmera ou galeria ao escolher.
          <label className="flex min-h-14 cursor-pointer items-center justify-center gap-2 rounded-md border-2 border-dashed border-border-strong px-3 text-center font-semibold has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-focus">
            <ImagePlus aria-hidden="true" className="size-5 shrink-0" /> Escolher foto do pet
            <input type="file" accept="image/*" className="sr-only" aria-label="Foto do pet" onChange={(e) => pick(e.target)} />
          </label>
        )}
        <p className="text-sm text-text-secondary">Uma foto nítida, de preferência mostrando o rosto. Depois de escolher, você pode recortar e ajustar.</p>
      </div>
      {cropping && (
        <PhotoCropDialog
          file={cropping}
          onApply={(f) => {
            setPhotos(cropping, f);
            setCropping(null);
          }}
          onCancel={() => setCropping(null)}
        />
      )}
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
