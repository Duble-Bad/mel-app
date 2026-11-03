// Push para quem procura o pet (migration 30): avistamento, mensagem e Radar
// entram na mesma fila do Guardião, com agrupamento, intervalo e teto.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { foundInputSchema, petInputSchema, pushPayload, sightingInputSchema } from "@mel/core";
import { ensureSession } from "../src/auth";
import { startConversation, sendMessage } from "../src/chat";
import { createFoundCase } from "../src/found";
import { claimPushBatch, finishPush, savePushSubscription, type PushJob } from "../src/guardian";
import { activateLostCase, closeLostCase, startLostCase, updateLostCase } from "../src/lostCases";
import { createPet } from "../src/pets";
import { createSighting } from "../src/sightings";
import type { MelClient } from "../src/client";
import { anonClient, createTestUser, serviceClient } from "./helpers";

// Região própria (Porto Alegre) para não cruzar com outros testes.
const POA = { lat: -30.0346, lng: -51.2177 };
const near = (d: number) => ({ lat: POA.lat + d, lng: POA.lng + d });
const minutesAgo = (m: number) => new Date(Date.now() - m * 60_000).toISOString();
const PET = { species: "dog", size: "small", sex: "female", colorPrimary: "caramelo" } as const;

type U = Awaited<ReturnType<typeof createTestUser>>;
let tutor: U, helper: U, finder: U;
const anonIds: string[] = [];

async function anonymous() {
  const client = anonClient();
  const user = await ensureSession(client);
  anonIds.push(user.id);
  return { id: user.id, client };
}

async function alert(name: string) {
  const pet = await createPet(tutor.client, tutor.id, petInputSchema.parse({ name, ...PET }));
  const c = await startLostCase(tutor.client, tutor.id, pet.id);
  await updateLostCase(tutor.client, c.id, { lastSeen: POA, lostAt: minutesAgo(120), publicAreaLabel: "Centro, Porto Alegre – RS", contactChat: true });
  const a = await activateLostCase(tutor.client, c.id);
  return { id: a.id, code: a.code };
}

const sighting = (code: string, o: Record<string, unknown> = {}) =>
  sightingInputSchema.parse({
    code,
    position: near(0.002),
    placeLabel: "Condomínio Jardim das Flores, Centro Histórico, Porto Alegre – RS",
    seenAt: minutesAgo(15),
    notes: "Entrou no condomínio pela portaria.",
    ...o,
  });

/** Pushes na fila para uma pessoa, com o tipo do aviso. */
async function queued(userId: string) {
  const { data, error } = await serviceClient()
    .from("push_outbox")
    .select("id, status, notification_id, notifications(kind, payload)")
    .eq("user_id", userId)
    .order("id");
  if (error) throw error;
  return (data as unknown as { id: number; status: string; notification_id: string; notifications: { kind: string; payload: Record<string, unknown> } }[]) ?? [];
}

/** Reserva a fila até achar os jobs deste teste; devolve o resto como SKIPPED para não atrapalhar outros testes. */
async function claimMine(userId: string): Promise<PushJob[]> {
  const service = serviceClient();
  const mine: PushJob[] = [];
  for (let i = 0; i < 5; i++) {
    const jobs = await claimPushBatch(service, 200);
    if (!jobs.length) break;
    for (const j of jobs) {
      if (j.userId === userId) mine.push(j);
      else await finishPush(service, j.outboxId, "SKIPPED", "teste");
    }
    if (mine.length) break;
  }
  return mine;
}

beforeAll(async () => {
  [tutor, helper, finder] = await Promise.all([createTestUser("tp-tutor"), createTestUser("tp-helper"), createTestUser("tp-finder")]);
  // Só o tutor tem aparelho inscrito; quem ajuda não tem (o fluxo não pode quebrar).
  await savePushSubscription(tutor.client, { endpoint: `https://push.example.test/${crypto.randomUUID()}`, keys: { p256dh: "p", auth: "a" } }, "teste");
}, 60_000);

afterAll(async () => {
  for (const id of anonIds) await serviceClient().auth.admin.deleteUser(id);
  await Promise.all([tutor, helper, finder].map((u) => u?.cleanup()));
}, 60_000);

