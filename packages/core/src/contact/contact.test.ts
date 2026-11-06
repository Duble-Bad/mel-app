import { describe, expect, it } from "vitest";
import { cnpjField, cpfField, emailField, optionalPhoneField, personalDataChangeSchema } from "./schemas";
import { EMAIL_MESSAGES, parseEmail } from "./email";
import { formatCnpjInput, formatCpfInput, formatPhoneInput, maskCnpj, maskCpf, maskEmail, maskPhone } from "./masks";
import { maskPersonalData, type PersonalData } from "./personalData";
import { BR_DDDS, parseBrPhone, phoneToE164, PHONE_MESSAGES } from "./phone";

describe("phone (Brazil)", () => {
  it("normalizes with or without punctuation, +55 or trunk 0, and returns E.164", () => {
    for (const raw of ["(11) 98765-4321", "11987654321", "+55 11 98765-4321", "55 (11) 98765-4321", "011 98765-4321"]) {
      expect(parseBrPhone(raw)).toEqual({ ok: true, national: "11987654321", e164: "+5511987654321", kind: "mobile" });
    }
    expect(parseBrPhone("(11) 3333-4444")).toEqual({ ok: true, national: "1133334444", e164: "+551133334444", kind: "landline" });
    expect(phoneToE164("1133334444")).toBe("+551133334444");
    // DDD 55 (RS) não é confundido com o código do país.
    expect(parseBrPhone("(55) 99999-1234")).toMatchObject({ ok: true, national: "55999991234" });
  });

  it("rejects invalid DDDs, mobile without 9, landline outside 2–5 and wrong lengths", () => {
    expect(parseBrPhone("(10) 98765-4321")).toEqual({ ok: false, problem: "ddd" });
    expect(parseBrPhone("(23) 3333-4444")).toEqual({ ok: false, problem: "ddd" });
    expect(parseBrPhone("(11) 88765-4321")).toEqual({ ok: false, problem: "mobile_prefix" });
    expect(parseBrPhone("(11) 9333-4444")).toEqual({ ok: false, problem: "landline_prefix" });
    expect(parseBrPhone("(11) 6333-4444")).toEqual({ ok: false, problem: "landline_prefix" });
    expect(parseBrPhone("1198765432")).toEqual({ ok: false, problem: "landline_prefix" });
    expect(parseBrPhone("123")).toEqual({ ok: false, problem: "length" });
    expect(parseBrPhone("119876543210")).toEqual({ ok: false, problem: "length" });
    expect(parseBrPhone("  ")).toEqual({ ok: false, problem: "empty" });
    expect(BR_DDDS.size).toBe(67);
    expect(Object.values(PHONE_MESSAGES).every((m) => m.endsWith("."))).toBe(true);
  });

  it("optional field: empty → null, valid → canonical digits, invalid → specific message", () => {
    expect(optionalPhoneField.parse("")).toBeNull();
    expect(optionalPhoneField.parse(null)).toBeNull();
    expect(optionalPhoneField.parse("(41) 99999-0000")).toBe("41999990000");
    const r = optionalPhoneField.safeParse("(11) 8765-43210");
    expect(r.success).toBe(false);
    expect(r.error!.issues[0]!.message).toBe(PHONE_MESSAGES.mobile_prefix);
  });
});

describe("e-mail", () => {
  it("trims and lowercases only the domain; the local part is untouched", () => {
    expect(parseEmail("  Maria.Silva+pets@Gmail.COM ")).toEqual({ ok: true, value: "Maria.Silva+pets@gmail.com" });
    expect(emailField.parse("Ana@MEL.org.BR")).toBe("Ana@mel.org.br");
  });
  it("rejects bad formats", () => {
    for (const bad of ["", "ana", "ana@", "@mel.org", "ana@mel", "ana@@mel.org", "ana silva@mel.org", ".ana@mel.org", "ana..s@mel.org", "ana@-mel.org", "ana@mel.c"]) {
      expect(parseEmail(bad).ok, bad).toBe(false);
    }
    expect(emailField.safeParse("ana@mel").error!.issues[0]!.message).toBe(EMAIL_MESSAGES.format);
  });
});

describe("documents (shared front + back)", () => {
  it("CPF: punctuation optional, check digits, repeated sequences rejected", () => {
    expect(cpfField.parse("529.982.247-25")).toBe("52998224725");
    expect(cpfField.parse("52998224725")).toBe("52998224725");
    expect(cpfField.safeParse("111.111.111-11").success).toBe(false);
    expect(cpfField.safeParse("529.982.247-24").success).toBe(false);
  });
  it("CNPJ: numeric and alphanumeric, with or without punctuation", () => {
    expect(cnpjField.parse("11.222.333/0001-81")).toBe("11222333000181");
    expect(cnpjField.parse("12.abc.345/01de-35")).toBe("12ABC34501DE35");
    expect(cnpjField.safeParse("11.222.333/0001-82").success).toBe(false);
  });
});

