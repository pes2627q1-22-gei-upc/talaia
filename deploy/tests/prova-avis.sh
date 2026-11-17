#!/bin/sh
# Prova de deploy/scripts/avisa.sh (TG-180) contra un Mailpit amb STARTTLS obligatori i autenticació,
# com el Gmail de l'equip: un sol avís per fallada, el de recuperació, cap correu sense configurar i
# cap error si el servidor no respon. La passa deploy-check.yml; en local només cal Docker i openssl.
#
#   sh deploy/tests/prova-avis.sh
set -eu

AVISA="$(cd "$(dirname "$0")/../scripts" && pwd)/avisa.sh"
SMTP_PORT=${SMTP_PORT:-11025}
API_PORT=${API_PORT:-18025}
API="http://127.0.0.1:$API_PORT/api/v1"
CONTENIDOR=talaia-prova-avis

dir=$(mktemp -d)
neteja() {
  docker rm -f "$CONTENIDOR" > /dev/null 2>&1 || true
  rm -rf "$dir"
}
trap neteja EXIT

fallades=0
comprova() {
  if [ "$2" = "$3" ]; then
    echo "ok   $1"
  else
    echo "FALLA $1: s'esperava «$3» i és «$2»"
    fallades=$((fallades + 1))
  fi
}
total() { curl -fsS "$API/messages" | jq -r '.total'; }

# Certificat autosignat per a localhost: el curl d'avisa.sh el valida amb CURL_CA_BUNDLE.
openssl req -x509 -newkey rsa:2048 -nodes -days 1 -subj '/CN=localhost' \
  -addext 'subjectAltName=DNS:localhost,IP:127.0.0.1' \
  -keyout "$dir/key.pem" -out "$dir/cert.pem" 2> /dev/null
chmod 644 "$dir/key.pem"
export CURL_CA_BUNDLE="$dir/cert.pem"

docker rm -f "$CONTENIDOR" > /dev/null 2>&1 || true
docker run -d --name "$CONTENIDOR" -p "127.0.0.1:$SMTP_PORT:1025" -p "127.0.0.1:$API_PORT:8025" \
  -v "$dir:/certs:ro" \
  -e MP_SMTP_TLS_CERT=/certs/cert.pem -e MP_SMTP_TLS_KEY=/certs/key.pem \
  -e MP_SMTP_REQUIRE_STARTTLS=true -e MP_SMTP_AUTH_ACCEPT_ANY=true \
  axllent/mailpit:v1.27.0 > /dev/null
for _ in $(seq 30); do
  curl -fsS "$API/messages" > /dev/null 2>&1 && break
  sleep 1
done

cat > "$dir/buit.env" <<EOF
PUBLIC_HOST=talaia.duckdns.org
ALERT_SMTP_URL=
ALERT_FROM=
ALERT_TO=
ALERT_SMTP_PASSWORD=
EOF
cat > "$dir/ple.env" <<EOF
PUBLIC_HOST=talaia.duckdns.org
ALERT_SMTP_URL=smtp://localhost:$SMTP_PORT
ALERT_FROM=equip@example.com
ALERT_TO=una@example.com, altra@example.com
ALERT_SMTP_PASSWORD='contrasenya-secreta'
EOF
sed "s/:$SMTP_PORT/:1/" "$dir/ple.env" > "$dir/caigut.env"
printf 'El deploy ha fallat al pas: docker compose.\nÚltimes línies del log\n' > "$dir/cos"
estat="$dir/talaia-avisat"
# Els temporals d'avisa.sh (missatge i contrasenya) han de desaparèixer.
mkdir "$dir/tmp"
export TMPDIR="$dir/tmp"

echo "Sense configurar"
sh "$AVISA" fallada "$dir/buit.env" "$estat" abc123 "Deploy fallat: abc123 prova" "$dir/cos"
comprova "surt amb 0" "$?" 0
comprova "no envia res" "$(total)" 0
comprova "no desa l'estat" "$(test -e "$estat" && echo sí || echo no)" no

echo "Servidor que no respon"
sortida=$(sh "$AVISA" fallada "$dir/caigut.env" "$estat" abc123 "Deploy fallat: abc123 prova" "$dir/cos" 2>&1)
comprova "surt amb 0" "$?" 0
comprova "ho deixa al log" "$(echo "$sortida" | grep -c "AVÍS: no s'ha pogut enviar")" 1
comprova "no desa l'estat (es torna a provar)" "$(test -e "$estat" && echo sí || echo no)" no

echo "Un sol avís per fallada"
sh "$AVISA" fallada "$dir/ple.env" "$estat" abc123 "Deploy fallat: abc123 afegeix l'índex" "$dir/cos" > /dev/null
sh "$AVISA" fallada "$dir/ple.env" "$estat" abc123 "Deploy fallat: abc123 afegeix l'índex" "$dir/cos" > /dev/null
sh "$AVISA" fallada "$dir/ple.env" "$estat" abc123 "Deploy fallat: abc123 afegeix l'índex" "$dir/cos" > /dev/null
comprova "tres passades, un correu" "$(total)" 1
comprova "desa la clau" "$(cat "$estat")" abc123
missatge=$(curl -fsS "$API/messages" | jq '.messages[0]')
comprova "assumpte (UTF-8)" "$(echo "$missatge" | jq -r '.Subject')" "[Talaia] Deploy fallat: abc123 afegeix l'índex"
comprova "dos destinataris" "$(echo "$missatge" | jq -r '[.To[].Address] | join(",")')" "una@example.com,altra@example.com"
id=$(echo "$missatge" | jq -r '.ID')
cru=$(curl -fsS "$API/message/$id/raw")
comprova "porta el cos" "$(echo "$cru" | grep -c 'pas: docker compose')" 1
comprova "no porta la contrasenya" "$(echo "$cru" | grep -c 'contrasenya-secreta')" 0
comprova "no deixa temporals" "$(find "$TMPDIR" -type f | wc -l | tr -d ' ')" 0

echo "Una altra fallada (un altre commit o el fetch)"
sh "$AVISA" fallada "$dir/ple.env" "$estat" git-fetch "Deploy fallat: git fetch" "$dir/cos" > /dev/null
sh "$AVISA" fallada "$dir/ple.env" "$estat" git-fetch "Deploy fallat: git fetch" "$dir/cos" > /dev/null
comprova "un correu més" "$(total)" 2
comprova "desa la clau nova" "$(cat "$estat")" git-fetch

echo "Recuperació"
sh "$AVISA" recuperat "$dir/ple.env" "$estat" "Deploy recuperat: def456 hotfix" "$dir/cos" > /dev/null
comprova "envia el de recuperació" "$(total)" 3
comprova "assumpte" "$(curl -fsS "$API/messages" | jq -r '.messages[0].Subject')" "[Talaia] Deploy recuperat: def456 hotfix"
comprova "esborra l'estat" "$(test -e "$estat" && echo sí || echo no)" no
sh "$AVISA" recuperat "$dir/ple.env" "$estat" "Deploy recuperat: def456 hotfix" "$dir/cos" > /dev/null
comprova "sense fallada prèvia, res" "$(total)" 3

echo "Ús incorrecte"
set +e
sh "$AVISA" fallada "$dir/ple.env" 2> /dev/null
comprova "surt amb 2" "$?" 2
set -e

if [ "$fallades" -ne 0 ]; then
  echo "$fallades comprovacions han fallat"
  docker logs "$CONTENIDOR" 2>&1 | tail -n 20
  exit 1
fi
echo "Totes les comprovacions han passat"
