import { describe, expect, it, vi } from "vitest";
import { fetchWithTimeout } from "./http";

/** fetch falso que respeita o sinal de cancelamento (como o de verdade). */
function hanging(): typeof fetch {
  return (_input, init) =>
    new Promise((_, reject) => {
      init?.signal?.addEventListener("abort", () => reject(init.signal!.reason));
    });
}

describe("fetchWithTimeout", () => {
  it("gives up after the timeout with a TimeoutError (the screen shows an error instead of hanging)", async () => {
    const f = fetchWithTimeout(50, { baseFetch: hanging() });
    const started = Date.now();
    await expect(f("https://exemplo.test")).rejects.toMatchObject({ name: "TimeoutError" });
    expect(Date.now() - started).toBeLessThan(1000);
  });

  it("retries reads with growing waits and returns the first good answer", async () => {
    const base = vi
      .fn<typeof fetch>()
      .mockRejectedValueOnce(new TypeError("fetch failed"))
      .mockResolvedValueOnce(new Response("", { status: 503 }))
      .mockResolvedValueOnce(new Response("ok", { status: 200 }));
    const f = fetchWithTimeout(1000, { retries: 2, backoffMs: 1, baseFetch: base });
    expect((await f("https://exemplo.test")).status).toBe(200);
    expect(base).toHaveBeenCalledTimes(3);
  });

  it("does not retry 4xx answers nor without retries", async () => {
    const base = vi.fn<typeof fetch>().mockResolvedValue(new Response("", { status: 404 }));
    expect((await fetchWithTimeout(1000, { retries: 3, backoffMs: 1, baseFetch: base })("https://x.test")).status).toBe(404);
    expect(base).toHaveBeenCalledTimes(1);
    const failing = vi.fn<typeof fetch>().mockRejectedValue(new TypeError("fetch failed"));
    await expect(fetchWithTimeout(1000, { baseFetch: failing })("https://x.test")).rejects.toThrow("fetch failed");
    expect(failing).toHaveBeenCalledTimes(1);
  });

  it("stops at once when the caller cancels (typing a new letter), without retrying", async () => {
    const base = vi.fn<typeof fetch>(hanging());
    const ctrl = new AbortController();
    const p = fetchWithTimeout(5000, { retries: 3, baseFetch: base })("https://x.test", { signal: ctrl.signal });
    ctrl.abort(new DOMException("nova busca", "AbortError"));
    await expect(p).rejects.toMatchObject({ name: "AbortError" });
    expect(base).toHaveBeenCalledTimes(1);
  });
});
