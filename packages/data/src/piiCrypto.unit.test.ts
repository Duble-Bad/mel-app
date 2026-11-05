// O módulo vive no app web (só servidor); o teste roda aqui, junto dos unitários sem rede.
import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { openPii, parsePiiKeyring, partnerCpfAad, piiLookupHmac, PiiCryptoError, sealPii } from "../../../apps/web/lib/pii/crypto";

// Chaves efêmeras: geradas a cada execução, nunca lidas do ambiente.
const key = () => randomBytes(32).toString("base64");
const ring = (o: Record<string, string> = {}) => parsePiiKeyring({ MEL_PII_ENC_KEY: key(), MEL_PII_HMAC_KEY: key(), ...o })!;
const AAD = partnerCpfAad("0b0e1f9c-0000-4000-8000-000000000001");

describe("PII crypto (AES-256-GCM)", () => {
  it("round-trips and never repeats IV or ciphertext for the same value", () => {
    const r = ring();
    const a = sealPii(r, "52998224725", AAD);
    const b = sealPii(r, "52998224725", AAD);
    expect(openPii(r, a, AAD)).toBe("52998224725");
    expect(a.iv).not.toBe(b.iv);
    expect(a.ciphertext).not.toBe(b.ciphertext);
    expect(a.ciphertext).not.toContain("52998224725");
    expect(Buffer.from(a.iv, "base64")).toHaveLength(12);
    expect(Buffer.from(a.authTag, "base64")).toHaveLength(16);
    expect(a.keyVersion).toBe(1);
  });

  it("detects tampering of ciphertext, tag, IV and AAD (moving to another record)", () => {
    const r = ring();
    const s = sealPii(r, "52998224725", AAD);
    const flip = (b64: string) => {
      const buf = Buffer.from(b64, "base64");
      buf[0] = buf[0]! ^ 1;
      return buf.toString("base64");
    };
    expect(() => openPii(r, { ...s, ciphertext: flip(s.ciphertext) }, AAD)).toThrow(PiiCryptoError);
    expect(() => openPii(r, { ...s, authTag: flip(s.authTag) }, AAD)).toThrow(PiiCryptoError);
    expect(() => openPii(r, { ...s, iv: flip(s.iv) }, AAD)).toThrow(PiiCryptoError);
    expect(() => openPii(r, s, partnerCpfAad("outro-parceiro"))).toThrow(PiiCryptoError);
  });

  it("fails with the wrong key", () => {
    const s = sealPii(ring(), "52998224725", AAD);
    expect(() => openPii(ring(), s, AAD)).toThrow(PiiCryptoError);
  });

  it("supports key rotation: new values use the current version, old ones still open", () => {
    const v1 = key();
    const hmac = key();
    const old = parsePiiKeyring({ MEL_PII_ENC_KEY: v1, MEL_PII_HMAC_KEY: hmac })!;
    const sealedV1 = sealPii(old, "52998224725", AAD);
    const rotated = parsePiiKeyring({ MEL_PII_ENC_KEY: key(), MEL_PII_ENC_KEY_VERSION: "2", MEL_PII_ENC_KEYS_PREVIOUS: `1:${v1}`, MEL_PII_HMAC_KEY: hmac })!;
    expect(openPii(rotated, sealedV1, AAD)).toBe("52998224725");
    const sealedV2 = sealPii(rotated, "52998224725", AAD);
    expect(sealedV2.keyVersion).toBe(2);
    expect(openPii(rotated, sealedV2, AAD)).toBe("52998224725");
    // Sem a chave antiga, o valor v1 não abre (erro claro, sem o conteúdo).
    const withoutOld = parsePiiKeyring({ MEL_PII_ENC_KEY: key(), MEL_PII_ENC_KEY_VERSION: "2", MEL_PII_HMAC_KEY: hmac })!;
    expect(() => openPii(withoutOld, sealedV1, AAD)).toThrow("v1 indisponível");
  });

  it("HMAC: same CPF → same tag (dedupe); different key or domain → different tag; never a plain hash", () => {
    const r = ring();
    const a = piiLookupHmac(r, "cpf", "52998224725");
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(piiLookupHmac(r, "cpf", "52998224725")).toBe(a);
    expect(piiLookupHmac(r, "cpf", "11144477735")).not.toBe(a);
    expect(piiLookupHmac(r, "cnpj", "52998224725")).not.toBe(a);
    expect(piiLookupHmac(ring(), "cpf", "52998224725")).not.toBe(a);
  });

  it("validates configuration: missing → null, wrong size or reused key → error", () => {
    expect(parsePiiKeyring({})).toBeNull();
    expect(parsePiiKeyring({ MEL_PII_ENC_KEY: key() })).toBeNull();
    expect(() => parsePiiKeyring({ MEL_PII_ENC_KEY: randomBytes(16).toString("base64"), MEL_PII_HMAC_KEY: key() })).toThrow("32 bytes");
    const same = key();
    expect(() => parsePiiKeyring({ MEL_PII_ENC_KEY: same, MEL_PII_HMAC_KEY: same })).toThrow("diferente");
    expect(() => parsePiiKeyring({ MEL_PII_ENC_KEY: key(), MEL_PII_HMAC_KEY: key(), MEL_PII_ENC_KEY_VERSION: "0" })).toThrow("entre 1 e 999");
  });
});
