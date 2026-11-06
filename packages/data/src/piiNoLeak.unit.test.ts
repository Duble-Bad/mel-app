// Regras do CPF no servidor (apps/web/lib/pii/partnerCpf.ts) com dublês no
// lugar do banco: duplicidade, ilegível/indisponível, perda de chave e — em
// todos os caminhos — nenhum CPF em logs, mensagens de erro ou respostas.
import { randomBytes } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cpfField } from "@mel/core";
import { parsePiiKeyring, partnerCpfAad, piiLookupHmac, sealPii } from "../../../apps/web/lib/pii/crypto";
import { type CpfDeps, DUPLICATE_CPF, readPartnerCpf, UNREADABLE_CPF_MESSAGE, writePartnerCpf } from "../../../apps/web/lib/pii/partnerCpf";
import type { StoredPartnerDocument } from "./partnerDocuments";

const CPF = "52998224725";
const FORMATTED = "529.982.247-25";
const BUSINESS = "0b0e1f9c-0000-4000-8000-0000000000aa";
const key = () => randomBytes(32).toString("base64");
const ring = () => parsePiiKeyring({ MEL_PII_ENC_KEY: key(), MEL_PII_HMAC_KEY: key() })!;

/** Banco de mentira: uma linha por cadastro, índice único por HMAC. */
function fakeDb() {
  const rows = new Map<string, StoredPartnerDocument>();
  const events: string[] = [];
  const deps: CpfDeps = {
    async save(d) {
      const dup = [...rows.values()].some((r) => r.businessId !== d.businessId && d.lookups.some((l) => l.v === r.hmacKeyVersion && l.h === r.lookupHmac));
      if (dup) throw Object.assign(new Error("Documento já cadastrado."), { code: "23505" });
      const cur = rows.get(d.businessId);
      rows.set(d.businessId, {
        businessId: d.businessId, ownerId: d.actorId, ciphertext: d.ciphertext, iv: d.iv, authTag: d.authTag, keyVersion: d.keyVersion,
        lookupHmac: d.lookups[0]!.h, hmacKeyVersion: d.lookups[0]!.v, readState: "ok",
      });
      events.push(`save:${d.mode}`);
      return d.mode === "signup" ? "stored" : cur && cur.readState === "ok" ? "changed" : "re_registered";
    },
    async hmacExists(lookups, except) {
      return [...rows.values()].some((r) => r.businessId !== except && lookups.some((l) => l.v === r.hmacKeyVersion && l.h === r.lookupHmac));
    },
    async duplicateRejections() {
      return 0;
    },
    async logDuplicate() {
      events.push("duplicate");
    },
    async markState(businessId, state) {
      const r = rows.get(businessId);
      if (r) rows.set(businessId, { ...r, readState: state });
      events.push(`mark:${state}`);
    },
  };
  return { rows, deps, events };
}

let logs: string[] = [];
beforeEach(() => {
  logs = [];
  for (const m of ["log", "info", "warn", "error", "debug"] as const) {
    vi.spyOn(console, m).mockImplementation((...args: unknown[]) => {
      logs.push(args.map((a) => (a instanceof Error ? `${a.name}:${a.message}:${a.stack}` : typeof a === "string" ? a : JSON.stringify(a))).join(" "));
    });
  }
});
afterEach(() => {
  // Nenhum caminho pode registrar o CPF (com ou sem pontuação).
  const all = logs.join("\n");
  expect(all).not.toContain(CPF);
  expect(all).not.toContain(FORMATTED);
  vi.restoreAllMocks();
});

