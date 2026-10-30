// Erros REAIS do Postgres/Storage chegam ao app só como mensagem amigável
// (o texto técnico fica em `detail`, para logs).
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ERROR_MESSAGES, foundInputSchema, petInputSchema, SERVER_MESSAGES, userErrorMessage } from "@mel/core";
import { DataError } from "../src/client";
import { createFoundCase } from "../src/found";
import { createPet } from "../src/pets";
import { uploadAvatar } from "../src/profiles";
import { sendMessage } from "../src/chat";
import { createTestUser } from "./helpers";

const TECHNICAL = /row-level|security policy|violates|found_cases|relation|constraint|42501|PGRST|uuid|JWT/i;

let alice: Awaited<ReturnType<typeof createTestUser>>;
let bruno: Awaited<ReturnType<typeof createTestUser>>;

beforeAll(async () => {
  alice = await createTestUser("err-alice");
  bruno = await createTestUser("err-bruno");
});

afterAll(async () => {
  await alice?.cleanup();
  await bruno?.cleanup();
});

async function caught(p: Promise<unknown>): Promise<DataError> {
  const err = await p.then(() => null, (e: unknown) => e);
  expect(err).toBeInstanceOf(DataError);
  return err as DataError;
}

describe("real database errors become friendly messages", () => {
  it("RLS violation ('new row violates row-level security policy') → permission message", async () => {
    const err = await caught(
      createFoundCase(
        alice.client,
        bruno.id, // em nome de outra pessoa
        foundInputSchema.parse({
          species: "dog",
          position: { lat: -23.5489, lng: -46.6388 },
          areaLabel: "Sé, São Paulo – SP",
          foundAt: new Date(Date.now() - 600_000).toISOString(),
          custody: "with_me",
        }),
      ),
    );
    expect(err.detail).toMatch(/row-level security/);
    expect(err.message).toBe(ERROR_MESSAGES.permission);
    expect(userErrorMessage(err, "x")).not.toMatch(TECHNICAL);
  });

  it("writing as someone else in the chat never shows SQL", async () => {
    const err = await caught(sendMessage(alice.client, crypto.randomUUID(), bruno.id, "oi"));
    expect(err.message).not.toMatch(TECHNICAL);
    // Ou uma mensagem genérica, ou uma que o próprio banco da MEL escreveu (ex.: "Conversa não encontrada.").
    expect([...Object.values(ERROR_MESSAGES), ...SERVER_MESSAGES]).toContain(err.message);
  });

  it("invalid input (bad enum value) never shows the Postgres text", async () => {
    const err = await caught(createPet(alice.client, alice.id, { ...petInputSchema.parse({ name: "Teste", species: "dog" }), species: "dragon" as never }));
    expect(err.detail.length).toBeGreaterThan(0);
    expect(err.message).not.toMatch(TECHNICAL);
    expect(err.message).not.toMatch(/dragon|species|enum/i);
  });

  it("upload into someone else's folder → the photo message", async () => {
    const png = new Blob([Uint8Array.from(atob("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="), (c) => c.charCodeAt(0))], { type: "image/png" });
    const err = await caught(uploadAvatar(alice.client, bruno.id, png));
    expect(err.message).toBe(ERROR_MESSAGES.upload);
    expect(err.message).not.toMatch(TECHNICAL);
  });
});
