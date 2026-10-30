import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { classifyError, ERROR_MESSAGES, friendlyMessage, isServerMessage, UserFacingError, userErrorMessage } from "./errors";
import { SERVER_MESSAGES } from "./serverMessages";

// Mensagens técnicas reais (Postgres, PostgREST, Storage, Auth, navegador).
const TECHNICAL: Array<{ code?: string; message: string; status?: number; name?: string }> = [
  { code: "42501", message: 'new row violates row-level security policy for table "found_cases"' },
  { message: "new row violates row-level security policy" }, // Storage (sem código)
  { code: "42501", message: "permission denied for function admin_moderate" },
  { code: "23505", message: 'duplicate key value violates unique constraint "case_matches_lost_case_id_found_case_id_key"' },
  { code: "23502", message: 'null value in column "species" of relation "pets" violates not-null constraint' },
  { code: "23514", message: 'new row for relation "lost_cases" violates check constraint "lost_cases_last_seen_lat_check"' },
  { code: "22P02", message: 'invalid input syntax for type uuid: "abc"' },
  { code: "PGRST116", message: "JSON object requested, multiple (or no) rows returned" },
  { code: "PGRST301", message: "JWT expired" },
  { code: "42883", message: "function public.get_my_matches(text, integer) does not exist" },
  { code: "PGRST202", message: "Could not find the function public.foo in the schema cache" },
  { code: "08006", message: "connection to server at \"db.xxxx.supabase.co\" failed" },
  { message: "The object exceeded the maximum allowed size", status: 413 },
  { message: "mime type application/pdf is not supported", status: 415 },
  { name: "TypeError", message: "Failed to fetch" },
  { name: "TypeError", message: "Load failed" },
  { name: "AuthRetryableFetchError", message: "fetch failed" },
  { message: "relation \"public.x\" does not exist", code: "42P01" },
];
const LEAK = /row-level|security policy|violates|constraint|relation|column|syntax|uuid|jwt|pgrst|schema|function|permission denied|duplicate key|fetch|typeerror|supabase|public\.|"|\b\d{5}\b|null value|mime|object exceeded/i;

describe("server messages allowlist", () => {
  it("is in sync with the raise exception messages of supabase/migrations", () => {
    const dir = resolve(import.meta.dirname, "../../../../supabase/migrations");
    const found = new Set<string>();
    for (const f of readdirSync(dir).filter((x) => x.endsWith(".sql"))) {
      const sql = readFileSync(resolve(dir, f), "utf8");
      for (const m of sql.matchAll(/raise exception\s+(?:using\s+message\s*=\s*)?'((?:[^']|'')*)'/gi)) {
        const text = m[1]!.replace(/''/g, "'");
        if (!text.includes("%")) found.add(text);
      }
    }
    // Mensagem nova no banco? Rode a geração (veja serverMessages.ts) — senão ela vira genérica na tela.
    expect([...found].sort()).toEqual([...SERVER_MESSAGES].sort());
  });

  it("server-authored Portuguese messages pass through unchanged", () => {
    for (const m of SERVER_MESSAGES) expect(friendlyMessage({ code: "22023", message: m })).toBe(m);
    expect(isServerMessage("Foto inválida.")).toBe(true);
  });

  it("messages with internal placeholders (status codes) never pass through", () => {
    expect(friendlyMessage({ code: "22023", message: "Transição de status inválida: ACTIVE → REMOVED" })).toBe(ERROR_MESSAGES.validation);
  });
});

describe("friendlyMessage", () => {
  it("'new row violates row-level security policy' becomes a permission message", () => {
    const out = friendlyMessage({ code: "42501", message: "new row violates row-level security policy" });
    expect(out).toBe("Você não tem permissão para fazer isso.");
    expect(out).not.toMatch(/row-level|policy|violates/i);
  });

  it("no technical text from a real corpus ever reaches the user", () => {
    for (const e of TECHNICAL) {
      const out = friendlyMessage(e);
      expect(out, JSON.stringify(e)).not.toMatch(LEAK);
      expect(Object.values(ERROR_MESSAGES)).toContain(out);
      expect(friendlyMessage(e, "upload"), JSON.stringify(e)).not.toMatch(LEAK);
    }
  });

  it("maps stable codes to the right category", () => {
    expect(classifyError({ code: "42501" })).toBe("permission");
    expect(classifyError({ code: "P0429" })).toBe("rate_limit");
    expect(classifyError({ status: 429 })).toBe("rate_limit");
    expect(classifyError({ code: "PGRST301", message: "JWT expired" })).toBe("session");
    expect(classifyError({ name: "AuthSessionMissingError" })).toBe("session");
    expect(classifyError({ code: "PGRST116" })).toBe("not_found");
    expect(classifyError({ code: "23505" })).toBe("conflict");
    expect(classifyError({ code: "23514" })).toBe("validation");
    expect(classifyError({ code: "08006" })).toBe("unavailable");
    expect(classifyError({ status: 503 })).toBe("unavailable");
    expect(classifyError({ name: "TypeError", message: "Failed to fetch" })).toBe("network");
    expect(classifyError({ message: "algo estranho" })).toBe("unexpected");
  });

  it("upload context turns storage failures into the photo message", () => {
    expect(friendlyMessage({ message: "new row violates row-level security policy" }, "upload")).toBe(ERROR_MESSAGES.upload);
    expect(friendlyMessage({ message: "The object exceeded the maximum allowed size", status: 413 }, "upload")).toBe(ERROR_MESSAGES.upload);
    // Rede e limite continuam com a mensagem própria (dizem o que fazer).
    expect(friendlyMessage({ name: "TypeError", message: "Failed to fetch" }, "upload")).toBe(ERROR_MESSAGES.network);
  });
});

describe("userErrorMessage", () => {
  it("shows the text of errors meant for the person", () => {
    expect(userErrorMessage(new UserFacingError("Escolha um arquivo de imagem."), "x")).toBe("Escolha um arquivo de imagem.");
    const branded = Object.assign(new Error("Mensagem já tratada."), { userFacing: true });
    expect(userErrorMessage(branded, "x")).toBe("Mensagem já tratada.");
  });

  it("never shows raw text of other errors; uses the fallback or the network/session message", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(userErrorMessage(new Error("new row violates row-level security policy"), "Não conseguimos enviar.")).toBe("Não conseguimos enviar.");
    expect(userErrorMessage(new Error("Geocoding falhou (500)"), "Não conseguimos usar sua localização.")).toBe("Não conseguimos usar sua localização.");
    expect(userErrorMessage(new TypeError("Failed to fetch"), "x")).toBe(ERROR_MESSAGES.network);
    expect(userErrorMessage("texto solto", "padrão")).toBe("padrão");
    expect(userErrorMessage(undefined)).toBe(ERROR_MESSAGES.unexpected);
    // Em desenvolvimento o original continua no console para diagnóstico.
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});
