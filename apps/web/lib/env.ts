// Variáveis públicas (NEXT_PUBLIC_*) precisam ser lidas literalmente para o
// Next.js conseguir embuti-las no bundle do navegador.
export function publicEnv() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabasePublishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const mapTilerKey = process.env.NEXT_PUBLIC_MAPTILER_KEY;

  if (!supabaseUrl || !supabasePublishableKey) {
    throw new Error(
      "Supabase não configurado: defina NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (veja .env.example).",
    );
  }
  return { supabaseUrl, supabasePublishableKey, mapTilerKey };
}
