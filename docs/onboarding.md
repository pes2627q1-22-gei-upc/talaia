# Guia d'onboarding

Aquesta guia et porta de zero a tenir Talaia funcionant al teu ordinador i a saber entregar una tasca sense preguntar res. Segueix-la en ordre. Cada pas acaba amb una comprovació: si no et surt el que diu, mira [Problemes freqüents](#8-problemes-freqüents).

Temps aproximat: 30 minuts la primera vegada.

## Índex

1. [Què necessites](#1-què-necessites)
2. [Clona el repo i instal·la](#2-clona-el-repo-i-installa)
3. [Els fitxers `.env`](#3-els-fitxers-env)
4. [Engega l'API i l'app](#4-engega-lapi-i-lapp)
5. [Supabase: base de dades i migracions](#5-supabase-base-de-dades-i-migracions)
6. [Com es fa una tasca, de principi a fi](#6-com-es-fa-una-tasca-de-principi-a-fi)
7. [Si fas servir Claude Code](#7-si-fas-servir-claude-code)
8. [Problemes freqüents](#8-problemes-freqüents)
9. [Guió del kick-off tècnic (09/10)](#9-guió-del-kick-off-tècnic-0910)

---

## 1. Què necessites

### Programes

| Programa | Per a què | macOS | Windows | Linux |
|---|---|---|---|---|
| **Git** | El codi | Ve amb les eines de Xcode (`xcode-select --install`) | [Git for Windows](https://git-scm.com/download/win) (inclou Git Bash, que fan servir els hooks) | `sudo apt install git` (o el gestor de la teva distribució) |
| **Node 22** amb un gestor de versions | Tot el projecte; la versió és a `.nvmrc` | [nvm](https://github.com/nvm-sh/nvm#installing-and-updating) | [nvm-windows](https://github.com/coreybutler/nvm-windows/releases) | [nvm](https://github.com/nvm-sh/nvm#installing-and-updating) |
| **Expo Go** al mòbil | Provar l'app al teu mòbil | App Store / Google Play | App Store / Google Play | App Store / Google Play |
| **Supabase CLI** | Migracions de la base de dades | No cal instal·lar-lo: `npx supabase …` el baixa sol | Ídem | Ídem |
| VS Code (recomanat) | Editor | En obrir el repo et proposarà les extensions de l'equip (ESLint, Prettier, EditorConfig, Expo) | Ídem | Ídem |

Opcionals:

- **Simulador d'iOS**: només a Mac, amb Xcode.
- **Emulador d'Android**: [Android Studio](https://developer.android.com/studio) a qualsevol sistema. Si no tens Mac, és la manera de provar l'app a l'ordinador.
- **Docker**: només si vols una base de dades local amb `supabase start`. Per al dia a dia no cal.

> **Windows, abans de clonar:** fes `git config --global core.autocrlf input`. Sense això, Git et converteix els salts de línia a format Windows i `npm run format:check` es queixa de tots els fitxers.

### Accessos

Demana'ls a l'sprint master si et falta algun:

- **GitHub**: membre de l'organització `pes2627q1-22-gei-upc` amb permís d'escriptura al repo `talaia`.
- **Taiga**: membre del projecte.
- **Supabase** (només si fas backend): membre de l'organització de Talaia (el propietari és `talaia.pes@gmail.com`).
- **Expo**: membre de l'organització de l'equip (per als builds d'EAS quan es publiqui l'app).
- **Figma**: els mockups, per a qui faci pantalles.

---

## 2. Clona el repo i instal·la

```bash
git clone https://github.com/pes2627q1-22-gei-upc/talaia.git
cd talaia
nvm use          # Windows (nvm-windows): primer `nvm install 22` i després `nvm use 22`
npm install
```

> **Windows:** fes servir **Git Bash** (ve amb Git for Windows) o PowerShell 7 per a les ordres d'aquesta guia. El PowerShell antic de Windows no entén `&&`.

`npm install` instal·la totes les parts del projecte (app, API i `packages/shared`) i, de passada, activa els **hooks de Git** (husky): a partir d'ara, cada commit es revisa sol (més detalls a la [secció 6](#6-com-es-fa-una-tasca-de-principi-a-fi)).

**Comprovació:**

```bash
node -v                                            # v22.x
npm run lint && npm run typecheck && npm test
```

Ha de passar tot (uns 15 segons). El lint pot mostrar **1 avís** a `core/i18n/index.ts`: és conegut i no és cap error.

---

## 3. Els fitxers `.env`

Els secrets **mai** van al repo (és públic). Hi ha dos fitxers, i tots dos ja són al `.gitignore`:

| Fitxer | Qui el llegeix | Plantilla |
|---|---|---|
| `talaia/.env` (arrel) | L'API, el worker i el CLI de Supabase | [`.env.example`](../.env.example) |
| `talaia/apps/mobile/.env` | L'app (Expo **només** llegeix aquest) | [`apps/mobile/.env.example`](../apps/mobile/.env.example) |

**D'on surten els valors:** l'sprint master us passa un enllaç segur, que caduca, amb els dos fitxers sencers (més endavant, un gestor de contrasenyes). Desa'ls on diu la taula, tal qual. **No els reenviïs per WhatsApp ni els enganxis enlloc.**

Si tens accés al projecte de Supabase, els valors també són al panell (vegeu la [secció 5](#5-supabase-base-de-dades-i-migracions)).

Sense `.env` tot arrenca igualment: l'API fa servir el port 3000 i l'app, `http://localhost:3000/api/v1`. El que no funcionarà és res que parli amb Supabase.

> **No deixis mai `EXPO_PUBLIC_API_URL=` buida.** Si la poses, ha de tenir un valor; si no, treu la línia. Una línia buida fa que l'app no pugui construir l'adreça de l'API.

---

## 4. Engega l'API i l'app

Necessites **dos terminals**, tots dos a l'arrel del repo.

### L'API

```bash
npm run api
```

Ha de dir `Talaia API a http://localhost:3000/api/v1`. Si surt `../../.env not found`, és normal si encara no tens el `.env`.

**Comprovació:** obre al navegador

- <http://localhost:3000/api/v1/health> → `{"status":"ok","version":"0.1.0"}`
- <http://localhost:3000/api/v1/docs> → la documentació de l'API (Swagger)

Es recarrega sola quan deses un fitxer. Detalls: [`services/api/README.md`](../services/api/README.md).

### L'app

```bash
npm run mobile
```

S'obre Metro amb un codi QR. Tria on la vols veure:

| On | Com | Adreça de l'API (`EXPO_PUBLIC_API_URL` a `apps/mobile/.env`) |
|---|---|---|
| **El teu mòbil** amb Expo Go | Escaneja el QR (Android: des d'Expo Go; iPhone: amb la càmera). Mòbil i ordinador a la **mateixa wifi** | `http://<IP del teu ordinador>:3000/api/v1`. La IP: macOS `ipconfig getifaddr en0` · Windows `ipconfig` · Linux `hostname -I` |
| Simulador d'iOS (Mac) | Prem `i` | No cal: el valor per defecte (`localhost`) funciona |
| Emulador d'Android | Obre l'emulador i prem `a` | `http://10.0.2.2:3000/api/v1` (és com l'emulador veu el teu ordinador) |

Si canvies el `.env` de l'app, atura Metro (`Ctrl+C`) i torna'l a engegar.

Tota l'app es prova a **Expo Go**, mapa inclòs: el mapa és MapLibre GL JS dins d'una DOM component, no un mòdul natiu ([ADR-0015](decisions/0015-mapa-dom-component.md)). No instal·lis mòduls natius que Expo Go no porti ([ADR-0014](decisions/0014-identificador-app-expo-go.md)).

**Comprovació final:** a la pestanya **Perfil**, la targeta «Estat del servidor» diu **«Connectat · API v0.1.0»** en verd. Si diu «No es pot connectar amb el servidor», l'app no arriba a l'API: mira que l'API estigui engegada i l'adreça de la taula.


---

## 5. Supabase: base de dades i migracions

> **Aquesta secció s'aplica quan es fusioni TG-69** ([PR #12](https://github.com/pes2627q1-22-gei-upc/talaia/pull/12)), que porta `supabase/config.toml` i la primera migració. Fins aleshores, la carpeta `supabase/` no existeix a `snapshot`.

La base de dades és a Supabase (Postgres 17 amb PostGIS, a Irlanda). **L'esquema només canvia amb migracions** versionades a `supabase/migrations/`: res de crear taules ni columnes des del panell web. Un canvi fet al panell no queda al repo, ningú el pot revisar i la resta de l'equip no el tindrà.

### Els valors del `.env`

Si tens accés al projecte (panell de Supabase → projecte **Talaia**):

| Variable | On és |
|---|---|
| `SUPABASE_URL` | *Project Settings → Data API → Project URL* |
| `SUPABASE_ANON_KEY` i `EXPO_PUBLIC_SUPABASE_ANON_KEY` | *Project Settings → API Keys*, la clau `anon` (és pública, pot anar a l'app) |
| `SUPABASE_SERVICE_ROLE_KEY` | *Project Settings → API Keys*, la clau `service_role`. **Secreta: només API i worker, mai a l'app ni en una variable `EXPO_PUBLIC_*`** |
| `DATABASE_URL` | Botó **Connect** → *Session pooler*. Fes servir aquesta (usuari `postgres.<ref>`), no la *Direct connection*: el host directe només té IPv6 i no connecta des de la majoria de xarxes |

### Connectar el CLI (un cop)

```bash
npx supabase login                                      # obre el navegador: entra amb el teu compte
npx supabase link --project-ref jdftndjsqvqcbzkivdgh    # et demana la contrasenya de la base de dades
```

La contrasenya és la de `DATABASE_URL` (l'sprint master te la passa amb els `.env`). El `link` desa la configuració a `supabase/.temp/`, que és al `.gitignore`.

**Comprovació:**

```bash
npx supabase migration list --linked
```

Mostra cada migració amb la columna *Local* i *Remote* iguals.

### Fer un canvi a la base de dades

1. Crea la migració (dins de la branca de la teva tasca):
   ```bash
   npx supabase migration new crea_punts_observacio
   ```
   Crea `supabase/migrations/<data>_crea_punts_observacio.sql`. Escriu-hi l'SQL (taules, índexs, polítiques RLS…). Per a PostGIS, l'extensió ja és activa a l'esquema `extensions`.
2. Commit i PR com qualsevol altre canvi. La migració es revisa a la PR.
3. Abans d'aplicar-la, mira què faria:
   ```bash
   npx supabase db push --dry-run
   ```
4. Aplica-la a la base de dades del projecte:
   ```bash
   npx supabase db push
   ```
   Només hi ha **una** base de dades, la de tot l'equip: **aplica-la quan la PR ja sigui a `snapshot`**, i avisa al grup.

Una migració aplicada **no es modifica mai**: si t'has equivocat, en fas una de nova que ho corregeixi.

El codi de l'API i del worker hi accedeix amb Kysely des del paquet `@talaia/db`, i els tipus es generen de la base de dades local (`npx supabase start`, cal Docker). Detalls i ordres: [ADR-0013](decisions/0013-acces-bd-kysely.md).

---

## 6. Com es fa una tasca, de principi a fi

Regles completes: [`git-workflow.md`](git-workflow.md). Aquí, el camí pràctic.

### 1. Agafa-la a Taiga

Obre la teva tasca al [taulell de Taiga](https://tree.taiga.io/project/mohamed-dari-pes_22_c_talaia), passa-la a **«En curso»** i mira'n la *Data d'inici*, la data límit i les hores estimades. Els criteris d'acceptació de la història són a [`sprint-1.md`](sprint-1.md).

### 2. Crea la branca des de `snapshot`

```bash
git switch snapshot
git pull
git switch -c feature/TG-88-endpoint-punts       # feature/TG-<ref>-descripcio-curta
```

Totes les branques de feina són `feature/…` (res de `fix/` ni `docs/`).

### 3. Fes commits petits amb el format de l'equip

```
<tipus>(<àmbit>): <descripció en minúscula, sense punt final>

<cos opcional: el perquè>

Refs: TG-<ref>
```

- **Tipus:** `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`.
- **Àmbit** (opcional): `mobile`, `admin`, `api`, `worker`, `shared`, `data`, `infra`, `deps`.
- **Capçalera de 72 caràcters com a màxim.** El peu **`Refs: TG-<ref>`** és obligatori (l'assignatura ho avalua).

La manera més fàcil de fer-ho bé des del terminal:

```bash
git commit -m "feat(api): afegeix GET /punts amb filtre per bbox" -m "Refs: TG-88"
```

Exemples que el hook **accepta**:

```
feat(api): afegeix GET /punts amb filtre per bbox

Refs: TG-88
```

```
test(api): cobreix ETag i 304 de /punts

Refs: TG-88, TG-91
```

Exemples que el hook **rebutja** (el commit no es crea):

| Missatge | Error que veuràs |
|---|---|
| `arreglat el mapa` | `type may not be empty` · `subject may not be empty` · `falta el peu "Refs: TG-<ref>"` |
| `feat(api): afegeix GET /punts amb filtre per bbox` (sense peu) | `falta el peu "Refs: TG-<ref>"` |
| `Feat(api): Afegeix GET /punts` | `type must be lower-case` · `subject must not be sentence-case` |
| `fix(mobile): centra el mapa a Android.` | `subject may not end with full stop` |
| `feat(api): …` amb `Refs: #88` | `falta el peu "Refs: TG-<ref>"` |
| Una capçalera de més de 72 caràcters | `header must not be longer than 72 characters` |

A més, abans de cada commit es formaten sols (Prettier) i es revisen (ESLint) els fitxers que hi entren. Si ESLint troba un error, el commit s'atura i et diu on.

### 4. Obre la PR cap a `snapshot`

```bash
git fetch origin && git merge origin/snapshot      # posa la branca al dia
npm run lint && npm run typecheck && npm test      # el mateix que farà la CI
git push -u origin HEAD
```

A GitHub, obre la PR cap a **`snapshot`**:

- **Títol** en format de commit (és el missatge del merge): `feat(api): afegeix GET /punts amb filtre per bbox`.
- **Descripció**: s'omple amb la plantilla. Explica què canvia i com provar-ho, i marca només les caselles que es compleixin.
- **Revisor**:
  - Backend (API, worker, base de dades): **Mohamed** (és la seva tasca TG-78).
  - La resta: qualsevol company amb permís d'escriptura.
  - Ningú aprova la seva pròpia PR.

### 5. CI en verd i 1 aprovació

La CI ([`ci.md`](ci.md)) passa `lint`, `typecheck` i `tests` a cada PR. **No es fusiona res que no tingui els tres en verd.** GitHub exigeix una aprovació i que totes les converses de la revisió estiguin resoltes. Si el revisor demana canvis, fes commits nous a la mateixa branca: la CI torna a passar sola, però l'aprovació es perd i cal tornar-la a demanar.

### 6. Merge commit

Qui fusiona tria **«Create a merge commit»** (squash i rebase no estan permesos). GitHub esborra la branca.

### 7. Tanca la tasca a Taiga

Passa-la a tancada i omple **Hores reals**. Sense hores reals, la tasca no compta.

---

## 7. Si fas servir Claude Code

Obre el repo amb Claude Code i escriu:

```
/tasca TG-88
```

Llegeix el `CLAUDE.md`, la teva tasca a `sprint-1.md` i les decisions pendents; crea la branca; et proposa un pla i espera el teu d'acord abans de programar. La comanda és a `.claude/commands/tasca.md`.

Recorda: **ets responsable de tot el que generi.** Revisa-ho abans de la PR, i si et proposa prendre una decisió que és a `pendents.md`, no l'acceptis sense parlar-ne amb l'equip.

---

## 8. Problemes freqüents

**El commit es rebutja (`husky - commit-msg script failed`).**
El missatge no compleix el format: llegeix les línies amb `✖`, que diuen exactament què falla (taula de la [secció 6](#3-fes-commits-petits-amb-el-format-de-lequip)). El commit no s'ha creat: torna a fer `git commit` amb el missatge bo. Si el que falla és ESLint (`✖ eslint --fix`), corregeix l'error que indica i torna-ho a provar.

**Els commits no es revisen (o la CI et diu que el format és incorrecte).**
No tens els hooks actius: fes `npm install` a l'arrel. Per arreglar l'últim commit: `git commit --amend -m "…" -m "Refs: TG-<ref>"` i `git push --force-with-lease` (només a la teva branca `feature/…`).

**Versió de Node incorrecta** (errors estranys a `npm install`, als hooks o a l'API).
`node -v` ha de dir `v22.x`. Fes `nvm use` (Windows: `nvm use 22`) en cada terminal nou, o fixa-la per defecte: `nvm alias default 22`.

**Falta el `.env`.**
L'API arrenca igualment (el missatge `../../.env not found` és normal). Si el que no funciona és Supabase, et falta el `.env` de l'arrel. Si l'app no troba l'API al mòbil, et falta `apps/mobile/.env` amb la teva IP. Mira la [secció 3](#3-els-fitxers-env).

**L'app diu «No es pot connectar amb el servidor».**
L'API no està engegada o l'adreça no és la bona: al mòbil cal la IP de l'ordinador (no `localhost`); a l'emulador d'Android, `10.0.2.2`. A la xarxa de la universitat (eduroam), el mòbil i l'ordinador no es veuen entre ells: fes servir la compartició de dades del mòbil.

**El QR no obre l'app a Expo Go a la universitat.**
Mateix motiu (eduroam). Engega Metro amb túnel: `cd apps/mobile && npx expo start --tunnel`. L'app carregarà; l'API, però, només hi arribarà si sou a la mateixa xarxa.

**Expo Go diu que el projecte és d'una altra versió de l'SDK.**
Actualitza Expo Go des de la botiga. El projecte fa servir l'**SDK 57**.

**Coses estranyes a l'app després de canviar de branca.**
Neteja la memòria cau de Metro: `cd apps/mobile && npx expo start -c`.

**`EADDRINUSE: address already in use :::3000`.**
Ja tens l'API engegada en un altre terminal. Tanca'l o canvia el port amb `API_PORT=3001` al `.env`.

**La CI surt en vermell.**
A la PR, clica *Details* al costat del check que falla i mira el pas en vermell. Executa la mateixa ordre en local (`npm run lint`, `npm run typecheck` o `npm test`), corregeix-ho i fes push. Si falla `npm ci`, has afegit una dependència sense pujar el `package-lock.json`.

**`supabase link` no connecta a la base de dades.**
Comprova la contrasenya. Si fas servir `DATABASE_URL` a mà, ha de ser la del *Session pooler* (usuari `postgres.<ref>`): el host directe només té IPv6.

---

## 9. Guió del kick-off tècnic (09/10)

25 minuts. Objectiu: que tothom surti amb el projecte funcionant i sabent entregar.

### 1. On som (3 min)

Fet i a `snapshot`:

- Repo, Gitflow i protecció de branques (TG-65)
- App: Expo SDK 57, Expo Router, MVVM, i18n i el mòdul de referència `features/apiStatus` (TG-66, TG-112)
- ESLint, Prettier, TypeScript strict i hooks de commit (TG-67)
- API: Express, `/health`, errors uniformes i OpenAPI amb zod (TG-68, ADR-0011)
- `packages/shared` amb els tipus de domini (TG-112)
- CI amb lint, typecheck i tests a cada PR (TG-70)
- ADR-0012: els punts del mapa en un sol GeoJSON
- Regles de moviment i fluïdesa al design system

En revisió: Supabase amb PostGIS (TG-69, PR #12).

### 2. Tothom ho arrenca (8 min)

En directe, seccions 2 a 4 d'aquesta guia. Tothom acaba veient **«Connectat»** a la pestanya Perfil. Qui s'encalli, ho mirem al final.

### 3. El flux de treball (6 min)

- Demo d'una tasca de principi a fi (secció 6): branca, un commit rebutjat pel hook i el bo, la PR amb la plantilla.
- Qui revisa què: backend, Mohamed; la resta, qualsevol.
- Secrets: només per l'enllaç segur, mai per WhatsApp.
- **A acordar:** les migracions s'apliquen (`db push`) només quan la PR ja és a `snapshot`, i s'avisa al grup.
- **Acció (Joan):** fer obligatoris els checks de la CI al *ruleset* de GitHub (ara només s'hi exigeix l'aprovació).

### 4. Decisions pendents que bloquegen (5 min)

| # | Decisió | Bloqueja | Proposta |
|---|---|---|---|
| **P5** | Com accedeixen l'API i el worker a la base de dades | Model de punts (TG-86), endpoints (TG-88, TG-92, TG-100, TG-108), worker (TG-99) | **Migracions amb Supabase CLI** (ja és el que fa TG-69) **+ Kysely** per a les consultes, amb tipus generats; PostGIS amb SQL explícit. **Decidida:** [ADR-0013](decisions/0013-acces-bd-kysely.md) |
| **P13** | Catàleg inicial de ≥ 30 punts i les seves metadades | Seed (TG-87), mapa i recomanacions | Mohamed porta una proposta de llista i camps |
| **P14** | Valors de `tipus` de fenomen | Esdeveniments (TG-106/108), calendari, contracte amb Aprop (TG-109) | Victor ho tanca amb Aprop |

### 5. Propers passos per persona (3 min)

| Persona | Ara | Després |
|---|---|---|
| **Joan** | TG-89 MapLibre + ICGC (09–14/10) | TG-113 design system (10–13/10) · TG-82 pantalla d'accés (14–16/10) |
| **Mohamed** | TG-88 `GET /punts` (10–14/10) · revisions de backend (TG-78) | TG-71 desplegament a la VM (13–16/10) · TG-91 tests de punts |
| **Martina** | Tancar TG-69 · TG-81 Supabase Auth (09–13/10) | TG-84 middleware JWT · TG-115 Meteocat (13–16/10) |
| **Hugo** | TG-95 i TG-114 Open-Meteo (09–13/10) | TG-96 Astronomy Engine (13–14/10) · TG-97 GeoTIFF (14–16/10) |
| **Victor** | TG-106 fenòmens IMO i NASA (09–13/10) | TG-107 fenòmens calculats (13–16/10) · TG-108 endpoint d'esdeveniments |
| **Vinyet** | Ajustos de la CI (TG-70, fins al 14/10) | TG-83 sessió a l'app (14–19/10) · TG-90 marcadors del mapa (15–19/10) |

Dates segons [`sprint-1.md`](sprint-1.md); mana Taiga.

### Tancament

Qui no té algun accés (GitHub, Taiga, Supabase, Expo, Figma)? Dubtes? Tot el que surti es resol a la PR d'aquesta guia o al grup.
