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
- Detall del fenomen: `GET /api/v1/esdeveniments/{id}` (mateixa autenticació; `Accept-Language: ca|es|en`, amb fallback al català)
- Desglossament de l'índex d'un punt: `http://localhost:3000/api/v1/punts/{id}/index?nit=2026-10-19` (cal `DATABASE_URL`)
- Perfil: `GET`, `POST` i `PATCH /api/v1/perfil` (cal el JWT de Supabase a `Authorization: Bearer`)
- Recomanacions: `http://localhost:3000/api/v1/recomanacions?objectiu=cel_estrellat&lat=41.39&lon=2.17&data=<YYYY-MM-DD>&desDe=22&finsA=6&tempsMaxim=150`
- Visibilitat d'una ubicació qualsevol: `http://localhost:3000/api/v1/visibilitat?lat=41.95&lon=1.52` (no cal `DATABASE_URL`; amb `&hora=<ISO 8601>`, una altra hora)
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
| `DATABASE_URL` | — | Postgres (`postgresql://…`). **Opcional:** sense ella l'API arrenca amb un avís, `/health` funciona i `/punts`, `/punts/{id}`, `/punts/{id}/index`, `/recomanacions` i `/perfil` responen 503 `database_unavailable`, i `/visibilitat` funciona amb la foscor estimada. Amb Supabase local: `postgresql://postgres:postgres@127.0.0.1:54322/postgres` |
| `SUPABASE_URL` | `http://127.0.0.1:54321` | URL del projecte de Supabase. `requireAuth` hi valida els JWT amb el JWKS (`/auth/v1/.well-known/jwks.json`, ADR-0023): 401 si el token és dolent, 503 si Supabase no respon. Al compose de la VM és obligatòria |
| `OPEN_METEO_BASE_URL` | `https://api.open-meteo.com/v1` | URL base d'Open-Meteo, la mateixa que fa servir el worker: `GET /visibilitat` hi demana la previsió de les ubicacions que no són al catàleg |
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
    admin.ts            GET /admin/me, GET /admin/usuaris i PATCH /admin/usuaris/{id} (ADR-0029)
    puntIndex.ts        GET /punts/{id}/index: desglossament de l'índex per hores i factors (HU04)
    recomanacions.ts    GET /recomanacions (validació de la consulta i OpenAPI)
    visibilitat.ts      GET /visibilitat: índex d'una ubicació qualsevol (X-Cache i OpenAPI)
    query.ts            Helpers de query compartits: números amb missatge en català i paràmetres buits
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
  visibilitat/
    catalunya.ts        `isInCatalonia`: dins del contorn o a 1,5 km o menys (codi pur)
    contornCatalunya.ts Contorn oficial de l'ICGC simplificat (MultiPolygon). Generat: data/README.md
    lruCache.ts         Memòria cau amb caducitat, LRU, una sola càrrega per clau i la caducada si falla
    sqmRepository.ts    El punt publicat amb SQM més proper i la seva posició (PostGIS)
    visibilitatService.ts  Cel·la, previsió i SQM en memòria cau, límits d'Open-Meteo, efemèrides i fórmula
  middleware/errors.ts  ApiError, 404 i handler central d'errors
