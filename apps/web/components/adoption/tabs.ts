// Fora do módulo "use client": o servidor também lê esta lista (?aba=).
export const ADOPTION_TABS = [
  { id: "disponiveis", label: "Disponíveis" },
  { id: "quero-adotar", label: "Quero adotar" },
  { id: "como-funciona", label: "Como funciona" },
] as const;
export type AdoptionTabId = (typeof ADOPTION_TABS)[number]["id"];
