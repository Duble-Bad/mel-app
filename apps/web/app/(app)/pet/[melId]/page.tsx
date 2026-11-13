import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Cake, Cpu, HeartPulse, MapPin, Palette, PawPrint, Ruler, Weight, type LucideIcon } from "lucide-react";
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
import { PetGallery } from "@/components/pets/PetGallery";
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
  if (!pet.photos.length) return null;
  // Principal primeiro, depois as outras na ordem do cadastro.
  const photo = primaryPhoto(pet);
  const ordered = photo ? [photo, ...pet.photos.filter((p) => p.id !== photo.id)] : pet.photos;
  return (
    <div className="min-w-0 lg:sticky lg:top-24">
      <PetGallery photos={ordered.map(({ id, url, thumbUrl }) => ({ id, url, thumbUrl }))} name={pet.name} />
    </div>
  );
}

function Facts({ pet }: { pet: Pet }) {
  const age = describeAge(pet);
  const colors = [pet.colorPrimary, ...pet.colorsSecondary].filter(Boolean).map(colorLabel).join(", ");
  const stateName = BR_STATES.find((s) => s.uf === pet.state)?.uf;
  const rows: { label: string; value: string | null; Icon: LucideIcon; wide?: boolean }[] = [
    { label: "Raça", value: pet.breed ? breedLabel(pet.breed) : null, Icon: PawPrint },
    { label: "Idade", value: age, Icon: Cake },
    { label: "Porte", value: pet.size ? `${SIZE_LABELS[pet.size].label} (${SIZE_LABELS[pet.size].hint})` : null, Icon: Ruler },
    { label: "Peso", value: pet.weightKg ? `${String(pet.weightKg).replace(".", ",")} kg` : null, Icon: Weight },
    { label: "Cores", value: colors || null, Icon: Palette, wide: true },
    { label: "Cidade", value: pet.city ? [pet.city, stateName].filter(Boolean).join(" – ") : null, Icon: MapPin, wide: true },
  ];
  const visible = rows.filter((r) => r.value);
  // Sim/Não viram selos (verde = sim), não texto solto.
  const flags = [
    { label: "Castrado(a)", value: pet.neutered, Icon: HeartPulse },
    { label: "Microchip", value: pet.hasMicrochip, Icon: Cpu },
  ].filter((f) => f.value != null);
  if (!visible.length && !flags.length) return null;
  return (
    <section aria-label={`Características de ${pet.name}`} className="relative overflow-hidden rounded-2xl border border-border bg-surface p-4 sm:p-5">
      <span aria-hidden="true" className="pointer-events-none absolute -top-16 -right-16 size-48 rounded-full bg-primary/10 blur-3xl" />
      <dl className="relative grid grid-cols-2 gap-2.5">
        {visible.map(({ label, value, Icon, wide }) => (
          <div key={label} className={`flex items-center gap-3 rounded-xl bg-surface-muted/60 p-3 ${wide ? "col-span-2" : ""}`}>
            <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/12 text-primary">
              <Icon className="size-5" strokeWidth={2} />
            </span>
            <div className="min-w-0">
              <dt className="text-xs font-medium text-text-secondary">{label}</dt>
              <dd className="leading-tight font-bold break-words">{value}</dd>
            </div>
          </div>
        ))}
      </dl>
      {flags.length > 0 && (
        <ul className="relative mt-3 flex flex-wrap gap-2" aria-label="Saúde e identificação">
          {flags.map(({ label, value, Icon }) => (
            <li
              key={label}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-semibold ${
                value ? "border-status-found-solid/40 bg-status-found-soft text-status-found" : "border-border bg-surface-muted text-text-secondary"
              }`}
            >
              <Icon aria-hidden="true" className="size-4" strokeWidth={2.25} />
              {label}: {value ? "Sim" : "Não"}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
