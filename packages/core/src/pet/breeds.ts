import type { Species } from "./pet";

/**
 * Raças reconhecidas (FCI, CBKC, AKC; TICA/CFA/FIFe/WCF para gatos), com o nome
 * mais usado no Brasil. O valor salvo no banco é exatamente o texto da lista,
 * para o Radar MEL comparar "perdido × encontrado" sem depender de digitação.
 * Para acrescentar uma raça, basta incluí-la aqui (ordem alfabética é automática).
 */

/** Valor salvo para animais sem raça definida (vira-lata). */
export const SRD = "SRD";
export const SRD_LABEL = "Sem raça definida (SRD)";

const DOG_BREEDS = [
  "Affenpinscher",
  "Airedale Terrier",
  "Akita",
  "Akita Americano",
  "Alaskan Klee Kai",
  "American Bully",
  "American Pit Bull Terrier",
  "American Staffordshire Terrier",
  "Azawakh",
  "Barbet",
  "Basenji",
  "Basset Fulvo da Bretanha",
  "Basset Hound",
  "Beagle",
  "Beagle-Harrier",
  "Bearded Collie",
  "Bedlington Terrier",
  "Bergamasco",
  "Berger Picard",
  "Bichon Bolonhês",
  "Bichon Frisé",
  "Bichon Havanês",
  "Biewer Terrier",
  "Black and Tan Coonhound",
  "Bloodhound (Cão de Santo Humberto)",
  "Bluetick Coonhound",
  "Boerboel",
  "Boiadeiro Australiano",
  "Boiadeiro Bernês",
  "Boiadeiro de Appenzell",
  "Boiadeiro de Entlebuch",
  "Border Collie",
  "Border Terrier",
  "Borzoi",
  "Boston Terrier",
  "Bouvier de Flandres",
  "Boxer",
  "Boykin Spaniel",
  "Braco Alemão de Pelo Curto",
  "Braco Alemão de Pelo Duro",
  "Braco Italiano",
  "Briard",
  "Bull Terrier",
  "Bull Terrier Miniatura",
  "Bulldog Americano",
  "Bulldog Campeiro",
  "Bulldog Francês",
  "Bulldog Inglês",
  "Bullmastiff",
  "Cairn Terrier",
  "Cane Corso",
  "Cão d'Água Espanhol",
  "Cão d'Água Português",
  "Cão da Serra da Estrela",
  "Cão de Crista Chinês",
  "Cão de Fila de São Miguel",
  "Cão de Gado Transmontano",
  "Cão do Faraó",
  "Cão Lobo Checoslovaco",
  "Cão Pelado Mexicano (Xoloitzcuintle)",
  "Cão Pelado Peruano",
  "Cavalier King Charles Spaniel",
  "Cesky Terrier",
  "Chesapeake Bay Retriever",
  "Chihuahua",
  "Chinook",
  "Chow Chow",
  "Clumber Spaniel",
  "Cocker Spaniel Americano",
  "Cocker Spaniel Inglês",
  "Collie de Pelo Curto",
  "Collie de Pelo Longo",
  "Coton de Tulear",
  "Curly-Coated Retriever",
  "Dachshund (Teckel/Salsicha)",
  "Dálmata",
  "Dandie Dinmont Terrier",
  "Dobermann",
  "Dogo Argentino",
  "Dogo Canário (Presa Canário)",
  "Dogue Alemão",
  "Dogue Brasileiro",
  "Dogue de Bordeaux",
  "Esquimó Americano",
  "Eurasier",
  "Field Spaniel",
  "Fila Brasileiro",
  "Flat-Coated Retriever",
  "Foxhound Americano",
  "Foxhound Inglês",
  "Fox Terrier de Pelo Duro",
  "Fox Terrier de Pelo Liso",
  "Galgo Afegão",
  "Galgo Espanhol",
  "Galgo Inglês (Greyhound)",
  "Glen of Imaal Terrier",
  "Golden Retriever",
  "Gordon Setter",
  "Grande Boiadeiro Suíço",
  "Griffon de Bruxelas",
  "Harrier",
  "Hovawart",
  "Husky Siberiano",
  "Irish Terrier",
  "Irish Water Spaniel",
  "Irish Wolfhound (Lébrel Irlandês)",
  "Jack Russell Terrier",
  "Kelpie Australiano",
  "Kerry Blue Terrier",
  "Komondor",
  "Kooikerhondje",
  "Kuvasz",
  "Labrador Retriever",
  "Lagotto Romagnolo",
  "Lakeland Terrier",
  "Landseer",
  "Leonberger",
  "Lhasa Apso",
  "Löwchen",
  "Lulu da Pomerânia (Spitz Alemão Anão)",
  "Malamute do Alasca",
  "Maltês",
  "Manchester Terrier",
  "Mastiff",
  "Mastim Napolitano",
  "Mastim Tibetano",
  "Mudi",
  "Norfolk Terrier",
  "Norwich Terrier",
  "Nova Scotia Duck Tolling Retriever",
  "Old English Sheepdog (Bobtail)",
  "Otterhound",
  "Ovelheiro Gaúcho",
  "Papillon",
  "Parson Russell Terrier",
  "Pastor Alemão",
  "Pastor Australiano",
  "Pastor Belga Groenendael",
  "Pastor Belga Laekenois",
  "Pastor Belga Malinois",
  "Pastor Belga Tervuren",
  "Pastor Branco Suíço",
  "Pastor Caucasiano",
  "Pastor da Anatólia",
  "Pastor da Ásia Central",
  "Pastor da Mantiqueira",
  "Pastor de Shetland (Sheltie)",
  "Pastor-dos-Pirineus",
  "Pastor Holandês",
  "Pastor Maremano-Abruzês",
  "Pequeno Lebréu Italiano",
  "Pequinês",
  "Perdigueiro Português",
  "Petit Basset Griffon Vendéen",
  "Pinscher Alemão",
  "Pinscher Miniatura",
  "Podengo Ibicenco",
  "Podengo Português",
  "Pointer Inglês",
  "Poodle Toy",
  "Poodle Miniatura",
  "Poodle Médio",
  "Poodle Gigante (Standard)",
  "Pug",
  "Puli",
  "Pumi",
  "Rastreador Brasileiro",
  "Redbone Coonhound",
  "Rhodesian Ridgeback",
  "Rottweiler",
  "Russkiy Toy",
  "Saluki",
  "Samoieda",
  "São Bernardo",
  "Schipperke",
  "Schnauzer Gigante",
  "Schnauzer Miniatura",
  "Schnauzer Standard",
  "Scottish Terrier",
  "Sealyham Terrier",
  "Setter Inglês",
  "Setter Irlandês",
  "Shar-Pei",
  "Shiba Inu",
  "Shih Tzu",
  "Silky Terrier Australiano",
  "Skye Terrier",
  "Sloughi",
  "Soft Coated Wheaten Terrier",
  "Spaniel Japonês (Chin)",
  "Spaniel Tibetano",
  "Spinone Italiano",
  "Spitz Alemão",
  "Spitz Finlandês",
  "Spitz Japonês",
  "Spitz Lobo (Keeshond)",
  "Springer Spaniel Inglês",
  "Staffordshire Bull Terrier",
  "Sussex Spaniel",
  "Terra Nova",
  "Terrier Australiano",
  "Terrier Brasileiro (Fox Paulistinha)",
  "Terrier Tibetano",
  "Tosa Inu",
  "Treeing Walker Coonhound",
  "Vizsla (Braco Húngaro)",
  "Weimaraner",
  "Welsh Corgi Cardigan",
  "Welsh Corgi Pembroke",
  "Welsh Springer Spaniel",
  "Welsh Terrier",
  "West Highland White Terrier",
  "Whippet",
  "Yorkshire Terrier",
] as const;

