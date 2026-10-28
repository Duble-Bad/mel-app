import type { Pet } from "@mel/core";
import { primaryPhoto } from "@mel/core";

const sizes = { sm: "size-14", md: "size-20", lg: "size-28" } as const;
const SPECIES_ICON = { dog: "🐶", cat: "🐱", other: "🐾" } as const;

/** Foto principal do pet (miniatura) ou ícone da espécie. */
export function PetAvatar({ pet, size = "md" }: { pet: Pick<Pet, "name" | "species" | "photos">; size?: keyof typeof sizes }) {
  const photo = primaryPhoto(pet);
  return (
    <div className={`${sizes[size]} shrink-0 overflow-hidden rounded-lg bg-surface-muted`}>
      {photo ? (
        // eslint-disable-next-line @next/next/no-img-element -- miniatura já otimizada no upload (400px)
        <img src={photo.thumbUrl} alt={`Foto de ${pet.name}`} loading="lazy" className="size-full object-cover" />
      ) : (
        <span role="img" aria-label={`${pet.name}, sem foto`} className="flex size-full items-center justify-center text-3xl">
          {SPECIES_ICON[pet.species]}
        </span>
      )}
    </div>
  );
}