describe("avistamento → tutor", () => {
  it("1 — novo avistamento entra na fila de push do tutor; o próximo em menos de 10 min só atualiza o contador", async () => {
    const a = await alert("Pipoca");
    const before = (await queued(tutor.id)).length;
    const s1 = await anonymous();
    await createSighting(s1.client, sighting(a.code));
    const after1 = await queued(tutor.id);
    expect(after1.length).toBe(before + 1);
    const job = after1.at(-1)!;
    expect(job.notifications.kind).toBe("sighting_new");
    expect(job.notifications.payload.code).toBe(a.code);

    const s2 = await anonymous();
    await createSighting(s2.client, sighting(a.code, { seenAt: minutesAgo(5) }));
    const after2 = await queued(tutor.id);
    expect(after2.length).toBe(after1.length); // mesmo aviso, sem segundo toque
    const { data: n } = await serviceClient().from("notifications").select("payload").eq("id", job.notification_id).single();
    expect((n!.payload as { count: number }).count).toBe(2);
  });

  it("9 — o push do avistamento não leva local, texto livre, telefone nem coordenada; o tutor recebe a qualquer hora", async () => {
    const mine = await claimMine(tutor.id);
    const job = mine.find((j) => j.notification.kind === "sighting_new");
    expect(job).toBeDefined();
    expect(job!.quietNight).toBe(false); // silêncio noturno é só do Guardião
    const body = JSON.stringify(pushPayload(job!.notification));
    expect(body).not.toMatch(/Condomínio|Centro Histórico|portaria|-30\.|-51\./);
    expect(pushPayload(job!.notification).body).toBe("Alguém informou que viu seu pet. Abra a MEL para ver a pista.");
    // 10 — o despacho continua registrando o resultado.
    for (const j of mine) await finishPush(serviceClient(), j.outboxId, "SENT", undefined, { ok: [j.subscriptions[0]!.id] });
    const rows = await queued(tutor.id);
    expect(rows.find((r) => r.id === job!.outboxId)?.status).toBe("SENT");
  });

  it("8 — alerta encerrado não recebe avistamento nem gera push", async () => {
    const a = await alert("Fechado");
    await closeLostCase(tutor.client, a.code);
    const before = (await queued(tutor.id)).length;
    const s = await anonymous();
    await expect(createSighting(s.client, sighting(a.code))).rejects.toThrow("não está mais ativo");
    expect((await queued(tutor.id)).length).toBe(before);
  });
});

describe("mensagem → destinatário", () => {
  it("2/3/4 — o outro participante entra na fila; quem escreve, nunca; sem aparelho inscrito o chat segue normal", async () => {
    const a = await alert("Mensagem");
    const tutorBefore = (await queued(tutor.id)).length;
    const convId = await startConversation(helper.client, a.code, "Oi, acho que vi a Mensagem perto da praça.");
    const tutorAfter = await queued(tutor.id);
    expect(tutorAfter.length).toBe(tutorBefore + 1);
    expect(tutorAfter.at(-1)!.notifications.kind).toBe("message_new");
    expect(await queued(helper.id)).toEqual([]); // não recebe push da própria mensagem

    // Tutor responde: quem ajudou entra na fila (sem aparelho, o despacho só marca SKIPPED).
    await sendMessage(tutor.client as MelClient, convId, tutor.id, "Obrigada! Onde exatamente?");
    const helperRows = await queued(helper.id);
    expect(helperRows).toHaveLength(1);
    expect(helperRows[0]!.notifications.kind).toBe("message_new");
    expect((await queued(tutor.id)).length).toBe(tutorAfter.length); // o tutor não recebe a própria

    // Mais mensagens em seguida: agrupadas, sem tempestade de push.
    await sendMessage(helper.client, convId, helper.id, "Na esquina da padaria.");
    await sendMessage(helper.client, convId, helper.id, "Estava indo para o norte.");
    expect((await queued(tutor.id)).length).toBe(tutorAfter.length);
    const mine = await claimMine(helper.id);
    expect(mine.length).toBeGreaterThan(0);
    expect(mine[0]!.subscriptions).toEqual([]); // sem aparelho: nada a enviar
    for (const j of mine) await finishPush(serviceClient(), j.outboxId, "SKIPPED", "sem aparelho inscrito");
  });
});

describe("Radar → tutor", () => {
  it("C — correspondência nova entra na fila do tutor; quem publicou o encontrado fica só com o aviso no app", async () => {
    await alert("Radar");
    const before = (await queued(tutor.id)).length;
    await createFoundCase(
      finder.client,
      finder.id,
      foundInputSchema.parse({ ...PET, position: near(0.003), areaLabel: "Centro, Porto Alegre – RS", foundAt: minutesAgo(10), custody: "with_me" }),
    );
    const rows = await queued(tutor.id);
    expect(rows.length).toBeGreaterThan(before);
    expect(rows.at(-1)!.notifications.kind).toBe("match_new");
    expect(rows.at(-1)!.notifications.payload).not.toHaveProperty("score");
    expect(await queued(finder.id)).toEqual([]);
  });
});

describe("teto", () => {
  it("7 — no máximo 12 pushes por hora por pessoa fora do Guardião; o excedente fica só no app", async () => {
    const service = serviceClient();
    const a = await alert("Teto");
    // Enche a cota da hora com avisos já enviados.
    const current = (await service.from("push_outbox").select("id", { count: "exact", head: true }).eq("user_id", tutor.id).gte("created_at", minutesAgo(60))).count ?? 0;
    for (let i = current; i < 12; i++) {
      const { data: n } = await service.from("notifications").insert({ user_id: tutor.id, kind: "reunion_thanks", payload: { code: a.code, pet_name: "Teto" } } as never).select("id").single();
      await service.from("push_outbox").insert({ notification_id: (n as { id: string }).id, user_id: tutor.id, status: "SENT" } as never);
    }
    const before = (await queued(tutor.id)).length;
    const s = await anonymous();
    await createSighting(s.client, sighting(a.code));
    expect((await queued(tutor.id)).length).toBe(before); // sem push novo…
    const { data: n } = await service.from("notifications").select("id").eq("user_id", tutor.id).eq("kind", "sighting_new").eq("payload->>code", a.code);
    expect(n).toHaveLength(1); // …mas o aviso no app chegou
    const { data: ev } = await service.from("events").select("props").eq("name", "abuse_guard").eq("subject_id", (n![0] as { id: string }).id);
    expect(ev?.map((e) => (e.props as { rule: string }).rule)).toContain("tutor_push_budget");
  });
});
