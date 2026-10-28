"use client";

import { useCallback, useMemo } from "react";
import { breedsFor, searchBreeds, SRD, SRD_LABEL, type Species } from "@mel/core";
import { Combobox, type ComboboxOption } from "@/components/ui/Combobox";
import { TextField } from "@/components/ui/Field";

const PINNED: ComboboxOption[] = [{ value: SRD, label: SRD_LABEL }];

/** Raça: lista com busca para cães e gatos; texto livre para outras espécies. */
export function BreedField({
  species,
  value,
  onChange,
  error,
}: {
  species: Species | null;
  value: string | null;
  onChange: (value: string | null) => void;
  error?: string;
}) {
  const list = breedsFor(species);
  const options = useMemo(() => (list ?? []).map((b) => ({ value: b, label: b })), [list]);
  const filter = useCallback((opts: ComboboxOption[], query: string) => {
    const labels = searchBreeds(
      opts.map((o) => o.label),
      query,
    );
    return labels.map((label) => opts.find((o) => o.label === label)!);
  }, []);

  if (!species) {
    return (
      <TextField
        label="Raça"
        name="breed"
        optional
        disabled
        placeholder="Escolha a espécie primeiro"
        value=""
        onChange={() => {}}
      />
    );
  }

  if (!list) {
    return (
      <TextField
        label="Raça ou tipo"
        name="breed"
        optional
        hint="Ex.: Calopsita, Coelho mini lop, Hamster sírio."
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value || null)}
        error={error}
      />
    );
  }

  return (
    <Combobox
      label="Raça"
      optional
      hint="Digite para buscar. Se não tiver raça definida, escolha a primeira opção."
      placeholder="Ex.: Yorkshire, Labrador, Persa…"
      pinned={PINNED}
      options={options}
      filter={filter}
      value={value}
      onChange={onChange}
      error={error}
      emptyText="Não encontramos essa raça. Se não tiver certeza, escolha “Sem raça definida”."
    />
  );
}