const CAT_BREEDS = [
  "Abissínio",
  "American Curl",
  "American Shorthair",
  "American Wirehair",
  "Angorá Turco",
  "Azul Russo",
  "Balinês",
  "Bengal",
  "Bobtail Americano",
  "Bobtail Japonês",
  "Bombaim",
  "Brasileiro de Pelo Curto",
  "British Longhair",
  "British Shorthair",
  "Burmês",
  "Burmilla",
  "Chartreux",
  "Chausie",
  "Cornish Rex",
  "Cymric",
  "Devon Rex",
  "Donskoy",
  "Egyptian Mau",
  "Exótico (Exotic Shorthair)",
  "Havana Brown",
  "Himalaio",
  "Javanês",
  "Khao Manee",
  "Korat",
  "LaPerm",
  "Lykoi",
  "Maine Coon",
  "Manx",
  "Munchkin",
  "Nebelung",
  "Norueguês da Floresta",
  "Ocicat",
  "Oriental de Pelo Curto",
  "Oriental de Pelo Longo",
  "Persa",
  "Peterbald",
  "Pixie-bob",
  "Ragamuffin",
  "Ragdoll",
  "Sagrado da Birmânia",
  "Savannah",
  "Scottish Fold",
  "Selkirk Rex",
  "Siamês",
  "Siberiano",
  "Singapura",
  "Snowshoe",
  "Somali",
  "Sphynx",
  "Thai",
  "Tonquinês",
  "Toyger",
  "Van Turco",
] as const;

/**
 * Apelidos populares → nome da lista. Uma raça, um valor salvo: "Yorkshire",
 * "Yorkie" e "Yorkshire micro" são todos o Yorkshire Terrier (variações de
 * tamanho não são raças). Só entram apelidos sem ambiguidade — "Poodle"
 * (4 tamanhos) continua exigindo escolha na lista.
 */
