# @talaia/api

API REST de Talaia: Node 22 + TypeScript (strict) + **Express 5** a `/api/v1`. Validació amb **zod** i OpenAPI generat dels mateixos esquemes amb `zod-to-openapi` ([ADR-0011](../../docs/decisions/0011-validacio-openapi-zod.md)).

## Arrencar

```bash
nvm use && npm install        # des de l'arrel: instal·la tots els workspaces
npm run api                   # = npm run dev -w services/api, amb recàrrega
```

- Salut: <http://localhost:3000/api/v1/health>
- Punts del mapa: <http://localhost:3000/api/v1/punts> (cal `DATABASE_URL`)
- Desglossament de l'índex d'un punt: `http://localhost:3000/api/v1/punts/{id}/index?nit=2026-10-19` (cal `DATABASE_URL`)
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
| `DATABASE_URL` | — | Postgres (`postgresql://…`). **Opcional:** sense ella l'API arrenca amb un avís, `/health` funciona i `/punts`, `/punts/{id}/index` i `/perfil` responen 503 `database_unavailable`. Amb Supabase local: `postgresql://postgres:postgres@127.0.0.1:54322/postgres` |
| `SUPABASE_URL` | `http://127.0.0.1:54321` | URL del projecte de Supabase. `requireAuth` hi valida els JWT amb el JWKS (`/auth/v1/.well-known/jwks.json`, ADR-0023): 401 si el token és dolent, 503 si Supabase no respon |

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
    punts.ts            GET /punts: bbox, ETag, Cache-Control i 304
    puntIndex.ts        GET /punts/{id}/index: desglossament de l'índex per hores i factors (HU04)
  punts/
    puntsRepository.ts  Consulta dels punts publicats (tots, o un per id) amb @talaia/db (ADR-0013)
    mapDocument.ts      GeoJSON del mapa i retall per bbox
    documentCache.ts    Document en memòria amb ETag del contingut (MapDocumentCache)
    puntsService.ts     Uneix la memòria cau i el bbox; errors de la base de dades → 503
  index/
    night.ts            Què és «una nit» (12:00 → 12:00, hora de Catalunya) i la nit per defecte
    indexRepository.ts  Lectura de la taula index_visibilitat (la que escriu el worker)
    breakdownService.ts Punt + nit → DesglossamentIndex; 404 si el punt no és públic, 503 si la BD falla
  middleware/errors.ts  ApiError, 404 i handler central d'errors
```

## `GET /punts` (ADR-0012)

Un sol GeoJSON `FeatureCollection` amb tots els punts `PUBLICAT`: `[lon, lat]` amb 6 decimals i les propietats `id`, `nom`, `municipi` i `index`. **`index` és `null` fins que el calculin TG-98 i TG-99**; l'app pinta el marcador en gris.

- **Memòria cau:** el document es construeix en memòria i es regenera si té més de 5 minuts. L'`ETag` és un hash del contingut. Les peticions simultànies comparteixen una sola consulta, i si la base de dades falla se serveix l'últim document (503 si no n'hi ha cap).
- **HTTP:** `Cache-Control: public, max-age=<segons fins a la propera hora>`. Amb `If-None-Match` igual a l'`ETag` (també `W/"…"`, que és com el deixa Nginx), 304 sense cos.
- **`?bbox=minLon,minLat,maxLon,maxLat`:** opcional. Retalla el document en memòria, sense consultar la base de dades. Si és invàlid, 400 `validation_error`.
- **TG-99:** quan el worker marqui la versió de cada execució, n'hi ha prou de substituir `createContentHashCache` per una altra implementació de `MapDocumentCache` (`src/punts/documentCache.ts`).

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
- **Errors:** `nit` invàlida → 400 `validation_error`; `id` que no és de cap punt `PUBLICAT` (o que no és un UUID) → 404 `punt_not_found`; sense `DATABASE_URL` o amb la base de dades caiguda → 503 `database_unavailable`.
- **HTTP:** `Cache-Control: public, max-age=<segons fins a la propera hora>`, com `/punts`: l'índex només canvia quan el worker recalcula.
- **TG-92** (`GET /punts/{id}`, la fitxa amb l'índex actual i el de les properes hores) és un router a part: aquest només exposa el desglossament.

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
| 404 | `not_found` | La ruta no existeix |
| 404 | `punt_not_found` | `/punts/{id}/index`: cap punt publicat amb aquest `id` |
| 503 | `database_unavailable` | No hi ha `DATABASE_URL` o no es pot llegir la base de dades |
| 500 | `internal_error` | Error inesperat (es registra al log i no s'envia el detall) |

Per a un error controlat: `throw new ApiError(status, 'codi', 'missatge')`. Express 5 també captura els errors de les funcions `async`.
