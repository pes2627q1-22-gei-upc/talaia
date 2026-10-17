# Desplegament a la VM (TG-71)

L'API es desplega a la VM de la FIB amb Docker Compose. Nginx hi fa d'únic punt d'entrada amb HTTPS de Let's Encrypt. Cada push a `stable` (una release o un hotfix) es desplega sol. Decisions: [ADR-0006](decisions/0006-infra-vm-docker.md) i [ADR-0019](decisions/0019-allotjament-i-desplegament.md).

```
App / Aprop / Mobilicat
        │ https://<PUBLIC_HOST>:<40000+XXX·10>/api/v1
        ▼
nattech.fib.upc.edu ──(NAT)──▶ VM :8080
                                  │
                ┌─────────────── Docker Compose (deploy/compose.yaml) ──────────────┐
                │  nginx :8080 (TLS) ──▶ api :3000           worker (profile worker) │
                │       ▲ certs (volum)                                              │
                │  acme (acme.sh): emet i renova el certificat amb DNS-01 de DuckDNS │
                └────────────────────────────────────────────────────────────────────┘
                                  ▲
   GitHub ◀── connexió de sortida ── runner self-hosted (talaia-vm) ── deploy.yml
```

| Fitxer | Què fa |
|---|---|
| `deploy/compose.yaml` | Serveis `api`, `worker` (amb `profiles: [worker]`), `acme` i `nginx` |
| `deploy/nginx/templates/default.conf.template` | HTTPS al 8080, `/api/v1/` cap a l'API, capçaleres de seguretat |
| `deploy/scripts/emet-certificat.sh` | Primera emissió del certificat (un sol cop per VM) |
| `services/api/Dockerfile`, `services/worker/Dockerfile` | Imatges multi-stage, `node:22-alpine`, usuari sense privilegis |
| `.github/workflows/deploy.yml` | Deploy de `stable` al runner de la VM |
| `.github/workflows/deploy-check.yml` | A cada PR que toca el desplegament: construeix les imatges i arrenca el compose |

## Ports

La VM no té ports 80 ni 443. La FIB en redirigeix 10: `nattech.fib.upc.edu:40000+XXX·10` … `+9` cap als ports 8080–8089 de la VM. `XXX` és l'últim octet de la IP de la VM (`172.16.4.XXX`); ho diu `/etc/update-motd.d/99-info-nat` en entrar-hi.

| Port VM | Port públic | Ús |
|---|---|---|
| 8080 | `40000 + XXX·10` | Nginx (HTTPS) |
| 8081–8089 | `+1` … `+9` | Lliures: no es publiquen fins que es facin servir |

La URL pública de l'API és, per tant, `https://<PUBLIC_HOST>:<40000+XXX·10>/api/v1`. És el valor d'`API_PUBLIC_URL` i el que han de fer servir l'app i els equips Aprop i Mobilicat.

## Muntar la VM de zero

La VM s'esborra a final de quadrimestre i no té còpia de seguretat. Tot el que cal és en aquesta guia i al repo; les dades són a Supabase.

### 1. Docker

```bash
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker "$USER"   # torna a entrar perquè s'apliqui
docker compose version
```

### 2. DuckDNS

