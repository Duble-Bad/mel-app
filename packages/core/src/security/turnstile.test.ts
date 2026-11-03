import { describe, expect, it, vi } from "vitest";
import { TURNSTILE_VERIFY_URL, verifyTurnstileToken } from "./turnstile";

/** Resposta do siteverify como o Cloudflare devolve. */
const cloudflare = (body: Record<string, unknown>) => vi.fn(async () => new Response(JSON.stringify(body)));

describe("verifyTurnstileToken", () => {
  it("aceita só success: true e manda segredo, token e IP ao Cloudflare", async () => {
    const f = cloudflare({ success: true });
    expect(await verifyTurnstileToken({ secret: "s", token: "t", remoteIp: "203.0.113.7", fetch: f })).toEqual({ ok: true, codes: [] });
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(TURNSTILE_VERIFY_URL);
    const sent = init.body as URLSearchParams;
    expect([sent.get("secret"), sent.get("response"), sent.get("remoteip")]).toEqual(["s", "t", "203.0.113.7"]);
  });

  it("token ausente reprova sem nem chamar o Cloudflare", async () => {
    const f = cloudflare({ success: true });
    expect(await verifyTurnstileToken({ secret: "s", token: undefined, fetch: f })).toEqual({ ok: false, codes: ["missing-input-response"] });
    expect(await verifyTurnstileToken({ secret: "s", token: "", fetch: f })).toMatchObject({ ok: false });
    expect(f).not.toHaveBeenCalled();
  });

  it("token inválido reprova", async () => {
    const v = await verifyTurnstileToken({ secret: "s", token: "forjado", fetch: cloudflare({ success: false, "error-codes": ["invalid-input-response"] }) });
    expect(v).toEqual({ ok: false, codes: ["invalid-input-response"] });
  });

  it("token expirado ou já usado (uso único) reprova", async () => {
    const v = await verifyTurnstileToken({ secret: "s", token: "velho", fetch: cloudflare({ success: false, "error-codes": ["timeout-or-duplicate"] }) });
    expect(v).toEqual({ ok: false, codes: ["timeout-or-duplicate"] });
  });

  it("resposta estranha ou falha de rede reprova (nunca aprova por omissão)", async () => {
    expect(await verifyTurnstileToken({ secret: "s", token: "t", fetch: cloudflare({}) })).toMatchObject({ ok: false });
    expect(await verifyTurnstileToken({ secret: "s", token: "t", fetch: cloudflare({ success: "true" }) })).toMatchObject({ ok: false });
    const offline = vi.fn(async () => {
      throw new TypeError("fetch failed");
    });
    expect(await verifyTurnstileToken({ secret: "s", token: "t", fetch: offline })).toEqual({ ok: false, codes: ["network-error"] });
  });
});
