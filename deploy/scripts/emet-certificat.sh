#!/bin/sh
# Primera emissió del certificat de Let's Encrypt per a PUBLIC_HOST (TG-71, docs/desplegament.md).
# S'executa un sol cop a la VM, amb els serveis aixecats. Després acme.sh el renova sol (cron del
# contenidor `acme`) i Nginx el torna a llegir cada 6 hores.
#
#   deploy/scripts/emet-certificat.sh [/opt/talaia/.env]
set -eu

ENV_FILE=${1:-/opt/talaia/.env}
COMPOSE_FILE="$(dirname "$0")/../compose.yaml"

compose() {
  docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" "$@"
}

# Les variables (PUBLIC_HOST, ACME_EMAIL, DuckDNS_Token) ja són dins del contenidor.
compose exec acme sh -euc '
  [ -n "$DuckDNS_Token" ] || { echo "Falta DUCKDNS_TOKEN al fitxer d entorn" >&2; exit 1; }
  [ -n "$ACME_EMAIL" ] || { echo "Falta ACME_EMAIL al fitxer d entorn" >&2; exit 1; }
  acme.sh --set-default-ca --server letsencrypt
  acme.sh --register-account -m "$ACME_EMAIL"
  acme.sh --issue --dns dns_duckdns -d "$PUBLIC_HOST" --dnssleep 60 || [ $? -eq 2 ]
  acme.sh --install-cert -d "$PUBLIC_HOST" \
    --fullchain-file /certs/fullchain.pem --key-file /certs/key.pem
'
compose exec nginx nginx -s reload
echo "Certificat instal·lat per a $(compose exec acme printenv PUBLIC_HOST)."
