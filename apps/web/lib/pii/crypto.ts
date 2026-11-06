import { createCipheriv, createDecipheriv, createHmac, randomBytes } from "node:crypto";

/**
 * Cifragem de dados pessoais sensíveis (hoje: CPF do protetor) no SERVIDOR.
 *
 * - AES-256-GCM (cifra autenticada, node:crypto): IV aleatório de 12 bytes por
 *   valor, tag de 16 bytes; qualquer alteração no texto cifrado, IV, tag ou
 *   AAD faz a abertura falhar.
 * - AAD amarra o valor ao registro (ex.: o id do parceiro): trocar o cifrado de
 *   uma linha para outra também falha.
 * - Chaves versionadas: grava com a atual; abre com a versão gravada na linha.
 *   Rotação = nova versão atual + antigas em MEL_PII_ENC_KEYS_PREVIOUS até a
 *   rotina de recifragem (scripts/pii-rotate.mjs) migrar todas as linhas.
 * - Duplicidade: HMAC-SHA256 com chave SEPARADA (nunca hash simples, que seria
 *   quebrado por força bruta nos 10^9 CPFs possíveis). A chave do HMAC também
 *   é versionada (MEL_PII_HMAC_KEYS_PREVIOUS): durante a rotação a duplicidade
 *   é checada em TODAS as versões configuradas.
 * - Falha ao abrir NUNCA derruba nada: tryOpenPii devolve o estado
 *   ("unreadable" = dado corrompido; "key_unavailable" = versão de chave ausente).
 * - Mensagens de erro nunca contêm o valor, a chave nem o HMAC.
 *
 * Este módulo é puro (recebe as chaves) e não importa nada além de
 * node:crypto, para rodar também no script de rotação (Node puro). Quem lê as
 * variáveis de ambiente no app é keys.ts, marcado como server-only. Nunca
 * importar no navegador. Procedimento de chaves: docs/18-chaves-pii.md.
 */

export interface PiiKeyring {
  currentVersion: number;
  encKeys: ReadonlyMap<number, Buffer>;
  /** Chave atual do HMAC (grava) e a versão dela. */
  hmacKey: Buffer;
  hmacVersion: number;
  /** Todas as chaves de HMAC configuradas (atual + anteriores), por versão. */
  hmacKeys: ReadonlyMap<number, Buffer>;
}

export interface SealedPii {
  ciphertext: string; // base64
  iv: string; // base64 (12 bytes)
  authTag: string; // base64 (16 bytes)
  keyVersion: number;
}

export type DocumentReadState = "ok" | "unreadable" | "key_unavailable";

export class PiiCryptoError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PiiCryptoError";
  }
}

const ALGO = "aes-256-gcm";
const B64 = /^[A-Za-z0-9+/]+={0,2}$/;

export function sealPii(ring: PiiKeyring, plaintext: string, aad: string): SealedPii {
  const key = ring.encKeys.get(ring.currentVersion);
  if (!key) throw new PiiCryptoError("Chave atual de cifragem ausente.");
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, key, iv, { authTagLength: 16 });
  cipher.setAAD(Buffer.from(aad, "utf8"));
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return {
    ciphertext: ciphertext.toString("base64"),
    iv: iv.toString("base64"),
    authTag: cipher.getAuthTag().toString("base64"),
    keyVersion: ring.currentVersion,
  };
}

/** Abre um valor cifrado. Erro genérico (sem detalhes) se a chave faltar ou algo foi adulterado. */
export function openPii(ring: PiiKeyring, sealed: SealedPii, aad: string): string {
  const r = tryOpenPii(ring, sealed, aad);
  if (r.ok) return r.value;
  throw new PiiCryptoError(
    r.state === "key_unavailable"
      ? `Chave de cifragem v${sealed.keyVersion} indisponível.`
      : "Não foi possível abrir o valor cifrado (chave errada ou dado adulterado).",
  );
}

export type OpenResult = { ok: true; value: string } | { ok: false; state: Exclude<DocumentReadState, "ok"> };

