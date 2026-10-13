# ADR-0013: Accés a la base de dades amb Kysely sobre migracions SQL de Supabase

**Estat:** Acceptada · **Data:** 2026-10-09 · Resol la decisió pendent P5

## Context

L'API (endpoints de punts, recomanacions i esdeveniments) i el worker (índex cada hora) han de llegir i escriure a la base de dades de Supabase, que és Postgres 17 amb PostGIS ([ADR-0003](0003-supabase.md)). Cal decidir tres coses: com es defineix l'esquema, amb quina eina hi accedeix el codi i com es mantenen els tipus de TypeScript al dia. TG-86 (model de punts) i tots els endpoints en depenen.

TG-69 ja ha fixat el primer punt: l'esquema es versiona amb **migracions SQL del CLI de Supabase** (`supabase/migrations/`), i la primera activa PostGIS.

## Decisió

**Migracions SQL amb el CLI de Supabase + [Kysely](https://kysely.dev) com a constructor de consultes tipat, amb connexió Postgres directa (`pg`) des de l'API i el worker.**

### Esquema

- L'única font de veritat de l'esquema són les migracions de `supabase/migrations/`, escrites en SQL. Res es crea des del panell (flux a [`onboarding.md`](../onboarding.md#5-supabase-base-de-dades-i-migracions)).
- Taules i columnes en català i `snake_case` (`punts_observacio`, `data_inici`).
- **Totes les taules de `public` tenen RLS activat i sense polítiques** (`alter table … enable row level security;` a la mateixa migració que la crea). Així l'API de dades de Supabase (PostgREST), que és pública amb la clau `anon`, no hi pot llegir ni escriure res. Les dades només passen per la nostra API.
- Coordenades com a `extensions.geography(Point, 4326)` amb índex GIST. PostGIS ja és a l'esquema `extensions`, que és al `search_path` per defecte.

### Accés des del codi

- Un paquet nou, **`packages/db`** (`@talaia/db`), comú a l'API i el worker, conté:
  - `createDb(databaseUrl)`: retorna un `Kysely<DB>` amb `PostgresDialect` sobre un `Pool` de `pg`, i el `CamelCasePlugin` perquè el codi treballi en `camelCase` (`dataInici`) i la base de dades en `snake_case`.
  - `schema.ts`: els tipus `DB` generats amb `kysely-codegen --camel-case` (vegeu més avall). No s'editen a mà.
  - `postgis.ts`: els pocs helpers de PostGIS escrits amb el `sql` de Kysely (`puntDesDeLonLat`, `lon`/`lat`, `dinsBbox`, distància). Kysely no entén PostGIS: tot l'SQL espacial viu aquí, explícit i amb tests.
- La connexió és `DATABASE_URL`, el ***Session pooler*** de Supabase (usuari `postgres.<ref>`). El host directe només té IPv6 i potser la VM no en tindrà. Pool petit: `max: 5` a l'API i `max: 2` al worker.
- **Repositoris per mòdul:** cada mòdul de l'API té un `xxxRepository` que rep el `Kysely<DB>` i retorna tipus de domini de `@talaia/shared`. Les rutes i els serveis mai escriuen consultes. Les transaccions es fan amb `db.transaction()`.
- Els serveis es proven amb repositoris falsos (Jest, sense base de dades). Els helpers de PostGIS i les consultes complexes es poden provar contra la base de dades local (més avall); a la CI encara no.
- `supabase-js` es fa servir **només a l'app i només per a Auth** (login i sessió). L'API valida el JWT (P6) i no fa servir `supabase-js` per a dades.

### Tipus generats

- Qui escriu una migració l'aplica primer a la **base de dades local** de Supabase (Docker), i en genera els tipus amb `kysely-codegen`:
  ```bash
  npx supabase start        # el primer cop baixa les imatges
  npx supabase db reset     # aplica totes les migracions a la base local
  npm run db:types          # kysely-codegen → packages/db/src/schema.ts
  ```
- `schema.ts` va a la mateixa PR que la migració: el revisor veu l'SQL i els tipus que en surten. La CI no necessita cap base de dades.
- Després del `db push` a la base de dades de l'equip (només quan la PR ja és a `snapshot`), `npm run db:types:verify` contra `DATABASE_URL` comprova que el remot coincideix amb el repo.

### Empaquetat

`@talaia/db` no té build propi, com `@talaia/shared`: en desenvolupament (`tsx`) i als tests (`ts-jest`) es llegeix el TypeScript directament. Com que té codi en temps d'execució, l'API (i després el worker) passa a compilar amb **tsup** (`noExternal: [/^@talaia\//]`), que l'inclou dins el `dist/`. `tsc` queda només per al typecheck. Ho fa TG-86 a la mateixa PR que crea el paquet.

## Alternatives descartades

- **`supabase-js` (PostgREST) des de l'API:** cada consulta seria una crida HTTP més, sense transaccions, i PostGIS només s'hi pot fer amb funcions RPC escrites a part. A més, obligaria a dissenyar polítiques RLS per a l'API de dades pública.
- **Drizzle:** l'esquema es defineix en TypeScript i té el seu propi generador de migracions (`drizzle-kit`). Duplicaria les migracions SQL del CLI de Supabase que ja tenim (TG-69), i el suport de `geography` de PostGIS és parcial.
- **Prisma:** no suporta els tipus de PostGIS (caldria SQL cru per a tot el que és geogràfic) i afegeix un motor i un esquema propis.
- **`pg` directe amb SQL en text:** sense tipus, els errors de columnes només surten en temps d'execució. Kysely genera el mateix SQL però el comprova `tsc`.

## Conseqüències

- Les consultes s'escriuen gairebé com SQL (`selectFrom('punts_observacio').where(…)`): qui sap SQL ho llegeix sense aprendre un ORM.
- Un canvi d'esquema que trenca una consulta falla al typecheck de la CI, no en producció.
- Per crear o canviar taules cal **Docker** (per a `supabase start`). Si algú no en té, escriu `schema.ts` a mà a partir de la migració, i qui fa el `db push` passa el `--verify`.
- L'API i el worker es connecten com a `postgres`, que salta RLS: tota l'autorització es fa a l'API (middleware JWT, TG-84). Un rol propi amb menys permisos queda per a més endavant.
- Dependències noves: `kysely`, `pg` i `@types/pg` a `@talaia/db`; `kysely-codegen` i `tsup` com a dependències de desenvolupament.
- Tasques afectades del Sprint 1, sense canviar-ne el nom ni l'estimació: TG-86 (crea `@talaia/db`, la primera taula i `db:types`), TG-88, TG-92, TG-100 i TG-108 (repositoris), TG-99 (el worker fa servir el mateix paquet).
