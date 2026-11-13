"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { Camera } from "lucide-react";
import { isSmallPhoto, MAX_PET_PHOTOS, PHOTO_SIZE_TIP, type PetPhoto } from "@mel/core";
import { InfoTip } from "@/components/ui/InfoTip";

// Sugestões, não exigências: nenhuma foto além da que a pessoa quiser enviar é obrigatória.
const PHOTO_TIPS = [
  "Rosto de frente.",
  "Corpo inteiro, de lado.",
  "Uma foto de agora, mostrando como está hoje.",
  "Marcas que o diferenciam: manchas, cicatriz, coleira.",
  "Se a aparência muda muito com a tosa ou o pelo crescido, uma foto de cada jeito.",
] as const;

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
  /** Dentro de um cartão que já se chama "Fotos": mostra só a contagem e as dicas. */
  compact?: boolean;
}

export function PhotoManager({
  existing,
  pending,
  onPendingChange,
  onMakePrimary,
  onRemoveExisting,
  busy,
  compact,
}: PhotoManagerProps) {
  const inputId = useId();
  const [error, setError] = useState<string | null>(null);
  const previews = useMemo(() => pending.map((f) => URL.createObjectURL(f)), [pending]);
  useEffect(() => () => previews.forEach((url) => URL.revokeObjectURL(url)), [previews]);
  // Dimensões das fotos escolhidas (lidas no aparelho, antes do envio) para o aviso de foto pequena.
  const [sizes, setSizes] = useState<Map<File, { width: number; height: number }>>(() => new Map());
  useEffect(() => {
    let cancelled = false;
    for (const file of pending) {
      if (sizes.has(file)) continue;
      createImageBitmap(file)
        .then((b) => {
          if (!cancelled) setSizes((m) => new Map(m).set(file, { width: b.width, height: b.height }));
          b.close();
        })
        .catch(() => {});
    }
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só mede as novas
  }, [pending]);

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
      <div className="flex items-center gap-1">
        {compact ? (
          <p className="text-sm text-text-secondary">
            {total} de {MAX_PET_PHOTOS} fotos
          </p>
        ) : (
          <p className="text-sm font-semibold">
            Fotos <span className="font-normal text-text-secondary">({total}/{MAX_PET_PHOTOS})</span>
          </p>
        )}
        {/* Dicas no "i" em vez de três parágrafos na tela. */}
        <InfoTip label="Dicas para as fotos">
          <p className="font-semibold">Fotos nítidas e recentes ajudam a reconhecer o pet na rua.</p>
          <p className="mt-1.5 text-text-secondary" data-testid="photo-size-tip">
            {PHOTO_SIZE_TIP}
          </p>
          <p className="mt-2.5 font-semibold">Quais fotos ajudam mais</p>
          <ul className="mt-1 flex list-disc flex-col gap-0.5 pl-5 text-text-secondary" data-testid="photo-tips">
            {PHOTO_TIPS.map((tip) => (
              <li key={tip}>{tip}</li>
            ))}
          </ul>
        </InfoTip>
      </div>

      {total > 0 && (
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-3">
          {existing.map((photo) => (
            <li key={photo.id} className="flex flex-col gap-1">
              <div className="relative aspect-square overflow-hidden rounded-md bg-surface-muted">
                {/* eslint-disable-next-line @next/next/no-img-element -- miniatura do Storage */}
                <img src={photo.thumbUrl} alt="" className="size-full object-cover" />
                {photo.isPrimary && (
                  <span className="absolute top-1 left-1 rounded-sm bg-primary px-1.5 text-xs font-semibold text-primary-foreground">
                    Principal
                  </span>
                )}
              </div>
              {isSmallPhoto(photo.width, photo.height) && <SmallPhotoWarning width={photo.width!} height={photo.height!} />}
              {!photo.isPrimary && onMakePrimary && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => onMakePrimary(photo.id)}
                  className="min-h-10 rounded-sm text-sm font-semibold text-link underline-offset-2 hover:underline"
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
                  <span className="absolute top-1 left-1 rounded-sm bg-primary px-1.5 text-xs font-semibold text-primary-foreground">
                    Principal
                  </span>
                )}
              </div>
              {isSmallPhoto(sizes.get(file)?.width, sizes.get(file)?.height) && <SmallPhotoWarning width={sizes.get(file)!.width} height={sizes.get(file)!.height} />}
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
          <Camera aria-hidden="true" className="size-5" strokeWidth={2} /> {total === 0 ? "Adicionar fotos" : "Adicionar mais fotos"}
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

/** Aviso (não bloqueia): a foto é pequena e pode sair borrada nos cartazes. */
function SmallPhotoWarning({ width, height }: { width: number; height: number }) {
  return (
    <p className="text-xs leading-snug font-semibold text-warning" data-testid="small-photo-warning">
      Foto pequena ({width}×{height}): pode ficar borrada no cartaz. Se tiver a original, prefira ela.
    </p>
  );
}