/**
 * Abre sem lançar erro. "key_unavailable": a versão gravada não está no
 * chaveiro (configuração; volta a abrir quando a chave for restaurada).
 * "unreadable": formato inválido ou a autenticação GCM falhou (dado
 * corrompido/adulterado, ou a chave daquela versão foi trocada por outra).
 */
export function tryOpenPii(ring: PiiKeyring, sealed: SealedPii, aad: string): OpenResult {
  const key = ring.encKeys.get(sealed.keyVersion);
  if (!key) return { ok: false, state: "key_unavailable" };
  if (![sealed.ciphertext, sealed.iv, sealed.authTag].every((v) => typeof v === "string" && B64.test(v))) {
    return { ok: false, state: "unreadable" };
  }
  const iv = Buffer.from(sealed.iv, "base64");
  const tag = Buffer.from(sealed.authTag, "base64");
  if (iv.length !== 12 || tag.length !== 16) return { ok: false, state: "unreadable" };
  try {
    const decipher = createDecipheriv(ALGO, key, iv, { authTagLength: 16 });
    decipher.setAAD(Buffer.from(aad, "utf8"));
    decipher.setAuthTag(tag);
    const value = Buffer.concat([decipher.update(Buffer.from(sealed.ciphertext, "base64")), decipher.final()]).toString("utf8");
    return { ok: true, value };
  } catch {
    return { ok: false, state: "unreadable" };
  }
}

/** HMAC-SHA256 (hex) do valor normalizado, com domínio (ex.: "cpf") para não cruzar tipos. */
export function piiLookupHmac(ring: PiiKeyring, domain: string, normalized: string, version = ring.hmacVersion): string {
  const key = version === ring.hmacVersion ? ring.hmacKey : ring.hmacKeys.get(version);
  if (!key) throw new PiiCryptoError(`Chave de HMAC v${version} indisponível.`);
  return createHmac("sha256", key).update(`${domain}:${normalized}`, "utf8").digest("hex");
}

export interface PiiLookup {
  v: number;
  h: string;
}

/**
 * HMAC em todas as versões configuradas: a ATUAL primeiro (é a que se grava),
 * depois as anteriores (só para achar duplicidade em linhas ainda não migradas).
 */
export function piiLookupHmacs(ring: PiiKeyring, domain: string, normalized: string): PiiLookup[] {
  const versions = [ring.hmacVersion, ...[...ring.hmacKeys.keys()].filter((v) => v !== ring.hmacVersion).sort((a, b) => b - a)];
  return versions.map((v) => ({ v, h: piiLookupHmac(ring, domain, normalized, v) }));
}

/** AAD do CPF de um parceiro. */
export const partnerCpfAad = (businessId: string) => `mel:partner-document:CPF:${businessId}`;

// ---------------------------------------------------------------------------
// Rotação (recifragem) — lógica pura, usada pelo script e pelos testes.
// ---------------------------------------------------------------------------

export interface StoredSealedDocument extends SealedPii {
  lookupHmac: string;
  hmacKeyVersion: number;
}

export type RotationPlan =
  | { kind: "current" }
  | { kind: "reencrypt"; sealed: SealedPii; lookupHmac: string; hmacKeyVersion: number }
  | { kind: "failed"; state: Exclude<DocumentReadState, "ok"> };

/**
 * O que fazer com uma linha: nada (já está nas versões atuais), recifrar
 * (abre com a chave antiga, cifra com a atual e recalcula o HMAC com a chave
 * atual do HMAC) ou marcar como ilegível/indisponível. Nunca devolve o valor.
 */
export function planReencryption(ring: PiiKeyring, doc: StoredSealedDocument, aad: string, domain: string): RotationPlan {
  const opened = tryOpenPii(ring, doc, aad);
  if (!opened.ok) return { kind: "failed", state: opened.state };
  if (doc.keyVersion === ring.currentVersion && doc.hmacKeyVersion === ring.hmacVersion) return { kind: "current" };
  const sealed = doc.keyVersion === ring.currentVersion ? { ciphertext: doc.ciphertext, iv: doc.iv, authTag: doc.authTag, keyVersion: doc.keyVersion } : sealPii(ring, opened.value, aad);
  return { kind: "reencrypt", sealed, lookupHmac: piiLookupHmac(ring, domain, opened.value), hmacKeyVersion: ring.hmacVersion };
}