const BREED_ALIASES: Record<string, readonly string[]> = {
  // Para a busca achar a opção fixa "Sem raça definida (SRD)".
  [SRD_LABEL]: ["Vira-lata", "Viralata", "Mestiço", "Sem raça"],
  "Yorkshire Terrier": ["Yorkshire", "Yorkie", "Yorkshire mini", "Yorkshire micro", "Yorkshire toy"],
  "Labrador Retriever": ["Labrador"],
  "Golden Retriever": ["Golden"],
  "Husky Siberiano": ["Husky"],
  "American Pit Bull Terrier": ["Pit Bull", "Pitbull"],
  "Dachshund (Teckel/Salsicha)": ["Dachshund", "Teckel", "Salsicha", "Linguicinha"],
  "Lulu da Pomerânia (Spitz Alemão Anão)": ["Lulu da Pomerânia", "Lulu", "Spitz Alemão Anão", "Pomerânia"],
  "Pinscher Miniatura": ["Pinscher"],
  "Shih Tzu": ["Shih-tzu", "Shitzu"],
  "Bulldog Francês": ["Buldogue Francês"],
  "Bulldog Inglês": ["Buldogue Inglês"],
  "Pastor Belga Malinois": ["Malinois"],
  "Dogue Alemão": ["Dog Alemão", "Great Dane"],
  "Boiadeiro Australiano": ["Blue Heeler", "Red Heeler"],
  "Terrier Brasileiro (Fox Paulistinha)": ["Terrier Brasileiro", "Fox Paulistinha"],
  "Cão Pelado Mexicano (Xoloitzcuintle)": ["Xoloitzcuintle", "Xolo"],
  "Old English Sheepdog (Bobtail)": ["Bobtail"],
  "Galgo Inglês (Greyhound)": ["Greyhound"],
  "Bloodhound (Cão de Santo Humberto)": ["Bloodhound"],
  "Exótico (Exotic Shorthair)": ["Exótico", "Exotic"],
};

const fold = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").trim().toLowerCase();

const ALIAS_TO_BREED = new Map<string, string>(
  Object.entries(BREED_ALIASES).flatMap(([breed, aliases]) => aliases.map((a) => [fold(a), breed] as const)),
);

/** Apelidos de uma raça (para a busca). */
export const breedAliases = (breed: string): readonly string[] => BREED_ALIASES[breed] ?? [];

const collator = new Intl.Collator("pt-BR", { sensitivity: "base" });
const sorted = (list: readonly string[]) => [...list].sort(collator.compare);

const BREEDS: Partial<Record<Species, readonly string[]>> = {
  dog: sorted(DOG_BREEDS),
  cat: sorted(CAT_BREEDS),
};

/** Lista de raças da espécie (sem SRD), ou null quando a espécie usa texto livre. */
export function breedsFor(species: Species | null | undefined): readonly string[] | null {
  return (species && BREEDS[species]) || null;
}

/** Texto exibido para um valor salvo. */
export const breedLabel = (breed: string | null | undefined) => (breed === SRD ? SRD_LABEL : (breed ?? ""));

/** Variações de "sem raça" e apelidos populares viram o valor da lista. */
export function normalizeBreed(value: string | null): string | null {
  if (value == null) return null;
  const v = value.trim();
  if (!v) return null;
  if (/^(srd|sem ra[cç]a( definida)?(\s*\(srd\))?|vira[\s-]?lata|mesti[cç]o)$/i.test(v)) return SRD;
  return ALIAS_TO_BREED.get(fold(v)) ?? v;
}

/**
 * Texto digitado → raça da lista, quando não há dúvida: nome exato (sem
 * acento/maiúscula), apelido conhecido ou variação de SRD. Senão, null.
 */
export function resolveBreed(species: Species, typed: string): string | null {
  const normalized = normalizeBreed(typed);
  if (!normalized) return null;
  if (normalized === SRD) return SRD;
  const list = breedsFor(species);
  if (!list) return normalized;
  return list.find((b) => fold(b) === fold(normalized)) ?? null;
}

/** Valor aceito para a espécie: da lista, SRD ou (para "outro") texto livre. */
export function isValidBreed(species: Species, breed: string): boolean {
  const list = breedsFor(species);
  return breed === SRD || !list || list.includes(breed);
}

/**
 * Busca sem acento e sem diferenciar maiúsculas, também pelos apelidos:
 * "sao bern" → São Bernardo; "yorkie" → Yorkshire Terrier.
 */
export function searchBreeds(list: readonly string[], query: string): string[] {
  const q = fold(query);
  if (!q) return [...list];
  const starts: string[] = [];
  const contains: string[] = [];
  for (const breed of list) {
    const names = [breed, ...breedAliases(breed)].map(fold);
    if (names.some((n) => n.startsWith(q))) starts.push(breed);
    else if (names.some((n) => n.includes(q))) contains.push(breed);
  }
  return [...starts, ...contains];
}
