import { ageLabel } from "../adoption/adoption";
import { formatBrPhone, WEARING_LABELS, type PublicLostCase } from "../lost/lost";
import { breedLabel } from "../pet/breeds";
import { SEX_LABELS, SIZE_LABELS } from "../pet/pet";

/** Dados do cartaz "completo" (modelo 4) que vêm do cadastro (todos públicos no alerta). */
export interface CollageExtras {
  /** Faixa amarela: raça, sexo, idade, porte, o que usava (só o que foi informado). */
  strip: string[];
  /** Características: o texto do tutor, sem mudanças, dividido em frases. */
  features: string[];
  /** "DESAPARECEU EM CIDADE/UF" (ou só "VISTO POR ÚLTIMO" sem cidade). */
  placeTitle: string;
  /** Região pública do alerta. */
  placeLine: string | null;
  /** Telefone que o tutor autorizou publicar no alerta; null = não aparece. */
  phone: { number: string; whatsapp: boolean } | null;
  /** Artigo do nome ("a", "o" ou nada), para "VIU A MEL?". */
  article: "a" | "o" | "";
}

/** Idade em meses: pela data de nascimento ou pela estimativa do cadastro (null se não informada). */
function ageMonths(pet: PublicLostCase["pet"], now: Date): number | null {
  if (pet.birthDate) {
    const b = new Date(`${pet.birthDate}T12:00:00`);
    const m = (now.getFullYear() - b.getFullYear()) * 12 + now.getMonth() - b.getMonth() - (now.getDate() < b.getDate() ? 1 : 0);
    return m >= 0 ? m : null;
  }
  return pet.ageEstimateMonths ?? null;
}

/**
 * Dados do Modelo 4 a partir do alerta PÚBLICO. Nada é inventado: a faixa só tem o que o
 * cadastro informa ("sem coleira" não é deduzido de um campo vazio); as características são o
 * texto do tutor, sem mudanças, só dividido em frases; o telefone só existe quando o tutor
 * autorizou publicá-lo (o banco só devolve o número nesse caso).
 */
export function collageExtras(
  c: Pick<PublicLostCase, "pet" | "notes" | "wearing" | "areaLabel" | "city" | "state" | "contactWhatsapp" | "contactPhone">,
  now = new Date(),
): CollageExtras {
  const p = c.pet;
  const months = ageMonths(p, now);
  const strip = [
    p.breed ? breedLabel(p.breed) : null,
    p.sex !== "unknown" ? SEX_LABELS[p.sex] : null,
    months != null ? ageLabel(months) : null,
    p.size ? `Porte ${SIZE_LABELS[p.size].label.toLowerCase()}` : null,
    ...(c.wearing ?? []).map((w) => `Com ${WEARING_LABELS[w].toLowerCase()}`),
  ].filter((s): s is string => Boolean(s));
  const text = [p.uniqueMarks, c.notes].filter(Boolean).join("\n");
  const features = text
    .split(/(?<=[.!?;])\s+|\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const number = c.contactWhatsapp ?? c.contactPhone;
  return {
    strip: strip.length ? strip : [p.species === "cat" ? "Gato" : p.species === "dog" ? "Cachorro" : "Pet"],
    features,
    placeTitle: c.city ? `DESAPARECEU EM ${c.city.toLocaleUpperCase("pt-BR")}${c.state ? `/${c.state}` : ""}` : "VISTO POR ÚLTIMO",
    placeLine: c.areaLabel,
    phone: number ? { number: formatBrPhone(number), whatsapp: Boolean(c.contactWhatsapp) } : null,
    article: p.sex === "female" ? "a" : p.sex === "male" ? "o" : "",
  };
}
