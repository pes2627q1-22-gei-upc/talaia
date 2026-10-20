# Desplegament a la VM (TG-71)

L'API es desplega a la VM de la FIB amb Docker Compose. Nginx hi fa d'únic punt d'entrada amb HTTPS de Let's Encrypt. Cada canvi a `stable` (una release o un hotfix) es desplega sol en menys de 5 minuts: un cron de la VM ho comprova i fa el deploy. Decisions: [ADR-0006](decisions/0006-infra-vm-docker.md), [ADR-0019](decisions/0019-allotjament-i-desplegament.md) i [ADR-0021](decisions/0021-deploy-per-pull-des-de-la-vm.md).

```
App / Aprop / Mobilicat
        │ https://<PUBLIC_HOST>:<40000+XXX·10>/api/v1
        ▼
nattech.fib.upc.edu ──(NAT)──▶ VM :8080
                                  │
                ┌─────────────── Docker Compose (deploy/compose.yaml) ──────────────┐
                │  nginx :8080 (TLS) ──▶ api :3000           worker (node-cron)      │
                │       ▲ certs (volum)                                              │
                │  acme (acme.sh): emet i renova el certificat amb DNS-01 de DuckDNS │
                └────────────────────────────────────────────────────────────────────┘
                                  ▲ docker compose up --build
   GitHub ◀── git fetch de stable cada 5 min ── cron (deploy/scripts/desplega.sh)
```

| Fitxer | Què fa |
|---|---|
| `deploy/compose.yaml` | Serveis `api`, `worker`, `acme` i `nginx` |
| `deploy/nginx/templates/default.conf.template` | HTTPS al 8080, `/api/v1/` cap a l'API, capçaleres de seguretat |
| `deploy/scripts/emet-certificat.sh` | Primera emissió del certificat (un sol cop per VM) |
| `services/api/Dockerfile`, `services/worker/Dockerfile` | Imatges multi-stage, `node:22-alpine`, usuari sense privilegis |
| `deploy/scripts/desplega.sh` | Deploy de `stable`: l'executa el cron de la VM cada 5 minuts |
| `.github/workflows/deploy-check.yml` | A cada PR que toca el desplegament: construeix les imatges i arrenca el compose |

## Ports

La VM no té ports 80 ni 443. La FIB en redirigeix 10: `nattech.fib.upc.edu:40000+XXX·10` … `+9` cap als ports 8080–8089 de la VM. `XXX` és l'últim octet de la IP de la VM (`172.16.4.XXX`); ho diu `/etc/update-motd.d/99-info-nat` en entrar-hi.

| Port VM | Port públic | Ús |
|---|---|---|
| 8080 | `40000 + XXX·10` | Nginx (HTTPS) |
| 8081–8089 | `+1` … `+9` | Lliures: no es publiquen fins que es facin servir |

**VM actual:** IP `172.16.4.50`, de manera que `nattech.fib.upc.edu:40500` va al 8080. El nom públic és `talaia-pes.duckdns.org` (A → `147.83.148.217`, la IP de `nattech`).

La URL pública de l'API és, per tant, `https://<PUBLIC_HOST>:<40000+XXX·10>/api/v1`. És el valor d'`API_PUBLIC_URL` i el que han de fer servir l'app i els equips Aprop i Mobilicat.

## Muntar la VM de zero

La VM s'esborra a final de quadrimestre i no té còpia de seguretat. Tot el que cal és en aquesta guia i al repo; les dades són a Supabase.

### 1. Docker

La VM és **Ubuntu 20.04** (ADR-0019): la plantilla de la 24.04 ocupa 30 GB i supera la quota de 24 GB. A la 20.04, l'script `get.docker.com` falla perquè intenta instal·lar `docker-model-plugin`, que no existeix per a focal (i, com que `apt` no instal·la res si un paquet falla, Docker no queda instal·lat). Cal fer-ho amb `apt` des del repositori de Docker:

```bash
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin docker-buildx-plugin
sudo usermod -aG docker "$USER"   # torna a entrar perquè s'apliqui
docker --version && docker compose version
```