describe("partner CPF rules (server)", () => {
  it("stores, rejects the same CPF in another registration (duplicate) and never echoes it", async () => {
    const r = ring();
    const db = fakeDb();
    expect(await writePartnerCpf(db.deps, r, { businessId: BUSINESS, actorId: "u1", cpf: CPF, mode: "signup" })).toEqual({ ok: true, result: "stored" });
    expect(db.rows.get(BUSINESS)!.ciphertext).not.toContain(CPF);
    const dup = await writePartnerCpf(db.deps, r, { businessId: "outro", actorId: "u2", cpf: CPF, mode: "change" });
    expect(dup).toMatchObject({ ok: false, status: 409, error: DUPLICATE_CPF });
    expect(JSON.stringify(dup)).not.toContain(CPF);
    expect(db.events).toContain("duplicate");
    // A garantia final (índice/RPC) também vira 409 sem o número, mesmo sem o pré-cheque.
    const raced = await writePartnerCpf({ ...db.deps, hmacExists: async () => false }, r, { businessId: "outro", actorId: "u2", cpf: CPF, mode: "change" });
    expect(raced).toMatchObject({ ok: false, status: 409 });
  });

  it("detects duplicates across HMAC key versions during rotation", async () => {
    const enc = key();
    const h1 = key();
    const v1 = parsePiiKeyring({ MEL_PII_ENC_KEY: enc, MEL_PII_HMAC_KEY: h1 })!;
    const db = fakeDb();
    await writePartnerCpf(db.deps, v1, { businessId: BUSINESS, actorId: "u1", cpf: CPF, mode: "signup" });
    const v2 = parsePiiKeyring({ MEL_PII_ENC_KEY: enc, MEL_PII_HMAC_KEY: key(), MEL_PII_HMAC_KEY_VERSION: "2", MEL_PII_HMAC_KEYS_PREVIOUS: `1:${h1}` })!;
    expect(await writePartnerCpf(db.deps, v2, { businessId: "outro", actorId: "u2", cpf: CPF, mode: "signup" })).toMatchObject({ ok: false, status: 409 });
  });

  it("corrupted record → 'unreadable', marked (not deleted), holder gets a safe re-registration message", async () => {
    const r = ring();
    const db = fakeDb();
    await writePartnerCpf(db.deps, r, { businessId: BUSINESS, actorId: "u1", cpf: CPF, mode: "signup" });
    const row = db.rows.get(BUSINESS)!;
    db.rows.set(BUSINESS, { ...row, authTag: Buffer.alloc(16, 7).toString("base64") });
    const read = await readPartnerCpf(db.deps, r, db.rows.get(BUSINESS)!, "u1");
    expect(read).toEqual({ ok: false, state: "unreadable" });
    expect(db.rows.has(BUSINESS)).toBe(true);
    expect(db.rows.get(BUSINESS)!.readState).toBe("unreadable");
    expect(UNREADABLE_CPF_MESSAGE.unreadable).toContain("cadastre o CPF de novo");
    expect(UNREADABLE_CPF_MESSAGE.unreadable).not.toMatch(/recuper/i);
    // Novo cadastro do CPF pelo titular: grava de novo e o estado volta a "ok".
    expect(await writePartnerCpf(db.deps, r, { businessId: BUSINESS, actorId: "u1", cpf: CPF, mode: "change" })).toEqual({ ok: true, result: "re_registered" });
    expect(await readPartnerCpf(db.deps, r, db.rows.get(BUSINESS)!, "u1")).toEqual({ ok: true, cpf: CPF });
  });

  it("simulated loss of key access: 'key_unavailable', account/record preserved, re-registration works with the new key, restored key heals the state", async () => {
    const lostKey = key();
    const hmac = key();
    const before = parsePiiKeyring({ MEL_PII_ENC_KEY: lostKey, MEL_PII_HMAC_KEY: hmac })!;
    const db = fakeDb();
    await writePartnerCpf(db.deps, before, { businessId: BUSINESS, actorId: "u1", cpf: CPF, mode: "signup" });
    const oldRow = db.rows.get(BUSINESS)!;

    // A chave v1 sumiu do ambiente; a nova é a v2.
    const after = parsePiiKeyring({ MEL_PII_ENC_KEY: key(), MEL_PII_ENC_KEY_VERSION: "2", MEL_PII_HMAC_KEY: hmac })!;
    expect(await readPartnerCpf(db.deps, after, oldRow, "u1")).toEqual({ ok: false, state: "key_unavailable" });
    expect(db.rows.get(BUSINESS)).toMatchObject({ businessId: BUSINESS, readState: "key_unavailable" });

    // Se a chave for restaurada (cópia de segurança), o mesmo registro volta a abrir e o estado se corrige.
    const restored = parsePiiKeyring({ MEL_PII_ENC_KEY: key(), MEL_PII_ENC_KEY_VERSION: "2", MEL_PII_ENC_KEYS_PREVIOUS: `1:${lostKey}`, MEL_PII_HMAC_KEY: hmac })!;
    expect(await readPartnerCpf(db.deps, restored, db.rows.get(BUSINESS)!, "u1")).toEqual({ ok: true, cpf: CPF });
    expect(db.events).toContain("mark:ok");

    // Sem restauração: o titular cadastra de novo (mesmo CPF não é "duplicado de si mesmo").
    db.rows.set(BUSINESS, { ...oldRow, readState: "key_unavailable" });
    expect(await writePartnerCpf(db.deps, after, { businessId: BUSINESS, actorId: "u1", cpf: CPF, mode: "change" })).toEqual({ ok: true, result: "re_registered" });
    expect(db.rows.get(BUSINESS)!.keyVersion).toBe(2);
    expect(await readPartnerCpf(db.deps, after, db.rows.get(BUSINESS)!, "u1")).toEqual({ ok: true, cpf: CPF });
  });

  it("unexpected database failures are logged with codes only", async () => {
    const r = ring();
    const db = fakeDb();
    const failing: CpfDeps = {
      ...db.deps,
      save: async () => {
        throw Object.assign(new Error(`falha com ${CPF} no detalhe`), { code: "XX000" });
      },
      markState: async () => {
        throw Object.assign(new Error(`erro ${CPF}`), { code: "XX001" });
      },
    };
    const out = await writePartnerCpf(failing, r, { businessId: BUSINESS, actorId: "u1", cpf: CPF, mode: "signup" });
    expect(out).toMatchObject({ ok: false, status: 500 });
    expect(JSON.stringify(out)).not.toContain(CPF);
    const sealed = sealPii(r, CPF, partnerCpfAad(BUSINESS));
    const doc = { businessId: BUSINESS, ownerId: "u1", ...sealed, keyVersion: 9, lookupHmac: piiLookupHmac(r, "cpf", CPF), hmacKeyVersion: 1 };
    expect(await readPartnerCpf(failing, r, doc, "u1")).toEqual({ ok: false, state: "key_unavailable" });
    expect(logs.join("\n")).toContain("XX000");
  });

  it("validation errors never contain the typed value", () => {
    for (const bad of ["529.982.247-24", "11111111111", "5299822472"]) {
      const r = cpfField.safeParse(bad);
      expect(r.success).toBe(false);
      expect(JSON.stringify(r.error!.issues.map((i) => i.message))).not.toContain(bad.replace(/\D/g, "").slice(0, 9));
    }
  });
});
