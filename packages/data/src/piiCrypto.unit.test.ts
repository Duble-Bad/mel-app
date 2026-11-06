// O módulo vive no app web (só servidor); o teste roda aqui, junto dos unitários sem rede.
import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  openPii,
  parsePiiKeyring,
  partnerCpfAad,
  PiiCryptoError,
  piiLookupHmac,
  piiLookupHmacs,
  planReencryption,
  sealPii,
  tryOpenPii,
} from "../../../apps/web/lib/pii/crypto";

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

  it("unreadable data never throws from tryOpenPii: corrupted ciphertext/tag/IV → 'unreadable'; missing key version → 'key_unavailable'", () => {
    const r = ring();
    const s = sealPii(r, "52998224725", AAD);
    const flip = (b64: string) => {
      const buf = Buffer.from(b64, "base64");
      buf[buf.length - 1] = buf[buf.length - 1]! ^ 0x55;
      return buf.toString("base64");
    };
    expect(tryOpenPii(r, s, AAD)).toEqual({ ok: true, value: "52998224725" });
    expect(tryOpenPii(r, { ...s, ciphertext: flip(s.ciphertext) }, AAD)).toEqual({ ok: false, state: "unreadable" });
    expect(tryOpenPii(r, { ...s, authTag: flip(s.authTag) }, AAD)).toEqual({ ok: false, state: "unreadable" });
    expect(tryOpenPii(r, { ...s, iv: flip(s.iv) }, AAD)).toEqual({ ok: false, state: "unreadable" });
    expect(tryOpenPii(r, { ...s, iv: "!!não é base64!!" }, AAD)).toEqual({ ok: false, state: "unreadable" });
    expect(tryOpenPii(r, { ...s, authTag: "AAAA" }, AAD)).toEqual({ ok: false, state: "unreadable" });
    expect(tryOpenPii(r, { ...s, keyVersion: 7 }, AAD)).toEqual({ ok: false, state: "key_unavailable" });
    // Chave da mesma versão trocada por outra (perda da chave original): ilegível, sem lançar.
    expect(tryOpenPii(ring(), s, AAD)).toEqual({ ok: false, state: "unreadable" });
  });

  it("HMAC rotation: previous HMAC keys stay usable for duplicate detection across versions", () => {
    const h1 = key();
    const enc = key();
    const v1 = parsePiiKeyring({ MEL_PII_ENC_KEY: enc, MEL_PII_HMAC_KEY: h1 })!;
    const stored = piiLookupHmac(v1, "cpf", "52998224725");
    const v2 = parsePiiKeyring({ MEL_PII_ENC_KEY: enc, MEL_PII_HMAC_KEY: key(), MEL_PII_HMAC_KEY_VERSION: "2", MEL_PII_HMAC_KEYS_PREVIOUS: `1:${h1}` })!;
    const lookups = piiLookupHmacs(v2, "cpf", "52998224725");
    // A atual vem primeiro (é a gravada); a anterior encontra a linha ainda não migrada.
    expect(lookups.map((l) => l.v)).toEqual([2, 1]);
    expect(lookups[1]).toEqual({ v: 1, h: stored });
    expect(lookups[0]!.h).not.toBe(stored);
    // Sem a chave anterior configurada, a duplicidade em v1 não seria achada: por isso a rotação mantém a antiga até migrar tudo.
    const v2only = parsePiiKeyring({ MEL_PII_ENC_KEY: enc, MEL_PII_HMAC_KEY: key(), MEL_PII_HMAC_KEY_VERSION: "2" })!;
    expect(piiLookupHmacs(v2only, "cpf", "52998224725").some((l) => l.h === stored)).toBe(false);
    expect(() => piiLookupHmac(v2only, "cpf", "52998224725", 1)).toThrow("v1 indisponível");
  });

  it("re-encryption plan: old key → current key and HMAC recomputed with the current HMAC key, without losing the value", () => {
    const e1 = key();
    const h1 = key();
    const old = parsePiiKeyring({ MEL_PII_ENC_KEY: e1, MEL_PII_HMAC_KEY: h1 })!;
    const sealed = sealPii(old, "52998224725", AAD);
    const doc = { ...sealed, lookupHmac: piiLookupHmac(old, "cpf", "52998224725"), hmacKeyVersion: 1 };
    expect(planReencryption(old, doc, AAD, "cpf")).toEqual({ kind: "current" });

    const rotated = parsePiiKeyring({
      MEL_PII_ENC_KEY: key(), MEL_PII_ENC_KEY_VERSION: "2", MEL_PII_ENC_KEYS_PREVIOUS: `1:${e1}`,
      MEL_PII_HMAC_KEY: key(), MEL_PII_HMAC_KEY_VERSION: "2", MEL_PII_HMAC_KEYS_PREVIOUS: `1:${h1}`,
    })!;
    const plan = planReencryption(rotated, doc, AAD, "cpf");
    expect(plan.kind).toBe("reencrypt");
    if (plan.kind !== "reencrypt") return;
    expect(plan.sealed.keyVersion).toBe(2);
    expect(plan.hmacKeyVersion).toBe(2);
    expect(plan.lookupHmac).toBe(piiLookupHmac(rotated, "cpf", "52998224725"));
    expect(openPii(rotated, plan.sealed, AAD)).toBe("52998224725");
    // O plano nunca carrega o valor em claro.
    expect(JSON.stringify(plan)).not.toContain("52998224725");
    // Linha corrompida: o plano é marcar, não apagar.
    expect(planReencryption(rotated, { ...doc, authTag: Buffer.alloc(16).toString("base64") }, AAD, "cpf")).toEqual({ kind: "failed", state: "unreadable" });
    expect(planReencryption(parsePiiKeyring({ MEL_PII_ENC_KEY: key(), MEL_PII_ENC_KEY_VERSION: "3", MEL_PII_HMAC_KEY: key() })!, doc, AAD, "cpf")).toEqual({
      kind: "failed",
      state: "key_unavailable",
    });
  });

  it("encryption key and HMAC key are separate; configuration errors never echo key material", () => {
    const k = key();
    let message = "";
    try {
      parsePiiKeyring({ MEL_PII_ENC_KEY: key(), MEL_PII_HMAC_KEY: key(), MEL_PII_HMAC_KEYS_PREVIOUS: `1:${k}`, MEL_PII_ENC_KEYS_PREVIOUS: `1:${k}`, MEL_PII_ENC_KEY_VERSION: "2", MEL_PII_HMAC_KEY_VERSION: "2" });
    } catch (err) {
      message = (err as Error).message;
    }
    expect(message).toContain("diferente");
    expect(message).not.toContain(k);
    const bad = randomBytes(16).toString("base64");
    try {
      parsePiiKeyring({ MEL_PII_ENC_KEY: bad, MEL_PII_HMAC_KEY: key() });
    } catch (err) {
      expect((err as Error).message).not.toContain(bad);
    }
    expect(() => parsePiiKeyring({ MEL_PII_ENC_KEY: key(), MEL_PII_HMAC_KEY: key(), MEL_PII_ENC_KEYS_PREVIOUS: `1:${key()}` })).toThrow("versão atual");
    expect(() => parsePiiKeyring({ MEL_PII_ENC_KEY: key(), MEL_PII_HMAC_KEY: key(), MEL_PII_HMAC_KEYS_PREVIOUS: "semversao" })).toThrow("versão:chave");
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
