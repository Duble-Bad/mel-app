"use client";

import { useState } from "react";
import { BUSINESS_CATEGORIES, BUSINESS_CATEGORY_LABELS, businessInputSchema, fieldErrors, type BusinessCategory } from "@mel/core";
import { createBusiness, uploadBusinessLogo } from "@mel/data";
import { prepareImage } from "@/lib/images";
import { getBrowserClient } from "@/lib/supabase/browser";
import { LocationPicker, type PickedLocation } from "@/components/location/LocationPicker";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { ChoiceGroup } from "@/components/ui/Choice";
import { TextareaField, TextField } from "@/components/ui/Field";
import { Switch } from "@/components/ui/Switch";

/** Cadastro de parceiro. Entra em análise da moderação. */
export function BusinessForm({ userId }: { userId: string }) {
  const [logo, setLogo] = useState<File | null>(null);
  const [name, setName] = useState("");
  const [category, setCategory] = useState<BusinessCategory | null>(null);
  const [description, setDescription] = useState("");
  const [where, setWhere] = useState<PickedLocation | null>(null);
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [website, setWebsite] = useState("");
  const [instagram, setInstagram] = useState("");
  const [hours, setHours] = useState("");
  const [helpsLost, setHelpsLost] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function submit() {
    const draft = {
      name,
      category: category ?? undefined,
      description,
      addressLabel: address || where?.label || "",
      position: where?.position,
      phone,
      whatsapp,
      website,
      instagram,
      hours,
      helpsLost,
    };
    const parsed = businessInputSchema.safeParse(draft);
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      setError("Falta pouco: confira os campos destacados.");
      return;
    }
    setErrors({});
    setError(null);
    const client = getBrowserClient();
    try {
      let logoPath: string | null = null;
      if (logo) {
        setBusy("Enviando logo…");
        logoPath = await uploadBusinessLogo(client, userId, await prepareImage(logo, 512));
      }
      setBusy("Enviando cadastro…");
      const code = await createBusiness(client, userId, { ...parsed.data, logoPath });
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- página nova do parceiro (em análise)
      window.location.assign(`/parceiros/${code}?novo=1`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não conseguimos enviar agora. Tente de novo.");
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <TextField label="Nome da empresa" maxLength={80} value={name} onChange={(e) => setName(e.target.value)} error={errors.name} />
      <ChoiceGroup name="biz-category" legend="Categoria" columns={2} value={category} onChange={setCategory} error={errors.category} options={BUSINESS_CATEGORIES.map((c) => ({ value: c, label: BUSINESS_CATEGORY_LABELS[c] }))} />
      <TextareaField label="Sobre a empresa" rows={4} maxLength={800} placeholder="Serviços, diferenciais, como ajuda a comunidade…" value={description} onChange={(e) => setDescription(e.target.value)} error={errors.description} />
      <section aria-labelledby="endereco" className="flex flex-col gap-3">
        <h2 id="endereco" className="font-semibold">
          Endereço
        </h2>
        <LocationPicker
          value={where}
          onChange={(p) => {
            setWhere(p);
            if (!address && p.label) setAddress(p.label);
          }}
          privacyNote="Endereço de estabelecimento é público no diretório."
        />
        <TextField label="Endereço como aparece no perfil" value={address} maxLength={200} onChange={(e) => setAddress(e.target.value)} error={errors.addressLabel ?? errors.position} />
      </section>
      <TextField label="Telefone" optional type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} error={errors.phone} />
      <TextField label="WhatsApp" optional type="tel" inputMode="tel" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} error={errors.whatsapp} />
      <TextField label="Site" optional type="url" placeholder="https://" value={website} onChange={(e) => setWebsite(e.target.value)} error={errors.website} />
      <TextField label="Instagram" optional placeholder="@suaempresa" value={instagram} onChange={(e) => setInstagram(e.target.value)} error={errors.instagram} />
      <TextField label="Horário de funcionamento" optional placeholder="Seg. a sáb., 8h às 18h" maxLength={200} value={hours} onChange={(e) => setHours(e.target.value)} />
      <Switch checked={helpsLost} onChange={setHelpsLost} label="Ajudamos com pets perdidos" description="Ex.: leitor de microchip, acolhimento temporário de animais encontrados." />
      <label className="flex flex-col gap-2 text-sm">
        <span className="font-semibold">
          Logo <span className="font-normal text-text-secondary">(opcional)</span>
        </span>
        <input type="file" accept="image/*" onChange={(e) => setLogo(e.target.files?.[0] ?? null)} className="text-sm file:mr-3 file:min-h-11 file:rounded-md file:border file:border-border file:bg-surface file:px-3 file:font-semibold" />
      </label>
      <Alert tone="info">A equipe da MEL revisa cada cadastro. O plano gratuito inclui perfil, contatos e presença no mapa.</Alert>
      {error && <Alert tone="error">{error}</Alert>}
      <Button onClick={submit} loading={Boolean(busy)} loadingText={busy}>
        Enviar cadastro
      </Button>
    </div>
  );
}
