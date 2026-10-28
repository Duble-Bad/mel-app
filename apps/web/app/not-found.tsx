import { ButtonLink } from "@/components/ui/Button";

export default function NotFound() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 px-4 pt-10 pb-10">
      <h1 className="text-2xl font-bold">Não encontramos esta página</h1>
      <p className="text-text-secondary">
        O link pode estar incompleto, ou o conteúdo foi removido ou deixou de ser público.
      </p>
      <ButtonLink href="/" size="md">
        Voltar para o início
      </ButtonLink>
    </main>
  );
}
