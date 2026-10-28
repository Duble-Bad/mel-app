"use client";

import { useEffect, useId, useState } from "react";

const MAX_INPUT_BYTES = 15 * 1024 * 1024; // a foto é reduzida antes do envio

interface AvatarPickerProps {
  currentUrl: string | null;
  onChange: (file: File | null) => void;
  disabled?: boolean;
}

export function AvatarPicker({ currentUrl, onChange, disabled }: AvatarPickerProps) {
  const id = useId();
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => () => void (preview && URL.revokeObjectURL(preview)), [preview]);

  function handleFile(file: File | undefined) {
    setError(null);
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Escolha uma foto (JPG, PNG ou WebP).");
      return;
    }
    if (file.size > MAX_INPUT_BYTES) {
      setError("Essa foto é muito grande. Escolha uma com até 15 MB.");
      return;
    }
    setPreview(URL.createObjectURL(file));
    onChange(file);
  }

  const shown = preview ?? currentUrl;

  return (
    <div className="flex items-center gap-4">
      <div className="size-20 shrink-0 overflow-hidden rounded-full bg-surface-muted">
        {shown ? (
          // eslint-disable-next-line @next/next/no-img-element -- prévia local (blob:) ou URL do Storage
          <img src={shown} alt="Sua foto de perfil" className="size-full object-cover" />
        ) : (
          <span aria-hidden="true" className="flex size-full items-center justify-center text-3xl">
            🐾
          </span>
        )}
      </div>
      <div className="flex flex-col gap-1">
        <label
          htmlFor={id}
          className="inline-flex min-h-12 cursor-pointer items-center rounded-md border-2 border-border-strong bg-surface px-4 font-semibold hover:bg-surface-muted has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-focus"
        >
          {shown ? "Trocar foto" : "Adicionar foto"}
          <input
            id={id}
            type="file"
            accept="image/*"
            className="sr-only"
            disabled={disabled}
            onChange={(e) => handleFile(e.target.files?.[0])}
          />
        </label>
        <span className="text-sm text-text-secondary">Opcional</span>
        {error && (
          <span role="alert" className="text-sm font-medium text-danger">
            {error}
          </span>
        )}
      </div>
    </div>
  );
}
