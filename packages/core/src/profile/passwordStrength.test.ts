import { describe, expect, it } from "vitest";
import { passwordHint, passwordStrength } from "./passwordStrength";

describe("passwordStrength", () => {
  it("vazia é 0; menos de 8 caracteres é fraca", () => {
    expect(passwordStrength("")).toBe(0);
    expect(passwordStrength("Ab1!")).toBe(1);
  });

  it("8+ caracteres óbvios continuam fracos", () => {
    for (const p of ["aaaaaaaa", "12345678", "abcdefgh", "qwertyui", "87654321", "abababab"]) expect(passwordStrength(p), p).toBe(1);
  });

  it("sobe com variedade e tamanho", () => {
    expect(passwordStrength("melzinha")).toBe(1);
    expect(passwordStrength("melzinha7")).toBe(2);
    expect(passwordStrength("Melzinha7")).toBe(3);
    expect(passwordStrength("Melzinha7!")).toBe(3);
    expect(passwordStrength("Melzinha7!casa")).toBe(4);
    expect(passwordStrength("correto cavalo bateria grampo")).toBe(3);
  });

  it("nunca passa de 4", () => {
    expect(passwordStrength("Uma Senha Muito Longa 123 !!!")).toBe(4);
  });
});

describe("passwordHint", () => {
  it("diz o que falta, em ordem", () => {
    expect(passwordHint("abc", 1)).toBe("Use pelo menos 8 caracteres.");
    expect(passwordHint("melzinha", 1)).toBe("Acrescente um número.");
    expect(passwordHint("melzinha7", 2)).toBe("Acrescente um símbolo (ex.: ! @ #).");
    expect(passwordHint("melzinha7!", 3)).toBe("Misture letras maiúsculas e minúsculas.");
    expect(passwordHint("Melzinha7!", 3)).toBe("Uma senha mais longa fica ainda mais forte.");
    expect(passwordHint("Melzinha7!casa", 4)).toBe("");
    expect(passwordHint("", 0)).toBe("");
  });
});

describe("passwordChecks", () => {
  it("separa o obrigatório do recomendado e marca o que já foi cumprido", async () => {
    const { passwordChecks } = await import("./passwordStrength");
    const checks = passwordChecks("melzinha7");
    expect(checks.map((c) => [c.id, c.required, c.ok])).toEqual([
      ["length", true, true],
      ["number", false, true],
      ["symbol", false, false],
      ["case", false, false],
    ]);
    expect(passwordChecks("").every((c) => !c.ok)).toBe(true);
  });
});