describe("holder correction request (/api/perfil/dados)", () => {
  it("parses each field to its canonical form and rejects invalid values", () => {
    expect(personalDataChangeSchema.parse({ campo: "cpf", parceiro: "abc234", valor: "529.982.247-25" })).toEqual({ campo: "cpf", parceiro: "abc234", valor: "52998224725" });
    expect(personalDataChangeSchema.parse({ campo: "telefone_parceiro", ref: "abc234", tipo: "whatsapp", valor: "(48) 98888-7777" })).toMatchObject({ valor: "48988887777" });
    expect(personalDataChangeSchema.parse({ campo: "telefone_adocao", valor: "" })).toEqual({ campo: "telefone_adocao", valor: null });
    expect(personalDataChangeSchema.parse({ campo: "email", valor: " Ana@MEL.org " })).toEqual({ campo: "email", valor: "Ana@mel.org" });
    expect(personalDataChangeSchema.safeParse({ campo: "telefone_alerta", ref: "abc234", valor: "(23) 3333-4444" }).success).toBe(false);
    expect(personalDataChangeSchema.safeParse({ campo: "cnpj", parceiro: "../x", valor: "11222333000181" }).success).toBe(false);
    expect(personalDataChangeSchema.safeParse({ campo: "senha", valor: "x" }).success).toBe(false);
  });
});

describe("masks", () => {
  it("typing masks are progressive and never leave trailing punctuation", () => {
    expect(formatCpfInput("529")).toBe("529");
    expect(formatCpfInput("5299")).toBe("529.9");
    expect(formatCpfInput("52998224725999")).toBe("529.982.247-25");
    expect(formatCnpjInput("11222333000181")).toBe("11.222.333/0001-81");
    expect(formatCnpjInput("12abc34501de35")).toBe("12.ABC.345/01DE-35");
    expect(formatCnpjInput("112")).toBe("11.2");
    expect(formatPhoneInput("1")).toBe("(1");
    expect(formatPhoneInput("11")).toBe("(11");
    expect(formatPhoneInput("119")).toBe("(11) 9");
    expect(formatPhoneInput("1133334444")).toBe("(11) 3333-4444");
    expect(formatPhoneInput("11987654321")).toBe("(11) 98765-4321");
    expect(formatPhoneInput("+55 11 98765-4321")).toBe("(11) 98765-4321");
    expect(formatPhoneInput("")).toBe("");
  });
  it("privacy masks hide most of the value", () => {
    expect(maskCpf("52998224725")).toBe("***.***.**7-25");
    expect(maskCnpj("11222333000181")).toBe("**.***.***/0001-81");
    expect(maskPhone("11987654321")).toBe("(11) *****-4321");
    expect(maskPhone("1133334444")).toBe("(11) ****-4444");
    expect(maskEmail("maria@gmail.com")).toBe("m***@gmail.com");
  });
});

describe("personal data page (server-side masking)", () => {
  const data: PersonalData = {
    account: { email: "maria.silva@gmail.com", emailPending: "nova.maria@outlook.com", emailConfirmed: true, providers: ["email"] },
    partners: [
      { code: "abc234", kind: "independent", name: "Protetora", status: "APPROVED", phone: null, whatsapp: "41999990000", cnpj: null, cnpjStatus: null, documentState: "unreadable" },
      { code: "def234", kind: "company", name: "Pet", status: "APPROVED", phone: "4133334444", whatsapp: null, cnpj: "11222333000181", cnpjStatus: "PENDING", documentState: null },
    ],
    seeker: { status: "APPROVED", whatsapp: "5541999990000" },
    lostCases: [{ code: "xyz234", status: "ACTIVE", petName: "Thor", contactPhone: "11900000001", whatsappPublic: true, phonePublic: false }],
  };

  it("never sends a full value to the browser", () => {
    const m = maskPersonalData(data);
    const text = JSON.stringify(m);
    for (const full of ["maria.silva@gmail.com", "nova.maria@outlook.com", "41999990000", "4133334444", "11222333000181", "11900000001"]) {
      expect(text).not.toContain(full);
    }
    expect(m.account).toMatchObject({ email: { masked: "m***@gmail.com", state: "confirmed" }, emailPending: "n***@outlook.com", canUsePassword: true, canUseGoogle: false });
  });

  it("states: phone format ok but unconfirmed; legacy out-of-pattern needs fixing; CNPJ verification pending; CPF unreadable", () => {
    const m = maskPersonalData(data);
    expect(m.partners[0]!.whatsapp!.state).toBe("format_ok_unconfirmed");
    expect(m.partners[0]!.cpf).toEqual({ state: "unreadable" });
    expect(m.partners[1]!.cnpj!.state).toBe("pending_confirmation");
    expect(m.partners[1]!.cpf).toBeNull();
    // Linha antiga com +55 (13 dígitos) é mostrada como "precisa ser corrigido", nunca reescrita.
    expect(m.seeker!.whatsapp!.state).toBe("needs_fix");
  });
});
