import { describe, expect, it } from "vitest";
import { crossSiteRejection } from "./requestGuard";

const site = "https://mel.example";

describe("crossSiteRejection", () => {
  it("aceita o próprio site e pedidos sem Origin", () => {
    expect(crossSiteRejection({ origin: site, siteOrigin: site })).toBeNull();
    expect(crossSiteRejection({ origin: null, siteOrigin: site })).toBeNull();
    expect(crossSiteRejection({ origin: undefined, siteOrigin: site })).toBeNull();
  });

  it("recusa outro site, inclusive subdomínio e outro protocolo", () => {
    expect(crossSiteRejection({ origin: "https://atacante.example", siteOrigin: site })?.status).toBe(403);
    expect(crossSiteRejection({ origin: "https://x.mel.example", siteOrigin: site })?.status).toBe(403);
    expect(crossSiteRejection({ origin: "http://mel.example", siteOrigin: site })?.status).toBe(403);
    expect(crossSiteRejection({ origin: "null", siteOrigin: site })?.status).toBe(403);
  });

  it("com requireJson, só application/json passa", () => {
    const ok = (contentType: string | null) => crossSiteRejection({ origin: site, siteOrigin: site, contentType, requireJson: true });
    expect(ok("application/json")).toBeNull();
    expect(ok("application/json; charset=utf-8")).toBeNull();
    expect(ok("Application/JSON")).toBeNull();
    expect(ok("text/plain")?.status).toBe(415);
    expect(ok("application/x-www-form-urlencoded")?.status).toBe(415);
    expect(ok("multipart/form-data; boundary=x")?.status).toBe(415);
    expect(ok("text/plain; application/json")?.status).toBe(415);
    expect(ok(null)?.status).toBe(415);
  });

  it("origem errada vence o Content-Type certo", () => {
    expect(crossSiteRejection({ origin: "https://atacante.example", siteOrigin: site, contentType: "application/json", requireJson: true })?.status).toBe(403);
  });
});
