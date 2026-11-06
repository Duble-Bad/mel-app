import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = { title: "Cadastrar parceiro", robots: { index: false } };

/** O cadastro agora fica na própria página de Parceiros (lê e preenche sem conta). */
export default function PublishPartnerPage() {
  redirect("/parceiros#cadastro");
}
