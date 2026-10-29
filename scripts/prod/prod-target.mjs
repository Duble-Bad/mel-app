// Alvo de PRODUÇÃO: validação própria, separada da trava de desenvolvimento
// (scripts/lib/safe-target.mjs). Adicionar o ref de produção a
// MEL_SAFE_TARGET_REFS NÃO libera nada aqui — pelo contrário: aborta.
//
// Tudo chega em tempo de execução, nunca do repositório:
//   argumentos  --production  --expect-ref=<ref do mel-prod>
//   ambiente    MEL_PROD_PROJECT_REF=<ref do mel-prod>   (o mesmo, digitado de novo)
//               MEL_PROD_DB_URL=<URL do banco do mel-prod, com senha>
//               MEL_PROD_DB_CA_FILE=<certificado SSL baixado do painel do mel-prod>
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const REF = /^[a-z0-9]{20}$/;

export class ProdTargetError extends Error {
  constructor(message) {
    super(`[produção] ABORTADO: ${message}`);
    this.name = "ProdTargetError";
  }
}

const mask = (ref) => `${String(ref).slice(0, 4)}…`;

/**
 * Extrai o ref do projeto da URL do banco. Só aceita os dois formatos do
 * Supabase em que o ref decide para onde a conexão vai:
 *   direto:  postgresql://postgres:SENHA@db.<ref>.supabase.co:5432/postgres
 *   pooler:  postgresql://postgres.<ref>:SENHA@<região>.pooler.supabase.com:5432/postgres
 */
export function parseProdDbUrl(url) {
  let u;
  try {
    u = new URL(String(url ?? ""));
  } catch {
    throw new ProdTargetError("MEL_PROD_DB_URL ausente ou inválida.");
  }
  if (!/^postgres(ql)?:$/.test(u.protocol)) throw new ProdTargetError("MEL_PROD_DB_URL precisa ser postgresql://");
  if (!u.password) throw new ProdTargetError("MEL_PROD_DB_URL sem senha.");
  const direct = u.hostname.match(/^db\.([a-z0-9]{20})\.supabase\.co$/);
  if (direct && u.username === "postgres") return { ref: direct[1], mode: "direto" };
  const pooled = decodeURIComponent(u.username).match(/^postgres\.([a-z0-9]{20})$/);
  if (pooled && /^[a-z0-9-]+\.pooler\.supabase\.com$/.test(u.hostname)) {
    if (u.port === "6543") throw new ProdTargetError("use a porta 5432 do pooler (modo sessão); 6543 (transação) não serve para migrations.");
    return { ref: pooled[1], mode: "pooler" };
  }
  throw new ProdTargetError("MEL_PROD_DB_URL não é um banco Supabase reconhecível (db.<ref>.supabase.co ou postgres.<ref>@…pooler.supabase.com).");
}

function refFromSupabaseUrl(url) {
  return String(url ?? "").match(/^https:\/\/([a-z0-9]{20})\.supabase\.co/)?.[1];
}

/**
 * Valida TODAS as condições do alvo de produção. Lança ProdTargetError na
 * primeira que falhar. Não conecta em nada.
 */
export function assertProdTarget({ argv = process.argv, env = process.env, root = process.cwd() } = {}) {
  if (env.CI || env.GITHUB_ACTIONS) throw new ProdTargetError("procedimento de produção não roda em CI; só num terminal, por uma pessoa.");
  if (!argv.includes("--production")) throw new ProdTargetError("falta --production (indicação explícita de que a operação é de produção).");

  const argRef = argv.find((a) => a.startsWith("--expect-ref="))?.split("=")[1] ?? "";
  const envRef = env.MEL_PROD_PROJECT_REF ?? "";
  if (!REF.test(argRef)) throw new ProdTargetError("--expect-ref=<ref do mel-prod> ausente ou inválido (20 letras minúsculas/números).");
  if (!REF.test(envRef)) throw new ProdTargetError("MEL_PROD_PROJECT_REF ausente ou inválido.");
  if (argRef !== envRef) throw new ProdTargetError("--expect-ref e MEL_PROD_PROJECT_REF são diferentes.");
  const ref = argRef;

  const db = parseProdDbUrl(env.MEL_PROD_DB_URL);
  if (db.ref !== ref) throw new ProdTargetError(`MEL_PROD_DB_URL aponta para ${mask(db.ref)}, não para o projeto esperado ${mask(ref)}.`);

  // Separação de desenvolvimento.
  const devRefs = String(env.MEL_SAFE_TARGET_REFS ?? "").split(",").map((s) => s.trim());
  if (devRefs.includes(ref)) throw new ProdTargetError("o ref de produção está em MEL_SAFE_TARGET_REFS (lista de DESENVOLVIMENTO). Remova-o de lá antes de qualquer coisa.");
  const linked = existsSync(resolve(root, "supabase/.temp/project-ref")) ? readFileSync(resolve(root, "supabase/.temp/project-ref"), "utf8").trim() : "";
  if (linked === ref) throw new ProdTargetError("o CLI está ligado (supabase link) ao projeto de produção. Religue ao mel-dev: produção nunca fica ligada.");
  const envLocal = existsSync(resolve(root, ".env.local")) ? readFileSync(resolve(root, ".env.local"), "utf8") : "";
  const envLocalRef = refFromSupabaseUrl(envLocal.match(/^NEXT_PUBLIC_SUPABASE_URL=(.*)$/m)?.[1]);
  if (envLocalRef === ref) throw new ProdTargetError(".env.local aponta para produção. Ele é de desenvolvimento/testes e nunca pode apontar para o mel-prod.");
  if (refFromSupabaseUrl(env.NEXT_PUBLIC_SUPABASE_URL) === ref) throw new ProdTargetError("NEXT_PUBLIC_SUPABASE_URL deste terminal aponta para produção; abra um terminal limpo.");

  const caFile = env.MEL_PROD_DB_CA_FILE ?? "";
  if (!caFile || !existsSync(caFile)) throw new ProdTargetError("MEL_PROD_DB_CA_FILE ausente: baixe o certificado SSL do mel-prod (Settings → Database → SSL) para a conexão ser verificada.");

  return { ref, dbUrl: env.MEL_PROD_DB_URL, dbMode: db.mode, ssl: { ca: readFileSync(caFile, "utf8"), rejectUnauthorized: true } };
}

/** Exige um terminal interativo (nada de execução automática, scripts ou agentes). */
export function assertInteractive(stdin = process.stdin, stdout = process.stdout) {
  if (!stdin.isTTY || !stdout.isTTY) throw new ProdTargetError("precisa de um terminal interativo (TTY). Execução automática/não interativa é recusada.");
}

export { mask as maskRef };
