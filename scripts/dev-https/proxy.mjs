// HTTPS de DESENVOLVIMENTO na rede local (docs/19-teste-no-celular.md, opção A).
// Proxy TLS na frente do servidor HTTP do app, que continua como está.
//   https://<ip>:3443  → app em http://<ip>:3000
//   http://<ip>:3080   → página para baixar o certificado PÚBLICO da CA local
// Nada sai para a internet: escuta só na rede local e só repassa para o próprio PC.
// Uso: node scripts/dev-https/proxy.mjs   (MEL_DEV_HTTPS_IP, MEL_DEV_APP_URL opcionais)
import { createServer as createHttps } from "node:https";
import { createServer as createHttp, request } from "node:http";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const IP = process.env.MEL_DEV_HTTPS_IP ?? "172.18.4.238";
const APP = new URL(process.env.MEL_DEV_APP_URL ?? `http://${IP}:3000`);
const DIR = process.env.MEL_DEV_HTTPS_DIR ?? join(homedir(), ".mel-dev-https");
const HTTPS_PORT = 3443;
const CERT_PORT = 3080;

const tls = { key: readFileSync(join(DIR, "servidor.key")), cert: readFileSync(join(DIR, "servidor.crt")) };
const caCer = readFileSync(join(DIR, "ca.cer"));
const caCrt = readFileSync(join(DIR, "ca.crt"));

createHttps(tls, (req, res) => {
  const upstream = request(
    {
      hostname: APP.hostname,
      port: APP.port,
      method: req.method,
      path: req.url,
      // Host e protocolo originais: o app monta redirecionamentos (ex.: /auth/callback) com https://<ip>:3443.
      headers: { ...req.headers, "x-forwarded-proto": "https", "x-forwarded-host": req.headers.host, "x-forwarded-for": req.socket.remoteAddress },
    },
    (up) => {
      res.writeHead(up.statusCode ?? 502, up.headers);
      up.pipe(res);
    },
  );
  upstream.on("error", () => {
    if (!res.headersSent) res.writeHead(502, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("App de desenvolvimento fora do ar (porta 3000).");
  });
  req.pipe(upstream);
}).listen(HTTPS_PORT, "0.0.0.0", () => console.log(`HTTPS de teste: https://${IP}:${HTTPS_PORT} → ${APP.origin}`));

// Só o certificado PÚBLICO da CA (a chave privada nunca é servida).
const page = `<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>MEL — certificado de teste</title><body style="font-family:system-ui;max-width:560px;margin:24px auto;padding:0 16px;line-height:1.5">
<h1>Certificado de teste da MEL</h1><p>Só para o celular de testes. Ele permite abrir <b>https://${IP}:${HTTPS_PORT}</b> sem aviso.</p>
<p><a href="/mel-dev-ca.cer" style="display:inline-block;padding:12px 18px;background:#f6b928;color:#1c1404;border-radius:999px;font-weight:700;text-decoration:none">Baixar certificado (Android)</a></p>
<p><a href="/mel-dev-ca.crt">Baixar certificado (iPhone)</a></p>
<p>Siga o passo a passo do documento <i>docs/19-teste-no-celular.md</i>. Ao terminar os testes, remova o certificado do celular.</p></body></html>`;
createHttp((req, res) => {
  if (req.url === "/mel-dev-ca.cer") return void res.writeHead(200, { "Content-Type": "application/x-x509-ca-cert", "Content-Disposition": 'attachment; filename="mel-dev-ca.cer"' }).end(caCer);
  if (req.url === "/mel-dev-ca.crt") return void res.writeHead(200, { "Content-Type": "application/x-x509-ca-cert", "Content-Disposition": 'attachment; filename="mel-dev-ca.crt"' }).end(caCrt);
  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" }).end(page);
}).listen(CERT_PORT, "0.0.0.0", () => console.log(`Certificado da CA: http://${IP}:${CERT_PORT}`));
