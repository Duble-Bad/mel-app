import type { Metadata } from "next";
import { HeartHandshake } from "lucide-react";
import { ButtonLink } from "@/components/ui/Button";

export const metadata: Metadata = { title: "Conta excluída", robots: { index: false } };

export default function AccountDeletedPage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center gap-4 px-[var(--mel-page-gutter)] pt-16 pb-12 text-center">
      <span className="flex size-14 items-center justify-center rounded-full bg-primary-soft text-primary-soft-foreground">
        <HeartHandshake aria-hidden="true" className="size-7" strokeWidth={1.75} />
      </span>
      <h1 className="text-2xl font-bold">Sua conta foi excluída</h1>
      <p className="text-text-secondary">Apagamos seus dados. Obrigado por ter feito parte da rede. Se precisar, a MEL continua aqui.</p>
      <ButtonLink href="/" variant="secondary" size="md" className="w-auto">
        Ir para o início
      </ButtonLink>
    </main>
  );
}
