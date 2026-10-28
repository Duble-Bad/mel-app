"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { BR_STATES, fieldErrors, profileInputSchema, type Profile } from "@mel/core";
import { saveMyProfile, uploadAvatar } from "@mel/data";
import { getBrowserClient } from "@/lib/supabase/browser";
import { prepareImage } from "@/lib/images";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { SelectField, TextField } from "@/components/ui/Field";
import { FillCityFromLocation } from "@/components/location/FillCityFromLocation";
import { AvatarPicker } from "./AvatarPicker";

interface ProfileFormProps {
  profile: Profile;
  /** Para onde ir depois de salvar. */
  next: string;
  submitLabel: string;
}

export function ProfileForm({ profile, next, submitLabel }: ProfileFormProps) {
  const router = useRouter();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [city, setCity] = useState(profile.city ?? "");
  const [state, setState] = useState<string>(profile.state ?? "");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    const form = new FormData(event.currentTarget);
    const parsed = profileInputSchema.safeParse({
      displayName: form.get("displayName"),
      city: form.get("city"),
      state: form.get("state"),
    });
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      return;
    }
    setErrors({});
    setPending(true);
    try {
      const supabase = getBrowserClient();
      let avatarUrl: string | undefined;
      if (avatarFile) {
        avatarUrl = await uploadAvatar(supabase, profile.id, await prepareImage(avatarFile, 512));
      }
      await saveMyProfile(supabase, profile.id, { ...parsed.data, avatarUrl });
      router.replace(next);
      router.refresh();
    } catch (error) {
      console.error("[ProfileForm] falhou ao salvar", error);
      setFormError("Não conseguimos salvar agora. Verifique sua conexão e tente de novo.");
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
      {formError && <Alert tone="error">{formError}</Alert>}

      <AvatarPicker currentUrl={profile.avatarUrl} onChange={setAvatarFile} disabled={pending} />

      <TextField
        label="Como podemos te chamar?"
        name="displayName"
        autoComplete="name"
        defaultValue={profile.displayName ?? ""}
        required
        error={errors.displayName}
      />

      <div className="flex flex-col gap-2">
        <TextField
          label="Cidade"
          name="city"
          autoComplete="address-level2"
          hint="Usamos para mostrar alertas e parceiros perto de você."
          value={city}
          onChange={(e) => setCity(e.target.value)}
          required
          error={errors.city}
        />
        <FillCityFromLocation
          onFill={(c, uf) => {
            setCity(c);
            if (uf) setState(uf);
          }}
        />
      </div>

      <SelectField
        label="Estado"
        name="state"
        value={state}
        onChange={(e) => setState(e.target.value)}
        required
        error={errors.state}
      >
        <option value="" disabled>
          Escolha o estado
        </option>
        {BR_STATES.map((s) => (
          <option key={s.uf} value={s.uf}>
            {s.name}
          </option>
        ))}
      </SelectField>

      <Button type="submit" loading={pending} loadingText="Salvando…">
        {submitLabel}
      </Button>
    </form>
  );
}