// ---------------------------------------------------------------------------
// Configuração
// ---------------------------------------------------------------------------

function decodeKey(name: string, value: string): Buffer {
  const key = Buffer.from(value.trim(), "base64");
  if (key.length !== 32) throw new PiiCryptoError(`${name} precisa ter 32 bytes em base64.`);
  return key;
}

function parseVersion(name: string, value: string | undefined, fallback: number): number {
  if (value === undefined || value === "") return fallback;
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1 || n > 999) throw new PiiCryptoError(`${name} deve ser um inteiro entre 1 e 999.`);
  return n;
}

function parsePrevious(name: string, value: string | undefined): Map<number, Buffer> {
  const out = new Map<number, Buffer>();
  for (const entry of (value ?? "").split(",").map((s) => s.trim()).filter(Boolean)) {
    const sep = entry.indexOf(":");
    const v = entry.slice(0, sep);
    const k = entry.slice(sep + 1);
    if (sep <= 0 || !k) throw new PiiCryptoError(`${name} usa o formato versão:chave, separados por vírgula.`);
    const version = parseVersion(name, v, 1);
    if (out.has(version)) throw new PiiCryptoError(`${name}: versão v${version} repetida.`);
    out.set(version, decodeKey(`${name} v${version}`, k));
  }
  return out;
}

export interface PiiEnv {
  MEL_PII_ENC_KEY?: string;
  MEL_PII_ENC_KEY_VERSION?: string;
  /** Chaves antigas, só para abrir: "1:base64,2:base64". */
  MEL_PII_ENC_KEYS_PREVIOUS?: string;
  MEL_PII_HMAC_KEY?: string;
  MEL_PII_HMAC_KEY_VERSION?: string;
  /** Chaves antigas do HMAC, só para achar duplicidade durante a rotação: "1:base64". */
  MEL_PII_HMAC_KEYS_PREVIOUS?: string;
}

/** Monta o chaveiro. null se não configurado; erro (sem o valor das chaves) se configurado errado. */
export function parsePiiKeyring(env: PiiEnv): PiiKeyring | null {
  if (!env.MEL_PII_ENC_KEY || !env.MEL_PII_HMAC_KEY) return null;
  const currentVersion = parseVersion("MEL_PII_ENC_KEY_VERSION", env.MEL_PII_ENC_KEY_VERSION, 1);
  const encKeys = parsePrevious("MEL_PII_ENC_KEYS_PREVIOUS", env.MEL_PII_ENC_KEYS_PREVIOUS);
  if (encKeys.has(currentVersion)) throw new PiiCryptoError("MEL_PII_ENC_KEYS_PREVIOUS não pode repetir a versão atual.");
  encKeys.set(currentVersion, decodeKey("MEL_PII_ENC_KEY", env.MEL_PII_ENC_KEY));

  const hmacVersion = parseVersion("MEL_PII_HMAC_KEY_VERSION", env.MEL_PII_HMAC_KEY_VERSION, 1);
  const hmacKeys = parsePrevious("MEL_PII_HMAC_KEYS_PREVIOUS", env.MEL_PII_HMAC_KEYS_PREVIOUS);
  if (hmacKeys.has(hmacVersion)) throw new PiiCryptoError("MEL_PII_HMAC_KEYS_PREVIOUS não pode repetir a versão atual.");
  const hmacKey = decodeKey("MEL_PII_HMAC_KEY", env.MEL_PII_HMAC_KEY);
  hmacKeys.set(hmacVersion, hmacKey);

  const enc = [...encKeys.values()];
  if ([...hmacKeys.values()].some((h) => enc.some((k) => k.equals(h)))) {
    throw new PiiCryptoError("A chave do HMAC precisa ser diferente das chaves de cifragem.");
  }
  return { currentVersion, encKeys, hmacKey, hmacVersion, hmacKeys };
}
