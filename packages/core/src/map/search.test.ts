import { describe, expect, it } from "vitest";
import { DEFAULT_CENTER, itemHref, itemTitle, parseSearchParams, sinceFrom, toSearchParams } from "./search";

describe("parseSearchParams", () => {
  it("uses safe defaults for an empty or invalid URL", () => {
    expect(parseSearchParams({})).toEqual({
      kinds: ["lost", "found", "sighting"],
      species: [],
      period: "30d",
      radiusKm: 5,
      center: DEFAULT_CENTER,
      hasCenter: false,
      page: 1,
    });
    const junk = parseSearchParams({ tipos: "x,y", especie: "dragão", periodo: "1ano", raio: "999", lat: "abc", pagina: "-3" });
    expect(junk).toMatchObject({ kinds: ["lost", "found", "sighting"], species: [], period: "30d", radiusKm: 5, hasCenter: false, page: 1 });
  });

  it("reads filters and rounds the center (no precise location in links)", () => {
    const f = parseSearchParams({ tipos: "lost,sighting", especie: "dog", periodo: "7d", raio: "10", lat: "-23.5489123", lng: "-46.6388456", pagina: "2" });
    expect(f).toEqual({
      kinds: ["lost", "sighting"],
      species: ["dog"],
      period: "7d",
      radiusKm: 10,
      center: { lat: -23.54891, lng: -46.63885 },
      hasCenter: true,
      page: 2,
    });
  });

  it("pages with a fixed kind ignore ?tipos", () => {
    expect(parseSearchParams({ tipos: "found" }, ["lost"]).kinds).toEqual(["lost"]);
  });
});

describe("toSearchParams", () => {
  it("round-trips and only writes what differs from the default", () => {
    expect(toSearchParams(parseSearchParams({}))).toBe("");
    const qs = toSearchParams(parseSearchParams({ tipos: "lost", especie: "cat", periodo: "24h", raio: "1", lat: "-23.5", lng: "-46.6", pagina: "3" }));
    expect(qs).toBe("?tipos=lost&especie=cat&periodo=24h&raio=1&lat=-23.5&lng=-46.6&pagina=3");
    expect(parseSearchParams(Object.fromEntries(new URLSearchParams(qs)))).toMatchObject({ kinds: ["lost"], species: ["cat"], page: 3 });
  });
});

describe("helpers", () => {
  it("period → since", () => {
    const now = new Date("2026-10-29T12:00:00Z");
    expect(sinceFrom("24h", now)).toBe("2026-10-28T12:00:00.000Z");
    expect(sinceFrom("todos", now)).toBeNull();
  });
  it("titles and links per kind", () => {
    expect(itemTitle({ kind: "lost", title: "Mel", species: "dog" })).toBe("Mel");
    expect(itemTitle({ kind: "sighting", title: null, species: "cat" })).toBe("Gato visto solto");
    expect(itemTitle({ kind: "found", title: null, species: "dog" })).toBe("Cachorro encontrado");
    expect(itemHref({ kind: "lost", code: "abc234" })).toBe("/alerta/abc234");
    expect(itemHref({ kind: "sighting", code: "abc234" })).toBe("/encontrado/abc234");
  });
});