1. Entra a [duckdns.org](https://www.duckdns.org) amb el compte de l'equip (`talaia.pes@gmail.com`, P20) i crea el subdomini (p. ex. `talaia`).
2. Posa-hi com a IP la de `nattech.fib.upc.edu` (`dig +short nattech.fib.upc.edu`).
3. Copia el token del compte: va a `DUCKDNS_TOKEN`.

### 3. Fitxer d'entorn

```bash
sudo mkdir -p /opt/talaia
sudo cp .env.example /opt/talaia/.env        # des d'un checkout del repo
sudo chown "$USER" /opt/talaia/.env && chmod 600 /opt/talaia/.env
```

Omple com a mínim `PUBLIC_HOST`, `PUBLIC_PORT` (`40000+XXX·10`), `ACME_EMAIL`, `DUCKDNS_TOKEN`, `DATABASE_URL` i `API_PUBLIC_URL`. Els valors reals són al gestor de contrasenyes de l'equip (P20), mai al repo ni al xat.

Compte: Docker Compose llegeix un comentari al final d'una línia buida (`VAR=   # …`) com si fos el valor. Posa els comentaris a la línia de sobre.

### 4. Primera arrencada i certificat

```bash
git clone https://github.com/pes2627q1-22-gei-upc/talaia.git && cd talaia && git switch stable
docker compose -f deploy/compose.yaml --env-file /opt/talaia/.env up -d --build --wait
deploy/scripts/emet-certificat.sh /opt/talaia/.env
```

Mentre no hi ha certificat, el contenidor `acme` en genera un d'autosignat perquè Nginx arrenqui. L'script emet el de Let's Encrypt amb el repte DNS-01 (triga un minut per la propagació del TXT), l'instal·la al volum `certs` i recarrega Nginx. Després, acme.sh el renova sol i Nginx el torna a llegir cada 6 hores.

Comprovació des de fora de la VM:

```bash
curl -fsS https://<PUBLIC_HOST>:<PUBLIC_PORT>/api/v1/health
```

### 5. Runner self-hosted

L'ha de registrar algú amb permisos d'administració de l'organització (Joan o el professor):

1. **Organització → Settings → Actions → Runner groups:** crea el grup `talaia-vm`, dona-hi accés només al repositori `talaia` i, a «Workflow access», limita'l a `pes2627q1-22-gei-upc/talaia/.github/workflows/deploy.yml@refs/heads/stable`. L'organització és GitHub Team i ho permet.
2. **Organització → Settings → Actions → Runners → New runner** (Linux x64), al grup `talaia-vm`, i segueix les ordres que dona GitHub a la VM. A `config.sh`, afegeix l'etiqueta `talaia-vm`.
3. Instal·la'l com a servei perquè sobrevisqui als reinicis:

   ```bash
   sudo ./svc.sh install "$USER" && sudo ./svc.sh start
   ```

L'usuari del runner és al grup `docker`, és a dir, té control total de la VM. Per això els controls de sota són obligatoris.

### 6. Proteccions del repositori

El repositori és públic: una PR des d'un fork podria canviar un workflow perquè s'executi al runner de la VM. A més del runner group:

- **Settings → Actions → General → Fork pull request workflows:** «Require approval for all outside collaborators».
- **Settings → Environments → `production`:** «Deployment branches and tags» → *Selected branches* → només `stable`.
- `deploy.yml` només s'activa amb push a `stable` (o a mà des de `stable`), mai per PR.

## Com es desplega

1. Una `release/0.N.0` o un `hotfix/0.N.x` es fusiona a `stable` ([git-workflow.md](git-workflow.md)).
2. `deploy.yml` s'executa a la VM: checkout, `docker compose up -d --build --remove-orphans --wait` i un healthcheck amb `curl --resolve <PUBLIC_HOST>:8080:127.0.0.1`, que valida el certificat real contra el Nginx local.
3. Si el healthcheck falla, el job falla i es veu a Actions. Per tornar enrere: un hotfix a `stable` o, des d'Actions, «Re-run» del deploy d'un commit anterior.

També es pot llançar a mà des d'Actions → Deploy → «Run workflow» sobre `stable`.

## El worker

El worker té imatge però **no arrenca**: el procés llarg i el seu horari són de TG-99, que depèn de P9. Quan TG-99 estigui feta (punt d'entrada `services/worker/dist/main.js`), s'activa afegint `--profile worker` a les ordres de `docker compose` del `deploy.yml` i d'aquesta guia.

## Ordres útils a la VM

```bash
alias tc='docker compose -f ~/talaia/deploy/compose.yaml --env-file /opt/talaia/.env'
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
