import {
  CamelCasePlugin,
  DummyDriver,
  Kysely,
  PostgresAdapter,
  PostgresIntrospector,
  PostgresQueryCompiler,
  type CompiledQuery,
} from 'kysely';
import type { DB } from '@talaia/db';

import { createPuntsRepository } from '../puntsRepository';

function dummyDb() {
  const queries: CompiledQuery[] = [];
  // Sense base de dades: el DummyDriver no retorna files, però el log captura l'SQL.
  const db = new Kysely<DB>({
    dialect: {
      createAdapter: () => new PostgresAdapter(),
      createDriver: () => new DummyDriver(),
      createIntrospector: (k) => new PostgresIntrospector(k),
      createQueryCompiler: () => new PostgresQueryCompiler(),
    },
    plugins: [new CamelCasePlugin()],
    log: (event) => {
      queries.push(event.query);
    },
  });
  return { db, queries };
}

describe('puntsRepository.listPublished', () => {
  it("només llegeix els punts publicats, amb l'índex de l'hora en curs", async () => {
    const { db, queries } = dummyDb();

    await createPuntsRepository(db).listPublished();

    expect(queries).toHaveLength(1);
    expect(queries[0]?.sql).toBe(
      'select "p"."id", "p"."nom", "p"."municipi", st_x("p"."ubicacio"::geometry) as "lon", st_y("p"."ubicacio"::geometry) as "lat", "iv"."valor", "iv"."franja" from "punts_observacio" as "p" left join "index_visibilitat" as "iv" on "iv"."punt_id" = "p"."id" and "iv"."hora" = date_trunc(\'hour\', now()) where "p"."estat" = $1 order by "p"."slug"',
    );
    expect(queries[0]?.parameters).toEqual(['PUBLICAT']);
  });
});

describe('puntsRepository.indexVersion', () => {
  it("llegeix l'última execució correcta del worker", async () => {
    const { db, queries } = dummyDb();

    await expect(createPuntsRepository(db).indexVersion()).resolves.toBeNull();

    expect(queries[0]?.sql).toBe(
      'select max("acabada_el") as "acabada_el" from "execucions_worker" where "estat" = $1',
    );
    expect(queries[0]?.parameters).toEqual(['ok']);
  });
});
