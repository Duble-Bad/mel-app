import { connection } from "next/server";
import { getHealth } from "@mel/data";
import { createPublicClient } from "@/lib/supabase/public";

async function isBackendUp(): Promise<boolean> {
  try {
    return (await getHealth(createPublicClient())).ok;
  } catch (error) {
    console.error("[SystemStatus] health check falhou", error);
    return false;
  }
}

/** Indicador discreto de que o backend está no ar. Nunca quebra a página. */
export async function SystemStatus() {
  await connection();
  const ok = await isBackendUp();
  return (
    <p data-testid="system-status" data-ok={ok}>
      <span aria-hidden="true" className={`mr-1 ${ok ? "text-success" : "text-danger"}`}>
        ●
      </span>
      {ok ? "Rede MEL conectada" : "Estamos com instabilidade na conexão. Tente novamente em instantes."}
    </p>
  );
}
