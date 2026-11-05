import { NotFoundContent } from "@/components/layout/NotFoundContent";

/**
 * notFound() dentro das telas do app (alerta, pet, conversa…): o layout do grupo
 * já tem o cabeçalho; repetir o AppHeader aqui o duplicava.
 */
export default function AppNotFound() {
  return <NotFoundContent />;
}
