import { AppHeader } from "@/components/layout/AppHeader";
import { NotFoundContent } from "@/components/layout/NotFoundContent";

/** Endereço que não existe (fora de qualquer layout): precisa do próprio cabeçalho. */
export default function NotFound() {
  return (
    <>
      <AppHeader />
      <NotFoundContent />
    </>
  );
}
