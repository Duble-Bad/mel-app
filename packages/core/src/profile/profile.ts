import { z } from "zod";

export const BR_STATES = [
  { uf: "AC", name: "Acre" },
  { uf: "AL", name: "Alagoas" },
  { uf: "AP", name: "Amapá" },
  { uf: "AM", name: "Amazonas" },
  { uf: "BA", name: "Bahia" },
  { uf: "CE", name: "Ceará" },
  { uf: "DF", name: "Distrito Federal" },
  { uf: "ES", name: "Espírito Santo" },
  { uf: "GO", name: "Goiás" },
  { uf: "MA", name: "Maranhão" },
  { uf: "MT", name: "Mato Grosso" },
  { uf: "MS", name: "Mato Grosso do Sul" },
  { uf: "MG", name: "Minas Gerais" },
  { uf: "PA", name: "Pará" },
  { uf: "PB", name: "Paraíba" },
  { uf: "PR", name: "Paraná" },
  { uf: "PE", name: "Pernambuco" },
  { uf: "PI", name: "Piauí" },
  { uf: "RJ", name: "Rio de Janeiro" },
  { uf: "RN", name: "Rio Grande do Norte" },
  { uf: "RS", name: "Rio Grande do Sul" },
  { uf: "RO", name: "Rondônia" },
  { uf: "RR", name: "Roraima" },
  { uf: "SC", name: "Santa Catarina" },
  { uf: "SP", name: "São Paulo" },
  { uf: "SE", name: "Sergipe" },
  { uf: "TO", name: "Tocantins" },
] as const;

export type BrState = (typeof BR_STATES)[number]["uf"];

const UFS = BR_STATES.map((s) => s.uf) as [BrState, ...BrState[]];

export interface Profile {
  id: string;
  displayName: string | null;
  avatarUrl: string | null;
  city: string | null;
  state: BrState | null;
  role: "user" | "moderator" | "admin";
  isAnonymous: boolean;
  onboardedAt: string | null;
}

/** Dados mínimos pedidos no cadastro (spec §6): nome, cidade, estado. Foto é opcional. */
export const profileInputSchema = z.object({
  displayName: z
    .string()
    .trim()
    .min(2, "Conte pra gente como podemos te chamar.")
    .max(80, "Use no máximo 80 caracteres."),
  city: z.string().trim().min(2, "Qual é a sua cidade?").max(80, "Use no máximo 80 caracteres."),
  state: z.enum(UFS, { error: "Escolha o seu estado." }),
});

export type ProfileInput = z.infer<typeof profileInputSchema>;

export const credentialsSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.email("Confira o e-mail. Ele precisa ser parecido com nome@exemplo.com.")),
  password: z.string().min(8, "A senha precisa ter pelo menos 8 caracteres."),
});

export type Credentials = z.infer<typeof credentialsSchema>;

export const emailSchema = credentialsSchema.shape.email;
export const passwordSchema = credentialsSchema.shape.password;

/** Precisa passar pelo onboarding antes de usar áreas logadas. */
export function needsOnboarding(profile: Pick<Profile, "onboardedAt"> | null): boolean {
  return !profile?.onboardedAt;
}

/** Só aceita caminhos internos — evita redirecionamento aberto via ?next=. */
export function safeNextPath(next: string | null | undefined, fallback = "/perfil"): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return fallback;
  return next;
}

/** Primeira mensagem de erro por campo, pronta para exibir no formulário. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    out[key] ??= issue.message;
  }
  return out;
}
