import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { CircleCheck, Heart, House, Lock, MessageCircle, Plus, Search, ShieldCheck, UserPlus, Users } from "lucide-react";
import { SEEKER_VALID_DAYS, SPECIES, type PublicAdoption, type PublicSeeker, type Species } from "@mel/core";
import { type ContactListing, listAdoptions, listMyListingsForSeekerContact, listPublicAdoptionSeekers } from "@mel/data";
import { getSessionUser } from "@/lib/session";
import { createPublicClient } from "@/lib/supabase/public";
import { createSessionClient } from "@/lib/supabase/server";
import { AdoptionCard } from "@/components/adoption/AdoptionCard";
import { AdoptionTabs } from "@/components/adoption/AdoptionTabs";
import { ADOPTION_TABS, type AdoptionTabId } from "@/components/adoption/tabs";
import { SeekerCard } from "@/components/adoption/SeekerCard";
import { SeekerContactButton } from "@/components/adoption/SeekerContactButton";
import { ButtonLink } from "@/components/ui/Button";
import { ErrorState } from "@/components/ui/States";
import { PetCardSkeleton } from "@/components/ui/Surface";
import "@/components/adoption/adoption.css";

export const metadata: Metadata = {
  title: "Adoção",
  description: "Cães e gatos procurando um lar. Anúncios revisados pela equipe da MEL, sem venda de animais. Cadastre seu interesse e avisamos quando houver um compatível.",
};

const LABELS: Record<Species, string> = { dog: "Cães", cat: "Gatos", other: "Outros" };
const SEEKER_FORM = "/adocao/quero-adotar";

export default function AdoptionListPage({ searchParams }: PageProps<"/adocao">) {
  return (
    <main className="mx-auto w-full max-w-[1200px] flex-1 px-[var(--mel-page-gutter)] pb-16">
      <header className="grid animate-enter items-center gap-5 pt-10 pb-6 min-[860px]:grid-cols-[1fr_auto]">
        <div>
          <h1 className="text-[clamp(32px,5vw,48px)] leading-[1.08] font-black tracking-[-0.03em]">Adoção responsável</h1>
          <p className="mt-2.5 max-w-[60ch] text-lg text-text-secondary">
            Encontre um novo amigo e dê a ele uma segunda chance. Todo anúncio passa pela moderação e é publicado por ONGs ou protetores.
          </p>
        </div>
        <Link
          href={SEEKER_FORM}
          className="mel-adopt-cta flex min-h-11 items-center gap-3.5 self-center rounded-[18px] px-5.5 py-4 font-extrabold min-[860px]:self-auto"
        >
          <UserPlus aria-hidden="true" className="size-7.5 shrink-0" strokeWidth={2} />
          <span>
            Quero adotar
            <small className="block text-[13.5px] font-semibold opacity-80">Cadastrar meu interesse</small>
          </span>
        </Link>
      </header>
      <Suspense
        fallback={
          <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,230px),1fr))] gap-4.5">
            <PetCardSkeleton />
            <PetCardSkeleton />
            <PetCardSkeleton />
          </div>
        }
      >
        {searchParams.then((q) => {
          const species = typeof q.especie === "string" && (SPECIES as readonly string[]).includes(q.especie) ? (q.especie as Species) : null;
          const tab = ADOPTION_TABS.find((t) => t.id === q.aba)?.id ?? "disponiveis";
          return <Content species={species} tab={tab} />;
        })}
      </Suspense>
    </main>
  );
}

async function Content({ species, tab }: { species: Species | null; tab: AdoptionTabId }) {
  await connection();
  const client = createPublicClient();
  // Quem anuncia um animal disponível vê o "Conversar" na fila: a lista vem pela
  // sessão (o banco só devolve a referência de contato para essa pessoa).
  const user = await getSessionUser();
  const session = user && !user.isAnonymous ? await createSessionClient() : null;
  const [adoptions, seekers, contactListings] = await Promise.allSettled([
    listAdoptions(client, { species: species ? [species] : undefined, pageSize: 48 }),
    listPublicAdoptionSeekers(session ?? client, { pageSize: 24 }),
    session ? listMyListingsForSeekerContact(session) : Promise.resolve([] as ContactListing[]),
  ]);
  if (adoptions.status === "rejected") console.error("[adocao] falha nos anúncios", adoptions.reason);
  if (seekers.status === "rejected") console.error("[adocao] falha na fila pública", seekers.reason);
  if (contactListings.status === "rejected") console.error("[adocao] falha nos anúncios para contato", contactListings.reason);
  return (
    <AdoptionTabs
      initial={tab}
      panels={{
        disponiveis:
          adoptions.status === "fulfilled" ? (
            <Available species={species} items={adoptions.value.items} total={adoptions.value.total} />
          ) : (
            <ErrorState>Não conseguimos carregar os anúncios agora. Atualize a página.</ErrorState>
          ),
        "quero-adotar": (
          <SeekersPanel
            seekers={seekers.status === "fulfilled" ? seekers.value : null}
            contactListings={contactListings.status === "fulfilled" ? contactListings.value : []}
          />
        ),
        "como-funciona": <HowItWorks />,
      }}
    />
  );
}

