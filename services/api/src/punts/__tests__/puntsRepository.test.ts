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

describe('puntsRepository.listPublished', () => {
  it("només llegeix els punts amb estat = 'PUBLICAT'", async () => {
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

    await createPuntsRepository(db).listPublished();

    expect(queries).toHaveLength(1);
    expect(queries[0]?.sql).toBe(
      'select "id", "nom", "municipi", st_x("ubicacio"::geometry) as "lon", st_y("ubicacio"::geometry) as "lat" from "punts_observacio" where "estat" = $1 order by "slug"',
    );
    expect(queries[0]?.parameters).toEqual(['PUBLICAT']);
  });
});
