# ADR-0019: VM de la FIB, HTTPS amb DuckDNS i deploy amb un runner self-hosted

**Estat:** Acceptada; el deploy i la seguretat del runner els substitueix l'[ADR-0021](0021-deploy-per-pull-des-de-la-vm.md) · **Data:** 2026-10-16 · Resol les decisions pendents P16 i P17 · TG-71 · Concreta [ADR-0006](0006-infra-vm-docker.md)

## Context

ADR-0006 fixa una VM Ubuntu amb Docker Compose, Nginx com a únic punt d'entrada i HTTPS amb Let's Encrypt, desplegada des de `stable`. Faltava decidir on viu la VM (P16), amb quin nom públic (P17) i com arriba el codi de `stable` a la VM.

La FIB ofereix a l'equip una VM de plantilla sense VPN. Només té **10 ports públics**: `nattech.fib.upc.edu:40000+XXX·10` … `+9`, que apunten als ports 8080–8089 de la VM (`XXX` és l'últim octet de la IP `172.16.4.XXX`). No hi ha ports 80 ni 443, el nom `nattech.fib.upc.edu` no és nostre i la VM no té còpia de seguretat: s'esborra a final de quadrimestre.

## Decisió

- **Allotjament (P16): la VM de la FIB.** Cost zero. Tota la configuració és al repo (`deploy/`) i les dades a Supabase, de manera que la VM es pot refer de zero amb [docs/desplegament.md](../desplegament.md).
- **Nom públic (P17): un subdomini de DuckDNS** (`PUBLIC_HOST`, p. ex. `talaia.duckdns.org`) amb un registre A cap a la IP de `nattech.fib.upc.edu`. La URL de l'API és `https://<PUBLIC_HOST>:<40000+XXX·10>/api/v1`.
- **Certificat: Let's Encrypt amb el repte DNS-01** (sense port 80 no hi ha repte HTTP-01). El contenidor `acme` (acme.sh) l'emet i el renova amb el token de DuckDNS, i Nginx el torna a llegir cada 6 hores.
- **Nginx escolta HTTPS al 8080**, l'únic port publicat. L'API i el worker no tenen cap port fora de la xarxa de Docker. La resta de ports (8081–8089) no es publiquen fins que es facin servir.
- **Deploy: runner self-hosted de GitHub Actions a la mateixa VM** (etiqueta `talaia-vm`). El runner obre una connexió de sortida cap a GitHub i no cal obrir cap port. `deploy.yml` s'activa amb push a `stable`: fa checkout, `docker compose up -d --build --wait` i un healthcheck HTTPS amb `curl --resolve`. Les imatges es construeixen a la VM, sense registre.
- **Secrets a `/opt/talaia/.env` a la VM**, fora del repo i del workspace del runner (`--env-file`). Cada servei del compose rep només les variables que necessita.
- **Seguretat del runner amb repo públic.** Una PR des d'un fork podria canviar un workflow perquè s'executi a `self-hosted`. Per evitar-ho, `deploy.yml` mai s'activa per PR i, a més:
  - Fork pull request workflows → «Require approval for all outside collaborators».
  - L'environment `production` només accepta desplegaments des de `stable`.
  - L'organització és GitHub Team: el runner va en un runner group restringit al workflow `deploy.yml` de `talaia`.

## Alternatives descartades

- **Azure for Students / VPS de pagament:** més llibertat de ports, però cost o caducitat dels crèdits, i la FIB ja dona la VM.
- **Domini propi + DNS-01:** millor URL, però cal pagar-lo. Es pot fer més endavant (P21, correu amb Resend, el necessitarà) canviant `PUBLIC_HOST` sense tocar el disseny.
- **Cloudflare Tunnel:** HTTPS i nom net sense ports, però cal un domini a Cloudflare i afegeix un proveïdor al camí de cada petició.
- **Deploy per SSH des d'un runner de GitHub:** cal exposar SSH a internet i guardar-ne la clau a GitHub; la VM només té ports 8080–8089.
- **Imatges a GHCR i `pull` a la VM:** estalvia CPU a la VM, però afegeix un registre i un segon job. Es pot adoptar si la VM va justa.

## Conseqüències

- La URL pública porta port. L'app i els equips Aprop i Mobilicat la llegeixen de configuració (`API_PUBLIC_URL`), no del codi.
- Si la VM s'esborra, es refà amb la guia; el certificat es torna a emetre amb `deploy/scripts/emet-certificat.sh`.
- El worker té imatge però no arrenca fins a TG-99 (P9): és al compose amb `profiles: [worker]`.
