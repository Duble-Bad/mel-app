"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { LocateFixed, Trash2 } from "lucide-react";
import { useState } from "react";
import { fieldErrors, offerSchema, type BusinessOffer } from "@mel/core";
import { addOffer, deleteOffer, reviewBusiness, setOfferSponsored } from "@mel/data";
import { getCurrentPosition } from "@/lib/geo/client";
import { getBrowserClient } from "@/lib/supabase/browser";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { TextareaField, TextField } from "@/components/ui/Field";
import { FilterChip } from "@/components/ui/FilterChip";
import { useToast } from "@/components/ui/Toast";

/** "Perto de mim" no diretório: coloca a localização (arredondada) no endereço. */
export function NearMeChip({ active }: { active: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function locate() {
    setBusy(true);
    setError(null);
    try {
      const { position } = await getCurrentPosition();
      const q = new URLSearchParams(params.toString());
      q.set("lat", position.lat.toFixed(4));
      q.set("lng", position.lng.toFixed(4));
      router.replace(`${pathname}?${q}`, { scroll: false });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não conseguimos pegar sua localização.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <FilterChip pressed={active} onClick={locate} disabled={busy}>
        <LocateFixed aria-hidden="true" className="size-4" strokeWidth={2} /> {busy ? "Localizando…" : "Perto de mim"}
      </FilterChip>
      {error && (
        <p role="alert" className="w-full text-sm font-medium text-danger">
          {error}
        </p>
      )}
    </>
  );
}

function useOfferAction() {
  const router = useRouter();
  const toast = useToast();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function run(fn: () => Promise<void>, ok: string) {
    setBusy(true);
    setError(null);
    try {
      await fn();
      toast({ tone: "success", title: ok });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não conseguimos atualizar.");
    } finally {
      setBusy(false);
    }
  }
  return { run, busy, error };
}

/** Ações em uma oferta: dono remove; moderação marca/desmarca "Patrocinado". */
export function OfferActions({ offer, canEdit, canSponsor }: { offer: BusinessOffer; canEdit: boolean; canSponsor: boolean }) {
  const { run, busy, error } = useOfferAction();
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        {canSponsor && (
          <Button
            size="md"
            variant="secondary"
            className="w-auto"
            disabled={busy}
            onClick={() => run(() => setOfferSponsored(getBrowserClient(), offer.id, !offer.isSponsored), offer.isSponsored ? "Selo removido." : "Marcada como patrocinada.")}
          >
            {offer.isSponsored ? "Remover “Patrocinado”" : "Marcar como patrocinada"}
          </Button>
        )}
        {canEdit && (
          <Button size="md" variant="ghost" className="w-auto" disabled={busy} onClick={() => run(() => deleteOffer(getBrowserClient(), offer.id), "Oferta removida.")}>
            <Trash2 aria-hidden="true" className="size-4" strokeWidth={2} /> Remover oferta
          </Button>
        )}
      </div>
      {error && <Alert tone="error">{error}</Alert>}
    </div>
  );
}

/** Dono: publica uma oferta nova (nunca patrocinada por quem cadastra). */
export function NewOfferForm({ code }: { code: string }) {
  const { run, busy, error } = useOfferAction();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function add() {
    const parsed = offerSchema.safeParse({ title, description });
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      return;
    }
    setErrors({});
    await run(async () => {
      await addOffer(getBrowserClient(), code, parsed.data);
      setTitle("");
      setDescription("");
    }, "Oferta publicada.");
  }

  return (
    <div className="flex flex-col gap-3 rounded-card border border-border bg-surface-warm p-4">
      <p className="font-semibold">Nova oferta</p>
      <TextField label="Título" maxLength={80} value={title} onChange={(e) => setTitle(e.target.value)} error={errors.title} />
      <TextareaField label="Detalhes" optional rows={2} maxLength={300} value={description} onChange={(e) => setDescription(e.target.value)} />
      {error && <Alert tone="error">{error}</Alert>}
      <Button size="md" onClick={add} loading={busy} loadingText="Publicando…">
        Publicar oferta
      </Button>
    </div>
  );
}

/** Moderação: aprovar / recusar cadastro de empresa (recusa pede motivo). */
export function BusinessReview({ code, name }: { code: string; name: string }) {
  const router = useRouter();
  const toast = useToast();
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<"approve" | "reject" | null>(null);
  const [error, setError] = useState<string | null>(null);
  async function act(approve: boolean) {
    if (!approve && !note.trim()) {
      setError("Explique o motivo para a empresa.");
      return;
    }
    setBusy(approve ? "approve" : "reject");
    setError(null);
    try {
      await reviewBusiness(getBrowserClient(), code, approve, note.trim() || undefined);
      toast({ tone: "success", title: approve ? `${name} aprovado.` : "Cadastro recusado." });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não conseguimos aplicar agora.");
      setBusy(null);
    }
  }
  return (
    <div className="flex flex-col gap-3">
      <TextField label="Motivo (obrigatório para recusar)" optional value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} />
      {error && <Alert tone="error">{error}</Alert>}
      <div className="flex flex-wrap gap-2">
        <Button size="md" className="w-auto" onClick={() => act(true)} loading={busy === "approve"} loadingText="Aprovando…" disabled={busy !== null}>
          Aprovar
        </Button>
        <Button size="md" variant="secondary" className="w-auto" onClick={() => act(false)} loading={busy === "reject"} loadingText="Recusando…" disabled={busy !== null}>
          Recusar
        </Button>
      </div>
    </div>
  );
}
