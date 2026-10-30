// O texto cru do Postgres/Supabase nunca vira a mensagem do DataError.
import { ERROR_MESSAGES, userErrorMessage } from "@mel/core";
import { describe, expect, it } from "vitest";
import { AuthError } from "./auth";
import { DataError } from "./client";

describe("DataError", () => {
  it("'new row violates row-level security policy' never reaches the person; the detail stays for logs", () => {
    const raw = 'new row violates row-level security policy for table "found_cases"';
    const err = new DataError(raw, "42501");
    expect(err.message).toBe("Você não tem permissão para fazer isso.");
    expect(err.message).not.toMatch(/row-level|policy|found_cases/);
    expect(err.detail).toBe(raw);
    expect(err.code).toBe("42501");
    expect(err.kind).toBe("permission");
    expect(userErrorMessage(err, "padrão")).toBe("Você não tem permissão para fazer isso.");
  });

  it("messages written by the MEL database pass through unchanged", () => {
    expect(new DataError("Foto inválida.", "42501").message).toBe("Foto inválida.");
    expect(new DataError("Você já publicou muitos animais encontrados agora. Tente de novo mais tarde.", "P0429").message).toBe(
      "Você já publicou muitos animais encontrados agora. Tente de novo mais tarde.",
    );
  });

  it("messages written in the data layer itself are kept (trusted)", () => {
    expect(new DataError("Este pet já tem um alerta aberto.", "23505", { trusted: true }).message).toBe("Este pet já tem um alerta aberto.");
  });

  it("storage failures in an upload become the photo message", () => {
    expect(new DataError("The object exceeded the maximum allowed size", undefined, { context: "upload" }).message).toBe(ERROR_MESSAGES.upload);
    expect(new DataError("new row violates row-level security policy", undefined, { context: "upload" }).message).toBe(ERROR_MESSAGES.upload);
  });

  it("codes and internal identifiers never show up", () => {
    const samples = [
      new DataError('duplicate key value violates unique constraint "pets_pkey"', "23505"),
      new DataError('invalid input syntax for type uuid: "0f7c2b1e-1111-4111-8111-111111111111"', "22P02"),
      new DataError("JSON object requested, multiple (or no) rows returned", "PGRST116"),
      new DataError("JWT expired", "PGRST301"),
      new DataError("Transição de status inválida: ACTIVE → REMOVED", "22023"),
      new DataError("algo totalmente inesperado do servidor"),
    ];
    for (const e of samples) {
      expect(e.message).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}|PGRST|\b\d{5}\b|uuid|constraint|pkey|JWT|ACTIVE|REMOVED|servidor/i);
      expect(Object.values(ERROR_MESSAGES)).toContain(e.message);
    }
  });

  it("Auth keeps its own human messages", () => {
    expect(new AuthError("invalid_credentials").message).toBe("E-mail ou senha não conferem. Confira e tente de novo.");
    expect(new AuthError("algo_novo").message).toBe("Não deu certo agora. Verifique sua conexão e tente novamente.");
  });
});
