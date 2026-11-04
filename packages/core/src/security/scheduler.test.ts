import { describe, expect, it, vi } from "vitest";
import { isSchedulerAuthorized, runScheduledMaintenance } from "./scheduler";

const SECRET = "s".repeat(24) + "-agendador-de-teste";
const OTHER = "o".repeat(40);

describe("isSchedulerAuthorized", () => {
  it("aceita Bearer com qualquer um dos segredos configurados", () => {
    expect(isSchedulerAuthorized(`Bearer ${SECRET}`, [SECRET, undefined])).toBe(true);
    expect(isSchedulerAuthorized(`Bearer ${OTHER}`, [SECRET, OTHER])).toBe(true);
  });

  it("recusa sem cabeçalho, segredo errado, prefixo ou sufixo do segredo, outro esquema", () => {
    for (const header of [null, undefined, "", "Bearer", "Bearer ", `Bearer ${SECRET}x`, `Bearer ${SECRET.slice(0, -1)}`, `Basic ${SECRET}`, SECRET, `bearer ${SECRET}`, `Bearer  ${SECRET}`]) {
      expect(isSchedulerAuthorized(header, [SECRET])).toBe(false);
    }
  });

  it("sem segredo configurado (ou curto demais), nada passa — nem 'Bearer ' vazio", () => {
    expect(isSchedulerAuthorized("Bearer ", [undefined, null, ""])).toBe(false);
    expect(isSchedulerAuthorized("Bearer undefined", [undefined])).toBe(false);
    expect(isSchedulerAuthorized("Bearer curto", ["curto"])).toBe(false);
  });
});

describe("runScheduledMaintenance", () => {
  const log = () => ({ info: vi.fn(), error: vi.fn() });

  it("faz a faxina e depois o push", async () => {
    const order: string[] = [];
    const report = await runScheduledMaintenance({
      cleanOrphans: async () => (order.push("faxina"), 3),
      dispatch: async () => (order.push("push"), { sent: 2 }),
      log: log(),
    });
    expect(order).toEqual(["faxina", "push"]);
    expect(report).toEqual({ dispatch: { sent: 2 }, orphansRemoved: 3 });
  });

  it("falha parcial: faxina quebra, o push sai mesmo assim e o erro fica registrado", async () => {
    const l = log();
    const dispatch = vi.fn(async () => ({ sent: 1 }));
    const report = await runScheduledMaintenance({ cleanOrphans: async () => Promise.reject(new Error("storage fora")), dispatch, log: l });
    expect(dispatch).toHaveBeenCalledOnce();
    expect(report.orphansRemoved).toBeNull();
    expect(l.error).toHaveBeenCalledWith("[manutenção] limpeza de fotos órfãs falhou", "storage fora");
  });

  it("falha no push sobe (a rota responde 500)", async () => {
    await expect(runScheduledMaintenance({ cleanOrphans: async () => 0, dispatch: async () => Promise.reject(new Error("banco fora")), log: log() })).rejects.toThrow("banco fora");
  });

  it("execuções repetidas são independentes (nada guardado entre elas)", async () => {
    let left = 2;
    const tasks = { cleanOrphans: async () => (left ? left-- : 0), dispatch: async () => "ok", log: log() };
    expect((await runScheduledMaintenance(tasks)).orphansRemoved).toBe(2);
    expect((await runScheduledMaintenance(tasks)).orphansRemoved).toBe(1);
    expect((await runScheduledMaintenance(tasks)).orphansRemoved).toBe(0);
  });
});
