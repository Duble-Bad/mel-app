import "server-only";
import { cacheLife } from "next/cache";
import { Heart, House, PawPrint, Users, type LucideIcon } from "lucide-react";
import { createServiceClient } from "@/lib/supabase/service";
import { CountUp } from "./CountUp";

interface Totals {
  people: number;
  pets: number;
  reunions: number;
  adoptions: number;
}

/**
 * Só totais (contagens "head", nenhuma linha sai do banco). Precisa da chave
 * secreta porque perfis e pets são privados por RLS. Em cache por horas: é
 * vitrine, não painel. Erro lança (não fica em cache) e quem chama esconde a faixa.
 */
async function getTotals(): Promise<Totals | null> {
  "use cache";
  cacheLife("hours");
  const db = createServiceClient();
  if (!db) return null;
  const head = { count: "exact", head: true } as const;
  // Contas de demonstração (app_metadata.mel_demo, scripts/demo-casos) não entram nos números.
  const demo = await demoAccountIds(db);
  const notDemo = `(${demo.length ? demo.join(",") : "00000000-0000-0000-0000-000000000000"})`;
  const [people, pets, reunions, adoptions] = await Promise.all([
    db.from("profiles").select("id", head).eq("is_anonymous", false).not("id", "in", notDemo),
    db.from("pets").select("id", head).not("owner_id", "in", notDemo),
    db.from("lost_cases").select("id", head).eq("status", "FOUND").not("owner_id", "in", notDemo),
    db.from("adoption_listings").select("id", head).eq("status", "ADOPTED").not("owner_id", "in", notDemo),
  ]);
  const failed = [people, pets, reunions, adoptions].find((r) => r.error);
  if (failed?.error) throw new Error(failed.error.message);
  return { people: people.count ?? 0, pets: pets.count ?? 0, reunions: reunions.count ?? 0, adoptions: adoptions.count ?? 0 };
}

async function demoAccountIds(db: NonNullable<ReturnType<typeof createServiceClient>>): Promise<string[]> {
  const ids: string[] = [];
  for (let page = 1; page <= 50; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error(error.message);
    ids.push(...data.users.filter((u) => u.app_metadata?.mel_demo === true).map((u) => u.id));
    if (data.users.length < 1000) break;
  }
  return ids;
}

const ITEMS: { key: keyof Totals; label: string; Icon: LucideIcon }[] = [
  { key: "people", label: "Pessoas na rede", Icon: Users },
  { key: "pets", label: "Pets cadastrados", Icon: PawPrint },
  { key: "reunions", label: "Reencontros", Icon: Heart },
  { key: "adoptions", label: "Adoções responsáveis", Icon: House },
];

/** Faixa de números reais da rede (sempre os totais reais; some só se a consulta falhar). */
export async function NetworkStats() {
  let totals: Totals | null;
  try {
    totals = await getTotals();
  } catch (error) {
    console.error("[home] números da rede indisponíveis", error);
    return null;
  }
  if (!totals) return null;

  return (
    <ul
      aria-label="Números da rede MEL"
      className="mt-7 grid animate-enter grid-cols-2 gap-x-3 gap-y-4.5 border-y border-border py-5.5 min-[900px]:grid-cols-4"
    >
      {ITEMS.map(({ key, label, Icon }) => (
        <li key={key} className="mh-stat flex items-center justify-center gap-3.5">
          <Icon aria-hidden="true" className="size-8 shrink-0 text-primary sm:size-9" strokeWidth={2} />
          <span className="flex flex-col">
            <strong className="text-[clamp(22px,3vw,28px)] leading-tight font-extrabold tabular-nums">
              <CountUp value={totals[key]} />
            </strong>
            <span className="text-sm text-text-secondary">{label}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}