Per a focal, les últimes versions publicades són **Docker 28.1.1 i Compose 2.35.1**, i ja no n'hi haurà més. Compose 2.35 admet tot el que fa servir `deploy/compose.yaml` (`--wait`, `profiles`, `${VAR:?}`). En una plantilla suportada (22.04, 24.04) n'hi ha prou amb `curl -fsSL https://get.docker.com | sudo sh`.

Les actualitzacions de seguretat del sistema de la 20.04 es poden recuperar amb l'Ubuntu Pro gratuït (`sudo pro attach <token>`, amb un compte d'Ubuntu One): ESM fins al 2030. Docker no hi entra: continua congelat.

### 2. DuckDNS

1. Entra a [duckdns.org](https://www.duckdns.org) amb el compte de l'equip (`talaia.pes@gmail.com`, P20) i crea el subdomini (p. ex. `talaia`).
2. Posa-hi com a IP la de `nattech.fib.upc.edu` (`dig +short nattech.fib.upc.edu`).
3. Copia el token del compte: va a `DUCKDNS_TOKEN`.

### 3. Repositori i fitxer d'entorn

```bash
cd ~ && git clone https://github.com/pes2627q1-22-gei-upc/talaia.git && cd talaia && git switch stable   # o snapshot, mentre stable no tingui deploy/
sudo mkdir -p /opt/talaia && sudo chown "$USER": /opt/talaia && sudo chmod 700 /opt/talaia
(umask 077 && cp ~/talaia/.env.example /opt/talaia/.env)
```

Omple com a mínim `PUBLIC_HOST`, `PUBLIC_PORT` (`40000+XXX·10`), `ACME_EMAIL`, `DUCKDNS_TOKEN`, `DATABASE_URL` i `API_PUBLIC_URL`. Els valors reals són al gestor de contrasenyes de l'equip (P20), mai al repo ni al xat.

Compte: Docker Compose llegeix un comentari al final d'una línia buida (`VAR=   # …`) com si fos el valor. Posa els comentaris a la línia de sobre.

Quatre condicions per a `DATABASE_URL`. Si no es compleixen, l'API arrenca però `/punts` respon 503 (amb una URL mal formada, el log diu `getaddrinfo ENOTFOUND`):

- Fes servir la cadena del **Session pooler** (Supabase → **Connect**), amb l'usuari `postgres.<ref>`. El host directe `db.<ref>.supabase.co` només té IPv6 i la VM no hi arriba.
- La contrasenya és la **de la base de dades** (Supabase → **Project Settings → Database**), no la del compte de Supabase ni la de cap altre servei.
- Ha d'anar **percent-encoded**: `/` → `%2F`, `#` → `%23`, `?` → `%3F`, `@` → `%40`, `%` → `%25`. Sense codificar, un d'aquests caràcters talla la URL i el client pren l'usuari per host. Compose expandeix els `$` del `--env-file`: escriu-los `$$`, o posa tot el valor entre cometes simples (`DATABASE_URL='postgresql://…'`), on Compose no expandeix res.
- Acaba en `…/postgres?sslmode=no-verify`, **sense barra abans del `?`** (`/postgres/?` busca una base de dades amb un nom que no existeix).

### 4. Primera arrencada i certificat

```bash
cd ~/talaia
docker compose -f deploy/compose.yaml --env-file /opt/talaia/.env up -d --build --wait
deploy/scripts/emet-certificat.sh /opt/talaia/.env
```

Mentre no hi ha certificat, el contenidor `acme` en genera un d'autosignat perquè Nginx arrenqui. L'script emet el de Let's Encrypt amb el repte DNS-01 (triga un minut per la propagació del TXT), l'instal·la al volum `certs` i recarrega Nginx. Després, acme.sh el renova sol i Nginx el torna a llegir cada 6 hores.

Comprovació des de fora de la VM:

```bash
curl -fsS https://<PUBLIC_HOST>:<PUBLIC_PORT>/api/v1/health
```

### 5. Deploy automàtic (cron)

Un cron de l'usuari executa `deploy/scripts/desplega.sh` cada 5 minuts. Si `origin/stable` no és l'últim commit que s'ha desplegat bé (`.git/talaia-desplegat`), fa `git reset --hard origin/stable`, refà i arrenca el compose i comprova el healthcheck per HTTPS. Si no ha canviat, no fa res.

```bash
(crontab -l 2>/dev/null; echo '*/5 * * * * $HOME/talaia/deploy/scripts/desplega.sh /opt/talaia/.env >> $HOME/talaia-deploy.log 2>&1') | crontab -
crontab -l   # comprova-ho
```

**Mentre `stable` no tingui `deploy/`** (fins a `release/0.1.0`, ADR-0009), la línia es deixa comentada (`#*/5 …`): el primer `git reset --hard origin/stable` esborraria `deploy/` del checkout, script inclòs, i el log s'ompliria d'`ERROR`. Fins llavors, la VM corre el que s'hi ha arrencat a mà (des de `snapshot`). Quan `stable` tingui `deploy/`, es descomenta amb `crontab -e`.

L'script agafa un `flock` (`.git/talaia-deploy.lock`): si un build triga més de 5 minuts o se n'engega un a mà, el segon surt sense fer res. El `git fetch` té un límit d'1 minut i el `docker compose` de 20, perquè un procés penjat no bloquegi els següents. El cron torna a funcionar sol després d'un reinici de la VM. **No editis res a `~/talaia`:** el deploy fa `git reset --hard` i ho perdria.

### 6. Proteccions del repositori

GitHub no executa res a la VM: la VM només baixa `stable`, i una PR (d'un fork o de l'equip) no hi pot arribar. El que protegeix el deploy és el ruleset de `stable`: PR, aprovació i CI obligatòries ([git-workflow.md](git-workflow.md)). A més, a **Settings → Actions → General → Fork pull request workflows** hi ha «Require approval for all external contributors», perquè la CI d'una PR externa no s'executi sense que algú de l'equip la miri.

## Com es desplega

1. Una `release/0.N.0` o un `hotfix/0.N.x` es fusiona a `stable` ([git-workflow.md](git-workflow.md)).
2. En menys de 5 minuts, el cron de la VM executa `desplega.sh`: `git reset --hard origin/stable`, `docker compose up -d --build --remove-orphans --wait`, un healthcheck amb `curl --resolve <PUBLIC_HOST>:8080:127.0.0.1`, que valida el certificat real contra el Nginx local, i `docker image prune`.
3. Cada deploy queda a `~/talaia-deploy.log`. Si falla, el log acaba amb `ERROR` i el cron el torna a provar a cada passada fins que surti bé: una fallada de xarxa o de Docker Hub es resol sola, i un commit trencat deixa un `ERROR` cada 5 minuts fins que arribi el hotfix a `stable`. No hi ha rollback automàtic: si el contenidor nou no passa el healthcheck, ja ha substituït l'anterior.

A mà, a la VM, torna a desplegar el commit actual: `FORCE=1 ~/talaia/deploy/scripts/desplega.sh`.

## El worker

El worker (`services/worker/dist/main.js`) és un procés llarg que recalcula l'índex de tots els punts en arrencar i cada hora al minut 5 (UTC), amb node-cron ([ADR-0024](decisions/0024-planificacio-worker-node-cron.md)). Necessita `DATABASE_URL`, la mateixa que l'API. Cada execució queda a la taula `execucions_worker`, i l'API en fa servir l'última que ha desat algun punt per regenerar el document del mapa. Un recàlcul que falla no atura el procés: es torna a provar a l'hora següent. En aturar-lo, Docker li dona 75 s (`stop_grace_period`) per acabar el lot en curs.

```bash
tc logs -f worker            # «índex de 32 punts (… hores) en … s» a cada hora
```

## Ordres útils a la VM

```bash
alias tc='docker compose -f ~/talaia/deploy/compose.yaml --env-file /opt/talaia/.env'
tail -f ~/talaia-deploy.log  # deploys
tc ps                        # estat i healthchecks
tc logs -f api               # logs de l'API
tc exec acme acme.sh --list  # certificats i data de renovació
tc restart nginx
```

En local, el mateix compose arrenca amb `.env.example` i un certificat autosignat (és el que fa `deploy-check.yml`):

```bash
docker compose -f deploy/compose.yaml --env-file .env.example up -d --build --wait
curl -k --resolve talaia.duckdns.org:8080:127.0.0.1 https://talaia.duckdns.org:8080/api/v1/health
```
