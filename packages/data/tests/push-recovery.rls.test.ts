// Recuperação de push preso em SENDING (migration 31): reserva com prazo de
// 15 min, até 3 reservas, aviso de até 6 h. Os itens são criados direto na fila
// (chave secreta) com o estado e as horas de cada cenário.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { claimPushBatch, finishPush, type PushJob } from "../src/guardian";
import { createTestUser, serviceClient } from "./helpers";

type U = Awaited<ReturnType<typeof createTestUser>>;
let user: U;
let notificationId: string;
const minutesAgo = (m: number) => new Date(Date.now() - m * 60_000).toISOString();
const service = () => serviceClient();

interface OutboxRow {
  id: number;
  status: string;
  attempts: number;
  claimed_at: string | null;
  reason: string | null;
}

/** Item na fila no estado pedido. */
async function item(o: { status?: string; claimedMinutesAgo?: number; attempts?: number; createdMinutesAgo?: number } = {}): Promise<number> {
  const { data, error } = await service()
    .from("push_outbox" as never)
    .insert({
      notification_id: notificationId,
      user_id: user.id,
      status: o.status ?? "PENDING",
      attempts: o.attempts ?? 0,
      claimed_at: o.claimedMinutesAgo === undefined ? null : minutesAgo(o.claimedMinutesAgo),
      created_at: minutesAgo(o.createdMinutesAgo ?? 1),
    } as never)
    .select("id")
    .single();
  expect(error).toBeNull();
  return (data as unknown as { id: number }).id;
}

async function row(id: number): Promise<OutboxRow> {
  const { data } = await service().from("push_outbox" as never).select("id, status, attempts, claimed_at, reason").eq("id", id).single();
  return data as unknown as OutboxRow;
}

/** Simula o relógio: a reserva do item foi feita há `m` minutos (margem larga: o relógio
 * de quem roda o teste pode estar alguns minutos fora do relógio do banco). */
const claimedAgo = (id: number, m: number) => service().from("push_outbox" as never).update({ claimed_at: minutesAgo(m) } as never).eq("id", id);

/**
 * Uma execução do despacho: reserva tudo o que estiver disponível e devolve
 * só os itens deste teste; o resto (de outros testes) é encerrado.
 */
async function dispatchRun(ids: number[], limit = 200): Promise<PushJob[]> {
  const jobs = await claimPushBatch(service(), limit);
  for (const j of jobs.filter((j) => !ids.includes(j.outboxId))) await finishPush(service(), j.outboxId, "SKIPPED", "teste");
  return jobs.filter((j) => ids.includes(j.outboxId));
}

beforeAll(async () => {
  user = await createTestUser("push-recovery");
  const { data, error } = await service()
    .from("notifications")
    .insert({ user_id: user.id, kind: "guardian_alert", payload: { case_kind: "lost", pet_name: "Teste", code: "TESTE1" } } as never)
    .select("id")
    .single();
  expect(error).toBeNull();
  notificationId = (data as { id: string }).id;
});

afterAll(async () => {
  await user?.cleanup();
});

