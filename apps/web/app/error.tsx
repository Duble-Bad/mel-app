"use client";

import { ErrorScreen } from "@/components/ui/ErrorScreen";

/** Falha fora das páginas do app (entrar, confirmar e-mail) ou no layout do app. */
export default function RootError({ error, retry }: { error: unknown; retry: () => void }) {
  return <ErrorScreen error={error} retry={retry} withLogo />;
}
