import { formatDateTimeBr, radiusLabel, SEEKER_HOUSING_LABELS, SEEKER_OTHER_PETS_LABELS, seekerPreferenceLabel } from "@mel/core";
import { listAdoptionSeekersForReview } from "@mel/data";
import { createSessionClient } from "@/lib/supabase/server";
import { ErrorState } from "@/components/ui/States";
import { SeekerReview } from "./SeekerReview";

/** Fila de interessados em adotar (moderação). Só aqui aparece o WhatsApp privado. */
export async function SeekerQueue() {
  let items;
  try {
    items = await listAdoptionSeekersForReview(await createSessionClient());
  } catch (error) {
    console.error("[admin] fila de interessados", error);
    return <ErrorState>Não conseguimos carregar a fila de interessados.</ErrorState>;
  }
  return (
    <section aria-labelledby="interessados" className="flex flex-col gap-3">
      <h2 id="interessados" className="text-xl font-bold">
        Interessados em adotar ({items.length})
      </h2>
      {items.length === 0 ? (
        <p className="text-text-secondary">Nenhum perfil aguardando revisão.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {items.map((s) => (
            <li key={s.id} className="flex flex-col gap-3 rounded-card border border-border bg-surface p-4">
              <div className="flex flex-col gap-1">
                <p className="font-bold">
                  {s.firstName ?? "Sem nome"} · {s.areaLabel} (até {radiusLabel(s.radiusM as 1000 | 3000 | 5000 | 10000)})
                </p>
                <p className="text-sm text-text-secondary">
                  {seekerPreferenceLabel(s)} · {SEEKER_HOUSING_LABELS[s.housing]} · outros animais: {SEEKER_OTHER_PETS_LABELS[s.otherPets].toLowerCase()} ·
                  crianças: {s.children == null ? "não informado" : s.children ? "sim" : "não"}
                </p>
                <p className="text-sm whitespace-pre-line">{s.routine}</p>
                <p className="text-sm text-text-secondary">
                  {s.showPublic ? "Quer aparecer na lista pública" : "Perfil privado"} · WhatsApp (privado): {s.whatsapp ?? "não informado"} · enviado em{" "}
                  {formatDateTimeBr(s.createdAt)}
                </p>
              </div>
              <SeekerReview id={s.id} name={s.firstName ?? "o perfil"} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
