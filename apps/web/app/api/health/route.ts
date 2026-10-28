import { connection } from "next/server";
import { getHealth } from "@mel/data";
import { createPublicClient } from "@/lib/supabase/public";

export async function GET() {
  await connection();
  try {
    const health = await getHealth(createPublicClient());
    return Response.json({ ok: health.ok, postgis: health.postgis, checkedAt: health.checkedAt });
  } catch (error) {
    console.error("[api/health] falhou", error);
    return Response.json({ ok: false }, { status: 503 });
  }
}
