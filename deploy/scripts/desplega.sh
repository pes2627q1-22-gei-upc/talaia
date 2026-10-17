#!/bin/sh
# Deploy de `stable` a la VM (TG-71, ADR-0021, docs/desplegament.md). L'executa el cron de la VM
# cada 5 minuts: si `origin/stable` ha canviat, posa el checkout al dia, refà el compose i comprova
# el healthcheck per HTTPS. Si no ha canviat, no fa res. GitHub no executa res a la VM.
#
#   deploy/scripts/desplega.sh [/opt/talaia/.env]
#   FORCE=1 deploy/scripts/desplega.sh   # torna a desplegar encara que `stable` no hagi canviat
set -eu

# Tot dins d'una funció: `git reset` reescriu aquest fitxer mentre s'executa i sh el llegeix a trossos.
main() {
  ENV_FILE=${1:-/opt/talaia/.env}
  cd "$(dirname "$0")/../.."

  git fetch -q origin stable
  if [ "$(git rev-parse HEAD)" = "$(git rev-parse origin/stable)" ] && [ -z "${FORCE:-}" ]; then
    exit 0
  fi
  git reset -q --hard origin/stable
  echo "$(date -Is) desplego $(git log -1 --format='%h %s')"

  trap 'echo "$(date -Is) ERROR: el deploy ha fallat"' EXIT
  docker compose -f deploy/compose.yaml --env-file "$ENV_FILE" up -d --build --remove-orphans --wait
  # El certificat és per a PUBLIC_HOST: amb --resolve, curl el valida contra el 8080 local.
  host=$(sed -n 's/^PUBLIC_HOST=\([^[:space:]#]*\).*/\1/p' "$ENV_FILE")
  curl -fsS -o /dev/null --retry 10 --retry-delay 3 --retry-all-errors \
    --resolve "$host:8080:127.0.0.1" "https://$host:8080/api/v1/health"
  docker image prune -f > /dev/null
  trap - EXIT
  echo "$(date -Is) desplegat"
}

main "$@"
exit
