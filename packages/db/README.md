# @talaia/db

Accés a la base de dades de l'API i el worker: [Kysely](https://kysely.dev) sobre Postgres + PostGIS, amb l'esquema definit per les migracions de `supabase/migrations/` ([ADR-0013](../../docs/decisions/0013-acces-bd-kysely.md)).

## Què hi ha

| Fitxer | Què és |
|---|---|
| `src/createDb.ts` | `createDb(databaseUrl, { max })`: `Kysely<DB>` amb un `Pool` de `pg` i el `CamelCasePlugin` |
| `src/schema.ts` | Tipus `DB` generats amb `kysely-codegen`. **No s'edita a mà**. Les columnes amb un `check` de valors (`estat`, `origen`) es tipen com a unions a `kysely-codegen.overrides` del `package.json` de l'arrel |
| `src/postgis.ts` | Helpers de PostGIS: `puntDesDeLonLat`, `lon`, `lat`, `dinsBbox`, `distancia` |

El codi treballa en camelCase (`puntsObservacio.dataCreacio`) i la base de dades en snake_case (`punts_observacio.data_creacio`).

## Com es fa servir

```ts
import { createDb, dinsBbox, lat, lon } from '@talaia/db';

const db = createDb(env.DATABASE_URL, { max: 5 }); // un sol cop, a l'arrencada

const punts = await db
  .selectFrom('puntsObservacio')
  .select((eb) => ['id', 'nom', lon(eb.ref('ubicacio')).as('lon'), lat(eb.ref('ubicacio')).as('lat')])
  .where('estat', '=', 'PUBLICAT')
  .where((eb) => dinsBbox(eb.ref('ubicacio'), bbox))
  .execute();
```

Les consultes van als repositoris de cada mòdul (`xxxRepository`), que reben el `Kysely<DB>` i retornen tipus de `@talaia/shared`. Tot l'SQL espacial va a `postgis.ts`.

El paquet no té build: `tsx` i `ts-jest` llegeixen el TypeScript directament, i el `tsup` de l'API l'inclou dins del seu `dist/`.

## Canviar l'esquema

1. `npx supabase migration new <nom>` i escriu l'SQL ([onboarding, secció 5](../../docs/onboarding.md#5-supabase-base-de-dades-i-migracions)).
2. Aplica-la a la base de dades **local** i regenera els tipus (cal Docker):
   ```bash
   npx supabase start
   npx supabase db reset
   npm run db:types          # des de l'arrel: escriu src/schema.ts
   ```
3. La migració i `schema.ts` van a la mateixa PR.

`npm run db:types` llegeix sempre la base de dades local (`127.0.0.1:54322`) i només l'esquema `public`. Després del `db push`, comprova que la de l'equip coincideix amb el repo (llegeix `DATABASE_URL` del `.env` de l'arrel):

```bash
npm run db:types:verify
```

## Tests

`npm test -w packages/db`. Comproven l'SQL que generen els helpers sense connectar-se a cap base de dades.
