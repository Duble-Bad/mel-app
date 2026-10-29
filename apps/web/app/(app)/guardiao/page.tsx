import type { Metadata } from "next";
import { Suspense } from "react";
import { getGuardianSettings } from "@mel/data";
import { requireOnboardedProfile } from "@/lib/session";
import { createSessionClient } from "@/lib/supabase/server";
import { GuardianForm } from "@/components/guardian/GuardianForm";
import { LoadingState } from "@/components/ui/States";

export const metadata: Metadata = { title: "Guardião MEL", robots: { index: false } };

export default function GuardianPage() {
  return (
    <main className="mx-auto w-full max-w-xl flex-1 px-[var(--mel-page-gutter)] pt-6 pb-12">
      <Suspense fallback={<LoadingState />}>
        <Content />
      </Suspense>
    </main>
  );
}

async function Content() {
  const profile = await requireOnboardedProfile("/guardiao");
  const settings = await getGuardianSettings(await createSessionClient(), profile.id);
  return <GuardianForm userId={profile.id} initial={settings} />;
}