function Available({ species, items, total }: { species: Species | null; items: PublicAdoption[]; total: number }) {
  return (
    <div className="flex flex-col gap-4.5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav aria-label="Filtrar por espécie" className="flex flex-wrap gap-2">
          {[null, ...SPECIES].map((s) => (
            <Link
              key={s ?? "todos"}
              href={s ? `/adocao?especie=${s}` : "/adocao"}
              aria-current={species === s ? "page" : undefined}
              className={`inline-flex min-h-11 items-center rounded-full border px-4 text-sm font-semibold transition-[background-color,border-color,color] duration-200 ${
                species === s ? "border-primary bg-primary text-primary-foreground shadow-primary" : "border-border-strong bg-surface text-text-primary hover:border-text-muted"
              }`}
            >
              {s ? LABELS[s] : "Todos"}
            </Link>
          ))}
        </nav>
        <div className="flex flex-wrap items-center gap-3">
          {total > 0 && (
            <p className="text-sm text-text-secondary" aria-live="polite">
              {total === 1 ? "1 disponível" : `${total} disponíveis`}
            </p>
          )}
          <ButtonLink href="/publicar/adocao" variant="secondary" size="md" className="w-auto">
            <Plus aria-hidden="true" className="size-4" strokeWidth={2} /> Colocar para adoção
          </ButtonLink>
        </div>
      </div>
      {items.length === 0 ? (
        <div className="grid justify-items-center gap-2.5 rounded-[20px] border-[1.5px] border-dashed border-border-strong px-6 py-9 text-center text-text-secondary">
          <Heart aria-hidden="true" className="size-11 text-primary" strokeWidth={1.75} />
          <h2 className="text-xl font-bold text-text-primary">Nenhum animal disponível agora</h2>
          <p>Cadastre seu interesse e avisamos quando houver um compatível.</p>
          <ButtonLink href={SEEKER_FORM} size="md" className="mt-1 w-auto">
            Cadastrar meu interesse
          </ButtonLink>
        </div>
      ) : (
        <ul className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,230px),1fr))] gap-4.5">
          {items.map((a) => (
            <li key={a.code}>
              <AdoptionCard a={a} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const QUEUE_RULES = [
  "Seu interesse entra numa fila revisada pela moderação.",
  "Quando um animal compatível é publicado perto de você, avisamos pela MEL e você conversa com quem cuida dele pelo chat.",
  `O interesse vale por ${SEEKER_VALID_DAYS} dias e pode ser renovado. Avisamos antes de expirar.`,
];

function SeekersPanel({
  seekers,
  contactListings,
}: {
  seekers: { items: PublicSeeker[]; total: number } | null;
  contactListings: ContactListing[];
}) {
  return (
    <div className="flex flex-col gap-10">
      <div className="grid items-start gap-7 min-[960px]:grid-cols-2 min-[960px]:gap-14">
        <div className="rounded-[22px] border border-border bg-surface p-6 md:p-8">
          <h2 className="text-[28px] leading-tight font-extrabold">Quero adotar um pet</h2>
          <p className="mt-2 mb-6 text-text-secondary">
            Ainda não encontrou o pet ideal? Cadastre seu interesse e avisaremos quando houver um animal compatível.
          </p>
          <ButtonLink href={SEEKER_FORM}>
            <UserPlus aria-hidden="true" className="size-5" strokeWidth={2} /> Cadastrar meu interesse
          </ButtonLink>
          <p className="mt-3 text-sm text-text-secondary">Já cadastrou? No mesmo lugar você vê o status, renova, pausa os avisos ou cancela.</p>
        </div>
        <aside className="grid gap-4">
          <div className="grid gap-3.5 rounded-[22px] border border-border bg-surface p-6 md:p-8">
            <h3 className="text-xl font-bold">Como a fila funciona</h3>
            <ul className="grid gap-3">
              {QUEUE_RULES.map((r) => (
                <li key={r} className="flex gap-3">
                  <CircleCheck aria-hidden="true" className="size-6 shrink-0 text-primary" strokeWidth={2} />
                  <span>{r}</span>
                </li>
              ))}
            </ul>
          </div>
          <p className="flex gap-3 rounded-[14px] border border-status-sighting/35 bg-status-sighting-soft px-4 py-3.5 text-[14.5px]">
            <Lock aria-hidden="true" className="mt-px size-5 shrink-0 text-status-sighting" strokeWidth={2} />
            <span>
              Seu contato é privado. WhatsApp é opcional, fica só com a moderação e é compartilhado apenas se <strong>você</strong> decidir na conversa.
            </span>
          </p>
        </aside>
      </div>

      <section aria-labelledby="querem-adotar" className="flex flex-col gap-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="querem-adotar" className="text-2xl font-extrabold">
              Querem adotar
            </h2>
            <p className="mt-1 max-w-[62ch] text-text-secondary">
              Pessoas aprovadas pela moderação que escolheram aparecer aqui. Mostramos só o primeiro nome, o bairro e o que procuram.
            </p>
            {contactListings.length > 0 && (
              <p className="mt-1 max-w-[62ch] text-sm text-text-secondary">
                Você tem animal disponível: em quem aceitou ser contatado aparece “Conversar”. A conversa fica no chat da MEL.
              </p>
            )}
          </div>
          {seekers && seekers.total > 0 && <p className="text-sm text-text-secondary">{seekers.total === 1 ? "1 pessoa" : `${seekers.total} pessoas`}</p>}
        </div>
        {seekers === null ? (
          <ErrorState>Não conseguimos carregar a lista agora. Atualize a página.</ErrorState>
        ) : seekers.items.length === 0 ? (
          <div className="grid justify-items-center gap-2.5 rounded-[20px] border-[1.5px] border-dashed border-border-strong px-6 py-8 text-center text-text-secondary">
            <Users aria-hidden="true" className="size-10 text-primary" strokeWidth={1.75} />
            <p className="font-semibold text-text-primary">Ninguém na lista pública ainda</p>
            <p>Quem cadastra o interesse pode escolher aparecer aqui.</p>
          </div>
        ) : (
          <ul className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,260px),1fr))] gap-4">
            {seekers.items.map((s, i) => (
              <li key={`${s.firstName}-${s.areaLabel}-${i}`}>
                <SeekerCard
                  s={s}
                  action={
                    s.contactRef && contactListings.length > 0 ? (
                      <SeekerContactButton contactRef={s.contactRef} firstName={s.firstName} listings={contactListings} />
                    ) : undefined
                  }
                />
              </li>
            ))}
          </ul>
        )}
        <p className="flex gap-3 rounded-[14px] border border-border bg-surface-muted px-4 py-3.5 text-[14.5px]">
          <MessageCircle aria-hidden="true" className="mt-px size-5 shrink-0 text-primary" strokeWidth={2} />
          <span>
            Tem um animal para doar? <Link href="/publicar/adocao" className="font-semibold text-link underline-offset-2 hover:underline">Publique o anúncio</Link>: depois
            da moderação, quem combina com ele recebe o aviso e fala com você pelo chat da MEL, sem expor telefone nem endereço.
          </span>
        </p>
      </section>
    </div>
  );
}