```

## `GET /esdeveniments/{id}` (HU10, TG-138)

Retorna la fitxa completa d'un esdeveniment publicable: camps bàsics del calendari, punt
general de referència, explicació del fenomen i de l'ocurrència i consells d'observació.
`horari` repeteix els instants `inici`, `maxim` i `fi` en UTC i associa a cadascun la seva
`precisio` (`dia`, `hora`, `minut` o `segon`). Per exemple, `maxim: 12:00Z` amb precisió
`dia` representa el dia conegut del màxim, no pas una hora astronòmica exacta.

`Accept-Language` admet preferències estàndard com `es-ES,es;q=0.9,en;q=0.8`; se selecciona
la primera llengua disponible entre català, castellà i anglès. Els camps que encara no tenen
traducció es completen en català, que també és l'idioma per defecte. El dataset actual conté
textos en català; les traduccions s'incorporen a la tasca d'i18n del contingut. El llistat
continua en català per al contracte acordat amb Aprop.

Exemple de resposta resumit:

```json
{
  "id": "orionids-2026",
  "tipus": "pluja_estels",
  "nom": "Oriònids",
  "inici": "2026-10-02T00:00:00.000Z",
  "maxim": "2026-10-21T12:00:00.000Z",
  "fi": "2026-11-07T23:59:59.000Z",
  "descripcio": "Pluja anual de meteors ràpids associada al cometa Halley.",
  "ubicacio": { "nom": "Centre d'Observació de l'Univers", "latitud": 42.024603, "longitud": 0.73684 },
  "font": "IMO",
  "horari": {
    "inici": "2026-10-02T00:00:00.000Z",
    "maxim": "2026-10-21T12:00:00.000Z",
    "fi": "2026-11-07T23:59:59.000Z",
    "precisio": { "inici": "dia", "maxim": "dia", "fi": "dia" }
  },
  "explicacio": {
    "fenomen": "Pluja anual de meteors ràpids associada al cometa Halley.",
    "particularitat": "El màxim és prou ample perquè també siguin útils les nits pròximes.",
    "observacioGeneral": "Busqueu un cel fosc durant la segona meitat de la nit.",
    "observacioEsdeveniment": "Observeu la matinada del màxim, quan Orió sigui més alt."
  }
}
```

Respon 404 si l'identificador no correspon a cap esdeveniment publicable; manté 401 per
credencial absent o invàlida i 503 quan no es pot consultar la base de dades o el punt oficial.

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

## `GET /visibilitat` (HU05, TG-130)

L'índex de visibilitat d'**una ubicació qualsevol de Catalunya**, la que l'usuari toca al mapa, per a una hora (tipus `ConsultaVisibilitat` → `VisibilitatUbicacio` a `@talaia/shared`). Els punts del catàleg tenen l'índex precalculat pel worker; aquest es calcula **al moment**, amb el mateix codi (`@talaia/index`: Open-Meteo, Astronomy Engine i la fórmula v1). Per què així: [ADR-0031](../../docs/decisions/0031-visibilitat-ubicacio-al-moment.md).

```json
{
  "lat": 41.95, "lon": 1.52, "sqm": null,
  "index": { "hora": "2026-11-12T21:00:00.000Z", "valor": 68, "franja": "jus",
             "factors": { "nuvols": 0.9, "sol": 1, "foscor": 0.6, "lluna": 1 }, "foscorEstimada": true },
  "deDia": false
}
```

- **Paràmetres:** `lat` i `lon` (graus WGS84, obligatoris) i `hora` (opcional, per defecte ara): un instant ISO 8601 **amb zona** (`2026-11-12T21:00:00Z` o `…+01:00`), del qual compta l'hora UTC que el conté. Des de l'hora en curs fins a **72 hores** endavant.
- **Dins de Catalunya:** el límit oficial de l'ICGC (la unió de les províncies, 1:50.000), simplificat a 200 m i generat per `data/scripts/build-contorn-catalunya.ts` (`visibilitat/contornCatalunya.ts`, no s'edita a mà), amb un marge d'**1,5 km**: un lloc és dins si és dins del contorn o a 1,5 km o menys de la ratlla. Inclou Llívia i deixa fora Andorra.
- **La cel·la:** la ubicació s'arrodoneix a **0,01°** (~1 km). Hi surten `lat` i `lon`, i és on es demana la previsió i es calculen les efemèrides.
- **La foscor:** l'SQM del punt publicat més proper, si n'hi ha un a **1 km** o menys (la cel·la del mapa de foscor). Només compta com a **mesurada** si el punt és a la mateixa cel·la de 0,01°; si és d'una de veïna, el valor es fa servir però `index.foscorEstimada` és `true`. Sense cap punt prou a prop, `sqm: null` i la foscor estimada (0,6). La consulta té un timeout d'**1 s**: si la base de dades falla o tarda, la foscor és estimada, no es desa i la petició següent ho torna a provar. Sense `DATABASE_URL`, sempre estimada: la ruta no depèn de la base de dades.
- **Memòria cau:** la previsió de cada cel·la (de l'hora en curs en endavant) i, a part, el seu SQM es guarden en memòria **fins al minut 5 de l'hora següent**, quan el worker també torna a demanar la previsió. Com a molt **500 cel·les**: en passar-se'n, surt la que fa més temps que no es fa servir. Les consultes simultànies de la mateixa cel·la comparteixen una sola crida, i els errors no es desen. La capçalera `X-Cache` diu d'on surt la previsió:
  - `MISS`: aquesta petició ha cridat Open-Meteo.
  - `HIT`: no l'ha cridat, perquè la previsió ja hi era o l'ha portada una petició simultània que esperava. Una segona consulta de la mateixa cel·la, de qualsevol hora, és un `HIT`.
  - `STALE`: Open-Meteo ha fallat (o s'ha arribat a un dels límits) i és la previsió caducada de la cel·la, si en fa menys de **6 hores**. Si no n'hi ha cap, l'error.
- **Quota d'Open-Meteo:** com a molt **20 consultes noves per client i hora** (UTC) i **250 en total**, perquè la quota diària és compartida amb el worker. Una consulta nova és una que crida Open-Meteo (`MISS`): les cel·les a la memòria cau no hi compten. Passat el límit del client, **429 `too_many_requests`** amb `Retry-After` (segons fins a l'hora següent); passat el total, 503 `meteo_unavailable`. El client és `req.ip`: amb `trust proxy` a un salt (`app.ts`), l'adreça que Nginx afegeix al final de `X-Forwarded-For`, que el client no pot falsejar. Timeout de 5 s per a Open-Meteo.
- **HTTP:** `Cache-Control: private, max-age=<segons fins a la propera hora>`, com `/recomanacions`: la URL porta la ubicació de qui consulta. Per la mateixa raó, el log no en mostra mai les coordenades.

Errors: `lat`, `lon` o `hora` mal formats → 400 `validation_error`; fora de Catalunya → 422 `fora_de_catalunya`; hora abans de l'actual o més enllà de 72 h → 422 `hora_sense_previsio`; massa consultes noves del client → 429 `too_many_requests`; Open-Meteo no respon o s'ha arribat al sostre, i no hi ha cap previsió caducada per servir → 503 `meteo_unavailable`. L'app (TG-131) mostra un missatge per a cada codi.

## `/perfil` (TG-84, HU36 · TG-165)

El perfil de l'usuari autenticat (tipus `Perfil` a `@talaia/shared`, taula `perfils`). Les tres rutes demanen el JWT de Supabase (`requireAuth`, ADR-0023) i responen amb `Cache-Control: no-store`, perquè són dades personals.

- `POST /perfil`: el crea en el primer accés (201) o torna el que ja hi ha (200). L'app la crida després de cada login, amb `{ nom }` opcional (Apple no posa el nom al token).
- `GET /perfil`: el perfil, o 404 `profile_not_found` si encara no s'ha fet el `POST`.
- `PATCH /perfil`: de moment només es pot editar el nom: `{ "nom": "Martina" }` (1–100 caràcters, sense els espais dels extrems). Un camp que no es pot editar és un 400, no s'ignora. Torna el perfil amb el canvi; `data_actualitzacio` la posa el trigger de la taula.

Errors: JWT absent o invàlid → 401 `unauthorized`; compte bloquejat → 403 `account_blocked`; cos invàlid → 400 `validation_error`; sense `DATABASE_URL` o sense poder validar el JWT → 503.

## Rol d'administrador i comptes bloquejats (TG-177, HU41)

`perfils.rol` (`usuari` o `admin`) i `perfils.bloquejat` (ADR-0029). `routes/index.ts` crea un sol `requireUser` (`requireAuth` amb `accountStatus`): valida el JWT i llegeix el perfil, i si el compte està bloquejat respon **403 `account_blocked`**. Totes les rutes d'usuari l'han de fer servir; les rutes públiques (`/health`, `/punts`, `/recomanacions`, `/visibilitat`, `/esdeveniments`) no hi miren. `requireAdmin`, posat al darrere, només deixa passar els administradors: si no, 403 `forbidden`.

Per fer administrador algú, al SQL Editor de Supabase:

```sql
update public.perfils set rol = 'admin' where email = '<correu>';
```

Rutes de `/admin` (tipus `UsuariAdmin` i `UsuariAdminCanvis` a `@talaia/shared`, `Cache-Control: no-store`):

- `GET /admin/me`: respon 204 sense cos si la sessió correspon a un administrador no bloquejat; la web el fa servir per comprovar l'accés sense descarregar la llista d'usuaris.
- `GET /admin/usuaris`: tots els perfils, els més nous primer, amb `rol`, `bloquejat` i `dataBloqueig`.
- `PATCH /admin/usuaris/{id}` amb `{ "bloquejat": true | false }`: bloqueja o desbloqueja el compte. L'`id` és el del perfil (`perfils.id`). Torna el compte amb el canvi. Tornar a bloquejar un compte bloquejat no en canvia la data.

Errors: 401 `unauthorized`; 403 `forbidden` (no és admin) o `account_blocked`; 400 `validation_error` (l'`id` no és un UUID o el cos no és vàlid) o `cannot_block_self` (un administrador no es pot bloquejar a si mateix); 404 `usuari_not_found`; 503 sense base de dades.

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
| 400 | `cannot_block_self` | `PATCH /admin/usuaris/{id}`: un administrador es vol bloquejar a si mateix |
| 401 | `unauthorized` | Falta el JWT o no és vàlid |
| 403 | `account_blocked` | El compte està bloquejat (HU41): a qualsevol ruta amb `requireUser`. L'app hi mostra l'avís |
| 403 | `forbidden` | Ruta de `/admin` amb un compte que no és administrador |
| 404 | `not_found` | La ruta no existeix |
| 404 | `usuari_not_found` | `PATCH /admin/usuaris/{id}`: cap perfil amb aquest `id` |
| 404 | `punt_not_found` | `/punts/{id}` i `/punts/{id}/index`: cap punt publicat amb aquest `id` |
| 422 | `fora_de_catalunya` | `GET /visibilitat`: la ubicació és fora de Catalunya |
| 422 | `hora_sense_previsio` | `GET /visibilitat`: l'hora no és entre l'hora en curs i 72 hores endavant (o Open-Meteo no l'ha tornat) |
| 429 | `too_many_requests` | `GET /visibilitat`: el client ja ha fet 20 consultes noves aquesta hora. Porta `Retry-After` |
| 503 | `database_unavailable` | No hi ha `DATABASE_URL` o no es pot llegir la base de dades |
| 503 | `meteo_unavailable` | `GET /visibilitat`: Open-Meteo no respon o s'ha arribat al màxim de consultes noves d'aquesta hora |
| 500 | `internal_error` | Error inesperat (es registra al log i no s'envia el detall) |

Per a un error controlat: `throw new ApiError(status, 'codi', 'missatge')`, i un quart paràmetre opcional amb capçaleres (`{ 'Retry-After': '60' }`). Express 5 també captura els errors de les funcions `async`.
