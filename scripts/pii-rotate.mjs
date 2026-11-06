// Rotação de chaves do CPF (recifragem sem perda). Procedimento completo:
// docs/18-chaves-pii.md. Uso (as chaves vêm do ambiente; nunca na linha de comando):
//
//   node scripts/pii-rotate.mjs              # simulação: só conta o que faria
//   node scripts/pii-rotate.mjs --apply      # recifra/recalcula e marca ilegíveis
//   node scripts/pii-rotate.mjs --apply --force-mark   # marca mesmo se quase tudo falhar
//
// Ambiente esperado durante a rotação:
//   MEL_PII_ENC_KEY / MEL_PII_ENC_KEY_VERSION  = chave e versão NOVAS
//   MEL_PII_ENC_KEYS_PREVIOUS                  = "1:<chave antiga>" (para abrir)
//   MEL_PII_HMAC_KEY / MEL_PII_HMAC_KEY_VERSION e MEL_PII_HMAC_KEYS_PREVIOUS, idem
//
// Trava: só roda contra o Supabase local ou um projeto em MEL_SAFE_TARGET_REFS;
// fora disso (ex.: produção, numa operação planejada) exige
// --confirm-target=<ref do projeto>. Imprime só contagens: nunca valores,
// HMACs, cifrados nem chaves.
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { parsePiiKeyring } from "../apps/web/lib/pii/crypto.ts";
import { rotatePartnerDocuments } from "./lib/pii-rotation.mjs";
import { assertAdminTarget } from "./lib/safe-target.mjs";

const root = resolve(import.meta.dirname, "..");
if (existsSync(resolve(root, ".env.local"))) process.loadEnvFile(resolve(root, ".env.local"));
const { createClient } = createRequire(resolve(root, "packages/data/package.json"))("@supabase/supabase-js");

const apply = process.argv.includes("--apply");
const forceMark = process.argv.includes("--force-mark");

assertAdminTarget(process.env.NEXT_PUBLIC_SUPABASE_URL, "pii:rotate");
if (!process.env.SUPABASE_SECRET_KEY) {
  console.error("SUPABASE_SECRET_KEY ausente.");
  process.exit(1);
}

let ring;
try {
  ring = parsePiiKeyring(process.env);
} catch (err) {
  // A mensagem cita só o NOME da variável com problema, nunca o valor.
  console.error(`Chaves de PII inválidas: ${err.message}`);
  process.exit(1);
}
if (!ring) {
  console.error("MEL_PII_ENC_KEY e MEL_PII_HMAC_KEY não configuradas: nada a fazer.");
  process.exit(1);
}

const service = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });
const counts = await rotatePartnerDocuments({ service, ring, apply, forceMark });

console.log(`Chave de cifra atual: v${ring.currentVersion} (abre: ${[...ring.encKeys.keys()].sort().map((v) => `v${v}`).join(", ")})`);
console.log(`Chave de HMAC atual: v${ring.hmacVersion} (confere: ${[...ring.hmacKeys.keys()].sort().map((v) => `v${v}`).join(", ")})`);
console.log(`Documentos: ${counts.total} · já atuais: ${counts.current} · a recifrar: ${counts.toReencrypt} · ilegíveis: ${counts.unreadable} · chave ausente: ${counts.key_unavailable}`);
if (!apply) {
  console.log("Simulação: nada foi gravado. Rode com --apply para recifrar.");
} else {
  console.log(`Recifrados: ${counts.reencrypted} · conflitos (titular regravou no meio): ${counts.conflicts} · marcados: ${counts.marked} · restaurados: ${counts.restored}`);
  if (counts.aborted) {
    console.error("ATENÇÃO: a maioria das linhas não abriu. As chaves do ambiente parecem erradas; nenhuma linha foi marcada como ilegível. Confira as chaves (docs/18-chaves-pii.md) antes de usar --force-mark.");
    process.exitCode = 2;
  }
  if (counts.conflicts > 0) console.log("Rode de novo para pegar as linhas que mudaram durante a rotação.");
}
