import Link from "next/link";
import { petSummary, type Pet } from "@mel/core";
import { PetAvatar } from "./PetAvatar";

/** Card de pet. `href` define para onde o card leva (edição do dono ou página pública). */
export function PetCard({ pet, href }: { pet: Pet; href: string }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-4 rounded-lg border border-border bg-surface p-3 shadow-card hover:border-border-strong"
    >
      <PetAvatar pet={pet} size="sm" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-lg font-bold">{pet.name}</p>
        <p className="truncate text-sm text-text-secondary">{petSummary(pet)}</p>
        <p className="font-mono text-xs text-text-secondary">{pet.melId}</p>
      </div>
      <span aria-hidden="true" className="text-text-secondary">
        ›
      </span>
    </Link>
  );
}
