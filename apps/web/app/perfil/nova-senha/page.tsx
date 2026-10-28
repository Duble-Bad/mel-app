import type { Metadata } from "next";
import { NewPasswordForm } from "@/components/auth/NewPasswordForm";

export const metadata: Metadata = {
  title: "Nova senha",
  robots: { index: false },
};

export default function NewPasswordPage() {
  return (
    <main className="mx-auto w-full max-w-md flex-1 px-4 pt-6 pb-10">
      <h1 className="text-2xl font-bold">Crie uma senha nova</h1>
      <p className="mt-2 mb-6 text-text-secondary">Use pelo menos 8 caracteres.</p>
      <NewPasswordForm />
    </main>
  );
}
