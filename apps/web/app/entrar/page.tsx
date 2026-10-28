import type { Metadata } from "next";
import { Suspense } from "react";
import { SignInForm } from "@/components/auth/SignInForm";
import { LoadingState } from "@/components/ui/States";

export const metadata: Metadata = {
  title: "Entrar",
  robots: { index: false },
};

export default function SignInPage() {
  return (
    <main className="mx-auto w-full max-w-md flex-1 px-4 pt-6 pb-10">
      <h1 className="text-2xl font-bold">Entre na MEL</h1>
      <p className="mt-2 mb-6 text-text-secondary">
        Com uma conta você publica alertas, cadastra seus pets e conversa com quem está ajudando.
      </p>
      <Suspense fallback={<LoadingState />}>
        <SignInForm />
      </Suspense>
    </main>
  );
}
