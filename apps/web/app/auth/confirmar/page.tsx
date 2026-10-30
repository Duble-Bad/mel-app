import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { emailLinkAction, emailLinkCopy } from "@mel/core";
import { MelLogo } from "@/components/brand/MelLogo";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Surface";

export const metadata: Metadata = {
  title: "Confirmar",
  robots: { index: false },
};

/**
 * Destino dos links dos e-mails do Auth (cadastro, senha nova, troca de
 * e-mail). Abrir a página não gasta o link: só o botão envia o token (POST),
 * para que leitores de e-mail que abrem links sozinhos não o consumam.
 */
export default function ConfirmEmailLinkPage({ searchParams }: PageProps<"/auth/confirmar">) {
  return (
    <main className="mx-auto w-full max-w-md flex-1 px-4 pt-6 pb-10">
      <Link href="/" aria-label="MEL — início" className="-ml-1 mb-6 inline-flex rounded-md p-1">
        <MelLogo size={30} />
      </Link>
      <Suspense fallback={<Skeleton className="h-40 w-full rounded-md" />}>
        {searchParams.then((q) => (
          <ConfirmLink query={q} />
        ))}
      </Suspense>
    </main>
  );
}

function ConfirmLink({ query }: { query: Record<string, string | string[] | undefined> }) {
  const params = new URLSearchParams(Object.entries(query).flatMap(([k, v]) => (typeof v === "string" ? [[k, v]] : [])));
  const link = emailLinkAction(params);

  if (!link.ok) {
    return (
      <div className="flex flex-col gap-5">
        <h1 className="text-2xl font-bold">Link inválido</h1>
        <Alert tone="error">Esse link está incompleto ou já foi usado. Entre de novo ou peça um novo link.</Alert>
        <Link href="/entrar" className="font-semibold text-link underline-offset-4 hover:underline">
          Ir para entrar
        </Link>
      </div>
    );
  }

  const copy = emailLinkCopy(link.type);
  return (
    <form method="post" action="/auth/confirmar/verificar" className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-bold">{copy.title}</h1>
        <p className="mt-2 text-text-secondary">{copy.body}</p>
      </div>
      <input type="hidden" name="token_hash" value={link.tokenHash} />
      <input type="hidden" name="type" value={link.type} />
      <input type="hidden" name="next" value={link.next} />
      <Button type="submit">{copy.action}</Button>
    </form>
  );
}
