"use client";

import { ErrorScreen } from "@/components/ui/ErrorScreen";

/** Falha ao carregar uma página do app: o cabeçalho continua, a página mostra como seguir. */
export default function AppError({ error, retry }: { error: unknown; retry: () => void }) {
  return <ErrorScreen error={error} retry={retry} />;
}
