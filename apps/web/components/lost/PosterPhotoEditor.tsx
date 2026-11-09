"use client";

import { useEffect, useState, type KeyboardEvent, type PointerEvent } from "react";
import { useRouter } from "next/navigation";
import { getPosterPhotos, setPhotoFocus, setPrimaryPetPhoto, type PosterPhoto } from "@mel/data";
import { userErrorMessage } from "@mel/core";
import { getBrowserClient } from "@/lib/supabase/browser";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";

/**
 * Só o tutor: escolhe a foto de capa dos cartazes e o ponto que deve continuar
 * visível quando o cartaz recorta (rosto, marca). O banco só aceita do dono.
 */
export function PosterPhotoEditor({ code }: { code: string }) {
  const router = useRouter();
  const toast = useToast();
  const [state, setState] = useState<{ petId: string; photos: PosterPhoto[] } | null | "loading">("loading");
  const [selected, setSelected] = useState<string | null>(null);
  const [focus, setFocus] = useState<{ x: number; y: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getPosterPhotos(getBrowserClient(), code)
      .then((r) => {
        setState(r);
        const cover = r?.photos[0];
        if (cover) {
          setSelected(cover.id);
          setFocus(cover.focus);
        }
      })
      .catch(() => setState(null));
  }, [code]);

  if (state === "loading" || !state || state.photos.length === 0) return null;
  const photo = state.photos.find((p) => p.id === selected) ?? state.photos[0]!;
  const point = focus ?? { x: 50, y: 50 };
  const pos = `${point.x}% ${point.y}%`;
  const saved = JSON.stringify(photo.focus) === JSON.stringify(focus);

  function pick(p: PosterPhoto) {
    setSelected(p.id);
    setFocus(p.focus);
    setError(null);
  }

  function place(e: PointerEvent<HTMLButtonElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    setFocus({ x: Math.round(((e.clientX - r.left) / r.width) * 100), y: Math.round(((e.clientY - r.top) / r.height) * 100) });
  }

  function nudge(e: KeyboardEvent) {
    const d = { ArrowLeft: [-5, 0], ArrowRight: [5, 0], ArrowUp: [0, -5], ArrowDown: [0, 5] }[e.key];
    if (!d) return;
    e.preventDefault();
    setFocus({ x: Math.min(100, Math.max(0, point.x + d[0]!)), y: Math.min(100, Math.max(0, point.y + d[1]!)) });
  }

  async function run(action: () => Promise<void>, done: string) {
    if (state === "loading" || !state) return;
    setBusy(true);
    setError(null);
    try {
      await action();
      const fresh = await getPosterPhotos(getBrowserClient(), code);
      setState(fresh);
      toast({ tone: "success", title: done });
      router.refresh();
    } catch (err) {
      setError(userErrorMessage(err, "Não conseguimos salvar agora."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-labelledby="foto-cartaz" className="flex flex-col gap-4 rounded-lg bg-surface p-4 shadow-card" data-testid="poster-photo-editor">
      <div>
        <h2 id="foto-cartaz" className="font-bold">
          Foto do cartaz <span className="font-normal text-text-secondary">(só você vê)</span>
        </h2>
        <p className="text-sm text-text-secondary">Escolha a capa e toque no ponto que precisa aparecer (rosto, marca). Os cartazes recortam em volta dele.</p>
      </div>

      {state.photos.length > 1 && (
        <ul className="flex gap-2 overflow-x-auto pb-1" aria-label="Fotos do pet">
          {state.photos.map((p, i) => (
            <li key={p.id} className="shrink-0">
              <button
                type="button"
                onClick={() => pick(p)}
                aria-pressed={p.id === photo.id}
                aria-label={`Foto ${i + 1}${p.isPrimary ? " (capa atual)" : ""}`}
                className={`relative block size-16 overflow-hidden rounded-md border-2 ${p.id === photo.id ? "border-[#f6b928]" : "border-transparent"}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- miniatura gerada no envio */}
                <img src={p.thumbUrl} alt="" className="size-full object-cover" />
                {p.isPrimary && <span className="absolute inset-x-0 bottom-0 bg-black/70 text-[10px] font-bold text-white">CAPA</span>}
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
        <button
          type="button"
          onPointerDown={place}
          onKeyDown={nudge}
          aria-label={`Ponto do enquadramento: ${point.x}% da esquerda, ${point.y}% do topo. Toque na foto ou use as setas para mover.`}
          className="relative block w-full overflow-hidden rounded-md bg-surface-muted"
          data-testid="poster-focus-area"
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- foto já reduzida no envio */}
          <img src={photo.url} alt="" className="block w-full select-none" draggable={false} />
          <span
            aria-hidden="true"
            className="pointer-events-none absolute size-10 -translate-x-1/2 -translate-y-1/2 rounded-full border-4 border-[#f6b928] shadow-[0_0_0_3px_rgb(0_0_0/0.5)]"
            style={{ left: `${point.x}%`, top: `${point.y}%` }}
          />
        </button>
        <div className="flex gap-3 sm:flex-col" aria-label="Prévia dos recortes">
          {[
            ["Quadrado", "aspect-square w-24"],
            ["Stories", "aspect-[9/16] w-20"],
          ].map(([label, cls]) => (
            <figure key={label} className="flex flex-col items-center gap-1">
              {/* eslint-disable-next-line @next/next/no-img-element -- prévia local do recorte */}
              <img src={photo.url} alt="" className={`${cls} rounded-md object-cover`} style={{ objectPosition: pos }} />
              <figcaption className="text-xs text-text-secondary">{label}</figcaption>
            </figure>
          ))}
        </div>
      </div>

      {error && <Alert tone="error">{error}</Alert>}
      <div className="flex flex-wrap gap-2">
        <Button size="md" className="w-auto" disabled={busy || saved} onClick={() => run(() => setPhotoFocus(getBrowserClient(), photo.id, focus), "Enquadramento salvo.")}>
          Salvar enquadramento
        </Button>
        {photo.focus && (
          <Button size="md" variant="secondary" className="w-auto" disabled={busy} onClick={() => run(() => setPhotoFocus(getBrowserClient(), photo.id, null).then(() => setFocus(null)), "Enquadramento automático.")}>
            Voltar ao automático
          </Button>
        )}
        {!photo.isPrimary && (
          <Button size="md" variant="secondary" className="w-auto" disabled={busy} onClick={() => run(() => setPrimaryPetPhoto(getBrowserClient(), state.petId, photo.id), "Capa do cartaz trocada.")}>
            Usar como capa
          </Button>
        )}
      </div>
    </section>
  );
}
