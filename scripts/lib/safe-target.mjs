// Trava contra execução acidental em produção.
//
// Seed, testes que criam/apagam dados e scripts administrativos só rodam contra:
//   1. Supabase LOCAL (127.0.0.1 / localhost / ::1), ou
//   2. um projeto na nuvem cujo ref esteja na lista de permissão
//      MEL_SAFE_TARGET_REFS (separada por vírgula), definida FORA do repositório
//      (.env.local ou variável do CI).
// Qualquer outro alvo — inclusive produção, que nunca entra na lista — é recusado.
// A decisão olha a URL REAL do alvo, não o nome de uma variável de ambiente.
// Sem configuração, só o ambiente local passa (falha segura por padrão).
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const LOCAL_HOSTS = new Set(["127.0.0.1", "localhost", "::1", "[::1]"]);
const REF = /^[a-z0-9]{20}$/;

export class UnsafeTargetError extends Error {
  constructor(message) {
    super(message);
    this.name = "UnsafeTargetError";
  }
}

/** Mostra só o começo do ref nas mensagens (não é segredo, mas não precisa ir inteiro para logs). */
const mask = (ref) => `${ref.slice(0, 4)}…`;

function allowedRefs(env) {
  return new Set(
    String(env.MEL_SAFE_TARGET_REFS ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter((s) => REF.test(s)),
  );
}

/** Classifica a URL do Supabase: local, projeto da nuvem (com ref) ou desconhecido. */
export function describeTarget(url) {
  let u;
  try {
    u = new URL(String(url ?? ""));
  } catch {
    return { kind: "invalid" };
  }
  if (LOCAL_HOSTS.has(u.hostname)) return { kind: "local", host: u.host };
  const m = u.hostname.match(/^([a-z0-9]{20})\.supabase\.co$/);
  if (m && u.protocol === "https:") return { kind: "cloud", ref: m[1] };
  return { kind: "unknown", host: u.hostname };
}

/**
 * Lança UnsafeTargetError se o alvo não for comprovadamente local ou de
 * desenvolvimento. `purpose` aparece na mensagem ("seed", "testes de banco"…).
 */
export function assertSafeTarget(url, purpose, env = process.env) {
  const t = describeTarget(url);
  if (t.kind === "local") return t;
  if (t.kind === "cloud" && allowedRefs(env).has(t.ref)) return t;
  const where =
    t.kind === "invalid" ? "URL do Supabase ausente ou inválida" : t.kind === "cloud" ? `projeto ${mask(t.ref)} fora da lista MEL_SAFE_TARGET_REFS` : `host não reconhecido (${t.host})`;
  throw new UnsafeTargetError(
    `[trava] ${purpose} recusado: ${where}. Só rodam contra o Supabase local ou projetos de desenvolvimento listados em MEL_SAFE_TARGET_REFS (fora do repositório). Produção nunca entra nessa lista.`,
  );
}

/**
 * Scripts administrativos (ex.: dar papel de moderação) também servem em
 * produção, mas só com confirmação explícita: --confirm-target=<ref exato do alvo>.
 */
export function assertAdminTarget(url, purpose, argv = process.argv, env = process.env) {
  try {
    return assertSafeTarget(url, purpose, env);
  } catch (err) {
    const t = describeTarget(url);
    const confirm = argv.find((a) => a.startsWith("--confirm-target="))?.split("=")[1];
    if (t.kind === "cloud" && confirm === t.ref) return t;
    throw new UnsafeTargetError(
      `${err.message} Para um script administrativo num projeto fora da lista, repita o comando com --confirm-target=<ref do projeto> (o ref completo, digitado de propósito).`,
    );
  }
}

/** O projeto ligado ao CLI (`supabase link`) precisa estar na lista de permissão. */
export function assertLinkedRefSafe(purpose, root = process.cwd(), env = process.env) {
  let ref = "";
  try {
    ref = readFileSync(resolve(root, "supabase/.temp/project-ref"), "utf8").trim();
  } catch {
    throw new UnsafeTargetError(`[trava] ${purpose} recusado: nenhum projeto ligado ao CLI (rode \`supabase link\` com o projeto de DESENVOLVIMENTO).`);
  }
  return assertSafeTarget(`https://${ref}.supabase.co`, purpose, env);
}
