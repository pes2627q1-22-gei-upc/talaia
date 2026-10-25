# @talaia/api

API REST de Talaia: Node 22 + TypeScript (strict) + **Express 5** a `/api/v1`. Validació amb **zod** i OpenAPI generat dels mateixos esquemes amb `zod-to-openapi` ([ADR-0011](../../docs/decisions/0011-validacio-openapi-zod.md)).

## Arrencar

```bash
nvm use && npm install        # des de l'arrel: instal·la tots els workspaces
npm run api                   # = npm run dev -w services/api, amb recàrrega
```

- Salut: <http://localhost:3000/api/v1/health>
- Punts del mapa: <http://localhost:3000/api/v1/punts> (cal `DATABASE_URL`)
- Fitxa d'un punt: `http://localhost:3000/api/v1/punts/<id>?hores=24`
- Calendari: `GET /api/v1/esdeveniments?des_de=2026-10-01&fins_a=2026-10-31` (JWT de Talaia o `X-API-Key` d'Aprop)
- Desglossament de l'índex d'un punt: `http://localhost:3000/api/v1/punts/{id}/index?nit=2026-10-19` (cal `DATABASE_URL`)
- Perfil: `GET`, `POST` i `PATCH /api/v1/perfil` (cal el JWT de Supabase a `Authorization: Bearer`)
- Recomanacions: `http://localhost:3000/api/v1/recomanacions?objectiu=cel_estrellat&lat=41.39&lon=2.17&data=<YYYY-MM-DD>&desDe=22&finsA=6&tempsMaxim=150`
- Documentació (Swagger UI): <http://localhost:3000/api/v1/docs>
- OpenAPI: <http://localhost:3000/api/v1/openapi.json>

| Ordre (`-w services/api`) | Què fa |
|---|---|
| `npm run dev` | `tsx watch`: recarrega en desar |
| `npm run build` | `tsup`: empaqueta a `dist/server.js`, amb el codi de `@talaia/*` a dins ([ADR-0013](../../docs/decisions/0013-acces-bd-kysely.md)) |
| `npm start` | Executa `dist/server.js` (cal `build` abans) |
| `npm run typecheck` | TypeScript strict (`tsconfig.base.json` de l'arrel). `tsc` només comprova tipus, no compila |
| `npm test` | Jest + supertest |
| `npm run lint` | ESLint amb la configuració de l'arrel |

## Variables d'entorn

Es llegeixen del `.env` de l'**arrel** del repo (`dev` i `start` el carreguen amb `--env-file-if-exists`; vegeu `.env.example`). Es validen a l'arrencada a `src/config/env.ts`: si n'hi ha alguna de malament, l'API no arrenca i diu quina és.

| Variable | Per defecte | Què és |
|---|---|---|
| `API_PORT` | `3000` | Port on escolta l'API |
| `DATABASE_URL` | — | Postgres (`postgresql://…`). **Opcional:** sense ella l'API arrenca amb un avís, `/health` funciona i `/punts`, `/punts/{id}`, `/punts/{id}/index`, `/recomanacions` i `/perfil` responen 503 `database_unavailable`. Amb Supabase local: `postgresql://postgres:postgres@127.0.0.1:54322/postgres` |
| `SUPABASE_URL` | `http://127.0.0.1:54321` | URL del projecte de Supabase. `requireAuth` hi valida els JWT amb el JWKS (`/auth/v1/.well-known/jwks.json`, ADR-0023): 401 si el token és dolent, 503 si Supabase no respon. Al compose de la VM és obligatòria |
| `APROP_API_KEY` | — | Secret de l'API assignat a Aprop. No s'inclou al repositori ni a l'app; sense configurar-lo, l'accés amb API key retorna 503, però l'accés JWT continua disponible. |

Una variable nova s'afegeix a l'esquema de `src/config/env.ts` i a `.env.example`. Cap secret al repo.

## Estructura

```
src/
  server.ts             Arrencada: valida l'entorn i fa listen
  app.ts                createApp(): middlewares, /api/v1, 404 i handler d'errors (els tests la fan servir sense port)
  config/env.ts         Variables d'entorn validades amb zod i versió de l'API
  openapi.ts            registry de zod-to-openapi i generació del document
  routes/
    index.ts            Router de /api/v1: munta un router per recurs, /openapi.json i /docs
    health.ts           GET /health
    punts.ts            GET /punts (bbox, ETag, Cache-Control i 304) i GET /punts/{id}
    esdeveniments.ts    GET /esdeveniments, autenticació API key o JWT
    auth.ts             GET, POST i PATCH /perfil (JWT de Supabase, ADR-0023)
    puntIndex.ts        GET /punts/{id}/index: desglossament de l'índex per hores i factors (HU04)
    recomanacions.ts    GET /recomanacions (validació de la consulta i OpenAPI)
  punts/
    puntsRepository.ts  Consultes dels punts publicats i del seu índex amb @talaia/db (ADR-0013)
    mapDocument.ts      GeoJSON del mapa i retall per bbox
    documentCache.ts    Document en memòria amb ETag del contingut (MapDocumentCache)
    puntsService.ts     Memòria cau i bbox del mapa, i fitxa amb l'índex per hores; errors de la base de dades → 503
  esdeveniments/
    dates.ts            Límits del dia civil de Catalunya convertits a UTC
    esdevenimentsRepository.ts  Consulta Kysely del calendari i el punt oficial
    esdevenimentsService.ts     Mapatge a la resposta pública i errors de la BD
  index/
    night.ts            Què és «una nit» (12:00 → 12:00, hora de Catalunya) i la nit per defecte
    indexSchemas.ts     Esquemes zod/OpenAPI de l'índex per hora (IndexHora), compartits per /punts/{id} i /punts/{id}/index
    breakdownService.ts Punt + nit → DesglossamentIndex; 404 si el punt no és públic, 503 si la BD falla
  recomanacions/
    franja.ts           Franja horària local de Catalunya (Europe/Madrid) → UTC, amb el canvi d'hora
    rutes.ts            Temps en cotxe ↔ radi en línia recta, fins que hi hagi Mobilicat
    recomanacionsRepository.ts  Punts dins del radi (PostGIS) i índex de la franja
    recomanacionsService.ts     Rànquing: millor hora, mitjana i distància; errors de la base de dades → 503
  middleware/errors.ts  ApiError, 404 i handler central d'errors
```

## `GET /punts` (ADR-0012)

Un sol GeoJSON `FeatureCollection` amb tots els punts `PUBLICAT`: `[lon, lat]` amb 6 decimals i les propietats `id`, `nom`, `municipi` i `index`. `index` és el de l'**hora en curs** que ha desat el worker (TG-99), o `null` si encara no s'ha calculat (l'app pinta el marcador en gris). Porta `deDia: true` quan el Sol encara no s'ha post (factor `sol` 0): l'índex val 0 per l'hora, no pel cel, i l'app també el pinta en gris.

- **Memòria cau:** el document es construeix en memòria i es regenera si té més de 5 minuts. L'`ETag` és un hash del contingut. Les peticions simultànies comparteixen una sola consulta, i si la base de dades falla se serveix l'últim document (503 si no n'hi ha cap).
- **HTTP:** `Cache-Control: public, max-age=<segons fins a la propera hora>`. Amb `If-None-Match` igual a l'`ETag` (també `W/"…"`, que és com el deixa Nginx), 304 sense cos.
- **`?bbox=minLon,minLat,maxLon,maxLat`:** opcional. Retalla el document en memòria, sense consultar la base de dades. Si és invàlid, 400 `validation_error`.
- **Hora en curs i versió del worker** (ADR-0012, TG-99): a cada petició, l'API compara l'hora en curs (rellotge de l'API, sense anar a la BD) amb la del document, i si ha canviat el regenera amb l'índex de l'hora nova. A més, com a molt un cop per minut llegeix l'última execució de `execucions_worker` que ha desat algun punt, i si ha canviat també el regenera. L'`ETag` continua sent el hash del contingut.

## `GET /punts/{id}` (HU07, TG-92)

La fitxa d'un punt `PUBLICAT` (tipus `PuntFitxa` a `@talaia/shared`): metadades del catàleg, `lat`/`lon`, la foscor del cel `sqm` (mag/arcsec², ADR-0020; `null` si no està calculada) i `index`:

- `actual`: l'índex de l'hora en curs (UTC, a l'hora en punt) amb els factors i `foscorEstimada`, o `null` si el worker encara no l'ha calculat.
- `properesHores`: les `?hores=` següents (1–48, per defecte 24), en ordre. Si el worker n'ha calculat menys, només hi ha les que hi ha.

Errors: `id` que no és un UUID o `hores` fora de rang → 400 `validation_error`; punt inexistent o no publicat → 404 `punt_not_found` (l'app tracta el 400 i el 404 igual: «aquest punt no existeix»); sense base de dades → 503. `Cache-Control` fins a la propera hora.

## `GET /punts/{id}/index` (HU04, TG-104)

El desglossament de l'índex d'un punt per a una nit: una entrada per hora amb el valor (0–100), la franja i els quatre factors de la fórmula v1 ([ADR-0018](../../docs/decisions/0018-formula-index-v1.md)): `nuvols`, `sol`, `foscor` i `lluna`, de 0 a 1, més `foscorEstimada`. El tipus és `DesglossamentIndex` a `@talaia/shared` i les dades surten de la taula `index_visibilitat`, que escriu el worker cada hora (TG-99): l'API no calcula res.

```json
{
  "punt": { "id": "6f1c2b7e-…", "nom": "Mirador del Montsec", "municipi": "Àger" },
  "nit": "2026-10-19",
  "hores": [
    { "hora": "2026-10-19T19:00:00.000Z", "valor": 89, "franja": "ras",
      "factors": { "nuvols": 1, "sol": 1, "foscor": 0.95, "lluna": 0.8 }, "foscorEstimada": false }
  ]
}
```

- **La nit** (`?nit=YYYY-MM-DD`, el dia del vespre, com `ConsultaRecomanacions.data`) va de les **12:00 locals** d'aquell dia a les 12:00 de l'endemà, en hora de Catalunya (`Europe/Madrid`, `src/index/night.ts`): la nit del canvi d'hora té 25 o 23 hores. Sense `nit`, la d'avui: fins al migdia, la que s'està acabant; a partir del migdia, la que ve.
- **Només les hores calculades.** Si el worker encara no ha passat, `hores` és `[]` amb 200. Les hores de dia hi són amb `factors.sol = 0` i valor 0, perquè el component (TG-105) pugui mostrar on comença la nit.
- **Errors:** `id` que no és un UUID o `nit` invàlida o fora del 2000–2100 → 400 `validation_error`; cap punt `PUBLICAT` amb aquest `id` → 404 `punt_not_found` (com a `/punts/{id}`); sense `DATABASE_URL` o amb la base de dades caiguda → 503 `database_unavailable`.
- **HTTP:** `Cache-Control: public, max-age=<segons fins a la propera hora>`, com `/punts`: l'índex només canvia quan el worker recalcula.
- **Comparteix amb `/punts/{id}`** les consultes del repositori (`findPublished`, `indexHores`) i l'esquema `IndexHora` de l'OpenAPI (`src/index/indexSchemas.ts`); la ruta és un router a part (`routes/puntIndex.ts`).

## `GET /recomanacions` (HU01, TG-100)

El rànquing de punts per a la consulta de «Què vols veure?» (`ConsultaRecomanacions` → `RecomanacionsResposta` a `@talaia/shared`). Paràmetres obligatoris: `objectiu`, `lat`, `lon` (l'origen), `data` (la nit, `YYYY-MM-DD`, entre el 2000 i el 2100), `desDe` i `finsA` (hores locals de Catalunya, 0–23, diferents) i `tempsMaxim` (minuts en cotxe, 1–600). Opcional: `limit` (1–100, per defecte 20). La mateixa definició valida i documenta la query (ADR-0011).

- **Radi:** fins que hi hagi el servei de rutes de Mobilicat (`docs/serveis-externs.md`), el temps en cotxe es converteix en un radi en línia recta amb **60 km/h** i un **desviament ×1,3** per les carreteres (`rutes.ts`): 150 min → 115,4 km. El `tempsEstimat` de cada punt surt de la mateixa fórmula a la inversa.
- **Nit i franja:** una nit va de les 12:00 locals de `data` a les 12:00 de l'endemà, com a `GET /punts/{id}/index` (`INICI_NIT` a `franja.ts`). Una hora d'abans de les 12 és la de l'endemà: de 01 a 05 amb `data=2026-10-21` és la matinada del 22. Si `finsA` < `desDe`, la franja acaba l'endemà de `desDe`. Es passa a UTC amb el canvi d'hora. Si ja ha començat, només compten les hores des de l'hora en curs; si ja ha acabat, 400 `franja_passada`.
- **Rànquing:** per a cada punt publicat dins del radi, la **millor hora** de la franja (l'índex més alt; la primera si n'hi ha d'empatades), la **mitjana** i `horesAmbIndex` (de quantes hores surt la mitjana). S'ordena per la millor hora, després per la mitjana i després per la distància. Es retornen els `limit` primers; `total` diu quants punts hi ha dins del radi.
- **Sense índex** (una nit més enllà de la previsió, ~4 dies): 200 amb `millorHora` i `mitjana` a `null` i els punts per distància. L'app hi pot dir «encara no hi ha previsió».
- **Objectiu:** es valida, però l'índex v1 és el mateix per a tots (ADR-0018). Per a `posta_sol` i `sortida_sol` surt baix, perquè el factor Sol val 0 de dia: l'adaptació per fenomen és d'un sprint posterior.

Errors: paràmetres invàlids → 400 `validation_error`; franja passada → 400 `franja_passada`; sense base de dades → 503. `Cache-Control` fins a la propera hora.

## `/perfil` (TG-84, HU36 · TG-165)

El perfil de l'usuari autenticat (tipus `Perfil` a `@talaia/shared`, taula `perfils`). Les tres rutes demanen el JWT de Supabase (`requireAuth`, ADR-0023) i responen amb `Cache-Control: no-store`, perquè són dades personals.

- `POST /perfil`: el crea en el primer accés (201) o torna el que ja hi ha (200). L'app la crida després de cada login, amb `{ nom }` opcional (Apple no posa el nom al token).
- `GET /perfil`: el perfil, o 404 `profile_not_found` si encara no s'ha fet el `POST`.
- `PATCH /perfil`: de moment només es pot editar el nom: `{ "nom": "Martina" }` (1–100 caràcters, sense els espais dels extrems). Un camp que no es pot editar és un 400, no s'ignora. Torna el perfil amb el canvi; `data_actualitzacio` la posa el trigger de la taula.

Errors: JWT absent o invàlid → 401 `unauthorized`; cos invàlid → 400 `validation_error`; sense `DATABASE_URL` o sense poder validar el JWT → 503.

## Afegir una ruta

1. Crea `src/routes/<recurs>.ts` amb el seu `Router`, els esquemes zod (`.meta({ id })` per als que han de sortir a l'OpenAPI) i `registry.registerPath(...)` per a cada ruta.
2. Munta'l a `src/routes/index.ts` (`router.use('/<recurs>', …)`), **abans** de generar el document.
3. Valida l'entrada amb `Schema.parse(...)`: si falla, el handler central respon 400.
4. Tests a `src/__tests__/` amb supertest.

## Errors

Tota resposta d'error té el format `{ error: { code, message } }`:

| Status | `code` | Quan |
|---|---|---|
| 400 | `validation_error` | Un esquema zod rebutja l'entrada |
| 400 | `invalid_json` | El cos no és JSON vàlid |
| 400 | `franja_passada` | `GET /recomanacions` amb una franja horària que ja ha acabat |
| 404 | `not_found` | La ruta no existeix |
| 404 | `punt_not_found` | `/punts/{id}` i `/punts/{id}/index`: cap punt publicat amb aquest `id` |
| 503 | `database_unavailable` | No hi ha `DATABASE_URL` o no es pot llegir la base de dades |
| 500 | `internal_error` | Error inesperat (es registra al log i no s'envia el detall) |

Per a un error controlat: `throw new ApiError(status, 'codi', 'missatge')`. Express 5 també captura els errors de les funcions `async`.