const STEPS = [
  { icon: Search, title: "Conheça", text: "Veja os animais disponíveis ou entre na fila de interessados." },
  { icon: MessageCircle, title: "Converse", text: "A ONG ou o protetor fala com você pelo chat da MEL." },
  { icon: House, title: "Visite", text: "Encontro presencial e termo de adoção responsável." },
  { icon: Heart, title: "Acompanhe", text: "Quem doou pode acompanhar a adaptação nas primeiras semanas." },
];

function HowItWorks() {
  return (
    <div className="flex flex-col gap-5.5">
      <ol className="grid gap-4 [counter-reset:mel-step] sm:grid-cols-2 min-[1100px]:grid-cols-4">
        {STEPS.map(({ icon: Icon, title, text }) => (
          <li key={title} className="mel-adopt-step relative rounded-[18px] border border-border bg-surface-muted/60 p-6.5">
            <span aria-hidden="true" className="absolute top-5.5 right-5.5 flex size-11 items-center justify-center rounded-xl bg-primary/12 text-primary">
              <Icon className="size-5.5" strokeWidth={2} />
            </span>
            <h3 className="mb-2 text-[21px] font-bold">{title}</h3>
            <p className="text-text-secondary">{text}</p>
          </li>
        ))}
      </ol>
      <p className="flex gap-3 rounded-[14px] border border-status-sighting/35 bg-status-sighting-soft px-4 py-3.5 text-[14.5px]">
        <ShieldCheck aria-hidden="true" className="mt-px size-5 shrink-0 text-status-sighting" strokeWidth={2} />
        <span>A MEL não vende animais nem cobra taxas. Anúncios com venda são removidos pela moderação.</span>
      </p>
    </div>
  );
}
