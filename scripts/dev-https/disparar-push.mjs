// Dispara o envio de push do app de DESENVOLVIMENTO (em produção quem faz isso é
// o agendador). Usa PUSH_DISPATCH_SECRET do .env.local da raiz, que nunca é impresso.
// Uso: node --env-file=.env.local scripts/dev-https/disparar-push.mjs [--repetir]
//      (--repetir: a cada 20 s, até Ctrl+C — útil durante o teste no celular)
const secret = process.env.PUSH_DISPATCH_SECRET;
if (!secret) {
  console.error("PUSH_DISPATCH_SECRET ausente no .env.local.");
  process.exit(1);
}
const url = process.env.MEL_DEV_APP_URL ?? "http://172.18.4.238:3000";

async function dispatch() {
  try {
    const res = await fetch(`${url}/api/push/dispatch`, { method: "POST", headers: { Authorization: `Bearer ${secret}` } });
    const body = await res.json().catch(() => ({}));
    console.log(new Date().toLocaleTimeString("pt-BR"), res.status, JSON.stringify(body));
  } catch (err) {
    console.log("falhou:", err instanceof Error ? err.message : err);
  }
}

await dispatch();
if (process.argv.includes("--repetir")) setInterval(dispatch, 20_000);
