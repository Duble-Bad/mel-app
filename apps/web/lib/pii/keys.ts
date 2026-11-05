import "server-only";
import { parsePiiKeyring, type PiiKeyring } from "./crypto";

let cached: PiiKeyring | null | undefined;

/**
 * Chaveiro de dados pessoais a partir das variáveis de ambiente do SERVIDOR
 * (Vercel: Environment Variables, nunca NEXT_PUBLIC_*). null = não configurado
 * (as rotas respondem 503 e nada é gravado).
 */
export function getPiiKeyring(): PiiKeyring | null {
  if (cached === undefined) {
    cached = parsePiiKeyring({
      MEL_PII_ENC_KEY: process.env.MEL_PII_ENC_KEY,
      MEL_PII_ENC_KEY_VERSION: process.env.MEL_PII_ENC_KEY_VERSION,
      MEL_PII_ENC_KEYS_PREVIOUS: process.env.MEL_PII_ENC_KEYS_PREVIOUS,
      MEL_PII_HMAC_KEY: process.env.MEL_PII_HMAC_KEY,
      MEL_PII_HMAC_KEY_VERSION: process.env.MEL_PII_HMAC_KEY_VERSION,
    });
  }
  return cached;
}
