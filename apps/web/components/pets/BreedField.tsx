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
    // Nada de campo cinza "travado": diz exatamente o que fazer.
    return (
      <div className="flex flex-col gap-1.5" data-testid="breed-needs-species">
        <p className="font-semibold">
          Raça <span className="font-normal text-text-secondary">(opcional)</span>
        </p>
        <p className="rounded-md bg-surface-muted px-4 py-3 text-text-secondary">
          Escolha <strong className="text-text-primary">Cachorro</strong> ou{" "}
          <strong className="text-text-primary">Gato</strong> acima para ver a lista de raças.
        </p>
      </div>
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
