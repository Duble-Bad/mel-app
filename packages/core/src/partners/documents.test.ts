import { describe, expect, it } from "vitest";
import { cnpjLookupEnabled, cnpjRetryDelayMs, CNPJ_LOOKUP_MAX_ATTEMPTS, shouldRetryCnpjLookup } from "./cnpjLookup";
import { maskCpf } from "../contact/masks";
import { documentStateLabel, formatCnpj, formatCpf, isValidCnpj, isValidCpf, normalizeCnpj, normalizeCpf } from "./documents";
import { partnerInputSchema, partnerRecord } from "./partners";

describe("CPF", () => {
  it("accepts valid numbers with or without punctuation", () => {
    expect(isValidCpf("529.982.247-25")).toBe(true);
    expect(isValidCpf("52998224725")).toBe(true);
    expect(isValidCpf(" 111.444.777-35 ")).toBe(true);
  });
  it("rejects wrong check digits, repeated sequences, wrong length and letters", () => {
    expect(isValidCpf("529.982.247-24")).toBe(false);
    expect(isValidCpf("529.982.247-15")).toBe(false);
    expect(isValidCpf("111.111.111-11")).toBe(false);
    expect(isValidCpf("000.000.000-00")).toBe(false);
    expect(isValidCpf("5299822472")).toBe(false);
    expect(isValidCpf("529982247255")).toBe(false);
    expect(isValidCpf("52998224A25")).toBe(false);
    expect(isValidCpf("")).toBe(false);
  });
  it("normalizes, formats and masks", () => {
    expect(normalizeCpf("529.982.247-25")).toBe("52998224725");
    expect(formatCpf("52998224725")).toBe("529.982.247-25");
    // Privacidade: só os 3 últimos dígitos (decisão do proprietário: ***.***.**9-00).
    expect(maskCpf("52998224725")).toBe("***.***.**7-25");
    expect(maskCpf("52998224725")).not.toContain("529");
    expect(maskCpf("x")).toBe("***.***.***-**");
  });
  it("moderation sees only the document state, never the number", () => {
    expect(documentStateLabel(true, "ok")).toBe("CPF informado ✓");
    expect(documentStateLabel(true, "unreadable")).toContain("ilegível");
    expect(documentStateLabel(true, "key_unavailable")).toContain("indisponível");
    expect(documentStateLabel(false, null)).toContain("pendente");
  });
});

describe("CNPJ", () => {
  it("accepts valid numeric CNPJs", () => {
    expect(isValidCnpj("11.222.333/0001-81")).toBe(true);
    expect(isValidCnpj("11222333000181")).toBe(true);
  });
  it("accepts the alphanumeric format (IN RFB 2.229/2024)", () => {
    // Exemplo oficial da Receita/Serpro.
    expect(isValidCnpj("12.ABC.345/01DE-35")).toBe(true);
    expect(isValidCnpj("12abc34501de35")).toBe(true);
    expect(isValidCnpj("12.ABC.345/01DE-36")).toBe(false);
  });
  it("rejects wrong digits, repeated sequences, wrong length and letters in the check digits", () => {
    expect(isValidCnpj("11.222.333/0001-82")).toBe(false);
    expect(isValidCnpj("00.000.000/0000-00")).toBe(false);
    expect(isValidCnpj("11.111.111/1111-11")).toBe(false);
    expect(isValidCnpj("1122233300018")).toBe(false);
    expect(isValidCnpj("112223330001AB")).toBe(false);
    expect(isValidCnpj("")).toBe(false);
  });
  it("normalizes and formats", () => {
    expect(normalizeCnpj(" 12.abc.345/01de-35 ")).toBe("12ABC34501DE35");
    expect(formatCnpj("11222333000181")).toBe("11.222.333/0001-81");
    expect(formatCnpj("12ABC34501DE35")).toBe("12.ABC.345/01DE-35");
  });
});

