"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { MAX_PET_PHOTOS, type PetPhoto } from "@mel/core";

const MAX_INPUT_BYTES = 20 * 1024 * 1024;

interface PhotoManagerProps {
  /** Fotos já salvas (edição). */
  existing: PetPhoto[];
  /** Fotos escolhidas e ainda não enviadas. */
  pending: File[];
  onPendingChange: (files: File[]) => void;
  onMakePrimary?: (photoId: string) => void;
  onRemoveExisting?: (photoId: string) => void;
  busy?: boolean;
}

export function PhotoManager({
  existing,
  pending,
  onPendingChange,
  onMakePrimary,
  onRemoveExisting,
  busy,
}: PhotoManagerProps) {
  const inputId = useId();
  const [error, setError] = useState<string | null>(null);
  const previews = useMemo(() => pending.map((f) => URL.createObjectURL(f)), [pending]);
  useEffect(() => () => previews.forEach((url) => URL.revokeObjectURL(url)), [previews]);

  const total = existing.length + pending.length;
  const remaining = MAX_PET_PHOTOS - total;

  function addFiles(list: FileList | null) {
    setError(null);
    if (!list?.length) return;
    const files = [...list];
    const invalid = files.find((f) => !f.type.startsWith("image/") || f.size > MAX_INPUT_BYTES);
    if (invalid) {
      setError("Use fotos (JPG, PNG ou WebP) de até 20 MB.");
      return;
    }
    if (files.length > remaining) setError(`Cabem mais ${remaining} foto(s). Escolhemos as primeiras.`);
    onPendingChange([...pending, ...files.slice(0, Math.max(0, remaining))]);
  }

  return (
    <div className="flex flex-col gap-3">
      <div>
        <p className="font-semibold">
          Fotos <span className="font-normal text-text-secondary">(até {MAX_PET_PHOTOS})</span>
        </p>
        <p className="text-sm text-text-secondary">
          Uma foto nítida do rosto e outra do corpo inteiro ajudam muito quem estiver procurando.
        </p>
      </div>

      {total > 0 && (
        <ul className="grid grid-cols-3 gap-2">
          {existing.map((photo) => (
            <li key={photo.id} className="flex flex-col gap-1">
              <div className="relative aspect-square overflow-hidden rounded-md bg-surface-muted">
                {/* eslint-disable-next-line @next/next/no-img-element -- miniatura do Storage */}
                <img src={photo.thumbUrl} alt="" className="size-full object-cover" />
                {photo.isPrimary && (
                  <span className="absolute top-1 left-1 rounded-sm bg-brand-primary px-1.5 text-xs font-semibold text-brand-on-primary">
                    Principal
                  </span>
                )}
              </div>
              {!photo.isPrimary && onMakePrimary && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => onMakePrimary(photo.id)}
                  className="min-h-10 rounded-sm text-sm font-semibold text-brand-primary underline-offset-2 hover:underline"
                >
                  Tornar principal
                </button>
              )}
              {onRemoveExisting && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => onRemoveExisting(photo.id)}
                  className="min-h-10 rounded-sm text-sm text-danger underline-offset-2 hover:underline"
                >
                  Remover
                </button>
              )}
            </li>
          ))}
          {pending.map((file, i) => (
            <li key={`${file.name}-${i}`} className="flex flex-col gap-1">
              <div className="relative aspect-square overflow-hidden rounded-md bg-surface-muted">
                {/* eslint-disable-next-line @next/next/no-img-element -- prévia local (blob:) */}
                <img src={previews[i]} alt="" className="size-full object-cover" />
                {existing.length === 0 && i === 0 && (
                  <span className="absolute top-1 left-1 rounded-sm bg-brand-primary px-1.5 text-xs font-semibold text-brand-on-primary">
                    Principal
                  </span>
                )}
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={() => onPendingChange(pending.filter((_, j) => j !== i))}
                className="min-h-10 rounded-sm text-sm text-danger underline-offset-2 hover:underline"
              >
                Remover
              </button>
            </li>
          ))}
        </ul>
      )}

      {remaining > 0 && (
        <label
          htmlFor={inputId}
          className="flex min-h-14 cursor-pointer items-center justify-center gap-2 rounded-md border-2 border-dashed border-border-strong bg-surface font-semibold hover:bg-surface-muted has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-focus"
        >
          <span aria-hidden="true">📷</span> {total === 0 ? "Adicionar fotos" : "Adicionar mais fotos"}
          <input
            id={inputId}
            type="file"
            accept="image/*"
            multiple
            disabled={busy}
            className="sr-only"
            onChange={(e) => {
              addFiles(e.target.files);
              e.target.value = "";
            }}
          />
        </label>
      )}

      {error && (
        <p role="alert" className="text-sm font-medium text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
