// E-mail: valida o FORMATO e normaliza sem mudar a identidade da caixa.
// - tira espaços nas pontas;
// - minúsculas SÓ no domínio (a parte local pode diferenciar maiúsculas em
//   alguns provedores; não alteramos);
// - "formato válido" NÃO é "verificado": quem confirma é o fluxo do Supabase
//   Auth (link enviado para a caixa).

export type EmailProblem = "empty" | "format" | "too_long";
export type EmailParse = { ok: true; value: string } | { ok: false; problem: EmailProblem };

export const EMAIL_MESSAGES: Record<EmailProblem, string> = {
  empty: "Informe o e-mail.",
  format: "Confira o e-mail (ex.: nome@provedor.com.br).",
  too_long: "E-mail longo demais.",
};

// Parte local: caracteres "atext" da RFC 5322, com pontos só entre eles.
const LOCAL = /^[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+(\.[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+)*$/;
const LABEL = /^(?!-)[a-z0-9-]{1,63}(?<!-)$/;

export function parseEmail(raw: string | null | undefined): EmailParse {
  const v = (raw ?? "").trim();
  if (!v) return { ok: false, problem: "empty" };
  if (v.length > 254) return { ok: false, problem: "too_long" };
  const at = v.lastIndexOf("@");
  if (at <= 0 || at === v.length - 1) return { ok: false, problem: "format" };
  const local = v.slice(0, at);
  const domain = v.slice(at + 1).toLowerCase();
  if (local.length > 64 || !LOCAL.test(local)) return { ok: false, problem: "format" };
  const labels = domain.split(".");
  if (labels.length < 2 || !labels.every((l) => LABEL.test(l))) return { ok: false, problem: "format" };
  const tld = labels[labels.length - 1]!;
  if (!/^([a-z]{2,63}|xn--[a-z0-9-]{1,59})$/.test(tld)) return { ok: false, problem: "format" };
  return { ok: true, value: `${local}@${domain}` };
}

export const isValidEmail = (raw: string) => parseEmail(raw).ok;
