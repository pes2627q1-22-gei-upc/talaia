# ADR-0021: Deploy de `stable` per pull des de la VM, sense runner

**Estat:** Acceptada · **Data:** 2026-10-16 · TG-71 · Substitueix el deploy i la seguretat del runner de l'[ADR-0019](0019-allotjament-i-desplegament.md)

## Context

L'ADR-0019 desplegava `stable` amb un runner self-hosted de GitHub Actions a la VM. El repo és públic i GitHub recomana no fer servir runners self-hosted en repos públics: qualsevol workflow que s'executi al repo (d'una PR d'un fork aprovada per error o d'una branca de l'equip) pot demanar `runs-on: self-hosted` i córrer a la VM, amb accés a Docker i a `/opt/talaia/.env`.

Limitar el runner al workflow de deploy demanava un *runner group* de l'organització, i això no és a les nostres mans:

- Registrar un runner d'organització i crear grups només ho pot fer un owner (el professor). L'admin del repo només pot registrar runners de repo, que no poden anar en cap grup.
- La restricció d'un grup a workflows concrets («Workflow access») només surt a la documentació de GitHub Enterprise Cloud, no a la del pla Team de l'organització.

## Decisió

- **La VM fa pull.** Un cron de l'usuari executa `deploy/scripts/desplega.sh` cada 5 minuts, amb `flock`. Si `origin/stable` ha canviat, fa `git reset --hard origin/stable`, `docker compose up -d --build --remove-orphans --wait`, el healthcheck HTTPS amb `curl --resolve` i `docker image prune`. Si no ha canviat, no fa res.
- **S'esborra `deploy.yml`.** `deploy-check.yml` es queda: s'executa a runners de GitHub i no toca la VM.
- La resta de l'ADR-0019 (VM de la FIB, DuckDNS, DNS-01, Nginx al 8080, secrets a `/opt/talaia/.env`) no canvia.

## Alternatives descartades

- **Runner de repo amb les proteccions del repo** (aprovació de workflows de forks, environment `production` només per a `stable`): l'environment només s'aplica als jobs que el declaren, i un workflow aprovat per error continua arribant a la VM.
- **Runner en un runner group de l'organització:** depèn del professor per crear el grup i registrar el runner, i el filtre per workflow pot no existir al pla Team.
- **Webhook de GitHub cap a la VM:** cal publicar un port més i validar-ne la signatura. El cron fa el mateix amb, com a molt, 5 minuts de retard.

## Conseqüències

- GitHub no executa res a la VM. Només hi arriba el que s'ha fusionat a `stable` per PR, amb revisió i CI.
- Un deploy comença, com a molt, 5 minuts després del merge a `stable`.
- El resultat no surt a GitHub Actions: és a `~/talaia-deploy.log` de la VM. Un deploy que falla no es reintenta sol; es corregeix amb un hotfix a `stable` o, a la VM, amb `FORCE=1 deploy/scripts/desplega.sh`.