describe("partnerInputSchema", () => {
  const common = {
    name: "Patinhas do Bem",
    description: "Resgatamos e cuidamos de cães e gatos da zona oeste há dez anos.",
    position: { lat: -23.5712345, lng: -46.7012345 },
  };

  it("company requires CNPJ, legal name, address and one contact", () => {
    const r = partnerInputSchema.safeParse({ kind: "company", ...common, category: "vet", cnpj: "11.222.333/0001-82", legalName: "", addressLabel: "" });
    expect(r.success).toBe(false);
    const paths = r.error!.issues.map((i) => i.path[0]);
    expect(paths).toEqual(expect.arrayContaining(["cnpj", "legalName", "addressLabel", "phone"]));
    const ok = partnerInputSchema.parse({
      kind: "company", ...common, category: "vet", cnpj: "11.222.333/0001-81", legalName: "Clínica Amigo Ltda",
      addressLabel: "Rua Exemplo, 100", instagram: "@amigo",
    });
    expect(partnerRecord(ok)).toMatchObject({ partnerKind: "company", category: "vet", cnpj: "11222333000181", city: null });
  });

  it("ngo requires CNPJ, activity area and the responsible person; public place is neighborhood + city", () => {
    const r = partnerInputSchema.safeParse({ kind: "ngo", ...common, phone: "(11) 3333-4444" });
    expect(r.success).toBe(false);
    expect(r.error!.issues.map((i) => i.path[0])).toEqual(expect.arrayContaining(["cnpj", "activityArea", "responsibleName", "neighborhood", "city"]));
    const ok = partnerInputSchema.parse({
      kind: "ngo", ...common, phone: "(11) 3333-4444", cnpj: "11222333000181", activityArea: "Só gatos",
      responsibleName: "Maria Silva", neighborhood: "Butantã", city: "São Paulo – SP",
    });
    expect(partnerRecord(ok)).toMatchObject({ category: "ngo", addressLabel: "Butantã, São Paulo – SP", responsibleName: "Maria Silva" });
  });

  it("independent protector requires a valid CPF, never stored in the record; contacts optional", () => {
    const bad = partnerInputSchema.safeParse({ kind: "independent", ...common, neighborhood: "Tatuapé", city: "São Paulo – SP", cpf: "123.456.789-00" });
    expect(bad.success).toBe(false);
    expect(bad.error!.issues[0]!.message).toBe("Confira os 11 números do CPF.");
    const ok = partnerInputSchema.parse({ kind: "independent", ...common, neighborhood: "Tatuapé", city: "São Paulo – SP", cpf: "529.982.247-25" });
    expect(ok.kind === "independent" && ok.cpf).toBe("52998224725");
    const record = partnerRecord(ok);
    expect(JSON.stringify(record)).not.toContain("52998224725");
    expect(record).toMatchObject({ partnerKind: "independent", cnpj: null, legalName: null, addressLabel: "Tatuapé, São Paulo – SP" });
  });

  it("requires choosing a kind", () => {
    expect(partnerInputSchema.safeParse({ ...common }).success).toBe(false);
  });
});

describe("CNPJ lookup (disabled in the pilot)", () => {
  it("is off unless the flag is exactly 'on'", () => {
    expect(cnpjLookupEnabled(undefined)).toBe(false);
    expect(cnpjLookupEnabled("off")).toBe(false);
    expect(cnpjLookupEnabled("ON")).toBe(false);
    expect(cnpjLookupEnabled("on")).toBe(true);
  });
  it("backs off exponentially up to a day and stops after the attempt limit", () => {
    expect(cnpjRetryDelayMs(1)).toBe(15 * 60_000);
    expect(cnpjRetryDelayMs(2)).toBe(30 * 60_000);
    expect(cnpjRetryDelayMs(20)).toBe(24 * 60 * 60_000);
    expect(shouldRetryCnpjLookup(CNPJ_LOOKUP_MAX_ATTEMPTS - 1)).toBe(true);
    expect(shouldRetryCnpjLookup(CNPJ_LOOKUP_MAX_ATTEMPTS)).toBe(false);
  });
});
