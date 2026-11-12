import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import {
  BR_STATES,
  breedLabel,
  colorLabel,
  describeAge,
  isMelId,
  petSummary,
  primaryPhoto,
  SIZE_LABELS,
  type Pet,
} from "@mel/core";
import { getPetByMelId } from "@mel/data";
import { getSessionUser } from "@/lib/session";
import { createSessionClient } from "@/lib/supabase/server";
import { Alert } from "@/components/ui/Alert";
import { LoadingState } from "@/components/ui/States";

export async function generateMetadata({ params }: PageProps<"/pet/[melId]">): Promise<Metadata> {
  const { melId } = await params;
  // Com a sessão: o dono vê o nome do próprio pet privado na aba; quem não é dono (e os robôs de
  // prévia, que não têm sessão) só recebem o que é público — um pet privado não vaza no preview.
  const pet = isMelId(melId) ? await getPetByMelId(await createSessionClient(), melId).catch(() => null) : null;
  if (!pet) return { title: "Pet não encontrado", robots: { index: false } };
  const photo = primaryPhoto(pet);
  return {
    title: `${pet.name} · ${pet.melId}`,
    description: petSummary(pet),
    // Página de cadastro preventivo: não indexar. Alertas (M5) terão regra própria.
    robots: { index: false },
    openGraph: {
      title: `${pet.name} — MEL`,
      description: petSummary(pet),
      images: photo ? [{ url: photo.url }] : undefined,
    },
  };
}

export default function PetPage({ params }: PageProps<"/pet/[melId]">) {
  return (
    <main className="mel-container max-w-[1184px] flex-1 pt-4 pb-12 lg:pt-10">
      <Suspense fallback={<LoadingState />}>
        {params.then(({ melId }) => <PetContent melId={melId} />)}
      </Suspense>
    </main>
  );
}

async function PetContent({ melId }: { melId: string }) {
  if (!isMelId(melId)) notFound();
  // Cliente com sessão: o dono também vê a própria página quando ela é privada.
  const pet = await getPetByMelId(await createSessionClient(), melId);
  if (!pet) notFound();
  const user = await getSessionUser();
  const isOwner = user?.id === pet.ownerId;

  return (
    <article className="grid gap-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:items-start lg:gap-10">
      <Hero pet={pet} />
      <div className="flex flex-col gap-6">
        {isOwner && !pet.isPublic && (
          <Alert tone="info">
            Só você vê esta página. Para mostrá-la a qualquer pessoa,{" "}
            <Link href={`/perfil/pets/${pet.id}`} className="font-semibold underline">
              deixe a página pública
            </Link>
            .
          </Alert>
        )}
        <header>
          <h1 className="text-3xl font-bold lg:text-4xl">{pet.name}</h1>
          <p className="text-lg text-text-secondary">{petSummary(pet)}</p>
          <p className="mt-1 text-sm text-text-secondary">
            MEL ID <span className="font-mono font-semibold text-text-primary">{pet.melId}</span>
          </p>
        </header>
        <Facts pet={pet} />
        {pet.uniqueMarks && (
          <section>
            <h2 className="mb-1 font-bold">Características marcantes</h2>
            <p className="whitespace-pre-line">{pet.uniqueMarks}</p>
          </section>
        )}
        {pet.description && (
          <section>
            <h2 className="mb-1 font-bold">Sobre {pet.name}</h2>
            <p className="whitespace-pre-line">{pet.description}</p>
          </section>
        )}
        {isOwner && (
          <Link href={`/perfil/pets/${pet.id}`} className="font-semibold text-link underline-offset-4 hover:underline">
            Editar informações
          </Link>
        )}
      </div>
    </article>
  );
}

function Hero({ pet }: { pet: Pet }) {
  const photo = primaryPhoto(pet);
  const others = pet.photos.filter((p) => p.id !== photo?.id);
  if (!photo) return null;
  return (
    <div className="flex flex-col gap-3 lg:sticky lg:top-24">
      {/* Foto inteira, sem corte (cartaz vertical, foto deitada…): o fundo é a própria foto desfocada. */}
      <div className="relative isolate flex aspect-[4/5] max-h-[78vh] w-full items-center justify-center overflow-hidden rounded-2xl bg-surface-muted">
        {/* eslint-disable-next-line @next/next/no-img-element -- fundo decorativo (miniatura) */}
        <img src={photo.thumbUrl} alt="" aria-hidden="true" className="absolute inset-0 -z-10 size-full scale-110 object-cover opacity-60 blur-2xl" />
        {/* eslint-disable-next-line @next/next/no-img-element -- imagem já otimizada (1280px) no upload */}
        <img src={photo.url} alt={`Foto de ${pet.name}`} className="max-h-full max-w-full object-contain" />
      </div>
      {others.length > 0 && (
        <ul className="flex gap-2 overflow-x-auto" aria-label="Outras fotos">
          {others.map((p) => (
            <li key={p.id} className="shrink-0">
              <a href={p.url} target="_blank" rel="noreferrer" className="block size-20 overflow-hidden rounded-lg">
                {/* eslint-disable-next-line @next/next/no-img-element -- miniatura */}
                <img src={p.thumbUrl} alt={`Outra foto de ${pet.name}`} loading="lazy" className="size-full object-cover" />
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Facts({ pet }: { pet: Pet }) {
  const age = describeAge(pet);
  const colors = [pet.colorPrimary, ...pet.colorsSecondary].filter(Boolean).map(colorLabel).join(", ");
  const stateName = BR_STATES.find((s) => s.uf === pet.state)?.uf;
  const rows: [string, string | null][] = [
    ["Raça", pet.breed ? breedLabel(pet.breed) : null],
    ["Idade", age],
    ["Porte", pet.size ? `${SIZE_LABELS[pet.size].label} (${SIZE_LABELS[pet.size].hint})` : null],
    ["Peso", pet.weightKg ? `${String(pet.weightKg).replace(".", ",")} kg` : null],
    ["Cores", colors || null],
    ["Castrado(a)", pet.neutered == null ? null : pet.neutered ? "Sim" : "Não"],
    ["Microchip", pet.hasMicrochip == null ? null : pet.hasMicrochip ? "Sim" : "Não"],
    ["Cidade", pet.city ? [pet.city, stateName].filter(Boolean).join(" – ") : null],
  ];
  const visible = rows.filter(([, v]) => v);
  if (!visible.length) return null;
  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-lg bg-surface p-4 shadow-card">
      {visible.map(([label, value]) => (
        <div key={label}>
          <dt className="text-sm text-text-secondary">{label}</dt>
          <dd className="font-semibold">{value}</dd>
        </div>
      ))}
    </dl>
  );
}
