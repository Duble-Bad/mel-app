import { z } from "zod";
import { isValidCnpj, isValidCpf, normalizeCnpj, normalizeCpf } from "../partners/documents";
import { EMAIL_MESSAGES, parseEmail } from "./email";
import { parseBrPhone, PHONE_MESSAGES } from "./phone";

// Campos compartilhados por formulários (navegador) e rotas do servidor: a
// mesma regra nos dois lados. Saída sempre canônica (sem pontuação).

export const CPF_MESSAGE = "Confira os 11 números do CPF.";
export const CNPJ_MESSAGE = "Confira os 14 caracteres do CNPJ.";

export const cpfField = z
  .string({ error: "Informe o CPF." })
  .trim()
  .min(1, "Informe o CPF.")
  .transform((v) => normalizeCpf(v))
  .refine(isValidCpf, CPF_MESSAGE);

export const cnpjField = z
  .string({ error: "Informe o CNPJ." })
  .trim()
  .min(1, "Informe o CNPJ.")
  .transform((v) => normalizeCnpj(v))
  .refine(isValidCnpj, CNPJ_MESSAGE);

/** Telefone opcional: vazio vira null; preenchido precisa ser válido (DDD, 9 no celular, fixo 2–5). */
export const optionalPhoneField = z
  .string()
  .trim()
  .nullable()
  .default(null)
  .transform((v, ctx) => {
    if (!v) return null;
    const p = parseBrPhone(v);
    if (!p.ok) {
      ctx.addIssue({ code: "custom", message: PHONE_MESSAGES[p.problem] });
      return z.NEVER;
    }
    return p.national;
  });

export const emailField = z
  .string({ error: EMAIL_MESSAGES.empty })
  .transform((v, ctx) => {
    const p = parseEmail(v);
    if (!p.ok) {
      ctx.addIssue({ code: "custom", message: EMAIL_MESSAGES[p.problem] });
      return z.NEVER;
    }
    return p.value;
  });

const partnerCode = z.string().regex(/^[a-z2-9]{6}$/i, "Cadastro inválido.");

/** Pedido de correção pelo titular (/api/perfil/dados): um campo por vez, já canônico depois do parse. */
export const personalDataChangeSchema = z.discriminatedUnion("campo", [
  z.object({ campo: z.literal("cpf"), parceiro: partnerCode, valor: cpfField }),
  z.object({ campo: z.literal("cnpj"), parceiro: partnerCode, valor: cnpjField }),
  z.object({ campo: z.literal("telefone_parceiro"), ref: partnerCode, tipo: z.enum(["phone", "whatsapp"]), valor: optionalPhoneField }),
  z.object({ campo: z.literal("telefone_adocao"), valor: optionalPhoneField }),
  z.object({ campo: z.literal("telefone_alerta"), ref: partnerCode, valor: optionalPhoneField }),
  z.object({ campo: z.literal("email"), valor: emailField }),
]);
export type PersonalDataChange = z.output<typeof personalDataChangeSchema>;
