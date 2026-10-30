import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getMyLostCaseByCode, listMyPets } from "@mel/data";
import { requireOnboardedProfile } from "@/lib/session";
import { createSessionClient } from "@/lib/supabase/server";
import { LostWizard } from "@/components/lost/LostWizard";
import { ButtonLink } from "@/components/ui/Button";
import { ErrorState, LoadingState } from "@/components/ui/States";

export const metadata: Metadata = {
  title: "Editar alerta",
  robots: { index: false },
};

/** Editar um alerta ATIVO (só o tutor): onde, quando, detalhes e contato. */
export default function EditLostCasePage({ params }: PageProps<"/alerta/[code]/editar">) {
  return (
    <main className="mx-auto w-full max-w-md flex-1 px-4 pt-6 pb-10">
      <Suspense fallback={<LoadingState label="Carregando o alerta…" />}>
        {params.then(({ code }) => (
          <EditContent code={code} />
        ))}
      </Suspense>
    </main>
  );
}

async function EditContent({ code }: { code: string }) {
  if (!/^[a-z2-9]{6}$/i.test(code)) notFound();
  const profile = await requireOnboardedProfile(`/alerta/${code}/editar`);
  const supabase = await createSessionClient();
  let data;
  try {
    const [lostCase, pets] = await Promise.all([getMyLostCaseByCode(supabase, code), listMyPets(supabase, profile.id)]);
    data = { lostCase, pets };
  } catch (error) {
    console.error("[alerta/editar] falha ao carregar", error);
    return <ErrorState>Não conseguimos carregar o alerta agora. Atualize a página para tentar de novo.</ErrorState>;
  }
  // Só o próprio tutor enxerga a linha (RLS); de outra pessoa ou inexistente, 404.
  if (!data.lostCase || data.lostCase.ownerId !== profile.id) notFound();

  if (data.lostCase.status !== "ACTIVE") {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-bold">Este alerta não está mais ativo</h1>
        <p className="text-text-secondary">Um alerta encerrado ou reencontrado não pode mais ser editado.</p>
        <ButtonLink href={`/alerta/${data.lostCase.code}`} variant="secondary">
          Ver o alerta
        </ButtonLink>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <LostWizard
        mode="edit"
        profile={{ id: profile.id, city: profile.city, state: profile.state }}
        pets={data.pets}
        draft={data.lostCase}
      />
      <p className="text-center text-sm text-text-secondary">
        Foto, cor, porte ou raça?{" "}
        <Link href={`/perfil/pets/${data.lostCase.petId}`} className="font-semibold text-link underline-offset-4 hover:underline">
          Edite na ficha do pet
        </Link>
        {" · "}
        <Link href={`/alerta/${data.lostCase.code}`} className="font-semibold text-link underline-offset-4 hover:underline">
          Voltar ao alerta
        </Link>
      </p>
    </div>
  );
}
