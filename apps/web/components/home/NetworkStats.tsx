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

// Abaixo disso o número mais atrapalha do que ajuda (rede começando): a faixa some.
const MIN_MEANINGFUL = 10;

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
  const [people, pets, reunions, adoptions] = await Promise.all([
    db.from("profiles").select("id", head).eq("is_anonymous", false),
    db.from("pets").select("id", head),
    db.from("lost_cases").select("id", head).eq("status", "FOUND"),
    db.from("adoption_listings").select("id", head).eq("status", "ADOPTED"),
  ]);
  const failed = [people, pets, reunions, adoptions].find((r) => r.error);
  if (failed?.error) throw new Error(failed.error.message);
  return { people: people.count ?? 0, pets: pets.count ?? 0, reunions: reunions.count ?? 0, adoptions: adoptions.count ?? 0 };
}

const ITEMS: { key: keyof Totals; label: string; Icon: LucideIcon }[] = [
  { key: "people", label: "Pessoas na rede", Icon: Users },
  { key: "pets", label: "Pets cadastrados", Icon: PawPrint },
  { key: "reunions", label: "Reencontros", Icon: Heart },
  { key: "adoptions", label: "Adoções responsáveis", Icon: House },
];

/** Faixa de números reais da rede (só aparece quando todos são significativos). */
export async function NetworkStats() {
  let totals: Totals | null;
  try {
    totals = await getTotals();
  } catch (error) {
    console.error("[home] números da rede indisponíveis", error);
    return null;
  }
  if (!totals || ITEMS.some(({ key }) => totals[key] < MIN_MEANINGFUL)) return null;

  return (
    <ul
      aria-label="Números da rede MEL"
      className="mt-7 grid animate-enter grid-cols-2 gap-x-3 gap-y-5 border-y border-border py-5 min-[900px]:grid-cols-4"
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
