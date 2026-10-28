import type { Metadata } from "next";
import { ResetRequestForm } from "@/components/auth/ResetRequestForm";

export const metadata: Metadata = {
  title: "Recuperar senha",
  robots: { index: false },
};

export default function ResetRequestPage() {
  return (
    <main className="mx-auto w-full max-w-md flex-1 px-4 pt-6 pb-10">
      <h1 className="text-2xl font-bold">Recuperar senha</h1>
      <p className="mt-2 mb-6 text-text-secondary">
        Informe o e-mail da sua conta. Enviaremos um link para você criar uma senha nova.
      </p>
      <ResetRequestForm />
    </main>
  );
}
