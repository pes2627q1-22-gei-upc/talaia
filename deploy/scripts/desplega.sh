#!/bin/sh
# Deploy de `stable` a la VM (TG-71, ADR-0021, docs/desplegament.md). L'executa el cron de la VM
# cada 5 minuts: si `origin/stable` no és l'últim commit desplegat bé, posa el checkout al dia, refà
# el compose i comprova el healthcheck per HTTPS. Si ja ho és, no fa res. GitHub no executa res a la VM.
#
# Si falla, envia un correu (deploy/scripts/avisa.sh, ADR-0035): un per fallada, encara que el cron ho
# torni a provar cada 5 minuts, i un altre quan torna a anar bé. Sense les variables ALERT_*, no avisa.
#
#   deploy/scripts/desplega.sh [/opt/talaia/.env]
#   FORCE=1 deploy/scripts/desplega.sh   # torna a desplegar encara que `stable` no hagi canviat
#   DEPLOY_LOG=…                         # log que va al correu (per defecte, ~/talaia-deploy.log del cron)
set -eu

# Avís de fallada (des del trap). El cos porta el pas, el commit i la cua del log; mai el fitxer d'entorn.
# shellcheck disable=SC2317,SC2329 # la crida el trap d'EXIT
fallada() {
  echo "$(date -Is) ERROR: el deploy ha fallat ($pas)"
  # El deploy queda pendent encara que el correu no surti: el cron el torna a provar.
  [ "$clau" = git-fetch ] || echo "$clau" > "$estat/talaia-pendent"
  [ -f deploy/scripts/avisa.sh ] || return 0
  resum=$(git log -1 --format='%h %s' "$clau" 2>/dev/null || echo "$pas")
  cos=$(mktemp)
  {
    echo "El deploy de la VM ha fallat al pas: $pas."
    echo
    echo "Commit: $resum"
    echo "Hora: $(date -Is)"
    echo "Màquina: $(hostname)"
    echo
    echo "El cron ho torna a provar cada 5 minuts. No arribarà cap altre avís fins que es recuperi"
    echo "o falli un altre commit."
    echo
    echo "Últimes línies de $DEPLOY_LOG:"
    echo
    tail -n 30 "$DEPLOY_LOG" 2>/dev/null || echo "(no s'ha pogut llegir el log)"
  } > "$cos"
  sh deploy/scripts/avisa.sh fallada "$ENV_FILE" "$estat/talaia-avisat" "$clau" \
    "Deploy fallat: $resum" "$cos" || true
  rm -f "$cos"
}

# Avís de recuperació, només si abans s'ha avisat d'una fallada.
recuperat() {
  [ -f "$estat/talaia-avisat" ] && [ -f deploy/scripts/avisa.sh ] || return 0
  resum=$(git log -1 --format='%h %s' "$objectiu")
  cos=$(mktemp)
  {
    echo "El deploy de la VM torna a anar bé."
    echo
    echo "Commit desplegat: $resum"
    echo "Hora: $(date -Is)"
    echo "Màquina: $(hostname)"
  } > "$cos"
  sh deploy/scripts/avisa.sh recuperat "$ENV_FILE" "$estat/talaia-avisat" \
    "Deploy recuperat: $resum" "$cos" || true
  rm -f "$cos"
}

# Tot dins d'una funció: `git reset` reescriu aquest fitxer mentre s'executa i sh el llegeix a trossos.
main() {
  ENV_FILE=${1:-/opt/talaia/.env}
  cd "$(dirname "$0")/../.."
  estat=$(git rev-parse --git-dir)

  # Un sol deploy alhora, també si se n'engega un a mà amb FORCE=1 mentre corre el del cron.
  exec 9> "$estat/talaia-deploy.lock"
  flock -n 9 || exit 0
  DEPLOY_LOG=${DEPLOY_LOG:-$HOME/talaia-deploy.log}

  # Des d'aquí, qualsevol sortida amb error (set -e) deixa ERROR al log i n'avisa. Les sortides amb 0
  # (cap canvi) no. `clau` identifica la fallada: el commit o, si el fetch falla, un valor fix.
  pas="git fetch"
  clau=git-fetch
  # shellcheck disable=SC2154 # rc s'assigna dins del trap
  trap 'rc=$?; [ "$rc" -ne 0 ] && fallada' EXIT

  timeout 60 git fetch -q origin stable
  objectiu=$(git rev-parse origin/stable)
  clau=$objectiu
  # Es compara amb l'últim deploy que ha acabat bé. Si n'hi ha un de pendent (ha fallat, també amb
  # FORCE=1), es torna a desplegar encara que `stable` no hagi canviat.
  if [ "$objectiu" = "$(cat "$estat/talaia-desplegat" 2>/dev/null)" ] && [ -z "${FORCE:-}" ] \
    && [ ! -f "$estat/talaia-pendent" ]; then
    recuperat   # sense deploy pendent, només pot quedar un avís de git-fetch
    exit 0
  fi
  pas="git reset"
  git reset -q --hard "$objectiu"
  echo "$(date -Is) desplego $(git log -1 --format='%h %s')"

  pas="docker compose"
  timeout 1200 docker compose -f deploy/compose.yaml --env-file "$ENV_FILE" up -d --build --remove-orphans --wait
  # El certificat és per a PUBLIC_HOST: amb --resolve, curl el valida contra el 8080 local.
  pas="healthcheck"
  host=$(sed -n 's/^PUBLIC_HOST=\([^[:space:]#]*\).*/\1/p' "$ENV_FILE")
  # 10 intents, 3 s entre l'un i l'altre (SALUT_ESPERA, 0 als tests). El bucle és a mà: la VM és
  # Ubuntu 20.04, amb curl 7.68, i `--retry-all-errors` no hi és fins a la 7.71.
  salut=""
  for _ in 1 2 3 4 5 6 7 8 9 10; do
    if curl -fsS -o /dev/null --max-time 10 \
      --resolve "$host:8080:127.0.0.1" "https://$host:8080/api/v1/health"; then
      salut=ok
      break
    fi
    sleep "${SALUT_ESPERA:-3}"
  done
  [ -n "$salut" ]
  pas="docker image prune"
  docker image prune -f > /dev/null
  echo "$objectiu" > "$estat/talaia-desplegat"
  rm -f "$estat/talaia-pendent"
  echo "$(date -Is) desplegat"
  recuperat
}

main "$@"
exit
