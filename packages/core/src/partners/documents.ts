// CPF e CNPJ: formato e dígitos verificadores. Validar o número NÃO é
// verificar a identidade de ninguém: nunca mostrar "verificado" só por isso.

/** Só os 11 dígitos do CPF (aceita pontos, traço e espaços). */
export function normalizeCpf(value: string): string {
  return value.replace(/[\s.\-]/g, "");
}

/** CPF com 11 dígitos, dígitos verificadores corretos e sem sequência repetida. */
export function isValidCpf(value: string): boolean {
  const cpf = normalizeCpf(value);
  if (!/^\d{11}$/.test(cpf) || /^(\d)\1{10}$/.test(cpf)) return false;
  const digits = [...cpf].map(Number);
  for (const len of [9, 10]) {
    let sum = 0;
    for (let i = 0; i < len; i++) sum += digits[i]! * (len + 1 - i);
    const dv = ((sum * 10) % 11) % 10;
    if (dv !== digits[len]) return false;
  }
  return true;
}

export const formatCpf = (cpf: string) => cpf.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4");

/** Mostra só o miolo: ***.456.789-** (padrão de mascaramento usado pelo gov.br). */
export const maskCpf = (cpf: string) => (/^\d{11}$/.test(cpf) ? `***.${cpf.slice(3, 6)}.${cpf.slice(6, 9)}-**` : "***");

/** CNPJ normalizado: maiúsculas, sem pontuação (aceita o formato alfanumérico de 2026). */
export function normalizeCnpj(value: string): string {
  return value.replace(/[\s.\-/]/g, "").toUpperCase();
}

const W1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
const W2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
const cnpjDv = (chars: string, weights: number[]) => {
  const sum = weights.reduce((acc, w, i) => acc + (chars.charCodeAt(i) - 48) * w, 0);
  const r = sum % 11;
  return r < 2 ? 0 : 11 - r;
};

/**
 * CNPJ numérico ou alfanumérico (IN RFB 2.229/2024): 12 caracteres [0-9A-Z] +
 * 2 dígitos verificadores; módulo 11 com valor = código ASCII − 48.
 */
export function isValidCnpj(value: string): boolean {
  const cnpj = normalizeCnpj(value);
  if (!/^[0-9A-Z]{12}\d{2}$/.test(cnpj) || /^(.)\1{13}$/.test(cnpj)) return false;
  return cnpjDv(cnpj, W1) === Number(cnpj[12]) && cnpjDv(cnpj, W2) === Number(cnpj[13]);
}

export const formatCnpj = (cnpj: string) => cnpj.replace(/^(\w{2})(\w{3})(\w{3})(\w{4})(\d{2})$/, "$1.$2.$3/$4-$5");
