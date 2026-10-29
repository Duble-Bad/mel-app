import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { assertAdminTarget, assertLinkedRefSafe, assertSafeTarget, describeTarget, UnsafeTargetError } from "./safe-target.mjs";

// Refs fictícios (formato válido), nunca de projetos reais.
const DEV = "aaaaaaaaaaaaaaaaaaaa";
const PROD = "bbbbbbbbbbbbbbbbbbbb";
const env = { MEL_SAFE_TARGET_REFS: ` ${DEV} , lixo` };

test("local Supabase is always allowed", () => {
  for (const url of ["http://127.0.0.1:54321", "http://localhost:54321", "http://[::1]:54321"]) {
    assert.equal(assertSafeTarget(url, "teste", {}).kind, "local");
  }
});

test("cloud project only when listed; production (unlisted) is refused", () => {
  assert.equal(assertSafeTarget(`https://${DEV}.supabase.co`, "teste", env).kind, "cloud");
  assert.throws(() => assertSafeTarget(`https://${PROD}.supabase.co`, "seed", env), UnsafeTargetError);
});

test("fails safe by default: no allowlist, missing/invalid URL, custom domains, http cloud", () => {
  assert.throws(() => assertSafeTarget(`https://${DEV}.supabase.co`, "teste", {}), UnsafeTargetError);
  assert.throws(() => assertSafeTarget(undefined, "teste", env), UnsafeTargetError);
  assert.throws(() => assertSafeTarget("not a url", "teste", env), UnsafeTargetError);
  assert.throws(() => assertSafeTarget("https://api.mel.example", "teste", env), UnsafeTargetError);
  assert.throws(() => assertSafeTarget(`http://${DEV}.supabase.co`, "teste", env), UnsafeTargetError);
  assert.throws(() => assertSafeTarget(`https://${DEV}.supabase.co.evil.example`, "teste", env), UnsafeTargetError);
  // NODE_ENV não libera nada.
  assert.throws(() => assertSafeTarget(`https://${PROD}.supabase.co`, "teste", { NODE_ENV: "development", MEL_SAFE_TARGET_REFS: "" }), UnsafeTargetError);
});

test("the error never prints the full project ref", () => {
  assert.throws(
    () => assertSafeTarget(`https://${PROD}.supabase.co`, "seed", env),
    (err) => !err.message.includes(PROD) && err.message.includes("bbbb…"),
  );
});

test("admin scripts outside the allowlist need --confirm-target with the exact ref", () => {
  const url = `https://${PROD}.supabase.co`;
  assert.throws(() => assertAdminTarget(url, "admin", ["node", "x"], env), UnsafeTargetError);
  assert.throws(() => assertAdminTarget(url, "admin", ["node", "x", `--confirm-target=${DEV}`], env), UnsafeTargetError);
  assert.throws(() => assertAdminTarget(url, "admin", ["node", "x", "--confirm-target="], env), UnsafeTargetError);
  assert.equal(assertAdminTarget(url, "admin", ["node", "x", `--confirm-target=${PROD}`], env).ref, PROD);
});

test("linked CLI project must be on the allowlist", () => {
  const root = mkdtempSync(join(tmpdir(), "mel-guard-"));
  assert.throws(() => assertLinkedRefSafe("db push", root, env), UnsafeTargetError);
  mkdirSync(join(root, "supabase/.temp"), { recursive: true });
  writeFileSync(join(root, "supabase/.temp/project-ref"), `${PROD}\n`);
  assert.throws(() => assertLinkedRefSafe("db push", root, env), UnsafeTargetError);
  writeFileSync(join(root, "supabase/.temp/project-ref"), `${DEV}\n`);
  assert.equal(assertLinkedRefSafe("db push", root, env).ref, DEV);
});

test("describeTarget classifies hosts", () => {
  assert.deepEqual(describeTarget(`https://${DEV}.supabase.co/rest/v1`), { kind: "cloud", ref: DEV });
  assert.equal(describeTarget("https://example.com").kind, "unknown");
});
