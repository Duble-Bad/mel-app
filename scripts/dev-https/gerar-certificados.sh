#!/usr/bin/env bash
# HTTPS de DESENVOLVIMENTO na rede local (docs/19-teste-no-celular.md, opção A).
# Gera uma autoridade certificadora (CA) só deste PC e um certificado para o IP
# da rede. Tudo fica FORA do repositório, em ~/.mel-dev-https. A chave da CA
# nunca sai deste PC: o celular recebe só o certificado público da CA.
#
# Uso: bash scripts/dev-https/gerar-certificados.sh [ip]   (padrão: 172.18.4.238)
set -euo pipefail
# Git Bash (Windows) converteria "/O=..." em caminho de arquivo.
export MSYS_NO_PATHCONV=1

IP="${1:-172.18.4.238}"
DIR="${MEL_DEV_HTTPS_DIR:-$HOME/.mel-dev-https}"
mkdir -p "$DIR"
chmod 700 "$DIR" 2>/dev/null || true
cd "$DIR"

# CA: criada uma vez e reaproveitada (o celular só precisa confiar nela uma vez).
if [ ! -f ca.key ]; then
  openssl genrsa -out ca.key 4096 2>/dev/null
  openssl req -x509 -new -key ca.key -sha256 -days 825 -out ca.crt \
    -subj "/O=MEL desenvolvimento/CN=MEL DEV CA local (somente testes)" \
    -addext "basicConstraints=critical,CA:TRUE,pathlen:0" \
    -addext "keyUsage=critical,keyCertSign,cRLSign"
  echo "CA criada em $DIR/ca.crt"
fi

# Certificado do servidor para o IP (refeito a cada execução; validade < 398 dias, exigência do iOS/Chrome).
openssl genrsa -out servidor.key 2048 2>/dev/null
openssl req -new -key servidor.key -out servidor.csr -subj "/O=MEL desenvolvimento/CN=$IP"
cat > servidor.ext <<EOF
basicConstraints=CA:FALSE
keyUsage=critical,digitalSignature,keyEncipherment
extendedKeyUsage=serverAuth
subjectAltName=IP:$IP,IP:127.0.0.1,DNS:localhost
EOF
openssl x509 -req -in servidor.csr -CA ca.crt -CAkey ca.key -CAcreateserial \
  -out servidor.crt -days 397 -sha256 -extfile servidor.ext 2>/dev/null
rm -f servidor.csr servidor.ext

# Formato DER (.cer) para Android/iOS.
openssl x509 -in ca.crt -outform der -out ca.cer

echo "Certificado do servidor para $IP: $DIR/servidor.crt (válido até $(openssl x509 -in servidor.crt -noout -enddate | cut -d= -f2))"
echo "Impressão digital SHA-256 da CA (confira no celular):"
openssl x509 -in ca.crt -noout -fingerprint -sha256 | cut -d= -f2
