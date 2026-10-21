# CLAUDE.md — Context per a Claude Code

Aquest fitxer és el punt d'entrada per a qualsevol agent (Claude Code) que treballi en aquest repositori. Llegeix-lo sencer abans de començar una tasca. Els detalls viuen a `docs/`.

## Què és Talaia

App mòbil que recomana **on i quan** observar o fotografiar el cel a **Catalunya**: postes de sol, la Lluna, pluges d'estels, eclipsis, constel·lacions. El nucli és un **índex de visibilitat (0–100)** que creua:

1. Meteorologia (núvols per capes, humitat, visibilitat) — Open-Meteo, contrastat amb Meteocat (XEMA).
2. Contaminació lumínica — mapa de la Generalitat (GeoTIFF, 1 km).
3. Càlcul astronòmic — Astronomy Engine (Sol, Lluna, fases, alçades, crepuscles).
4. Perfil d'horitzó — model d'elevacions de l'ICGC (5 m).

Projecte de l'assignatura **PES (Projecte d'Enginyeria del Software), FIB-UPC**, curs 2026-27 Q1, grup 22, equip C. Sis persones, tres sprints de desenvolupament. Tot el producte és en **català** (amb castellà i anglès com a idiomes de l'app).

Més context: `docs/producte.md` (abast, MVP, NOT list), `docs/arquitectura.md`, `docs/decisions/`.

## Estat actual

- **Sprint 1: 05/10/2026 – 28/10/2026.** Objectiu: base tècnica operativa + primer flux del MVP (login → mapa de punts amb índex v1 → recomanacions → fitxa del punt amb desglossament → calendari de fenòmens). Veure `docs/sprint-1.md`.
- **Sprint 2: 09/11/2026 – 27/11/2026** (sprint master: Martina) i **Sprint 3: 30/11/2026 – 18/12/2026** (sprint master: Hugo). Veure `docs/sprint-2.md` i `docs/sprint-3.md`.
- Les branques `snapshot`, `stable` i `prod` estan protegides (ruleset de GitHub).
- **App:** scaffold fet (TG-66): Expo SDK 57 + Expo Router + MVVM + i18n + TanStack Query + Jest a `apps/mobile` (vegeu el seu `README.md` i `AGENTS.md`). Eines: ADR-0010.
- **Qualitat:** ESLint, Prettier, `tsconfig.base.json` i hooks de commit (husky + lint-staged + commitlint) a l'arrel (TG-67, ADR-0010).
- **API:** scaffold fet (TG-68): Express 5 a `services/api` amb `/api/v1/health`, errors uniformes, entorn validat i OpenAPI generat amb zod + zod-to-openapi (`/api/v1/openapi.json`, `/api/v1/docs`; ADR-0011). Vegeu `services/api/README.md`.
- **Supabase** (TG-69): `supabase/` amb la configuració del CLI (Postgres 17) i les migracions; la primera activa PostGIS a l'esquema `extensions`. Flux de migracions: `docs/onboarding.md` → secció 5.
- **Endpoint de punts** (TG-88): `GET /api/v1/punts`, un sol GeoJSON en memòria amb `ETag`, 304 i `?bbox=` (ADR-0012). `index` és el de l'hora en curs (worker, TG-99) o `null`, i el document es regenera quan el worker acaba una execució. `DATABASE_URL` és opcional: sense ella, `/punts` respon 503. **Fitxa** (TG-92): `GET /api/v1/punts/{id}` amb les metadades, la foscor (`sqm`) i l'índex de l'hora en curs i de les `?hores=` següents (1–48, per defecte 24); tipus `PuntFitxa`. Vegeu `services/api/README.md`.
- **Base de dades** (TG-86): taula `punts_observacio` (PostGIS, RLS sense polítiques) i paquet `packages/db` (`@talaia/db`): `createDb`, tipus generats amb `npm run db:types` i helpers de PostGIS. L'API compila amb tsup. `supabase db reset` carrega els seeds de `supabase/seeds/`. Vegeu `packages/db/README.md`.
- **Commit inicial** (TG-112): `packages/shared` amb els tipus de domini, i mòdul MVVM de referència a `apps/mobile/src/features/apiStatus` (guia «Afegir una pantalla nova» a `apps/mobile/README.md`). A `stable` s'hi arriba amb `release/0.1.0` al final del sprint (ADR-0009).
- **Design system** (TG-113): tokens del Figma (colors, tipografia, moviment) i components base a `apps/mobile/src/shared/ui`. Taula i regles: `docs/design-system.md`.
- **Worker · meteo** (TG-95, TG-114): `services/worker` amb la ingesta de la previsió d'Open-Meteo per punt (núvols per capes, humitat, visibilitat, temperatura, punt de rosada, precipitació i vent; tipus `PrevisioMeteoHora` a `@talaia/shared`). Prova manual: `npm run meteo -w services/worker -- lat,lon`. La persistència amb `@talaia/db` (taula de previsions) encara no hi és. Vegeu `services/worker/README.md`.
- **Worker · observacions** (TG-115): `services/worker/src/meteocat` amb el client de la XEMA de Meteocat (`METEOCAT_API_KEY`, opcional), les taules `estacions_xema` i `lectures_xema` i l'estació més propera a cada punt (`punts_observacio.estacio_xema`). El procés horari (`meteocat/planificacio.ts`) hi baixa les lectures d'ahir cada dia a les 06:15 UTC i actualitza les estacions el dia 1 de cada mes i en arrencar si no n'hi ha cap (ADR-0025); sense la clau, no planifica res i ho avisa al log. L'ajust de l'índex és TG-184. Prova: `npm run xema -w services/worker -- CC [YYYY-MM-DD]`.
- **Worker · astronomia** (TG-96): `services/worker/src/astronomia` amb Astronomy Engine (sense API externa, ADR-0004): posició del Sol i de la Lluna, fase, franja de crepuscle per hora (`efemeridesHores`, alineable amb la previsió) i esdeveniments d'una nit (`nitAstronomica`: posta i sortida del Sol, crepuscles civil/nàutic/astronòmic, sortida i posta de la Lluna). Tipus `EfemeridesHora` i `NitAstronomica` a `@talaia/shared`. Prova manual: `npm run astro -w services/worker -- lat,lon [YYYY-MM-DD]`.
- **Worker · horari** (TG-99): `services/worker/src/main.ts` recalcula l'índex de tots els punts en arrencar i cada hora amb node-cron (ADR-0024) i deixa cada execució a `execucions_worker`, que l'API fa servir com a versió del mapa (ADR-0012). Prova: `npm run start -w services/worker` amb `DATABASE_URL`.
- **Worker · índex** (TG-98): fórmula de l'índex v1 a `services/worker/src/index` (codi pur, ADR-0018: els núvols i el Sol multipliquen, la foscor i la Lluna es ponderen; franges 0–39/40–69/70–100) i taula `index_visibilitat` (una fila per punt i hora, amb els factors). La foscor és provisional (0,6) fins a TG-97. Prova manual: `npm run index -w services/worker -- lat,lon [sqm]`.
- **Foscor del cel** (TG-97): la Generalitat serveix el mapa de contaminació lumínica (brillantor del cel al zenit, SQM en mag/arcsec², malla d'1 km) com a capa WFS, no com a fitxer. `data/scripts/build-mapa-foscor.ts` la descarrega i la rasteritza a GeoTIFF amb geotiff.js (`data/raw/`, no versionat) i `fill-sqm.ts` omple l'`sqm` de cada punt al GeoJSON, d'on surt el seed i la columna `punts_observacio.sqm` (ADR-0020). És el valor que `calculaIndexHores` rep com a `sqm`; `null` = fora del mapa (foscor estimada). `data/` és un workspace: `npm test -w data`.
- **Desglossament de l'índex** (TG-104): `GET /api/v1/punts/{id}/index?nit=YYYY-MM-DD` retorna l'índex d'un punt una nit hora a hora amb els factors (`DesglossamentIndex` a `@talaia/shared`), llegit de la taula `index_visibilitat`. Una nit va de les 12:00 locals del dia al migdia de l'endemà (`services/api/src/index/night.ts`). És el que consumeix el component de HU04 (TG-105).
- **CI** (TG-70): lint, typecheck i tests de l'app, de l'API, del worker i de `@talaia/db` a cada PR; SonarCloud preparat (`docs/ci.md`).
- **Inici de sessió** (TG-249): sense sessió l'app obre la benvinguda (`useSessionGate`). Google pel navegador (PKCE, `expo-web-browser`), Apple natiu a iOS (`expo-apple-authentication`, ADR-0016) i correu amb codi de 6 xifres a `/benvinguda-correu`; després de cada login, `POST /api/v1/perfil`. Les plantilles de correu de Supabase han de portar `{{ .Token }}`. Vegeu `apps/mobile/README.md`.
- **Explora** (TG-101): la pestanya d'inici és «Què vols veure?» (mockup 02): què, des d'on (ubicació actual amb `expo-location`), quan i fins a quant temps en cotxe. «Troba el millor lloc» obre el mapa a `/recomanacions`, on TG-102 hi posarà el rànquing. La consulta és `ConsultaRecomanacions` a `@talaia/shared`.
- **Mapa** (TG-89): MapLibre GL JS en una DOM component d'Expo, amb l'estil nocturn de l'ICGC, terreny 3D i cel de nit (ADR-0015). Tota l'app es prova a **Expo Go**; cap mòdul natiu que Expo Go no porti sense ADR (ADR-0014). Identificador: `cat.talaia.app`.
- **Desplegament** (TG-71): `deploy/compose.yaml` (Nginx + API + acme.sh; worker horari inclòs) a la VM de la FIB, HTTPS al 8080 amb DuckDNS + Let's Encrypt DNS-01, i deploy de `stable` per pull: un cron de la VM executa `deploy/scripts/desplega.sh` cada 5 minuts, sense runner (ADR-0021). Secrets a `/opt/talaia/.env` a la VM. Vegeu `docs/desplegament.md` i ADR-0019.

## Stack (decidit, no reobrir sense ADR)

| Capa | Tecnologia |
|---|---|
| App mòbil | React Native + TypeScript amb **Expo** (EAS Build, Expo Push), arquitectura **MVVM** |
| Mapa | **MapLibre GL JS** en una DOM component d'Expo + tessel·les vectorials i relleu 3D de l'**ICGC** (estil nocturn propi; ADR-0015) |
| Web d'administració | React + TypeScript (estàtica, servida per Nginx) |
| API | **Node.js + TypeScript + Express**, REST a `/api/v1`, documentada amb **OpenAPI** |
| Worker | Procés Node.js que recalcula l'índex **cada hora** (índex precalculat, no a cada petició) |
| Dades | **Supabase**: PostgreSQL + **PostGIS**, Auth (Google, Apple, correu → JWT), Storage |
| Accés a dades | Migracions SQL del CLI de Supabase + **Kysely** a `packages/db` (tipus amb `kysely-codegen`, RLS sense polítiques; ADR-0013) |
| Infra | VM Ubuntu amb **Docker Compose** (API + worker + Nginx), HTTPS amb Let's Encrypt |
| CI | GitHub Actions: lint + typecheck + tests a cada PR, anàlisi de qualitat (SonarCloud) |
| i18n | i18next (ca per defecte, es, en) |

Per què cada peça i què es va descartar: `docs/arquitectura.md`.

## Ordres

```bash
nvm use && npm install        # a l'arrel (npm workspaces)
npm run mobile                 # Expo Go (tota l'app, mapa inclòs)
npm run api                    # API amb recàrrega (http://localhost:3000/api/v1/docs)
npm run typecheck && npm test  # tots els workspaces
npm run lint                   # ESLint a tot el repo
npm run format                 # Prettier (format:check per comprovar-ho)
npm run db:types               # tipus de Kysely de la base de dades local (després d'una migració)
```

Un workspace nou estén `tsconfig.base.json` de l'arrel i no necessita configuració d'ESLint pròpia.

Dins d'`apps/mobile`, les dependències natives s'afegeixen amb `npx expo install`.

## Estructura del monorepo

```
apps/mobile        App React Native (Expo) — MVVM
apps/admin         Web d'administració (React)
services/api       API REST Express (/api/v1, OpenAPI)
services/worker    Worker horari de l'índex de visibilitat
packages/shared    Tipus i models compartits (PuntObservacio, Esdeveniment, IndexVisibilitat…)
packages/db        Accés a la base de dades amb Kysely: createDb, tipus generats i helpers de PostGIS
data/              Dades estàtiques i scripts de preprocés (GeoTIFF, seeds) — els fitxers grans NO es versionen
docs/              Context, decisions (ADR), sprint, contractes d'API
```

Regla: un tipus de domini s'escriu **una sola vegada** a `packages/shared` i el consumeixen l'app, l'admin, l'API i el worker, sempre amb `import type` (el paquet no té build; vegeu el seu README).

## Convencions

- **TypeScript strict** a tot arreu. Res de `any` sense comentari que ho justifiqui.
- **Idioma:** identificadors de codi en anglès; textos de l'app sempre via i18n (claus en anglès, valors ca/es/en); documentació, issues i PR en català.
- **MVVM a l'app:** `View` (components, sense lògica) → `ViewModel` (hook `useXxxViewModel`, estat i accions) → `Model`/`Repository` (accés a l'API). Les pantalles no criden l'API directament.
- **Design system:** tots els colors, tipografies i espaiats surten dels tokens (`docs/design-system.md`). Cap color "a mà" a les pantalles.
- **Moviment i fluïdesa:** l'app ha de ser molt estètica i fluida. Animacions amb Reanimated (només `transform`/`opacity`), esquelets en lloc d'spinners, resposta al tacte i 60 fps comprovats al dispositiu: regles a `docs/design-system.md`.
- **API:** REST, recursos en català tal com estan acordats amb altres equips (`/punts`, `/recomanacions`, `/esdeveniments`). Errors amb format uniforme `{ error: { code, message } }`. Tota ruta nova es documenta a l'OpenAPI a la mateixa PR.
- **Tests:** Jest. Cada ViewModel i cada servei de domini amb tests. La fórmula de l'índex és codi pur i 100 % testejable.
- **Secrets:** mai al repositori (és **públic**). `.env.example` documenta les variables; els valors reals van a `.env` (ignorat) i als secrets de GitHub.

## Flux de Git (obligatori): Gitflow + Conventional Commits 1.0.0

Detalls i receptes: `docs/git-workflow.md` (ADR-0009).

- **Gitflow** amb els noms de l'assignatura: `snapshot` = `develop` (per defecte), `stable` = `main` (una versió etiquetada per sprint, `v0.N.0`), `prod` = versió publicada.
- Branques de suport: `feature/TG-<ref>-descripcio-curta` des de `snapshot` i de tornada a `snapshot`; `release/0.N.0` des de `snapshot` cap a `stable` i `snapshot`; `hotfix/0.N.x` des de `stable` cap a `stable` i `snapshot`. No hi ha altres prefixos (res de `fix/`, `docs/`…: tot el que no és release ni hotfix és una feature).
- Tot entra per **pull request** amb CI en verd i **1 revisió aprovada**, fusionada amb merge commit. Ningú fa push directe a `snapshot`, `stable` ni `prod`.
- **Commits:** [Conventional Commits 1.0.0](https://www.conventionalcommits.org/en/v1.0.0/): `<tipus>(<àmbit>): <descripció>` amb el peu **`Refs: TG-<ref>`** obligatori (l'assignatura exigeix lligar cada commit a Taiga). Canvi incompatible: `!` i/o peu `BREAKING CHANGE:`.

  ```
  feat(api): afegeix GET /punts amb filtre per bbox

  Refs: TG-88
  ```

## Definition of Done

Especificada → implementada → provada (tests a la CI) → revisada (PR aprovada) → documentada (OpenAPI / memòria) → integrada a `snapshot`.

## Com ha de treballar Claude Code aquí

1. Identifica la tasca de Taiga (ref `TG-xx`) i llegeix-ne la descripció i els criteris d'acceptació de la història (`docs/sprint-<N>.md` del sprint de la tasca).
2. Crea la branca `feature/TG-<ref>-…` des de `snapshot` actualitzada.
3. Respecta el stack i les convencions; si una decisió no està presa, consulta `docs/decisions/pendents.md` i **pregunta** abans d'inventar-la.
4. Escriu tests i actualitza l'OpenAPI / docs a la mateixa PR.
5. Missatges de commit i descripció de PR seguint la convenció; plantilla a `.github/pull_request_template.md`.

## Enllaços

- Repositori: https://github.com/pes2627q1-22-gei-upc/talaia
- Entorn local i flux d'una tasca per a persones: `docs/onboarding.md`
- Taiga: https://tree.taiga.io/project/mohamed-dari-pes_22_c_talaia
- Documentació de l'assignatura i lliurables: Google Drive, carpeta `PES_22_C_TALAIA` (no al repo).
