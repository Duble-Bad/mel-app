"use client";

import Link from "next/link";
import { CircleAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { BR_STATES, fieldErrors, profileInputSchema, type Profile } from "@mel/core";
import { acceptTerms, saveMyProfile, uploadAvatar } from "@mel/data";
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
  /** Cadastro novo: exige aceite dos Termos e da Política de privacidade (registrado). */
  requireTerms?: boolean;
}

export function ProfileForm({ profile, next, submitLabel, requireTerms = false }: ProfileFormProps) {
  const router = useRouter();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [city, setCity] = useState(profile.city ?? "");
  const [state, setState] = useState<string>(profile.state ?? "");
  const [terms, setTerms] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    const form = new FormData(event.currentTarget);
    const parsed = profileInputSchema.safeParse({
      displayName: form.get("displayName"),
      city: form.get("city"),
      state: form.get("state"),
    });
    const termsError: Record<string, string> = requireTerms && !terms ? { terms: "Para continuar, aceite os Termos e a Política de privacidade." } : {};
    if (!parsed.success || termsError.terms) {
      setErrors({ ...(parsed.success ? {} : fieldErrors(parsed.error)), ...termsError });
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
      if (requireTerms) await acceptTerms(supabase, profile.id);
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

      {requireTerms && (
        <div className="flex flex-col gap-1.5">
          <label className="flex items-start gap-3 text-sm">
            <input
              type="checkbox"
              name="terms"
              checked={terms}
              onChange={(e) => setTerms(e.target.checked)}
              aria-invalid={Boolean(errors.terms)}
              aria-describedby={errors.terms ? "terms-error" : undefined}
              className="mt-0.5 size-5 shrink-0 accent-primary"
            />
            <span>
              Li e aceito os{" "}
              <Link href="/termos" target="_blank" className="font-semibold text-link underline underline-offset-2">
                Termos de uso
              </Link>{" "}
              e a{" "}
              <Link href="/privacidade" target="_blank" className="font-semibold text-link underline underline-offset-2">
                Política de privacidade
              </Link>
              .
            </span>
          </label>
          {errors.terms && (
            <p id="terms-error" role="alert" className="flex items-start gap-1.5 text-sm font-medium text-danger">
              <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" strokeWidth={2} />
              {errors.terms}
            </p>
          )}
        </div>
      )}

      <Button type="submit" loading={pending} loadingText="Salvando…">
        {submitLabel}
      </Button>
    </form>
  );
}
