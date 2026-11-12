import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { ArrowLeft, CircleCheck, Lock } from "lucide-react";
import { CLOSED_INTEREST_RETENTION_DAYS, needsOnboarding, SEEKER_DELETE_AFTER_EXPIRY_DAYS, SEEKER_MATCHES_PER_DAY, SEEKER_VALID_DAYS } from "@mel/core";
import { getMyAdoptionSeeker } from "@mel/data";
import { getCurrentProfile, getSessionUser } from "@/lib/session";
import { createSessionClient } from "@/lib/supabase/server";
import { SeekerForm } from "@/components/adoption/SeekerForm";
import { SeekerStatus } from "@/components/adoption/SeekerStatus";
import { ErrorState, LoadingState } from "@/components/ui/States";

export const metadata: Metadata = {
  title: "Quero adotar",
  description: "Cadastre seu interesse em adotar e a MEL avisa quando houver um animal compatível perto de você. Seu contato fica privado.",
};

/**
 * Fila de interessados. A página é aberta a visitantes (a explicação vem antes
 * do login); só o envio exige conta, e o rascunho volta depois do login.
 */
export default function SeekerPage() {
  return (
    <main className="mel-container flex-1 pt-8 pb-16">
      <Link href="/adocao?aba=quero-adotar" className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-link hover:underline">
        <ArrowLeft aria-hidden="true" className="size-4" strokeWidth={2} /> Adoção
      </Link>
      <header className="animate-enter pt-3 pb-7">
        <h1 className="text-[clamp(32px,5vw,48px)] leading-[1.08] font-black tracking-[-0.03em]">Quero adotar um pet</h1>
        <p className="mt-2.5 max-w-[60ch] text-lg text-text-secondary">
          Ainda não encontrou o pet ideal? Cadastre seu interesse e avisaremos quando houver um animal compatível.
        </p>
      </header>
      <div className="grid items-start gap-7 min-[960px]:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] min-[960px]:gap-12">
        <div className="min-w-0 rounded-[22px] border border-border bg-surface p-5 md:p-8">
          <Suspense fallback={<LoadingState />}>
            <Content />
          </Suspense>
        </div>
        <aside className="grid gap-4">
          <div className="grid gap-3.5 rounded-[22px] border border-border bg-surface p-6 md:p-8">
            <h2 className="text-xl font-bold">Como a fila funciona</h2>
            <ul className="grid gap-3">
              {[
                "Seu interesse entra numa fila revisada pela moderação.",
                `Quando um animal compatível é aprovado perto de você, avisamos pela MEL (no máximo ${SEEKER_MATCHES_PER_DAY} avisos por dia) e você fala com quem cuida dele pelo chat.`,
                `O interesse vale por ${SEEKER_VALID_DAYS} dias. Avisamos uma semana antes e você pode renovar.`,
                `Sem renovação, o perfil sai da fila no vencimento e é apagado ${SEEKER_DELETE_AFTER_EXPIRY_DAYS} dias depois.`,
                `Interesses enviados a anúncios encerrados (adotado ou removido) são apagados ${CLOSED_INTEREST_RETENTION_DAYS} dias após o encerramento.`,
                "Cancelar apaga seus dados na hora.",
              ].map((r) => (
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
    </main>
  );
}

async function Content() {
  await connection();
  const user = await getSessionUser();
  if (!user || user.isAnonymous) return <SeekerForm viewer="visitor" firstName={null} initial={null} />;
  const profile = await getCurrentProfile();
  const firstName = profile?.displayName?.trim().split(/\s+/)[0] ?? null;
  if (needsOnboarding(profile)) return <SeekerForm viewer="onboarding" firstName={firstName} initial={null} />;
  let seeker;
  try {
    seeker = await getMyAdoptionSeeker(await createSessionClient());
  } catch (error) {
    console.error("[quero-adotar] falha", error);
    return <ErrorState>Não conseguimos carregar o seu interesse agora. Atualize a página.</ErrorState>;
  }
  return seeker ? <SeekerStatus seeker={seeker} firstName={firstName} /> : <SeekerForm viewer="ready" firstName={firstName} initial={null} />;
}