describe("push outbox recovery", () => {
  it("PENDING normal: reservado uma vez, com hora e 1ª tentativa", async () => {
    const id = await item();
    expect((await dispatchRun([id])).map((j) => j.outboxId)).toEqual([id]);
    const r = await row(id);
    expect(r).toMatchObject({ status: "SENDING", attempts: 1 });
    expect(r.claimed_at).not.toBeNull();
    await finishPush(service(), id, "SENT");
  });

  it("SENDING recente (despacho ainda vivo) não é tirado dele", async () => {
    const id = await item({ status: "SENDING", claimedMinutesAgo: 5, attempts: 1, createdMinutesAgo: 6 });
    expect(await dispatchRun([id])).toEqual([]);
    expect(await row(id)).toMatchObject({ status: "SENDING", attempts: 1 });
    await finishPush(service(), id, "SENT");
  });

  it("SENDING expirado (> 15 min) volta a ser reservado, contando a tentativa", async () => {
    const id = await item({ status: "SENDING", claimedMinutesAgo: 30, attempts: 1, createdMinutesAgo: 35 });
    expect((await dispatchRun([id])).map((j) => j.outboxId)).toEqual([id]);
    const r = await row(id);
    expect(r).toMatchObject({ status: "SENDING", attempts: 2 });
    expect(Date.parse(r.claimed_at!)).toBeGreaterThan(Date.now() - 20 * 60_000); // reserva renovada (a expirada era de 30 min)
    await finishPush(service(), id, "SENT");
  });

  it("legado sem hora de reserva (antes da migration): usa a criação do item", async () => {
    const id = await item({ status: "SENDING", attempts: 0, createdMinutesAgo: 40 });
    expect((await dispatchRun([id])).map((j) => j.outboxId)).toEqual([id]);
    await finishPush(service(), id, "SENT");
  });

  it("duas execuções ao mesmo tempo: cada item (novo ou recuperado) vai para uma só", async () => {
    const ids = [
      await item(),
      await item(),
      await item({ status: "SENDING", claimedMinutesAgo: 30, attempts: 1, createdMinutesAgo: 35 }),
      await item({ status: "SENDING", claimedMinutesAgo: 30, attempts: 2, createdMinutesAgo: 60 }),
    ];
    const [a, b] = await Promise.all([dispatchRun(ids, 2), dispatchRun(ids, 2)]);
    const rest = await dispatchRun(ids);
    const all = [...a, ...b, ...rest].map((j) => j.outboxId);
    expect(all.sort()).toEqual([...ids].sort());
    for (const id of ids) await finishPush(service(), id, "SENT");
  });

  it("falha no envio (todos os aparelhos recusaram): FAILED é definitivo", async () => {
    const id = await item();
    await dispatchRun([id]);
    await finishPush(service(), id, "FAILED", "500: serviço de push fora");
    await claimedAgo(id, 60);
    expect(await dispatchRun([id])).toEqual([]);
    expect(await row(id)).toMatchObject({ status: "FAILED", reason: "500: serviço de push fora" });
  });

  it("interrupção entre o envio e a confirmação: reenvia (pode duplicar) e o despacho atrasado não desfaz o resultado", async () => {
    const id = await item();
    await dispatchRun([id]); // despacho A reserva, envia e cai antes do finish_push
    await claimedAgo(id, 30);
    expect((await dispatchRun([id])).map((j) => j.outboxId)).toEqual([id]); // despacho B retoma
    await finishPush(service(), id, "SENT");
    // A "acorda" e tenta gravar falha: não sobrescreve o SENT de B.
    await finishPush(service(), id, "FAILED", "atrasado");
    expect(await row(id)).toMatchObject({ status: "SENT", attempts: 2 });
  });

  it("limite de tentativas: a 3ª reserva abandonada vira FAILED e nunca mais é tentada", async () => {
    const id = await item();
    for (let attempt = 1; attempt <= 3; attempt++) {
      expect((await dispatchRun([id])).map((j) => j.outboxId)).toEqual([id]);
      await claimedAgo(id, 30); // caiu de novo
    }
    expect(await dispatchRun([id])).toEqual([]);
    expect(await row(id)).toMatchObject({ status: "FAILED", attempts: 3, reason: "reserva expirou sem confirmação de envio" });
    await claimedAgo(id, 120);
    expect(await dispatchRun([id])).toEqual([]);
    expect((await row(id)).status).toBe("FAILED");
  });

  it("aviso velho (> 6 h) com reserva abandonada não é reenviado", async () => {
    const id = await item({ status: "SENDING", claimedMinutesAgo: 30, attempts: 1, createdMinutesAgo: 7 * 60 });
    expect(await dispatchRun([id])).toEqual([]);
    expect(await row(id)).toMatchObject({ status: "FAILED", attempts: 1 });
  });

  it("SENT, SKIPPED e FAILED nunca voltam para a fila, por mais antigos que sejam", async () => {
    const ids = await Promise.all(
      ["SENT", "SKIPPED", "FAILED"].map((status) => item({ status, claimedMinutesAgo: 120, attempts: 1, createdMinutesAgo: 130 })),
    );
    expect(await dispatchRun(ids)).toEqual([]);
    expect((await Promise.all(ids.map(row))).map((r) => [r.status, r.attempts])).toEqual([
      ["SENT", 1],
      ["SKIPPED", 1],
      ["FAILED", 1],
    ]);
  });
});
