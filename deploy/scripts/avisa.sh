#!/bin/sh
# Avís per correu quan el deploy de la VM falla i quan es recupera (TG-180, ADR-0035).
# L'executa desplega.sh; la CI el prova contra Mailpit (deploy/tests/prova-avis.sh).
#
#   avisa.sh fallada   <env-file> <fitxer-estat> <clau> <assumpte> <fitxer-cos>
#   avisa.sh recuperat <env-file> <fitxer-estat> <assumpte> <fitxer-cos>
#
# Un sol avís per fallada: `fallada` no envia res si <fitxer-estat> ja conté <clau> (el commit, o un
# valor fix quan falla el `git fetch`), i `recuperat` només envia si el fitxer existeix i l'esborra.
# L'estat només s'escriu si el correu ha sortit: si no surt, es torna a provar a la passada següent.
#
# Llegeix ALERT_SMTP_URL, ALERT_FROM, ALERT_TO (adreces separades per comes) i ALERT_SMTP_PASSWORD
# de <env-file>. Si en falta alguna, no fa res. Surt sempre amb 0: l'avís mai fa fallar el deploy.
set -u

llegeix() {
  sed -n "s/^$1=\(.*\)$/\1/p" "$ENV_FILE" | tail -n 1 | sed "s/^'\(.*\)'$/\1/; s/^\"\(.*\)\"$/\1/"
}

# Envia <assumpte> i el contingut de <fitxer-cos>. Retorna 0 si el servidor l'ha acceptat.
envia() {
  url=$(llegeix ALERT_SMTP_URL)
  from=$(llegeix ALERT_FROM)
  to=$(llegeix ALERT_TO)
  pass=$(llegeix ALERT_SMTP_PASSWORD)
  if [ -z "$url" ] || [ -z "$from" ] || [ -z "$to" ] || [ -z "$pass" ]; then
    return 1
  fi

  missatge=$(mktemp)
  config=$(mktemp)
  # Els temporals s'esborren també si el procés s'interromp.
  trap 'rm -f "$missatge" "$config"' EXIT INT TERM
  # L'assumpte porta el missatge del commit (accents): codificat segons l'RFC 2047.
  assumpte=$(printf '[Talaia] %s' "$1" | base64 | tr -d '\n')
  {
    printf 'From: Talaia VM <%s>\nTo: %s\nSubject: =?UTF-8?B?%s?=\n' "$from" "$to" "$assumpte"
    printf 'MIME-Version: 1.0\nContent-Type: text/plain; charset=utf-8\n\n'
    cat "$2"
  } > "$missatge"

  # La contrasenya va en un fitxer de configuració de curl (0600), no a la línia d'ordres: no surt a `ps`.
  chmod 600 "$config"
  pass_escapada=$(printf '%s' "$pass" | sed 's/[\\"]/\\&/g')
  printf 'user = "%s:%s"\n' "$from" "$pass_escapada" > "$config"
  for rcpt in $(printf '%s' "$to" | tr ',' ' '); do
    printf 'mail-rcpt = "%s"\n' "$rcpt" >> "$config"
  done

  curl -sS --ssl-reqd --crlf --connect-timeout 10 --max-time 30 -K "$config" \
    --url "$url" --mail-from "$from" --upload-file "$missatge" || {
    echo "$(date '+%Y-%m-%dT%H:%M:%S%z') AVÍS: no s'ha pogut enviar el correu"
    return 1
  }
}

ordre=${1:-}
case "$ordre" in
  fallada)
    [ $# -eq 6 ] || { echo "ús: $0 fallada <env-file> <fitxer-estat> <clau> <assumpte> <fitxer-cos>" >&2; exit 2; }
    ENV_FILE=$2; ESTAT=$3; CLAU=$4
    [ "$(cat "$ESTAT" 2>/dev/null)" = "$CLAU" ] && exit 0
    if envia "$5" "$6"; then
      echo "$CLAU" > "$ESTAT"
      echo "$(date '+%Y-%m-%dT%H:%M:%S%z') avís de fallada enviat"
    fi
    ;;
  recuperat)
    [ $# -eq 5 ] || { echo "ús: $0 recuperat <env-file> <fitxer-estat> <assumpte> <fitxer-cos>" >&2; exit 2; }
    ENV_FILE=$2; ESTAT=$3
    [ -f "$ESTAT" ] || exit 0
    if envia "$4" "$5"; then
      rm -f "$ESTAT"
      echo "$(date '+%Y-%m-%dT%H:%M:%S%z') avís de recuperació enviat"
    fi
    ;;
  *)
    echo "ús: $0 fallada|recuperat …" >&2
    exit 2
    ;;
esac
exit 0
