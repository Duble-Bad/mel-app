import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { formatDateTimeBr, needsTermsAcceptance, TERMS_VERSION } from "@mel/core";
import { listMyConsents } from "@mel/data";
import { requireOnboardedProfile } from "@/lib/session";
import { createSessionClient } from "@/lib/supabase/server";
import { AcceptTermsButton, DeleteAccount, ExportDataButton } from "@/components/profile/PrivacyActions";
import { LoadingState } from "@/components/ui/States";

export const metadata: Metadata = { title: "Privacidade e dados", robots: { index: false } };

export default function PrivacySettingsPage() {
  return (
    <main className="mx-auto w-full max-w-md flex-1 px-[var(--mel-page-gutter)] pt-6 pb-12">
      <h1 className="mb-1.5 text-2xl font-bold">Privacidade e dados</h1>
      <p className="mb-6 text-text-secondary">
        Seus dados são seus. Veja a{" "}
        <Link href="/privacidade" className="font-semibold text-link underline">
          Política de privacidade
        </Link>
        .
      </p>
      <Suspense fallback={<LoadingState />}>
        <Content />
      </Suspense>
    </main>
  );
}

async function Content() {
  const profile = await requireOnboardedProfile("/perfil/privacidade");
  const consents = await listMyConsents(await createSessionClient()).catch(() => []);
  const last = consents[0];
  return (
    <div className="flex flex-col gap-8">
      <section aria-labelledby="aceite" className="flex flex-col gap-2">
        <h2 id="aceite" className="text-xl font-bold">
          Termos e privacidade
        </h2>
        {needsTermsAcceptance(consents) ? (
          <>
            <p className="text-text-secondary">
              {last ? "Os Termos de uso e a Política de privacidade mudaram desde o seu último aceite." : "Ainda não registramos seu aceite."} Leia
              os{" "}
              <Link href="/termos" className="font-semibold text-link underline">
                Termos de uso
              </Link>{" "}
              e a{" "}
              <Link href="/privacidade" className="font-semibold text-link underline">
                Política de privacidade
              </Link>
              .
            </p>
            <AcceptTermsButton userId={profile.id} />
          </>
        ) : (
          <p className="text-text-secondary">Você aceitou a versão {last!.version === TERMS_VERSION ? "atual" : last!.version} em {formatDateTimeBr(last!.createdAt)}.</p>
        )}
      </section>

      <section aria-labelledby="copia" className="flex flex-col gap-3">
        <h2 id="copia" className="text-xl font-bold">
          Cópia dos seus dados
        </h2>
        <p className="text-text-secondary">Um arquivo com tudo o que a MEL guarda sobre você: perfil, pets, alertas, conversas e mais.</p>
        <ExportDataButton />
      </section>

      <section aria-labelledby="excluir" className="flex flex-col gap-3 rounded-card border border-border bg-surface p-4">
        <h2 id="excluir" className="text-xl font-bold">
          Excluir conta
        </h2>
        <p className="text-text-secondary">
          Apaga sua conta e tudo o que é seu. Avistamentos que você enviou para ajudar outras famílias continuam, sem seu nome e sem foto.
        </p>
        <DeleteAccount />
      </section>
    </div>
  );
}
