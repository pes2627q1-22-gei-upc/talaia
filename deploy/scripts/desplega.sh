#!/bin/sh
# Deploy de `stable` a la VM (TG-71, ADR-0021, docs/desplegament.md). L'executa el cron de la VM
# cada 5 minuts: si `origin/stable` no és l'últim commit desplegat bé, posa el checkout al dia, refà
# el compose i comprova el healthcheck per HTTPS. Si ja ho és, no fa res. GitHub no executa res a la VM.
#
#   deploy/scripts/desplega.sh [/opt/talaia/.env]
#   FORCE=1 deploy/scripts/desplega.sh   # torna a desplegar encara que `stable` no hagi canviat
set -eu

# Tot dins d'una funció: `git reset` reescriu aquest fitxer mentre s'executa i sh el llegeix a trossos.
main() {
  ENV_FILE=${1:-/opt/talaia/.env}
  cd "$(dirname "$0")/../.."
  estat=$(git rev-parse --git-dir)

  # Un sol deploy alhora, també si se n'engega un a mà amb FORCE=1 mentre corre el del cron.
  exec 9> "$estat/talaia-deploy.lock"
  flock -n 9 || exit 0

  timeout 60 git fetch -q origin stable
  objectiu=$(git rev-parse origin/stable)
  # Es compara amb l'últim deploy que ha acabat bé, no amb HEAD: si un deploy falla, es torna a provar.
  if [ "$objectiu" = "$(cat "$estat/talaia-desplegat" 2>/dev/null)" ] && [ -z "${FORCE:-}" ]; then
    exit 0
  fi
  git reset -q --hard "$objectiu"
  echo "$(date -Is) desplego $(git log -1 --format='%h %s')"

  trap 'echo "$(date -Is) ERROR: el deploy ha fallat"' EXIT
  timeout 1200 docker compose -f deploy/compose.yaml --env-file "$ENV_FILE" up -d --build --remove-orphans --wait
  # El certificat és per a PUBLIC_HOST: amb --resolve, curl el valida contra el 8080 local.
  host=$(sed -n 's/^PUBLIC_HOST=\([^[:space:]#]*\).*/\1/p' "$ENV_FILE")
  curl -fsS -o /dev/null --retry 10 --retry-delay 3 --retry-all-errors \
    --resolve "$host:8080:127.0.0.1" "https://$host:8080/api/v1/health"
  docker image prune -f > /dev/null
  echo "$objectiu" > "$estat/talaia-desplegat"
  trap - EXIT
  echo "$(date -Is) desplegat"
}

main "$@"
exit
